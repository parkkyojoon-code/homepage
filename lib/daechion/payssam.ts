import { createHash } from 'node:crypto'
import { z } from 'zod'

export interface BillSendJob {
  billId: string; amountWon: number; recipientName: string; recipientPhone: string; productName: string
}
export interface BillingProvider {
  readonly accountId: string
  send(job: BillSendJob): Promise<'SENT' | 'UNKNOWN'>
}
const billJob = z.object({
  billId: z.string().regex(/^\d{20}$/), amountWon: z.number().int().positive().max(2147483647),
  recipientName: z.string().trim().min(1).max(80), recipientPhone: z.string().regex(/^010\d{8}$/),
  productName: z.string().trim().min(1),
}).strict()
const responseSchema = z.object({
  code: z.literal('0000'), bill_id: z.string(), hash: z.string().optional(),
  apikey: z.string().optional(), member: z.string().optional(), merchant: z.string().optional(),
})
const BASE = 'https://erp-api.payssam.kr'

// Same V1 send endpoint, account fields and SHA-256 input as the running legacy
// apply_checker.py. No import of that program, its credentials, Sheets or messages.
export function payssamBillingProvider(settings: {
  apiKey: string; member: string; merchant: string; callbackUrl: string;
  fetcher?: typeof fetch; now?: () => Date
}): BillingProvider {
  if (![settings.apiKey, settings.member, settings.merchant].every(value => typeof value === 'string' && value.trim())) {
    throw Error('BILLING_PROVIDER_NOT_CONFIGURED')
  }
  let callback: URL
  try { callback = new URL(settings.callbackUrl) } catch { throw Error('INVALID_BILLING_CALLBACK') }
  if (callback.protocol !== 'https:' || callback.username || callback.password || callback.hash || callback.search ||
    callback.pathname.startsWith('/api/lectures')) throw Error('INVALID_BILLING_CALLBACK')
  const account = { apikey: settings.apiKey, member: settings.member, merchant: settings.merchant }
  const accountId = createHash('sha256').update(JSON.stringify([BASE, account.member, account.merchant])).digest('hex')
  const fetcher = settings.fetcher ?? fetch
  return {
    accountId,
    async send(raw) {
      const parsed = billJob.safeParse(raw)
      if (!parsed.success) return 'UNKNOWN'
      const job = parsed.data
      const hash = createHash('sha256').update(`${job.billId},${job.recipientPhone},${job.amountWon}`).digest('hex')
      try {
        // Keep the existing provider's 30-day bill validity. The independent
        // seven-day automation wait must not invalidate a payable invoice.
        const expires = new Date((settings.now?.() ?? new Date()).getTime() + 30 * 86400000)
        const expireDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul',
          year: 'numeric', month: '2-digit', day: '2-digit' }).format(expires)
        const response = await fetcher(`${BASE}/if/bill/send`, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...account, bill: {
            bill_id: job.billId, product_nm: job.productName, member_nm: job.recipientName,
            phone: job.recipientPhone, price: String(job.amountWon), hash,
            message: '신청하신 강의 수강료 안내입니다.', expire_dt: expireDate, callbackURL: callback.href,
          } }),
        })
        if (response.status !== 200) return 'UNKNOWN'
        // A provider response can echo keys and names. Never retain it on an error.
        const body = responseSchema.safeParse(await response.json())
        if (!body.success || body.data.bill_id !== job.billId ||
          (body.data.hash !== undefined && body.data.hash !== hash) ||
          Object.entries(account).some(([key, value]) => body.data[key as keyof typeof account] !== undefined && body.data[key as keyof typeof account] !== value)) return 'UNKNOWN'
        return 'SENT'
      } catch { return 'UNKNOWN' }
    },
  }
}
