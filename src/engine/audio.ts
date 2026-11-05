import type {Lesson} from '../content/lesson'
import type {Playback} from './transport'
export class CueScheduler {
  private last:Playback|null=null
  private delivered=new Set<string>()
  advance(snapshot:Playback,lesson:Lesson,enabled:boolean) {
    const before=this.last
    this.last=snapshot
    if(before&&snapshot.epoch!==before.epoch) this.delivered.clear()
    if(!enabled||snapshot.state!=='Playing') {
      if(before?.state==='Playing'||snapshot.state==='Seeking') this.stop()
      return
    }
    if(!before||before.epoch!==snapshot.epoch||before.state!=='Playing') {
      this.emit(snapshot,lesson,snapshot.t,snapshot.t,true)
      return
    }
    const start=before.loopIndex!==snapshot.loopIndex?snapshot.a:before.t
    this.emit(snapshot,lesson,start,snapshot.t,before.loopIndex!==snapshot.loopIndex)
  }
  private emit(p:Playback,lesson:Lesson,start:number,end:number,includeStart:boolean) {
    const selected=lesson.phases.find(phase=>(includeStart?phase.start>=start:phase.start>start)&&phase.start<=end&&(!p.repeat||phase.start<p.b))
    if(!selected||!globalThis.speechSynthesis)return
    const key=[p.epoch,p.loopIndex,selected.id].join(':')
    if(this.delivered.has(key))return
    this.delivered.add(key)
    this.stop()
    const utterance=new SpeechSynthesisUtterance(selected.title)
    utterance.lang='ko-KR'
    utterance.rate=.93
    speechSynthesis.speak(utterance)
  }
  stop(){globalThis.speechSynthesis?.cancel()}
}
