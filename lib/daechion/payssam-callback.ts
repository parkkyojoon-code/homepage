import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

const receiptSchema = z.object({ apikey:z.string().min(1).max(256),bill_id:z.string().regex(/^\d{20}$/),appr_state:z.enum(['F','W','C','D']) })
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}})

// Receipt acknowledgement only: deliberately has no database/provider ports.
// The polling worker must independently re-read the bill, account, amount and time.
// Callback financial fields and the API key must never be persisted or logged.
export async function payssamCallback(request:Request,env:Record<string,string|undefined>) {
  if(env.DAECHION_PAYSSAM_CALLBACK_ENABLED!=='true'||!env.PAYSSAM_API_KEY?.trim())return reply({code:'CALLBACK_UNAVAILABLE'},503)
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return reply({code:'INVALID_REQUEST'},415)
  try {
    const reader=request.body?.getReader()
    if(!reader)return reply({code:'INVALID_REQUEST'},400)
    const chunks:Uint8Array[]=[];let size=0
    while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength
      if(size>8192){await reader.cancel();return reply({code:'INVALID_REQUEST'},413)}chunks.push(next.value)}
    const parsed=receiptSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')))
    if(!parsed.success)return reply({code:'INVALID_REQUEST'},400)
    const digest=(value:string)=>createHash('sha256').update(value).digest()
    if(!timingSafeEqual(digest(parsed.data.apikey),digest(env.PAYSSAM_API_KEY)))return reply({code:'UNAUTHORIZED'},401)
    return reply({code:'0000',msg:'OK'})
  }catch{return reply({code:'INVALID_REQUEST'},400)}
}
