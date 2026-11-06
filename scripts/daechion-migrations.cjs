const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { createHash } = require('node:crypto')

function loadMigration() {
  const name = '001_initial.sql'
  const sql = readFileSync(join(__dirname, '../db/daechion', name), 'utf8').replace(/\r\n/g, '\n')
  if (!/^BEGIN;\s/.test(sql) || !/COMMIT;\s*$/.test(sql)) throw Error('INVALID_MIGRATION_WRAPPER')
  return { name, checksum: createHash('sha256').update(sql).digest('hex'),
    body: sql.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '') }
}
async function status(client, migration = loadMigration()) {
  const { rows } = await client.query("SELECT to_regclass('daechion_automation.schema_migrations') AS tracked, to_regnamespace('daechion_automation') AS namespace")
  if (!rows[0].tracked) {
    if (rows[0].namespace) throw Error('UNTRACKED_AUTOMATION_SCHEMA')
    return { tracked: false, pending: [migration.name] }
  }
  const history = await client.query('SELECT name,checksum FROM daechion_automation.schema_migrations ORDER BY name')
  if (history.rows.length !== 1 || history.rows[0].name !== migration.name || history.rows[0].checksum !== migration.checksum) {
    throw Error('AUTOMATION_MIGRATION_HISTORY_MISMATCH')
  }
  return { tracked: true, pending: [] }
}
async function checkSchema(client) {
  await client.query('SELECT request_key,submission,payment_state,automation_state,notification_state,version FROM daechion_automation.applications LIMIT 0')
  await client.query('SELECT bill_id,provider_account,revision,amount_won,due_at FROM daechion_automation.bills LIMIT 0')
  await client.query('SELECT lecture_id,student_id,state,lease_token,lease_until FROM daechion_automation.registrations LIMIT 0')
  await client.query('SELECT kind,event_version,state,available_at FROM daechion_automation.outbox LIMIT 0')
  await client.query('SELECT kind,actor,created_at FROM daechion_automation.events LIMIT 0')
}
async function migrate(client, migration = loadMigration()) {
  await client.query('BEGIN')
  try {
    await client.query('SELECT pg_advisory_xact_lock(61106, 1501)')
    const before = await status(client, migration)
    if (before.pending.length) {
      await client.query(migration.body)
      await client.query('CREATE TABLE daechion_automation.schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())')
      await client.query('INSERT INTO daechion_automation.schema_migrations(name,checksum) VALUES($1,$2)', [migration.name,migration.checksum])
    }
    await checkSchema(client)
    await client.query('COMMIT')
    return before.pending
  } catch (error) { await client.query('ROLLBACK'); throw error }
}
module.exports = { loadMigration, status, checkSchema, migrate }
