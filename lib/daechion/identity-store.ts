import { normalizePhone } from './client'
import { IdentityReview } from './identity'
import type { LedgerClient, ApplicationSnapshot } from './ledger'
import { automationTransaction, automationChanged } from './automation-store'

export async function claimIdentityPhones(client: LedgerClient, applicationId: string, snapshot: ApplicationSnapshot) {
  return automationTransaction(client, async () => {
    for (const phone of [...new Set([snapshot.studentPhone, snapshot.guardianPhone].filter(Boolean).map(normalizePhone))].sort()) {
      const row = await client.query(`INSERT INTO daechion_automation.identity_phone_claims(phone,application_id) VALUES($1,$2)
        ON CONFLICT(phone) DO UPDATE SET phone=EXCLUDED.phone WHERE identity_phone_claims.application_id=EXCLUDED.application_id RETURNING phone`, [phone, applicationId])
      if (!row.rows.length) throw new IdentityReview('identity_phone_busy', 'UNKNOWN')
    }
  })
}
export async function releaseIdentityPhones(client: LedgerClient, applicationId: string) {
  await client.query('DELETE FROM daechion_automation.identity_phone_claims WHERE application_id=$1', [applicationId])
}
export async function identityBinding(client: LedgerClient, applicationId: string) {
  const row = (await client.query('SELECT student_id::text,origin,manual_review_id FROM daechion_automation.identity_checks WHERE application_id=$1', [applicationId])).rows[0]
  if (!row?.student_id) return undefined
  const id = Number(row.student_id)
  if (!Number.isSafeInteger(id) || id <= 0) throw new IdentityReview('identity_binding_changed', 'UNKNOWN')
  return { id, origin: String(row.origin), manualReviewed:Boolean(row.manual_review_id) }
}
export async function saveIdentity(client: LedgerClient, applicationId: string, data: {
  status: 'PASSED' | 'REVIEW'; detected: 'NEW' | 'EXISTING' | 'UNKNOWN'; studentId?: number; created?: boolean; reason?: string
}) {
  return automationTransaction(client, async () => {
    await client.query('SELECT id FROM daechion_automation.applications WHERE id=$1 FOR UPDATE', [applicationId])
    const previous = await identityBinding(client, applicationId)
    if (data.studentId && previous && previous.id !== data.studentId) throw new IdentityReview('identity_binding_changed', data.detected)
    await client.query(`UPDATE daechion_automation.identity_checks SET status=$2,detected_type=$3,
      student_id=COALESCE(student_id,$4),origin=COALESCE(origin,$5),reason_code=$6,checked_at=now() WHERE application_id=$1`,
    [applicationId, data.status, data.detected, data.studentId ?? null,
      data.studentId ? (data.created ? 'CREATED' : 'EXISTING') : null, data.reason ?? null])
    await automationChanged(client, applicationId, 'identity_checked', 'ENROLLMENT_WORKER')
  })
}
