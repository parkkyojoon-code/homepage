import {z} from 'zod'
const id=z.string().min(1).max(100),title=z.string().min(1).max(200),money=z.number().int().positive().max(2147483647)
export const catalogResponse=z.object({available:z.boolean(),products:z.array(z.object({productId:id,title,saleKind:z.enum(['SINGLE','BUNDLE']),priceWon:money,lectureCount:z.number().int().min(1).max(30)})).max(500)})
const summary=z.object({productId:id,title,priceWon:money,regularPriceWon:money.optional()})
const discountFields={regularTotalWon:z.number().int().positive().safe().optional(),discountWon:z.number().int().nonnegative().safe().optional(),discountCode:z.string().max(64).optional()}
export const cartResponse=z.object({status:z.enum(['READY','CART_CONFLICT']),totalWon:money,...discountFields,items:z.array(summary).min(1).max(30),
  conflicts:z.array(z.object({lectureId:z.number().int().positive().safe(),lectureName:title,productIds:z.array(id).min(2),productTitles:z.array(title).min(2)})).max(30)})
export const quoteResponse=z.object({status:z.enum(['READY','RECONFIRM','REVIEW']),quoteId:z.string().uuid(),quoteToken:z.string().regex(/^[a-f0-9]{64}$/),expiresAt:z.string().datetime({offset:true}),
  totalWon:money,...discountFields,items:z.array(summary).min(1).max(30),excluded:z.array(z.object({productId:id,title})).max(30),
  reasons:z.array(z.object({productId:id,code:z.enum(['BUNDLE_ALREADY_OWNED','OWNERSHIP_UNKNOWN'])})).max(30)})
export const pendingOrder=z.object({quoteId:z.string().uuid(),quoteToken:z.string().regex(/^[a-f0-9]{64}$/),requestKey:z.string().uuid(),expectedTotalWon:money}).strict()
export const receiptResponse=z.object({status:z.literal('RECEIVED'),orderId:z.string().uuid(),created:z.boolean(),reviewRequired:z.boolean()})
export const noPurchaseResponse=z.object({status:z.literal('NO_PURCHASE'),totalWon:z.literal(0),excluded:z.array(z.object({productId:id,title})).min(1).max(30)})
export type CartProduct=z.infer<typeof catalogResponse>['products'][number]
export type CartQuote=z.infer<typeof quoteResponse>
