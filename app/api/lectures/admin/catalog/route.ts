import { NextResponse } from 'next/server'
import { currentAdmin } from '@/lib/lectures/admin-auth'
import { database } from '@/lib/lectures/db'
import { failure, sameOrigin } from '@/lib/lectures/http'
import { createLecture } from '@/lib/lectures/catalog-admin'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    await currentAdmin()
    const { rows } = await database().query('SELECT id,title,description,price_won,sale_status,video_url,version FROM lectures ORDER BY created_at DESC,id')
    return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) { return failure(e) }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request)
    const actor=await currentAdmin()
    return NextResponse.json(await createLecture(actor,await request.json()),{status:201,headers:{'Cache-Control':'private, no-store'}})
  } catch (e) { return failure(e) }
}
