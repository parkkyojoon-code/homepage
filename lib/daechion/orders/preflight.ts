import {z} from 'zod'
import type {BillingContext} from './billing'
import {resolveCart,reviewOwnership} from './cart'
import {subjectKey} from './checkout'
import {lookupOwnership,type ReadOnlyStudentPort} from './ownership'
import type {DaechionStudent} from '../client'
import {inspectExisting,reviewContext,reviewEvidenceSchema,type ReviewEvidence} from './manual-review'

export interface OrderPreflightPort extends ReadOnlyStudentPort {
  lectures():Promise<{id:number;opened:boolean;weeklyLectures:{id:number}[]}[]>
  student?(id:number):Promise<DaechionStudent>
}
// Uses only immutable, confirmed order snapshots and fresh read-only API calls.
// A catalog price change after confirmation must not silently reprice an invoice.
export async function preflightOrder(context:BillingContext,ports:{tenantId:string;subjectSecret:string;api:OrderPreflightPort;manualReview?(context:BillingContext):Promise<ReviewEvidence|null>}):Promise<'READY'|'REVIEW'>{
  const start=Date.now()
  try{
    z.string().uuid().parse(context.orderId)
    if(context.tenantId!==ports.tenantId||ports.subjectSecret.length<32)return 'REVIEW'
    const cart=resolveCart({items:context.items.map(item=>({productId:(item as {productId?:unknown})?.productId}))},context.items,ports.tenantId)
    if(cart.conflicts.length||cart.totalWon!==context.totalWon)return 'REVIEW'
    const lectures=await ports.api.lectures()
    for(const target of cart.items.flatMap(item=>item.lectures)){
      const matches=lectures.filter(row=>row.id===target.id)
      if(matches.length!==1||matches[0].opened!==true)return 'REVIEW'
      const weeks=z.array(z.object({id:z.number().int().positive().safe()})).min(1).max(1000).parse(matches[0].weeklyLectures)
      if(new Set(weeks.map(week=>week.id)).size!==weeks.length)return 'REVIEW'
    }
    const reviewed=await ports.manualReview?.(context)
    if(reviewed){
      const proof=reviewEvidenceSchema.parse(reviewed),age=Date.now()-Date.parse(proof.checkedAt),bound=reviewContext(context)
      if(age<0||age>15*60000||proof.binding!==bound.binding||JSON.stringify(proof.targetIds)!==JSON.stringify(bound.targetIds)||!ports.api.student)return 'REVIEW'
      const current=await inspectExisting(context,proof.studentId,{...ports.api,me:()=>ports.api.me(),students:(p,n)=>ports.api.students(p,n),student:id=>ports.api.student!(id)})
      return Date.now()-start<=60000&&current.profileFingerprint===proof.profileFingerprint?'READY':'REVIEW'
    }
    const key=subjectKey(context.contact,ports.tenantId,ports.subjectSecret)
    const ownership=await lookupOwnership(ports.api,ports.tenantId,cart,context.contact,key)
    return Date.now()-start<=60000&&reviewOwnership(cart,ownership,key).status==='READY'?'READY':'REVIEW'
  }catch{return 'REVIEW'}
}
