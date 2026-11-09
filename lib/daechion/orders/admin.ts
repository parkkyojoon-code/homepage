import {createHash} from 'node:crypto'
import {z} from 'zod'
import type {LedgerClient} from '../ledger'
import {orderTransaction,lockOrder,holdOrder,orderChanged} from './worker-store'
import {retryRecordedAccessInTransaction} from './enrollment'
import {contextFromOrder,reviewContext,reviewEvidenceSchema,latestReview,type ReviewEvidence} from './manual-review'
import {paidRecoveryAllowed,resumePaid,type PaidEvidence} from './paid-recovery'
import {queueSheetRecovery} from './sheet-recovery'
import {recordManualAccess,type AccessEvidence} from './manual-access'
import {identityRecoveryAllowed,reconcileIdentity} from './identity-recovery'
import {unattemptedIntake,intakeUntouched,validateNewIntake,type IntakeEvidence} from './intake-review'

const text=(max:number)=>z.string().trim().min(1).max(max).regex(/^[^\u0000-\u001f\u007f]+$/)
const reason=z.string().trim().min(1).max(1000).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+$/)
const common={requestKey:z.string().uuid(),orderId:z.string().uuid(),expectedVersion:z.string().regex(/^[1-9]\d{0,18}$/),operatorName:text(80),reason,confirmed:z.literal(true)}
export const orderAdminActionSchema=z.discriminatedUnion('action',[
  z.object({...common,action:z.literal('RECONCILE_IDENTITY'),studentId:z.number().int().positive().safe(),confirmCreatedAccount:z.literal(true)}).strict(),
  z.object({...common,action:z.literal('CONFIRM_NEW_INTAKE'),confirmNewStudent:z.literal(true)}).strict(),
  z.object({...common,action:z.literal('CLOSE_INTAKE'),confirmClose:z.literal(true)}).strict(),
  z.object({...common,action:z.literal('HOLD')}).strict(),
  z.object({...common,action:z.literal('RETRY_ACCESS'),lectureId:z.number().int().positive().safe()}).strict(),
  z.object({...common,action:z.literal('APPROVE_EXISTING'),studentId:z.number().int().positive().safe(),
    targetIds:z.array(z.number().int().positive().safe()).min(1).max(30).refine(ids=>new Set(ids).size===ids.length),confirmNotOwned:z.literal(true)}).strict(),
  z.object({...common,action:z.literal('RESUME_UNBILLED')}).strict(),
  z.object({...common,action:z.literal('RESUME_PAID'),billId:z.string().regex(/^\d{20}$/),confirmPaid:z.literal(true)}).strict(),
  z.object({...common,action:z.literal('RECONCILE_SHEETS'),jobId:z.string().uuid(),confirmExistingRow:z.literal(true)}).strict(),
  z.object({...common,action:z.literal('MANUAL_ACCESS'),studentId:z.number().int().positive().safe(),lectureId:z.number().int().positive().safe(),
    confirmVideo:z.literal(true),confirmLessonMaterials:z.literal(true),confirmCourseMaterials:z.literal(true)}).strict(),
  z.object({...common,action:z.literal('RECORD_REVOKED'),studentId:z.number().int().positive().safe(),lectureId:z.number().int().positive().safe(),confirmRevoked:z.literal(true)}).strict(),
])
export type OrderAdminAction=z.infer<typeof orderAdminActionSchema>
export class OrderAdminError extends Error {
  constructor(public readonly code:'NOT_FOUND'|'STALE'|'CONFLICT'|'STATE'|'PAYMENT'){super(code)}
}
export const orderSearchSchema=z.object({q:z.string().trim().max(80).default(''),reviewOnly:z.boolean().default(false),page:z.number().int().min(0).max(1000).default(0)}).strict()
export async function replayOrderAction(c:LedgerClient,tenantId:string,input:OrderAdminAction){
  const fingerprint=createHash('sha256').update(JSON.stringify(input)).digest('hex')
  const row=(await c.query(`SELECT a.fingerprint,a.after_version::text,o.tenant_id FROM daechion_orders.admin_actions a
    JOIN daechion_orders.orders o ON o.id=a.order_id WHERE a.request_key=$1`,[input.requestKey])).rows[0]
  if(!row)return null
  if(row.tenant_id!==tenantId||row.fingerprint!==fingerprint)throw new OrderAdminError('CONFLICT')
  return {replayed:true,version:String(row.after_version)}
}
export async function listOrders(c:LedgerClient,tenantId:string,raw:unknown={}){
  const input=orderSearchSchema.parse(raw),phone=input.q.replace(/[\s-]/g,'')
  const result=await c.query(`SELECT o.id,o.contact_snapshot->>'studentName' AS student_name,o.student_phone,o.total_won,
    o.checkout_state,o.payment_state,o.identity_state,o.notification_state,o.review_code,o.version::text,o.created_at,
    (SELECT string_agg(i.title,' · ' ORDER BY i.product_id) FROM daechion_orders.items i WHERE i.order_id=o.id) AS titles
    FROM daechion_orders.orders o WHERE o.tenant_id=$1
    AND ($2='' OR strpos(lower(o.contact_snapshot->>'studentName'),lower($2))>0
      OR strpos(lower(o.contact_snapshot->>'guardianName'),lower($2))>0
      OR ($3<>'' AND (strpos(o.student_phone,$3)>0 OR strpos(o.contact_snapshot->>'guardianPhone',$3)>0 OR strpos(o.contact_snapshot->>'payerPhone',$3)>0)))
    AND (NOT $4::boolean OR o.checkout_state='REVIEW' OR o.identity_state='REVIEW' OR (o.review_code IS NOT NULL AND o.review_code<>'intake_closed')
      OR EXISTS(SELECT 1 FROM daechion_orders.scheduler_orders s WHERE s.order_id=o.id AND s.session_issue)
      OR o.notification_state IN ('UNKNOWN','FAILED') OR EXISTS(SELECT 1 FROM daechion_orders.grants g WHERE g.order_id=o.id AND g.state='REVIEW')
      OR EXISTS(SELECT 1 FROM daechion_orders.jobs j WHERE j.order_id=o.id AND j.state IN ('UNKNOWN','FAILED')))
    ORDER BY o.created_at DESC,o.id DESC LIMIT 51 OFFSET $5`,[tenantId,input.q,phone,input.reviewOnly,input.page*50])
  return {rows:result.rows.slice(0,50),hasMore:result.rows.length>50,page:input.page}
}
export async function orderDetail(c:LedgerClient,tenantId:string,id:string){
  z.string().uuid().parse(id)
  const order=(await c.query(`SELECT id,tenant_id,contact_snapshot,total_won,checkout_state,payment_state,identity_state,student_id,
    notification_state,review_code,version::text,created_at,paid_at FROM daechion_orders.orders WHERE id=$1 AND tenant_id=$2`,[id,tenantId])).rows[0]
  if(!order)return null
  const items=(await c.query('SELECT product_id,title,sale_kind,price_won FROM daechion_orders.items WHERE order_id=$1 ORDER BY product_id',[id])).rows
  const bills=(await c.query('SELECT bill_id,amount_won,state,is_current,sent_at,due_at,checked_at,last_payment_state FROM daechion_orders.bills WHERE order_id=$1 ORDER BY revision DESC',[id])).rows
  const grants=(await c.query(`SELECT g.lecture_id::text,g.state,g.review_code,g.enrollment_recorded,g.verified_at,g.revoked_at,g.weekly_ids,
    (g.state='REVIEW' AND g.enrollment_recorded AND jsonb_array_length(g.weekly_ids)=1
      AND o.identity_state='PASSED' AND daechion_orders.paid_eligible(o.id)) AS can_retry
    FROM daechion_orders.grants g JOIN daechion_orders.orders o ON o.id=g.order_id WHERE g.order_id=$1 ORDER BY g.lecture_id`,[id])).rows
  const messages=(await c.query('SELECT phone,state,accepted_at FROM daechion_orders.ready_receipts WHERE order_id=$1 ORDER BY phone',[id])).rows
  const jobs=(await c.query('SELECT id,kind,state,attempts,last_error,event_version::text FROM daechion_orders.jobs WHERE order_id=$1 ORDER BY event_version DESC,kind LIMIT 100',[id])).rows
  const actions=(await c.query('SELECT action,lecture_id::text,student_id::text,target_ids,recovery_evidence,operator_name,reason,before_version::text,after_version::text,created_at FROM daechion_orders.admin_actions WHERE order_id=$1 ORDER BY created_at DESC,request_key DESC LIMIT 100',[id])).rows
  const workerStatus=(await c.query('SELECT session_issue,started_at,finished_at,result,next_run_at FROM daechion_orders.scheduler_orders WHERE order_id=$1',[id])).rows[0]??null
  const recoveries=(await c.query('SELECT request_key,job_id,state,result_code,created_at FROM daechion_orders.sheet_recoveries WHERE order_id=$1 ORDER BY created_at DESC,request_key DESC LIMIT 10',[id])).rows
  const sheetBlockers=(await c.query("SELECT id,state FROM daechion_orders.jobs WHERE order_id=$1 AND kind='SHEETS' AND state IN ('UNKNOWN','RUNNING')",[id])).rows
  const activeRecovery=(await c.query("SELECT request_key FROM daechion_orders.sheet_recoveries WHERE order_id=$1 AND state IN ('PENDING','RUNNING')",[id])).rows.length>0
  const sheetRecoveryJobId=!activeRecovery&&sheetBlockers.length===1&&sheetBlockers[0].state==='UNKNOWN'?String(sheetBlockers[0].id):null
  const status=(await c.query('SELECT identity_write_started,identity_token,confirmed_at,identity_recovery_action_id,intake_action_id,closed_action_id FROM daechion_orders.orders WHERE id=$1',[id])).rows[0]
  const untouched=unattemptedIntake({...order,...status})&&await intakeUntouched(c,id)
  const manualIdentity=order.identity_state==='PASSED'&&!status.identity_token&&!grants.some(g=>g.state==='RUNNING')
  const paidCurrent=(await c.query('SELECT daechion_orders.paid_eligible($1) AS ok',[id])).rows[0].ok===true
  const manualGrantIds=manualIdentity&&paidCurrent?grants.filter(g=>['PENDING','REVIEW'].includes(String(g.state))).map(g=>String(g.lecture_id)):[]
  const manualRevokeIds=manualIdentity?grants.filter(g=>g.state!=='REVOKED').map(g=>String(g.lecture_id)):[]
  const reviewed=await latestReview(c,id),age=reviewed?Date.now()-Date.parse(reviewed.checkedAt):0
  const unbilled=order.payment_state==='PENDING'&&!bills.length&&order.student_id===null&&!status.identity_write_started&&!status.identity_token&&order.identity_state==='WAITING'&&['READY','REVIEW'].includes(String(order.checkout_state))
  return {order,items,bills,grants,messages,jobs,actions,recoveries,workerStatus,manualGrantIds,manualRevokeIds,sheetRecoveryJobId,canReconcileSheets:sheetRecoveryJobId!==null,
    canCloseIntake:untouched,canConfirmNewIntake:untouched&&!reviewed&&order.checkout_state==='REVIEW'&&(order.contact_snapshot as {studentHistory?:string}).studentHistory==='NEW',
    canReconcileIdentity:identityRecoveryAllowed({...order,...status})&&grants.length>0&&grants.every(g=>g.state==='PENDING'&&!g.enrollment_recorded),
    canResumePaid:!grants.some(g=>g.state==='REVOKED')&&paidRecoveryAllowed({...order,...status})&&bills.some(b=>b.is_current&&b.state==='SENT'),canHold:order.checkout_state!=='DRAFT'&&!status.closed_action_id,canApproveExisting:unbilled,
    canResumeUnbilled:unbilled&&order.checkout_state==='REVIEW'&&order.review_code==='admin_hold'&&status.confirmed_at!==null&&(!reviewed||age>=0&&age<=15*60000)}
}
export async function applyOrderAdminAction(c:LedgerClient,tenantId:string,raw:unknown,evidence?:ReviewEvidence,payment?:PaidEvidence,access?:AccessEvidence,intakeEvidence?:IntakeEvidence){
  const input=orderAdminActionSchema.parse(raw)
  const fingerprint=createHash('sha256').update(JSON.stringify(input)).digest('hex')
  return orderTransaction(c,async()=>{
    await c.query('SELECT pg_advisory_xact_lock(61132,hashtext($1))',[input.requestKey])
    const previous=await replayOrderAction(c,tenantId,input)
    if(previous)return previous
    const order=await lockOrder(c,input.orderId)
    if(!order||order.tenant_id!==tenantId)throw new OrderAdminError('NOT_FOUND')
    if(String(order.version)!==input.expectedVersion)throw new OrderAdminError('STALE')
    let review:ReviewEvidence|undefined
    let intake:IntakeEvidence|undefined
    if(order.closed_action_id&&input.action!=='RECONCILE_SHEETS')throw new OrderAdminError('STATE')
    if(input.action==='CLOSE_INTAKE'&&(!unattemptedIntake(order)||!await intakeUntouched(c,input.orderId)))throw new OrderAdminError('STATE')
    if(input.action==='CONFIRM_NEW_INTAKE'){
      const checked=await validateNewIntake(c,order,intakeEvidence);if(!checked)throw new OrderAdminError('STATE');intake=checked
    }
    if(input.action==='APPROVE_EXISTING'||input.action==='RESUME_UNBILLED'){
      if(order.payment_state!=='PENDING'||order.student_id!==null||order.identity_state!=='WAITING'||order.identity_write_started||order.identity_token||
        !['READY','REVIEW'].includes(String(order.checkout_state))||(await c.query('SELECT id FROM daechion_orders.bills WHERE order_id=$1',[input.orderId])).rows.length)throw new OrderAdminError('STATE')
      if(input.action==='RESUME_UNBILLED'){
        if(order.checkout_state!=='REVIEW'||order.review_code!=='admin_hold'||!order.confirmed_at)throw new OrderAdminError('STATE')
        // An expired existing-student attestation cannot be bypassed by a hold/resume.
        const prior=await latestReview(c,input.orderId)
        if(prior&&Date.now()-Date.parse(prior.checkedAt)>15*60000)throw new OrderAdminError('STATE')
      }else{
        review=reviewEvidenceSchema.parse(evidence)
        const context=await contextFromOrder(c,tenantId,input.orderId),bound=reviewContext(context!)
        const age=Date.now()-Date.parse(review.checkedAt),ids=[...input.targetIds].sort((a,b)=>a-b)
        if(age<0||age>60000||review.studentId!==input.studentId||review.binding!==bound.binding||
          JSON.stringify(review.targetIds)!==JSON.stringify(bound.targetIds)||JSON.stringify(ids)!==JSON.stringify(bound.targetIds))throw new OrderAdminError('STATE')
      }
    }
    if(input.action==='RECONCILE_IDENTITY')review=reviewEvidenceSchema.parse(evidence)
    const nextVersion=(BigInt(input.expectedVersion)+1n).toString()
    const recoveryEvidence=input.action==='RESUME_PAID'?{billId:payment?.billId,amountWon:payment?.amountWon,paidAt:payment?.paidAt,checkedAt:payment?.checkedAt}:
      input.action==='RECONCILE_SHEETS'?{jobId:input.jobId}:input.action==='MANUAL_ACCESS'||input.action==='RECORD_REVOKED'?
        {studentId:access?.studentId,lectureId:access?.lectureId,weeklyLectureIds:access?.weeklyLectureIds,checkedAt:access?.checkedAt,profileFingerprint:access?.profileFingerprint,contextFingerprint:access?.binding,requestFingerprint:order.request_fingerprint}:{}
    const writeAudit=()=>c.query(`INSERT INTO daechion_orders.admin_actions(request_key,order_id,fingerprint,action,lecture_id,operator_name,reason,before_version,after_version,
      student_id,profile_fingerprint,context_fingerprint,order_request_fingerprint,target_ids,checked_at,recovery_evidence)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16::jsonb)`,[input.requestKey,input.orderId,fingerprint,input.action,'lectureId' in input?input.lectureId:null,
      input.operatorName,input.reason,input.expectedVersion,nextVersion,review?.studentId??null,review?.profileFingerprint??null,review?.binding??intake?.binding??null,review||intake?order.request_fingerprint:null,JSON.stringify(review?.targetIds??intake?.targetIds??[]),review?.checkedAt??intake?.checkedAt??null,JSON.stringify(recoveryEvidence)])
    const auditFirst=['APPROVE_EXISTING','RECONCILE_IDENTITY','CONFIRM_NEW_INTAKE','CLOSE_INTAKE','MANUAL_ACCESS','RECORD_REVOKED'].includes(input.action)
    if((input.action==='MANUAL_ACCESS'||input.action==='RECORD_REVOKED')&&!access)throw new OrderAdminError('STATE')
    if((input.action==='MANUAL_ACCESS'||input.action==='RECORD_REVOKED')&&!(await c.query('SELECT 1 FROM daechion_orders.grants WHERE order_id=$1 AND lecture_id=$2',[input.orderId,input.lectureId])).rows.length)throw new OrderAdminError('STATE')
    if(auditFirst)await writeAudit()
    if(input.action==='CONFIRM_NEW_INTAKE'){
      await c.query("UPDATE daechion_orders.orders SET intake_action_id=$2,checkout_state='READY',review_code=NULL WHERE id=$1",[input.orderId,input.requestKey])
      await orderChanged(c,input.orderId,'new_intake_confirmed')
    }else if(input.action==='CLOSE_INTAKE'){
      await c.query("UPDATE daechion_orders.orders SET closed_action_id=$2,checkout_state='CLOSED',review_code='intake_closed' WHERE id=$1",[input.orderId,input.requestKey])
      await c.query("UPDATE daechion_orders.quotes SET state='EXPIRED' WHERE id=$1 AND state IN ('READY','REVIEW')",[order.quote_id])
      await c.query('DELETE FROM daechion_orders.phone_claims WHERE order_id=$1',[input.orderId])
      await orderChanged(c,input.orderId,'intake_closed')
    }else if(input.action==='RECONCILE_IDENTITY'){
      if(!review||!await reconcileIdentity(c,order,input.studentId,input.requestKey,review))throw new OrderAdminError('STATE')
      await orderChanged(c,input.orderId,'identity_reconciled')
    }else if(input.action==='HOLD'){
      if(order.checkout_state==='DRAFT')throw new OrderAdminError('STATE')
      await holdOrder(c,input.orderId,'admin_hold')
    }else if(input.action==='RETRY_ACCESS'){
      if(!await retryRecordedAccessInTransaction(c,input))throw new OrderAdminError('STATE')
    }else if(input.action==='RESUME_PAID'){
      if(!payment||input.billId!==payment.billId||!await resumePaid(c,order,payment))throw new OrderAdminError('STATE')
      await orderChanged(c,input.orderId,'paid_order_resumed')
    }else if(input.action==='RECONCILE_SHEETS'){
      if(!await queueSheetRecovery(c,input.orderId,input.jobId,input.requestKey))throw new OrderAdminError('STATE')
      await orderChanged(c,input.orderId,'sheet_recovery_requested')
    }else if(input.action==='MANUAL_ACCESS'||input.action==='RECORD_REVOKED'){
      if(!await recordManualAccess(c,order,input,access,input.action==='RECORD_REVOKED'))throw new OrderAdminError('STATE')
      if(input.action==='RECORD_REVOKED')await holdOrder(c,input.orderId,'manual_access_revoked')
      else await orderChanged(c,input.orderId,'manual_access_recorded')
    }else{
      await c.query("UPDATE daechion_orders.orders SET checkout_state='READY',review_code=NULL WHERE id=$1",[input.orderId])
      await orderChanged(c,input.orderId,input.action==='APPROVE_EXISTING'?'existing_review_approved':'unbilled_order_resumed')
    }
    const version=String((await c.query('SELECT version::text FROM daechion_orders.orders WHERE id=$1',[input.orderId])).rows[0].version)
    if(version!==nextVersion)throw new OrderAdminError('STATE')
    if(!auditFirst)await writeAudit()
    return {replayed:false,version}
  })
}
