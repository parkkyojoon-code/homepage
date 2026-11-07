const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { createHash } = require('node:crypto')

function loadMigration(name = '001_initial.sql') {
  const sql = readFileSync(join(__dirname, '../db/daechion', name), 'utf8').replace(/\r\n/g, '\n')
  if (!/^BEGIN;\s/.test(sql) || !/COMMIT;\s*$/.test(sql)) throw Error('INVALID_MIGRATION_WRAPPER')
  return { name, checksum: createHash('sha256').update(sql).digest('hex'),
    body: sql.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '') }
}
const loadMigrations = () => ['001_initial.sql','002_identity.sql','003_admin_messages.sql','004_content_access.sql','005_browser_sessions.sql','006_operations.sql'].map(loadMigration)
async function status(client, migrations = loadMigrations()) {
  if (!Array.isArray(migrations)) migrations = [migrations]
  const { rows } = await client.query("SELECT to_regclass('daechion_automation.schema_migrations') AS tracked, to_regnamespace('daechion_automation') AS namespace")
  if (!rows[0].tracked) {
    if (rows[0].namespace) throw Error('UNTRACKED_AUTOMATION_SCHEMA')
    return { tracked: false, pending: migrations.map(item => item.name) }
  }
  const history = await client.query('SELECT name,checksum FROM daechion_automation.schema_migrations ORDER BY name')
  if (!history.rows.length || history.rows.length > migrations.length || history.rows.some((row,index) => row.name !== migrations[index].name || row.checksum !== migrations[index].checksum)) {
    throw Error('AUTOMATION_MIGRATION_HISTORY_MISMATCH')
  }
  return { tracked: true, pending: migrations.slice(history.rows.length).map(item => item.name) }
}
async function checkSchema(client) {
  await client.query('SELECT scope,phase,application_id,state,code,occurrences,resolved_at FROM daechion_automation.operation_issues LIMIT 0')
  await client.query('SELECT request_key,submission,payment_state,automation_state,notification_state,version FROM daechion_automation.applications LIMIT 0')
  await client.query('SELECT bill_id,provider_account,revision,amount_won,due_at FROM daechion_automation.bills LIMIT 0')
  await client.query('SELECT lecture_id,student_id,state,lease_token,lease_until FROM daechion_automation.registrations LIMIT 0')
  await client.query('SELECT access_state,access_targets,access_checked_at FROM daechion_automation.registrations LIMIT 0')
  await client.query('SELECT tenant_id,seed_fingerprint,state_ciphertext,revision,updated_at FROM daechion_automation.browser_sessions LIMIT 0')
  await client.query('SELECT kind,event_version,state,available_at FROM daechion_automation.outbox LIMIT 0')
  await client.query('SELECT kind,actor,created_at FROM daechion_automation.events LIMIT 0')
  await client.query('SELECT status,detected_type,student_id,origin,reason_code,checked_at FROM daechion_automation.identity_checks LIMIT 0')
  await client.query('SELECT phone,application_id FROM daechion_automation.identity_phone_claims LIMIT 0')
  await client.query('SELECT manual_access_action FROM daechion_automation.applications LIMIT 0')
  await client.query('SELECT manual_review_id FROM daechion_automation.identity_checks LIMIT 0')
  await client.query('SELECT fingerprint,operator_name,reason,evidence FROM daechion_automation.admin_actions LIMIT 0')
  await client.query('SELECT phone,state,provider_message_id,accepted_at FROM daechion_automation.ready_receipts LIMIT 0')
}
async function migrate(client, migrations = loadMigrations()) {
  if (!Array.isArray(migrations)) migrations = [migrations]
  await client.query('BEGIN')
  try {
    await client.query('SELECT pg_advisory_xact_lock(61106, 1501)')
    const before = await status(client, migrations)
    let tracked = before.tracked
    for (const migration of migrations.filter(item => before.pending.includes(item.name))) {
      await client.query(migration.body)
      if (!tracked) {
        await client.query('CREATE TABLE daechion_automation.schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())')
        tracked = true
      }
      await client.query('INSERT INTO daechion_automation.schema_migrations(name,checksum) VALUES($1,$2)', [migration.name,migration.checksum])
    }
    await checkSchema(client)
    await client.query('COMMIT')
    return before.pending
  } catch (error) { await client.query('ROLLBACK'); throw error }
}
module.exports = { loadMigration, loadMigrations, status, checkSchema, migrate }
