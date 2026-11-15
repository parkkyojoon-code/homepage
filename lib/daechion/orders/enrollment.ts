import {randomUUID} from 'node:crypto'
import {z} from 'zod'
import {DaechionError,type StudentPort,type DaechionStudent} from '../client'
import {resolveStudent} from '../identity'
import type {EnrollmentPort} from '../enrollment'
import {contactSchema,type OrderContact} from './checkout'
import {orderTransaction,lockOrder,orderChanged,holdOrder,eligible,type OrderConnection} from './worker-store'
import {latestReview,contextFromOrder,reviewContext,studentProfileFingerprint} from './manual-review'
import {firstLessonTarget} from '../first-lesson'
import type {PaymentProvider} from '../payssam'
import {checkOrderPayment} from './billing'

const ids=z.array(z.number().int().positive().safe()).min(1).max(1000).refine(v=>new Set(v).size===v.length)
const sorted=(v:number[])=>[...v].sort((a,b)=>a-b)
const same=(a:number[],b:number[])=>JSON.stringify(sorted(a))===JSON.stringify(sorted(b))
function contactOf(o:Record<string,unknown>){const {noticeVersion:_notice,...raw}=o.contact_snapshot as Record<string,unknown>;return contactSchema.parse(raw)}
export interface OrderEnrollmentPorts extends OrderConnection {
  tenantId:string
  provider?:PaymentProvider
  daechion:EnrollmentPort&{
    me():Promise<{tenantId:string|number}>
    lectures():Promise<{id:number;opened:boolean;weeklyLectures:{id:number}[]}[]>
    isAvailable?():boolean
  }
}
class PaymentBoundaryError extends Error {}
// Production's runner supplies the provider. Older internal adapters still
// fail closed at the unchanged three-minute DB fence when no provider exists.
async function refreshPayment(id:string,ports:OrderEnrollmentPorts){
  if(!ports.provider)return
  try{
    if(await checkOrderPayment(id,true,{withClient:ports.withClient,provider:ports.provider})!=='PAID')throw new PaymentBoundaryError()
  }catch{throw new PaymentBoundaryError()}
}
async function identityFence(c:Parameters<typeof lockOrder>[0],id:string,token:string){
  return (await c.query(`SELECT id FROM daechion_orders.orders WHERE id=$1 AND identity_token=$2 AND identity_until>now()
    AND identity_state='WAITING' AND daechion_orders.paid_eligible(id)`,[id,token])).rows.length>0
}
async function prepareIdentity(id:string,ports:OrderEnrollmentPorts):Promise<{student:DaechionStudent;contact:OrderContact}|null>{
  const claim=await ports.withClient(c=>orderTransaction(c,async()=>{
    const o=await lockOrder(c,id)
    if(!o||o.tenant_id!==ports.tenantId||!await eligible(c,id))return null
    const contact=contactOf(o)
    const review=await latestReview(c,id)
    if(review){
      const context=await contextFromOrder(c,ports.tenantId,id)
      if(!context||review.binding!==reviewContext(context).binding){await holdOrder(c,id,'identity_review');return null}
    }
    if(o.identity_retry_at&&new Date(o.identity_retry_at as string).getTime()>new Date(o.observed_at as string).getTime())return null
    if(o.identity_state==='PASSED')return {contact,studentId:Number(o.student_id),token:null,review,strictStudentId:o.identity_recovery_action_id&&!o.identity_write_started?Number(o.student_id):null}
    if(o.identity_state!=='WAITING')return null
    if(o.identity_token){
      if(new Date(o.identity_until as string).getTime()<=new Date(o.observed_at as string).getTime()){
        if(!o.identity_write_started){
          // A stale reader cannot create after its lease has been replaced: the
          // create fence checks this token under the order lock before writing.
          await c.query('UPDATE daechion_orders.orders SET identity_token=NULL,identity_until=NULL WHERE id=$1',[id])
          await c.query('DELETE FROM daechion_orders.phone_claims WHERE order_id=$1',[id])
          await orderChanged(c,id,'identity_read_expired');return null
        }
        await c.query("UPDATE daechion_orders.orders SET identity_state='REVIEW',identity_token=NULL,identity_until=NULL WHERE id=$1",[id])
        await holdOrder(c,id,'identity_unknown')
      }
      return null
    }
    if(o.identity_write_started){await holdOrder(c,id,'identity_create_unknown');return null}
    const phones=[...new Set([contact.studentPhone,contact.guardianPhone].filter(Boolean))].sort()
    for(const phone of phones){
      await c.query('SELECT pg_advisory_xact_lock(61131,hashtext($1))',[phone])
      const old=await c.query('SELECT application_id FROM daechion_automation.identity_phone_claims WHERE phone=$1',[phone])
      if(old.rows.length){await c.query('DELETE FROM daechion_orders.phone_claims WHERE order_id=$1',[id]);await holdOrder(c,id,'identity_phone_busy');return null}
      await c.query('INSERT INTO daechion_orders.phone_claims(phone,order_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[phone,id])
      if(!(await c.query('SELECT phone FROM daechion_orders.phone_claims WHERE phone=$1 AND order_id=$2',[phone,id])).rows.length){
        await c.query('DELETE FROM daechion_orders.phone_claims WHERE order_id=$1',[id]);await holdOrder(c,id,'identity_phone_busy');return null
      }
    }
    const token=randomUUID()
    await c.query("UPDATE daechion_orders.orders SET identity_token=$2,identity_until=now()+interval '10 minutes' WHERE id=$1",[id,token])
    await orderChanged(c,id,'identity_claimed')
    return {contact,studentId:null,token,review,strictStudentId:null}
  }))
  if(!claim)return null
  let resolved:DaechionStudent|undefined,createStarted=false,readRetryable=false
  const read=async<T>(run:()=>Promise<T>)=>{
    try{return await run()}catch(error){
      readRetryable=!(error instanceof DaechionError)||error.code==='transport_unknown'||error.status===429||error.status>=500
      throw error
    }
  }
  try{
    if(String((await read(()=>ports.daechion.me())).tenantId)!==ports.tenantId)throw new DaechionError('tenant_mismatch')
    const guarded:StudentPort={students:async(phone,name)=>{
      const candidates=await read(()=>ports.daechion.students(phone,name))
      if(claim.strictStudentId&&candidates.some(student=>student.id!==claim.strictStudentId))throw new DaechionError('identity_changed')
      return candidates
    },student:value=>read(()=>ports.daechion.student(value)),createStudent:async input=>{
      if(!claim.token)throw new DaechionError('identity_changed')
      await refreshPayment(id,ports)
      await ports.withClient(c=>orderTransaction(c,async()=>{
        await lockOrder(c,id)
        if(!await identityFence(c,id,claim.token!))throw new DaechionError('identity_fence_changed')
        await c.query('UPDATE daechion_orders.orders SET identity_write_started=true WHERE id=$1',[id]);await orderChanged(c,id,'identity_create_attempted')
      }))
      createStarted=true;return ports.daechion.createStudent(input)
    }}
    resolved=(await resolveStudent(guarded,{name:claim.contact.studentName,studentPhone:claim.contact.studentPhone,guardianPhone:claim.contact.guardianPhone||undefined},
      {history:claim.contact.studentHistory,...(claim.review?{manualApprovedId:claim.review.studentId}:claim.studentId?{knownCreatedId:claim.studentId}:{})})).student
    if(claim.review&&(studentProfileFingerprint(resolved)!==claim.review.profileFingerprint||claim.studentId&&resolved.id!==claim.studentId))throw new DaechionError('identity_changed')
    if(claim.token){
      await refreshPayment(id,ports)
      await ports.withClient(c=>orderTransaction(c,async()=>{
        await lockOrder(c,id)
        if(!await identityFence(c,id,claim.token!))throw new DaechionError('identity_fence_changed')
        await c.query("UPDATE daechion_orders.orders SET identity_state='PASSED',student_id=$2,identity_token=NULL,identity_until=NULL,identity_read_attempts=0,identity_retry_at=NULL WHERE id=$1",[id,resolved!.id])
        await c.query('DELETE FROM daechion_orders.phone_claims WHERE order_id=$1',[id]);await orderChanged(c,id,'identity_verified')
      }))
    }else{
      await ports.withClient(c=>c.query("UPDATE daechion_orders.orders SET identity_read_attempts=0,identity_retry_at=NULL WHERE id=$1 AND identity_state='PASSED' AND student_id=$2",[id,resolved!.id]))
    }
    return {student:resolved,contact:claim.contact}
  }catch(error){
    await ports.withClient(c=>orderTransaction(c,async()=>{
      const o=await lockOrder(c,id);if(!o)return
      if(claim.token&&o.identity_token!==claim.token)return
      if(error instanceof PaymentBoundaryError&&!createStarted&&!o.identity_write_started){
        await c.query('UPDATE daechion_orders.orders SET identity_token=NULL,identity_until=NULL WHERE id=$1',[id])
        await c.query('DELETE FROM daechion_orders.phone_claims WHERE order_id=$1',[id])
        await orderChanged(c,id,'identity_payment_wait');return
      }
      const readOnly=claim.token?!o.identity_write_started:o.identity_state==='PASSED'&&Number(o.student_id)===claim.studentId&&!o.identity_token
      if(readRetryable&&!createStarted&&readOnly){
        // No create was attempted. Keep a paid order eligible for the next
        // worker pass; business mismatches still require administrator review.
        await c.query("UPDATE daechion_orders.orders SET identity_token=NULL,identity_until=NULL,identity_read_attempts=LEAST(identity_read_attempts+1,3),identity_retry_at=now()+CASE WHEN identity_read_attempts=0 THEN interval '1 minute' WHEN identity_read_attempts=1 THEN interval '2 minutes' ELSE interval '5 minutes' END WHERE id=$1",[id])
        await c.query('DELETE FROM daechion_orders.phone_claims WHERE order_id=$1',[id])
        await orderChanged(c,id,'identity_read_retry');return
      }
      if(o.identity_state!=='PASSED')await c.query("UPDATE daechion_orders.orders SET identity_state='REVIEW',student_id=COALESCE(student_id,$2),identity_token=NULL,identity_until=NULL WHERE id=$1",[id,resolved?.id??null])
      if(!createStarted)await c.query('DELETE FROM daechion_orders.phone_claims WHERE order_id=$1',[id])
      await holdOrder(c,id,createStarted?'identity_create_unknown':readRetryable?'identity_lookup_failed':'identity_review')
    }))
    return null
  }
}
interface GrantJob {orderId:string;lectureId:number;studentId:number;token:string;weeklyIds:number[];enrollmentRecorded:boolean;contact:OrderContact}
async function grantOwnership(c:Parameters<typeof lockOrder>[0],job:GrantJob,requirePayment=true){
  return (await c.query(`SELECT g.order_id FROM daechion_orders.grants g JOIN daechion_orders.orders o ON o.id=g.order_id
    WHERE g.order_id=$1 AND g.lecture_id=$2 AND g.state='RUNNING' AND g.lease_token=$3 AND g.lease_until>now()
    AND o.identity_state='PASSED' AND o.student_id=$4 AND (NOT $5::boolean OR daechion_orders.paid_eligible(o.id)) AND g.weekly_ids=$6::jsonb`,[job.orderId,job.lectureId,job.token,job.studentId,requirePayment,JSON.stringify(job.weeklyIds)])).rows.length>0
}
export const grantFence=(c:Parameters<typeof lockOrder>[0],job:GrantJob)=>grantOwnership(c,job)
export async function runOrderGrant(id:string,enabled:boolean,ports:OrderEnrollmentPorts){
  if(!enabled)return 'DISABLED'
  z.string().uuid().parse(id)
  if(ports.daechion.isAvailable?.()===false)return 'SKIPPED'
  try{await refreshPayment(id,ports)}catch{return 'SKIPPED'}
  const identity=await prepareIdentity(id,ports);if(!identity)return 'SKIPPED'
  try{await refreshPayment(id,ports)}catch{return 'SKIPPED'}
  const job=await ports.withClient(c=>orderTransaction(c,async()=>{
    const o=await lockOrder(c,id)
    if(!o||o.student_id==null||Number(o.student_id)!==identity.student.id||!await eligible(c,id))return null
    const running=(await c.query("SELECT lecture_id,lease_until<=now() AS expired FROM daechion_orders.grants WHERE order_id=$1 AND state='RUNNING'",[id])).rows
    if(running.some(r=>!r.expired))return null
    if(running.length){await c.query("UPDATE daechion_orders.grants SET state='REVIEW',review_code='grant_unknown',lease_token=NULL,lease_until=NULL WHERE order_id=$1 AND state='RUNNING'",[id]);await orderChanged(c,id,'grant_expired')}
    const next=(await c.query("SELECT * FROM daechion_orders.grants WHERE order_id=$1 AND state='PENDING' ORDER BY lecture_id LIMIT 1",[id])).rows[0]
    if(!next)return null
    const token=randomUUID()
    await c.query("UPDATE daechion_orders.grants SET state='RUNNING',lease_token=$3,lease_until=now()+interval '10 minutes' WHERE order_id=$1 AND lecture_id=$2",[id,next.lecture_id,token])
    await orderChanged(c,id,'grant_claimed')
    return {orderId:id,lectureId:Number(next.lecture_id),studentId:identity.student.id,token,weeklyIds:next.weekly_ids as number[],enrollmentRecorded:next.enrollment_recorded===true,contact:identity.contact}
  }))
  if(!job)return 'SKIPPED'
  let writeMayHaveStarted=false,paymentStopped=false
  const refresh=async()=>{try{await refreshPayment(id,ports)}catch(error){paymentStopped=true;throw error}}
  const fence=async()=>{if(!await ports.withClient(c=>grantFence(c,job)))throw new DaechionError('grant_fence_changed')}
  const beforeWrite=async()=>{await refresh();await fence();writeMayHaveStarted=true}
  try{
    if(!ports.daechion.ensureFirstLessonAccess)throw new DaechionError('content_unverified')
    if(job.enrollmentRecorded&&job.weeklyIds.length!==1)throw Error('FIRST_LESSON_CHANGED')
    const target=firstLessonTarget(await ports.daechion.lectures(),job.lectureId,job.weeklyIds)
    await refresh()
    await fence()
    if(!job.weeklyIds.length){
      await ports.withClient(c=>orderTransaction(c,async()=>{
        await lockOrder(c,id);if(!await grantFence(c,job))throw new DaechionError('grant_fence_changed')
        await c.query('UPDATE daechion_orders.grants SET weekly_ids=$4::jsonb WHERE order_id=$1 AND lecture_id=$2 AND lease_token=$3',[id,job.lectureId,job.token,JSON.stringify([target])])
        await orderChanged(c,id,'first_lesson_pinned')
      }))
      job.weeklyIds=[target]
    }
    const recordEnrollment=async()=>{
      if(job.enrollmentRecorded)return
      await ports.withClient(c=>orderTransaction(c,async()=>{
        // Record the vendor acknowledgement even if a long browser step aged
        // the payment snapshot. The same live lease/student/target must remain
        // ours; a cancellation or hold that cleared the lease still wins.
        await lockOrder(c,id);if(!await grantOwnership(c,job,false))throw new DaechionError('grant_fence_changed')
        await c.query('UPDATE daechion_orders.grants SET enrollment_recorded=true WHERE order_id=$1 AND lecture_id=$2 AND lease_token=$3',[id,job.lectureId,job.token])
        await orderChanged(c,id,'grant_enrolled')
      }))
      job.enrollmentRecorded=true
    }
    await fence()
    const result=await ports.daechion.ensureFirstLessonAccess({lectureId:job.lectureId,studentId:job.studentId,weeklyLectureId:target,
      enrollmentRecorded:job.enrollmentRecorded,recordEnrollment,studentName:job.contact.studentName,studentPhone:job.contact.studentPhone,beforeWrite})
    if(!job.enrollmentRecorded||result?.verified!==true||result.lectureId!==job.lectureId||result.studentId!==job.studentId||!same(ids.parse(result.weeklyLectureIds),job.weeklyIds))throw new DaechionError('content_unverified')
    await refresh()
    return await ports.withClient(c=>orderTransaction(c,async()=>{
      await lockOrder(c,id);if(!await grantFence(c,job))throw new DaechionError('grant_fence_changed')
      await c.query("UPDATE daechion_orders.grants SET state='VERIFIED',verified_at=now(),review_code=NULL,lease_token=NULL,lease_until=NULL WHERE order_id=$1 AND lecture_id=$2 AND lease_token=$3",[id,job.lectureId,job.token])
      const version=await orderChanged(c,id,'grant_verified')
      if(!(await c.query("SELECT lecture_id FROM daechion_orders.grants WHERE order_id=$1 AND state NOT IN ('VERIFIED','MANUAL') LIMIT 1",[id])).rows.length){
        await c.query("UPDATE daechion_orders.orders SET notification_state='PENDING' WHERE id=$1 AND notification_state='NOT_READY'",[id])
        await c.query("INSERT INTO daechion_orders.jobs(id,order_id,kind,event_version) VALUES($1,$2,'READY_MESSAGE',$3) ON CONFLICT DO NOTHING",[randomUUID(),id,version])
      }
      return 'VERIFIED'
    }))
  }catch(error){
    if(paymentStopped&&!writeMayHaveStarted&&!job.enrollmentRecorded){
      const deferred=await ports.withClient(c=>orderTransaction(c,async()=>{
        const o=await lockOrder(c,id);if(!o||o.identity_state!=='PASSED'||Number(o.student_id)!==job.studentId)return false
        const g=(await c.query('SELECT * FROM daechion_orders.grants WHERE order_id=$1 AND lecture_id=$2 FOR UPDATE',[id,job.lectureId])).rows[0]
        if(!g||g.enrollment_recorded||!same(g.weekly_ids as number[],job.weeklyIds))return false
        const owned=g.state==='RUNNING'&&g.lease_token===job.token
        const stoppedByRead=g.state==='REVIEW'&&!g.lease_token&&g.review_code==='order_held'&&o.review_code==='payment_query_unknown'&&o.payment_state!=='CANCELLED'
        if(!owned&&!stoppedByRead)return false
        if(!['READY','REVIEW'].includes(String(o.checkout_state))||o.review_code&&o.review_code!=='payment_query_unknown')return false
        await c.query("UPDATE daechion_orders.grants SET state='PENDING',review_code=NULL,lease_token=NULL,lease_until=NULL WHERE order_id=$1 AND lecture_id=$2",[id,job.lectureId])
        await orderChanged(c,id,'grant_payment_wait');return true
      }))
      if(deferred)return 'SKIPPED'
    }
    const code=error instanceof Error&&error.message==='FIRST_LESSON_UNAVAILABLE'?'lecture_unavailable':
      error instanceof Error&&error.message==='FIRST_LESSON_CHANGED'?'first_lesson_changed':paymentStopped?'payment_recheck_required':'grant_unknown'
    await ports.withClient(c=>orderTransaction(c,async()=>{
      await lockOrder(c,id)
      const changed=await c.query("UPDATE daechion_orders.grants SET state='REVIEW',review_code=$4,lease_token=NULL,lease_until=NULL WHERE order_id=$1 AND lecture_id=$2 AND lease_token=$3 AND state='RUNNING' RETURNING lecture_id",[id,job.lectureId,job.token,code])
      if(changed.rows.length)await orderChanged(c,id,'grant_review')
    }))
    return 'REVIEW'
  }
}

// Server-internal administrator action. Only an acknowledged enrollment can
// resume permission verification; an unknown enrollment needs reconciliation.
export async function retryRecordedAccess(input:{orderId:string;lectureId:number;expectedVersion:string},ports:OrderConnection&{authorise():Promise<boolean>}){
  if(!await ports.authorise())return false
  return ports.withClient(c=>orderTransaction(c,()=>retryRecordedAccessInTransaction(c,input)))
}
// Server-only transaction primitive: the authenticated admin ledger uses this
// inside the same transaction as its idempotent audit record.
export async function retryRecordedAccessInTransaction(c:Parameters<typeof lockOrder>[0],input:{orderId:string;lectureId:number;expectedVersion:string}){
  z.string().uuid().parse(input.orderId);z.number().int().positive().safe().parse(input.lectureId)
    const o=await lockOrder(c,input.orderId)
    if(!o||String(o.version)!==input.expectedVersion||o.identity_state!=='PASSED'||!await eligible(c,input.orderId))return false
    const row=(await c.query('SELECT * FROM daechion_orders.grants WHERE order_id=$1 AND lecture_id=$2 FOR UPDATE',[input.orderId,input.lectureId])).rows[0]
    if(!row||row.state!=='REVIEW'||row.enrollment_recorded!==true||!ids.length(1).safeParse(row.weekly_ids).success)return false
    await c.query("UPDATE daechion_orders.grants SET state='PENDING',review_code=NULL,lease_token=NULL,lease_until=NULL WHERE order_id=$1 AND lecture_id=$2",[input.orderId,input.lectureId])
    await orderChanged(c,input.orderId,'grant_access_retry');return true
}
