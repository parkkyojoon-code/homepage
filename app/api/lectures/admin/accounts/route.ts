import { NextResponse } from 'next/server'
import { currentAdmin } from '@/lib/lectures/admin-auth'
import { accountCommand,manageAccount } from '@/lib/lectures/admin-accounts'
import { database } from '@/lib/lectures/db'
import { failure,HttpError,sameOrigin } from '@/lib/lectures/http'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(){
  try{
    const actor=await currentAdmin();if(actor.role!=='OWNER')throw new HttpError(403,'총괄 관리자만 계정을 관리할 수 있습니다.')
    const {rows}=await database().query("SELECT id,username,name,role,disabled_at,version,(password_hash='INVITED') AS invited FROM lecture_admin_users ORDER BY created_at,id")
    return NextResponse.json({accounts:rows},{headers:{'Cache-Control':'private, no-store'}})
  }catch(e){const r=failure(e);r.headers.set('Cache-Control','private, no-store');return r}
}
export async function POST(request:Request){
  try{
    sameOrigin(request)
    const actor=await currentAdmin()
    return NextResponse.json(await manageAccount(actor,accountCommand.parse(await request.json())),{headers:{'Cache-Control':'private, no-store'}})
  }catch(e){const r=failure(e);r.headers.set('Cache-Control','private, no-store');return r}
}
