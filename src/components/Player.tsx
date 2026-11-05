import {lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState,useSyncExternalStore,type CSSProperties} from 'react'
import {ArrowLeft,ArrowRight,AudioLines,BookOpen,Check,ChevronDown,ChevronLeft,ChevronRight,CircleHelp,Expand,Footprints,Layers3,Map,Maximize,Minus,Pause,Play,Plus,Repeat2,RotateCcw,ScanLine,SkipBack,Star,Volume2,VolumeX} from 'lucide-react'
import type {Trace} from '../engine/Scene'
import {SceneBoundary,supportsWebGL} from '../engine/SceneBoundary'
import {loadTracks} from '../engine/asset'
import {Transport,phaseIndex,speeds,type Speed} from '../engine/transport'
import {CueScheduler} from '../engine/audio'
import type {Lesson,LessonPack,Track,Quiz} from '../content/lesson'
import {labsTitle,viewLabels,views,type Technique,type View} from '../content/techniques'
import {initial,loadProgress,saveProgress,type Progress} from '../storage/progress'
import {MovementMap,PoseDiagram} from './MovementMap'

const Scene=lazy(()=>import('../engine/Scene'))
const SoftwareScene=lazy(()=>import('../engine/SoftwareScene'))
const fmt=(n:number)=>Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0')
type Mode='full'|'segment'|'connect'|'quiz'
const modeLabels:Record<Mode,string>={full:'전체 보기',segment:'나누어 배우기',connect:'이어서 하기',quiz:'순서 연습'}
interface PlayerProps {
  lesson:Lesson; technique?:Technique; pack:LessonPack; teacher:boolean; onTeacher:()=>void;
  low:boolean; resume:boolean; defaultView:View; onBack:()=>void; variant:string; onVariant:(id:string)=>void
}
function CardOrder({phases,onAnswer}:{phases:string[];onAnswer:(ok:boolean)=>void}){
  const order=[2,0,1]
  const [picked,setPicked]=useState<number[]>([])
  const [done,setDone]=useState<boolean|null>(null)
  const append=(n:number)=>{if(!picked.includes(n)&&done===null)setPicked([...picked,n])}
  return <div className="cardOrder">
    <p className="quiet">다음 세 구간을 재생 순서대로 선택하세요.</p>
    <div className="answerGrid">{order.map(n=><button key={n} disabled={picked.includes(n)||done!==null} onClick={()=>append(n)}>{phases[n]}</button>)}</div>
    <div className="orderPicked">{picked.length?picked.map(n=>phases[n]).join(' → '):'선택한 구간이 여기에 표시됩니다.'}</div>
    {done!==null&&<p role="status" className={done?'rightAnswer':'wrongAnswer'}>{done?'순서가 맞아요.':'단계 목록에서 순서를 확인하고 다시 시도해 보세요.'}</p>}
    <div className="row">
      <button className="outline" onClick={()=>{setPicked([]);setDone(null)}}>다시 선택</button>
      <button className="primary" disabled={picked.length<3||done!==null} onClick={()=>{
        const ok=picked.every((n,i)=>n===i);setDone(ok);onAnswer(ok)
      }}>확인</button>
    </div>
  </div>
}
function QuizPanel({questions,sequence,phases,onAnswer,onJump}:{questions:Quiz[];sequence:boolean;phases:string[];onAnswer:(ok:boolean)=>void;onJump:(n:number)=>void}){
  const [index,setIndex]=useState(0),[answer,setAnswer]=useState<number|null>(null)
  const lock=useRef(false)
  const item=questions[index]
  if(index===questions.length)return sequence?<CardOrder phases={phases.slice(1,4)} onAnswer={onAnswer}/>:<div className="question"><strong>확인 문제 완료</strong><button className="outline" onClick={()=>{setIndex(0);setAnswer(null);lock.current=false}}>다시 풀기</button></div>
  return <div className="question">
    <p className="eyebrow">확인 문제 {index+1} / {questions.length}</p>
    <h3>{item.title}</h3>
    <div className="answerGrid">{item.choices.map((choice,i)=><button key={choice} disabled={answer!==null}
      className={answer===null?'':i===item.correct?'correct':answer===i?'incorrect':''} onClick={()=>{
        if(lock.current)return;lock.current=true;setAnswer(i);onAnswer(i===item.correct)
      }}>{choice}</button>)}</div>
    {answer!==null&&<div className="answerFeedback" role="status">
      <strong>{answer===item.correct?'맞았어요.':'시범을 다시 살펴봐요.'}</strong><p>{item.explanation}</p>
      <div className="row"><button className="outline" onClick={()=>onJump(item.phase)}>해당 단계 보기</button>
      <button className="primary" onClick={()=>{setIndex(index+1);setAnswer(null);lock.current=false}}>다음 <ArrowRight size={15}/></button></div>
    </div>}
  </div>
}
export default function Player({lesson,technique,pack,teacher,onTeacher,low,resume,defaultView,onBack,variant,onVariant}:PlayerProps){
  const transport=useMemo(()=>new Transport(lesson.duration),[lesson.duration])
  const snapshot=useSyncExternalStore(transport.subscribe,transport.get)
  const [view,setView]=useState<View>(defaultView),[reset,setReset]=useState(0),[zoom,setZoom]=useState(1)
  const [trace,setTrace]=useState<Trace>('off'),[foot,setFoot]=useState(true),[ghost,setGhost]=useState(false),[map,setMap]=useState(false)
  const [software,setSoftware]=useState(()=>!supportsWebGL())
  const [mode,setMode]=useState<Mode>('full'),[audio,setAudio]=useState(false),[quiz,setQuiz]=useState(false)
  const [hideInspector,setHideInspector]=useState(false),[showRepeat,setShowRepeat]=useState(false)
  const [failure,setFailure]=useState(''),[attempt,setAttempt]=useState(0),[ready,setReady]=useState(false),[flat,setFlat]=useState(false)
  const [allTracks,setAllTracks]=useState<Record<string,Track>|null>(null)
  const [progress,setProgress]=useState<Progress>(()=>initial(lesson.id,lesson.version))
  const [saved,setSaved]=useState<boolean|null>(null)
  const progressRef=useRef(progress)
  const wasPlaying=useRef(false),interacted=useRef(false)
  const scheduler=useMemo(()=>new CueScheduler(),[])
  const track=allTracks?.[lesson.clip]
  const title=technique?.title??(lesson.id==='taegeuk-01'?'태극 1장':labsTitle)
  const tracksUrl=lesson.runtime?.tracks??pack.tracks
  const glbUrl=lesson.runtime?.glb??pack.glb
  const sequence=!technique
  const activeIndex=phaseIndex(snapshot.t,lesson.phases)
  const active=lesson.phases[activeIndex]
  const localVariants=Object.keys(pack.lessons).filter(id=>id===technique?.id||id.startsWith(technique?.id+'-'))
  const modeRange=useRef<{start:number;end:number}|null>(null)

  useEffect(()=>{
    let active=true
    setReady(false);setFailure('');setAllTracks(null)
    loadTracks(tracksUrl).then(data=>{
      if(active){
        if(!data[lesson.clip]?.frames?.length)throw Error('단계 트랙 없음')
        setAllTracks(data)
      }
    }).catch(()=>{if(active)setFailure('동작 데이터를 불러오지 못했어요.')})
    return ()=>{active=false}
  },[tracksUrl,lesson.clip,attempt])
  useEffect(()=>{
    let live=true
    void loadProgress(lesson.id,lesson.version).then(record=>{
      if(live&&!interacted.current){
        progressRef.current=record;setProgress(record)
        if(resume) transport.seek(record.t)
      }
    })
    return ()=>{live=false}
  },[lesson.id,lesson.version,resume,transport])
  const save=useCallback((change:Partial<Progress>)=>{
    const next={...progressRef.current,...change,updatedAt:Date.now()}
    progressRef.current=next;setProgress(next)
    void saveProgress(next).then(setSaved)
  },[])
  useEffect(()=>{
    let raf=0
    function tick(now:number){
      transport.tick(now)
      if(transport.get().state==='Playing')raf=requestAnimationFrame(tick)
    }
    if(snapshot.state==='Playing')raf=requestAnimationFrame(tick)
    return ()=>cancelAnimationFrame(raf)
  },[snapshot.state,transport])
  useEffect(()=>{
    const off=transport.subscribe(()=>{
      const p=transport.get()
      scheduler.advance(p,lesson,audio)
      if(modeRange.current&&p.state==='Playing'&&p.t>=modeRange.current.end){
        const end=modeRange.current.end;modeRange.current=null;transport.seek(Math.max(0,end-.001))
        return
      }
      if(p.state==='Playing')wasPlaying.current=true
      else if(wasPlaying.current&&p.state!=='Seeking'){
        wasPlaying.current=false
        save({t:p.t,seen:[...new Set([...progressRef.current.seen,lesson.phases[phaseIndex(p.t,lesson.phases)].id])]})
      }
    })
    const hide=()=>{if(document.hidden){transport.pause();scheduler.stop()}}
    const unload=()=>{const p=transport.get();if(interacted.current)void saveProgress({...progressRef.current,t:p.t,updatedAt:Date.now()})}
    document.addEventListener('visibilitychange',hide)
    window.addEventListener('pagehide',unload)
    return ()=>{off();document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',unload);scheduler.stop();unload()}
  },[transport,scheduler,lesson,audio,save])
  const go=useCallback((n:number)=>{
    const item=lesson.phases[Math.max(0,Math.min(n,lesson.phases.length-1))]
    const t=Math.min(item.pose,item.end-.001)
    interacted.current=true
    modeRange.current=null
    transport.seek(t)
    save({t,seen:[...new Set([...progressRef.current.seen,item.id])]})
  },[lesson,transport,save])
  const toggle=useCallback(()=>{
    if(!track)return
    interacted.current=true
    if(transport.get().state==='Playing'){transport.pause();return}
    if(!transport.get().repeat&&(mode==='segment'||mode==='connect')){
      const n=phaseIndex(transport.get().t,lesson.phases)
      const start=lesson.phases[n].start
      const end=lesson.phases[Math.min(n+(mode==='connect'?1:0),lesson.phases.length-1)].end
      transport.seek(start)
      modeRange.current={start,end}
    }
    transport.play()
  },[lesson,mode,track,transport])
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      const target=event.target
      if(event.defaultPrevented||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||
         (target instanceof HTMLElement&&target.closest('input,textarea,button,select,a,[contenteditable],[role=slider]')))return
      const t=transport.get().t
      if(event.code==='Space'){event.preventDefault();toggle()}
      else if(event.code==='ArrowLeft'||event.code==='ArrowRight'){
        event.preventDefault()
        const dir=event.code==='ArrowLeft'?-1:1
        if(event.shiftKey)transport.seek(t+dir/30)
        else go(phaseIndex(t,lesson.phases)+dir)
      }else if(event.code==='KeyR'){transport.seek(transport.get().repeat?transport.get().a:0)}
      else if(event.code==='KeyF'){onTeacher()}
      else if(event.code==='Escape'){setShowRepeat(false);setQuiz(false)}
      else if(/^[1-6]$/.test(event.key))setView(views[Number(event.key)-1])
    }
    window.addEventListener('keydown',key)
    return ()=>window.removeEventListener('keydown',key)
  },[go,lesson,transport,toggle,onTeacher])
  const onReady=useCallback(()=>setReady(true),[])
  const onError=useCallback(()=>{if(software)setFlat(true);else setSoftware(true);setReady(false)},[software])
  const setModeValue=(next:Mode)=>{
    transport.pause();modeRange.current=null;setMode(next);setQuiz(next==='quiz')
    if(next==='full')transport.seek(0)
  }
  const updateAnswer=(correct:boolean)=>{
    interacted.current=true
    save({attempts:progressRef.current.attempts+1,correct:progressRef.current.correct+Number(correct)})
  }
  const retry=()=>{
    transport.pause();setFlat(false);setReady(false);setAttempt(x=>x+1)
  }
  const badge=snapshot.state==='Playing'?'재생 중':flat?'2D 관찰':ready?(software?'호환 3D':'정지'):'준비 중'
  const Stage=software?SoftwareScene:Scene
  return <section className={'lessonShell'+(teacher?' presentation':'')} aria-label={title+' 학습'}>
    <div className="lessonHead">
      <div>
        <div className="crumb"><button className="textButton" onClick={onBack}><ChevronLeft size={16}/>{sequence?'품새':'기본동작'}</button><span>/</span>{technique?.group??'연결 연습'}</div>
        <div className="titleLine"><h1>{title}</h1>{lesson.developmentOnly&&<span className="tag warm">검수 전 초안</span>}</div>
        <p className="subtitle">{technique?.goal??'연속 시범에서 시간과 방향을 확인하는 개발용 연결 동작입니다.'}</p>
      </div>
      <div className="headActions">
        <button className={'outline iconSquare'+(progress.favorite?' selected':'')} title="즐겨찾기" aria-label="즐겨찾기" aria-pressed={progress.favorite}
          onClick={()=>save({favorite:!progress.favorite})}><Star size={17} fill={progress.favorite?'currentColor':'none'}/></button>
        <button className="outline" aria-label={teacher?'수업 모드 종료':'수업 모드'} onClick={onTeacher}><Maximize size={16}/><span>{teacher?'수업 모드 종료':'수업 모드'}</span></button>
      </div>
    </div>
    {sequence&&<div className="modeTabs" aria-label="학습 모드">{(Object.keys(modeLabels) as Mode[]).map(m=><button key={m} aria-pressed={m===mode} onClick={()=>setModeValue(m)}>{modeLabels[m]}</button>)}</div>}
    <div className={'workspaceGrid'+(hideInspector?' wide':'')}>
      <div className="studioCard">
        <div className="studioTop">
          <div className="studioLabel"><span className="liveDot"/><strong>3D 스튜디오</strong><span className="status">{badge}</span></div>
          <div className="studioTools">
            <button className={'iconSquare'+(map?' selected':'')} title="이동 경로" aria-label="이동 경로" aria-pressed={map} onClick={()=>setMap(!map)}><Map size={17}/></button>
            <button className={'iconSquare'+(flat?' selected':'')} title="2D 관찰" aria-label="2D 관찰" aria-pressed={flat} onClick={()=>{transport.pause();setFlat(!flat)}}><Layers3 size={17}/></button>
            <button className="iconSquare" title="설명 패널 열기/닫기" aria-label="설명 패널 열기 또는 닫기" onClick={()=>setHideInspector(!hideInspector)}><Expand size={17}/></button>
          </div>
        </div>
        <div className="viewport" data-view={view}>
          {track&&flat?<PoseDiagram track={track} t={snapshot.t} view={view}/>:track&&
            <SceneBoundary key={attempt+'-'+software} onError={onError} fallback={<PoseDiagram track={track} t={snapshot.t} view={view}/>}>
              <Suspense fallback={null}><Stage asset={glbUrl} lesson={lesson} track={track} transport={transport} view={view}
                cameraReset={reset} zoom={zoom} low={low} feet={foot} trace={trace}
                ghost={ghost&&snapshot.state!=='Playing'} onReady={onReady} onError={onError}/></Suspense>
            </SceneBoundary>}
          {(!track||!ready)&&!flat&&<div className="canvasNotice" role="status">
            {failure?<><strong>{failure}</strong><button className="outline" onClick={retry}>다시 불러오기</button></>:<><span className="spinner"/><strong>수련 장면을 준비하고 있어요</strong></>}
          </div>}
          <div className="viewDock" aria-label="카메라 시점">
            {views.map(v=><button key={v} aria-pressed={view===v} onClick={()=>setView(v)}>{viewLabels[v]}</button>)}
          </div>
          <div className="zoomDock">
            <button aria-label="확대" onClick={()=>setZoom(Math.min(1.55,zoom+.12))}><Plus size={17}/></button>
            <button aria-label="축소" onClick={()=>setZoom(Math.max(.72,zoom-.12))}><Minus size={17}/></button>
            <button aria-label="시점 초기화" onClick={()=>{setZoom(1);setView(defaultView);setReset(reset+1)}}><ScanLine size={17}/></button>
          </div>
          <div className="axisLegend"><span><i className="tealDot"/>왼쪽</span><span><i className="amberDot"/>오른쪽</span></div>
          {map&&track&&<div className="mapCard"><strong>실제 이동 경로</strong><MovementMap track={track} t={snapshot.t}/></div>}
          {flat&&<div className="fallbackBadge"><span>2D 포즈</span><button onClick={retry}>3D 다시 시도</button></div>}
        </div>
        <div className="transport">
          <div className="timeline">
            <span className="time">{fmt(snapshot.t)}</span>
            <input aria-label="재생 위치" type="range" min="0" max={snapshot.duration} step=".001" value={snapshot.t}
              style={{'--fill':(snapshot.t/snapshot.duration*100)+'%'} as CSSProperties}
              onChange={e=>{interacted.current=true;modeRange.current=null;transport.seek(Number(e.target.value),false)}}
              onPointerUp={e=>{const t=Number(e.currentTarget.value);transport.seek(t);save({t})}}
              onKeyUp={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){const t=Number(e.currentTarget.value);transport.seek(t);save({t})}}}
              onBlur={()=>{if(transport.get().state==='Seeking')transport.seek(transport.get().t)}}/>
            <span className="time">{fmt(snapshot.duration)}</span>
          </div>
          <div className="playerControls">
            <div className="playGroup">
              <button className="iconSquare" aria-label="처음으로" title="처음으로" onClick={()=>transport.seek(snapshot.repeat?snapshot.a:0)}><SkipBack size={17}/></button>
              <button className="iconSquare stepArrow" aria-label="이전 단계" onClick={()=>go(activeIndex-1)}><ChevronLeft size={19}/></button>
              <button className="playButton" aria-label={snapshot.state==='Playing'?'일시정지':'재생'} onClick={toggle} disabled={!track}>
                {snapshot.state==='Playing'?<Pause size={18} fill="currentColor"/>:<Play size={18} fill="currentColor"/>}
              </button>
              <button className="iconSquare stepArrow" aria-label="다음 단계" onClick={()=>go(activeIndex+1)}><ChevronRight size={19}/></button>
            </div>
            <div className="moreControls">
              <label className="speed"><select aria-label="재생 속도" value={snapshot.speed} onChange={e=>transport.setSpeed(Number(e.target.value) as Speed)}>
                {speeds.map(s=><option key={s} value={s}>{s}×</option>)}
              </select><ChevronDown size={13}/></label>
              <button className={'iconSquare'+(snapshot.repeat?' selected':'')} title="구간 반복" aria-label="구간 반복" aria-expanded={showRepeat} onClick={()=>setShowRepeat(!showRepeat)}><Repeat2 size={18}/></button>
              <button className={'iconSquare'+(audio?' selected':'')} title="단계 읽기" aria-label="단계 읽기" aria-pressed={audio}
                onClick={()=>{if(audio)scheduler.stop();setAudio(!audio)}}>{audio?<Volume2 size={18}/>:<VolumeX size={18}/>}</button>
            </div>
          </div>
          {showRepeat&&<div className="repeatPanel">
            <strong>구간 반복</strong>
            <div className="row">
              <button className="outline" onClick={()=>transport.setLoop(snapshot.t,snapshot.b,snapshot.repeat,snapshot.limit)}>A {snapshot.a.toFixed(2)}초</button>
              <button className="outline" onClick={()=>transport.setLoop(snapshot.a,snapshot.t,snapshot.repeat,snapshot.limit)}>B {snapshot.b.toFixed(2)}초</button>
              <label>횟수 <select aria-label="반복 횟수" value={snapshot.limit} onChange={e=>transport.setLoop(snapshot.a,snapshot.b,snapshot.repeat,Number(e.target.value))}>
                <option value={0}>계속</option><option value={1}>1회</option><option value={3}>3회</option><option value={5}>5회</option>
              </select></label>
              <button className="primary" aria-pressed={snapshot.repeat} onClick={()=>transport.setLoop(snapshot.a,snapshot.b,!snapshot.repeat,snapshot.limit)}>{snapshot.repeat?'반복 끄기':'반복 켜기'}</button>
              <button className="iconSquare" aria-label="반복 구간 초기화" onClick={()=>transport.setLoop(0,snapshot.duration,false)}><RotateCcw size={15}/></button>
            </div><small>타임라인에서 위치를 고른 뒤 A 또는 B를 눌러요.</small>
          </div>}
        </div>
      </div>
      {!hideInspector&&<aside className="inspector">
        <div className="panel phases">
          <div className="panelHead"><div><span className="eyebrow">STEP BY STEP</span><h2>동작 단계</h2></div><span className="count">{String(activeIndex+1).padStart(2,'0')} / {String(lesson.phases.length).padStart(2,'0')}</span></div>
          <div className="phaseList">{lesson.phases.map((phase,i)=><button key={phase.id} className={'phase'+(i===activeIndex?' current':'')} aria-current={i===activeIndex?'step':undefined} onClick={()=>go(i)}>
            <span className="phaseNo">{String(i+1).padStart(2,'0')}</span><span><strong>{phase.title}</strong>{i===activeIndex&&<small>{phase.note}</small>}</span>
            {i===activeIndex?<Play size={13} className="phaseIcon"/>:<ChevronRight size={14} className="phaseIcon"/>}
          </button>)}</div>
        </div>
        <div className="panel observe">
          <div className="panelHead compact"><div><span className="eyebrow">OBSERVE</span><h2>관찰 도구</h2></div><BookOpen size={17}/></div>
          <div className="toolGrid">
            <button className="outline" aria-pressed={foot} onClick={()=>setFoot(!foot)}><Footprints size={15}/>발자국</button>
            <button className="outline" aria-pressed={trace!=='off'} onClick={()=>setTrace(trace==='off'?'hands':trace==='hands'?'feet':'off')}><AudioLines size={15}/>{trace==='hands'?'손 궤적':trace==='feet'?'발 궤적':'이동 궤적'}</button>
            <button className="outline" aria-pressed={ghost} onClick={()=>{transport.pause();setGhost(!ghost)}}><Layers3 size={15}/>끝 포즈 비교</button>
            <button className="outline" aria-pressed={quiz} onClick={()=>{transport.pause();setQuiz(!quiz)}}><CircleHelp size={15}/>확인 문제</button>
          </div>
          {localVariants.length>1&&<label className="variant">시범 변형
            <select aria-label="시범 변형" value={variant} onChange={e=>onVariant(e.target.value)}>
              {localVariants.map(id=><option key={id} value={id}>{id.includes('reverse')?(id.endsWith('-R')?'왼쪽 반대지르기':'오른쪽 반대지르기'):id.endsWith('-R')?'오른쪽 변형':'왼쪽 변형'}</option>)}
            </select></label>}
        </div>
      </aside>}
    </div>
    <div className="focusBar">
      <div><span className="eyebrow">지금 볼 곳</span><strong>{active.title}</strong><span className="focusNote">{active.note}</span></div>
      <button className={'outline'+(progress.practiced?' selected':'')} onClick={()=>save({practiced:!progress.practiced})} aria-pressed={progress.practiced}><Check size={16}/>{progress.practiced?'연습 기록됨':'자기 연습 기록'}</button>
      {teacher&&<button className="outline" aria-pressed={progress.teacherConfirmed} onClick={()=>save({teacherConfirmed:!progress.teacherConfirmed})}>교사 관찰 기록</button>}
    </div>
    {quiz&&<QuizPanel questions={lesson.quizzes} sequence={sequence} phases={lesson.phases.map(p=>p.title)} onAnswer={updateAnswer} onJump={go}/>}
    {saved===false&&<p className="quiet" role="status">이 기기에서 장기 저장을 사용할 수 없어 이번 실행에만 기록합니다.</p>}
    <div className="lessonFoot"><span>발과 손의 위치를 확인할 때는 재생을 멈추고 시점을 바꿔보세요.</span><button className="textButton" onClick={onBack}><ArrowLeft size={14}/>목록으로</button></div>
  </section>
}
