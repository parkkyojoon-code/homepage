import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { normalizePhone } from './client'
import { productBinding, type ProductBinding } from './product-policy'
import type { PurchaseProcess } from '../purchase-process'

const phone = z.string().transform(normalizePhone)
const optionalPhone = z.string().default('').transform(value => value.trim() ? normalizePhone(value) : '')
const money = z.number().int().min(0).max(2147483647)
export const applicationSnapshotSchema = z.object({
  productId: z.string().trim().min(1), productTitle: z.string().trim().min(1),
  purchaseProcess: z.literal('PROCESS_2').default('PROCESS_2'),
  tuitionWon: money, textbookWon: money, totalWon: money.positive(),
  studentName: z.string().trim().min(1), guardianName: z.string().trim().default(''),
  studentPhone: phone, payerPhone: phone, guardianPhone: optionalPhone,
  applicantType: z.enum(['STUDENT','GUARDIAN']),
  studentHistory: z.enum(['EXISTING','NEW']).optional(),
  mode: z.enum(['ONLINE','OFFLINE']).default('ONLINE'), campus: z.string().trim().default(''),
  selectedSubjects: z.array(z.string().trim().min(1)).default([]),
  additionalInputs: z.array(z.object({ label: z.string().trim().min(1), value: z.string() })).default([]),
  confirmPayment: z.literal(true), agreePrivacy: z.literal(true), noticeVersion: z.string().trim().min(1),
}).strict().refine(value => value.totalWon === value.tuitionWon + value.textbookWon, 'Amount mismatch')
export type ApplicationSnapshot = z.infer<typeof applicationSnapshotSchema>
export interface LedgerClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: Row[] }>
}
export class LedgerError extends Error {
  constructor(public readonly code: 'product_not_enabled' | 'request_key_conflict' | 'bill_not_reserved') { super(code) }
}

// The caller must supply server-resolved product/prices and a dedicated DB connection.
// Do not pass the browser body directly or use a shared Pool as a transaction client.
export async function createApplication(client: LedgerClient, requestKey: string, raw: unknown, bindings: readonly ProductBinding[], process: PurchaseProcess = 'PROCESS_1') {
  z.string().uuid().parse(requestKey)
  const snapshot = applicationSnapshotSchema.parse(raw)
  const binding = productBinding(snapshot.productId, bindings, process)
  if (!binding) throw new LedgerError('product_not_enabled')
  const fingerprint = createHash('sha256').update(JSON.stringify({ snapshot, lectureIds: binding.lectureIds })).digest('hex')
  const id = randomUUID()
  await client.query('BEGIN')
  try {
    const inserted = await client.query<{ id: string }>(`INSERT INTO daechion_automation.applications
      (id,request_key,request_fingerprint,product_id,product_title,tuition_won,textbook_won,total_won,submission)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) ON CONFLICT(request_key) DO NOTHING RETURNING id`,
    [id, requestKey, fingerprint, snapshot.productId, snapshot.productTitle, snapshot.tuitionWon, snapshot.textbookWon, snapshot.totalWon, JSON.stringify(snapshot)])
    if (!inserted.rows.length) {
      const previous = await client.query<{ id: string; request_fingerprint: string }>(
        'SELECT id,request_fingerprint FROM daechion_automation.applications WHERE request_key=$1', [requestKey])
      if (previous.rows[0]?.request_fingerprint !== fingerprint) throw new LedgerError('request_key_conflict')
      await client.query('COMMIT')
      return { id: previous.rows[0].id, created: false }
    }
    for (const lectureId of binding.lectureIds) {
      await client.query('INSERT INTO daechion_automation.registrations(application_id,lecture_id) VALUES($1,$2)', [id, lectureId])
    }
    await client.query('INSERT INTO daechion_automation.identity_checks(application_id) VALUES($1)', [id])
    await client.query("INSERT INTO daechion_automation.outbox(id,application_id,kind,event_version) VALUES($1,$2,'SHEETS',1)", [randomUUID(), id])
    await client.query("INSERT INTO daechion_automation.events(application_id,kind,actor) VALUES($1,'application_created','SYSTEM')", [id])
    await client.query('COMMIT')
    return { id, created: true }
  } catch (error) { await client.query('ROLLBACK'); throw error }
}

// Reserve before a provider call. The caller may only use this persisted numeric ID.
// This function neither sends bills nor supersedes/cancels an existing bill.
export async function reserveBill(client: LedgerClient, input: {
  applicationId: string; revision: number; providerAccount: string; billId: string; amountWon: number
}) {
  const parsed = z.object({ applicationId: z.string().uuid(), revision: z.number().int().positive(),
    providerAccount: z.string().trim().min(1), billId: z.string().regex(/^\d{1,64}$/), amountWon: money.positive() }).parse(input)
  const result = await client.query<{ id: string }>(`INSERT INTO daechion_automation.bills
    (id,application_id,revision,provider_account,bill_id,amount_won) VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT(application_id,revision) DO NOTHING RETURNING id`,
  [randomUUID(), parsed.applicationId, parsed.revision, parsed.providerAccount, parsed.billId, parsed.amountWon])
  if (result.rows.length) return result.rows[0].id
  const previous = await client.query<{ id: string; provider_account: string; bill_id: string; amount_won: number }>(
    'SELECT id,provider_account,bill_id,amount_won FROM daechion_automation.bills WHERE application_id=$1 AND revision=$2',
    [parsed.applicationId, parsed.revision])
  const row = previous.rows[0]
  if (!row || row.provider_account !== parsed.providerAccount || row.bill_id !== parsed.billId || row.amount_won !== parsed.amountWon) {
    throw new LedgerError('bill_not_reserved')
  }
  return row.id
}
