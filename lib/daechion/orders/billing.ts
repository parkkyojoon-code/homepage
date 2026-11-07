import {randomUUID} from 'node:crypto'
import {z} from 'zod'
import {newBillId} from '../billing'
import type {BillingProvider,PaymentProvider,PaymentObservation,BillSendJob} from '../payssam'
import {contactSchema} from './checkout'
import {orderTransaction,lockOrder,orderChanged,holdOrder,type OrderConnection} from './worker-store'

const uuid=z.string().uuid(),account=z.string().min(1).max(100)
const time=(v:unknown)=>v==null?NaN:new Date(v as string).getTime()
export interface BillingContext {orderId:string;version:string;tenantId:string;totalWon:number;contact:ReturnType<typeof contactSchema.parse>;items:unknown[]}
export interface OrderBillingPorts extends OrderConnection {
  provider:BillingProvider
  // Mandatory fresh read-only ownership, tenant and live-course check. No public
  // request can supply this decision. The executable adapter is still gated.
  preflight(context:BillingContext):Promise<'READY'|'REVIEW'>
}
export async function sendOrderBill(id:string,enabled:boolean,ports:OrderBillingPorts){
  if(!enabled)return 'DISABLED'
  uuid.parse(id);account.parse(ports.provider.accountId)
  const context=await ports.withClient(async c=>{
    const o=(await c.query('SELECT * FROM daechion_orders.orders WHERE id=$1',[id])).rows[0]
    if(!o||o.checkout_state!=='READY'||o.review_code!==null||o.payment_state!=='PENDING'||(await c.query('SELECT id FROM daechion_orders.bills WHERE order_id=$1',[id])).rows.length)return null
    const {noticeVersion:_notice,...contact}=o.contact_snapshot as Record<string,unknown>
    return {orderId:id,version:String(o.version),tenantId:String(o.tenant_id),totalWon:Number(o.total_won),contact:contactSchema.parse(contact),
      items:(await c.query('SELECT snapshot FROM daechion_orders.items WHERE order_id=$1 ORDER BY product_id',[id])).rows.map(r=>r.snapshot)}
  })
  if(!context)return 'SKIPPED'
  const start=Date.now();let decision:'READY'|'REVIEW'='REVIEW'
  try{decision=await ports.preflight(structuredClone(context))}catch{}
  const job=await ports.withClient(c=>orderTransaction(c,async()=>{
    const o=await lockOrder(c,id)
    if(!o||String(o.version)!==context.version||o.checkout_state!=='READY'||o.review_code!==null||o.payment_state!=='PENDING')return null
    if((await c.query('SELECT id FROM daechion_orders.bills WHERE order_id=$1',[id])).rows.length)return null
    if(decision!=='READY'||Date.now()-start>60000){await holdOrder(c,id,'billing_preflight_review');return null}
    const billId=newBillId(),recordId=randomUUID()
    await c.query('SELECT pg_advisory_xact_lock(61130,hashtext($1))',[ports.provider.accountId+'|'+billId])
    if((await c.query('SELECT id FROM daechion_automation.bills WHERE provider_account=$1 AND bill_id=$2',[ports.provider.accountId,billId])).rows.length){await holdOrder(c,id,'bill_collision');return null}
    await c.query(`INSERT INTO daechion_orders.bills(id,order_id,amount_won,provider_account,bill_id,revision) VALUES($1,$2,$3,$4,$5,1)`,[recordId,id,context.totalWon,ports.provider.accountId,billId])
    // Commit uncertainty before sending. A crash never returns this to a queue.
    await c.query("UPDATE daechion_orders.bills SET state='SEND_UNKNOWN' WHERE id=$1",[recordId])
    const version=await orderChanged(c,id,'bill_send_attempted')
    const titles=(context.items as {title:string}[]).map(i=>i.title)
    const payload:BillSendJob={billId,amountWon:context.totalWon,recipientName:context.contact.studentName,recipientPhone:context.contact.payerPhone,
      productName:titles.length===1?titles[0]:`${titles[0]} 외 ${titles.length-1}개 상품`}
    return {recordId,version,payload}
  }))
  if(!job)return 'SKIPPED'
  const fence=await ports.withClient(c=>c.query(`SELECT o.id FROM daechion_orders.orders o JOIN daechion_orders.bills b ON b.order_id=o.id
    WHERE o.id=$1 AND o.version=$2 AND o.checkout_state='READY' AND o.review_code IS NULL AND o.payment_state='PENDING'
    AND b.id=$3 AND b.is_current AND b.state='SEND_UNKNOWN' AND b.provider_account=$4`,[id,job.version,job.recordId,ports.provider.accountId]))
  let result:'SENT'|'UNKNOWN'='UNKNOWN'
  if(fence.rows.length)try{result=await ports.provider.send(job.payload)}catch{}
  return ports.withClient(c=>orderTransaction(c,async()=>{
    const o=await lockOrder(c,id);if(!o)return 'UNKNOWN'
    if(result!=='SENT'){await holdOrder(c,id,'bill_send_unknown');return 'UNKNOWN'}
    const saved=await c.query(`UPDATE daechion_orders.bills SET state='SENT',sent_at=now(),due_at=now()+interval '7 days'
      WHERE id=$1 AND order_id=$2 AND provider_account=$3 AND is_current AND state='SEND_UNKNOWN' RETURNING id`,[job.recordId,id,ports.provider.accountId])
    if(!saved.rows.length)return 'UNKNOWN'
    if(o.review_code==='bill_send_unknown')await c.query("UPDATE daechion_orders.orders SET checkout_state='READY',review_code=NULL WHERE id=$1",[id])
    await orderChanged(c,id,'bill_sent');return 'SENT'
  }))
}

export async function checkOrderPayment(id:string,enabled:boolean,ports:OrderConnection&{provider:PaymentProvider}){
  if(!enabled)return 'DISABLED'
  uuid.parse(id);account.parse(ports.provider.accountId)
  const target=await ports.withClient(async c=>(await c.query(`SELECT id,bill_id,provider_account,checked_at::text AS token FROM daechion_orders.bills
    WHERE order_id=$1 AND is_current AND state IN ('SENT','SEND_UNKNOWN')`,[id])).rows[0])
  if(!target)return 'SKIPPED'
  if(target.provider_account!==ports.provider.accountId){await ports.withClient(c=>orderTransaction(c,async()=>{if(await lockOrder(c,id))await holdOrder(c,id,'billing_account_mismatch')}));return 'SKIPPED'}
  let observation:PaymentObservation={state:'UNKNOWN'}
  try{observation=await ports.provider.read(String(target.bill_id))}catch{}
  const parsed=z.union([z.object({state:z.literal('UNKNOWN')}).strict(),z.object({state:z.enum(['F','W','C','D']),billId:z.string().regex(/^\d{20}$/),
    amountWon:z.number().int().positive().max(2147483647).nullable(),paidAt:z.string().datetime({offset:true}).nullable()}).strict()]).safeParse(observation)
  observation=parsed.success?parsed.data:{state:'UNKNOWN'}
  return ports.withClient(c=>orderTransaction(c,async()=>{
    const o=await lockOrder(c,id);if(!o)return 'STALE'
    const b=(await c.query(`SELECT * FROM daechion_orders.bills WHERE id=$1 AND order_id=$2 AND provider_account=$3 AND is_current
      AND checked_at IS NOT DISTINCT FROM $4::timestamptz FOR UPDATE`,[target.id,id,ports.provider.accountId,target.token])).rows[0]
    if(!b||!['SENT','SEND_UNKNOWN'].includes(String(b.state)))return 'STALE'
    if((await c.query('SELECT id FROM daechion_automation.bills WHERE provider_account=$1 AND bill_id=$2',[ports.provider.accountId,target.bill_id])).rows.length){await holdOrder(c,id,'bill_collision');return 'REVIEW'}
    const old=JSON.stringify([o.checkout_state,o.payment_state,o.review_code,o.paid_at,b.last_payment_state,b.state])
    let payment=String(o.payment_state),checkout=String(o.checkout_state),review=o.review_code as string|null,paidAt=o.paid_at,last='UNKNOWN',billState=String(b.state)
    const transient=new Set(['payment_query_unknown','unpaid_wait_closed'])
    const hold=(code:string)=>{checkout='REVIEW';if(!review||transient.has(review))review=code}
    if(observation.state==='UNKNOWN'||observation.billId!==target.bill_id){if(payment!=='PAID'&&payment!=='CANCELLED')payment='UNKNOWN';hold('payment_query_unknown')}
    else if(observation.state==='C'||observation.state==='D'){last='CANCELLED';payment='CANCELLED';billState=observation.state==='C'?'CANCELLED':'DESTROYED';hold('payment_cancelled')}
    else if(observation.state==='W'){
      last='PENDING'
      if(payment==='PAID'||payment==='CANCELLED')hold('payment_regressed')
      else if(b.state==='SENT'){
        payment='PENDING'
        if(time(o.observed_at)>=time(b.due_at)&&(!review||transient.has(review))){checkout='CLOSED';review='unpaid_wait_closed'}
        else if(review==='payment_query_unknown'){checkout='READY';review=null}
      }else hold('bill_send_unknown')
    }else{
      const approved=time(observation.paidAt)
      if(observation.amountWon!==o.total_won||observation.amountWon!==b.amount_won)hold('payment_amount_mismatch')
      else{
        last='PAID'
        if(b.state!=='SENT')hold('bill_send_unknown')
        else{
          payment='PAID'
          if(!Number.isFinite(approved)||approved>time(o.observed_at)+60000||approved<time(b.sent_at)-60000)hold('payment_time_unknown')
          else if(approved>time(b.due_at))hold('late_payment')
          else if(paidAt&&time(paidAt)!==approved)hold('payment_evidence_changed')
          else if(review===null||transient.has(review)){checkout='READY';review=null}
          if(Number.isFinite(approved)&&!paidAt)paidAt=new Date(approved).toISOString()
        }
      }
    }
    await c.query(`UPDATE daechion_orders.bills SET state=$2,last_payment_state=$3,checked_at=GREATEST(clock_timestamp(),COALESCE(checked_at+interval '1 microsecond',clock_timestamp())) WHERE id=$1`,[b.id,billState,last])
    await c.query('UPDATE daechion_orders.orders SET checkout_state=$2,payment_state=$3,review_code=$4,paid_at=$5 WHERE id=$1',[id,checkout,payment,review,paidAt])
    if(checkout!=='READY'){
      await c.query("UPDATE daechion_orders.grants SET state='REVIEW',review_code='order_held',lease_token=NULL,lease_until=NULL WHERE order_id=$1 AND state='RUNNING'",[id])
      await c.query("UPDATE daechion_orders.jobs SET state=CASE WHEN state='RUNNING' THEN 'UNKNOWN' ELSE 'FAILED' END,last_error=$2,lease_token=NULL,lease_until=NULL WHERE order_id=$1 AND kind='READY_MESSAGE' AND state IN ('PENDING','RUNNING')",[id,review])
      await c.query("UPDATE daechion_orders.ready_receipts SET state='BLOCKED' WHERE order_id=$1 AND state='PENDING'",[id])
      await c.query("UPDATE daechion_orders.orders SET notification_state=CASE WHEN EXISTS(SELECT 1 FROM daechion_orders.jobs WHERE order_id=$1 AND kind='READY_MESSAGE' AND state='UNKNOWN') THEN 'UNKNOWN' ELSE 'FAILED' END WHERE id=$1 AND notification_state='PENDING'",[id])
    }
    if(old!==JSON.stringify([checkout,payment,review,paidAt,last,billState]))await orderChanged(c,id,'payment_observed')
    return checkout==='READY'&&payment==='PAID'&&last==='PAID'?'PAID':'RECORDED'
  }))
}
