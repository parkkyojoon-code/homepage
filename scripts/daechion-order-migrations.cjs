const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { createHash } = require('node:crypto')

const names = Object.freeze(['001_initial.sql', '002_workers.sql', '003_delivery.sql', '004_admin.sql', '005_manual_review.sql'])
function loadMigrations() {
  return names.map(name => {
    const sql = readFileSync(join(__dirname, '../db/daechion-orders', name), 'utf8').replace(/\r\n/g, '\n')
    if (!/^BEGIN;\s/.test(sql) || !/COMMIT;\s*$/.test(sql)) throw Error('ORDER_INVALID_MIGRATION_WRAPPER')
    return { name, checksum: createHash('sha256').update(sql).digest('hex'),
      body: sql.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '') }
  })
}
async function status(client, migrations = loadMigrations()) {
  const { rows } = await client.query("SELECT to_regclass('daechion_orders.schema_migrations') AS tracked, to_regnamespace('daechion_orders') AS namespace")
  if (!rows[0].tracked) {
    if (rows[0].namespace) throw Error('ORDER_UNTRACKED_SCHEMA')
    return { tracked: false, pending: migrations.map(item => item.name) }
  }
  const history = await client.query('SELECT name,checksum FROM daechion_orders.schema_migrations ORDER BY name')
  if (!history.rows.length || history.rows.length > migrations.length || history.rows.some((row, index) =>
    row.name !== migrations[index].name || row.checksum !== migrations[index].checksum)) {
    throw Error('ORDER_MIGRATION_HISTORY_MISMATCH')
  }
  return { tracked: true, pending: migrations.slice(history.rows.length).map(item => item.name) }
}
async function checkSchema(client) {
  // Column checks deliberately include worker and delivery additions, not just checkout tables.
  for (const sql of [
    'SELECT token_hash,cart_fingerprint,subject_key,snapshot,expires_at FROM daechion_orders.quotes LIMIT 0',
    'SELECT contact_snapshot,total_won,checkout_state,payment_state,identity_state,student_id,version,review_code,paid_at,identity_token,identity_until,identity_write_started FROM daechion_orders.orders LIMIT 0',
    'SELECT product_id,sale_kind,price_won,snapshot FROM daechion_orders.items LIMIT 0',
    'SELECT lecture_id,state,lease_token,lease_until,review_code,enrollment_recorded,weekly_ids FROM daechion_orders.grants LIMIT 0',
    'SELECT provider_account,bill_id,revision,is_current,amount_won,due_at,checked_at FROM daechion_orders.bills LIMIT 0',
    'SELECT phone,order_id FROM daechion_orders.phone_claims LIMIT 0',
    'SELECT kind,event_version,state,available_at,last_error FROM daechion_orders.jobs LIMIT 0',
    'SELECT kind,created_at FROM daechion_orders.events LIMIT 0',
    'SELECT phone,text_snapshot,state,provider_message_id,accepted_at FROM daechion_orders.ready_receipts LIMIT 0',
    'SELECT request_key,fingerprint,action,lecture_id,operator_name,reason,before_version,after_version,student_id,profile_fingerprint,context_fingerprint,order_request_fingerprint,target_ids,checked_at FROM daechion_orders.admin_actions LIMIT 0',
  ]) await client.query(sql)
  const guards = [
    ['orders', 'guard_order', 'guard_order'], ['orders', 'guard_worker_order', 'guard_worker_order'],
    ['items', 'guard_items', 'guard_components'], ['grants', 'guard_grant_targets', 'guard_components'],
    ['grants', 'guard_grant_state', 'guard_grant_state'], ['grants', 'guard_worker_grant', 'guard_worker_grant'],
    ['bills', 'guard_bill', 'guard_bill'], ['quotes', 'guard_quote', 'guard_quote'],
    ['jobs', 'guard_ready_job', 'guard_ready_job'], ['ready_receipts', 'guard_ready_receipt', 'guard_ready_receipt'],
    ['admin_actions', 'guard_admin_action', 'guard_admin_action'],
    ['admin_actions', 'guard_admin_commit', 'guard_admin_commit'],
  ]
  const triggers = await client.query(`SELECT c.relname AS table_name,t.tgname AS name,t.tgenabled AS enabled,
    p.proname AS function_name,pn.nspname AS function_schema FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace
    WHERE n.nspname='daechion_orders' AND NOT t.tgisinternal`)
  if (guards.some(([table, name, fn]) => !triggers.rows.some(row => row.table_name === table && row.name === name &&
    ['O', 'A'].includes(row.enabled) && row.function_name === fn && row.function_schema === 'daechion_orders'))) {
    throw Error('ORDER_SCHEMA_GUARDS_NOT_READY')
  }
}
async function checkReady(client) {
  const result = await status(client)
  if (result.pending.length) throw Error('ORDER_SCHEMA_NOT_READY')
  await checkSchema(client)
  return result
}
async function migrate(client, migrations = loadMigrations()) {
  await client.query('BEGIN')
  try {
    // Separate namespace and lock from the live single-application migration runner.
    await client.query('SELECT pg_advisory_xact_lock(61106, 1502)')
    const before = await status(client, migrations)
    let tracked = before.tracked
    for (const migration of migrations.filter(item => before.pending.includes(item.name))) {
      await client.query(migration.body)
      if (!tracked) {
        await client.query('CREATE TABLE daechion_orders.schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())')
        tracked = true
      }
      await client.query('INSERT INTO daechion_orders.schema_migrations(name,checksum) VALUES($1,$2)', [migration.name, migration.checksum])
    }
    await checkSchema(client)
    await client.query('COMMIT')
    return before.pending
  } catch (error) { await client.query('ROLLBACK'); throw error }
}
module.exports = { loadMigrations, status, checkSchema, checkReady, migrate }
