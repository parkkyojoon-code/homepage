import {createHash} from 'node:crypto'
import type {LedgerClient} from '../ledger'
import {orderTransaction,lockOrder,orderChanged,type OrderConnection} from './worker-store'

export interface SchedulerFlags {send:boolean;read:boolean;enroll:boolean;message:boolean;sheets:boolean}
type EventClient=LedgerClient&{on?(event:string,listener:()=>void):unknown;removeListener?(event:string,listener:()=>void):unknown}
// This connection holds a session lock, never an idle transaction. A disconnect
// invalidates every subsequent phase; existing write-ahead markers remain intact.
export async function withSchedulerLock<T>(withClient:OrderConnection['withClient'],tenantId:string,run:(assert:()=>Promise<void>)=>Promise<T>):Promise<T|null>{
  const key=createHash('sha256').update(tenantId).digest().readInt32BE(0)
  return withClient(async raw=>{
    const c=raw as EventClient;let held=false,lost=false
    const disconnect=()=>{lost=true}
    c.on?.('error',disconnect);c.on?.('end',disconnect)
    try{
      held=(await c.query('SELECT pg_try_advisory_lock(61134,$1) AS locked',[key])).rows[0]?.locked===true
      if(!held)return null
      const assert=async()=>{if(lost)throw Error('ORDER_SCHEDULER_CONNECTION_LOST');await c.query('SELECT 1');if(lost)throw Error('ORDER_SCHEDULER_CONNECTION_LOST')}
      const result=await run(assert);await assert();return result
    }finally{
      let failed=false
      if(held&&!lost)try{if((await c.query('SELECT pg_advisory_unlock(61134,$1) AS unlocked',[key])).rows[0]?.unlocked!==true)failed=true}catch{failed=true}
      c.removeListener?.('error',disconnect);c.removeListener?.('end',disconnect)
      if(lost||failed)throw Error('ORDER_SCHEDULER_CONNECTION_LOST')
    }
  })
}
export async function selectScheduledOrders(c:LedgerClient,tenantId:string,f:SchedulerFlags){
  return (await c.query(`SELECT o.id,o.request_fingerprint,
      EXISTS(SELECT 1 FROM daechion_orders.grants WHERE order_id=o.id AND state IN ('PENDING','RUNNING')) AS needs_enrollment FROM daechion_orders.orders o
    LEFT JOIN daechion_orders.scheduler_orders s ON s.order_id=o.id
    WHERE o.tenant_id=$1 AND (s.order_id IS NULL OR s.next_run_at<=now() OR s.last_version<o.version)
    AND (($2::boolean AND o.checkout_state='READY' AND o.payment_state='PENDING' AND o.review_code IS NULL
      AND NOT EXISTS(SELECT 1 FROM daechion_orders.bills WHERE order_id=o.id))
      OR ($3::boolean AND EXISTS(SELECT 1 FROM daechion_orders.bills WHERE order_id=o.id AND is_current AND state IN ('SENT','SEND_UNKNOWN')))
      OR ($4::boolean AND o.checkout_state='READY' AND o.payment_state='PAID' AND EXISTS(SELECT 1 FROM daechion_orders.grants WHERE order_id=o.id AND state IN ('PENDING','RUNNING')))
      OR ($5::boolean AND EXISTS(SELECT 1 FROM daechion_orders.jobs WHERE order_id=o.id AND kind='READY_MESSAGE'
        AND (state='PENDING' AND available_at<=now() OR state='RUNNING' AND lease_until<=now())))
      OR ($6::boolean AND (EXISTS(SELECT 1 FROM daechion_orders.jobs WHERE order_id=o.id AND kind='SHEETS'
        AND (state='PENDING' AND available_at<=now() OR state='RUNNING' AND lease_until<=now()))
        OR EXISTS(SELECT 1 FROM daechion_orders.sheet_recoveries WHERE order_id=o.id AND (state='PENDING' OR state='RUNNING' AND lease_until<=now())))))
    ORDER BY COALESCE(s.next_run_at,o.created_at),o.created_at,o.id LIMIT 10`,[tenantId,f.send,f.read,f.enroll,f.message,f.sheets])).rows
}
export async function startScheduledOrder(c:LedgerClient,id:string){
  await c.query(`INSERT INTO daechion_orders.scheduler_orders(order_id,last_version,started_at,next_run_at)
    SELECT id,version,now(),now()+interval '60 seconds' FROM daechion_orders.orders WHERE id=$1
    ON CONFLICT(order_id) DO UPDATE SET last_version=EXCLUDED.last_version,started_at=EXCLUDED.started_at,next_run_at=EXCLUDED.next_run_at`,[id])
}
export async function finishScheduledOrder(c:LedgerClient,id:string,failed:boolean,f:SchedulerFlags){
  await c.query(`UPDATE daechion_orders.scheduler_orders s SET finished_at=now(),result=$2,last_version=o.version,
    next_run_at=now()+CASE WHEN $3::boolean THEN interval '60 seconds'
      WHEN o.checkout_state='READY' AND (o.payment_state='PENDING' AND ($6::boolean OR $8::boolean) OR $7::boolean AND EXISTS(SELECT 1 FROM daechion_orders.grants WHERE order_id=o.id AND state IN ('PENDING','RUNNING')) OR $5::boolean AND o.notification_state='PENDING')
      OR EXISTS(SELECT 1 FROM daechion_orders.jobs WHERE order_id=o.id AND state='PENDING' AND (kind='SHEETS' AND $4::boolean OR kind='READY_MESSAGE' AND $5::boolean)) THEN interval '30 seconds' ELSE interval '5 minutes' END
    FROM daechion_orders.orders o WHERE s.order_id=$1 AND o.id=s.order_id`,[id,failed?'FAILED':'OK',failed,f.sheets,f.message,f.read,f.enroll,f.send])
}
export async function sessionReady(ports:OrderConnection,tenantId:string,refresh:()=>Promise<{refreshed?:boolean}>){
  const row=await ports.withClient(async c=>(await c.query('SELECT state,next_check_at>now() AS fresh FROM daechion_orders.scheduler_sessions WHERE tenant_id=$1',[tenantId])).rows[0])
  if(row?.fresh)return row.state==='READY'
  // Record uncertainty before launching the browser; a crash never reports READY.
  await ports.withClient(c=>c.query(`INSERT INTO daechion_orders.scheduler_sessions(tenant_id,state,checked_at,next_check_at) VALUES($1,'UNKNOWN',now(),now()+interval '60 seconds')
    ON CONFLICT(tenant_id) DO UPDATE SET state='UNKNOWN',checked_at=now(),next_check_at=now()+interval '60 seconds'`,[tenantId]))
  let ready=false;try{ready=(await refresh())?.refreshed===true}catch{/* Do not persist provider errors or credentials. */}
  await ports.withClient(c=>c.query(`UPDATE daechion_orders.scheduler_sessions SET state=$2,checked_at=now(),next_check_at=now()+CASE WHEN $3::boolean THEN interval '15 minutes' ELSE interval '60 seconds' END WHERE tenant_id=$1`,[tenantId,ready?'READY':'FAILED',ready]))
  return ready
}
export async function recordSessionIssue(ports:OrderConnection,id:string,healthy:boolean){
  return ports.withClient(c=>orderTransaction(c,async()=>{
    const o=await lockOrder(c,id);if(!o)return
    const issue=!healthy&&o.checkout_state==='READY'&&o.payment_state==='PAID'&&
      (await c.query("SELECT 1 FROM daechion_orders.grants WHERE order_id=$1 AND state IN ('PENDING','RUNNING')",[id])).rows.length>0
    const changed=await c.query('UPDATE daechion_orders.scheduler_orders SET session_issue=$2 WHERE order_id=$1 AND session_issue IS DISTINCT FROM $2 RETURNING order_id',[id,issue])
    if(changed.rows.length)await orderChanged(c,id,issue?'browser_session_unavailable':'browser_session_restored')
  }))
}
