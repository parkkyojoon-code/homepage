import {randomUUID} from 'node:crypto'
import {z} from 'zod'
import type {SheetsApi} from '../sheets-publisher'
import {orderTransaction,lockOrder,type OrderConnection} from './worker-store'
import {orderSheetView} from './sheets-view'
import {publishOrder,type OrderSheetTarget} from './sheets-publisher'

interface SheetPorts extends OrderConnection {api:SheetsApi;target:OrderSheetTarget;authorise?():Promise<boolean>}
export async function syncOrderSheet(id:string,enabled:boolean,ports:SheetPorts,reconcileUnknown=false){
  if(!enabled)return 'DISABLED'
  z.string().uuid().parse(id)
  if(reconcileUnknown&&(!ports.authorise||!await ports.authorise()))return 'SKIPPED'
  const job=await ports.withClient(c=>orderTransaction(c,async()=>{
    if(!await lockOrder(c,id))return null
    await c.query("UPDATE daechion_orders.jobs SET state='UNKNOWN',last_error='sheet_publish_unknown',lease_token=NULL,lease_until=NULL WHERE order_id=$1 AND kind='SHEETS' AND state='RUNNING' AND lease_until<=now()",[id])
    const blockers=(await c.query("SELECT state FROM daechion_orders.jobs WHERE order_id=$1 AND kind='SHEETS' AND state IN ('RUNNING','UNKNOWN')",[id])).rows
    if(blockers.some(b=>b.state==='RUNNING')||(!reconcileUnknown&&blockers.length)||(reconcileUnknown&&blockers.filter(b=>b.state==='UNKNOWN').length!==1))return null
    const next=(await c.query("SELECT id FROM daechion_orders.jobs WHERE order_id=$1 AND kind='SHEETS' AND state=$2 AND available_at<=now() ORDER BY event_version LIMIT 1",[id,reconcileUnknown?'UNKNOWN':'PENDING'])).rows[0]
    if(!next)return null
    const token=randomUUID()
    await c.query("UPDATE daechion_orders.jobs SET state='RUNNING',attempts=attempts+1,lease_token=$2,lease_until=now()+interval '120 seconds',last_error=NULL WHERE id=$1",[next.id,token])
    const view=await orderSheetView(c,id)
    return {id:String(next.id),token,view}
  }))
  if(!job)return 'SKIPPED'
  let writeAttempted=false
  const tracked:SheetsApi={async call(method,path,body){
    const write=method!=='GET'&&!(path.endsWith('/developerMetadata:search')||path.endsWith('/values:batchGetByDataFilter'))
    if(write){
      const current=await ports.withClient(c=>c.query("SELECT id FROM daechion_orders.jobs WHERE id=$1 AND state='RUNNING' AND lease_token=$2 AND lease_until>now()",[job.id,job.token]))
      if(!current.rows.length)throw Error('ORDER_SHEET_FENCE_CHANGED')
      writeAttempted=true
    }
    return ports.api.call(method,path,body)
  }}
  let success=false,code:string|null=null,defer=false
  try{await publishOrder(tracked,ports.target,job.view,reconcileUnknown);success=true}
  catch(error){
    const message=error instanceof Error?error.message:''
    defer=!reconcileUnknown&&!writeAttempted&&/^(SHEETS_REQUEST_UNCONFIRMED|SHEETS_HTTP_(429|500|502|503|504))$/.test(message)
    code=defer?'sheet_read_retry':message==='ORDER_SHEET_HEADERS_CHANGED'?'sheet_headers_changed':message==='ORDER_SHEET_NOT_INITIALIZED'?'sheet_not_initialized':'sheet_publish_unknown'
  }
  return ports.withClient(c=>orderTransaction(c,async()=>{
    await lockOrder(c,id)
    const result=await c.query(`UPDATE daechion_orders.jobs SET state=CASE WHEN $3::boolean THEN 'DONE' WHEN $4::boolean AND attempts<3 THEN 'PENDING' ELSE 'UNKNOWN' END,
      last_error=$5,available_at=CASE WHEN $4::boolean THEN now()+interval '60 seconds' ELSE available_at END,lease_token=NULL,lease_until=NULL
      WHERE id=$1 AND state='RUNNING' AND lease_token=$2 AND lease_until>now() RETURNING state`,[job.id,job.token,success,defer,code])
    if(!result.rows.length)return 'UNKNOWN'
    if(success)await c.query("UPDATE daechion_orders.jobs SET state='DONE',last_error=NULL WHERE order_id=$1 AND kind='SHEETS' AND state='PENDING' AND event_version<=$2::bigint",[id,job.view.version])
    return success?'DONE':result.rows[0].state==='PENDING'?'DEFERRED':'UNKNOWN'
  }))
}
