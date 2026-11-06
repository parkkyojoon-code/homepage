import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { applicationSnapshotSchema, type LedgerClient, type ApplicationSnapshot } from './ledger'
import { DaechionError, type StudentPort, type DaechionEnrollment } from './client'
import { resolveStudent, IdentityReview } from './identity'
import { claimIdentityPhones, releaseIdentityPhones, identityBinding, saveIdentity } from './identity-store'
import { automationChanged, automationTransaction } from './automation-store'

export interface EnrollmentPort extends StudentPort {
  enroll(lectureId: number, studentId: number): Promise<DaechionEnrollment>
}
export interface EnrollmentJob {
  applicationId: string; lectureId: number; token: string; snapshot: ApplicationSnapshot
}
async function lockApplication(client: LedgerClient, applicationId: string) {
  return (await client.query('SELECT * FROM daechion_automation.applications WHERE id=$1 FOR UPDATE', [applicationId])).rows[0]
}
async function eligible(client: LedgerClient, applicationId: string) {
  return (await client.query(`SELECT id FROM daechion_automation.bills WHERE application_id=$1 AND is_current
    AND state='SENT' AND last_payment_state='PAID'`, [applicationId])).rows.length > 0
}
function safeId(value: unknown): number {
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  return z.number().int().positive().safe().parse(parsed)
}

export async function claimEnrollment(client: LedgerClient, applicationId: string): Promise<EnrollmentJob | null> {
  z.string().uuid().parse(applicationId)
  return automationTransaction(client, async () => {
    const app = await lockApplication(client, applicationId)
    if (!app || app.payment_state !== 'PAID' || app.automation_state !== 'ACTIVE' || app.review_code !== null || !await eligible(client, applicationId)) return null
    const running = (await client.query(`SELECT lecture_id,lease_until<=now() AS expired FROM daechion_automation.registrations
      WHERE application_id=$1 AND state='RUNNING'`, [applicationId])).rows
    if (running.length) {
      if (running.some(row => row.expired)) {
        // Expired claims may have completed an external write. Never put them back
        // into PENDING without reconciliation/admin action.
        await client.query("UPDATE daechion_automation.registrations SET state='REVIEW',lease_token=NULL,lease_until=NULL WHERE application_id=$1 AND state='RUNNING'", [applicationId])
        await client.query("UPDATE daechion_automation.applications SET automation_state='HOLD',review_code='enrollment_unknown' WHERE id=$1", [applicationId])
        await automationChanged(client, applicationId, 'enrollment_review', 'ENROLLMENT_WORKER')
      }
      return null
    }
    const row = (await client.query(`SELECT lecture_id FROM daechion_automation.registrations
      WHERE application_id=$1 AND state='PENDING' ORDER BY lecture_id LIMIT 1`, [applicationId])).rows[0]
    if (!row) return null
    const lectureId = safeId(row.lecture_id), token = randomUUID()
    const snapshot = applicationSnapshotSchema.parse(app.submission)
    await client.query(`UPDATE daechion_automation.registrations SET state='RUNNING',lease_token=$3,lease_until=now()+interval '120 seconds',version=version+1
      WHERE application_id=$1 AND lecture_id=$2`, [applicationId, lectureId, token])
    await automationChanged(client, applicationId, 'enrollment_claimed', 'ENROLLMENT_WORKER')
    return { applicationId, lectureId, token, snapshot }
  })
}

// Check immediately before each external write. A provider operation cannot be
// atomic with our DB; cancellation during the call is surfaced for manual review.
export async function enrollmentFence(client: LedgerClient, job: EnrollmentJob, identityRequired = false) {
  const rows = await client.query(`SELECT r.application_id FROM daechion_automation.registrations r
    JOIN daechion_automation.applications a ON a.id=r.application_id
    WHERE a.id=$1 AND r.lecture_id=$2 AND r.lease_token=$3 AND r.state='RUNNING' AND r.lease_until>now()
    AND a.payment_state='PAID' AND a.automation_state='ACTIVE' AND a.review_code IS NULL
    AND EXISTS(SELECT 1 FROM daechion_automation.bills b WHERE b.application_id=a.id AND b.is_current AND b.state='SENT' AND b.last_payment_state='PAID')
    AND (NOT $4::boolean OR EXISTS(SELECT 1 FROM daechion_automation.identity_checks i WHERE i.application_id=a.id AND i.status='PASSED' AND i.student_id IS NOT NULL))`,
  [job.applicationId, job.lectureId, job.token, identityRequired])
  return rows.rows.length > 0
}

export async function reviewEnrollment(client: LedgerClient, job: EnrollmentJob, reason: string) {
  const allowed = ['student_identity_review', 'guardian_identity_review', 'enrollment_unknown', 'enrollment_fence_changed','enrollment_tenant_mismatch']
  const code = allowed.includes(reason) || /^identity_[a-z_]{1,48}$/.test(reason) ? reason : 'enrollment_unknown'
  return automationTransaction(client, async () => {
    const app = await lockApplication(client, job.applicationId)
    if (!app) return
    const updated = await client.query(`UPDATE daechion_automation.registrations SET state='REVIEW',lease_token=NULL,lease_until=NULL
      WHERE application_id=$1 AND lecture_id=$2 AND state='RUNNING' AND lease_token=$3 RETURNING application_id`, [job.applicationId, job.lectureId, job.token])
    if (!updated.rows.length) return
    await client.query(`UPDATE daechion_automation.applications SET
      automation_state=CASE WHEN automation_state='ACTIVE' THEN 'HOLD' ELSE automation_state END,
      review_code=COALESCE(review_code,$2) WHERE id=$1`, [job.applicationId, code])
    await automationChanged(client, job.applicationId, 'enrollment_review', 'ENROLLMENT_WORKER')
  })
}

export async function finishEnrollment(client: LedgerClient, job: EnrollmentJob, studentId: number) {
  safeId(studentId)
  return automationTransaction(client, async () => {
    const app = await lockApplication(client, job.applicationId)
    if (!app || !await enrollmentFence(client, job, true)) return false
    const updated = await client.query(`UPDATE daechion_automation.registrations SET state='DONE',student_id=$4,completed_at=now(),
      lease_token=NULL,lease_until=NULL,version=version+1 WHERE application_id=$1 AND lecture_id=$2 AND state='RUNNING' AND lease_token=$3 RETURNING application_id`,
    [job.applicationId, job.lectureId, job.token, studentId])
    if (!updated.rows.length) return false
    const pending = (await client.query("SELECT lecture_id FROM daechion_automation.registrations WHERE application_id=$1 AND state<>'DONE'", [job.applicationId])).rows.length
    const ready = pending === 0 && app.notification_state === 'NOT_READY'
    if (ready) await client.query("UPDATE daechion_automation.applications SET notification_state='PENDING' WHERE id=$1", [job.applicationId])
    const version = await automationChanged(client, job.applicationId, 'enrollment_completed', 'ENROLLMENT_WORKER')
    if (ready) await client.query("INSERT INTO daechion_automation.outbox(id,application_id,kind,event_version) VALUES($1,$2,'READY_MESSAGE',$3)", [randomUUID(), job.applicationId, version])
    return true
  })
}

export async function enrollApplication(applicationId: string, enabled: boolean, ports: {
  tenantId?:string
  daechion: EnrollmentPort; withClient<T>(run: (client: LedgerClient) => Promise<T>): Promise<T>
}) {
  if (!enabled) return 'DISABLED'
  const job = await ports.withClient(client => claimEnrollment(client, applicationId))
  if (!job) return 'SKIPPED'
  const fence = async (identityRequired = false) => {
    if (!await ports.withClient(client => enrollmentFence(client, job, identityRequired))) throw new DaechionError('enrollment_fence_changed')
  }
  let createStarted = false, identitySaved = false
  try {
    if(job.snapshot.daechionTenantId&&job.snapshot.daechionTenantId!==ports.tenantId)throw new DaechionError('enrollment_tenant_mismatch')
    await ports.withClient(client => claimIdentityPhones(client, applicationId, job.snapshot))
    const binding = await ports.withClient(client => identityBinding(client, applicationId))
    const guarded: StudentPort = {
      students: (phone, name) => ports.daechion.students(phone, name), student: id => ports.daechion.student(id),
      createStudent: async input => { await fence(); createStarted = true; return ports.daechion.createStudent(input) },
    }
    const resolved = await resolveStudent(guarded, { name: job.snapshot.studentName, studentPhone: job.snapshot.studentPhone,
      ...(job.snapshot.guardianPhone ? { guardianPhone: job.snapshot.guardianPhone } : {}) }, {
      history: job.snapshot.studentHistory, knownCreatedId: binding?.origin === 'CREATED' ? binding.id : undefined,
      manualApprovedId:binding?.manualReviewed?binding.id:undefined,
    })
    await ports.withClient(client => saveIdentity(client, applicationId, {status:'PASSED', detected:resolved.detected, studentId:resolved.student.id, created:resolved.created}))
    identitySaved = true
    await ports.withClient(client => releaseIdentityPhones(client, applicationId))
    await fence(true)
    const result = await ports.daechion.enroll(job.lectureId, resolved.student.id)
    if (result.lectureId !== job.lectureId || result.studentId !== resolved.student.id ||
      (!result.enrolledWeeklyLectureIds.length && !result.alreadyEnrolledWeeklyLectureIds.length)) throw new DaechionError('enrollment_result_mismatch')
    if (await ports.withClient(client => finishEnrollment(client, job, resolved.student.id))) return 'DONE'
    await ports.withClient(client => reviewEnrollment(client, job, 'enrollment_fence_changed'))
    return 'REVIEW'
  } catch (error) {
    if (error instanceof IdentityReview) {
      await ports.withClient(client => saveIdentity(client, applicationId, {status:'REVIEW',detected:error.detected,reason:error.code}))
    } else if (!identitySaved) {
      await ports.withClient(client => saveIdentity(client, applicationId, {status:'REVIEW',detected:'UNKNOWN',reason:createStarted?'identity_create_unknown':'identity_lookup_failed'}))
    }
    if (!createStarted || identitySaved) await ports.withClient(client => releaseIdentityPhones(client, applicationId))
    // No blind retry after an unknown create/enroll. Claim expiry is also review,
    // so a lost DB acknowledgement cannot replay an external write.
    await ports.withClient(client => reviewEnrollment(client, job, error instanceof DaechionError ? error.code : 'enrollment_unknown'))
    return 'REVIEW'
  }
}
