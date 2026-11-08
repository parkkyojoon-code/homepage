import type {LedgerClient} from '../ledger'
import {contextFromOrder,reviewContext,reviewEvidenceSchema,type ReviewEvidence} from './manual-review'

export function identityRecoveryAllowed(o:Record<string,unknown>){
  return o.checkout_state==='REVIEW'&&o.payment_state==='PAID'&&o.identity_state==='REVIEW'&&
    ['identity_create_unknown','identity_unknown'].includes(String(o.review_code))&&o.identity_write_started===true&&
    !o.identity_token&&Boolean(o.confirmed_at)&&!o.identity_recovery_action_id
}
// Records a read-only reconciliation. Billing and grants remain held until a
// separate current-payment read; the original create-attempt flag is preserved.
export async function reconcileIdentity(c:LedgerClient,o:Record<string,unknown>,studentId:number,requestKey:string,raw:ReviewEvidence){
  if(!identityRecoveryAllowed(o)||o.student_id!==null&&Number(o.student_id)!==studentId)return false
  if((await c.query("SELECT 1 FROM daechion_orders.grants WHERE order_id=$1 AND (state<>'PENDING' OR enrollment_recorded)",[o.id])).rows.length)return false
  const e=reviewEvidenceSchema.parse(raw),age=Date.now()-Date.parse(e.checkedAt)
  const context=await contextFromOrder(c,String(o.tenant_id),String(o.id)),bound=reviewContext(context!)
  if(age<0||age>60000||e.studentId!==studentId||e.binding!==bound.binding||JSON.stringify(e.targetIds)!==JSON.stringify(bound.targetIds))return false
  await c.query(`UPDATE daechion_orders.orders SET identity_state='PASSED',student_id=$2,identity_recovery_action_id=$3,
    review_code='identity_reconciled' WHERE id=$1`,[o.id,studentId,requestKey])
  await c.query('DELETE FROM daechion_orders.phone_claims WHERE order_id=$1',[o.id])
  return true
}
