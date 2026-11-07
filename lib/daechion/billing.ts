import { randomBytes, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { applicationSnapshotSchema, reserveBill, type LedgerClient } from './ledger'
import type { BillingProvider, BillSendJob } from './payssam'

export class BillingError extends Error {
  constructor(public readonly code: 'BILLING_ACCOUNT_MISMATCH' | 'BILLING_STORAGE_FAILED') { super(code) }
}
const applicationIdSchema = z.string().uuid()
const accountSchema = z.string().trim().min(1).max(100)
type ApplicationRow = {
  id: string; submission: unknown; total_won: number; payment_state: string; automation_state: string
} & Record<string, unknown>

// Numeric 20-character ID: a separate prefix from legacy YYYY... IDs. Uniqueness
// is also enforced by the DB before any provider call; a collision never sends.
export function newBillId(): string {
  return '9' + (randomBytes(8).readBigUInt64BE() % (10n ** 19n)).toString().padStart(19, '0')
}
async function transaction<T>(client: LedgerClient, run: () => Promise<T>): Promise<T> {
  await client.query('BEGIN')
  try { const result = await run(); await client.query('COMMIT'); return result }
  catch (error) { await client.query('ROLLBACK'); throw error }
}
async function application(client: LedgerClient, id: string) {
  const result = await client.query<ApplicationRow>(
    'SELECT id,submission,total_won,payment_state,automation_state FROM daechion_automation.applications WHERE id=$1 FOR UPDATE', [id])
  return result.rows[0]
}
async function changed(client: LedgerClient, applicationId: string, event: string, review: 'bill_send_unknown' | 'billing_account_mismatch' | null) {
  const result = await client.query<{ version: string }>(`UPDATE daechion_automation.applications SET version=version+1,updated_at=now(),
    review_code=CASE WHEN $2::text IS NOT NULL THEN COALESCE(review_code,$2) WHEN review_code='bill_send_unknown' THEN NULL ELSE review_code END
    WHERE id=$1 RETURNING version::text`, [applicationId, review])
  await client.query("INSERT INTO daechion_automation.outbox(id,application_id,kind,event_version) VALUES($1,$2,'SHEETS',$3)",
    [randomUUID(), applicationId, result.rows[0].version])
  await client.query("INSERT INTO daechion_automation.events(application_id,kind,actor) VALUES($1,$2,'BILLING_WORKER')", [applicationId, event])
}

async function holdAccountMismatch(client: LedgerClient, applicationId: string) {
  await transaction(client, async () => {
    const app = await application(client, applicationId)
    if (!app || app.automation_state !== 'ACTIVE') return
    await client.query("UPDATE daechion_automation.applications SET automation_state='HOLD' WHERE id=$1", [applicationId])
    await changed(client, applicationId, 'billing_held', 'billing_account_mismatch')
  })
}

export async function reserveApplicationBill(client: LedgerClient, applicationId: string, accountId: string) {
  applicationIdSchema.parse(applicationId); accountSchema.parse(accountId)
  return transaction(client, async () => {
    const app = await application(client, applicationId)
    if (!app || app.payment_state !== 'PENDING' || app.automation_state !== 'ACTIVE') return null
    const snapshot = applicationSnapshotSchema.parse(app.submission)
    if (snapshot.purchaseProcess !== 'PROCESS_2' || snapshot.totalWon !== app.total_won) return null
    const targets = await client.query('SELECT lecture_id FROM daechion_automation.registrations WHERE application_id=$1', [applicationId])
    if (!targets.rows.length) return null
    const existing = await client.query<{ id: string; provider_account: string }>(
      'SELECT id,provider_account FROM daechion_automation.bills WHERE application_id=$1 ORDER BY revision DESC', [applicationId])
    if (existing.rows.length) {
      if (existing.rows[0].provider_account !== accountId) throw new BillingError('BILLING_ACCOUNT_MISMATCH')
      // Never create a new revision automatically, including cancelled/old bills.
      return existing.rows[0].id
    }
    const id = await reserveBill(client, { applicationId, providerAccount: accountId, revision: 1, billId: newBillId(), amountWon: app.total_won })
    await changed(client, applicationId, 'bill_reserved', null)
    return id
  })
}

export async function claimBillSend(client: LedgerClient, applicationId: string, accountId: string): Promise<(BillSendJob & { id: string }) | null> {
  applicationIdSchema.parse(applicationId); accountSchema.parse(accountId)
  return transaction(client, async () => {
    const app = await application(client, applicationId)
    if (!app || app.payment_state !== 'PENDING' || app.automation_state !== 'ACTIVE') return null
    const snapshot = applicationSnapshotSchema.parse(app.submission)
    const claimed = await client.query<{ id: string; bill_id: string; amount_won: number }>(`UPDATE daechion_automation.bills
      SET state='SEND_UNKNOWN' WHERE application_id=$1 AND provider_account=$2 AND is_current AND state='RESERVED'
      RETURNING id,bill_id,amount_won`, [applicationId, accountId])
    if (!claimed.rows.length) return null
    const bill = claimed.rows[0]
    if (bill.amount_won !== snapshot.totalWon || !/^\d{20}$/.test(bill.bill_id)) throw new BillingError('BILLING_STORAGE_FAILED')
    // Commit uncertainty BEFORE contacting the provider. A crash or timeout never
    // returns this invoice to the send queue, even if no response was recorded.
    await changed(client, applicationId, 'bill_send_attempted', 'bill_send_unknown')
    return { id: bill.id, billId: bill.bill_id, amountWon: bill.amount_won,
      recipientName: snapshot.studentName, recipientPhone: snapshot.payerPhone, productName: snapshot.productTitle }
  })
}

export async function recordBillSent(client: LedgerClient, applicationId: string, billRecordId: string, accountId: string) {
  applicationIdSchema.parse(applicationId); z.string().uuid().parse(billRecordId); accountSchema.parse(accountId)
  return transaction(client, async () => {
    if (!await application(client, applicationId)) return false
    const updated = await client.query(`UPDATE daechion_automation.bills SET state='SENT',sent_at=now(),due_at=now()+interval '7 days'
      WHERE id=$1 AND application_id=$2 AND provider_account=$3 AND is_current AND state='SEND_UNKNOWN' RETURNING id`, [billRecordId, applicationId, accountId])
    if (!updated.rows.length) return false
    await changed(client, applicationId, 'bill_sent', null)
    return true
  })
}

export interface BillingPorts {
  provider: BillingProvider
  withClient<T>(run: (client: LedgerClient) => Promise<T>): Promise<T>
}
export async function sendApplicationBill(applicationId: string, enabled: boolean, ports: BillingPorts) {
  if (!enabled) return { outcome: 'DISABLED' as const }
  try {
    const reserved = await ports.withClient(client => reserveApplicationBill(client, applicationId, ports.provider.accountId))
    if (!reserved) return { outcome: 'SKIPPED' as const }
    const claimed = await ports.withClient(client => claimBillSend(client, applicationId, ports.provider.accountId))
    if (!claimed) return { outcome: 'SKIPPED' as const }
    // The DB-only id is not part of the provider payload contract.
    const { id, ...job } = claimed
    let outcome: 'SENT' | 'UNKNOWN'
    try { outcome = await ports.provider.send(job) } catch { outcome = 'UNKNOWN' }
    if (outcome !== 'SENT') return { outcome: 'UNKNOWN' as const }
    const recorded = await ports.withClient(client => recordBillSent(client, applicationId, id, ports.provider.accountId))
    return { outcome: recorded ? 'SENT' as const : 'UNKNOWN' as const }
  } catch (error) {
    if (error instanceof BillingError) {
      if (error.code === 'BILLING_ACCOUNT_MISMATCH') {
        // Remove a known unsafe job from the active batch instead of allowing
        // several old-account jobs to starve later applications on every cycle.
        try { await ports.withClient(client => holdAccountMismatch(client, applicationId)) }
        catch { throw new BillingError('BILLING_STORAGE_FAILED') }
      }
      throw error
    }
    // Never return raw SQL/connection errors with submitted personal data.
    throw new BillingError('BILLING_STORAGE_FAILED')
  }
}
