import { createHash,randomUUID } from 'node:crypto'
import { z } from 'zod'
import { lockAdmin,type AdminActor,type QueryClient } from './admin-domain'
import { transaction } from './db'
import { HttpError } from './http'
import { CAN_REFRESH_BILL_SQL } from './billing-proof'

export const refreshBillingInput=z.object({expectedVersion:z.number().int().nonnegative(),requestKey:z.string().uuid()}).strict()
type Input=z.infer<typeof refreshBillingInput>
export function requestBillingRefresh(actor:AdminActor,orderId:string,input:Input){
 return transaction(c=>refreshBillingWithinTransaction(c,actor,orderId,input))
}
export async function refreshBillingWithinTransaction(client:QueryClient,actor:AdminActor,orderId:string,input:Input){
 const d=refreshBillingInput.parse(input),admin=await lockAdmin(client,actor)
 const {rows}=await client.query('SELECT id,version FROM lecture_orders WHERE id=$1 FOR UPDATE',[orderId])
 if(!rows[0])throw new HttpError(404,'주문을 찾을 수 없습니다.')
 const fingerprint=createHash('sha256').update(JSON.stringify({orderId,...d})).digest('hex')
 const prior=await client.query('SELECT id,request_hash,completed_at FROM lecture_billing_refreshes WHERE admin_id=$1 AND request_key=$2',[actor.id,d.requestKey])
 if(prior.rows[0]){
  if(prior.rows[0].request_hash!==fingerprint)throw new HttpError(409,'같은 요청 키에 다른 재조회가 지정됐습니다.')
  return {id:prior.rows[0].id,alreadyApplied:true,completed:Boolean(prior.rows[0].completed_at)}
 }
 if(rows[0].version!==d.expectedVersion)throw new HttpError(409,'주문이 변경되었습니다. 새로고침한 뒤 요청해주세요.')
 const billing=await client.query(`SELECT b.state,${CAN_REFRESH_BILL_SQL} AS eligible FROM lecture_billing_requests b WHERE order_id=$1 FOR UPDATE OF b`,[orderId])
 const request=billing.rows[0]
 if(!request||['PENDING','STOPPED'].includes(request.state))throw new HttpError(409,'발송되었거나 발송 결과를 확인 중인 청구서만 재조회할 수 있습니다.')
 if(!request.eligible)throw new HttpError(409,'청구서를 발송 중입니다. 발송 결과를 확인한 뒤 다시 요청해주세요.')
 const seq=await client.query('UPDATE lecture_billing_requests SET refresh_sequence=refresh_sequence+1,next_check_at=now() WHERE order_id=$1 RETURNING refresh_sequence',[orderId])
 const id=randomUUID()
 await client.query(`INSERT INTO lecture_billing_refreshes(id,order_id,admin_id,actor_name,sequence,request_key,request_hash)
   VALUES($1,$2,$3,$4,$5,$6,$7)`,[id,orderId,actor.id,admin.name,seq.rows[0].refresh_sequence,d.requestKey,fingerprint])
 return {id,alreadyApplied:false,completed:false}
}
