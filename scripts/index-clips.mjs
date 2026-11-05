import {readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
const resolve=path=>new URL('../src/qa/'+path,import.meta.url)
const binary=readFileSync(resolve('dojo-draft.glb'))
const tracks=readFileSync(resolve('motion-tracks.json'))
const content=JSON.parse(tracks)
const hash=createHash('sha256').update(binary).update(tracks).digest('hex')
const glbHash=createHash('sha256').update(binary).digest('hex')
writeFileSync(resolve('clip-index.json'),JSON.stringify({hash,glbHash,durations:Object.fromEntries(Object.entries(content).map(([id,{duration}])=>[id,duration]))},null,2)+'\n')
