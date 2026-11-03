import { createHash,randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { QueryClient } from './admin-domain'
import { transaction } from './db'
import { HttpError } from './http'
import { newSession,tokenHash } from './security'

export const billingClaimInput=z.object({kind:z.enum(['SEND','READ'])}).strict()
const common={orderId:z.string().uuid(),billId:z.string().regex(/^L[0-9a-f]{19}$/),claimToken:z.string().regex(/^[a-f0-9]{64}$/)}
export const billingResultInput=z.discriminatedUnion('kind',[
 z.object({...common,kind:z.literal('SEND'),outcome:z.enum(['SENT','UNKNOWN'])}).strict(),
 z.object({...common,kind:z.literal('READ'),state:z.enum(['F','W','C','D','ERROR']),amountWon:z.number().int().positive().max(2147483647).nullable(),echoedBillId:z.string().max(100).nullable()}).strict(),
])
type Report=z.infer<typeof billingResultInput>
export function claimBilling(kind:'SEND'|'READ'){return transaction(c=>claimBillingWithinTransaction(c,kind))}
export async function claimBillingWithinTransaction(client:QueryClient,kind:'SEND'|'READ'){
 const condition=kind==='SEND'?"r.state='PENDING' AND o.status='CREATED' AND o.access_control='AUTO'":
   "((r.state IN ('SENT','UNKNOWN')) OR (r.state='SENDING' AND r.lease_until<=now())) AND r.next_check_at<=now()"
 // All queue operations take the order lock first, matching administrator access commands.
 const {rows}=await client.query(`SELECT o.id,o.version,o.recipient_name,o.recipient_phone,r.bill_id,r.amount_won,r.state,
   (SELECT title_snapshot FROM lecture_order_items WHERE order_id=o.id ORDER BY id LIMIT 1) AS title,
   (SELECT count(*)::int FROM lecture_order_items WHERE order_id=o.id) AS item_count
   FROM lecture_billing_requests r JOIN lecture_orders o ON o.id=r.order_id
   WHERE ${condition} AND (r.lease_hash IS NULL OR r.lease_until<=now())
   ORDER BY CASE WHEN EXISTS(SELECT 1 FROM lecture_billing_refreshes f WHERE f.order_id=o.id AND f.completed_at IS NULL) THEN 0 ELSE 1 END,r.next_check_at,r.created_at,r.order_id LIMIT 1 FOR UPDATE OF o SKIP LOCKED`)
 const job=rows[0]
 if(!job)return null
 const token=newSession()
 await client.query(`UPDATE lecture_billing_requests SET
   state=CASE WHEN $2='SEND' THEN 'SENDING' WHEN state='SENDING' THEN 'UNKNOWN' ELSE state END,
   needs_review=needs_review OR state='SENDING',review_reason=CASE WHEN state='SENDING' THEN 'SEND_UNKNOWN' ELSE review_reason END,
   lease_hash=$3,lease_kind=$2,lease_until=now()+interval '2 minutes',lease_version=$4,lease_refresh_sequence=refresh_sequence WHERE order_id=$1`,[job.id,kind,tokenHash(token),job.version])
 return {kind,orderId:job.id,billId:job.bill_id,amountWon:job.amount_won,claimToken:token,
  ...(kind==='SEND'?{recipientName:job.recipient_name,recipientPhone:job.recipient_phone,productName:String(job.title||'온라인 강의').slice(0,100)+(job.item_count>1?` 외 ${job.item_count-1}개`:'')}:{})}
}
export function recordBillingResult(input:Report){return transaction(c=>recordBillingWithinTransaction(c,input))}
export async function recordBillingWithinTransaction(client:QueryClient,input:Report){
 const d=billingResultInput.parse(input),claimHash=tokenHash(d.claimToken)
 const normalized=d.kind==='SEND'?{kind:d.kind,billId:d.billId,outcome:d.outcome}:{kind:d.kind,billId:d.billId,state:d.state,amountWon:d.amountWon,echoedBillId:d.echoedBillId}
 const fingerprint=createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
 const {rows}=await client.query('SELECT id,user_id,status,total_won,version,access_control FROM lecture_orders WHERE id=$1 FOR UPDATE',[d.orderId])
 const order=rows[0]
 if(!order)throw new HttpError(404,'청구 대상 주문을 찾을 수 없습니다.')
 const prior=await client.query('SELECT fingerprint,result FROM lecture_billing_events WHERE order_id=$1 AND claim_hash=$2',[d.orderId,claimHash])
 if(prior.rows[0]){
  if(prior.rows[0].fingerprint!==fingerprint)throw new HttpError(409,'동일 작업에 다른 결과가 지정됐습니다.')
  return {...prior.rows[0].result.outcome,alreadyApplied:true}
 }
 const saved=await client.query(`SELECT *,lease_until>now() AS lease_valid,due_at<=now() AS overdue FROM lecture_billing_requests WHERE order_id=$1 FOR UPDATE`,[d.orderId])
 const request=saved.rows[0]
 if(!request||request.bill_id!==d.billId||request.lease_hash!==claimHash||request.lease_kind!==d.kind)throw new HttpError(409,'이미 교체됐거나 유효하지 않은 청구 작업입니다.')
 const stale=!request.lease_valid||request.lease_version!==order.version
 let approved=false,reviewReason:string|null=null
 if(d.kind==='SEND'){
  const sent=d.outcome==='SENT'&&!stale
  reviewReason=sent?null:stale?'LATE_SEND_RESULT':'SEND_UNKNOWN'
  await client.query(`UPDATE lecture_billing_requests SET state=$2,
    sent_at=CASE WHEN $2='SENT' THEN COALESCE(sent_at,now()) ELSE sent_at END,
    due_at=CASE WHEN $2='SENT' THEN COALESCE(due_at,COALESCE(sent_at,now())+interval '168 hours') ELSE due_at END,
    needs_review=$3,review_reason=$4,next_check_at=now() WHERE order_id=$1`,[d.orderId,sent?'SENT':'UNKNOWN',Boolean(reviewReason),reviewReason])
  if(sent&&order.access_control==='AUTO'&&order.status==='CREATED')await client.query("UPDATE lecture_orders SET status='AWAITING_PAYMENT',version=version+1 WHERE id=$1",[d.orderId])
 }else if(!stale){
  const matched=d.echoedBillId===request.bill_id
  if(d.state==='ERROR')reviewReason='LOOKUP_ERROR'
  else if(!matched)reviewReason='BILL_MISMATCH'
  else if(d.state==='F'&&d.amountWon!==request.amount_won)reviewReason='AMOUNT_MISMATCH'
  else if(d.state==='C'&&order.access_control!=='MANUAL_CLOSED')reviewReason='EXTERNAL_CANCEL'
  else if(d.state==='D'&&order.status!=='EXPIRED'&&order.access_control!=='MANUAL_CLOSED')reviewReason='EXTERNAL_VOID'
  else if(order.access_control==='MANUAL_CLOSED'&&d.state==='F')reviewReason='PAYMENT_AFTER_MANUAL_CLOSE'
  else if(order.access_control==='MANUAL_OPEN'&&d.state!=='F')reviewReason='MANUAL_EXTERNAL_DIFFERENCE'
  else if(['EXPIRED','CANCELLED','REFUNDED'].includes(order.status)&&d.state==='F')reviewReason='LATE_PAYMENT'
  if(order.status==='PAID'&&d.state==='W'&&order.access_control!=='MANUAL_CLOSED'&&!reviewReason)reviewReason='PAID_EXTERNAL_DIFFERENCE'
  if(request.review_reason==='EXTERNAL_CANCEL'&&order.access_control!=='MANUAL_CLOSED'&&!reviewReason)reviewReason='EXTERNAL_CANCEL'
  if(d.state==='F'&&!reviewReason&&order.access_control==='AUTO'&&['CREATED','AWAITING_PAYMENT'].includes(order.status)){
   const items=await client.query('SELECT id,lecture_id,price_won FROM lecture_order_items WHERE order_id=$1 ORDER BY id FOR SHARE',[order.id])
   const existing=await client.query(`SELECT e.user_id,e.lecture_id,e.revoked_at,i.lecture_id AS source_lecture
     FROM lecture_entitlements e JOIN lecture_order_items i ON i.id=e.order_item_id WHERE i.order_id=$1`,[order.id])
   if(!items.rows.length||items.rows.reduce((sum,i)=>sum+i.price_won,0)!==order.total_won)reviewReason='ITEMS_MISMATCH'
   else if(existing.rows.some(e=>e.user_id!==order.user_id||e.lecture_id!==e.source_lecture||e.revoked_at!==null))reviewReason='RIGHTS_CONFLICT'
   else{
    for(const item of items.rows)await client.query(`INSERT INTO lecture_entitlements(id,user_id,lecture_id,order_item_id)
      VALUES($1,$2,$3,$4) ON CONFLICT(order_item_id) DO NOTHING`,[randomUUID(),order.user_id,item.lecture_id,item.id])
    await client.query("UPDATE lecture_orders SET status='PAID',version=version+1 WHERE id=$1",[order.id]);approved=true
   }
  }
  const overdue=Boolean(request.overdue)
  if(d.state==='W'&&matched&&overdue)reviewReason='OVERDUE_REVIEW'
  if(d.state==='D'&&matched&&overdue&&order.access_control==='AUTO'&&['CREATED','AWAITING_PAYMENT'].includes(order.status)){
   await client.query("UPDATE lecture_orders SET status='EXPIRED',version=version+1 WHERE id=$1",[order.id])
   reviewReason=null
  }
  if(request.state==='UNKNOWN'&&!request.sent_at&&d.state!=='F'&&!reviewReason)reviewReason='SEND_TIME_UNKNOWN'
  if(d.state==='F'&&matched&&d.amountWon===request.amount_won)await client.query("UPDATE lecture_billing_requests SET state='SENT' WHERE order_id=$1",[order.id])
  const delay=reviewReason?300:approved||order.status==='PAID'?1800:30
  await client.query(`UPDATE lecture_billing_requests SET last_state=$2,last_amount_won=$3,checked_at=now(),
    needs_review=$4,review_reason=$5,next_check_at=now()+$6::integer*interval '1 second' WHERE order_id=$1`,[order.id,d.state,d.amountWon,Boolean(reviewReason),reviewReason,delay])
 }else{
  reviewReason='STALE_RESULT'
  await client.query('UPDATE lecture_billing_requests SET next_check_at=now(),checked_order_version=NULL,checked_event_id=NULL WHERE order_id=$1',[order.id])
 }
 await client.query('UPDATE lecture_billing_requests SET lease_hash=NULL,lease_kind=NULL,lease_until=NULL,lease_version=NULL,lease_refresh_sequence=NULL WHERE order_id=$1',[order.id])
 const outcome={applied:!stale,approved,needsReview:Boolean(reviewReason),reviewReason}
 const eventId=randomUUID()
 await client.query(`INSERT INTO lecture_billing_events(id,order_id,claim_hash,kind,fingerprint,result,applied)
  VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,[eventId,order.id,claimHash,d.kind,fingerprint,JSON.stringify({report:normalized,outcome}),!stale])
 if(d.kind==='READ'&&!stale){
  const includedSequence=request.lease_refresh_sequence??0
  await client.query(`UPDATE lecture_billing_requests SET checked_order_version=$2,checked_event_id=$3,
    next_check_at=CASE WHEN refresh_sequence>$4 THEN now() ELSE next_check_at END WHERE order_id=$1`,[order.id,order.version,eventId,includedSequence])
  await client.query('UPDATE lecture_billing_refreshes SET completed_at=now(),result_event_id=$3 WHERE order_id=$1 AND sequence<=$2 AND completed_at IS NULL',[order.id,includedSequence,eventId])
 }
 return {...outcome,alreadyApplied:false}
}
