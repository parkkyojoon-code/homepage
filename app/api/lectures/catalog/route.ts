import { NextResponse } from 'next/server'
import { database } from '@/lib/lectures/db'
import { failure } from '@/lib/lectures/http'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const { rows } = await database().query('SELECT id,title,description,price_won FROM lectures WHERE sale_status=\'ON_SALE\' ORDER BY created_at DESC')
    return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error) }
}
