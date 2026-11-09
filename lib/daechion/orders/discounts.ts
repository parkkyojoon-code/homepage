import {z} from 'zod'

// Case-insensitive codes; the normalized code is used in every quote and order.
export const discountCode=z.string().trim().max(64).regex(/^[A-Za-z0-9_-]*$/).transform(v=>v.toUpperCase())
export const discountRuleSchema=z.object({code:discountCode.refine(v=>v.length>0),priceWon:z.number().int().positive().max(2147483647)}).strict()
export type DiscountRule=z.infer<typeof discountRuleSchema>
export class DiscountPolicyError extends Error {}
export function validateDiscounts(raw:unknown,product:{purchaseProcess?:string;modes?:{online?:{enabled?:boolean;price?:number}};textbook?:{included?:boolean;price?:number};subjectSelection?:unknown}):DiscountRule[]{
  const parsed=z.array(discountRuleSchema).max(50).safeParse(raw??[])
  if(!parsed.success)throw new DiscountPolicyError('할인코드는 영문·숫자·밑줄·하이픈 1~64자, 할인 후 금액은 1원 이상의 정수로 입력해주세요.')
  if(!parsed.data.length)return []
  const regular=(product.modes?.online?.price??0)+(product.textbook?.included?product.textbook.price??0:0)
  if(product.purchaseProcess!=='PROCESS_2'||product.modes?.online?.enabled!==true||product.subjectSelection!=null||!Number.isSafeInteger(regular))throw new DiscountPolicyError('할인코드는 프로세스2 온라인 고정가 상품에서 사용할 수 있습니다.')
  if(new Set(parsed.data.map(r=>r.code)).size!==parsed.data.length)throw new DiscountPolicyError('같은 상품에 동일한 할인코드를 중복 등록할 수 없습니다.')
  if(parsed.data.some(r=>r.priceWon>=regular))throw new DiscountPolicyError('할인 후 금액은 정상 판매가보다 낮아야 합니다. 교재비가 있으면 교재비를 포함한 최종 금액을 입력해주세요.')
  return parsed.data
}
export const pricingSnapshot=z.object({regularPriceWon:z.number().int().positive().max(2147483647),code:discountCode.refine(v=>v.length>0)}).strict()
export function discountSummary(items:readonly {priceWon:number;pricing?:z.infer<typeof pricingSnapshot>}[]){
  const regularTotalWon=items.reduce((n,i)=>n+(i.pricing?.regularPriceWon??i.priceWon),0)
  const totalWon=items.reduce((n,i)=>n+i.priceWon,0)
  return {regularTotalWon,discountWon:regularTotalWon-totalWon,discountCode:items.find(i=>i.pricing)?.pricing?.code??''}
}
