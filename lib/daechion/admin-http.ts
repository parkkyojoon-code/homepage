import { z } from 'zod'
import { adminApplications, adminApplicationDetail, adminActionSchema, applyAdminAction, AdminReviewError, adminActionReplay } from './admin'
import type { LedgerClient } from './ledger'
import type { DaechionStudent } from './client'

export interface AdminPorts {
  tenantId?:string
  authed():Promise<boolean>;enabled:boolean;origins:string[]
  withClient<T>(run:(client:LedgerClient)=>Promise<T>):Promise<T>
  student(id:number):Promise<DaechionStudent>
}
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}})
async function guard(ports:AdminPorts){
  if(!await ports.authed())return json({error:'로그인이 필요합니다.'},401)
  if(!ports.enabled)return json({error:'신규 신청 관리를 준비 중입니다.'},503)
}
export async function adminGet(request:Request,ports:AdminPorts){
  const denied=await guard(ports);if(denied)return denied
  try{
    const id=new URL(request.url).searchParams.get('id')
    const result=id?await ports.withClient(client=>adminApplicationDetail(client,id)):await ports.withClient(client=>adminApplications(client))
    return result?json(result):json({error:'신청을 찾을 수 없습니다.'},404)
  }catch{return json({error:'신청 내역을 불러오지 못했습니다.'},503)}
}
export async function adminPost(request:Request,ports:AdminPorts){
  const denied=await guard(ports);if(denied)return denied
  if(!ports.origins.includes(request.headers.get('origin')??''))return json({error:'요청을 확인할 수 없습니다.'},403)
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return json({error:'입력 형식을 확인해주세요.'},415)
  try{
    const reader=request.body?.getReader();if(!reader)return json({error:'입력 내용이 없습니다.'},400)
    const chunks:Uint8Array[]=[];let length=0
    while(true){const item=await reader.read();if(item.done)break;length+=item.value.byteLength;if(length>8192){await reader.cancel();return json({error:'입력 내용이 너무 깁니다.'},413)}chunks.push(item.value)}
    const raw=JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if(raw.kind==='SEARCH'){
      const data=z.object({kind:z.literal('SEARCH'),q:z.string().trim().max(80).default(''),reviewOnly:z.boolean().default(false),page:z.number().int().min(0).max(1000).default(0)}).strict().parse(raw)
      return json(await ports.withClient(client=>adminApplications(client,data.q,data.reviewOnly,data.page)))
    }
    const data=adminActionSchema.parse(raw)
    if(await ports.withClient(client=>adminActionReplay(client,data)))return json({success:true,replayed:true})
    const student=data.action==='RESUME'||data.action==='MANUAL_COMPLETE'?await ports.student(data.studentId??0):undefined
    return json({success:true,...await ports.withClient(client=>applyAdminAction(client,data,student,ports.tenantId))})
  }catch(error){
    if(error instanceof z.ZodError||error instanceof SyntaxError)return json({error:'담당자·사유·확인 항목과 입력 내용을 확인해주세요.'},400)
    if(error instanceof AdminReviewError)return json({error:error.code==='STALE'?'다른 작업으로 내용이 변경되었습니다. 새로 불러온 뒤 확인해주세요.':'학생·청구 정보와 확인 근거가 일치하지 않습니다.'},409)
    return json({error:'처리 결과를 확인하지 못했습니다. 새로 불러와 확인해주세요.'},503)
  }
}
