import {isAdminAuthed} from '@/lib/admin-auth'
import {withAutomationClient} from '@/lib/daechion/database'
import {orderAdminGet,orderAdminPost} from '@/lib/daechion/orders/admin-http'
import type {LedgerClient} from '@/lib/daechion/ledger'
export const runtime='nodejs'
export const dynamic='force-dynamic'
function ports(){
  const origins=[process.env.DAECHION_APP_ORIGIN??'',...(process.env.DAECHION_ADDITIONAL_ORIGINS??'').split(',').filter(Boolean)]
  const valid=origins.every(value=>{try{const url=new URL(value);return url.origin===value&&(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))}catch{return false}})
  return {authed:isAdminAuthed,tenantId:process.env.DAECHION_TENANT_ID?.trim()??'',origins,
    enabled:process.env.DAECHION_ADMIN_ENABLED==='true'&&process.env.DAECHION_ORDER_ADMIN_ENABLED==='true'&&Boolean(process.env.DAECHION_DATABASE_URL)&&valid,
    withClient:withAutomationClient,ready:async(c:LedgerClient)=>{
      await c.query('SELECT request_key,after_version FROM daechion_orders.admin_actions LIMIT 0')
    }}
}
export async function GET(request:Request){return orderAdminGet(request,ports())}
export async function POST(request:Request){return orderAdminPost(request,ports())}
