import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync,existsSync} from 'node:fs'
import {catalogItem,publicManifest} from '../src/content/schema'
import raw from '../src/content/catalogue.json'
import releaseData from '../src/content/release-manifest.json'
import index from '../src/qa/clip-index.json'
const action=process.argv[2]
const release=publicManifest.parse(releaseData)
const items=catalogItem.array().parse(raw)
assert.equal(items.length,17)
assert.equal(new Set(items.map(x=>x.id)).size,17)
assert(items.every(x=>x.officialUrl.startsWith('https://www.kukkiwon.or.kr')))
assert.equal(items[0].originalVideo,items[1].originalVideo)
assert.notEqual(items[0].candidate,items[1].candidate)
console.log('품새 17종의 ID·출처·QR 중복 보존 확인')
if(action==='assets'){
  const binary=readFileSync('src/qa/dojo-draft.glb')
  const tracks=readFileSync('src/qa/motion-tracks.json')
  assert.equal(createHash('sha256').update(binary).update(tracks).digest('hex'),index.hash)
  assert.equal(createHash('sha256').update(binary).digest('hex'),index.glbHash)
  assert.equal(binary.toString('utf8',0,4),'glTF')
  assert.equal(binary.readUInt32LE(4),2)
  assert.equal(binary.readUInt32LE(8),binary.length)
  const doc=JSON.parse(binary.toString('utf8',20,20+binary.readUInt32LE(12)))
  const trackMap=JSON.parse(tracks.toString())
  assert.equal(doc.animations.length,21)
  assert.equal(doc.skins.length,1)
  const bones=new Set(doc.nodes.map((n:{name?:string})=>n.name))
  for(const bone of ['MotionRoot','Hips','Head','Hand_L','Hand_R','Foot_L','Foot_R','Toe_L','Toe_R'])assert(bones.has(bone),bone)
  for(const anim of doc.animations){
    const expected=trackMap[anim.name]
    const duration=Math.max(...anim.samplers.map((s:{input:number})=>doc.accessors[s.input].max[0]))
    assert(Math.abs(duration-expected.duration)<.0001,anim.name)
    assert.equal(expected.frames[0].t,0)
    assert(Math.abs(expected.frames.at(-1).t-duration)<.0001)
  }
  const triangles=doc.meshes.reduce((total:number,m:{primitives:{indices?:number;attributes:{POSITION:number}}[]})=>total+m.primitives.reduce((sum,p)=>sum+doc.accessors[p.indices??p.attributes.POSITION].count/3,0),0)
  console.log('GLB 2.0 · 21개 클립 · '+triangles+' 삼각형 · 본/길이/해시 일치')
}
if(action==='release'){
  const required=[...Array.from({length:10},(_,i)=>'B'+String(i).padStart(2,'0')),'taegeuk-01']
  const missing=required.filter(id=>!release.entries.some(item=>item.id===id))
  for(const item of release.entries){
    for(const path of [item.runtime!.glb,item.runtime!.tracks])assert(existsSync('public'+path),'공개 자산 누락 '+path)
    const digest=createHash('sha256').update(readFileSync('public'+item.runtime!.glb)).digest('hex')
    assert.equal(digest,item.motionHash)
  }
  if(missing.length){console.error('교육 공개 차단 · 승인 자산 미확보 '+missing.join(', '));process.exitCode=2}
  else console.log('필수 공개 매니페스트와 자산 해시를 확인했습니다.')
}
