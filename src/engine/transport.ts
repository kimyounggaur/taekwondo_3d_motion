export const speeds=[0.25,0.5,0.75,1] as const
export type Speed=(typeof speeds)[number]
export type State='Loading'|'Ready'|'Playing'|'Paused'|'Seeking'|'Completed'|'Error'|'Fallback'
export interface Playback {
  t:number; duration:number; state:State; speed:Speed; a:number; b:number;
  repeat:boolean; limit:number; loopIndex:number; epoch:number;
}
type Listener=()=>void
export function clampTime(t:number, duration:number) {
  return Math.min(Math.max(Number.isFinite(t)?t:0,0), duration)
}
export function phaseIndex(t:number, phases:readonly {start:number;end:number}[]) {
  if (!phases.length) return -1
  const n=phases.findIndex(p=>t>=p.start&&t<p.end)
  return n<0?(t<phases[0].start?0:phases.length-1):n
}
export class Transport {
  private value:Playback
  private last=0
  private listeners=new Set<Listener>()
  constructor(duration:number) {
    if(!Number.isFinite(duration)||duration<=0) throw new RangeError('Invalid duration')
    this.value={t:0,duration,state:'Ready',speed:1,a:0,b:duration,repeat:false,limit:0,loopIndex:0,epoch:0}
  }
  get=()=>this.value
  subscribe=(listener:Listener)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener)}}
  private update(next:Partial<Playback>) {
    this.value={...this.value,...next}
    for(const listener of this.listeners) listener()
  }
  play(now=performance.now()) {
    const {t,duration,a,b,repeat,state,epoch}=this.value
    if(state==='Playing') return
    this.last=now
    const restart=state==='Completed'||t>=duration||(repeat&&(t<a||t>=b))
    this.update({state:'Playing',t:restart?(repeat?a:0):t,...(restart?{loopIndex:0,epoch:epoch+1}:{})})
  }
  pause() {if(this.value.state==='Playing') this.update({state:'Paused'})}
  toggle() {if(this.value.state==='Playing') this.pause();else this.play()}
  seek(t:number,commit=true) {
    this.update({t:clampTime(t,this.value.duration),state:commit?'Paused':'Seeking',
      ...(commit?{epoch:this.value.epoch+1,loopIndex:0}:{})})
  }
  setSpeed(speed:Speed,now=performance.now()) {
    if(!speeds.includes(speed))return
    this.tick(now)
    this.update({speed})
  }
  setLoop(a:number,b:number,repeat:boolean,limit=0) {
    const d=this.value.duration
    a=clampTime(a,d);b=clampTime(b,d)
    if(b-a<.1) return false
    this.pause()
    this.update({a,b,repeat,limit:Math.max(0,Math.trunc(limit)),loopIndex:0,epoch:this.value.epoch+1})
    return true
  }
  tick(now:number) {
    const p=this.value
    if(p.state!=='Playing'||!Number.isFinite(now)||now<this.last) return
    const delta=(now-this.last)/1000*p.speed
    this.last=now
    if(delta===0)return
    const next=p.t+delta
    if(p.repeat&&next>=p.b) {
      const length=p.b-p.a
      const elapsed=next-p.a
      const wraps=Math.floor((elapsed+1e-10)/length)
      const loopIndex=p.loopIndex+wraps
      if(p.limit>0&&loopIndex>=p.limit) this.update({t:p.b,loopIndex:p.limit,state:'Completed'})
      else this.update({t:p.a+Math.max(0,elapsed-wraps*length),loopIndex})
    } else if(next>=p.duration) this.update({t:p.duration,state:'Completed'})
    else this.update({t:next})
  }
}
