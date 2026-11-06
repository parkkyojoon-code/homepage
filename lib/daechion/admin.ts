import { createHash } from 'node:crypto'
import { z } from 'zod'
import { normalizePhone, type DaechionStudent } from './client'
import { applicationSnapshotSchema, type LedgerClient } from './ledger'
import { automationTransaction, automationChanged } from './automation-store'
import { queueReadyMessage } from './ready-message'

export class AdminReviewError extends Error {constructor(public readonly code:'STALE'|'INVALID_EVIDENCE'|'UNAVAILABLE'){super(code)}}
export const adminActionSchema=z.object({requestKey:z.string().uuid(),applicationId:z.string().uuid(),expectedVersion:z.string().regex(/^[1-9]\d{0,18}$/),
  action:z.enum(['HOLD','RESUME','MANUAL_COMPLETE','REVOKED','CONFIRM_PAYMENT']),operatorName:z.string().trim().min(1).max(80),reason:z.string().trim().min(1).max(1000),confirmed:z.literal(true),
  studentId:z.number().int().positive().safe().optional(),billId:z.string().regex(/^\d{20}$/).optional(),amountWon:z.number().int().positive().optional(),
  paidAt:z.string().datetime({offset:true}).optional(),sentAt:z.string().datetime({offset:true}).optional(),
}).strict()
export type AdminAction=z.infer<typeof adminActionSchema>
export async function adminActionReplay(client:LedgerClient,data:AdminAction){
  const previous=(await client.query('SELECT application_id,fingerprint FROM daechion_automation.admin_actions WHERE id=$1',[data.requestKey])).rows[0]
  if(!previous)return false
  const fingerprint=createHash('sha256').update(JSON.stringify(data)).digest('hex')
  if(previous.application_id!==data.applicationId||previous.fingerprint!==fingerprint)throw new AdminReviewError('STALE')
  return true
}

async function stopPendingWork(client:LedgerClient,id:string){
  await client.query("UPDATE daechion_automation.registrations SET state=CASE WHEN state='RUNNING' THEN 'REVIEW' ELSE 'STOPPED' END,lease_token=NULL,lease_until=NULL WHERE application_id=$1 AND state IN ('PENDING','RUNNING')",[id])
  const running=await client.query("SELECT id FROM daechion_automation.outbox WHERE application_id=$1 AND kind='READY_MESSAGE' AND state='RUNNING'",[id])
  await client.query("UPDATE daechion_automation.outbox SET state=CASE WHEN state='RUNNING' THEN 'UNKNOWN' ELSE 'FAILED' END,lease_token=NULL,lease_until=NULL WHERE application_id=$1 AND kind='READY_MESSAGE' AND state IN ('PENDING','RUNNING')",[id])
  await client.query("UPDATE daechion_automation.applications SET notification_state=$2 WHERE id=$1 AND notification_state='PENDING'",[id,running.rows.length?'UNKNOWN':'FAILED'])
}
function verifyStudent(student:DaechionStudent|undefined,data:AdminAction,snapshot:ReturnType<typeof applicationSnapshotSchema.parse>){
  if(!student||student.id!==data.studentId||student.name.trim().normalize('NFC')!==snapshot.studentName.trim().normalize('NFC'))throw new AdminReviewError('INVALID_EVIDENCE')
  const same=(value:string|null|undefined,phone:string)=>{try{return Boolean(value)&&normalizePhone(value!)===phone}catch{return false}}
  if(!same(student.studentPhoneNumber,snapshot.studentPhone)||snapshot.guardianPhone&&![student.parentPhoneNumber,student.parentPhoneNumber2].some(value=>same(value,snapshot.guardianPhone)))throw new AdminReviewError('INVALID_EVIDENCE')
}
export async function applyAdminAction(client:LedgerClient,raw:unknown,student?:DaechionStudent,tenantId?:string){
  const data=adminActionSchema.parse(raw),fingerprint=createHash('sha256').update(JSON.stringify(data)).digest('hex')
  return automationTransaction(client,async()=>{
    const app=(await client.query('SELECT *,version::text AS current_version FROM daechion_automation.applications WHERE id=$1 FOR UPDATE',[data.applicationId])).rows[0]
    if(!app)throw new AdminReviewError('UNAVAILABLE')
    const previous=(await client.query('SELECT application_id,fingerprint FROM daechion_automation.admin_actions WHERE id=$1',[data.requestKey])).rows[0]
    if(previous){if(previous.application_id!==data.applicationId||previous.fingerprint!==fingerprint)throw new AdminReviewError('STALE');return {replayed:true}}
    if(app.current_version!==data.expectedVersion)throw new AdminReviewError('STALE')
    const snapshot=applicationSnapshotSchema.parse(app.submission)
    if(data.action==='RESUME'||data.action==='MANUAL_COMPLETE'){
      if(snapshot.daechionTenantId&&snapshot.daechionTenantId!==tenantId)throw new AdminReviewError('INVALID_EVIDENCE')
      verifyStudent(student,data,snapshot)
    }
    if((data.action==='RESUME'||data.action==='MANUAL_COMPLETE')&&!(await client.query('SELECT lecture_id FROM daechion_automation.registrations WHERE application_id=$1',[data.applicationId])).rows.length)throw new AdminReviewError('INVALID_EVIDENCE')
    const before={payment:app.payment_state,automation:app.automation_state,review:app.review_code,notification:app.notification_state}
    await client.query(`INSERT INTO daechion_automation.admin_actions(id,application_id,fingerprint,action,operator_name,reason,evidence)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,[data.requestKey,data.applicationId,fingerprint,data.action,data.operatorName,data.reason,JSON.stringify({before,studentId:data.studentId,billId:data.billId,amountWon:data.amountWon,paidAt:data.paidAt,sentAt:data.sentAt})])
    if(data.action==='HOLD'||data.action==='REVOKED'){
      await client.query('UPDATE daechion_automation.applications SET automation_state=$2,review_code=$3,manual_access_action=NULL WHERE id=$1',[data.applicationId,data.action==='REVOKED'?'REVOKED':'HOLD',data.action==='REVOKED'?'manual_access_revoked':'manual_hold'])
      await stopPendingWork(client,data.applicationId)
      if(data.action==='REVOKED')await client.query("UPDATE daechion_automation.registrations SET state='STOPPED',lease_token=NULL,lease_until=NULL WHERE application_id=$1",[data.applicationId])
    }else if(data.action==='CONFIRM_PAYMENT'){
      const bill=(await client.query('SELECT * FROM daechion_automation.bills WHERE application_id=$1 AND is_current FOR UPDATE',[data.applicationId])).rows[0]
      const paid=data.paidAt?new Date(data.paidAt):null
      const sent=bill?.sent_at?new Date(bill.sent_at as string):data.sentAt?new Date(data.sentAt):null
      if(!bill||!['SENT','SEND_UNKNOWN'].includes(String(bill.state))||data.billId!==bill.bill_id||data.amountWon!==bill.amount_won||!paid||!sent||paid.getTime()>Date.now()+60000||paid.getTime()<sent.getTime()-60000)throw new AdminReviewError('INVALID_EVIDENCE')
      await client.query("UPDATE daechion_automation.bills SET state='SENT',sent_at=$2,due_at=$2::timestamptz+interval '7 days',last_payment_state='PAID',checked_at=GREATEST(now(),COALESCE(checked_at+interval '1 microsecond',now())) WHERE id=$1",[bill.id,sent.toISOString()])
      await client.query("UPDATE daechion_automation.applications SET payment_state='PAID',paid_at=$2,automation_state='HOLD',review_code='admin_payment_confirmed',manual_access_action=NULL WHERE id=$1",[data.applicationId,paid.toISOString()])
      await stopPendingWork(client,data.applicationId)
    }else{
      if(data.action==='RESUME'){
        const bill=(await client.query("SELECT due_at FROM daechion_automation.bills WHERE application_id=$1 AND is_current AND state='SENT' AND last_payment_state='PAID'",[data.applicationId])).rows[0]
        if(app.payment_state!=='PAID'||app.automation_state==='REVOKED'||!bill||!app.paid_at||new Date(app.paid_at as string)>new Date(bill.due_at as string))throw new AdminReviewError('INVALID_EVIDENCE')
      }
      await stopPendingWork(client,data.applicationId)
      await client.query(`UPDATE daechion_automation.identity_checks SET status='PASSED',detected_type='EXISTING',student_id=$2,
        origin=CASE WHEN student_id=$2 AND origin='CREATED' THEN origin ELSE 'EXISTING' END,reason_code=NULL,checked_at=now(),manual_review_id=$3 WHERE application_id=$1`,[data.applicationId,data.studentId,data.requestKey])
      await client.query('DELETE FROM daechion_automation.identity_phone_claims WHERE application_id=$1',[data.applicationId])
      if(data.action==='MANUAL_COMPLETE'){
        await client.query("UPDATE daechion_automation.registrations SET state='DONE',student_id=$2,completed_at=COALESCE(completed_at,now()),access_state='MANUAL',access_checked_at=now(),lease_token=NULL,lease_until=NULL,version=version+1 WHERE application_id=$1",[data.applicationId,data.studentId])
        await client.query("UPDATE daechion_automation.applications SET automation_state='HOLD',review_code='manual_access_recorded',manual_access_action=$2 WHERE id=$1",[data.applicationId,data.requestKey])
      }else{
        await client.query("UPDATE daechion_automation.registrations SET state='PENDING',lease_token=NULL,lease_until=NULL WHERE application_id=$1 AND state IN ('REVIEW','STOPPED') AND completed_at IS NULL",[data.applicationId])
        await client.query("UPDATE daechion_automation.applications SET automation_state='ACTIVE',review_code=NULL,manual_access_action=NULL WHERE id=$1",[data.applicationId])
      }
    }
    const version=await automationChanged(client,data.applicationId,'admin_action_recorded','ADMIN')
    if(data.action==='RESUME'||data.action==='MANUAL_COMPLETE')await queueReadyMessage(client,data.applicationId,version)
    return {replayed:false}
  })
}

export async function adminApplications(client:LedgerClient,q='',reviewOnly=false,page=0){
  const result=await client.query(`SELECT a.id,a.product_title,a.submission->>'studentName' AS student_name,a.submission->>'studentPhone' AS student_phone,
    a.payment_state,a.automation_state,a.notification_state,a.review_code,a.version::text,
    CASE WHEN a.submission->>'studentHistory' IS NULL AND i.manual_review_id IS NULL THEN 'REVIEW' ELSE i.status END AS identity_status,a.created_at
    FROM daechion_automation.applications a JOIN daechion_automation.identity_checks i ON i.application_id=a.id
    WHERE ($1::text='' OR a.submission->>'studentName' ILIKE $2 OR a.submission->>'studentPhone' LIKE $2 OR a.submission->>'guardianPhone' LIKE $2 OR a.submission->>'payerPhone' LIKE $2)
    AND (NOT $3::boolean OR a.review_code IS NOT NULL OR i.status='REVIEW' OR (a.submission->>'studentHistory' IS NULL AND i.manual_review_id IS NULL) OR EXISTS(SELECT 1 FROM daechion_automation.outbox o WHERE o.application_id=a.id AND o.state='UNKNOWN'))
    ORDER BY a.created_at DESC,a.id DESC LIMIT 50 OFFSET $4`,[q,'%'+q+'%',reviewOnly,page*50])
  return result.rows
}
export async function adminApplicationDetail(client:LedgerClient,id:string){
  z.string().uuid().parse(id)
  const app=(await client.query('SELECT *,version::text AS current_version FROM daechion_automation.applications WHERE id=$1',[id])).rows[0]
  if(!app)return null
  const bills=(await client.query('SELECT bill_id,amount_won,state,is_current,sent_at,due_at,last_payment_state,checked_at FROM daechion_automation.bills WHERE application_id=$1 ORDER BY revision',[id])).rows
  const registrations=(await client.query('SELECT lecture_id::text,student_id::text,state,completed_at,access_state,access_checked_at FROM daechion_automation.registrations WHERE application_id=$1 ORDER BY lecture_id',[id])).rows
  const identity=(await client.query('SELECT status,detected_type,student_id::text,origin,reason_code,checked_at,manual_review_id FROM daechion_automation.identity_checks WHERE application_id=$1',[id])).rows[0]
  const actions=(await client.query('SELECT action,operator_name,reason,evidence,created_at FROM daechion_automation.admin_actions WHERE application_id=$1 ORDER BY created_at DESC LIMIT 50',[id])).rows
  const messages=(await client.query('SELECT phone,state,provider_message_id,accepted_at FROM daechion_automation.ready_receipts WHERE application_id=$1 ORDER BY phone',[id])).rows
  const jobs=(await client.query("SELECT kind,state,attempts FROM daechion_automation.outbox WHERE application_id=$1 AND state IN ('UNKNOWN','RUNNING','FAILED') ORDER BY created_at DESC LIMIT 20",[id])).rows
  return {app:{...app,submission:applicationSnapshotSchema.parse(app.submission)},bills,registrations,identity,actions,messages,jobs}
}
