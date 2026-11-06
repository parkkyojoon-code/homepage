import { createHash } from 'node:crypto'
import { z } from 'zod'

export interface BillSendJob {
  billId: string; amountWon: number; recipientName: string; recipientPhone: string; productName: string
}
export interface BillingProvider {
  readonly accountId: string
  send(job: BillSendJob): Promise<'SENT' | 'UNKNOWN'>
}
export type PaymentObservation = { state: 'UNKNOWN' } | {
  state: 'F' | 'W' | 'C' | 'D'; billId: string; amountWon: number | null; paidAt: string | null
}
export interface PaymentProvider {
  readonly accountId: string
  read(billId: string): Promise<PaymentObservation>
}

// Unknown formats remain unknown; local server timezone must never change payment
// eligibility. V1 compact/space-separated approval timestamps are interpreted as KST.
export function approvalTimestamp(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const compact = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(raw)
  const separated = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(raw)
  const parts = compact ?? separated
  if (parts) {
    const [, y, m, d, h, min, sec] = parts
    const canonical = `${y}-${m}-${d}T${h}:${min}:${sec}`
    const value = new Date(`${canonical}+09:00`)
    if (!Number.isFinite(value.getTime()) || new Date(value.getTime() + 9 * 3600000).toISOString().slice(0, 19) !== canonical) return null
    return value.toISOString()
  }
  const iso = z.string().datetime({ offset: true }).safeParse(raw)
  return iso.success ? new Date(iso.data).toISOString() : null
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
}): BillingProvider & PaymentProvider {
  if (![settings.apiKey, settings.member, settings.merchant].every(value => typeof value === 'string' && value.trim())) {
    throw Error('BILLING_PROVIDER_NOT_CONFIGURED')
  }
  let callback: URL
  try { callback = new URL(settings.callbackUrl) } catch { throw Error('INVALID_BILLING_CALLBACK') }
  if (callback.protocol !== 'https:' || callback.username || callback.password || callback.hash || callback.search ||
    callback.pathname !== '/api/daechion/payssam/notification') throw Error('INVALID_BILLING_CALLBACK')
  const account = { apikey: settings.apiKey, member: settings.member, merchant: settings.merchant }
  const accountId = createHash('sha256').update(JSON.stringify([BASE, account.member, account.merchant])).digest('hex')
  const fetcher = settings.fetcher ?? fetch
  return {
    accountId,
    async read(billId) {
      if (!/^\d{20}$/.test(billId)) return { state: 'UNKNOWN' }
      try {
        const response = await fetcher(`${BASE}/if/bill/read`, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...account, bill_id: billId }),
        })
        if (response.status !== 200) return { state: 'UNKNOWN' }
        const parsed = z.object({ code: z.literal('0000').optional(), bill_id: z.literal(billId),
          appr_state: z.enum(['F', 'W', 'C', 'D']), appr_price: z.string().nullable().optional(), appr_dt: z.string().max(40).nullable().optional(),
          apikey: z.string().optional(), member: z.string().optional(), merchant: z.string().optional(),
        }).safeParse(await response.json())
        if (!parsed.success || Object.entries(account).some(([key, value]) =>
          parsed.data[key as keyof typeof account] !== undefined && parsed.data[key as keyof typeof account] !== value)) return { state: 'UNKNOWN' }
        const data = parsed.data
        const amount = /^\d{1,10}$/.test(data.appr_price ?? '') ? Number(data.appr_price) : null
        const validAmount = amount !== null && amount > 0 && amount <= 2147483647 ? amount : null
        if (data.appr_state === 'F' && validAmount === null) return { state: 'UNKNOWN' }
        return { state: data.appr_state, billId, amountWon: validAmount, paidAt: data.appr_state === 'F' ? approvalTimestamp(data.appr_dt) : null }
      } catch { return { state: 'UNKNOWN' } }
    },
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
