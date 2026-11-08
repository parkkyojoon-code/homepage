import {z} from 'zod'
import type {LedgerClient} from '../ledger'
import type {BillingContext} from './billing'
import type {OrderPreflightPort} from './preflight'
import {preflightOrder} from './preflight'
import {contextFromOrder,reviewContext,latestReview} from './manual-review'

export const intakeEvidenceSchema=z.object({binding:z.string().regex(/^[a-f0-9]{64}$/),
  targetIds:z.array(z.number().int().positive().safe()).min(1).max(30),checkedAt:z.string().datetime({offset:true})}).strict()
export type IntakeEvidence=z.infer<typeof intakeEvidenceSchema>
export function unattemptedIntake(o:Record<string,unknown>){
  return ['READY','REVIEW'].includes(String(o.checkout_state))&&o.payment_state==='PENDING'&&o.identity_state==='WAITING'&&
    o.student_id===null&&!o.identity_write_started&&!o.identity_token&&!o.closed_action_id
}
export async function intakeUntouched(c:LedgerClient,id:string){
  return !(await c.query(`SELECT 1 FROM daechion_orders.bills WHERE order_id=$1 UNION ALL
    SELECT 1 FROM daechion_orders.grants WHERE order_id=$1 AND (state<>'PENDING' OR enrollment_recorded OR lease_token IS NOT NULL OR weekly_ids<>'[]'::jsonb)
    UNION ALL SELECT 1 FROM daechion_orders.ready_receipts WHERE order_id=$1 LIMIT 1`,[id])).rows.length
}
export async function inspectNewIntake(context:BillingContext,api:OrderPreflightPort,subjectSecret:string):Promise<IntakeEvidence|null>{
  if(context.contact.studentHistory!=='NEW')return null
  const start=Date.now(),bound=reviewContext(context)
  if(await preflightOrder(context,{tenantId:context.tenantId,subjectSecret,api})!=='READY'||Date.now()-start>60000)return null
  return {binding:bound.binding,targetIds:bound.targetIds,checkedAt:new Date().toISOString()}
}
export async function validateNewIntake(c:LedgerClient,o:Record<string,unknown>,raw:unknown){
  if(!unattemptedIntake(o)||o.checkout_state!=='REVIEW'||!await intakeUntouched(c,String(o.id)))return null
  const context=await contextFromOrder(c,String(o.tenant_id),String(o.id))
  if(!context||context.contact.studentHistory!=='NEW'||await latestReview(c,String(o.id)))return null
  const e=intakeEvidenceSchema.parse(raw),bound=reviewContext(context),age=Date.now()-Date.parse(e.checkedAt)
  return age>=0&&age<=60000&&e.binding===bound.binding&&JSON.stringify(e.targetIds)===JSON.stringify(bound.targetIds)?e:null
}
