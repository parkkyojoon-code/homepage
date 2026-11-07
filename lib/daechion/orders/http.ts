import { CartError, resolveCart } from './cart'
import { CheckoutError, quoteCheckout, receiveOrder, type CheckoutPorts } from './checkout'

export function orderSettings(env:Record<string,string|undefined>){
  if(env.DAECHION_ORDERS_ENABLED!=='true'||env.DAECHION_INTAKE_ENABLED==='true'||!env.DAECHION_DATABASE_URL||!env.DAECHION_API_KEY||
    !env.DAECHION_TENANT_ID?.trim()||(env.DAECHION_ORDERS_SUBJECT_SECRET?.length??0)<32)return null
  const origins=[env.DAECHION_APP_ORIGIN??'',...(env.DAECHION_ADDITIONAL_ORIGINS??'').split(',').filter(Boolean)]
  if(!origins.every(v=>{try{const u=new URL(v);return u.origin===v&&(u.protocol==='https:'||u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))}catch{return false}}))return null
  return {origins}
}
export interface OrderHttpPorts extends CheckoutPorts {
  settings:{origins:string[]}|null
  ready():Promise<void>
}
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}})
export async function orderCatalog(ports:OrderHttpPorts){
  if(!ports.settings)return json({available:false,products:[]})
  try{
    await ports.ready()
    const source=await ports.catalog(),products=[]
    for(const row of source){
      if(!row||typeof row!=='object'||!('productId' in row))continue
      try{
        const item=resolveCart({items:[{productId:row.productId}]},source,ports.tenantId).items[0]
        products.push({productId:item.productId,title:item.title,saleKind:item.saleKind,priceWon:item.priceWon,lectureCount:item.lectures.length})
      }catch{/* A malformed or ambiguous product is never advertised as purchasable. */}
    }
    return json({available:products.length>0,products})
  }catch{return json({available:false,products:[]},503)}
}
export async function orderPost(kind:'cart'|'quotes'|'orders',request:Request,ports:OrderHttpPorts){
  if(!ports.settings)return json({code:'ORDERS_UNAVAILABLE',error:'현재 신청을 준비 중입니다.'},503)
  if(!ports.settings.origins.includes(request.headers.get('origin')??''))return json({error:'요청을 확인할 수 없습니다.'},403)
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return json({error:'입력 형식을 확인해주세요.'},415)
  try{
    const reader=request.body?.getReader();if(!reader)return json({error:'필수 정보를 입력해주세요.'},400)
    const chunks:Uint8Array[]=[];let size=0
    while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength
      if(size>16384){await reader.cancel();return json({error:'입력 내용이 너무 깁니다.'},413)}chunks.push(next.value)}
    let raw:unknown
    try{raw=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return json({error:'입력 형식을 확인해주세요.'},400)}
    await ports.ready()
    if(kind==='cart'){
      const cart=resolveCart(raw,await ports.catalog(),ports.tenantId)
      return json({status:cart.conflicts.length?'CART_CONFLICT':'READY',totalWon:cart.totalWon,
        items:cart.items.map(i=>({productId:i.productId,title:i.title,priceWon:i.priceWon})),conflicts:cart.conflicts},cart.conflicts.length?409:200)
    }
    if(kind==='quotes'){
      const result=await quoteCheckout(raw,ports)
      return json(result,result.status==='CART_CONFLICT'?409:200)
    }
    const result=await receiveOrder(raw,ports)
    return json(result,result.created?201:200)
  }catch(error){
    if(error instanceof CheckoutError){
      const statuses={INVALID_REQUEST:400,PRICE_CHANGED:409,QUOTE_UNAVAILABLE:409,REQUEST_CONFLICT:409,ORDER_PENDING:409,THROTTLED:429,CONFIGURATION_REQUIRED:503}
      const messages={INVALID_REQUEST:'필수 정보와 동의 항목을 확인해주세요.',PRICE_CHANGED:'선택한 상품이 변경되었습니다. 다시 확인해주세요.',QUOTE_UNAVAILABLE:'견적을 확인할 수 없습니다. 신청 내용을 다시 확인해주세요.',REQUEST_CONFLICT:'이미 접수된 요청과 다릅니다. 접수 내용을 확인해주세요.',ORDER_PENDING:'같은 수강 대상의 접수 내역이 있습니다. 담당자에게 확인해주세요.',THROTTLED:'잠시 후 다시 시도해주세요.',CONFIGURATION_REQUIRED:'현재 신청을 준비 중입니다.'}
      return json({code:error.code,error:messages[error.code]},statuses[error.code])
    }
    if(error instanceof CartError)return json({code:error.code,error:'선택한 상품 구성을 다시 확인해주세요.'},error.code==='INVALID_CART'?400:error.code==='INVALID_OWNERSHIP_REPORT'?503:409)
    // Never return raw SQL, submitted contacts, tokens or provider errors.
    return json({error:'접수를 확인하지 못했습니다. 같은 내용으로 다시 시도해주세요.'},503)
  }
}
