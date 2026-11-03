import { NextResponse } from 'next/server'
import { z } from 'zod'
import { currentAdmin } from '@/lib/lectures/admin-auth'
import { updateLecture } from '@/lib/lectures/catalog-admin'
import { failure,sameOrigin } from '@/lib/lectures/http'
export const runtime='nodejs'
export async function PUT(request:Request,context:{params:Promise<{id:string}>}){
 try{
  sameOrigin(request)
  const actor=await currentAdmin(),id=z.string().uuid().parse((await context.params).id)
  return NextResponse.json(await updateLecture(actor,id,await request.json()),{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){const r=failure(e);r.headers.set('Cache-Control','private, no-store');return r}
}
