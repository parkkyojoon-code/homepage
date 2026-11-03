import { NextResponse } from 'next/server'
import { billingClaimInput,billingResultInput,claimBilling,recordBillingResult } from '@/lib/lectures/billing-queue'
import { requireWorker } from '@/lib/lectures/worker-auth'
import { failure,HttpError } from '@/lib/lectures/http'
export const runtime='nodejs'
export async function POST(request:Request,context:{params:Promise<{action:string}>}){
 try{
  requireWorker(request)
  const text=await request.text();if(text.length>4096)throw new HttpError(413,'요청이 너무 큽니다.')
  const body=JSON.parse(text),{action}=await context.params
  if(action==='claim')return NextResponse.json({job:await claimBilling(billingClaimInput.parse(body).kind)},{headers:{'Cache-Control':'no-store'}})
  if(action==='result')return NextResponse.json(await recordBillingResult(billingResultInput.parse(body)),{headers:{'Cache-Control':'no-store'}})
  throw new HttpError(404,'경로를 찾을 수 없습니다.')
 }catch(e){const r=failure(e);r.headers.set('Cache-Control','no-store');return r}
}
