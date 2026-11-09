import {randomUUID} from 'node:crypto'
import type {LedgerClient} from '../ledger'
export async function orderTransaction<T>(client:LedgerClient,run:()=>Promise<T>){
  await client.query('BEGIN')
  try{const result=await run();await client.query('COMMIT');return result}catch(error){await client.query('ROLLBACK');throw error}
}
export async function lockOrder(client:LedgerClient,id:string){
  return (await client.query('SELECT *,now() AS observed_at FROM daechion_orders.orders WHERE id=$1 FOR UPDATE',[id])).rows[0]
}
export async function orderChanged(client:LedgerClient,id:string,event:string){
  if(!/^[a-z_]{1,64}$/.test(event))throw Error('INVALID_ORDER_EVENT')
  const version=(await client.query<{version:string}>('UPDATE daechion_orders.orders SET version=version+1,updated_at=now() WHERE id=$1 RETURNING version::text',[id])).rows[0].version
  await client.query('INSERT INTO daechion_orders.events(order_id,kind) VALUES($1,$2)',[id,event])
  await client.query("INSERT INTO daechion_orders.jobs(id,order_id,kind,event_version) VALUES($1,$2,'SHEETS',$3)",[randomUUID(),id,version])
  return version
}
export async function holdOrder(client:LedgerClient,id:string,code:string){
  if(!/^[a-z_]{1,64}$/.test(code))throw Error('INVALID_ORDER_REVIEW')
  await client.query("UPDATE daechion_orders.orders SET checkout_state='REVIEW',review_code=CASE WHEN review_code IS NULL OR review_code IN ('payment_query_unknown','unpaid_wait_closed') THEN $2 ELSE review_code END WHERE id=$1",[id,code])
  await client.query("UPDATE daechion_orders.grants SET state='REVIEW',review_code='order_held',lease_token=NULL,lease_until=NULL WHERE order_id=$1 AND state='RUNNING'",[id])
  await client.query("UPDATE daechion_orders.jobs SET state=CASE WHEN state='RUNNING' THEN 'UNKNOWN' ELSE 'FAILED' END,last_error=$2,lease_token=NULL,lease_until=NULL WHERE order_id=$1 AND kind='READY_MESSAGE' AND state IN ('PENDING','RUNNING')",[id,code])
  await client.query("UPDATE daechion_orders.ready_receipts SET state='BLOCKED' WHERE order_id=$1 AND state='PENDING'",[id])
  await client.query("UPDATE daechion_orders.orders SET notification_state=CASE WHEN EXISTS(SELECT 1 FROM daechion_orders.jobs WHERE order_id=$1 AND kind='READY_MESSAGE' AND state='UNKNOWN') THEN 'UNKNOWN' ELSE 'FAILED' END WHERE id=$1 AND notification_state='PENDING'",[id])
  await orderChanged(client,id,code)
}
export interface OrderConnection {withClient<T>(run:(client:LedgerClient)=>Promise<T>):Promise<T>}
export const eligible=(client:LedgerClient,id:string)=>client.query<{ok:boolean}>('SELECT daechion_orders.paid_eligible($1) AS ok',[id]).then(r=>r.rows[0].ok)
