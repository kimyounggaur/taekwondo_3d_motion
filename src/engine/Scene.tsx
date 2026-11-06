import {Suspense,useEffect,useMemo,useRef} from 'react'
import {Canvas,useFrame,useLoader,useThree} from '@react-three/fiber'
import {BufferGeometry,Color,Line as ThreeLine,LineBasicMaterial,Vector3,Mesh,type Material,SkinnedMesh} from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {clone} from 'three/addons/utils/SkeletonUtils.js'
import {MotionSampler} from './sample'
import {cameraView,type CameraFocus} from './CameraView'
import type {Transport} from './transport'
import {frameAt,type Lesson,type Point,type Track} from '../content/lesson'
import type {View} from '../content/techniques'

export type Trace='off'|'hands'|'feet'
export interface SceneProps {
  asset:string; lesson:Lesson; track:Track; transport:Transport; view:View; cameraReset:number; zoom:number; focus:CameraFocus;
  low:boolean; feet:boolean; trace:Trace; ghost:boolean; onReady:()=>void; onError:()=>void
}
const teal='#087b76'
const amber='#c67b28'
function Camera({view,reset,zoom,focus,track}: {view:View;reset:number;zoom:number;focus:CameraFocus;track:Track}){
  const {camera,gl,invalidate,size}=useThree()
  useEffect(()=>{
    const controls=new OrbitControls(camera,gl.domElement)
    controls.target.set(0,.84,.12)
    controls.enablePan=false; controls.minDistance=.65; controls.maxDistance=9
    controls.maxPolarAngle=Math.PI*.49
    const change=()=>invalidate()
    controls.addEventListener('change',change)
    const {target,position}=cameraView(view,track,size.width/size.height,zoom,focus)
    camera.position.copy(position)
    camera.up.set(0,1,0)
    controls.target.copy(target)
    controls.update()
    invalidate()
    return ()=>{controls.removeEventListener('change',change);controls.dispose()}
  },[camera,gl,invalidate,view,reset,zoom,focus,size.width,size.height,track])
  return null
}
function Model({asset,lesson,transport,ghost,onReady}:{asset:string;lesson:Lesson;transport:Transport;ghost:boolean;onReady:()=>void}){
  const gltf=useLoader(GLTFLoader,asset)
  const clip=gltf.animations.find(a=>a.name===lesson.clip)
  if(!clip)throw new Error('Missing motion '+lesson.clip)
  return <Actors source={gltf.scene} clip={clip} lesson={lesson} transport={transport} ghost={ghost} onReady={onReady}/>
}
function Actors({source,clip,lesson,transport,ghost,onReady}:{source:import('three').Group;clip:import('three').AnimationClip;lesson:Lesson;transport:Transport;ghost:boolean;onReady:()=>void}){
  const {invalidate}=useThree()
  const actor=useMemo(()=>{
    const object=clone(source)
    object.traverse(o=>{if(o instanceof Mesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}})
    return object
  },[source])
  const ghostActor=useMemo(()=>{
    if(!ghost)return null
    const object=clone(source)
    object.traverse(o=>{
      if(o instanceof Mesh){
        const tint=(source:Material)=>{
          const m=source.clone()
          if('color' in m)m.color=new Color('#37a79c')
          m.transparent=true;m.opacity=.19;m.depthWrite=false
          return m
        }
        o.material=Array.isArray(o.material)?o.material.map(tint):tint(o.material)
        o.castShadow=false;o.receiveShadow=false;o.frustumCulled=false
      }
    })
    return object
  },[source,ghost])
  const sampler=useMemo(()=>new MotionSampler(actor,clip),[actor,clip])
  const ghostSampler=useMemo(()=>ghostActor?new MotionSampler(ghostActor,clip):null,[ghostActor,clip])
  const last=useRef(-1)
  useEffect(()=>{
    sampler.sample(transport.get().t)
    last.current=transport.get().t
    invalidate()
    onReady()
    return ()=>{sampler.dispose(); actor.traverse(o=>{if(o instanceof SkinnedMesh)o.skeleton.dispose()})}
  },[sampler,actor,transport,invalidate,onReady])
  useEffect(()=>{
    if(ghostSampler){ghostSampler.sample(lesson.phases.at(-1)!.pose);invalidate()}
    return ()=>{
      ghostSampler?.dispose()
      ghostActor?.traverse(o=>{
        if(o instanceof Mesh)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())
        if(o instanceof SkinnedMesh)o.skeleton.dispose()
      })
    }
  },[ghostSampler,ghostActor,lesson,invalidate])
  useEffect(()=>transport.subscribe(invalidate),[transport,invalidate])
  useFrame(()=>{
    const t=transport.get().t
    if(t!==last.current){sampler.sample(t);last.current=t}
  })
  return <><primitive object={actor} dispose={null}/>{ghostActor&&<primitive object={ghostActor} dispose={null}/>}</>
}
function PathLine({points,color,transport}: {points:Point[];color:string;transport:Transport}){
  const {invalidate}=useThree()
  const line=useMemo(()=>new ThreeLine(new BufferGeometry().setFromPoints(points.map(p=>new Vector3(...p))),
    new LineBasicMaterial({color,transparent:true,opacity:.82})),[points,color])
  useEffect(()=>()=>{line.geometry.dispose();line.material.dispose()},[line])
  useEffect(()=>transport.subscribe(invalidate),[transport,invalidate])
  useFrame(()=>{
    const count=Math.min(points.length,Math.floor(transport.get().t*30)+1)
    line.geometry.setDrawRange(0,Math.max(1,count))
  })
  return <primitive object={line}/>
}
function FootMarks({track,transport}:{track:Track;transport:Transport}){
  const left=useRef<import('three').Mesh>(null),right=useRef<import('three').Mesh>(null)
  const {invalidate}=useThree()
  useEffect(()=>transport.subscribe(invalidate),[transport,invalidate])
  useFrame(()=>{
    const sample=frameAt(track,transport.get().t)
    const before=frameAt(track,transport.get().t-.12)
    for(const [index,ref] of [left,right].entries()){
      const side=index===0?'L':'R'
      const p=sample.j['Foot_'+side]
      const earlier=before.j['Foot_'+side]
      if(!ref.current)continue
      const support=p[1]<.109&&Math.hypot(p[0]-earlier[0],p[2]-earlier[2])<.024
      ref.current.visible=support
      ref.current.position.set(p[0]+Math.sin(sample.yaw)*.064,.004,p[2]+Math.cos(sample.yaw)*.064)
      ref.current.rotation.set(-Math.PI/2,0,-sample.yaw)
    }
  })
  return <>
    <mesh ref={left} scale={[.113,.259,1]}><circleGeometry args={[.58,28]}/><meshBasicMaterial color="#6ebdb1" transparent opacity={.57} depthWrite={false}/></mesh>
    <mesh ref={right} scale={[.113,.259,1]}><circleGeometry args={[.58,28]}/><meshBasicMaterial color="#dca369" transparent opacity={.53} depthWrite={false}/></mesh>
  </>
}
function WebGLLifecycle({onError}:{onError:()=>void}){
  const {gl}=useThree()
  useEffect(()=>{
    const lost=(event:Event)=>{event.preventDefault();onError()}
    gl.domElement.addEventListener('webglcontextlost',lost)
    return ()=>gl.domElement.removeEventListener('webglcontextlost',lost)
  },[gl,onError])
  return null
}
export default function Scene(props:SceneProps){
  const {lesson,track,transport,low,trace,feet,ghost}=props
  const left=useMemo(()=>track.frames.map(f=>f.tip[trace==='feet'?'Foot_L':'Hand_L']),[track,trace])
  const right=useMemo(()=>track.frames.map(f=>f.tip[trace==='feet'?'Foot_R':'Hand_R']),[track,trace])
  return <Canvas frameloop="demand" shadows={!low} dpr={low?1:[1,1.5]}
    camera={{position:[2,1.8,3],fov:39,near:.05,far:30}}
    gl={{antialias:!low,alpha:true}} aria-label="태권도 3D 시범">
    <ambientLight intensity={1.40}/>
    <hemisphereLight args={['#fcfeff','#91a4b5',1.45]}/>
    <directionalLight position={[2.1,5,3.7]} intensity={2.4} castShadow={!low}
      shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-.00035}
      shadow-normalBias={.02} shadow-camera-left={-3} shadow-camera-right={3}
      shadow-camera-top={3} shadow-camera-bottom={-3}/>
    <directionalLight position={[-3,2,-3.2]} intensity={.65} color="#cfebff"/>
    <mesh rotation={[-Math.PI/2,0,0]} receiveShadow position={[0,-.018,0]}>
      <planeGeometry args={[200,200]}/><meshStandardMaterial color="#dde6ec" roughness={.98}/>
    </mesh>
    <gridHelper args={[10,32,'#9fb6c4','#bdcdd7']} position={[0,-.012,0]}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.008,0]}>
      <ringGeometry args={[1.10,1.11,96]}/><meshBasicMaterial color="#93aeb9" transparent opacity={.73}/>
    </mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.007,0]}>
      <ringGeometry args={[1.52,1.527,96]}/><meshBasicMaterial color="#bacdd6" transparent opacity={.73}/>
    </mesh>
    <Camera view={props.view} reset={props.cameraReset} zoom={props.zoom} focus={props.focus} track={track}/>
    <WebGLLifecycle onError={props.onError}/>
    <Suspense fallback={null}>
      <Model asset={props.asset} lesson={lesson} transport={transport} ghost={ghost} onReady={props.onReady}/>
    </Suspense>
    {feet&&<FootMarks track={track} transport={transport}/>}
    {trace!=='off'&&<><PathLine points={left} transport={transport} color={teal}/><PathLine points={right} transport={transport} color={amber}/></>}
  </Canvas>
}
