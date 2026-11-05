import {frameAt,type Point,type Track} from '../content/lesson'
export function MovementMap({track,t}:{track:Track;t:number}){
  const frame=frameAt(track,t)
  const path=track.frames.filter((_,i)=>i%3===0||i===track.frames.length-1)
  const points=path.map(x=>x.j.MotionRoot)
  const parts=[...points,...track.frames.flatMap(f=>[f.j.Foot_L,f.j.Foot_R])]
  const xs=parts.map(p=>p[0]), zs=parts.map(p=>p[2])
  const midX=(Math.max(...xs)+Math.min(...xs))/2,midZ=(Math.max(...zs)+Math.min(...zs))/2
  const scale=71/Math.max(1.05,Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs))
  const xy=([x,,z]:Point)=>[60-(x-midX)*scale,60-(z-midZ)*scale]
  const current=xy(frame.j.MotionRoot)
  const visible=path.filter(f=>f.t<=t).map(f=>xy(f.j.MotionRoot).join(',')).join(' ')
  return <svg className="minimap" viewBox="0 0 120 120" role="img" aria-label="처음 정면과 실제 이동 경로">
    <defs><pattern id="mapgrid" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0V12" fill="none" stroke="#e6edf0" strokeWidth="1"/></pattern></defs>
    <rect width="120" height="120" rx="12" fill="url(#mapgrid)"/>
    <text x="60" y="14" textAnchor="middle">처음 정면</text>
    <polyline points={points.map(p=>xy(p).join(',')).join(' ')} stroke="#bfced7" strokeWidth="2.5" fill="none" strokeDasharray="3 3"/>
    <polyline points={visible} stroke="#0c776f" strokeWidth="2.8" strokeLinecap="round" fill="none"/>
    {(['L','R'] as const).map((side,i)=>{
      const [x,y]=xy(frame.j['Foot_'+side])
      return <g key={side}><ellipse cx={x} cy={y} rx="4.5" ry="6.5" fill={i===0?'#c0e4dc':'#f0d1ac'}/>
        <text x={x} y={y+2.2} textAnchor="middle" className="mapfoot">{i===0?'왼':'오'}</text></g>
    })}
    <path d="M0 -8 5 5 0 2 -5 5Z" fill="#0b716b" transform={'translate('+current.join(' ')+') rotate('+(-frame.yaw*180/Math.PI)+')'}/>
  </svg>
}
const bones=[
  ['Head','Neck'],['Neck','Chest'],['Chest','Hips'],
  ['Chest','UpperArm_L'],['UpperArm_L','Forearm_L'],['Forearm_L','Hand_L'],
  ['Chest','UpperArm_R'],['UpperArm_R','Forearm_R'],['Forearm_R','Hand_R'],
  ['Hips','Thigh_L'],['Thigh_L','Shin_L'],['Shin_L','Foot_L'],
  ['Hips','Thigh_R'],['Thigh_R','Shin_R'],['Shin_R','Foot_R'],
]
export function PoseDiagram({track,t,view}:{track:Track;t:number;view:string}){
  const f=frameAt(track,t)
  const angle=view==='back'?Math.PI:view==='left'?Math.PI/2:view==='right'?-Math.PI/2:view==='angle'?Math.PI/6:0
  const coords=([x,y,z]:Point)=>{
    const x2=x-f.j.MotionRoot[0], z2=z-f.j.MotionRoot[2]
    return [170-125*(x2*Math.cos(angle)-z2*Math.sin(angle)),view==='top'?130-125*z2:245-y*128]
  }
  const limbs=[...bones.map(([a,b])=>[f.j[a],f.j[b],b] as const),
    ...(['Hand_L','Hand_R','Foot_L','Foot_R'] as const).map(id=>[f.j[id],f.tip[id],id] as const)]
  const [x,y]=coords(f.tip.Head)
  return <svg className="poseDiagram" viewBox="0 0 340 270" aria-label="동일 모션에서 추출한 2D 포즈">
    <ellipse cx="170" cy="247" rx="88" ry="9" fill="#d4e2e8"/>
    {limbs.map(([a,b,key],i)=>{const [x1,y1]=coords(a),[x2,y2]=coords(b)
      return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={key==='Hips'?26:12}
        stroke={key.endsWith('_L')?'#40958b':key.endsWith('_R')?'#be834b':'#264253'} strokeLinecap="round"/>})}
    <circle cx={x} cy={y+11} r="13.5" fill="#264253"/>
  </svg>
}
