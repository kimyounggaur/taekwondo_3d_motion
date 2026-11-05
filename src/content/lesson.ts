import type { Phase } from './schema'
export type Point=[number,number,number]
export interface Sample { t:number; yaw:number; j:Record<string,Point>; tip:Record<string,Point> }
export interface Track { duration:number; frames:Sample[] }
export interface Quiz { title:string; choices:string[]; correct:number; explanation:string; phase:number }
export interface Lesson {
  id:string; clip:string; version:string; duration:number; phases:Phase[];
  quizzes:Quiz[]; developmentOnly:boolean; runtime?:{glb:string;tracks:string}
}
export interface LessonPack { lessons:Record<string,Lesson>; glb:string; tracks:string }
export function frameAt(track:Track,t:number) {
  return track.frames[Math.min(track.frames.length-1,Math.max(0,Math.round(t*30)))]
}
