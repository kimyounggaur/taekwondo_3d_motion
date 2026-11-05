import {readFileSync,writeFileSync} from 'node:fs'
const original = JSON.parse(readFileSync(new URL('../data/kukkiwon-original.json',import.meta.url)))
const danIds = ['koryo','keumgang','taebaek','pyongwon','sipjin','jitae','chonkwon','hansu','ilyeo']
const catalogue = original['품새'].map((item,i)=>({
  id: i < 8 ? 'taegeuk-'+String(i+1).padStart(2,'0') : danIds[i-8],
  title: item['제목'], category:item['구분'], description:item['요약'],
  officialUrl:item['공식_원문_URL'], originalVideo:item['공식페이지_연결영상_URL'],
  candidate:item['추가_교육영상_URL'] ?? item['공식페이지_연결영상_URL'],
  sourceCheckedAt:item['확인시각_UTC'], sourceNote:item['검증주의'],
  availability:'reference_only', review:'draft'
}))
if (catalogue.length!==17 || new Set(catalogue.map(x=>x.id)).size!==17) throw new Error('품새 목록 확인 필요')
writeFileSync(new URL('../src/content/catalogue.json',import.meta.url),JSON.stringify(catalogue,null,2)+'\n')
console.log('원본을 유지한 채 품새 17종을 변환했습니다.')
