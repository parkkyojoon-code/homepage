import { isAdminAuthed } from '@/lib/admin-auth'
import { lectureCatalog } from '@/lib/daechion/class-binding'
export const dynamic='force-dynamic'
export async function GET(){
  const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex'}
  if(!await isAdminAuthed())return Response.json({error:'로그인이 필요합니다.'},{status:401,headers})
  try{return Response.json(await lectureCatalog(process.env),{headers})}
  catch{return Response.json({error:'대치온 강의 목록을 확인하지 못했습니다. 연결 설정과 접근 권한을 확인해주세요.'},{status:503,headers})}
}
