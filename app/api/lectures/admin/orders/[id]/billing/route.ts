import { NextResponse } from 'next/server'
import { z } from 'zod'
import { currentAdmin } from '@/lib/lectures/admin-auth'
import { refreshBillingInput,requestBillingRefresh } from '@/lib/lectures/admin-billing'
import { database } from '@/lib/lectures/db'
import { workerConfigured } from '@/lib/lectures/worker-auth'
import { failure,HttpError,sameOrigin } from '@/lib/lectures/http'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 try{
  sameOrigin(request)
  const actor=await currentAdmin(),id=z.string().uuid().parse((await context.params).id)
  if(!workerConfigured())throw new HttpError(503,'자동 조회 연결이 비활성 상태입니다. 결제선생을 직접 확인하고 수동 처리해주세요.')
  return NextResponse.json(await requestBillingRefresh(actor,id,refreshBillingInput.parse(await request.json())),{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){const r=failure(e);r.headers.set('Cache-Control','private, no-store');return r}
}
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
 try{
  await currentAdmin()
  const id=z.string().uuid().parse((await context.params).id)
  const events=await database().query(`SELECT id,kind,applied,created_at,
    result->'report'->>'state' AS state,result->'report'->>'outcome' AS send_outcome,
    result->'report'->>'amountWon' AS amount_won,result->'outcome'->>'approved' AS approved,
    result->'outcome'->>'reviewReason' AS review_reason
    FROM lecture_billing_events WHERE order_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50`,[id])
  const refreshes=await database().query(`SELECT actor_name,requested_at,completed_at,result_event_id
    FROM lecture_billing_refreshes WHERE order_id=$1 ORDER BY sequence DESC LIMIT 50`,[id])
  return NextResponse.json({events:events.rows,refreshes:refreshes.rows},{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){const r=failure(e);r.headers.set('Cache-Control','private, no-store');return r}
}
