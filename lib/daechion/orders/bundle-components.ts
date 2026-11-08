import {z} from 'zod'
import {isOriginalProduct,type PurchaseProcess} from '../../purchase-process'
import type {StoredLectureBinding} from '../product-policy'

const componentSchema=z.object({productId:z.string().min(1).max(100),lectureId:z.number().int().positive().safe(),tenantId:z.string().min(1).max(120)}).strict()
const componentsSchema=z.array(componentSchema).min(2).max(30)
export type BundleComponent=z.infer<typeof componentSchema>
export interface BundleProduct {
  id:string;name:string;visible:boolean;purchaseProcess?:PurchaseProcess;saleKind?:'SINGLE'|'BUNDLE'
  modes:{online:{enabled:boolean;price:number}}
  textbook:{included:boolean;price:number};subjectSelection?:unknown
  daechionBinding?:StoredLectureBinding|null;bundleComponents?:BundleComponent[]
}
export class BundleComponentError extends Error {}

// Visibility and current price are not part of a bundle's fixed composition.
// Hidden individual products may be sold exclusively through a bundle.
export function bundleSource(product:BundleProduct,tenantId?:string):BundleComponent|null{
  const binding=product.daechionBinding
  if(isOriginalProduct(product.id)||product.purchaseProcess!=='PROCESS_2'||
    product.saleKind!==undefined&&product.saleKind!=='SINGLE'||!product.modes?.online?.enabled||
    !Number.isSafeInteger(product.modes.online.price)||product.modes.online.price<1||product.modes.online.price>2147483647||
    product.subjectSelection!=null||product.textbook?.included&&product.textbook.price!==0||
    !binding||binding.lectures?.length!==1||!Number.isFinite(Date.parse(binding.verifiedAt))||
    tenantId!==undefined&&binding.tenantId!==tenantId)return null
  const parsed=componentSchema.safeParse({productId:product.id,lectureId:binding.lectures[0]?.id,tenantId:binding.tenantId})
  return parsed.success?parsed.data:null
}
const canonical=(items:BundleComponent[])=>[...items].sort((a,b)=>a.productId<b.productId?-1:a.productId>b.productId?1:0)
export function resolveBundleComponents(rawIds:unknown,expected:unknown,products:readonly BundleProduct[],tenantId:string):BundleComponent[]{
  const parsed=z.array(z.string().min(1).max(100)).min(2).max(30).safeParse(rawIds)
  if(!parsed.success||new Set(parsed.data).size!==parsed.data.length)throw new BundleComponentError('홈페이지의 개별상품을 중복 없이 두 개 이상 선택해주세요.')
  const components=canonical(parsed.data.map(id=>{
    const found=products.filter(p=>p.id===id),source=found.length===1?bundleSource(found[0],tenantId):null
    if(!source)throw new BundleComponentError('구성 상품이 없거나 프로세스2 개별상품의 강의 연결이 유효하지 않습니다. 목록을 새로 불러와주세요.')
    return source
  }))
  if(new Set(components.map(item=>item.lectureId)).size!==components.length)throw new BundleComponentError('선택한 상품들이 같은 대치온 강의에 연결되어 있습니다. 중복 강의를 제외해주세요.')
  const proof=componentsSchema.safeParse(expected)
  if(!proof.success||JSON.stringify(canonical(proof.data))!==JSON.stringify(components))throw new BundleComponentError('선택한 상품의 강의 연결이 변경되었습니다. 목록을 새로 불러와 다시 선택해주세요.')
  return components
}

export function bundleCompositionIssue(bundle:BundleProduct,products:readonly BundleProduct[]):string|null{
  // Older directly bound bundles remain valid; editing can explicitly adopt sources.
  if(bundle.saleKind!=='BUNDLE'||bundle.bundleComponents===undefined)return null
  try{
    const saved=componentsSchema.parse(bundle.bundleComponents),tenant=bundle.daechionBinding?.tenantId
    if(!tenant)throw Error('binding')
    const resolved=resolveBundleComponents(saved.map(item=>item.productId),saved,products,tenant)
    const actual=bundle.daechionBinding!.lectures.map(item=>item.id).sort((a,b)=>a-b)
    if(JSON.stringify(actual)!==JSON.stringify(resolved.map(item=>item.lectureId).sort((a,b)=>a-b)))throw Error('binding')
    return null
  }catch{return '구성 상품의 강의 연결이 변경되었거나 삭제되었습니다. 구성 상품을 다시 선택해 저장해주세요.'}
}
