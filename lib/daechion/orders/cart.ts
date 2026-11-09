import { createHash } from 'node:crypto'
import { z } from 'zod'
import { isOriginalProduct } from '../../purchase-process'

const money = z.number().int().positive().max(2147483647)
const label = z.string().trim().min(1).max(200).regex(/^[^\u0000-\u001f\u007f]+$/).transform(value => value.normalize('NFC'))
const productId = z.string().trim().min(1).max(100)
const lecture = z.object({ id: z.number().int().positive().safe(), name: label }).strict()

// This schema describes a server-resolved catalog record, never a public body.
const productSchema = z.object({
  productId, title: label, saleKind: z.enum(['SINGLE', 'BUNDLE']),
  purchaseProcess: z.literal('PROCESS_2'), visible: z.literal(true),
  priceWon: money, tenantId: z.string().trim().min(1).max(120),
  revision: z.string().min(1).max(120), lectures: z.array(lecture).min(1).max(30),
}).strict().superRefine((value, ctx) => {
  if (isOriginalProduct(value.productId) ||
    new Set(value.lectures.map(item => item.id)).size !== value.lectures.length ||
    (value.saleKind === 'SINGLE' && value.lectures.length !== 1) ||
    (value.saleKind === 'BUNDLE' && value.lectures.length < 2)) {
    ctx.addIssue({ code: 'custom', message: 'Invalid sale configuration' })
  }
})
export type CheckoutProduct = z.infer<typeof productSchema>
export const cartRequestSchema = z.object({items: z.array(z.object({productId}).strict()).min(1).max(30)}).strict()
export type CartConflict = { lectureId: number; lectureName: string; productIds: string[]; productTitles: string[] }
export class CartError extends Error {
  constructor(public readonly code: 'INVALID_CART' | 'DUPLICATE_PRODUCT' | 'PRODUCT_UNAVAILABLE' |
    'PRODUCT_NOT_CONFIGURED' | 'TENANT_MISMATCH' | 'TOTAL_OUT_OF_RANGE' | 'CART_TOO_LARGE' | 'CART_CONFLICT' | 'INVALID_OWNERSHIP_REPORT') { super(code) }
}
export interface ResolvedCart {
  items: CheckoutProduct[]; totalWon: number; fingerprint: string; conflicts: CartConflict[]
}
function cartFingerprint(items: CheckoutProduct[]) {
  const canonical = items.map(item => ({...item, lectures:[...item.lectures].sort((a,b)=>a.id-b.id)}))
    .sort((a,b)=>a.productId<b.productId?-1:a.productId>b.productId?1:0)
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

export function resolveCart(raw: unknown, catalog: readonly unknown[], tenantId: string): ResolvedCart {
  const parsed = cartRequestSchema.safeParse(raw)
  if (!parsed.success) throw new CartError('INVALID_CART')
  const ids = parsed.data.items.map(item => item.productId)
  if (new Set(ids).size !== ids.length) throw new CartError('DUPLICATE_PRODUCT')
  const items = ids.map(id => {
    const candidates = catalog.filter(row => row !== null && typeof row === 'object' && (row as {productId?:unknown}).productId === id)
    if (!candidates.length) throw new CartError('PRODUCT_UNAVAILABLE')
    if (candidates.length !== 1) throw new CartError('PRODUCT_NOT_CONFIGURED')
    const result = productSchema.safeParse(candidates[0])
    if (!result.success) throw new CartError('PRODUCT_NOT_CONFIGURED')
    if (result.data.tenantId !== tenantId.trim()) throw new CartError('TENANT_MISMATCH')
    return result.data
  })
  const totalWon = items.reduce((sum,item) => sum + item.priceWon,0)
  if (!money.safeParse(totalWon).success) throw new CartError('TOTAL_OUT_OF_RANGE')
  const targets = new Map<number,{name:string;items:CheckoutProduct[]}>()
  for (const item of items) for (const target of item.lectures) {
    const entry = targets.get(target.id) ?? {name:target.name,items:[]}
    entry.items.push(item); targets.set(target.id,entry)
  }
  if(targets.size>30)throw new CartError('CART_TOO_LARGE')
  const conflicts = [...targets].filter(([,entry])=>entry.items.length>1).sort(([a],[b])=>a-b)
    .map(([lectureId,entry])=>({lectureId,lectureName:entry.name,productIds:entry.items.map(item=>item.productId),productTitles:entry.items.map(item=>item.title)}))
  return {items,totalWon,fingerprint:cartFingerprint(items),conflicts}
}

const reportSchema = z.object({
  cartFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  subjectKey: z.string().regex(/^[a-f0-9]{64}$/),
  checkedAt: z.string().datetime({offset:true}), identity: z.enum(['PASSED','REVIEW']),
  lectures: z.array(z.object({id:lecture.shape.id,state:z.enum(['OWNED','NOT_OWNED','UNKNOWN'])}).strict()).max(30),
}).strict()
export type OwnershipReport = z.infer<typeof reportSchema>
export type OwnershipDecision = {
  status:'READY'|'RECONFIRM'|'REVIEW'|'NO_PURCHASE';
  items:CheckoutProduct[]; excluded:CheckoutProduct[]; totalWon:number;
  reasons:{productId:string;code:'BUNDLE_ALREADY_OWNED'|'OWNERSHIP_UNKNOWN'}[];
}

// Called only with the report from a trusted, read-only server adapter. A phone
// match is not proof of phone ownership. Public endpoints must never accept it.
export function reviewOwnership(cart:ResolvedCart, rawReport:unknown, expectedSubjectKey:string, now=new Date()):OwnershipDecision {
  if (!cart.items.length || cart.totalWon!==cart.items.reduce((sum,item)=>sum+item.priceWon,0) || cartFingerprint(cart.items)!==cart.fingerprint || cart.conflicts.length ||
    cart.items.some(item=>!productSchema.safeParse(item).success) ||
    new Set(cart.items.flatMap(item=>item.lectures.map(target=>target.id))).size !== cart.items.reduce((sum,item)=>sum+item.lectures.length,0)) {
    throw new CartError('CART_CONFLICT')
  }
  const result=reportSchema.safeParse(rawReport)
  if(!result.success)throw new CartError('INVALID_OWNERSHIP_REPORT')
  const report=result.data, age=now.getTime()-Date.parse(report.checkedAt)
  const targetIds=new Set(cart.items.flatMap(item=>item.lectures.map(target=>target.id)))
  if(report.cartFingerprint!==cart.fingerprint || report.subjectKey!==expectedSubjectKey || !/^[a-f0-9]{64}$/.test(expectedSubjectKey) ||
    !Number.isFinite(age) || age<0 || age>60000 || report.lectures.length!==targetIds.size ||
    new Set(report.lectures.map(target=>target.id)).size!==targetIds.size || report.lectures.some(target=>!targetIds.has(target.id))) {
    throw new CartError('INVALID_OWNERSHIP_REPORT')
  }
  const states=new Map(report.lectures.map(target=>[target.id,target.state]))
  const items:CheckoutProduct[]=[], excluded:CheckoutProduct[]=[], reasons:OwnershipDecision['reasons']=[]
  if(report.identity==='REVIEW')return {status:'REVIEW',items:cart.items,excluded:[],totalWon:cart.totalWon,reasons:cart.items.map(item=>({productId:item.productId,code:'OWNERSHIP_UNKNOWN'}))}
  for(const item of cart.items){
    const owned=item.lectures.some(target=>states.get(target.id)==='OWNED')
    const unknown=item.lectures.some(target=>states.get(target.id)==='UNKNOWN')
    if(item.saleKind==='BUNDLE'&&owned){items.push(item);reasons.push({productId:item.productId,code:'BUNDLE_ALREADY_OWNED'})}
    else if(unknown){items.push(item);reasons.push({productId:item.productId,code:'OWNERSHIP_UNKNOWN'})}
    else if(owned)excluded.push(item)
    else items.push(item)
  }
  return {status:reasons.length?'REVIEW':!items.length?'NO_PURCHASE':excluded.length?'RECONFIRM':'READY',
    items,excluded,totalWon:items.reduce((sum,item)=>sum+item.priceWon,0),reasons}
}
