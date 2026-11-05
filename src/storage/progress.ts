export interface Progress {
  id:string; version:string; t:number; seen:string[]; correct:number; attempts:number;
  practiced:boolean; teacherConfirmed:boolean; favorite:boolean; updatedAt:number
}
const dbName='motion-dojang'
const memory=new Map<string,Progress>()
let connection:Promise<IDBDatabase>|undefined
export function initial(id:string,version:string):Progress {
  return {id,version,t:0,seen:[],correct:0,attempts:0,practiced:false,teacherConfirmed:false,favorite:false,updatedAt:0}
}
function db() {
  connection??=new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB) return reject(new Error('IndexedDB unavailable'))
    const request=indexedDB.open(dbName,1)
    request.onupgradeneeded=()=>request.result.createObjectStore('progress',{keyPath:'id'})
    request.onsuccess=()=>{const result=request.result;result.onversionchange=()=>{result.close();connection=undefined};resolve(result)}
    request.onerror=()=>{connection=undefined;reject(request.error)}
  })
  return connection
}
async function readAll():Promise<Progress[]> {
  const database=await db()
  return new Promise((resolve,reject)=>{
    const request=database.transaction('progress').objectStore('progress').getAll()
    request.onsuccess=()=>resolve(request.result)
    request.onerror=()=>reject(request.error)
  })
}
export async function listProgress() {
  try{ for(const value of await readAll()) if(typeof value.id==='string'&&(!memory.has(value.id)||memory.get(value.id)!.updatedAt<value.updatedAt)) memory.set(value.id,value) }
  catch{/* Current session remains usable. */}
  return [...memory.values()].sort((a,b)=>b.updatedAt-a.updatedAt)
}
export async function loadProgress(id:string,version:string) {
  const item=(await listProgress()).find(r=>r.id===id)
  if(!item) return initial(id,version)
  if(item.version!==version) return {...initial(id,version),favorite:Boolean(item.favorite)}
  return item
}
export async function saveProgress(value:Progress):Promise<boolean> {
  memory.set(value.id,value)
  try{
    const database=await db()
    await new Promise<void>((resolve,reject)=>{
      const tx=database.transaction('progress','readwrite')
      tx.objectStore('progress').put(value)
      tx.oncomplete=()=>resolve()
      tx.onerror=tx.onabort=()=>reject(tx.error)
    })
    return true
  }catch{return false}
}
export async function clearProgress() {
  const database=await db()
  await new Promise<void>((resolve,reject)=>{
    const tx=database.transaction('progress','readwrite')
    tx.objectStore('progress').clear()
    tx.oncomplete=()=>resolve()
    tx.onerror=tx.onabort=()=>reject(tx.error)
  })
  memory.clear()
}
