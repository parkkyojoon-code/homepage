import {z} from 'zod'
import {randomUUID} from 'node:crypto'
import type {LedgerClient} from '../ledger'
import type {PaymentProvider} from '../payssam'

const iso=z.string().datetime({offset:true}),time=(v:unknown)=>v==null?NaN:new Date(v as string).getTime()
export const paidEvidenceSchema=z.object({orderId:z.string().uuid(),tenantId:z.string().min(1),version:z.string().regex(/^[1-9]\d*$/),
  requestFingerprint:z.string().regex(/^[a-f0-9]{64}$/),recordId:z.string().uuid(),token:z.string().nullable(),
  accountId:z.string().min(1).max(100),billId:z.string().regex(/^\d{20}$/),amountWon:z.number().int().positive().max(2147483647),paidAt:iso,checkedAt:iso}).strict()
export type PaidEvidence=z.infer<typeof paidEvidenceSchema>
export interface PaidContext {orderId:string;tenantId:string;version:string;requestFingerprint:string;totalWon:number;paymentState:string;paidAt:string|null;
  bill:{id:string;bill_id:string;provider_account:string;amount_won:number;state:string;sent_at:unknown;due_at:unknown;token:string|null}}
export async function paidContext(c:LedgerClient,tenantId:string,id:string,version:string,billId:string):Promise<PaidContext|null>{
  const o=(await c.query('SELECT id,version,request_fingerprint,total_won,payment_state,paid_at FROM daechion_orders.orders WHERE id=$1 AND tenant_id=$2',[id,tenantId])).rows[0]
  if(!o||String(o.version)!==version)return null
  const bill=(await c.query(`SELECT id,bill_id,provider_account,amount_won,state,sent_at,due_at,checked_at::text AS token FROM daechion_orders.bills
    WHERE order_id=$1 AND bill_id=$2 AND is_current`,[id,billId])).rows[0]
  if(!bill)return null
  return {orderId:id,tenantId,version,requestFingerprint:String(o.request_fingerprint),totalWon:Number(o.total_won),paymentState:String(o.payment_state),paidAt:o.paid_at?new Date(o.paid_at as string).toISOString():null,bill:bill as unknown as PaidContext['bill']}
}
export async function inspectPaid(context:PaidContext,provider:PaymentProvider):Promise<PaidEvidence|null>{
  if(context.paymentState==='CANCELLED'||context.bill.state!=='SENT'||provider.accountId!==context.bill.provider_account)return null
  const started=Date.now()
  let raw:unknown
  try{raw=await provider.read(context.bill.bill_id)}catch{return null}
  const result=z.object({state:z.literal('F'),billId:z.string().regex(/^\d{20}$/),amountWon:z.number().int().positive(),paidAt:iso}).strict().safeParse(raw)
  if(!result.success)return null
  const p=result.data,approved=Date.parse(p.paidAt),now=Date.now()
  if(now-started>60000||p.billId!==context.bill.bill_id||p.amountWon!==context.totalWon||p.amountWon!==Number(context.bill.amount_won)||
    !Number.isFinite(time(context.bill.sent_at))||!Number.isFinite(time(context.bill.due_at))||approved>now+60000||approved<time(context.bill.sent_at)-60000||
    approved>time(context.bill.due_at)||context.paidAt!==null&&Date.parse(context.paidAt)!==approved)return null
  return paidEvidenceSchema.parse({orderId:context.orderId,tenantId:context.tenantId,version:context.version,requestFingerprint:context.requestFingerprint,
    recordId:context.bill.id,token:context.bill.token,accountId:provider.accountId,billId:p.billId,amountWon:p.amountWon,paidAt:p.paidAt,checkedAt:new Date().toISOString()})
}
const recoverable=new Set(['identity_reconciled','admin_hold','payment_query_unknown','unpaid_wait_closed','payment_amount_mismatch','payment_time_unknown','payment_evidence_changed','payment_regressed','worker_execution_unknown'])
export function paidRecoveryAllowed(o:Record<string,unknown>){
  return ['REVIEW','CLOSED'].includes(String(o.checkout_state))&&recoverable.has(String(o.review_code))&&o.payment_state!=='CANCELLED'&&
    ['WAITING','PASSED'].includes(String(o.identity_state))&&!o.identity_token&&(!o.identity_write_started||o.identity_state==='PASSED')&&Boolean(o.confirmed_at)
}
// Caller owns the order row lock and its audit transaction. Never calls a provider.
export async function resumePaid(c:LedgerClient,o:Record<string,unknown>,raw:unknown){
  if(!paidRecoveryAllowed(o))return false
  if((await c.query("SELECT 1 FROM daechion_orders.grants WHERE order_id=$1 AND state='REVOKED'",[o.id])).rows.length)return false
  const e=paidEvidenceSchema.parse(raw),age=Date.now()-Date.parse(e.checkedAt)
  if(age<0||age>60000||e.orderId!==o.id||e.tenantId!==o.tenant_id||e.version!==String(o.version)||e.requestFingerprint!==o.request_fingerprint||
    e.amountWon!==Number(o.total_won)||o.paid_at&&time(o.paid_at)!==Date.parse(e.paidAt))return false
  const bill=(await c.query(`SELECT * FROM daechion_orders.bills WHERE id=$1 AND order_id=$2 AND is_current AND state='SENT'
    AND provider_account=$3 AND bill_id=$4 AND checked_at IS NOT DISTINCT FROM $5::timestamptz FOR UPDATE`,[e.recordId,o.id,e.accountId,e.billId,e.token])).rows[0]
  if(!bill||Number(bill.amount_won)!==e.amountWon||!Number.isFinite(time(bill.sent_at))||!Number.isFinite(time(bill.due_at))||
    Date.parse(e.paidAt)<time(bill.sent_at)-60000||Date.parse(e.paidAt)>time(bill.due_at)||Date.parse(e.paidAt)>Date.now()+60000)return false
  await c.query('SELECT pg_advisory_xact_lock(61130,hashtext($1))',[e.accountId+'|'+e.billId])
  if((await c.query('SELECT id FROM daechion_automation.bills WHERE provider_account=$1 AND bill_id=$2',[e.accountId,e.billId])).rows.length)return false
  await c.query(`UPDATE daechion_orders.bills SET last_payment_state='PAID',checked_at=GREATEST(clock_timestamp(),COALESCE(checked_at+interval '1 microsecond',clock_timestamp())) WHERE id=$1`,[e.recordId])
  await c.query("UPDATE daechion_orders.orders SET checkout_state='READY',review_code=NULL,payment_state='PAID',paid_at=$2 WHERE id=$1",[o.id,e.paidAt])
  await queueUnattemptedNotice(c,o)
  return true
}
export async function queueUnattemptedNotice(c:LedgerClient,o:Record<string,unknown>){
  // A known never-attempted notice may resume. Unknown or blocked recipients never reset.
  const attempted=['UNKNOWN','SENT'].includes(String(o.notification_state))||(await c.query(`SELECT 1 FROM daechion_orders.ready_receipts WHERE order_id=$1 UNION ALL
    SELECT 1 FROM daechion_orders.jobs WHERE order_id=$1 AND kind='READY_MESSAGE' AND (attempts>0 OR state IN ('RUNNING','UNKNOWN','DONE')) LIMIT 1`,[o.id])).rows.length
  if(!attempted){
    const allReady=o.identity_state==='PASSED'&&(await c.query("SELECT 1 FROM daechion_orders.grants WHERE order_id=$1",[o.id])).rows.length>0&&
      !(await c.query("SELECT 1 FROM daechion_orders.grants WHERE order_id=$1 AND state NOT IN ('VERIFIED','MANUAL')",[o.id])).rows.length
    await c.query("UPDATE daechion_orders.orders SET notification_state=$2 WHERE id=$1 AND notification_state IN ('NOT_READY','FAILED')",[o.id,allReady?'PENDING':'NOT_READY'])
    if(allReady){
      await c.query("UPDATE daechion_orders.jobs SET state='PENDING',last_error=NULL,available_at=now() WHERE order_id=$1 AND kind='READY_MESSAGE' AND attempts=0 AND state='FAILED'",[o.id])
      await c.query("INSERT INTO daechion_orders.jobs(id,order_id,kind,event_version) VALUES($1,$2,'READY_MESSAGE',$3) ON CONFLICT DO NOTHING",[randomUUID(),o.id,(BigInt(String(o.version))+1n).toString()])
    }
  }
}
