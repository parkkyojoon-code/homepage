import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

const billId = z.string().regex(/^[A-Za-z0-9_-]{1,20}$/)
const price = z.number().int().min(100).max(2147483647)
const credentials = z.object({ apiKey: z.string().min(1).max(32), member: z.string().min(1).max(60), merchant: z.string().min(1).max(60) })
export type PaySsamConfig = z.infer<typeof credentials> & { baseUrl: string; callbackUrl: string; enabled: boolean }
export class PaySsamError extends Error {
  constructor(public kind: 'DISABLED' | 'REJECTED' | 'UNKNOWN', public providerCode?: string) { super(`PaySsam ${kind}`) }
}
function equalSecret(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}
const receiptBrand = Symbol('server-queried-payssam-receipt')
export type VerifiedReceipt = { billId: string; amountWon: number; state: 'F' | 'W' | 'C' | 'D'; approvalNumber?: string; [receiptBrand]: true }
export function isVerifiedReceipt(value: VerifiedReceipt) { return value?.[receiptBrand] === true }
export function assertPaymentMatch(receipt: VerifiedReceipt, expectedBillId: string, expectedAmount: number) {
  if (!isVerifiedReceipt(receipt) || receipt.billId !== expectedBillId || receipt.amountWon !== expectedAmount) throw new PaySsamError('UNKNOWN')
}

export function payssamClient(config: PaySsamConfig, transport: typeof fetch = fetch) {
  const auth = credentials.parse(config)
  const base = new URL(config.baseUrl)
  const callback = new URL(config.callbackUrl)
  if ([base, callback].some(u => u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.port)) throw new Error('PaySsam requires configured HTTPS endpoints')
  async function post(path: string, bill: unknown) {
    if (!config.enabled) throw new PaySsamError('DISABLED')
    try {
      const response = await transport(`${base.toString().replace(/\/$/, '')}${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ ...auth, bill }), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
      })
      if (!response.ok) throw new PaySsamError('UNKNOWN')
      const result = z.object({ code: z.string(), data: z.unknown().optional() }).parse(await response.json())
      // Duplicate bill IDs may represent a prior request whose response was lost.
      if (result.code !== '0000') throw new PaySsamError(result.code === 'BILL_001' ? 'UNKNOWN' : 'REJECTED', result.code)
      return result.data
    } catch (e) {
      if (e instanceof PaySsamError) throw e
      // Never log request/response bodies: the provider echoes API keys and card information.
      throw new PaySsamError('UNKNOWN')
    }
  }
  return {
    async send(input: { billId: string; amountWon: number; name: string; phone: string; productName: string }) {
      const id = billId.parse(input.billId), amount = price.parse(input.amountWon)
      const phone = z.string().regex(/^010\d{8}$/).parse(input.phone)
      const hash = createHash('sha256').update(`${id},${phone},${amount}`).digest('hex')
      const data = await post('/bill', { billId: id, price: String(amount), phone, hash, sendType: 'TALK', callbackUrl: callback.toString(), memberName: z.string().trim().min(1).max(50).parse(input.name), productName: z.string().trim().min(1).max(200).parse(input.productName) })
      const result = z.object({ apiKey: z.string(), member: z.string(), merchant: z.string(), billId: z.string(), hash: z.string() }).safeParse(data)
      if (!result.success || !equalSecret(result.data.apiKey, auth.apiKey) || result.data.member !== auth.member || result.data.merchant !== auth.merchant || result.data.billId !== id || !equalSecret(result.data.hash, hash)) throw new PaySsamError('UNKNOWN')
      return { billId: id }
    },
    async read(id: string): Promise<VerifiedReceipt> {
      billId.parse(id)
      const data = await post('/bill/read', { billId: id })
      const parsed = z.object({ apiKey: z.string(), billId: z.string(), apprPrice: z.string().regex(/^[1-9]\d*$/), apprState: z.enum(['F','W','C','D']), apprNum: z.string().optional() }).safeParse(data)
      if (!parsed.success || !equalSecret(parsed.data.apiKey, auth.apiKey) || parsed.data.billId !== id) throw new PaySsamError('UNKNOWN')
      const amountWon = price.safeParse(Number(parsed.data.apprPrice))
      if (!amountWon.success) throw new PaySsamError('UNKNOWN')
      return { billId: id, amountWon: amountWon.data, state: parsed.data.apprState, approvalNumber: parsed.data.apprNum, [receiptBrand]: true }
    },
  }
}
