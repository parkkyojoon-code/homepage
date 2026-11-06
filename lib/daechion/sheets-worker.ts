import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { applicationSnapshotSchema, type LedgerClient } from './ledger'
import { automationTransaction } from './automation-store'
import { publishApplication, type SheetsApi, type SheetTarget } from './sheets-publisher'
import type { ApplicationView } from './sheets-view'

const timestamp=(value:unknown)=>value?new Date(value as string).toISOString():undefined
const numberId=(value:unknown)=>{const id=Number(value);if(!Number.isSafeInteger(id)||id<=0)throw Error('INVALID_SHEET_STUDENT_ID');return id}
export async function claimSheetJob(client:LedgerClient,applicationId?:string) {
  if(applicationId!==undefined)z.string().uuid().parse(applicationId)
  return automationTransaction(client,async()=>{
    await client.query("UPDATE daechion_automation.outbox SET state='UNKNOWN',lease_token=NULL,lease_until=NULL WHERE kind='SHEETS' AND state='RUNNING' AND lease_until<=now() AND ($1::uuid IS NULL OR application_id=$1)",[applicationId??null])
    const app=(await client.query(`SELECT a.*,a.version::text AS snapshot_version FROM daechion_automation.applications a
      WHERE ($1::uuid IS NULL OR a.id=$1) AND EXISTS(SELECT 1 FROM daechion_automation.outbox o WHERE o.application_id=a.id AND o.kind='SHEETS' AND o.state='PENDING' AND o.available_at<=now())
      AND NOT EXISTS(SELECT 1 FROM daechion_automation.outbox o WHERE o.application_id=a.id AND o.kind='SHEETS' AND o.state IN ('RUNNING','UNKNOWN'))
      ORDER BY a.updated_at,a.id LIMIT 1 FOR UPDATE OF a SKIP LOCKED`,[applicationId??null])).rows[0]
    if(!app)return null
    const queue=(await client.query("SELECT id FROM daechion_automation.outbox WHERE application_id=$1 AND kind='SHEETS' AND state='PENDING' AND available_at<=now() ORDER BY event_version LIMIT 1",[app.id])).rows[0]
    const token=randomUUID()
    await client.query("UPDATE daechion_automation.outbox SET state='RUNNING',attempts=attempts+1,lease_token=$2,lease_until=now()+interval '120 seconds' WHERE id=$1",[queue.id,token])
    const bills=(await client.query('SELECT * FROM daechion_automation.bills WHERE application_id=$1 ORDER BY revision',[app.id])).rows
    const current=bills.find(bill=>bill.is_current)
    const regs=(await client.query('SELECT * FROM daechion_automation.registrations WHERE application_id=$1 ORDER BY lecture_id',[app.id])).rows
    const identity=(await client.query('SELECT * FROM daechion_automation.identity_checks WHERE application_id=$1',[app.id])).rows[0]
    const states=regs.map(row=>String(row.state))
    const registrationState=['REVIEW','RUNNING','STOPPED','PENDING'].find(state=>states.includes(state))??(states.length?'DONE':'PENDING')
    const view:ApplicationView={id:String(app.id),createdAt:timestamp(app.created_at)!,updatedAt:timestamp(app.updated_at)!,snapshot:applicationSnapshotSchema.parse(app.submission),
      billingState:String(current?.state??'NOT_CREATED'),currentBillId:current?String(current.bill_id):undefined,allBillIds:bills.map(bill=>String(bill.bill_id)),
      sentAt:timestamp(current?.sent_at),dueAt:timestamp(current?.due_at),paymentState:String(app.payment_state),paidAt:timestamp(app.paid_at),
      studentId:identity?.student_id?numberId(identity.student_id):undefined,lectureIds:regs.map(row=>numberId(row.lecture_id)),registrationState,
      notificationState:String(app.notification_state),reviewReason:app.review_code?String(app.review_code):undefined,
      identity:identity?{status:identity.status as 'WAITING'|'PASSED'|'REVIEW',detected:identity.detected_type as 'NEW'|'EXISTING'|'UNKNOWN',studentId:identity.student_id?numberId(identity.student_id):undefined,
        origin:identity.origin as 'CREATED'|'EXISTING'|undefined,reason:identity.reason_code?String(identity.reason_code):undefined,manualReviewed:Boolean(identity.manual_review_id)}:undefined,
    }
    return {id:String(queue.id),applicationId:String(app.id),token,version:String(app.snapshot_version),view}
  })
}
type SheetJob=NonNullable<Awaited<ReturnType<typeof claimSheetJob>>>
export async function finishSheetJob(client:LedgerClient,job:SheetJob,success:boolean) {
  return automationTransaction(client,async()=>{
    await client.query('SELECT id FROM daechion_automation.applications WHERE id=$1 FOR UPDATE',[job.applicationId])
    const changed=await client.query(`UPDATE daechion_automation.outbox SET state=$3,lease_token=NULL,lease_until=NULL
      WHERE id=$1 AND kind='SHEETS' AND state='RUNNING' AND lease_token=$2 RETURNING id`,[job.id,job.token,success?'DONE':'UNKNOWN'])
    if(!changed.rows.length)return false
    if(success)await client.query("UPDATE daechion_automation.outbox SET state='DONE' WHERE application_id=$1 AND kind='SHEETS' AND state='PENDING' AND event_version<=$2::bigint",[job.applicationId,job.version])
    return true
  })
}

// Only used when a transient read failed before any mutating Sheets request.
// An expired/replaced claim never gets returned to PENDING by this path.
async function deferUnwrittenSheetJob(client:LedgerClient,job:SheetJob) {
  return automationTransaction(client,async()=>{
    await client.query('SELECT id FROM daechion_automation.applications WHERE id=$1 FOR UPDATE',[job.applicationId])
    const changed=await client.query(`UPDATE daechion_automation.outbox
      SET state=CASE WHEN attempts<3 THEN 'PENDING' ELSE 'UNKNOWN' END,
      available_at=now()+interval '60 seconds',lease_token=NULL,lease_until=NULL
      WHERE id=$1 AND kind='SHEETS' AND state='RUNNING' AND lease_token=$2 RETURNING state`,[job.id,job.token])
    return changed.rows[0]?.state==='PENDING'?'DEFERRED':'UNKNOWN'
  })
}
export async function syncOneApplication(ports:{applicationId?:string;api:SheetsApi;target:SheetTarget;withClient<T>(run:(client:LedgerClient)=>Promise<T>):Promise<T>}) {
  if(ports.applicationId!==undefined)z.string().uuid().parse(ports.applicationId)
  const job=await ports.withClient(client=>claimSheetJob(client,ports.applicationId))
  if(!job)return 'SKIPPED'
  let writeAttempted=false
  const trackedApi:SheetsApi={call(method,path,body){
    // developerMetadata search uses POST but is a documented read operation.
    if(method!=='GET'&&!(method==='POST'&&path.endsWith('/developerMetadata:search')))writeAttempted=true
    return ports.api.call(method,path,body)
  }}
  try {await publishApplication(trackedApi,ports.target,job.view)}catch(error){
    const transientRead=error instanceof Error&&/^(SHEETS_REQUEST_UNCONFIRMED|SHEETS_HTTP_(429|500|502|503|504))$/.test(error.message)
    if(!writeAttempted&&transientRead)return ports.withClient(client=>deferUnwrittenSheetJob(client,job))
    await ports.withClient(client=>finishSheetJob(client,job,false));return 'UNKNOWN'
  }
  return await ports.withClient(client=>finishSheetJob(client,job,true))?'DONE':'UNKNOWN'
}
