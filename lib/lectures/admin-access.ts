import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { transaction } from './db'
import { HttpError } from './http'
import { lockAdmin, type AdminActor, type QueryClient } from './admin-domain'
import { requireFreshPaidRead } from './billing-proof'

export const accessCommand = z.object({
  action:z.enum(['OPEN','CLOSE','RESTORE','CLOSE_UNPAID','RESUME_AUTO']),
  expectedVersion:z.number().int().nonnegative(),
  expectedTotalWon:z.number().int().positive().max(2147483647),
  requestKey:z.string().uuid(),
  reason:z.string().trim().min(5,'확인 근거와 사유를 5자 이상 입력해주세요.').max(500),
  checkedAt:z.string().datetime({offset:true}),
  confirmed:z.literal(true),
}).strict()
type Command = z.infer<typeof accessCommand>
export function changeOrderAccess(actor:AdminActor, orderId:string, input:Command) {
  return transaction(client=>changeAccessWithinTransaction(client,actor,orderId,input))
}
export async function changeAccessWithinTransaction(client:QueryClient, actor:AdminActor, orderId:string, input:Command) {
  const d=accessCommand.parse(input)
  if(Date.parse(d.checkedAt)>Date.now()+60000)throw new HttpError(400,'확인 시각은 미래일 수 없습니다.')
  const admin=await lockAdmin(client,actor)
  const {rows}=await client.query('SELECT id,user_id,status,total_won,access_control,version FROM lecture_orders WHERE id=$1 FOR UPDATE',[orderId])
  const order=rows[0]
  if(!order)throw new HttpError(404,'주문을 찾을 수 없습니다.')
  const fingerprint=createHash('sha256').update(JSON.stringify({orderId,...d})).digest('hex')
  const prior=await client.query('SELECT request_hash,after_state FROM lecture_admin_actions WHERE admin_id=$1 AND request_key=$2',[actor.id,d.requestKey])
  if(prior.rows[0]) {
    if(prior.rows[0].request_hash!==fingerprint)throw new HttpError(409,'같은 요청 키에 다른 작업이 지정됐습니다.')
    return { ...prior.rows[0].after_state,alreadyApplied:true }
  }
  if(order.version!==d.expectedVersion || order.total_won!==d.expectedTotalWon)throw new HttpError(409,'주문이 변경되었습니다. 새로고침한 뒤 다시 확인해주세요.')
  const items=await client.query('SELECT id,lecture_id,price_won FROM lecture_order_items WHERE order_id=$1 ORDER BY id FOR SHARE',[orderId])
  if(!items.rows.length || items.rows.reduce((sum,i)=>sum+i.price_won,0)!==order.total_won)throw new HttpError(409,'주문 명세와 금액을 먼저 확인해주세요.')
  if(d.action==='OPEN' && (order.status==='PAID'||order.access_control==='MANUAL_CLOSED'))throw new HttpError(409,'이미 승인됐거나 회수된 주문입니다. 복원 기능을 확인해주세요.')
  if(d.action==='RESTORE' && order.access_control!=='MANUAL_CLOSED')throw new HttpError(409,'수동 회수된 주문만 복원할 수 있습니다.')
  if(d.action==='CLOSE' && (order.status!=='PAID'||order.access_control==='MANUAL_CLOSED'))throw new HttpError(409,'열린 결제 완료 주문만 회수할 수 있습니다.')
  if(d.action==='CLOSE_UNPAID' && !['CREATED','AWAITING_PAYMENT','EXPIRED'].includes(order.status))throw new HttpError(409,'미납 주문만 종료할 수 있습니다.')
  let verifiedPaymentEventId:string|undefined
  if(d.action==='RESUME_AUTO'){
    if(order.status!=='PAID'||order.access_control==='AUTO')throw new HttpError(409,'수동 처리 중인 결제 완료 주문만 자동 처리로 복귀할 수 있습니다.')
    verifiedPaymentEventId=await requireFreshPaidRead(client,orderId)
  }
  const opening=d.action==='OPEN'||d.action==='RESTORE'||d.action==='RESUME_AUTO'
  const next={id:order.id,status:opening?'PAID':d.action==='CLOSE_UNPAID'?'EXPIRED':order.status,
    access_control:d.action==='RESUME_AUTO'?'AUTO':opening?'MANUAL_OPEN':'MANUAL_CLOSED',version:order.version+1,...(verifiedPaymentEventId?{verificationEventId:verifiedPaymentEventId}:{})}
  if(opening) {
    for(const item of items.rows) {
      const saved=await client.query(`INSERT INTO lecture_entitlements(id,user_id,lecture_id,order_item_id)
        VALUES($1,$2,$3,$4) ON CONFLICT(order_item_id) DO UPDATE SET revoked_at=NULL
        WHERE lecture_entitlements.user_id=EXCLUDED.user_id AND lecture_entitlements.lecture_id=EXCLUDED.lecture_id
        RETURNING id`,[randomUUID(),order.user_id,item.lecture_id,item.id])
      if(!saved.rowCount)throw new HttpError(409,'원본 구매와 수강 권한이 일치하지 않습니다.')
    }
  } else {
    await client.query(`UPDATE lecture_entitlements e SET revoked_at=now()
      FROM lecture_order_items i WHERE e.order_item_id=i.id AND i.order_id=$1 AND e.revoked_at IS NULL`,[orderId])
  }
  await client.query('UPDATE lecture_orders SET status=$2,access_control=$3,version=$4 WHERE id=$1',[orderId,next.status,next.access_control,next.version])
  await client.query("UPDATE lecture_billing_requests SET state=CASE WHEN state='PENDING' THEN 'STOPPED' ELSE state END,needs_review=false,review_reason=NULL,next_check_at=now() WHERE order_id=$1",[orderId])
  await client.query(`INSERT INTO lecture_admin_actions(id,admin_id,actor_name,order_id,action,reason,checked_at,request_key,request_hash,before_state,after_state)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb)`,[randomUUID(),actor.id,admin.name,orderId,d.action,d.reason,d.checkedAt,d.requestKey,fingerprint,JSON.stringify(order),JSON.stringify(next)])
  return {...next,alreadyApplied:false}
}
