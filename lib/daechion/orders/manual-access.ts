import {z} from 'zod'
import type {LedgerClient} from '../ledger'
import type {DaechionStudent} from '../client'
import type {BillingContext} from './billing'
import type {OrderPreflightPort} from './preflight'
import {inspectExisting,reviewContext,reviewEvidenceSchema,contextFromOrder,latestReview} from './manual-review'
import {eligible} from './worker-store'
import {queueUnattemptedNotice} from './paid-recovery'

const weekly=z.array(z.number().int().positive().safe()).max(1000).refine(ids=>new Set(ids).size===ids.length)
export const accessEvidenceSchema=reviewEvidenceSchema.extend({lectureId:z.number().int().positive().safe(),weeklyLectureIds:weekly}).strict()
export type AccessEvidence=z.infer<typeof accessEvidenceSchema>
export async function inspectManualAccess(context:BillingContext,studentId:number,lectureId:number,revoke:boolean,
  api:OrderPreflightPort&{student(id:number):Promise<DaechionStudent>}):Promise<AccessEvidence>{
  const started=Date.now(),bound=reviewContext(context)
  if(!bound.targetIds.includes(lectureId))throw Error('MANUAL_ACCESS_TARGET_MISMATCH')
  const identity=await inspectExisting(context,studentId,api)
  let weeklyLectureIds:number[]=[]
  if(!revoke){
    const lectures=(await api.lectures()).filter(item=>item.id===lectureId)
    if(lectures.length!==1||lectures[0].opened!==true)throw Error('MANUAL_ACCESS_COURSE_UNAVAILABLE')
    weeklyLectureIds=weekly.min(1).parse(lectures[0].weeklyLectures.map(item=>item.id))
  }
  if(Date.now()-started>60000)throw Error('MANUAL_ACCESS_LOOKUP_EXPIRED')
  return {...identity,lectureId,weeklyLectureIds,checkedAt:new Date().toISOString()}
}
// Records an operator's completed external action. Never calls an enrollment,
// permission, billing or SMS API. Caller owns row locks and the audit transaction.
export async function recordManualAccess(c:LedgerClient,o:Record<string,unknown>,input:{studentId:number;lectureId:number;requestKey:string},raw:unknown,revoke:boolean){
  if(o.identity_state!=='PASSED'||Number(o.student_id)!==input.studentId||o.identity_token)return false
  const e=accessEvidenceSchema.parse(raw),age=Date.now()-Date.parse(e.checkedAt)
  const context=await contextFromOrder(c,String(o.tenant_id),String(o.id))
  if(!context)return false
  const bound=reviewContext(context)
  if(age<0||age>60000||e.studentId!==input.studentId||e.lectureId!==input.lectureId||e.binding!==bound.binding||
    JSON.stringify(e.targetIds)!==JSON.stringify(bound.targetIds)||!bound.targetIds.includes(input.lectureId))return false
  if((await c.query("SELECT 1 FROM daechion_orders.grants WHERE order_id=$1 AND state='RUNNING'",[o.id])).rows.length)return false
  const grant=(await c.query('SELECT * FROM daechion_orders.grants WHERE order_id=$1 AND lecture_id=$2 FOR UPDATE',[o.id,input.lectureId])).rows[0]
  if(!grant||grant.state==='REVOKED')return false
  if(revoke){
    if(e.weeklyLectureIds.length)return false
    await c.query("UPDATE daechion_orders.grants SET state='REVOKED',review_code='manual_access_revoked',manual_action_id=$3,revoked_at=now(),lease_token=NULL,lease_until=NULL WHERE order_id=$1 AND lecture_id=$2",[o.id,input.lectureId,input.requestKey])
  }else{
    if(!['PENDING','REVIEW'].includes(String(grant.state))||!weekly.min(1).safeParse(e.weeklyLectureIds).success||!await eligible(c,String(o.id)))return false
    const reviewed=await latestReview(c,String(o.id))
    if(reviewed&&(reviewed.studentId!==e.studentId||reviewed.profileFingerprint!==e.profileFingerprint))return false
    await c.query("UPDATE daechion_orders.grants SET state='MANUAL',review_code=NULL,verified_at=now(),manual_action_id=$3,weekly_ids=$4::jsonb,lease_token=NULL,lease_until=NULL WHERE order_id=$1 AND lecture_id=$2",[o.id,input.lectureId,input.requestKey,JSON.stringify(e.weeklyLectureIds)])
    await queueUnattemptedNotice(c,o)
  }
  return true
}
