import { z } from 'zod'
import { IntakeError, submitApplication, type IntakePorts } from './intake'
import { LedgerError } from './ledger'
import { productBinding, type ProductBinding } from './product-policy'

export function intakeSettings(env: Record<string,string|undefined>) {
  if (env.DAECHION_INTAKE_ENABLED !== 'true') return null
  const origins = [env.DAECHION_APP_ORIGIN ?? '', ...(env.DAECHION_ADDITIONAL_ORIGINS ?? '').split(',').filter(Boolean)]
  if (!origins.every(value => { try { const url=new URL(value);return url.origin === value && (url.protocol==='https:' || (url.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) } catch { return false } })) return null
  if (!env.DAECHION_DATABASE_URL || (env.DAECHION_PRODUCT_BINDINGS_JSON?.length ?? 0) > 32768) return null
  try {
    const bindings = z.array(z.object({productId:z.string().trim().min(1).max(100),lectureIds:z.array(z.number().int().positive().safe()).min(1).max(30)}).strict()).max(500).parse(JSON.parse(env.DAECHION_PRODUCT_BINDINGS_JSON ?? ''))
    for (const binding of bindings) if (!productBinding(binding.productId, bindings, 'PROCESS_2')) return null
    return { origins, bindings }
  } catch { return null }
}
export interface IntakeHttpPorts extends IntakePorts {
  settings: { origins: string[]; bindings: readonly ProductBinding[] } | null
  ready(): Promise<void>
}
function json(body: unknown, status = 200) {
  return Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}})
}
export async function intakeAvailability(productId: string, ports: IntakeHttpPorts) {
  if (!ports.settings) return json({available:false})
  try {
    const product = await ports.loadProduct(productId)
    const binding = product && productBinding(product.id,ports.bindings,product.purchaseProcess)
    if (!product?.visible || !binding || product.subjectSelection != null) return json({available:false})
    await ports.ready()
    return json({available:true})
  } catch { return json({available:false}) }
}
export async function intakePost(request: Request, ports: IntakeHttpPorts) {
  if (!ports.settings) return json({success:false,error:'현재 신청을 준비 중입니다.',code:'INTAKE_UNAVAILABLE'},503)
  if (!ports.settings.origins.includes(request.headers.get('origin') ?? '')) return json({success:false,error:'요청을 확인할 수 없습니다.'},403)
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return json({success:false,error:'입력 형식을 확인해주세요.'},415)
  try {
    const reader = request.body?.getReader()
    if (!reader) return json({success:false,error:'필수 정보를 입력해주세요.'},400)
    const chunks: Uint8Array[] = []; let size = 0
    while (true) {
      const next = await reader.read(); if(next.done) break
      size += next.value.byteLength
      if(size > 8192) { await reader.cancel(); return json({success:false,error:'입력 내용이 너무 깁니다.'},413) }
      chunks.push(next.value)
    }
    let raw: unknown
    try { raw = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return json({success:false,error:'입력 형식을 확인해주세요.'},400) }
    await ports.ready()
    const result = await submitApplication(raw,ports)
    return json({success:true,...result},result.created?201:200)
  } catch (error) {
    if (error instanceof IntakeError) {
      const status = error.code === 'PRICE_CHANGED' || error.code === 'REQUEST_CONFLICT' ? 409 : error.code === 'INVALID_APPLICATION' ? 400 : 503
      const messages = {PRICE_CHANGED:'수강료가 변경되었습니다. 페이지를 새로 열어 확인해주세요.',REQUEST_CONFLICT:'이미 접수된 내용과 다릅니다. 학원에 문의해 접수 내용을 확인해주세요.',INVALID_APPLICATION:'필수 정보와 동의 항목을 확인해주세요.',PRODUCT_UNAVAILABLE:'현재 신청할 수 없는 수업입니다.',PRODUCT_NOT_CONFIGURED:'현재 신청을 준비 중입니다.'}
      return json({success:false,error:messages[error.code],code:error.code},status)
    }
    if (error instanceof LedgerError && error.code === 'intake_throttled') return json({success:false,error:'잠시 후 다시 시도해주세요.',code:'INTAKE_THROTTLED'},429)
    return json({success:false,error:'접수를 확인하지 못했습니다. 잠시 후 같은 내용으로 다시 시도해주세요.'},503)
  }
}
