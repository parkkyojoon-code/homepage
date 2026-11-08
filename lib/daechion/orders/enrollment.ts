import {randomUUID} from 'node:crypto'
import {z} from 'zod'
import {DaechionError,type StudentPort,type DaechionStudent} from '../client'
import {resolveStudent} from '../identity'
import type {EnrollmentPort} from '../enrollment'
import {contactSchema,type OrderContact} from './checkout'
import {orderTransaction,lockOrder,orderChanged,holdOrder,eligible,type OrderConnection} from './worker-store'
import {latestReview,contextFromOrder,reviewContext,studentProfileFingerprint} from './manual-review'

const ids=z.array(z.number().int().positive().safe()).min(1).max(1000).refine(v=>new Set(v).size===v.length)
const sorted=(v:number[])=>[...v].sort((a,b)=>a-b)
const same=(a:number[],b:number[])=>JSON.stringify(sorted(a))===JSON.stringify(sorted(b))
function contactOf(o:Record<string,unknown>){const {noticeVersion:_notice,...raw}=o.contact_snapshot as Record<string,unknown>;return contactSchema.parse(raw)}
export interface OrderEnrollmentPorts extends OrderConnection {
  tenantId:string
  daechion:EnrollmentPort&{
    me():Promise<{tenantId:string|number}>
    lectures():Promise<{id:number;opened:boolean;weeklyLectures:{id:number}[]}[]>
  }
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
    if(o.identity_state==='PASSED')return {contact,studentId:Number(o.student_id),token:null,review}
    if(o.identity_state!=='WAITING')return null
    if(o.identity_token){
      if(new Date(o.identity_until as string).getTime()<=new Date(o.observed_at as string).getTime()){
        await c.query("UPDATE daechion_orders.orders SET identity_state='REVIEW',identity_token=NULL,identity_until=NULL WHERE id=$1",[id])
        if(!o.identity_write_started)await c.query('DELETE FROM daechion_orders.phone_claims WHERE order_id=$1',[id])
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
    return {contact,studentId:null,token,review}
  }))
  if(!claim)return null
  let resolved:DaechionStudent|undefined,createStarted=false
  try{
    if(String((await ports.daechion.me()).tenantId)!==ports.tenantId)throw new DaechionError('tenant_mismatch')
    const guarded:StudentPort={students:(phone,name)=>ports.daechion.students(phone,name),student:value=>ports.daechion.student(value),createStudent:async input=>{
      if(!claim.token)throw new DaechionError('identity_changed')
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
      await ports.withClient(c=>orderTransaction(c,async()=>{
        await lockOrder(c,id)
        if(!await identityFence(c,id,claim.token!))throw new DaechionError('identity_fence_changed')
        await c.query("UPDATE daechion_orders.orders SET identity_state='PASSED',student_id=$2,identity_token=NULL,identity_until=NULL WHERE id=$1",[id,resolved!.id])
        await c.query('DELETE FROM daechion_orders.phone_claims WHERE order_id=$1',[id]);await orderChanged(c,id,'identity_verified')
      }))
    }
    return {student:resolved,contact:claim.contact}
  }catch{
    await ports.withClient(c=>orderTransaction(c,async()=>{
      const o=await lockOrder(c,id);if(!o)return
      if(claim.token&&o.identity_token!==claim.token)return
      if(o.identity_state!=='PASSED')await c.query("UPDATE daechion_orders.orders SET identity_state='REVIEW',student_id=COALESCE(student_id,$2),identity_token=NULL,identity_until=NULL WHERE id=$1",[id,resolved?.id??null])
      if(!createStarted)await c.query('DELETE FROM daechion_orders.phone_claims WHERE order_id=$1',[id])
      await holdOrder(c,id,createStarted?'identity_create_unknown':'identity_review')
    }))
    return null
  }
}
interface GrantJob {orderId:string;lectureId:number;studentId:number;token:string;weeklyIds:number[];enrollmentRecorded:boolean;contact:OrderContact}
export async function grantFence(c:Parameters<typeof lockOrder>[0],job:GrantJob){
  return (await c.query(`SELECT g.order_id FROM daechion_orders.grants g JOIN daechion_orders.orders o ON o.id=g.order_id
    WHERE g.order_id=$1 AND g.lecture_id=$2 AND g.state='RUNNING' AND g.lease_token=$3 AND g.lease_until>now()
    AND o.identity_state='PASSED' AND o.student_id=$4 AND daechion_orders.paid_eligible(o.id)`,[job.orderId,job.lectureId,job.token,job.studentId])).rows.length>0
}
export async function runOrderGrant(id:string,enabled:boolean,ports:OrderEnrollmentPorts){
  if(!enabled)return 'DISABLED'
  z.string().uuid().parse(id)
  const identity=await prepareIdentity(id,ports);if(!identity)return 'SKIPPED'
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
  const fence=async()=>{if(!await ports.withClient(c=>grantFence(c,job)))throw new DaechionError('grant_fence_changed')}
  try{
    const matches=(await ports.daechion.lectures()).filter(l=>l.id===job.lectureId)
    if(matches.length!==1||!matches[0].opened)throw new DaechionError('course_changed')
    const expected=ids.parse(matches[0].weeklyLectures.map(l=>l.id))
    await fence()
    if(!job.enrollmentRecorded){
      const result=await ports.daechion.enroll(job.lectureId,job.studentId)
      const actual=ids.parse([...result.enrolledWeeklyLectureIds,...result.alreadyEnrolledWeeklyLectureIds])
      if(result.lectureId!==job.lectureId||result.studentId!==job.studentId||!same(expected,actual))throw new DaechionError('enrollment_unknown')
      await ports.withClient(c=>orderTransaction(c,async()=>{
        await lockOrder(c,id);if(!await grantFence(c,job))throw new DaechionError('grant_fence_changed')
        await c.query('UPDATE daechion_orders.grants SET enrollment_recorded=true,weekly_ids=$4::jsonb WHERE order_id=$1 AND lecture_id=$2 AND lease_token=$3',[id,job.lectureId,job.token,JSON.stringify(sorted(actual))])
        await orderChanged(c,id,'grant_enrolled')
      }))
      job.weeklyIds=actual
    }else if(!same(expected,ids.parse(job.weeklyIds)))throw new DaechionError('course_changed')
    if(!ports.daechion.ensureContentAccess)throw new DaechionError('content_unverified')
    await fence()
    const result=await ports.daechion.ensureContentAccess({lectureId:job.lectureId,studentId:job.studentId,weeklyLectureIds:[...job.weeklyIds],
      studentName:job.contact.studentName,studentPhone:job.contact.studentPhone,beforeWrite:fence})
    if(result?.verified!==true||result.lectureId!==job.lectureId||result.studentId!==job.studentId||!same(ids.parse(result.weeklyLectureIds),job.weeklyIds))throw new DaechionError('content_unverified')
    return ports.withClient(c=>orderTransaction(c,async()=>{
      await lockOrder(c,id);if(!await grantFence(c,job))throw new DaechionError('grant_fence_changed')
      await c.query("UPDATE daechion_orders.grants SET state='VERIFIED',verified_at=now(),review_code=NULL,lease_token=NULL,lease_until=NULL WHERE order_id=$1 AND lecture_id=$2 AND lease_token=$3",[id,job.lectureId,job.token])
      const version=await orderChanged(c,id,'grant_verified')
      if(!(await c.query("SELECT lecture_id FROM daechion_orders.grants WHERE order_id=$1 AND state NOT IN ('VERIFIED','MANUAL') LIMIT 1",[id])).rows.length){
        await c.query("UPDATE daechion_orders.orders SET notification_state='PENDING' WHERE id=$1 AND notification_state='NOT_READY'",[id])
        await c.query("INSERT INTO daechion_orders.jobs(id,order_id,kind,event_version) VALUES($1,$2,'READY_MESSAGE',$3) ON CONFLICT DO NOTHING",[randomUUID(),id,version])
      }
      return 'VERIFIED'
    }))
  }catch{
    await ports.withClient(c=>orderTransaction(c,async()=>{
      await lockOrder(c,id)
      const changed=await c.query("UPDATE daechion_orders.grants SET state='REVIEW',review_code='grant_unknown',lease_token=NULL,lease_until=NULL WHERE order_id=$1 AND lecture_id=$2 AND lease_token=$3 AND state='RUNNING' RETURNING lecture_id",[id,job.lectureId,job.token])
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
    if(!row||row.state!=='REVIEW'||row.enrollment_recorded!==true||!ids.safeParse(row.weekly_ids).success)return false
    await c.query("UPDATE daechion_orders.grants SET state='PENDING',review_code=NULL,lease_token=NULL,lease_until=NULL WHERE order_id=$1 AND lecture_id=$2",[input.orderId,input.lectureId])
    await orderChanged(c,input.orderId,'grant_access_retry');return true
}
