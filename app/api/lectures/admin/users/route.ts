import { NextResponse } from 'next/server'
import { z } from 'zod'
import { currentAdmin } from '@/lib/lectures/admin-auth'
import { database } from '@/lib/lectures/db'
import { failure } from '@/lib/lectures/http'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(request:Request){
 try{
  await currentAdmin()
  const q=z.string().trim().min(2,'검색어를 2자 이상 입력해주세요.').max(50).parse(new URL(request.url).searchParams.get('q')??'')
  const {rows}=await database().query(`SELECT id,username,name,phone,credential_version,must_change_password,
    password_expires_at,disabled_at FROM lecture_users WHERE strpos(lower(username),lower($1))>0
    OR strpos(lower(name),lower($1))>0 OR strpos(phone,$1)>0 ORDER BY username,id LIMIT 21`,[q])
  return NextResponse.json({users:rows.slice(0,20),hasMore:rows.length>20},{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){const r=failure(e);r.headers.set('Cache-Control','private, no-store');return r}
}
