import {createHash} from 'node:crypto'
import {z} from 'zod'
import {resolveStudent} from '../identity'
import {normalizePhone,type DaechionStudent} from '../client'
import type {LedgerClient} from '../ledger'
import {contactSchema} from './checkout'
import {resolveCart} from './cart'
import type {BillingContext} from './billing'
import type {ReadOnlyStudentPort} from './ownership'

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const reviewEvidenceSchema=z.object({studentId:z.number().int().positive().safe(),profileFingerprint:z.string().regex(/^[a-f0-9]{64}$/),
  binding:z.string().regex(/^[a-f0-9]{64}$/),targetIds:z.array(z.number().int().positive().safe()).min(1).max(30),checkedAt:z.string().datetime({offset:true})}).strict()
export type ReviewEvidence=z.infer<typeof reviewEvidenceSchema>
export function studentProfileFingerprint(student:DaechionStudent){
  return hash({id:student.id,name:student.name.trim().normalize('NFC'),studentPhone:normalizePhone(student.studentPhoneNumber??''),
    guardians:[...new Set([student.parentPhoneNumber,student.parentPhoneNumber2].filter(Boolean).map(phone=>normalizePhone(phone!)))].sort()})
}
export function reviewContext(context:BillingContext){
  const contact=contactSchema.parse(context.contact)
  const cart=resolveCart({items:context.items.map(row=>({productId:(row as {productId?:unknown})?.productId}))},context.items,context.tenantId)
  if(cart.conflicts.length||cart.totalWon!==context.totalWon)throw Error('MANUAL_REVIEW_CONTEXT_INVALID')
  const targetIds=cart.items.flatMap(item=>item.lectures.map(l=>l.id)).sort((a,b)=>a-b)
  return {contact,targetIds,binding:hash({orderId:context.orderId,tenantId:context.tenantId,cart:cart.fingerprint,contact})}
}
export async function contextFromOrder(c:LedgerClient,tenantId:string,id:string,expectedVersion?:string):Promise<BillingContext|null>{
  const row=(await c.query('SELECT id,version,tenant_id,total_won,contact_snapshot FROM daechion_orders.orders WHERE id=$1 AND tenant_id=$2',[id,tenantId])).rows[0]
  if(!row||expectedVersion!==undefined&&String(row.version)!==expectedVersion)return null
  const {noticeVersion:_notice,...contact}=row.contact_snapshot as Record<string,unknown>
  const items=(await c.query('SELECT snapshot FROM daechion_orders.items WHERE order_id=$1 ORDER BY product_id',[id])).rows.map(item=>item.snapshot)
  return {orderId:id,version:String(row.version),tenantId,totalWon:Number(row.total_won),contact:contactSchema.parse(contact),items}
}
export async function inspectExisting(context:BillingContext,studentId:number,api:ReadOnlyStudentPort&{student(id:number):Promise<DaechionStudent>}):Promise<ReviewEvidence>{
  const started=Date.now(),bound=reviewContext(context)
  if(String((await api.me()).tenantId)!==context.tenantId)throw Error('MANUAL_REVIEW_TENANT_MISMATCH')
  const profile=await api.student(studentId)
  const selected=(await resolveStudent({...api,students:(p,n)=>api.students(p,n),student:id=>api.student(id),
    createStudent:async()=>{throw Error('READ_ONLY_REVIEW_CANNOT_CREATE')}},
    {name:bound.contact.studentName,studentPhone:bound.contact.studentPhone,guardianPhone:bound.contact.guardianPhone||undefined},{manualApprovedId:studentId})).student
  const profileFingerprint=studentProfileFingerprint(profile)
  if(profile.id!==studentId||studentProfileFingerprint(selected)!==profileFingerprint||Date.now()-started>60000)throw Error('MANUAL_REVIEW_PROFILE_CHANGED')
  return {studentId,profileFingerprint,binding:bound.binding,targetIds:bound.targetIds,checkedAt:new Date().toISOString()}
}
export async function latestReview(c:LedgerClient,orderId:string):Promise<ReviewEvidence|null>{
  const row=(await c.query(`SELECT a.student_id,a.profile_fingerprint,a.context_fingerprint,a.target_ids,a.checked_at
    FROM daechion_orders.admin_actions a JOIN daechion_orders.orders o ON o.id=a.order_id
    WHERE a.order_id=$1 AND a.action='APPROVE_EXISTING' AND a.order_request_fingerprint=o.request_fingerprint
    ORDER BY a.after_version DESC LIMIT 1`,[orderId])).rows[0]
  if(!row)return null
  return reviewEvidenceSchema.parse({studentId:Number(row.student_id),profileFingerprint:row.profile_fingerprint,binding:row.context_fingerprint,
    targetIds:row.target_ids,checkedAt:new Date(row.checked_at as string).toISOString()})
}
