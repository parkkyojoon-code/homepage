import {z} from 'zod'
import type {LedgerClient} from '../ledger'
import type {PaymentProvider} from '../payssam'

const iso=z.string().datetime({offset:true}),time=(value:unknown)=>value==null?NaN:new Date(value as string).getTime()
export const billRecoveryEvidenceSchema=z.object({
  orderId:z.string().uuid(),tenantId:z.string().min(1),version:z.string().regex(/^[1-9]\d*$/),
  requestFingerprint:z.string().regex(/^[a-f0-9]{64}$/),recordId:z.string().uuid(),token:z.string().nullable(),
  accountId:z.string().min(1).max(100),billId:z.string().regex(/^\d{20}$/),amountWon:z.number().int().positive().max(2147483647),
  attemptedAt:iso,paidAt:iso,checkedAt:iso,
}).strict()
export type BillRecoveryEvidence=z.infer<typeof billRecoveryEvidenceSchema>
export interface BillRecoveryContext {
  orderId:string;tenantId:string;version:string;requestFingerprint:string;totalWon:number
  bill:{id:string;bill_id:string;provider_account:string;amount_won:number;attemptedAt:string;token:string|null}
}
export function billRecoveryAllowed(order:Record<string,unknown>){
  return order.checkout_state==='REVIEW'&&order.review_code==='bill_send_unknown'&&['PENDING','UNKNOWN'].includes(String(order.payment_state))&&
    order.identity_state==='WAITING'&&order.student_id===null&&!order.identity_write_started&&!order.identity_token&&
    !order.closed_action_id&&!order.identity_recovery_action_id&&Boolean(order.confirmed_at)&&!order.paid_at
}
async function untouched(c:LedgerClient,id:string){
  return !(await c.query(`SELECT 1 FROM daechion_orders.grants WHERE order_id=$1 AND
      (state<>'PENDING' OR enrollment_recorded OR lease_token IS NOT NULL OR weekly_ids<>'[]'::jsonb)
    UNION ALL SELECT 1 FROM daechion_orders.ready_receipts WHERE order_id=$1 LIMIT 1`,[id])).rows.length
}
// The original dispatch timestamp is a database fact. In particular, it is not
// the time an operator opens this screen or confirms recovery seven days later.
export async function billRecoveryContext(c:LedgerClient,tenantId:string,id:string,version:string,billId:string):Promise<BillRecoveryContext|null>{
  z.string().uuid().parse(id);z.string().regex(/^[1-9]\d*$/).parse(version);z.string().regex(/^\d{20}$/).parse(billId)
  const order=(await c.query('SELECT * FROM daechion_orders.orders WHERE id=$1 AND tenant_id=$2',[id,tenantId])).rows[0]
  if(!order||String(order.version)!==version||!billRecoveryAllowed(order)||!await untouched(c,id))return null
  const bill=(await c.query(`SELECT id,bill_id,provider_account,amount_won,checked_at::text AS token,
      to_char(send_attempted_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "attemptedAt"
    FROM daechion_orders.bills WHERE order_id=$1 AND bill_id=$2 AND is_current AND state='SEND_UNKNOWN'
      AND sent_at IS NULL AND due_at IS NULL AND send_attempted_at IS NOT NULL AND send_recovery_action_id IS NULL`,[id,billId])).rows[0]
  if(!bill||Number(bill.amount_won)!==Number(order.total_won)||!Number.isFinite(time(bill.attemptedAt)))return null
  return {orderId:id,tenantId,version,requestFingerprint:String(order.request_fingerprint),totalWon:Number(order.total_won),bill:{
    id:String(bill.id),bill_id:String(bill.bill_id),provider_account:String(bill.provider_account),amount_won:Number(bill.amount_won),
    attemptedAt:String(bill.attemptedAt),token:bill.token===null?null:String(bill.token),
  }}
}
export async function inspectBillRecovery(context:BillRecoveryContext,provider:PaymentProvider):Promise<BillRecoveryEvidence|null>{
  if(provider.accountId!==context.bill.provider_account)return null
  const started=Date.now()
  let raw:unknown
  try{raw=await provider.read(context.bill.bill_id)}catch{return null}
  const parsed=z.object({state:z.literal('F'),billId:z.string().regex(/^\d{20}$/),amountWon:z.number().int().positive(),paidAt:iso}).strict().safeParse(raw)
  if(!parsed.success)return null
  const observed=parsed.data,approved=time(observed.paidAt),attempted=time(context.bill.attemptedAt),now=Date.now()
  if(now-started<0||now-started>60000||!Number.isFinite(attempted)||attempted>now+5000||
    observed.billId!==context.bill.bill_id||observed.amountWon!==context.totalWon||observed.amountWon!==context.bill.amount_won||
    approved<attempted-60000||approved>attempted+7*86400000||approved>now+60000)return null
  return billRecoveryEvidenceSchema.parse({orderId:context.orderId,tenantId:context.tenantId,version:context.version,
    requestFingerprint:context.requestFingerprint,recordId:context.bill.id,token:context.bill.token,accountId:provider.accountId,
    billId:observed.billId,amountWon:observed.amountWon,attemptedAt:context.bill.attemptedAt,paidAt:observed.paidAt,checkedAt:new Date().toISOString()})
}
// Caller owns the order lock and has inserted the immutable RECONCILE_BILL
// audit. This function never resends a bill or changes an LMS account/permission.
export async function reconcileBill(c:LedgerClient,order:Record<string,unknown>,requestKey:string,raw:BillRecoveryEvidence):Promise<boolean>{
  if(!billRecoveryAllowed(order)||!await untouched(c,String(order.id)))return false
  const proof=billRecoveryEvidenceSchema.parse(raw),age=Date.now()-time(proof.checkedAt),approved=time(proof.paidAt),attempted=time(proof.attemptedAt)
  if(age<0||age>60000||proof.orderId!==order.id||proof.tenantId!==order.tenant_id||proof.version!==String(order.version)||
    proof.requestFingerprint!==order.request_fingerprint||proof.amountWon!==Number(order.total_won)||
    attempted>Date.now()+5000||approved<attempted-60000||approved>attempted+7*86400000||approved>Date.now()+60000)return false
  const bill=(await c.query(`SELECT *,to_char(send_attempted_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "attemptedAt"
    FROM daechion_orders.bills WHERE id=$1 AND order_id=$2 AND is_current AND state='SEND_UNKNOWN'
      AND provider_account=$3 AND bill_id=$4 AND checked_at IS NOT DISTINCT FROM $5::timestamptz
      AND sent_at IS NULL AND due_at IS NULL AND send_attempted_at IS NOT NULL AND send_recovery_action_id IS NULL FOR UPDATE`,
    [proof.recordId,order.id,proof.accountId,proof.billId,proof.token])).rows[0]
  if(!bill||Number(bill.amount_won)!==proof.amountWon||bill.attemptedAt!==proof.attemptedAt)return false
  await c.query('SELECT pg_advisory_xact_lock(61130,hashtext($1))',[proof.accountId+'|'+proof.billId])
  if((await c.query('SELECT id FROM daechion_automation.bills WHERE provider_account=$1 AND bill_id=$2',[proof.accountId,proof.billId])).rows.length)return false
  await c.query(`UPDATE daechion_orders.bills SET state='SENT',send_recovery_action_id=$2,sent_at=send_attempted_at,
      due_at=send_attempted_at+interval '7 days',last_payment_state='PAID',
      checked_at=GREATEST(clock_timestamp(),COALESCE(checked_at+interval '1 microsecond',clock_timestamp())) WHERE id=$1`,[bill.id,requestKey])
  await c.query("UPDATE daechion_orders.orders SET checkout_state='REVIEW',payment_state='PAID',paid_at=$2,review_code='bill_reconciled' WHERE id=$1",[order.id,proof.paidAt])
  return true
}
