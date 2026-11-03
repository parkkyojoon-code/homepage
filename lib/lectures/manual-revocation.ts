import type { PoolClient } from 'pg'
import type { z } from 'zod'
import { transaction } from './db'
import { HttpError } from './http'
import { manualRevocation, mayRevokeManualConfirmation } from './manual-input'

type Input = z.infer<typeof manualRevocation>
export function revokeManualConfirmation(orderId: string, input: Input) {
  return transaction(client => revokeWithinTransaction(client,orderId,input))
}
// Caller must hold a transaction. Exported so the SQL can be integration-tested separately.
export async function revokeWithinTransaction(client: Pick<PoolClient,'query'>, orderId: string, input: Input) {
  manualRevocation.parse(input)
  const { rows } = await client.query('SELECT id,user_id,status,total_won FROM lecture_orders WHERE id=$1 FOR UPDATE', [orderId])
  const order = rows[0]
  if (!order) throw new HttpError(404, '주문을 찾을 수 없습니다.')
  if (order.total_won !== input.expectedTotalWon) throw new HttpError(409, '주문 금액이 다릅니다. 새로고침해주세요.')
  const previous = await client.query('SELECT operator_name,note,revoked_at FROM lecture_manual_revocations WHERE order_id=$1', [orderId])
  if (previous.rows[0] && order.status === 'CANCELLED') return { id: orderId, status: 'CANCELLED', alreadyRevoked: true, correction: previous.rows[0] }
  const approval = await client.query('SELECT order_id FROM lecture_manual_confirmations WHERE order_id=$1', [orderId])
  if (previous.rowCount || !mayRevokeManualConfirmation(order.status, Boolean(approval.rowCount))) throw new HttpError(409, '수동 승인된 결제 완료 주문만 정정할 수 있습니다.')
  const audit = await client.query('INSERT INTO lecture_manual_revocations(order_id,operator_name,note) VALUES($1,$2,$3) RETURNING operator_name,note,revoked_at', [orderId,input.operatorName,input.note])
  // Only grants sourced from this order are revoked. Other purchases stay valid.
  await client.query(`UPDATE lecture_entitlements e SET revoked_at=now()
    FROM lecture_order_items i WHERE e.order_item_id=i.id AND i.order_id=$1 AND e.revoked_at IS NULL`, [orderId])
  await client.query("UPDATE lecture_orders SET status='CANCELLED' WHERE id=$1", [orderId])
  return { id: orderId, status: 'CANCELLED', alreadyRevoked: false, correction: audit.rows[0] }
}
