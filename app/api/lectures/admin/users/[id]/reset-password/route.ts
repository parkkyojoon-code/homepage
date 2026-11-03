import { NextResponse } from 'next/server'
import { z } from 'zod'
import { currentAdmin } from '@/lib/lectures/admin-auth'
import { resetBuyerInput,resetBuyerPassword } from '@/lib/lectures/buyer-recovery'
import { failure,sameOrigin } from '@/lib/lectures/http'
export const runtime='nodejs'
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 try{
  sameOrigin(request)
  const actor=await currentAdmin(),id=z.string().uuid().parse((await context.params).id)
  return NextResponse.json(await resetBuyerPassword(actor,id,resetBuyerInput.parse(await request.json())),{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){const r=failure(e);r.headers.set('Cache-Control','private, no-store');return r}
}
