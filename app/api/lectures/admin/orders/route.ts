import { NextResponse } from 'next/server'
import { currentAdmin } from '@/lib/lectures/admin-auth'
import { database } from '@/lib/lectures/db'
import { workerConfigured } from '@/lib/lectures/worker-auth'
import { failure } from '@/lib/lectures/http'
import { parseAdminOrderQuery, ADMIN_ORDER_PAGE_SIZE, ADMIN_ORDERS_SQL } from '@/lib/lectures/admin-order-query'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  try {
    await currentAdmin()
    const { status, q, page } = parseAdminOrderQuery(new URL(request.url).searchParams)
    const digits = /^[\d\s()+-]+$/.test(q) ? q.replace(/\D/g,'') : ''
    // One statement gives the total and the page the same database snapshot.
    // strpos treats percent, underscore and quotes as literal text, not SQL patterns.
    const { rows } = await database().query(ADMIN_ORDERS_SQL,
      [status === 'pending' ? ['CREATED','AWAITING_PAYMENT'] : status === 'paid' ? ['PAID'] : status === 'all' ? ['CREATED','AWAITING_PAYMENT','PAID','CANCELLED','EXPIRED','REFUNDED'] : ['CANCELLED'],q,digits,ADMIN_ORDER_PAGE_SIZE,(page-1)*ADMIN_ORDER_PAGE_SIZE,status === 'corrected'])
    return NextResponse.json({ orders: rows[0].orders, total: rows[0].total, page, pageSize: ADMIN_ORDER_PAGE_SIZE,workerEnabled:workerConfigured() }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) { const response = failure(e); response.headers.set('Cache-Control','private, no-store'); return response }
}
