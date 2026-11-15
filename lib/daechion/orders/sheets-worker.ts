import {randomUUID} from 'node:crypto'
import {z} from 'zod'
import type {SheetsApi} from '../sheets-publisher'
import {orderTransaction,lockOrder,type OrderConnection} from './worker-store'
import {orderSheetView} from './sheets-view'
import {publishOrder,type OrderSheetTarget} from './sheets-publisher'

export interface SheetPorts extends OrderConnection {api:SheetsApi;target:OrderSheetTarget;authorise?():Promise<boolean>;recovery?:{requestKey:string;jobId:string;leaseToken:string}}
export async function syncOrderSheet(id:string,enabled:boolean,ports:SheetPorts,reconcileUnknown=false){
  if(!enabled)return 'DISABLED'
  z.string().uuid().parse(id)
  if(reconcileUnknown&&(!ports.authorise||!await ports.authorise()))return 'SKIPPED'
  const job=await ports.withClient(c=>orderTransaction(c,async()=>{
    if(!await lockOrder(c,id))return null
    if(ports.recovery&&(!reconcileUnknown||!(await c.query(`SELECT request_key FROM daechion_orders.sheet_recoveries
      WHERE request_key=$1 AND order_id=$2 AND job_id=$3 AND state='RUNNING' AND lease_token=$4 AND lease_until>now()`,
      [ports.recovery.requestKey,id,ports.recovery.jobId,ports.recovery.leaseToken])).rows.length))return null
    await c.query(`UPDATE daechion_orders.jobs SET
      state=CASE WHEN NOT sheet_write_started AND sheet_read_token=lease_token THEN 'PENDING' ELSE 'UNKNOWN' END,
      last_error=CASE WHEN NOT sheet_write_started AND sheet_read_token=lease_token THEN 'sheet_read_retry' ELSE 'sheet_publish_unknown' END,
      sheet_read_attempts=sheet_read_attempts+CASE WHEN NOT sheet_write_started AND sheet_read_token=lease_token THEN 1 ELSE 0 END,
      available_at=CASE WHEN NOT sheet_write_started AND sheet_read_token=lease_token THEN now() ELSE available_at END,
      lease_token=NULL,lease_until=NULL
      WHERE order_id=$1 AND kind='SHEETS' AND state='RUNNING' AND lease_until<=now()`,[id])
    // A worker from before migration 012 may still finish its third failed
    // read as UNKNOWN. Its persisted retry code is positive no-write evidence.
    await c.query(`UPDATE daechion_orders.jobs j SET state='PENDING',available_at=now()
      WHERE order_id=$1 AND kind='SHEETS' AND state='UNKNOWN' AND last_error='sheet_read_retry'
        AND NOT EXISTS(SELECT 1 FROM daechion_orders.sheet_recoveries r
          WHERE r.order_id=j.order_id AND r.state IN ('PENDING','RUNNING'))`,[id])
    const blockers=(await c.query("SELECT state FROM daechion_orders.jobs WHERE order_id=$1 AND kind='SHEETS' AND state IN ('RUNNING','UNKNOWN')",[id])).rows
    if(blockers.some(b=>b.state==='RUNNING')||(!reconcileUnknown&&blockers.length)||(reconcileUnknown&&blockers.filter(b=>b.state==='UNKNOWN').length!==1))return null
    const next=(await c.query("SELECT id,attempts,sheet_write_started,last_error FROM daechion_orders.jobs WHERE order_id=$1 AND kind='SHEETS' AND state=$2 AND available_at<=now() AND ($3::uuid IS NULL OR id=$3) ORDER BY event_version LIMIT 1",[id,reconcileUnknown?'UNKNOWN':'PENDING',ports.recovery?.jobId??null])).rows[0]
    if(!next)return null
    const token=randomUUID()
    const noWrite=next.sheet_write_started===false||next.last_error==='sheet_read_retry'||!reconcileUnknown&&Number(next.attempts)===0
    await c.query(`UPDATE daechion_orders.jobs SET state='RUNNING',attempts=attempts+1,lease_token=$2,
      lease_until=now()+interval '120 seconds',sheet_read_token=$2,sheet_write_started=$3,last_error=NULL WHERE id=$1`,[next.id,token,!noWrite])
    const view=await orderSheetView(c,id)
    return {id:String(next.id),token,view,noWrite}
  }))
  if(!job)return 'SKIPPED'
  let writeAttempted=!job.noWrite
  const tracked:SheetsApi={async call(method,path,body){
    const write=method!=='GET'&&!(path.endsWith('/developerMetadata:search')||path.endsWith('/values:batchGetByDataFilter'))
    if(write){
      // Commit uncertainty before sending the request. A crash after this commit
      // must use existing-row reconciliation even if the network call never ran.
      await ports.withClient(c=>orderTransaction(c,async()=>{
        if(!await lockOrder(c,id))throw Error('ORDER_SHEET_FENCE_CHANGED')
        if(ports.recovery&&!(await c.query(`SELECT request_key FROM daechion_orders.sheet_recoveries
          WHERE request_key=$1 AND order_id=$2 AND job_id=$3 AND state='RUNNING' AND lease_token=$4 AND lease_until>now() FOR UPDATE`,
          [ports.recovery.requestKey,id,ports.recovery.jobId,ports.recovery.leaseToken])).rows.length)throw Error('ORDER_SHEET_RECOVERY_FENCE_CHANGED')
        const current=await c.query(`UPDATE daechion_orders.jobs SET sheet_write_started=true
          WHERE id=$1 AND state='RUNNING' AND lease_token=$2 AND sheet_read_token=$2 AND lease_until>now() RETURNING id`,[job.id,job.token])
        if(!current.rows.length)throw Error('ORDER_SHEET_FENCE_CHANGED')
      }))
      writeAttempted=true
    }
    return ports.api.call(method,path,body)
  }}
  let success=false,code:string|null=null,defer=false
  try{await publishOrder(tracked,ports.target,job.view,!job.noWrite);success=true}
  catch(error){
    const message=error instanceof Error?error.message:''
    defer=!writeAttempted&&/^(SHEETS_REQUEST_UNCONFIRMED|SHEETS_HTTP_(429|500|502|503|504))$/.test(message)
    code=defer?'sheet_read_retry':message==='ORDER_SHEET_HEADERS_CHANGED'?'sheet_headers_changed':message==='ORDER_SHEET_NOT_INITIALIZED'?'sheet_not_initialized':'sheet_publish_unknown'
  }
  return ports.withClient(c=>orderTransaction(c,async()=>{
    await lockOrder(c,id)
    const result=await c.query(`UPDATE daechion_orders.jobs SET state=CASE WHEN $3::boolean THEN 'DONE' WHEN $4::boolean THEN 'PENDING' ELSE 'UNKNOWN' END,
      last_error=$5,sheet_read_attempts=sheet_read_attempts+CASE WHEN $4::boolean THEN 1 ELSE 0 END,
      available_at=CASE WHEN $4::boolean THEN now()+CASE WHEN sheet_read_attempts<2 THEN interval '60 seconds' ELSE interval '5 minutes' END ELSE available_at END,lease_token=NULL,lease_until=NULL
      WHERE id=$1 AND state='RUNNING' AND lease_token=$2 AND lease_until>now() RETURNING state`,[job.id,job.token,success,defer,code])
    if(!result.rows.length)return 'UNKNOWN'
    if(success)await c.query("UPDATE daechion_orders.jobs SET state='DONE',last_error=NULL WHERE order_id=$1 AND kind='SHEETS' AND state='PENDING' AND event_version<=$2::bigint",[id,job.view.version])
    return success?'DONE':result.rows[0].state==='PENDING'?'DEFERRED':'UNKNOWN'
  }))
}
