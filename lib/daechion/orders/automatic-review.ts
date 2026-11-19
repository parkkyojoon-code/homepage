import {randomUUID} from 'node:crypto'
import {z} from 'zod'
import {resolveStudent} from '../identity'
import {normalizePhone,type DaechionStudent} from '../client'
import type {LedgerClient} from '../ledger'
import {applyOrderAdminAction,OrderAdminError} from './admin'
import {contextFromOrder,inspectExisting,reviewContext,studentProfileFingerprint} from './manual-review'
import type {BillingContext} from './billing'
import {holdOrder,lockOrder,orderTransaction,type OrderConnection} from './worker-store'
import type {ReadOnlyStudentPort} from './ownership'

export const AUTOMATIC_REVIEW_OPERATOR='시스템 자동 확인'
export const AUTOMATIC_REVIEW_REASON_PREFIX='자동 보유 강의 확인:'
export type AutomaticReviewOutcome='SKIPPED'|'APPROVED'|'OWNED'|'REVIEW'|'STALE'
export interface AutomaticOwnershipInput {studentId:number;studentName:string;studentPhone:string;lectureIds:number[]}
export interface AutomaticOwnershipResult {studentId:number;lectures:{id:number;state:'OWNED'|'NOT_OWNED'}[]}
export interface AutomaticReviewPorts extends OrderConnection {
  tenantId:string
  api:ReadOnlyStudentPort&{student(id:number):Promise<DaechionStudent>}
  inspectOwnership(input:AutomaticOwnershipInput):Promise<AutomaticOwnershipResult>
}
const ownershipResult=z.object({studentId:z.number().int().positive().safe(),lectures:z.array(z.object({
  id:z.number().int().positive().safe(),state:z.enum(['OWNED','NOT_OWNED']),
}).strict()).min(1).max(30)}).strict()
const reasons=z.array(z.object({productId:z.string(),code:z.literal('OWNERSHIP_UNKNOWN')}).strict()).min(1).max(30)
const fresh=(started:number)=>{const elapsed=Date.now()-started;return elapsed>=0&&elapsed<=60000}

// An existing-student quote can only leave its initial review automatically.
// Human actions, provider attempts and uncertain results belong to their
// existing recovery paths, even when all the current ownership reads succeed.
async function candidate(c:LedgerClient,tenantId:string,id:string,version?:string):Promise<BillingContext|null>{
  const row=(await c.query(`SELECT o.version::text,q.snapshot FROM daechion_orders.orders o
    JOIN daechion_orders.quotes q ON q.id=o.quote_id
    WHERE o.id=$1 AND o.tenant_id=$2 AND ($3::text IS NULL OR o.version::text=$3)
      AND o.checkout_state='REVIEW' AND o.review_code IS NULL AND o.confirmed_at IS NULL
      AND o.payment_state='PENDING' AND o.identity_state='WAITING' AND o.student_id IS NULL
      AND NOT o.identity_write_started AND o.identity_token IS NULL AND o.identity_until IS NULL
      AND o.intake_action_id IS NULL AND o.closed_action_id IS NULL AND o.identity_recovery_action_id IS NULL
      AND q.state='REVIEW' AND q.snapshot->>'existingStudent'='EXISTING'
      AND o.contact_snapshot->>'studentHistory'='EXISTING'
      AND NOT EXISTS(SELECT 1 FROM daechion_orders.bills WHERE order_id=o.id)
      AND NOT EXISTS(SELECT 1 FROM daechion_orders.ready_receipts WHERE order_id=o.id)
      AND NOT EXISTS(SELECT 1 FROM daechion_orders.admin_actions WHERE order_id=o.id)
      AND NOT EXISTS(SELECT 1 FROM daechion_orders.phone_claims WHERE order_id=o.id)
      AND EXISTS(SELECT 1 FROM daechion_orders.grants WHERE order_id=o.id)
      AND NOT EXISTS(SELECT 1 FROM daechion_orders.grants g WHERE g.order_id=o.id AND
        (g.state<>'PENDING' OR g.review_code IS NOT NULL OR g.enrollment_recorded OR g.weekly_ids<>'[]'::jsonb
          OR g.lease_token IS NOT NULL OR g.lease_until IS NOT NULL OR g.verified_at IS NOT NULL OR g.revoked_at IS NOT NULL))`,
    [id,tenantId,version??null])).rows[0]
  if(!row)return null
  const context=await contextFromOrder(c,tenantId,id,String(row.version))
  if(!context)return null
  const review=reasons.safeParse((row.snapshot as {reviewReasons?:unknown})?.reviewReasons)
  const productIds=context.items.map(item=>(item as {productId:string}).productId).sort()
  if(!review.success||new Set(review.data.map(reason=>reason.productId)).size!==review.data.length||
    JSON.stringify(review.data.map(reason=>reason.productId).sort())!==JSON.stringify(productIds))return null
  reviewContext(context)
  return context
}
async function readCandidate(ports:AutomaticReviewPorts,id:string,version?:string){
  return ports.withClient(async c=>{
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    try{const context=await candidate(c,ports.tenantId,id,version);await c.query('COMMIT');return context}
    catch(error){await c.query('ROLLBACK');throw error}
  })
}

// The server supplies both ports. No applicant-supplied ownership report, write
// endpoint, or guessed absence is accepted as a reason to send an invoice.
export async function autoReviewExistingOrder(id:string,ports:AutomaticReviewPorts):Promise<AutomaticReviewOutcome>{
  z.string().uuid().parse(id)
  if(!ports.tenantId.trim())throw Error('AUTOMATIC_REVIEW_TENANT_REQUIRED')
  const context=await readCandidate(ports,id)
  if(!context)return 'SKIPPED'
  const started=Date.now(),bound=reviewContext(context)
  let proof:Awaited<ReturnType<typeof inspectExisting>>,owned=false
  try{
    if(String((await ports.api.me()).tenantId)!==ports.tenantId)return 'REVIEW'
    const readonly={me:()=>ports.api.me(),students:(phone:string,name:string)=>ports.api.students(phone,name),
      student:(studentId:number)=>ports.api.student(studentId),createStudent:async()=>{throw Error('AUTOMATIC_REVIEW_CANNOT_CREATE')}}
    const selected=await resolveStudent(readonly,{name:bound.contact.studentName,studentPhone:bound.contact.studentPhone,
      guardianPhone:bound.contact.guardianPhone||undefined},{history:'EXISTING'})
    const before=await inspectExisting(context,selected.student.id,readonly,true)
    const canonical=await readonly.student(before.studentId)
    if(canonical.id!==before.studentId||studentProfileFingerprint(canonical)!==before.profileFingerprint)return 'REVIEW'
    const report=ownershipResult.parse(await ports.inspectOwnership({studentId:before.studentId,studentName:canonical.name,
      studentPhone:normalizePhone(canonical.studentPhoneNumber??''),lectureIds:[...bound.targetIds]}))
    if(!fresh(started)||report.studentId!==before.studentId||new Set(report.lectures.map(lecture=>lecture.id)).size!==report.lectures.length||
      JSON.stringify(report.lectures.map(lecture=>lecture.id).sort((a,b)=>a-b))!==JSON.stringify(bound.targetIds))return 'REVIEW'
    owned=report.lectures.some(lecture=>lecture.state==='OWNED')
    proof=await inspectExisting(context,before.studentId,readonly,true)
    if(!fresh(started)||proof.profileFingerprint!==before.profileFingerprint||proof.binding!==before.binding||
      proof.studentId!==before.studentId||JSON.stringify(proof.targetIds)!==JSON.stringify(before.targetIds))return 'REVIEW'
  }catch{return 'REVIEW'}
  // Recheck the untouched state after the remote reads. The audit action then
  // locks the order and checks this same version again, so a racing human hold
  // always wins. The immutable audit identifies the system as its operator.
  if(!await readCandidate(ports,id,context.version))return 'STALE'
  if(!fresh(started))return 'REVIEW'
  if(owned){
    const held=await ports.withClient(c=>orderTransaction(c,async()=>{
      await lockOrder(c,id)
      if(!await candidate(c,ports.tenantId,id,context.version)||!fresh(started))return false
      await holdOrder(c,id,'ownership_already_enrolled')
      return true
    }))
    return held?'OWNED':'STALE'
  }
  try{
    await ports.withClient(c=>applyOrderAdminAction(c,ports.tenantId,{
      requestKey:randomUUID(),orderId:id,expectedVersion:context.version,action:'APPROVE_EXISTING',
      operatorName:AUTOMATIC_REVIEW_OPERATOR,
      reason:`${AUTOMATIC_REVIEW_REASON_PREFIX} 학생 ID ${proof.studentId}, 강의 ID ${bound.targetIds.join(', ')} 전체 미보유 확인`,
      confirmed:true,studentId:proof.studentId,targetIds:bound.targetIds,confirmNotOwned:true,
    },proof))
    return 'APPROVED'
  }catch(error){
    if(error instanceof OrderAdminError)return error.code==='STALE'||error.code==='CONFLICT'?'STALE':'REVIEW'
    throw error
  }
}
