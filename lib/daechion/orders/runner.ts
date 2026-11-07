import {z} from 'zod'
import type {PaymentProvider} from '../payssam'
import {sendOrderBill,checkOrderPayment,type OrderBillingPorts} from './billing'
import {runOrderGrant,type OrderEnrollmentPorts} from './enrollment'
const flagsSchema=z.object({send:z.boolean(),read:z.boolean(),enroll:z.boolean()}).strict()
export function orderWorkerSettings(env:Record<string,string|undefined>){
  const off={send:false,read:false,enroll:false}
  if(env.DAECHION_ORDER_WORKER_ENABLED!=='true')return off
  if(env.DAECHION_BILLING_SEND_ENABLED==='true'||env.DAECHION_ENROLLMENT_ENABLED==='true')throw Error('ORDER_LEGACY_WRITES_MUST_BE_DISABLED')
  return {send:env.DAECHION_ORDER_SEND_ENABLED==='true',read:env.DAECHION_ORDER_PAYMENT_READ_ENABLED==='true',enroll:env.DAECHION_ORDER_ENROLLMENT_ENABLED==='true'}
}
export async function processOrder(id:string,rawFlags:unknown,ports:OrderEnrollmentPorts&OrderBillingPorts&{provider:OrderBillingPorts['provider']&PaymentProvider}){
  const flags=flagsSchema.parse(rawFlags)
  if(!flags.send&&!flags.read&&!flags.enroll)return {billing:'DISABLED',payment:'DISABLED',grants:[] as string[]}
  z.string().uuid().parse(id)
  const billing=flags.send?await sendOrderBill(id,true,ports):'DISABLED'
  let payment=flags.read?await checkOrderPayment(id,true,ports):'DISABLED'
  const grants:string[]=[]
  // Never use a stale stored PAID value when the current cycle cannot read the provider.
  if(!flags.read||!flags.enroll||payment!=='PAID')return {billing,payment,grants}
  for(let n=0;n<30;n++){
    if(n>0){payment=await checkOrderPayment(id,true,ports);if(payment!=='PAID')break}
    const result=await runOrderGrant(id,true,ports)
    if(result==='SKIPPED')break
    grants.push(result)
  }
  return {billing,payment,grants}
}
