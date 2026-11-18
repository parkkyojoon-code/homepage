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
  inspectOwnership?(input:{studentId:number;studentName:string;studentPhone:string;lectureIds:number[]}):Promise<{studentId:number;lectures:{id:number;state:'OWNED'|'NOT_OWNED'}[]}>
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
      const {automatic,...evidence}=reviewed
      const proof=reviewEvidenceSchema.parse(evidence),age=Date.now()-Date.parse(proof.checkedAt),bound=reviewContext(context)
      if(age<0||age>15*60000||proof.binding!==bound.binding||JSON.stringify(proof.targetIds)!==JSON.stringify(bound.targetIds)||!ports.api.student)return 'REVIEW'
      const identityApi={...ports.api,me:()=>ports.api.me(),students:(p:string,n:string)=>ports.api.students(p,n),student:(id:number)=>ports.api.student!(id)}
      let current=await inspectExisting(context,proof.studentId,identityApi,automatic===true)
      if(automatic){
        if(!ports.api.inspectOwnership)return 'REVIEW'
        const owned=z.object({studentId:z.number().int().positive().safe(),lectures:z.array(z.object({id:z.number().int().positive().safe(),state:z.enum(['OWNED','NOT_OWNED'])}).strict()).min(1).max(30)}).strict().parse(await ports.api.inspectOwnership({studentId:proof.studentId,studentName:context.contact.studentName,studentPhone:context.contact.studentPhone,lectureIds:bound.targetIds}))
        if(owned.studentId!==proof.studentId||owned.lectures.length!==bound.targetIds.length||new Set(owned.lectures.map(l=>l.id)).size!==bound.targetIds.length||
          owned.lectures.some(l=>!bound.targetIds.includes(l.id)||l.state!=='NOT_OWNED'))return 'REVIEW'
        current=await inspectExisting(context,proof.studentId,identityApi,true)
      }
      return Date.now()-start<=60000&&Date.now()-Date.parse(proof.checkedAt)<=15*60000&&current.profileFingerprint===proof.profileFingerprint?'READY':'REVIEW'
    }
    const key=subjectKey(context.contact,ports.tenantId,ports.subjectSecret)
    const ownership=await lookupOwnership(ports.api,ports.tenantId,cart,context.contact,key)
    return Date.now()-start<=60000&&reviewOwnership(cart,ownership,key).status==='READY'?'READY':'REVIEW'
  }catch{return 'REVIEW'}
}
