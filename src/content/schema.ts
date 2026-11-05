import {z} from 'zod'
export const availability=z.enum(['reference_only','in_production','playable'])
export const reviewState=z.enum(['draft','in_review','approved','withdrawn'])
export const seconds=z.number().nonnegative().finite()
export const vec3=z.tuple([z.number(),z.number(),z.number()])
export const phase=z.object({id:z.string().min(1),title:z.string().min(1),note:z.string(),start:seconds,end:seconds,pose:seconds})
export const evidence=z.object({url:z.url(),locator:z.string().min(1),status:z.enum(['unverified','reference','verified'])})
export const review=z.object({state:reviewState,reviewer:z.string().nullable(),reviewedAt:z.iso.datetime().nullable(),evidence:z.array(evidence),motionHash:z.string().nullable(),issues:z.array(z.string())})
export const catalogItem=z.object({id:z.string(),title:z.string(),category:z.string(),description:z.string(),officialUrl:z.url(),originalVideo:z.url(),candidate:z.url(),sourceCheckedAt:z.string(),sourceNote:z.string(),availability,review:reviewState})
export const quizItem=z.object({title:z.string().min(1),choices:z.array(z.string()).min(2),correct:z.number().int().nonnegative(),explanation:z.string(),phase:z.number().int().nonnegative()})
export const runtimeAsset=z.object({
  glb:z.string().regex(/^\/assets\/[A-Za-z0-9._-]+\.glb$/),
  tracks:z.string().regex(/^\/assets\/[A-Za-z0-9._-]+\.json$/)
})
export const clipEntry=z.object({
  id:z.string(), clip:z.string(), duration:seconds.positive(), phases:z.array(phase).min(1),
  motionVersion:z.string(), rigVersion:z.string(), motionHash:z.string().regex(/^[a-f0-9]{64}$/),
  status:availability, review, developmentOnly:z.boolean(), runtime:runtimeAsset.optional(), quizzes:z.array(quizItem).optional()
}).superRefine((m,ctx)=>{
  const issue=(message:string)=>ctx.addIssue({code:'custom',message})
  let end=0
  const ids=new Set<string>()
  for(const p of m.phases){
    if(ids.has(p.id)||p.start!==end||p.end<=p.start||p.pose<p.start||p.pose>p.end) issue('단계 ID, 시각 또는 연속 구간 오류')
    ids.add(p.id); end=p.end
  }
  if(Math.abs(end-m.duration)>.001) issue('마지막 마커와 재생 길이 불일치')
  if(m.quizzes?.some(q=>q.correct>=q.choices.length||q.phase>=m.phases.length)) issue('확인 문제 참조 오류')
  if(m.status==='playable'&&(!m.runtime||!m.quizzes?.length)) issue('교육 자산과 확인 문제를 연결하세요.')
  if(m.status==='playable'&&(m.developmentOnly||m.review.state!=='approved'||!m.review.reviewer||!m.review.reviewedAt||m.review.motionHash!==m.motionHash||m.review.issues.length||!m.review.evidence.some(e=>e.status==='verified'))) issue('교육 공개에 필요한 버전별 검수 근거가 없습니다.')
})
export const publicManifest=z.object({schemaVersion:z.literal(1),entries:z.array(clipEntry)}).superRefine((m,ctx)=>{
  if(new Set(m.entries.map(e=>e.id)).size!==m.entries.length) ctx.addIssue({code:'custom',message:'공개 ID 중복'})
  if(m.entries.some(e=>e.developmentOnly||e.status!=='playable')) ctx.addIssue({code:'custom',message:'공개 팩에 미승인 자산 포함'})
})
export type Phase=z.infer<typeof phase>
export type CatalogItem=z.infer<typeof catalogItem>
