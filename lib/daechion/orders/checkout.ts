import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { normalizePhone } from '../client'
import type { LedgerClient } from '../ledger'
import { cartRequestSchema, resolveCart, reviewOwnership, type OwnershipReport, type ResolvedCart } from './cart'

const name = z.string().trim().min(1).max(80).regex(/^[^\u0000-\u001f\u007f]+$/).transform(v=>v.normalize('NFC'))
const phone = z.string().max(40).transform((v,ctx)=>{try{return normalizePhone(v)}catch{ctx.addIssue({code:'custom',message:'Invalid phone'});return z.NEVER}})
const optionalPhone = z.union([z.literal(''),phone]).default('')
export const contactSchema = z.object({studentName:name,studentPhone:phone,
  guardianName:z.union([z.literal(''),name]).default(''),guardianPhone:optionalPhone,payerPhone:phone,
  applicantType:z.enum(['STUDENT','GUARDIAN']),studentHistory:z.enum(['NEW','EXISTING']),
  agreePrivacy:z.literal(true),confirmPayment:z.literal(true),
}).strict()
export type OrderContact = z.infer<typeof contactSchema>
const money=z.number().int().positive().max(2147483647)
export const quoteRequestSchema=z.object({items:cartRequestSchema.shape.items,contact:contactSchema,expectedTotalWon:money}).strict()
export const orderRequestSchema=z.object({quoteId:z.string().uuid(),quoteToken:z.string().regex(/^[a-f0-9]{64}$/),requestKey:z.string().uuid(),expectedTotalWon:money}).strict()
export class CheckoutError extends Error {
  constructor(public readonly code:'INVALID_REQUEST'|'PRICE_CHANGED'|'QUOTE_UNAVAILABLE'|'REQUEST_CONFLICT'|'ORDER_PENDING'|'THROTTLED'|'CONFIGURATION_REQUIRED'){super(code)}
}
export interface CheckoutPorts {
  tenantId:string; subjectSecret:string
  catalog():Promise<readonly unknown[]>
  // Read only: no createStudent/enroll/content mutation capability is exposed.
  ownership(cart:ResolvedCart,contact:OrderContact,subjectKey:string):Promise<OwnershipReport>
  withClient<T>(run:(client:LedgerClient)=>Promise<T>):Promise<T>
}
const hash=(s:string)=>createHash('sha256').update(s).digest('hex')
export function subjectKey(contact:OrderContact,tenantId:string,secret:string){
  if(secret.length<32||!tenantId.trim())throw new CheckoutError('CONFIGURATION_REQUIRED')
  return createHmac('sha256',secret).update(JSON.stringify({tenantId,contact:contactSchema.parse(contact)})).digest('hex')
}
async function transaction<T>(client:LedgerClient,run:()=>Promise<T>){
  await client.query('BEGIN')
  try{const result=await run();await client.query('COMMIT');return result}
  catch(error){await client.query('ROLLBACK');throw error}
}
function tokenMatches(token:string,expected:unknown){
  return typeof expected==='string'&&/^[a-f0-9]{64}$/.test(expected)&&timingSafeEqual(Buffer.from(hash(token),'hex'),Buffer.from(expected,'hex'))
}
export async function quoteCheckout(raw:unknown,ports:CheckoutPorts){
  const parsed=quoteRequestSchema.safeParse(raw);if(!parsed.success)throw new CheckoutError('INVALID_REQUEST')
  const input=parsed.data,cart=resolveCart({items:input.items},await ports.catalog(),ports.tenantId)
  if(cart.conflicts.length)return {status:'CART_CONFLICT' as const,conflicts:cart.conflicts,totalWon:cart.totalWon}
  if(cart.totalWon!==input.expectedTotalWon)throw new CheckoutError('PRICE_CHANGED')
  const subject=subjectKey(input.contact,ports.tenantId,ports.subjectSecret)
  const decision=reviewOwnership(cart,await ports.ownership(cart,input.contact,subject),subject)
  if(decision.status==='NO_PURCHASE')return {status:decision.status,excluded:decision.excluded.map(i=>({productId:i.productId,title:i.title})),totalWon:0}
  const retained=resolveCart({items:decision.items.map(i=>({productId:i.productId}))},decision.items,ports.tenantId)
  const id=randomUUID(),token=randomBytes(32).toString('hex')
  const expiresAt=await ports.withClient(client=>transaction(client,async()=>{
    // Serialize per applicant before counting; external reads above never write.
    await client.query('SELECT pg_advisory_xact_lock(61120,hashtext($1))',[input.contact.studentPhone])
    const recent=await client.query<{n:number}>(`SELECT count(*)::int AS n FROM daechion_orders.quotes WHERE snapshot->'contact'->>'studentPhone'=$1 AND created_at>now()-interval '15 minutes'`,[input.contact.studentPhone])
    if(recent.rows[0].n>=10)throw new CheckoutError('THROTTLED')
    const saved=await client.query<{expires_at:Date}>(`INSERT INTO daechion_orders.quotes(id,token_hash,cart_fingerprint,subject_key,snapshot,total_won,state,expires_at)
      VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,now()+interval '10 minutes') RETURNING expires_at`,
    [id,hash(token),retained.fingerprint,subject,JSON.stringify({items:retained.items,contact:input.contact,tenantId:ports.tenantId,
      noticeVersion:'process2-cart-v1',reviewReasons:decision.reasons}),retained.totalWon,decision.status==='REVIEW'?'REVIEW':'READY'])
    return new Date(saved.rows[0].expires_at).toISOString()
  }))
  return {status:decision.status,quoteId:id,quoteToken:token,expiresAt,totalWon:decision.totalWon,
    items:decision.items.map(i=>({productId:i.productId,title:i.title,priceWon:i.priceWon})),
    excluded:decision.excluded.map(i=>({productId:i.productId,title:i.title})),
    // No matched student's identity, phone list or full lecture inventory is public.
    reasons:decision.reasons.map(r=>({productId:r.productId,code:r.code}))}
}

export async function receiveOrder(raw:unknown,ports:CheckoutPorts){
  const parsed=orderRequestSchema.safeParse(raw);if(!parsed.success)throw new CheckoutError('INVALID_REQUEST')
  const input=parsed.data,fingerprint=hash(JSON.stringify({quoteId:input.quoteId,expectedTotalWon:input.expectedTotalWon}))
  return ports.withClient(client=>transaction(client,async()=>{
    await client.query('SELECT pg_advisory_xact_lock(61121,hashtext($1))',[input.requestKey])
    const quote=(await client.query('SELECT *,expires_at>now() AS fresh FROM daechion_orders.quotes WHERE id=$1 FOR UPDATE',[input.quoteId])).rows[0]
    if(!quote||!tokenMatches(input.quoteToken,quote.token_hash))throw new CheckoutError('QUOTE_UNAVAILABLE')
    const existing=(await client.query('SELECT id,request_fingerprint,checkout_state FROM daechion_orders.orders WHERE request_key=$1',[input.requestKey])).rows[0]
    if(existing){
      if(existing.request_fingerprint!==fingerprint)throw new CheckoutError('REQUEST_CONFLICT')
      return {orderId:String(existing.id),created:false,status:'RECEIVED' as const,reviewRequired:existing.checkout_state==='REVIEW'}
    }
    if((await client.query('SELECT id FROM daechion_orders.orders WHERE quote_id=$1',[input.quoteId])).rows.length)throw new CheckoutError('REQUEST_CONFLICT')
    if(!quote.fresh||!['READY','REVIEW'].includes(String(quote.state)))throw new CheckoutError('QUOTE_UNAVAILABLE')
    if(quote.total_won!==input.expectedTotalWon)throw new CheckoutError('PRICE_CHANGED')
    const snapshot=quote.snapshot as {items:unknown[];contact:unknown;tenantId:string;noticeVersion:string}
    const contact=contactSchema.parse(snapshot.contact)
    const cart=resolveCart({items:snapshot.items.map(i=>({productId:(i as {productId:string}).productId}))},snapshot.items,ports.tenantId)
    if(snapshot.tenantId!==ports.tenantId||cart.fingerprint!==quote.cart_fingerprint||cart.conflicts.length||cart.totalWon!==quote.total_won||
      subjectKey(contact,ports.tenantId,ports.subjectSecret)!==quote.subject_key)throw new CheckoutError('QUOTE_UNAVAILABLE')
    // A changed price, target, visibility or revision requires a new quote. Old
    // quotes cannot silently buy an edited product, even at the same price.
    const current=resolveCart({items:cart.items.map(i=>({productId:i.productId}))},await ports.catalog(),ports.tenantId)
    if(current.fingerprint!==cart.fingerprint)throw new CheckoutError('PRICE_CHANGED')
    const phones=[...new Set([contact.studentPhone,contact.guardianPhone].filter(Boolean))].sort()
    for(const p of phones)await client.query('SELECT pg_advisory_xact_lock(61122,hashtext($1))',[p])
    const targets=cart.items.flatMap(i=>i.lectures.map(l=>l.id))
    const pending=await client.query(`SELECT o.id FROM daechion_orders.orders o JOIN daechion_orders.grants g ON g.order_id=o.id
      WHERE o.tenant_id=$1 AND (o.checkout_state<>'CLOSED' OR o.payment_state='PAID')
      AND (o.student_phone=ANY($2::text[]) OR o.contact_snapshot->>'guardianPhone'=ANY($2::text[]))
      AND g.lecture_id=ANY($3::bigint[]) LIMIT 1`,[ports.tenantId,phones,targets])
    if(pending.rows.length)throw new CheckoutError('ORDER_PENDING')
    const previousIntake=await client.query(`SELECT a.id FROM daechion_automation.applications a JOIN daechion_automation.registrations r ON r.application_id=a.id
      WHERE (a.automation_state NOT IN ('CLOSED','REVOKED') OR a.payment_state='PAID')
      AND (a.submission->>'studentPhone'=ANY($1::text[]) OR a.submission->>'guardianPhone'=ANY($1::text[]))
      AND r.lecture_id=ANY($2::bigint[]) LIMIT 1`,[phones,targets])
    if(previousIntake.rows.length)throw new CheckoutError('ORDER_PENDING')
    const id=randomUUID()
    await client.query(`INSERT INTO daechion_orders.orders(id,quote_id,request_key,request_fingerprint,cart_fingerprint,subject_key,tenant_id,student_phone,contact_snapshot,total_won)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,[id,input.quoteId,input.requestKey,fingerprint,cart.fingerprint,quote.subject_key,ports.tenantId,contact.studentPhone,JSON.stringify({...contact,noticeVersion:snapshot.noticeVersion}),cart.totalWon])
    for(const item of cart.items){
      const itemId=randomUUID()
      await client.query(`INSERT INTO daechion_orders.items(id,order_id,product_id,sale_kind,title,price_won,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,[itemId,id,item.productId,item.saleKind,item.title,item.priceWon,JSON.stringify(item)])
      for(const lecture of item.lectures)await client.query('INSERT INTO daechion_orders.grants(order_id,item_id,lecture_id) VALUES($1,$2,$3)',[id,itemId,lecture.id])
    }
    const review=quote.state==='REVIEW'
    await client.query('UPDATE daechion_orders.orders SET checkout_state=$2 WHERE id=$1',[id,review?'REVIEW':'READY'])
    await client.query("INSERT INTO daechion_orders.events(order_id,kind) VALUES($1,$2)",[id,review?'order_review':'order_received'])
    await client.query("INSERT INTO daechion_orders.jobs(id,order_id,kind,event_version) VALUES($1,$2,'SHEETS',1)",[randomUUID(),id])
    return {orderId:id,created:true,status:'RECEIVED' as const,reviewRequired:review}
  }))
}
