import {randomUUID} from 'node:crypto'
import {z} from 'zod'
import {lmsText,type ReadyMessageProvider} from '../ready-message'
import type {PaymentProvider} from '../payssam'
import type {LedgerClient} from '../ledger'
import {contactSchema} from './checkout'
import {checkOrderPayment} from './billing'
import {orderTransaction,lockOrder,orderChanged,eligible,type OrderConnection} from './worker-store'

async function contentReady(c:LedgerClient,id:string){
  if(!await eligible(c,id))return false
  return (await c.query(`SELECT o.id FROM daechion_orders.orders o WHERE o.id=$1 AND o.identity_state='PASSED'
    AND EXISTS(SELECT 1 FROM daechion_orders.grants WHERE order_id=o.id)
    AND NOT EXISTS(SELECT 1 FROM daechion_orders.grants WHERE order_id=o.id AND state NOT IN ('VERIFIED','MANUAL'))`,[id])).rows.length>0
}
interface MessagePorts extends OrderConnection {message:ReadyMessageProvider;payment:PaymentProvider}
async function send(id:string,ports:MessagePorts){
  if(await checkOrderPayment(id,true,{withClient:ports.withClient,provider:ports.payment})!=='PAID')return 'SKIPPED'
  const job=await ports.withClient(c=>orderTransaction(c,async()=>{
    const o=await lockOrder(c,id);if(!o)return null
    const stale=await c.query("UPDATE daechion_orders.jobs SET state='UNKNOWN',last_error='message_lease_expired',lease_token=NULL,lease_until=NULL WHERE order_id=$1 AND kind='READY_MESSAGE' AND state='RUNNING' AND lease_until<=now() RETURNING id",[id])
    if(stale.rows.length){
      await c.query("UPDATE daechion_orders.ready_receipts SET state='BLOCKED' WHERE order_id=$1 AND state='PENDING'",[id])
      await c.query("UPDATE daechion_orders.orders SET notification_state='UNKNOWN' WHERE id=$1",[id]);await orderChanged(c,id,'message_unknown');return null
    }
    if(!await contentReady(c,id))return null
    const queue=(await c.query("SELECT * FROM daechion_orders.jobs WHERE order_id=$1 AND kind='READY_MESSAGE' FOR UPDATE",[id])).rows[0]
    if(!queue)return null
    // Only a known unattempted message stopped by a recoverable payment query
    // can resume. UNKNOWN or previously attempted work never automatically sends.
    let recovered=false
    if(queue.state==='FAILED'&&Number(queue.attempts)===0&&['payment_query_unknown','unpaid_wait_closed'].includes(String(queue.last_error))){
      await c.query("UPDATE daechion_orders.orders SET notification_state='PENDING' WHERE id=$1",[id])
      await c.query("UPDATE daechion_orders.jobs SET state='PENDING',last_error=NULL WHERE id=$1",[queue.id]);queue.state='PENDING';recovered=true
    }
    if(queue.state!=='PENDING'||(o.notification_state!=='PENDING'&&!recovered))return null
    if((await c.query("SELECT id FROM daechion_orders.ready_receipts WHERE order_id=$1 AND state IN ('UNKNOWN','BLOCKED')",[id])).rows.length)return null
    const {noticeVersion:_notice,...raw}=o.contact_snapshot as Record<string,unknown>,contact=contactSchema.parse(raw)
    const titles=(await c.query('SELECT title FROM daechion_orders.items WHERE order_id=$1 ORDER BY product_id',[id])).rows.map(r=>String(r.title))
    let text=lmsText(contact.studentName,titles.length===1?titles[0]:`${titles[0]} 외 ${titles.length-1}개 상품`)
    if(Buffer.byteLength(text,'utf8')>2000)text=lmsText(contact.studentName,`${titles.length}개 상품`)
    const token=randomUUID()
    await c.query("UPDATE daechion_orders.jobs SET state='RUNNING',attempts=attempts+1,lease_token=$2,lease_until=now()+interval '120 seconds',last_error=NULL WHERE id=$1",[queue.id,token])
    for(const phone of new Set([contact.studentPhone,contact.guardianPhone].filter(Boolean)))await c.query(`INSERT INTO daechion_orders.ready_receipts(id,order_id,phone,text_snapshot) VALUES($1,$2,$3,$4) ON CONFLICT(order_id,phone) DO NOTHING`,[randomUUID(),id,phone,text])
    return {id:String(queue.id),token}
  }))
  if(!job)return 'SKIPPED'
  const receipts=await ports.withClient(async c=>(await c.query('SELECT * FROM daechion_orders.ready_receipts WHERE order_id=$1 ORDER BY phone',[id])).rows)
  for(const receipt of receipts){
    if(receipt.state!=='PENDING')continue
    const claimed=await ports.withClient(c=>orderTransaction(c,async()=>{
      await lockOrder(c,id)
      if(!await contentReady(c,id))return false
      const current=await c.query("SELECT id FROM daechion_orders.jobs WHERE id=$1 AND state='RUNNING' AND lease_token=$2 AND lease_until>now()",[job.id,job.token])
      if(!current.rows.length)return false
      // Uncertainty is durable before each individual recipient's external call.
      return (await c.query("UPDATE daechion_orders.ready_receipts SET state='UNKNOWN' WHERE id=$1 AND state='PENDING' RETURNING id",[receipt.id])).rows.length>0
    }))
    if(!claimed)break
    let result:{accepted:boolean;messageId?:string}={accepted:false}
    try{result=await ports.message.send({receiptId:String(receipt.id),phone:String(receipt.phone),text:String(receipt.text_snapshot)})}catch{}
    if(result.accepted===true&&typeof result.messageId==='string'&&result.messageId.length>0&&result.messageId.length<=120){
      await ports.withClient(c=>c.query("UPDATE daechion_orders.ready_receipts SET state='SENT',provider_message_id=$2,accepted_at=now() WHERE id=$1 AND state='UNKNOWN'",[receipt.id,result.messageId]))
    }else break
  }
  return ports.withClient(c=>orderTransaction(c,async()=>{
    await lockOrder(c,id)
    const current=await c.query("SELECT id FROM daechion_orders.jobs WHERE id=$1 AND state='RUNNING' AND lease_token=$2 AND lease_until>now()",[job.id,job.token])
    if(!current.rows.length){
      await c.query("UPDATE daechion_orders.ready_receipts SET state='BLOCKED' WHERE order_id=$1 AND state='PENDING'",[id]);return 'UNKNOWN'
    }
    const states=(await c.query('SELECT state FROM daechion_orders.ready_receipts WHERE order_id=$1',[id])).rows
    const success=states.length>0&&states.every(r=>r.state==='SENT')&&await contentReady(c,id)
    await c.query('UPDATE daechion_orders.jobs SET state=$3,last_error=$4,lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2',[job.id,job.token,success?'DONE':'UNKNOWN',success?null:'message_result_unknown'])
    if(!success)await c.query("UPDATE daechion_orders.ready_receipts SET state='BLOCKED' WHERE order_id=$1 AND state='PENDING'",[id])
    await c.query('UPDATE daechion_orders.orders SET notification_state=$2 WHERE id=$1',[id,success?'SENT':'UNKNOWN'])
    await orderChanged(c,id,success?'message_accepted':'message_unknown')
    return success?'SENT':'UNKNOWN'
  }))
}
export async function sendOrderReady(id:string,enabled:boolean,ports:MessagePorts){
  if(!enabled)return 'DISABLED'
  z.string().uuid().parse(id)
  try{return await send(id,ports)}catch{return 'UNKNOWN'}
}
