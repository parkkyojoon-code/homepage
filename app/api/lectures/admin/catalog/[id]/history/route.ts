import { NextResponse } from 'next/server'
import { z } from 'zod'
import { currentAdmin } from '@/lib/lectures/admin-auth'
import { database } from '@/lib/lectures/db'
import { failure } from '@/lib/lectures/http'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
 try{
  await currentAdmin()
  const id=z.string().uuid().parse((await context.params).id)
  const {rows}=await database().query(`SELECT actor_name,action,version,before_state,after_state,created_at
    FROM lecture_catalog_changes WHERE lecture_id=$1 ORDER BY version DESC LIMIT 50`,[id])
  return NextResponse.json({changes:rows},{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){const r=failure(e);r.headers.set('Cache-Control','private, no-store');return r}
}
