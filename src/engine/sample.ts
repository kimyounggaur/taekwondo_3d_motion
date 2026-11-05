import {AnimationAction,AnimationMixer,LoopOnce,type AnimationClip,type Object3D} from 'three'
import {clampTime} from './transport'
export class MotionSampler {
  private readonly mixer:AnimationMixer
  private readonly action:AnimationAction
  constructor(private readonly root:Object3D,private readonly clip:AnimationClip){
    this.mixer=new AnimationMixer(root)
    this.action=this.mixer.clipAction(clip)
    this.action.setLoop(LoopOnce,0)
    this.action.clampWhenFinished=true
    this.action.play()
  }
  sample(t:number){
    this.action.enabled=true
    this.action.paused=true
    this.action.time=clampTime(t,this.clip.duration)
    this.mixer.update(0)
    this.root.updateMatrixWorld(true)
  }
  dispose(){
    this.action.stop()
    this.mixer.uncacheRoot(this.root)
  }
}
