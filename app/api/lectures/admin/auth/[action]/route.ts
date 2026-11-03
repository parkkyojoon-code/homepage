import { NextResponse } from 'next/server'
import { z } from 'zod'
import { currentAdmin, loginAdmin, logoutAdmin } from '@/lib/lectures/admin-auth'
import { failure, HttpError, sameOrigin } from '@/lib/lectures/http'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const credentials = z.object({username:z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,40}$/),password:z.string().min(1).max(128)}).strict()
export async function GET(_request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    if ((await context.params).action!=='me') throw new HttpError(404,'경로를 찾을 수 없습니다.')
    const { id,username,name,role } = await currentAdmin()
    return NextResponse.json({id,username,name,role},{headers:{'Cache-Control':'private, no-store'}})
  } catch (e) { const r=failure(e); r.headers.set('Cache-Control','private, no-store'); return r }
}
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    sameOrigin(request)
    const {action} = await context.params
    if (action==='login') { const d=credentials.parse(await request.json()); await loginAdmin(d.username,d.password) }
    else if (action==='logout') await logoutAdmin()
    else throw new HttpError(404,'경로를 찾을 수 없습니다.')
    return NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}})
  } catch (e) { const r=failure(e); r.headers.set('Cache-Control','private, no-store'); return r }
}
