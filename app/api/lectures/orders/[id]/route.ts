import { NextResponse } from 'next/server'
import { z } from 'zod'
import { currentUser } from '@/lib/lectures/auth'
import { database } from '@/lib/lectures/db'
import { failure, HttpError } from '@/lib/lectures/http'
export const runtime = 'nodejs'
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser()
    const id = z.string().uuid().parse((await context.params).id)
    const { rows } = await database().query('SELECT id,status,total_won,created_at,access_control,recipient_type,recipient_name,recipient_phone FROM lecture_orders WHERE id=$1 AND user_id=$2', [id, user.id])
    if (!rows[0]) throw new HttpError(404, '주문을 찾을 수 없습니다.')
    const items = await database().query('SELECT lecture_id,title_snapshot,price_won FROM lecture_order_items WHERE order_id=$1', [id])
    const billing=await database().query('SELECT state,sent_at,due_at,last_state,checked_at,needs_review FROM lecture_billing_requests WHERE order_id=$1',[id])
    return NextResponse.json({ ...rows[0], items: items.rows,billing:billing.rows[0]??null }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error) }
}
