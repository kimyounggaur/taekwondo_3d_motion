import {useEffect,useRef} from 'react'
import {Color,Mesh,MeshStandardMaterial,PerspectiveCamera,SkinnedMesh,Vector3,type Object3D} from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {clone} from 'three/addons/utils/SkeletonUtils.js'
import {cameraView} from './CameraView'
import {MotionSampler} from './sample'
import {loadModel} from './asset'
import type {SceneProps} from './Scene'
import {frameAt,type Point} from '../content/lesson'

interface Shape {
  mesh:Mesh
  color:Color
  vertices:Float32Array
}
interface Face {coords:[number,number,number,number,number,number];depth:number;color:string;alpha:number}
const keyLight=new Vector3(1.8,4,3).normalize()
const rimLight=new Vector3(-3,2,-4).normalize()
const z=new Vector3()
const worldPoint=new Vector3()
const shade=new Color()
function renderable(actor:Object3D){
  const shapes:Shape[]=[]
  actor.traverse(object=>{
    if(object instanceof Mesh&&object.geometry.attributes.position){
      const material=Array.isArray(object.material)?object.material[0]:object.material
      shapes.push({mesh:object,color:material instanceof MeshStandardMaterial?material.color:new Color('#d8dfe3'),
        vertices:new Float32Array(object.geometry.attributes.position.count*6)})
    }
  })
  return shapes
}
function actorFaces(shapes:Shape[],camera:PerspectiveCamera,w:number,h:number,faces:Face[],ghost=false){
  const halfW=w*.5,halfH=h*.5
  for(const {mesh,color,vertices} of shapes){
    const geometry=mesh.geometry
    const positions=geometry.attributes.position
    const indices=geometry.index
    for(let i=0;i<positions.count;i++){
      worldPoint.fromBufferAttribute(positions,i)
      if(mesh instanceof SkinnedMesh)mesh.applyBoneTransform(i,worldPoint)
      worldPoint.applyMatrix4(mesh.matrixWorld)
      const k=i*6
      vertices[k]=worldPoint.x;vertices[k+1]=worldPoint.y;vertices[k+2]=worldPoint.z
      z.copy(worldPoint).project(camera)
      vertices[k+3]=(z.x+1)*halfW;vertices[k+4]=(1-z.y)*halfH;vertices[k+5]=z.z
    }
    const size=indices?.count??positions.count
    for(let i=0;i<size;i+=3){
      const a=(indices?indices.getX(i):i)*6
      const b=(indices?indices.getX(i+1):i+1)*6
      const c=(indices?indices.getX(i+2):i+2)*6
      const x=vertices[b]-vertices[a],y=vertices[b+1]-vertices[a+1],z=vertices[b+2]-vertices[a+2]
      const u=vertices[c]-vertices[a],v=vertices[c+1]-vertices[a+1],k=vertices[c+2]-vertices[a+2]
      const nx=y*k-z*v,ny=z*u-x*k,nz=x*v-y*u
      if(nx*(camera.position.x-vertices[a])+ny*(camera.position.y-vertices[a+1])+nz*(camera.position.z-vertices[a+2])<=0)continue
      const norm=Math.hypot(nx,ny,nz)
      if(norm<.000000001)continue
      const light=Math.max(0,(nx*keyLight.x+ny*keyLight.y+nz*keyLight.z)/norm)
      const rim=Math.max(0,(nx*rimLight.x+ny*rimLight.y+nz*rimLight.z)/norm)
      const exposure=.68+light*.32+rim*.07
      const paint=ghost?'#549f99':'#'+shade.copy(color).multiplyScalar(exposure).getHexString()
      faces.push({coords:[vertices[a+3],vertices[a+4],vertices[b+3],vertices[b+4],vertices[c+3],vertices[c+4]],
        depth:(vertices[a+5]+vertices[b+5]+vertices[c+5])/3,color:paint,alpha:ghost?.075:1})
    }
  }
}
function path(ctx:CanvasRenderingContext2D,points:Point[],camera:PerspectiveCamera,w:number,h:number){
  ctx.beginPath()
  points.forEach((point,i)=>{
    z.set(...point).project(camera)
    if(i===0)ctx.moveTo((z.x+1)*w*.5,(1-z.y)*h*.5)
    else ctx.lineTo((z.x+1)*w*.5,(1-z.y)*h*.5)
  })
}
function ellipse(x:number,y:number,rx:number,ry:number,rotation=0):Point[]{
  const coords:Point[]=[]
  for(let i=0;i<=40;i++){
    const angle=i*Math.PI/20, a=Math.cos(angle)*rx,b=Math.sin(angle)*ry
    coords.push([x+a*Math.cos(rotation)+b*Math.sin(rotation),.001,y-a*Math.sin(rotation)+b*Math.cos(rotation)])
  }
  return coords
}
export default function SoftwareScene(props:SceneProps){
  const ref=useRef<HTMLCanvasElement>(null)
  const {asset,lesson,track,transport,view,cameraReset,zoom,focus,feet,trace,ghost,onReady,onError}=props
  useEffect(()=>{
    const canvas=ref.current
    if(!canvas)return
    const context=canvas.getContext('2d',{alpha:true})
    if(!context){onError();return}
    const camera=new PerspectiveCamera(39,1,.05,30)
    const controls=new OrbitControls(camera,canvas)
    controls.enablePan=false;controls.minDistance=.65;controls.maxDistance=9
    controls.maxPolarAngle=Math.PI*.499
    let active=true, frame=0, sampler:MotionSampler|undefined, ghostSampler:MotionSampler|undefined
    let actor:Object3D|undefined, outline:Object3D|undefined
    let shapes:Shape[]=[],ghostShapes:Shape[]=[]
    let last=-1
    function paint(){
      if(!active||!canvas||!context||!sampler)return
      const w=canvas.width,h=canvas.height
      if(w<1||h<1)return
      const t=transport.get().t
      if(last!==t){sampler.sample(t);last=t}
      camera.updateMatrixWorld(true)
      context.clearRect(0,0,w,h)
      const studio=context.createRadialGradient(w*.49,h*.46,20,w*.54,h*.53,Math.max(w,h)*.63)
      studio.addColorStop(0,'#edf3f6');studio.addColorStop(1,'#d6e2eb')
      context.fillStyle=studio;context.fillRect(0,0,w,h)
      context.lineWidth=.75
      context.strokeStyle='#b9cbd68d'
      for(let n=-9;n<=9;n++){
        path(context,[[n*.25,-.005,-2.3],[n*.25,-.005,2.3]],camera,w,h);context.stroke()
        path(context,[[-2.3,-.005,n*.25],[2.3,-.005,n*.25]],camera,w,h);context.stroke()
      }
      context.strokeStyle='#9fb6c4'
      for(const radius of [1.10,1.52]){path(context,ellipse(0,0,radius,radius),camera,w,h);context.stroke()}
      const sample=frameAt(track,t)
      const previous=frameAt(track,t-.11)
      const root=sample.j.MotionRoot
      for(let i=0;i<4;i++){
        path(context,ellipse(root[0],root[2],.29+i*.037,.20+i*.021),camera,w,h)
        context.fillStyle='rgba(40,77,99,.032)';context.fill()
      }
      if(feet)for(const [i,side] of ['L','R'].entries()){
        const point=sample.j['Foot_'+side]
        const earlier=previous.j['Foot_'+side]
        if(point[1]>.109||Math.hypot(point[0]-earlier[0],point[2]-earlier[2])>.025)continue
        path(context,ellipse(point[0]+Math.sin(sample.yaw)*.07,point[2]+Math.cos(sample.yaw)*.07,.075,.146,sample.yaw),camera,w,h)
        context.fillStyle=i===0?'#68b4a884':'#cf9f6484';context.fill()
      }
      const faces:Face[]=[]
      if(ghostShapes.length&&transport.get().state!=='Playing')actorFaces(ghostShapes,camera,w,h,faces,true)
      actorFaces(shapes,camera,w,h,faces)
      faces.sort((a,b)=>b.depth-a.depth)
      context.lineWidth=.57
      for(const face of faces){
        const [ax,ay,bx,by,cx,cy]=face.coords
        context.globalAlpha=face.alpha;context.fillStyle=face.color;context.strokeStyle=face.color
        context.beginPath();context.moveTo(ax,ay);context.lineTo(bx,by);context.lineTo(cx,cy);context.closePath()
        context.fill();context.stroke()
      }
      context.globalAlpha=1
      if(trace!=='off'){
        const range=track.frames.slice(0,Math.floor(t*30)+1)
        for(const [i,side] of ['L','R'].entries()){
          const name=(trace==='hands'?'Hand_':'Foot_')+side
          context.strokeStyle=i===0?'#147a70':'#a65e15';context.lineWidth=2
          path(context,range.map(f=>f.tip[name]),camera,w,h);context.stroke()
        }
      }
    }
    function invalidate(){
      if(!frame)frame=requestAnimationFrame(()=>{frame=0;paint()})
    }
    const resize=new ResizeObserver(()=>{
      const {width,height}=canvas.getBoundingClientRect()
      const dpi=Math.min(1.3,window.devicePixelRatio||1)
      canvas.width=Math.max(1,Math.round(width*dpi))
      canvas.height=Math.max(1,Math.round(height*dpi))
      camera.aspect=canvas.width/canvas.height
      camera.updateProjectionMatrix()
      const fit=cameraView(view,track,camera.aspect,zoom,focus)
      camera.position.copy(fit.position);controls.target.copy(fit.target);controls.update()
      invalidate()
    })
    resize.observe(canvas)
    controls.addEventListener('change',invalidate)
    const off=transport.subscribe(invalidate)
    void loadModel(asset).then(model=>{
      if(!active)return
      const clip=model.animations.find(item=>item.name===lesson.clip)
      if(!clip)throw Error('Motion not found')
      actor=clone(model.scene)
      shapes=renderable(actor);sampler=new MotionSampler(actor,clip)
      if(ghost){
        outline=clone(model.scene)
        ghostShapes=renderable(outline)
        ghostSampler=new MotionSampler(outline,clip)
        ghostSampler.sample(lesson.phases.at(-1)!.pose)
      }
      paint();onReady()
    }).catch(()=>{if(active)onError()})
    return ()=>{
      active=false;off();resize.disconnect();cancelAnimationFrame(frame)
      controls.removeEventListener('change',invalidate);controls.dispose()
      sampler?.dispose();ghostSampler?.dispose()
      for(const object of [actor,outline])object?.traverse(o=>{if(o instanceof SkinnedMesh)o.skeleton.dispose()})
    }
  },[asset,lesson,track,transport,view,cameraReset,zoom,focus,feet,trace,ghost,onReady,onError])
  return <canvas className="softwareCanvas" ref={ref} aria-label="태권도 3D 호환 화면"/>
}
