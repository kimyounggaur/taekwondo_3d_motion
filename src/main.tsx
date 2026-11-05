import {useCallback,useEffect,useState,type MouseEvent,type ReactNode} from 'react'
import {createRoot} from 'react-dom/client'
import {ArrowDownLeft,ArrowRight,BookOpen,Box,ChevronRight,CircleHelp,ExternalLink,Footprints,Grid2X2,History,Maximize,Move,Play,RotateCcw,Settings,Shield,Star,Swords,Target} from 'lucide-react'
import catalogueData from './content/catalogue.json'
import releaseData from './content/release-manifest.json'
import {catalogItem,publicManifest,type CatalogItem} from './content/schema'
import {techniques,labsTitle,viewLabels,views,type Technique,type View} from './content/techniques'
import type {LessonPack} from './content/lesson'
import {clearProgress,listProgress,type Progress} from './storage/progress'
import Player from './components/Player'
import './style.css'

const catalogue=catalogItem.array().parse(catalogueData)
const isQA=import.meta.env.MODE==='qa'
const release=publicManifest.parse(releaseData)
const publicPack:LessonPack={
  glb:'',tracks:'',
  lessons:Object.fromEntries(release.entries.map(e=>[e.id,{
    id:e.id,clip:e.clip,version:e.motionHash,duration:e.duration,phases:e.phases,
    quizzes:e.quizzes??[],developmentOnly:false,runtime:e.runtime
  }]))
}
const groups=['서기','막기','지르기','차기','이동'] as const
const icons={서기:Footprints,막기:Shield,지르기:Target,차기:Swords,이동:Move}
const titleFor=(id:string)=>techniques.find(t=>t.id===id.slice(0,3))?.title??(id==='direction-lab'?labsTitle:catalogue.find(t=>t.id===id)?.title??id)
const pathFor=(id:string)=>id==='direction-lab'?'/lab':id.startsWith('B')?'/basics/'+id.slice(0,3):'/poomsae/'+id
interface Preferences {low:boolean;view:View}
function prefs():Preferences {
  try {
    const value=JSON.parse(localStorage.getItem('motion-prefs')??'{}')
    return {low:value.low===true,view:views.includes(value.view)?value.view:'angle'}
  }catch{return {low:false,view:'angle'}}
}
function useNavigation(){
  const [url,setUrl]=useState(()=>window.location.pathname+window.location.search)
  useEffect(()=>{
    const pop=()=>setUrl(location.pathname+location.search)
    window.addEventListener('popstate',pop)
    return ()=>window.removeEventListener('popstate',pop)
  },[])
  const navigate=useCallback((next:string)=>{
    if(next===location.pathname+location.search)return
    history.pushState(null,'',next)
    setUrl(next)
    window.scrollTo({top:0,behavior:'instant'})
  },[])
  return {url,navigate}
}
function NavLink({to,navigate,className,children,current}:{to:string;navigate:(to:string)=>void;className?:string;children:ReactNode;current?:boolean}){
  function go(e:MouseEvent<HTMLAnchorElement>){
    if(e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey){e.preventDefault();navigate(to)}
  }
  return <a href={to} className={className} aria-current={current?'page':undefined} onClick={go}>{children}</a>
}
function Sidebar({selected,path,navigate}:{selected?:Technique;path:string;navigate:(to:string)=>void}){
  return <aside className="sidebar">
    <div className="sideTop"><span className="eyebrow">TRAINING LIBRARY</span><h2>기본동작</h2><p>자세를 보고, 동작을 나눠 배워요.</p></div>
    <nav aria-label="기본동작 목록" className="techNav">
      {groups.map(group=>{
        const Icon=icons[group]
        return <div className="techGroup" key={group}>
          <div className="groupLabel"><Icon size={14}/>{group}</div>
          {techniques.filter(t=>t.group===group).map(t=>
            <NavLink key={t.id} to={'/basics/'+t.id} navigate={navigate} className={'techLink'+(selected?.id===t.id?' active':'')} current={selected?.id===t.id}>
              <span className="techNum">{String(Number(t.id.slice(1))+1).padStart(2,'0')}</span><span>{t.title}</span>{selected?.id===t.id&&<ChevronRight size={14}/>}
            </NavLink>)}
        </div>
      })}
    </nav>
    {isQA&&<NavLink to="/lab" navigate={navigate} className={'labLink'+(path==='/lab'?' active':'')}>
      <Box size={18}/><span><strong>연결 실습</strong><small>이동과 순서 테스트</small></span><ChevronRight size={15}/>
    </NavLink>}
  </aside>
}
function Overview({navigate,records}:{navigate:(path:string)=>void;records:Progress[]}){
  const latest=records.find(r=>r.t>0)
  return <div className="catalogPage">
    <div className="catalogHead"><span className="eyebrow">TAEKWONDO MOTION STUDIO</span><h1>태권도 3D 수련실</h1><p>서기, 손기술, 차기의 흐름을 여러 시점에서 관찰해요.</p></div>
    <div className="launchGrid">
      <NavLink to="/basics" className="launchCard" navigate={navigate}><Footprints size={28}/><h2>기본동작</h2><p>서기부터 방향 전환까지 10개 학습 단위</p><ArrowRight size={20}/></NavLink>
      <NavLink to="/poomsae" className="launchCard" navigate={navigate}><Grid2X2 size={28}/><h2>품새</h2><p>태극 1~8장과 유단자 품새 공식 자료</p><ArrowRight size={20}/></NavLink>
      <NavLink to={latest?pathFor(latest.id)+'?resume=1&clip='+encodeURIComponent(latest.id):'/review'} className="launchCard" navigate={navigate}><History size={28}/><h2>이어하기</h2><p>{latest?titleFor(latest.id):'이 기기의 학습 기록을 확인해요.'}</p><ArrowRight size={20}/></NavLink>
    </div>
  </div>
}
function BasicList({navigate}:{navigate:(path:string)=>void}){
  return <div className="catalogPage">
    <div className="catalogHead"><span className="eyebrow">FUNDAMENTALS</span><h1>기본동작</h1><p>관찰할 동작을 고르세요.</p></div>
    <div className="listGrid">{techniques.map(t=>{
      const Icon=icons[t.group]
      return <NavLink key={t.id} to={'/basics/'+t.id} className="listCard" navigate={navigate}>
        <div className="tileIcon"><Icon size={22}/></div><span className="tag">{t.group}</span>
        <h2>{t.title}</h2><p>{t.goal}</p><span className="tileFoot">{isQA?'초안 열기':'자료 보기'}<ArrowRight size={15}/></span>
      </NavLink>
    })}</div>
  </div>
}
function PoomsaeList({navigate}:{navigate:(path:string)=>void}){
  const [group,setGroup]=useState('전체')
  return <div className="catalogPage">
    <div className="catalogHead"><span className="eyebrow">POOMSAE LIBRARY</span><h1>품새</h1><p>품새 17종의 공식 참고 자료를 찾아보세요.</p></div>
    {isQA&&<div className="labBanner"><div className="tileIcon"><Move size={23}/></div><div><h2>이동·연결 테스트</h2><p>연속 동작의 단계 탐색, 바닥 경로, 순서 연습을 확인해요.</p></div>
      <NavLink to="/lab" navigate={navigate} className="primary">실습 열기 <ArrowRight size={16}/></NavLink></div>}
    <div className="filters" aria-label="품새 분류">{['전체','유급자','유단자'].map(item=><button key={item} aria-pressed={group===item} onClick={()=>setGroup(item)}>{item}</button>)}</div>
    <div className="listGrid poomsaeGrid">{catalogue.filter(p=>group==='전체'||p.category===group).map((p)=>
      <NavLink key={p.id} to={'/poomsae/'+p.id} className="listCard" navigate={navigate}>
        <div className="tileIcon"><Grid2X2 size={21}/></div><span className="tag">{p.category}</span>
        <h2>{p.title}</h2><p>{p.description}</p><span className="tileFoot">공식 자료<ArrowRight size={15}/></span>
      </NavLink>)}</div>
  </div>
}
function Reference({item,technique,navigate,detail}:{item?:CatalogItem;technique?:Technique;navigate:(path:string)=>void;detail:boolean}){
  if(!item&&!technique)return <Missing navigate={navigate}/>
  const title=item?.title??technique?.title
  return <div className="catalogPage">
    <div className="catalogHead"><span className="eyebrow">{detail?'SOURCE NOTES':item?'POOMSAE REFERENCE':'FUNDAMENTALS'}</span>
      <h1>{title}</h1><p>{item?.description??technique?.goal}</p>
    </div>
    <section className="referenceBox">
      <div className="tileIcon"><BookOpen size={24}/></div>
      <div><span className="tag warm">3D 시범 검수 대기</span>
        <h2>{item?'공식 참고 자료':'관찰 포인트'}</h2>
        {item?<><p>국기원 원문에서 품새 소개와 참고 자료를 확인할 수 있어요.</p>
          {item.id==='taegeuk-01'||item.id==='taegeuk-02'?<p className="quiet">두 장의 원문 QR 주소가 같습니다. 추가 교육 영상은 별도 후보로 안내합니다.</p>:null}
          {detail&&<p className="quiet">원본 기록 {item.sourceCheckedAt}. {item.sourceNote}</p>}
          <div className="row">
            <a className="primary" href={item.officialUrl} target="_blank" rel="noopener noreferrer">국기원 원문 <ExternalLink size={16}/></a>
            <a className="outline" href={item.candidate} target="_blank" rel="noopener noreferrer">참고 영상 후보 <ExternalLink size={15}/></a>
            {!detail&&<NavLink to={'/sources/'+item.id} navigate={navigate} className="outline">출처 상세</NavLink>}
          </div></>:<><ul>{technique!.focus.map(f=><li key={f}>{f}</li>)}</ul>
          <div className="row"><a className="outline" href="https://research.kukkiwon.or.kr/board/result/article/27667" target="_blank" rel="noopener noreferrer">국기원 기술용어집 <ExternalLink size={15}/></a></div></>}
      </div>
    </section>
    {isQA&&item?.id==='taegeuk-01'&&<div className="labBanner"><Move size={22}/><div><h2>이동·연결 테스트</h2><p>개발용 연속 모션에서 구간 제어와 순서 문제를 체험할 수 있어요.</p></div>
      <NavLink to="/lab" navigate={navigate} className="outline">연결 실습 열기 <ArrowRight size={15}/></NavLink></div>}
  </div>
}
function Missing({navigate}:{navigate:(path:string)=>void}){
  return <div className="empty panel"><CircleHelp size={29}/><h1>학습 항목을 찾을 수 없어요</h1><NavLink to="/basics" className="primary" navigate={navigate}>기본동작 목록</NavLink></div>
}
function Review({records,navigate}:{records:Progress[];navigate:(path:string)=>void}){
  return <div className="catalogPage"><div className="catalogHead"><span className="eyebrow">YOUR PRACTICE</span><h1>복습 기록</h1><p>관찰한 단계와 확인 문제 기록은 이 기기에 저장돼요.</p></div>
    {!records.length?<div className="empty panel"><History size={31}/><h2>아직 학습 기록이 없어요</h2><NavLink to="/basics" navigate={navigate} className="primary">기본동작 선택</NavLink></div>:
      <div className="recordList">{records.map(record=><div key={record.id} className="panel record">
        <span className="tileIcon">{record.favorite?<Star size={19}/>:<History size={19}/>}</span>
        <div><strong>{titleFor(record.id)}</strong><p>관찰 {record.seen.length}단계 · 확인 문제 {record.correct}/{record.attempts}{record.practiced?' · 자기 연습 기록':''}{record.teacherConfirmed?' · 교사 관찰 기록':''}</p></div>
        <NavLink to={pathFor(record.id)+'?resume=1&clip='+encodeURIComponent(record.id)} navigate={navigate} className="outline"><Play size={14}/>이어하기</NavLink>
      </div>)}</div>}
  </div>
}
function SettingsPage({settings,onSettings,onClear}:{settings:Preferences;onSettings:(value:Preferences)=>void;onClear:()=>void}){
  const [armed,setArmed]=useState(false),[status,setStatus]=useState('')
  return <div className="catalogPage"><div className="catalogHead"><span className="eyebrow">PREFERENCES</span><h1>설정</h1><p>보기 방식과 이 기기의 복습 기록을 관리해요.</p></div>
    <div className="panel settingsPanel">
      <div><span><strong>기본 카메라 시점</strong><small>동작을 처음 열 때 적용합니다.</small></span>
        <select aria-label="기본 시점" value={settings.view} onChange={e=>onSettings({...settings,view:e.target.value as View})}>{views.map(v=><option key={v} value={v}>{viewLabels[v]}</option>)}</select></div>
      <div><span><strong>저사양 모드</strong><small>화면 해상도와 그림자 비용을 낮춥니다.</small></span>
        <button className="outline" aria-pressed={settings.low} onClick={()=>onSettings({...settings,low:!settings.low})}>{settings.low?'켜짐':'꺼짐'}</button></div>
      <div><span><strong>단축키</strong><small>Space 재생 · ←/→ 단계 · 1~6 시점 · F 수업 모드</small></span></div>
      <div><span><strong>복습 기록 초기화</strong><small>{status||'현재 기기에 저장한 진도와 즐겨찾기를 지워요.'}</small></span>
        {armed?<div className="row"><button className="outline" onClick={()=>setArmed(false)}>취소</button><button className="primary" onClick={()=>{
          void clearProgress().then(()=>{onClear();setArmed(false);setStatus('복습 기록을 지웠어요.')}).catch(()=>setStatus('저장 공간을 열 수 없어요.'))
        }}>기록 지우기</button></div>:<button className="outline" onClick={()=>setArmed(true)}><RotateCcw size={16}/>초기화</button>}</div>
    </div>
  </div>
}
function App(){
  const {url,navigate}=useNavigation()
  const [pack,setPack]=useState<LessonPack|null>(isQA?null:publicPack),[loadError,setLoadError]=useState(false)
  const [teacher,setTeacher]=useState(false),[settings,setSettings]=useState(prefs)
  const [records,setRecords]=useState<Progress[]>([])
  const [selection,setSelection]=useState<{technique:string;clip:string}|null>(null)
  useEffect(()=>{
    if(import.meta.env.MODE==='qa'){
      void import('./qa/lessons').then(m=>setPack(m.pack)).catch(()=>setLoadError(true))
    }
  },[])
  const pathname=url.split('?')[0].replace(/\/$/,'')||'/'
  const path=pathname==='/'&&isQA?'/basics/B01':pathname
  const split=path.split('/').filter(Boolean)
  const [section,id]=split
  const tech=section==='basics'?techniques.find(t=>t.id===id):undefined
  const lab=section==='lab'&&isQA
  const query=new URLSearchParams(url.split('?')[1]??'')
  const contentId=lab?'direction-lab':tech?.id??(section==='poomsae'?id:undefined)
  const selected=selection?.technique===contentId?selection?.clip:query.get('clip')
  const clip=contentId&&selected&&(selected===contentId||selected.startsWith(contentId+'-'))&&pack?.lessons[selected]?selected:contentId
  const lesson=clip?pack?.lessons[clip]:undefined
  const resume=query.get('resume')==='1'
  useEffect(()=>{
    let live=true
    void listProgress().then(values=>{if(live)setRecords(values)})
    return ()=>{live=false}
  },[url])
  useEffect(()=>{
    const listener=()=>{if(!document.fullscreenElement)setTeacher(false)}
    document.addEventListener('fullscreenchange',listener)
    return ()=>document.removeEventListener('fullscreenchange',listener)
  },[])
  const onTeacher=useCallback(()=>{
    if(teacher){setTeacher(false);if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{})}
    else{setTeacher(true);void document.documentElement.requestFullscreen?.().catch(()=>{})}
  },[teacher])
  function onSettings(value:Preferences){setSettings(value);try{localStorage.setItem('motion-prefs',JSON.stringify(value))}catch{/* Optional persistence. */}}
  const item=(section==='poomsae'||section==='sources')&&id?catalogue.find(p=>p.id===id):undefined
  let page:ReactNode
  if(split.length>2)page=<Missing navigate={navigate}/>
  else if(lesson&&pack)page=<Player key={lesson.id+'-'+Number(resume)} lesson={lesson} pack={pack} technique={tech}
    teacher={teacher} onTeacher={onTeacher} low={settings.low} resume={resume} defaultView={settings.view}
    variant={clip!} onVariant={value=>setSelection({technique:contentId!,clip:value})}
    onBack={()=>navigate(lab||section==='poomsae'?'/poomsae':'/basics')}/>
  else if(contentId&&isQA&&!loadError&&!pack)page=<div className="empty"><span className="spinner"/><p>수련실을 준비하고 있어요</p></div>
  else if(tech||item)page=<Reference item={item||undefined} technique={tech} detail={section==='sources'} navigate={navigate}/>
  else if(path==='/')page=<Overview navigate={navigate} records={records}/>
  else if(path==='/basics')page=<BasicList navigate={navigate}/>
  else if(path==='/poomsae')page=<PoomsaeList navigate={navigate}/>
  else if(path==='/review')page=<Review navigate={navigate} records={records}/>
  else if(path==='/settings')page=<SettingsPage settings={settings} onSettings={onSettings} onClear={()=>setRecords([])}/>
  else page=<Missing navigate={navigate}/>
  const selectedTab=lab||section==='poomsae'?'poomsae':section==='review'?'review':'basics'
  return <div className={'app'+(teacher?' teacher':'')}>
    <a className="skip" href="#main">본문으로 이동</a>
    <header className="topbar">
      <NavLink to="/" navigate={navigate} className="brand"><img src="/mark.svg" alt="" width="39" height="39"/><span><strong>모션 도장</strong><small>TAEKWONDO STUDIO</small></span></NavLink>
      <nav className="topnav" aria-label="주 메뉴">
        <NavLink to="/basics" className={selectedTab==='basics'?'active':''} current={selectedTab==='basics'} navigate={navigate}><Footprints size={16}/>기본동작</NavLink>
        <NavLink to="/poomsae" className={selectedTab==='poomsae'?'active':''} current={selectedTab==='poomsae'} navigate={navigate}><Grid2X2 size={16}/>품새</NavLink>
        <NavLink to="/review" className={selectedTab==='review'?'active':''} current={selectedTab==='review'} navigate={navigate}><History size={16}/>복습</NavLink>
      </nav>
      <div className="topActions">{isQA&&<span className="qaBadge"><span/>검수용 미리보기</span>}
        {teacher&&<button className="outline" onClick={onTeacher}><Maximize size={16}/>수업 모드 종료</button>}
        <NavLink to="/settings" navigate={navigate} className="iconSquare settingsLink" current={path==='/settings'}><Settings size={19}/><span className="srOnly">설정</span></NavLink>
      </div>
    </header>
    <div className="appBody">
      {!teacher&&<Sidebar selected={tech} path={path} navigate={navigate}/>}
      <main id="main" className="main">{page}</main>
    </div>
    <footer className="footer"><span>모션 도장</span><span>{isQA?'내부 검수 빌드':'자료 열람 모드'} <ArrowDownLeft size={12}/></span></footer>
  </div>
}
createRoot(document.getElementById('root')!).render(<App/>)
