import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {Vector3,Quaternion} from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {clone} from 'three/addons/utils/SkeletonUtils.js'
import {Transport,phaseIndex,clampTime} from '../src/engine/transport'
import {MotionSampler} from '../src/engine/sample'
import {clipEntry,publicManifest} from '../src/content/schema'
import {CueScheduler} from '../src/engine/audio'
import type {Lesson} from '../src/content/lesson'
test('end boundary keeps the last phase, and invalid seek time is bounded',()=>{
  const parts=[{start:0,end:1},{start:1,end:2}]
  assert.equal(phaseIndex(.999,parts),0)
  assert.equal(phaseIndex(1,parts),1)
  assert.equal(phaseIndex(2,parts),1)
  for(const t of [NaN,Infinity,-1])assert.equal(clampTime(t,2),0)
  assert.equal(clampTime(4,2),2)
})
test('all speeds apply once and an ended session can seek back',()=>{
  for(const speed of [.25,.5,.75,1] as const){
    const t=new Transport(4)
    t.setSpeed(speed,0)
    t.play(0);t.tick(1000)
    assert.equal(t.get().t,speed)
    t.tick(20000);assert.equal(t.get().t,4);assert.equal(t.get().state,'Completed')
    t.seek(1.6);assert.equal(t.get().t,1.6)
    t.play(100000);t.tick(100200)
    assert(Math.abs(t.get().t-(1.6+.2*speed))<.000001)
  }
})
test('repeat wraps without drift and seeking does not increment repetitions',()=>{
  const t=new Transport(4)
  assert.equal(t.setLoop(3,2,true),false)
  assert.equal(t.setLoop(.5,1.5,true,20),true)
  t.seek(.5);t.play(0);t.tick(19250)
  assert.equal(t.get().loopIndex,19)
  assert.equal(t.get().t,.75)
  t.tick(20000);assert.equal(t.get().t,1.5);assert.equal(t.get().loopIndex,20)
  t.seek(1.2);assert.equal(t.get().loopIndex,0)
})
test('pause discards elapsed wall time and repeat configuration keeps finite bounds',()=>{
  const t=new Transport(4)
  t.play(100);t.tick(600);t.pause();t.tick(30600)
  assert.equal(t.get().t,.5)
  t.play(30600);t.tick(31100);assert.equal(t.get().t,1)
})
test('release rejects draft and approvals with changed asset hashes',()=>{
  const draft={
    id:'B01',clip:'B01',duration:2,phases:[{id:'p0',title:'start',note:'',start:0,end:2,pose:.5}],
    motionVersion:'m1',rigVersion:'r1',motionHash:'a'.repeat(64),
    status:'in_production',developmentOnly:true,
    review:{state:'draft',reviewer:null,reviewedAt:null,evidence:[],motionHash:null,issues:[]}
  }
  assert(clipEntry.safeParse(draft).success)
  assert(!publicManifest.safeParse({schemaVersion:1,entries:[draft]}).success)
  assert(!clipEntry.safeParse({...draft,developmentOnly:false,status:'playable',review:{...draft.review,state:'approved',motionHash:'b'.repeat(64)}}).success)
})
test('audio cues play once per epoch and re-arm after a committed seek',()=>{
  const spoken:string[]=[]
  const originalSpeech=Object.getOwnPropertyDescriptor(globalThis,'speechSynthesis')
  const originalUtterance=Object.getOwnPropertyDescriptor(globalThis,'SpeechSynthesisUtterance')
  Object.defineProperty(globalThis,'speechSynthesis',{value:{speak(u:{text:string}){spoken.push(u.text)},cancel(){}},configurable:true})
  Object.defineProperty(globalThis,'SpeechSynthesisUtterance',{value:class {constructor(readonly text:string){}},configurable:true})
  try{
    const scheduler=new CueScheduler(), t=new Transport(2)
    const lesson:Lesson={id:'test',clip:'test',version:'v',duration:2,developmentOnly:true,quizzes:[],
      phases:[{id:'p0',title:'준비',note:'',start:0,end:1,pose:0},{id:'p1',title:'이동',note:'',start:1,end:2,pose:1}]}
    t.subscribe(()=>scheduler.advance(t.get(),lesson,true))
    t.play(0);t.tick(1000);t.pause()
    t.play(1000);t.tick(1100);t.pause()
    t.seek(.5);t.play(2000);t.tick(2500)
    assert.deepEqual(spoken,['준비','이동','이동'])
  }finally{
    if(originalSpeech)Object.defineProperty(globalThis,'speechSynthesis',originalSpeech)
    else Reflect.deleteProperty(globalThis,'speechSynthesis')
    if(originalUtterance)Object.defineProperty(globalThis,'SpeechSynthesisUtterance',originalUtterance)
    else Reflect.deleteProperty(globalThis,'SpeechSynthesisUtterance')
  }
})
test('actual GLB ends and 100 shuffled seeks reproduce root and joint transforms',async()=>{
  const bytes=readFileSync('src/qa/dojo-draft.glb')
  const gltf=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'')
  assert.equal(gltf.animations.length,21)
  const clip=gltf.animations.find(c=>c.name==='direction-lab')!
  const actor=clone(gltf.scene)
  const sampler=new MotionSampler(actor,clip)
  const root=actor.getObjectByName('MotionRoot')!,hand=actor.getObjectByName('Hand_L')!
  assert(root&&hand)
  function pose(t:number){
    sampler.sample(t)
    return {p:root.getWorldPosition(new Vector3()),q:hand.getWorldQuaternion(new Quaternion()).normalize()}
  }
  const end=pose(clip.duration),start=pose(0)
  assert(end.p.distanceTo(start.p)>.3)
  assert(pose(clip.duration+1).p.distanceTo(end.p)<.0001)
  const reference=Array.from({length:100},(_,i)=>pose(i*clip.duration/99))
  for(let i=0;i<100;i++){
    const n=(i*37)%100
    const actual=pose(n*clip.duration/99)
    assert(actual.p.distanceTo(reference[n].p)<.0001)
    assert(actual.q.angleTo(reference[n].q)<.000175)
  }
  const ghost=clone(gltf.scene),other=new MotionSampler(ghost,clip)
  const before=pose(1.2)
  other.sample(clip.duration)
  assert(root.getWorldPosition(new Vector3()).distanceTo(before.p)<.0001)
  sampler.dispose();other.dispose()
})
