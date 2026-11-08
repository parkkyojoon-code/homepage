import {z} from 'zod'
import type {LedgerClient} from '../ledger'
import {listOrders,orderDetail,applyOrderAdminAction,OrderAdminError,orderSearchSchema,orderAdminActionSchema,replayOrderAction} from './admin'
import {contextFromOrder,type ReviewEvidence} from './manual-review'
import type {BillingContext} from './billing'
import {paidContext,type PaidContext,type PaidEvidence} from './paid-recovery'
import type {AccessEvidence} from './manual-access'
export interface OrderAdminPorts {
  enabled:boolean;tenantId:string;origins:string[];authed():Promise<boolean>
  withClient<T>(run:(c:LedgerClient)=>Promise<T>):Promise<T>
  ready(c:LedgerClient):Promise<void>
  inspectExisting?(context:BillingContext,studentId:number):Promise<ReviewEvidence>
  inspectPaid?(context:PaidContext):Promise<PaidEvidence|null>
  inspectAccess?(context:BillingContext,studentId:number,lectureId:number,revoke:boolean):Promise<AccessEvidence>
}
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}})
async function guard(ports:OrderAdminPorts){
  if(!await ports.authed())return json({error:'관리자 로그인이 필요합니다.'},401)
  if(!ports.enabled||!ports.tenantId.trim())return json({error:'일괄 주문 관리를 준비 중입니다.'},503)
}
async function readOnly<T>(ports:OrderAdminPorts,run:(c:LedgerClient)=>Promise<T>){
  return ports.withClient(async c=>{
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    try{await ports.ready(c);const result=await run(c);await c.query('COMMIT');return result}
    catch(error){await c.query('ROLLBACK');throw error}
  })
}
export async function orderAdminGet(request:Request,ports:OrderAdminPorts){
  const denied=await guard(ports);if(denied)return denied
  try{
    const params=new URL(request.url).searchParams
    if([...params.keys()].some(key=>key!=='id')||params.getAll('id').length>1)return json({error:'조회 요청을 확인해주세요.'},400)
    const id=params.get('id')
    const result=id===null?await readOnly(ports,c=>listOrders(c,ports.tenantId)):await readOnly(ports,c=>orderDetail(c,ports.tenantId,id))
    return result?json(result):json({error:'주문을 찾을 수 없습니다.'},404)
  }catch(error){return json({error:error instanceof z.ZodError?'조회 요청을 확인해주세요.':'주문을 불러오지 못했습니다.'},error instanceof z.ZodError?400:503)}
}
export async function orderAdminPost(request:Request,ports:OrderAdminPorts){
  const denied=await guard(ports);if(denied)return denied
  if(!ports.origins.includes(request.headers.get('origin')??''))return json({error:'요청 출처를 확인할 수 없습니다.'},403)
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return json({error:'입력 형식을 확인해주세요.'},415)
  try{
    const reader=request.body?.getReader();if(!reader)return json({error:'입력 내용이 없습니다.'},400)
    const chunks:Uint8Array[]=[];let length=0
    while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength
      if(length>8192){await reader.cancel();return json({error:'입력 내용이 너무 깁니다.'},413)}chunks.push(part.value)}
    const raw:unknown=JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if(raw&&typeof raw==='object'&&'kind' in raw&&raw.kind==='SEARCH'){
      const {kind:_kind,...input}=z.object({kind:z.literal('SEARCH'),...orderSearchSchema.shape}).strict().parse(raw)
      return json(await readOnly(ports,c=>listOrders(c,ports.tenantId,input)))
    }
    const input=orderAdminActionSchema.parse(raw)
    let evidence:ReviewEvidence|undefined
    let payment:PaidEvidence|undefined
    let access:AccessEvidence|undefined
    if(['APPROVE_EXISTING','RECONCILE_IDENTITY','RESUME_PAID','MANUAL_ACCESS','RECORD_REVOKED'].includes(input.action)){
      const replay=await readOnly(ports,c=>replayOrderAction(c,ports.tenantId,input))
      if(replay)return json({success:true,...replay})
      if(input.action==='APPROVE_EXISTING'||input.action==='RECONCILE_IDENTITY'){
        if(!ports.inspectExisting)throw new OrderAdminError('STATE')
        const context=await readOnly(ports,c=>contextFromOrder(c,ports.tenantId,input.orderId,input.expectedVersion))
        if(!context)throw new OrderAdminError('STALE')
        evidence=await ports.inspectExisting(context,input.studentId)
      }else if(input.action==='RESUME_PAID'){
        if(!ports.inspectPaid)throw new OrderAdminError('STATE')
        const context=await readOnly(ports,c=>paidContext(c,ports.tenantId,input.orderId,input.expectedVersion,input.billId))
        if(!context)throw new OrderAdminError('STALE')
        const checked=await ports.inspectPaid(context)
        if(!checked)throw new OrderAdminError('PAYMENT')
        payment=checked
      }else if(input.action==='MANUAL_ACCESS'||input.action==='RECORD_REVOKED'){
        if(!ports.inspectAccess)throw new OrderAdminError('STATE')
        const context=await readOnly(ports,async c=>{
          const row=(await c.query("SELECT student_id,identity_state FROM daechion_orders.orders WHERE id=$1 AND tenant_id=$2",[input.orderId,ports.tenantId])).rows[0]
          if(!row||row.identity_state!=='PASSED'||Number(row.student_id)!==input.studentId)throw new OrderAdminError('STATE')
          if(!(await c.query('SELECT 1 FROM daechion_orders.grants WHERE order_id=$1 AND lecture_id=$2',[input.orderId,input.lectureId])).rows.length)throw new OrderAdminError('STATE')
          return contextFromOrder(c,ports.tenantId,input.orderId,input.expectedVersion)
        })
        if(!context)throw new OrderAdminError('STALE')
        access=await ports.inspectAccess(context,input.studentId,input.lectureId,input.action==='RECORD_REVOKED')
      }
    }
    return json({success:true,...await ports.withClient(async c=>{await ports.ready(c);return applyOrderAdminAction(c,ports.tenantId,input,evidence,payment,access)})})
  }catch(error){
    if(error instanceof z.ZodError||error instanceof SyntaxError)return json({error:'담당자·사유·확인 항목과 입력 내용을 확인해주세요.'},400)
    if(error instanceof OrderAdminError){
      if(error.code==='NOT_FOUND')return json({error:'주문을 찾을 수 없습니다.'},404)
      const messages={STALE:'다른 작업으로 주문이 변경되었습니다. 새로 불러온 뒤 확인해주세요.',CONFLICT:'같은 처리 번호에 다른 내용이 있습니다. 결과를 새로 불러와 확인해주세요.',STATE:'현재 결제 확인·권한 상태에서는 이 작업을 진행할 수 없습니다.',PAYMENT:'현재 청구서의 결제 완료·금액·승인일시를 확인할 수 없어 보류를 해제하지 않았습니다.'}
      return json({error:messages[error.code]},409)
    }
    return json({error:'처리 결과를 확인하지 못했습니다. 같은 요청으로 결과를 확인하거나 주문을 새로 불러와 주세요.'},503)
  }
}
