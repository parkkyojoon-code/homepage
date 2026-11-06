import { isAdminAuthed } from '@/lib/admin-auth'
import { withAutomationClient } from '@/lib/daechion/database'
import { daechionClient } from '@/lib/daechion/client'
import { adminGet, adminPost } from '@/lib/daechion/admin-http'

export const runtime='nodejs'
export const dynamic='force-dynamic'
function ports(){
  const origins=[process.env.DAECHION_APP_ORIGIN??'',...(process.env.DAECHION_ADDITIONAL_ORIGINS??'').split(',').filter(Boolean)]
  const valid=origins.every(value=>{try{return new URL(value).origin===value&&['http:','https:'].includes(new URL(value).protocol)}catch{return false}})
  return {authed:isAdminAuthed,enabled:process.env.DAECHION_ADMIN_ENABLED==='true'&&Boolean(process.env.DAECHION_DATABASE_URL)&&valid,origins,withClient:withAutomationClient,
    student:async(id:number)=>{
      if(!process.env.DAECHION_API_KEY||!process.env.DAECHION_TENANT_ID)throw Error('ADMIN_STUDENT_LOOKUP_REQUIRED')
      const client=daechionClient({apiKey:process.env.DAECHION_API_KEY})
      if(String((await client.me()).tenantId)!==process.env.DAECHION_TENANT_ID)throw Error('ADMIN_TENANT_MISMATCH')
      return client.student(id)
    },
  }
}
export async function GET(request:Request){return adminGet(request,ports())}
export async function POST(request:Request){return adminPost(request,ports())}
