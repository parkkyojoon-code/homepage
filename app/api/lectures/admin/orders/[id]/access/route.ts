import { NextResponse } from 'next/server'
import { z } from 'zod'
import { currentAdmin } from '@/lib/lectures/admin-auth'
import { accessCommand, changeOrderAccess } from '@/lib/lectures/admin-access'
import { database } from '@/lib/lectures/db'
import { workerConfigured } from '@/lib/lectures/worker-auth'
import { failure, HttpError, sameOrigin } from '@/lib/lectures/http'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    sameOrigin(request)
    const actor=await currentAdmin()
    const id=z.string().uuid().parse((await context.params).id)
    const input=accessCommand.parse(await request.json())
    if(input.action==='RESUME_AUTO'&&!workerConfigured())throw new HttpError(503,'자동 조회 연결이 비활성 상태입니다. 주문 상태를 새로고침해 확인해주세요.')
    return NextResponse.json(await changeOrderAccess(actor,id,input),{headers:{'Cache-Control':'private, no-store'}})
  }catch(e){const r=failure(e);r.headers.set('Cache-Control','private, no-store');return r}
}
export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  try {
    await currentAdmin()
    const id=z.string().uuid().parse((await context.params).id)
    const {rows}=await database().query(`SELECT action,actor_name,reason,checked_at,before_state,after_state,created_at
      FROM lecture_admin_actions WHERE order_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100`,[id])
    return NextResponse.json({actions:rows},{headers:{'Cache-Control':'private, no-store'}})
  }catch(e){const r=failure(e);r.headers.set('Cache-Control','private, no-store');return r}
}
