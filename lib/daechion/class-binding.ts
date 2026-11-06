import { z } from 'zod'
import { daechionClient } from './client'
import type { StoredLectureBinding } from './product-policy'
import type { PurchaseProcess } from '../purchase-process'

export class ClassBindingError extends Error {}
export async function lectureCatalog(env:Record<string,string|undefined>,fetcher?:typeof fetch){
  if(env.DAECHION_ADMIN_ENABLED!=='true'||!env.DAECHION_API_KEY||!env.DAECHION_TENANT_ID)throw new ClassBindingError('대치온 연결 설정을 먼저 완료해주세요.')
  try{
    const client=daechionClient({apiKey:env.DAECHION_API_KEY,fetcher})
    const me=await client.me()
    if(String(me.tenantId)!==env.DAECHION_TENANT_ID)throw Error('tenant mismatch')
    const lectures=await client.lectures()
    if(new Set(lectures.map(item=>item.id)).size!==lectures.length)throw Error('duplicate ID')
    return {tenantId:String(me.tenantId),lectures:lectures.map(item=>({id:item.id,name:item.name,opened:item.opened,weekCount:item.weeklyLectures.length}))}
  }catch{throw new ClassBindingError('대치온 강의 목록을 확인하지 못했습니다. 연결 설정과 접근 권한을 확인해주세요.')}
}

// Accept IDs only. Names, tenant and verification time always come from the server.
export async function resolveClassBinding(body:Record<string,unknown>,process:PurchaseProcess,previous:StoredLectureBinding|null|undefined,env:Record<string,string|undefined>,fetcher?:typeof fetch):Promise<StoredLectureBinding|null|undefined>{
  if(process!=='PROCESS_2')return undefined
  if(body.daechionLectureIds===undefined)return previous
  const result=z.array(z.number().int().positive().safe()).max(30).safeParse(body.daechionLectureIds)
  if(!result.success||new Set(result.data).size!==result.data.length)throw new ClassBindingError('대치온 강의 ID를 중복 없이 정확히 선택해주세요.')
  if(!result.data.length)return null // Explicit removal also disables any legacy env mapping.
  const catalog=await lectureCatalog(env,fetcher)
  const lectures=result.data.map(id=>catalog.lectures.find(item=>item.id===id))
  if(lectures.some(item=>!item||!item.opened||item.weekCount===0))throw new ClassBindingError('선택한 강의가 없거나 종료되었거나 등록할 차시가 없습니다. 목록을 다시 불러와주세요.')
  return {tenantId:catalog.tenantId,lectures:lectures.map(item=>({id:item!.id,name:item!.name})),verifiedAt:new Date().toISOString()}
}
