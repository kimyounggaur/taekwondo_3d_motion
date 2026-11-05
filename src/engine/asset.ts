import type {GLTF} from 'three/addons/loaders/GLTFLoader.js'
import type {Track} from '../content/lesson'
const models=new Map<string,Promise<GLTF>>()
const tracks=new Map<string,Promise<Record<string,Track>>>()
export function loadModel(url:string){
  let task=models.get(url)
  if(!task){
    task=import('three/addons/loaders/GLTFLoader.js').then(({GLTFLoader})=>new GLTFLoader().loadAsync(url)).catch(error=>{models.delete(url);throw error})
    models.set(url,task)
  }
  return task
}
export function loadTracks(url:string){
  let task=tracks.get(url)
  if(!task){
    task=fetch(url).then(r=>{
      if(!r.ok)throw Error('트랙 응답 '+r.status)
      return r.json() as Promise<Record<string,Track>>
    }).catch(error=>{tracks.delete(url);throw error})
    tracks.set(url,task)
  }
  return task
}
