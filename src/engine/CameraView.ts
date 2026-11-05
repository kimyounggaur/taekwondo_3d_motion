import {Vector3} from 'three'
import type {Point,Track} from '../content/lesson'
import type {View} from '../content/techniques'
const eyes:Record<View,Point>={front:[0,.36,1],back:[0,.36,-1],left:[1,.37,0],right:[-1,.37,0],top:[0,1,.016],angle:[.69,.37,1]}
export function cameraView(view:View,track:Track,aspect:number,zoom:number){
  const xs=track.frames.map(f=>f.j.MotionRoot[0]),zs=track.frames.map(f=>f.j.MotionRoot[2])
  const target=new Vector3((Math.min(...xs)+Math.max(...xs))/2,view==='top'?.0:.86,(Math.min(...zs)+Math.max(...zs))/2+.12)
  const distance=(view==='top'?3.46:3.18)*(aspect<.85?1.15:1)/zoom
  const position=target.clone().add(new Vector3(...eyes[view]).normalize().multiplyScalar(distance))
  return {target,position}
}
