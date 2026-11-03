import { NextResponse } from 'next/server'
import { z } from 'zod'
import { activateAdmin } from '@/lib/lectures/admin-accounts'
import { failure,sameOrigin } from '@/lib/lectures/http'
export const runtime='nodejs'
export async function POST(request:Request){
  try{
    sameOrigin(request)
    const d=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),password:z.string().min(12).max(128)}).strict().parse(await request.json())
    return NextResponse.json(await activateAdmin(d.token,d.password),{headers:{'Cache-Control':'private, no-store'}})
  }catch(e){const r=failure(e);r.headers.set('Cache-Control','private, no-store');return r}
}
