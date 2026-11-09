import { normalizePhone, type DaechionStudent } from '../client'
import type { OrderContact } from './checkout'
import type { OwnershipReport, ResolvedCart } from './cart'

export interface ReadOnlyStudentPort {
  me():Promise<{tenantId:string|number}>
  students(phone:string,name:string):Promise<DaechionStudent[]>
}
const matches=(student:DaechionStudent,p:string)=>[student.studentPhoneNumber,student.parentPhoneNumber,student.parentPhoneNumber2]
  .some(v=>{try{return Boolean(v)&&normalizePhone(v!)===p}catch{return false}})

// The official API currently cannot prove content ownership. Existing students
// are therefore held instead of interpreting absence of an API as NOT_OWNED.
export async function lookupOwnership(port:ReadOnlyStudentPort,tenantId:string,cart:ResolvedCart,contact:OrderContact,subjectKey:string):Promise<OwnershipReport>{
  let identity:'PASSED'|'REVIEW'='REVIEW',state:'NOT_OWNED'|'UNKNOWN'='UNKNOWN'
  try{
    if(String((await port.me()).tenantId)!==tenantId)throw Error('TENANT_MISMATCH')
    const students=new Map<number,DaechionStudent>()
    for(const phone of new Set([contact.studentPhone,contact.guardianPhone].filter(Boolean))){
      for(const student of await port.students(phone,'')){
        if(!matches(student,phone))throw Error('LOOKUP_MISMATCH')
        const previous=students.get(student.id)
        if(previous&&JSON.stringify(previous)!==JSON.stringify(student))throw Error('LOOKUP_CHANGED')
        students.set(student.id,student)
      }
    }
    if(students.size===0&&contact.studentHistory==='NEW'){identity='PASSED';state='NOT_OWNED'}
    // Inactive profiles are still existing profiles. Neither payer number nor
    // matching names alone decide identity or create login access.
  }catch{/* Unknown lookup or identity is held without leaking provider data. */}
  return {cartFingerprint:cart.fingerprint,subjectKey,checkedAt:new Date().toISOString(),identity,
    lectures:cart.items.flatMap(i=>i.lectures.map(l=>({id:l.id,state})))}
}
