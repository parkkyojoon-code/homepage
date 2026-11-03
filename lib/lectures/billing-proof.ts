import type { QueryClient } from './admin-domain'
import { HttpError } from './http'

export const CAN_REFRESH_BILL_SQL="COALESCE((b.state IN ('SENT','UNKNOWN') OR (b.state='SENDING' AND b.lease_until<=now())),false)"

// Shared by the admin preview and the transaction guard. Aliases: o=order, b=billing, e=checked event.
export const FRESH_PAID_READ_SQL=`COALESCE((
 b.state='SENT' AND b.last_state='F' AND b.last_amount_won=o.total_won
 AND b.checked_order_version=o.version AND b.checked_at>now()-interval '5 minutes' AND b.checked_at<=now()
 AND b.lease_hash IS NULL AND e.kind='READ' AND e.applied
 AND e.result->'report'->>'state'='F' AND e.result->'report'->>'amountWon'=o.total_won::text
 AND e.result->'report'->>'billId'=b.bill_id AND e.result->'report'->>'echoedBillId'=b.bill_id
 AND NOT EXISTS(SELECT 1 FROM lecture_billing_refreshes f WHERE f.order_id=o.id AND f.completed_at IS NULL)
 ),false)`

export async function requireFreshPaidRead(client:QueryClient,orderId:string){
 const {rows}=await client.query(`SELECT ${FRESH_PAID_READ_SQL} AS ready,b.checked_event_id AS event_id FROM lecture_orders o
   JOIN lecture_billing_requests b ON b.order_id=o.id
   LEFT JOIN lecture_billing_events e ON e.id=b.checked_event_id AND e.order_id=b.order_id
   WHERE o.id=$1 FOR UPDATE OF b`,[orderId])
 if(!rows[0]?.ready)throw new HttpError(409,'현재 주문에 대한 새 결제 조회를 완료한 뒤 다시 시도해주세요. 수동 처리는 유지됩니다.','FRESH_PAYMENT_LOOKUP_REQUIRED')
 return rows[0].event_id as string
}
