import { randomUUID } from 'node:crypto'
import type { LedgerClient } from './ledger'

export async function automationTransaction<T>(client: LedgerClient, run: () => Promise<T>): Promise<T> {
  await client.query('BEGIN')
  try { const result = await run(); await client.query('COMMIT'); return result }
  catch (error) { await client.query('ROLLBACK'); throw error }
}
export async function automationChanged(client: LedgerClient, applicationId: string, kind: string,
  actor: 'BILLING_WORKER' | 'ENROLLMENT_WORKER' | 'ADMIN') {
  const changed = await client.query<{ version: string }>(`UPDATE daechion_automation.applications
    SET version=version+1,updated_at=now() WHERE id=$1 RETURNING version::text`, [applicationId])
  const version = changed.rows[0].version
  await client.query("INSERT INTO daechion_automation.outbox(id,application_id,kind,event_version) VALUES($1,$2,'SHEETS',$3)",
    [randomUUID(), applicationId, version])
  await client.query('INSERT INTO daechion_automation.events(application_id,kind,actor) VALUES($1,$2,$3)', [applicationId, kind, actor])
  return version
}
