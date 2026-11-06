import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { applicationSnapshotSchema, type LedgerClient } from './ledger'
import { normalizePhone } from './client'
import { automationTransaction, automationChanged } from './automation-store'

export const lmsText=(name:string,title:string)=>`안녕하세요. 박교준 수리논술입니다.\n${name} 학생의 ${title} 수강 등록이 완료되었습니다.\nhttps://parkkyojoon.daechion.com\n학생 번호 또는 등록한 보호자 번호로 로그인해주세요.\n기존 계정은 사용하던 비밀번호를 사용해주세요. 처음 생성된 계정의 초기 비밀번호는 해당 로그인 번호 뒤 4자리입니다.`
export interface ReadyMessageProvider {send(input:{receiptId:string;phone:string;text:string}):Promise<{accepted:boolean;messageId?:string}>}
export function solapiReadyProvider(settings:{apiKey:string;apiSecret:string;sender:string;fetcher?:typeof fetch}):ReadyMessageProvider {
  if(!settings.apiKey?.trim()||!settings.apiSecret?.trim()||!/^\d{8,11}$/.test(settings.sender))throw Error('READY_MESSAGE_CONFIGURATION_REQUIRED')
  return {async send(input){
    try{
      z.string().uuid().parse(input.receiptId);const phone=normalizePhone(input.phone)
      if(Buffer.byteLength(input.text,'utf8')>2000)return {accepted:false}
      const date=new Date().toISOString(),salt=randomBytes(16).toString('hex')
      const signature=createHmac('sha256',settings.apiSecret).update(date+salt).digest('hex')
      const response=await (settings.fetcher??fetch)('https://api.solapi.com/messages/v4/send-many/detail',{
        method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',Authorization:`HMAC-SHA256 apiKey=${settings.apiKey}, date=${date}, salt=${salt}, signature=${signature}`},
        body:JSON.stringify({messages:[{to:phone,from:settings.sender,type:'LMS',subject:'박교준 수강 안내',text:input.text,customFields:{pkjmathReceiptId:input.receiptId}}],showMessageList:true,allowDuplicates:false}),
      })
      if(!response.ok)return {accepted:false}
      const parsed=z.object({groupInfo:z.object({count:z.object({registeredSuccess:z.literal(1),registeredFailed:z.literal(0)})}),failedMessageList:z.array(z.unknown()).max(0).optional(),
        messageList:z.tuple([z.object({messageId:z.string().min(1).max(120),statusCode:z.literal('2000'),customFields:z.object({pkjmathReceiptId:z.literal(input.receiptId)})})]),
      }).safeParse(await response.json())
      return parsed.success?{accepted:true,messageId:parsed.data.messageList[0].messageId}:{accepted:false}
    }catch{return {accepted:false}}
  }}
}
async function eligible(client:LedgerClient,id:string) {
  const row=(await client.query(`SELECT a.*,i.status AS identity_status FROM daechion_automation.applications a
    JOIN daechion_automation.identity_checks i ON i.application_id=a.id WHERE a.id=$1`,[id])).rows[0]
  if(!row||row.payment_state!=='PAID'||row.identity_status!=='PASSED'||row.automation_state==='REVOKED')return null
  if(!row.manual_access_action&&(row.automation_state!=='ACTIVE'||row.review_code!==null))return null
  if((await client.query("SELECT lecture_id FROM daechion_automation.registrations WHERE application_id=$1 AND state<>'DONE'",[id])).rows.length)return null
  if(!(await client.query('SELECT lecture_id FROM daechion_automation.registrations WHERE application_id=$1',[id])).rows.length)return null
  return row
}
export async function queueReadyMessage(client:LedgerClient,id:string,version:string) {
  const app=await eligible(client,id)
  if(!app||app.notification_state==='SENT'||app.notification_state==='UNKNOWN')return
  if((await client.query("SELECT id FROM daechion_automation.outbox WHERE application_id=$1 AND kind='READY_MESSAGE' AND state IN ('PENDING','RUNNING','UNKNOWN','DONE')",[id])).rows.length)return
  await client.query("UPDATE daechion_automation.applications SET notification_state='PENDING' WHERE id=$1",[id])
  await client.query("INSERT INTO daechion_automation.outbox(id,application_id,kind,event_version) VALUES($1,$2,'READY_MESSAGE',$3)",[randomUUID(),id,version])
}
export async function sendOneReadyMessage(ports:{provider:ReadyMessageProvider;withClient<T>(run:(client:LedgerClient)=>Promise<T>):Promise<T>}) {
  const job=await ports.withClient(client=>automationTransaction(client,async()=>{
    const stale=(await client.query("SELECT application_id FROM daechion_automation.outbox WHERE kind='READY_MESSAGE' AND state='RUNNING' AND lease_until<=now() ORDER BY application_id")).rows
    for(const item of stale){
      await client.query('SELECT id FROM daechion_automation.applications WHERE id=$1 FOR UPDATE',[item.application_id])
      const changed=await client.query("UPDATE daechion_automation.outbox SET state='UNKNOWN',lease_token=NULL,lease_until=NULL WHERE application_id=$1 AND kind='READY_MESSAGE' AND state='RUNNING' AND lease_until<=now() RETURNING id",[item.application_id])
      if(changed.rows.length){await client.query("UPDATE daechion_automation.applications SET notification_state='UNKNOWN' WHERE id=$1",[item.application_id]);await automationChanged(client,String(item.application_id),'ready_message_unknown','ENROLLMENT_WORKER')}
    }
    const app=(await client.query(`SELECT a.id FROM daechion_automation.applications a WHERE a.notification_state='PENDING'
      AND EXISTS(SELECT 1 FROM daechion_automation.outbox o WHERE o.application_id=a.id AND o.kind='READY_MESSAGE' AND o.state='PENDING')
      AND NOT EXISTS(SELECT 1 FROM daechion_automation.outbox o WHERE o.application_id=a.id AND o.kind='READY_MESSAGE' AND o.state IN ('RUNNING','UNKNOWN','DONE'))
      ORDER BY a.updated_at,a.id LIMIT 1 FOR UPDATE OF a SKIP LOCKED`)).rows[0]
    if(!app)return null
    const allowed=await eligible(client,String(app.id))
    if(!allowed){await client.query("UPDATE daechion_automation.outbox SET state='FAILED' WHERE application_id=$1 AND kind='READY_MESSAGE' AND state='PENDING'",[app.id]);await client.query("UPDATE daechion_automation.applications SET notification_state='FAILED' WHERE id=$1",[app.id]);await automationChanged(client,String(app.id),'ready_message_stopped','ENROLLMENT_WORKER');return null}
    const snapshot=applicationSnapshotSchema.parse(allowed.submission)
    const queue=(await client.query("SELECT id FROM daechion_automation.outbox WHERE application_id=$1 AND kind='READY_MESSAGE' AND state='PENDING' ORDER BY event_version LIMIT 1",[app.id])).rows[0]
    const token=randomUUID()
    await client.query("UPDATE daechion_automation.outbox SET state='RUNNING',lease_token=$2,lease_until=now()+interval '120 seconds',attempts=attempts+1 WHERE id=$1",[queue.id,token])
    for(const phone of new Set([snapshot.studentPhone,snapshot.guardianPhone].filter(Boolean))){
      await client.query('INSERT INTO daechion_automation.ready_receipts(id,application_id,phone) VALUES($1,$2,$3) ON CONFLICT(application_id,phone) DO NOTHING',[randomUUID(),app.id,phone])
    }
    return {applicationId:String(app.id),id:String(queue.id),token,text:lmsText(snapshot.studentName,snapshot.productTitle)}
  }))
  if(!job)return 'SKIPPED'
  const receipts=await ports.withClient(async client=>(await client.query('SELECT id,phone,state FROM daechion_automation.ready_receipts WHERE application_id=$1 ORDER BY phone',[job.applicationId])).rows)
  for(const receipt of receipts){
    if(receipt.state!=='PENDING')continue
    const claimed=await ports.withClient(client=>automationTransaction(client,async()=>{
      await client.query('SELECT id FROM daechion_automation.applications WHERE id=$1 FOR UPDATE',[job.applicationId])
      if(!await eligible(client,job.applicationId))return false
      const parent=await client.query("SELECT id FROM daechion_automation.outbox WHERE id=$1 AND state='RUNNING' AND lease_token=$2 AND lease_until>now()",[job.id,job.token])
      if(!parent.rows.length)return false
      return (await client.query("UPDATE daechion_automation.ready_receipts SET state='UNKNOWN' WHERE id=$1 AND state='PENDING' RETURNING id",[receipt.id])).rows.length>0
    }))
    if(!claimed)break
    let result:{accepted:boolean;messageId?:string}
    try{result=await ports.provider.send({receiptId:String(receipt.id),phone:String(receipt.phone),text:job.text})}catch{result={accepted:false}}
    if(result.accepted&&result.messageId){await ports.withClient(async client=>{await client.query("UPDATE daechion_automation.ready_receipts SET state='SENT',provider_message_id=$2,accepted_at=now() WHERE id=$1 AND state='UNKNOWN'",[receipt.id,result.messageId])})}
    else break
  }
  return ports.withClient(client=>automationTransaction(client,async()=>{
    await client.query('SELECT id FROM daechion_automation.applications WHERE id=$1 FOR UPDATE',[job.applicationId])
    const states=(await client.query('SELECT state FROM daechion_automation.ready_receipts WHERE application_id=$1',[job.applicationId])).rows
    const state=states.length&&states.every(row=>row.state==='SENT')?'SENT':'UNKNOWN'
    const updated=await client.query("UPDATE daechion_automation.outbox SET state=$3,lease_token=NULL,lease_until=NULL WHERE id=$1 AND state='RUNNING' AND lease_token=$2 RETURNING id",[job.id,job.token,state==='SENT'?'DONE':'UNKNOWN'])
    if(updated.rows.length){await client.query('UPDATE daechion_automation.applications SET notification_state=$2 WHERE id=$1',[job.applicationId,state]);await automationChanged(client,job.applicationId,'ready_message_recorded','ENROLLMENT_WORKER')}
    return state
  }))
}
