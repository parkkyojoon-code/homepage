import { z } from 'zod'
import type { LedgerClient } from './ledger'
import type { PaymentObservation, PaymentProvider } from './payssam'
import { automationTransaction, automationChanged } from './automation-store'

export interface PaymentTarget {
  applicationId: string; recordId: string; billId: string; accountId: string; checkedToken: string | null
}
const recoverableReviews = new Set(['bill_send_unknown', 'payment_query_unknown', 'unpaid_wait_closed'])
function time(value: unknown): number { return value === null ? NaN : new Date(value as string).getTime() }

export async function paymentTarget(client: LedgerClient, applicationId: string, accountId: string): Promise<PaymentTarget | null> {
  z.string().uuid().parse(applicationId)
  const result = await client.query<{ id: string; bill_id: string; provider_account: string; checked_token: string | null }>(`
    SELECT id,bill_id,provider_account,checked_at::text AS checked_token FROM daechion_automation.bills
    WHERE application_id=$1 AND is_current AND state IN ('SENT','SEND_UNKNOWN')`, [applicationId])
  const row = result.rows[0]
  if (!row || row.provider_account !== accountId || !/^\d{20}$/.test(row.bill_id)) return null
  return { applicationId, recordId: row.id, billId: row.bill_id, accountId, checkedToken: row.checked_token }
}

// The target and observation come only from the server's authenticated provider
// adapter. No public callback or applicant request can assert a payment here.
export async function applyPaymentObservation(client: LedgerClient, target: PaymentTarget, observation: PaymentObservation) {
  return automationTransaction(client, async () => {
    const app = (await client.query(`SELECT *,now() AS observed_at FROM daechion_automation.applications WHERE id=$1 FOR UPDATE`, [target.applicationId])).rows[0]
    if (!app) return 'STALE'
    const bill = (await client.query(`SELECT * FROM daechion_automation.bills WHERE id=$1 AND application_id=$2 AND is_current
      AND provider_account=$3 AND bill_id=$4 AND checked_at IS NOT DISTINCT FROM $5::timestamptz FOR UPDATE`,
    [target.recordId, target.applicationId, target.accountId, target.billId, target.checkedToken])).rows[0]
    if (!bill || !['SENT', 'SEND_UNKNOWN'].includes(String(bill.state))) return 'STALE'
    const old = JSON.stringify([app.payment_state, app.automation_state, app.review_code, bill.state, bill.last_payment_state, app.paid_at])
    let payment = String(app.payment_state), automation = String(app.automation_state), review = app.review_code as string | null
    let paidAt = app.paid_at, billState = String(bill.state), last = 'UNKNOWN'
    const clearTransient = () => { if (review && recoverableReviews.has(review)) review = null }
    const hold = (reason: string) => {
      if (automation === 'ACTIVE' || (automation === 'CLOSED' && review === 'unpaid_wait_closed')) automation = 'HOLD'
      if (!review || recoverableReviews.has(review)) review = reason
    }
    if (observation.state === 'UNKNOWN' || observation.billId !== target.billId) {
      if (payment !== 'PAID' && payment !== 'CANCELLED') payment = 'UNKNOWN'
      if (!review) review = 'payment_query_unknown'
    } else if (observation.state === 'C' || observation.state === 'D') {
      last = 'CANCELLED'; payment = 'CANCELLED'; billState = observation.state === 'C' ? 'CANCELLED' : 'DESTROYED'
      hold('payment_cancelled')
    } else if (observation.state === 'W') {
      last = 'PENDING'
      if (payment === 'PAID' || payment === 'CANCELLED') hold('payment_state_regressed')
      else {
        payment = 'PENDING'
        if (bill.state === 'SENT') {
          if (time(app.observed_at) >= time(bill.due_at) && automation === 'ACTIVE') {
            automation = 'CLOSED'; if (!review || recoverableReviews.has(review)) review = 'unpaid_wait_closed'
          } else if (review === 'payment_query_unknown') review = null
        }
      }
    } else {
      last = 'PAID'
      if (observation.amountWon !== app.total_won || observation.amountWon !== bill.amount_won) {
        hold('payment_amount_mismatch')
      } else {
        payment = 'PAID'
        const approved = time(observation.paidAt), sent = time(bill.sent_at), due = time(bill.due_at)
        const validTime = Number.isFinite(approved) && approved <= time(app.observed_at) + 60000 && approved >= sent - 60000
        if (Number.isFinite(approved) && !app.paid_at) paidAt = new Date(approved).toISOString()
        if (bill.state !== 'SENT') hold('bill_send_unknown')
        else if (!validTime) hold('payment_time_unknown')
        else if (approved > due) hold('late_payment')
        else if (paidAt && app.paid_at && time(app.paid_at) !== approved) hold('payment_evidence_changed')
        else if (automation === 'CLOSED' && review === 'unpaid_wait_closed') { automation = 'ACTIVE'; review = null }
        else if (automation === 'ACTIVE') clearTransient()
      }
    }
    await client.query(`UPDATE daechion_automation.bills SET state=$2,last_payment_state=$3,
      checked_at=GREATEST(now(),COALESCE(checked_at+interval '1 microsecond',now())) WHERE id=$1`, [target.recordId, billState, last])
    await client.query(`UPDATE daechion_automation.applications SET payment_state=$2,automation_state=$3,review_code=$4,paid_at=$5 WHERE id=$1`,
      [target.applicationId, payment, automation, review, paidAt])
    if (automation !== 'ACTIVE' || payment === 'CANCELLED') {
      await client.query("UPDATE daechion_automation.registrations SET state='STOPPED' WHERE application_id=$1 AND state='PENDING'", [target.applicationId])
      await client.query("UPDATE daechion_automation.registrations SET state='REVIEW',lease_token=NULL,lease_until=NULL WHERE application_id=$1 AND state='RUNNING'", [target.applicationId])
      await client.query("UPDATE daechion_automation.outbox SET state='FAILED',lease_token=NULL,lease_until=NULL WHERE application_id=$1 AND kind='READY_MESSAGE' AND state='PENDING'", [target.applicationId])
      await client.query("UPDATE daechion_automation.applications SET notification_state='FAILED' WHERE id=$1 AND notification_state='PENDING'", [target.applicationId])
    } else if (payment === 'PAID' && review === null && app.automation_state === 'CLOSED' && app.review_code === 'unpaid_wait_closed') {
      await client.query("UPDATE daechion_automation.registrations SET state='PENDING' WHERE application_id=$1 AND state='STOPPED'", [target.applicationId])
    }
    const next = JSON.stringify([payment, automation, review, billState, last, paidAt])
    if (old !== next) await automationChanged(client, target.applicationId, 'payment_observed', 'BILLING_WORKER')
    return payment === 'PAID' && automation === 'ACTIVE' && review === null && last === 'PAID' ? 'PAID' : 'RECORDED'
  })
}

export async function checkApplicationPayment(applicationId: string, ports: {
  provider: PaymentProvider; withClient<T>(run: (client: LedgerClient) => Promise<T>): Promise<T>
}) {
  const target = await ports.withClient(client => paymentTarget(client, applicationId, ports.provider.accountId))
  if (!target) return 'SKIPPED'
  let observation: PaymentObservation
  try { observation = await ports.provider.read(target.billId) } catch { observation = { state: 'UNKNOWN' } }
  const result = await ports.withClient(client => applyPaymentObservation(client, target, observation))
  return observation.state === 'UNKNOWN' && result !== 'STALE' ? 'UNKNOWN' : result
}
