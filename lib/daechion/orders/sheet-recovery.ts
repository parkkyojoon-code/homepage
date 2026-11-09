import {randomUUID} from 'node:crypto'
import {z} from 'zod'
import type {LedgerClient} from '../ledger'
import {lockOrder,orderTransaction} from './worker-store'
import {syncOrderSheet,type SheetPorts} from './sheets-worker'

export async function queueSheetRecovery(c:LedgerClient,orderId:string,jobId:string,requestKey:string){
  const pending=(await c.query("SELECT request_key FROM daechion_orders.sheet_recoveries WHERE order_id=$1 AND state IN ('PENDING','RUNNING')",[orderId])).rows
  const blockers=(await c.query("SELECT id,state FROM daechion_orders.jobs WHERE order_id=$1 AND kind='SHEETS' AND state IN ('UNKNOWN','RUNNING')",[orderId])).rows
  if(pending.length||blockers.length!==1||blockers[0].id!==jobId||blockers[0].state!=='UNKNOWN')return false
  await c.query('INSERT INTO daechion_orders.sheet_recoveries(request_key,order_id,job_id) VALUES($1,$2,$3)',[requestKey,orderId,jobId])
  return true
}
export async function deliverOrderSheet(id:string,enabled:boolean,ports:SheetPorts){
  if(!enabled)return 'DISABLED'
  z.string().uuid().parse(id)
  const requested=await ports.withClient(c=>orderTransaction(c,async()=>{
    if(!await lockOrder(c,id))return null
    await c.query("UPDATE daechion_orders.sheet_recoveries SET state='UNKNOWN',result_code='sheet_recovery_interrupted',lease_token=NULL,lease_until=NULL WHERE order_id=$1 AND state='RUNNING' AND lease_until<=now()",[id])
    const rows=(await c.query("SELECT request_key,job_id,state FROM daechion_orders.sheet_recoveries WHERE order_id=$1 AND state IN ('PENDING','RUNNING') ORDER BY created_at LIMIT 1",[id])).rows
    if(!rows.length)return null
    if(rows[0].state==='RUNNING')return {busy:true} as const
    const leaseToken=randomUUID()
    await c.query("UPDATE daechion_orders.sheet_recoveries SET state='RUNNING',lease_token=$2,lease_until=now()+interval '120 seconds' WHERE request_key=$1",[rows[0].request_key,leaseToken])
    return {busy:false,requestKey:String(rows[0].request_key),jobId:String(rows[0].job_id),leaseToken} as const
  }))
  if(!requested)return syncOrderSheet(id,true,ports)
  if(requested.busy)return 'SKIPPED'
  let result='UNKNOWN'
  try{result=await syncOrderSheet(id,true,{...ports,recovery:requested,authorise:async()=>true},true)}catch{}
  return ports.withClient(c=>orderTransaction(c,async()=>{
    await lockOrder(c,id)
    const state=result==='DONE'?'DONE':result==='SKIPPED'?'FAILED':'UNKNOWN'
    const saved=await c.query(`UPDATE daechion_orders.sheet_recoveries SET state=$3,result_code=$4,lease_token=NULL,lease_until=NULL
      WHERE request_key=$1 AND lease_token=$2 AND state='RUNNING' AND lease_until>now() RETURNING state`,
      [requested.requestKey,requested.leaseToken,state,state==='DONE'?null:state==='FAILED'?'sheet_recovery_target_changed':'sheet_recovery_unknown'])
    return saved.rows.length&&state==='DONE'?'DONE':'UNKNOWN'
  }))
}
