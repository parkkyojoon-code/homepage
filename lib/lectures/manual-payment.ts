import { randomUUID } from 'node:crypto'
import { transaction } from './db'
import { HttpError } from './http'
import { manualConfirmation, mayManuallyConfirm } from './manual-input'
import type { z } from 'zod'
import type { PoolClient } from 'pg'

export async function confirmManualPayment(orderId: string, input: z.infer<typeof manualConfirmation>) {
  return transaction(client => confirmWithinTransaction(client,orderId,input))
}
export async function confirmWithinTransaction(client: Pick<PoolClient,'query'>, orderId: string, input: z.infer<typeof manualConfirmation>) {
    manualConfirmation.parse(input)
    const { rows } = await client.query('SELECT id,user_id,status,total_won FROM lecture_orders WHERE id=$1 FOR UPDATE', [orderId])
    const order = rows[0]
    if (!order) throw new HttpError(404, '주문을 찾을 수 없습니다.')
    if (order.total_won !== input.expectedTotalWon) throw new HttpError(409, '주문 금액이 다릅니다. 새로고침 후 확인해주세요.')
    const existing = await client.query('SELECT operator_name,note,confirmed_at FROM lecture_manual_confirmations WHERE order_id=$1', [orderId])
    if (order.status === 'PAID' && existing.rows[0]) return { id: orderId, status: 'PAID', confirmation: existing.rows[0], alreadyConfirmed: true }
    if (!mayManuallyConfirm(order.status) || existing.rowCount) throw new HttpError(409, '현재 상태에서는 수동 승인할 수 없습니다.')
    const items = await client.query('SELECT id,lecture_id,price_won FROM lecture_order_items WHERE order_id=$1 ORDER BY id FOR SHARE', [orderId])
    if (!items.rows.length || items.rows.reduce((sum, item) => sum + item.price_won, 0) !== order.total_won) throw new HttpError(409, '주문 명세와 금액이 일치하지 않습니다. 관리자 확인이 필요합니다.')
    // The audit record, order and grants all commit together or roll back together.
    const confirmation = await client.query('INSERT INTO lecture_manual_confirmations(order_id,amount_won,operator_name,note) VALUES($1,$2,$3,$4) RETURNING operator_name,note,confirmed_at', [orderId, order.total_won, input.operatorName, input.note])
    for (const item of items.rows) {
      const result = await client.query('INSERT INTO lecture_entitlements(id,user_id,lecture_id,order_item_id) VALUES($1,$2,$3,$4) ON CONFLICT(order_item_id) DO NOTHING RETURNING id', [randomUUID(),order.user_id,item.lecture_id,item.id])
      if (!result.rowCount) throw new HttpError(409, '기존 수강 권한 기록을 먼저 확인해주세요.')
    }
    await client.query("UPDATE lecture_orders SET status='PAID' WHERE id=$1", [orderId])
    return { id: orderId, status: 'PAID', confirmation: confirmation.rows[0], alreadyConfirmed: false }
}
