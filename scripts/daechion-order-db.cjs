const { Pool } = require('pg')
const { loadEnvConfig } = require('@next/env')
const migrations = require('./daechion-order-migrations.cjs')

function parseCommand(args) {
  const [command = 'status', ...rest] = args
  if (!['status', 'check', 'migrate'].includes(command) ||
    (command !== 'migrate' && rest.length) ||
    (command === 'migrate' && (rest.length !== 2 || rest[0] !== '--database' || !rest[1]))) throw Error('ORDER_INVALID_DB_COMMAND')
  return { command, database: rest[1] }
}
async function run(client, args) {
  const { command, database } = parseCommand(args)
  if (command === 'migrate') {
    const result = await client.query('SELECT current_database() AS name')
    if (result.rows[0].name !== database) throw Error('ORDER_DATABASE_NAME_MISMATCH')
    return { schema: 'daechion_orders', appliedNow: await migrations.migrate(client) }
  }
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  try {
    const result = command === 'check' ? await migrations.checkReady(client) : await migrations.status(client)
    await client.query('COMMIT')
    return { reachable: true, schema: 'daechion_orders', ...result, ...(command === 'check' ? { schemaChecked: true } : {}) }
  } catch (error) { await client.query('ROLLBACK'); throw error }
}
async function main() {
  parseCommand(process.argv.slice(2))
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production', { info() {}, error() {} })
  const url = process.env.DAECHION_DATABASE_URL
  let parsed
  try { parsed = new URL(url) } catch { throw Error('ORDER_INVALID_DATABASE_URL') }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw Error('ORDER_INVALID_DATABASE_URL')
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10000, statement_timeout: 30000 })
  pool.on('error', () => {})
  let client
  try {
    client = await pool.connect()
    await client.query("SET TIME ZONE 'UTC'")
    console.log(JSON.stringify(await run(client, process.argv.slice(2))))
  } finally { client?.release(); await pool.end() }
}
if (require.main === module) main().catch(error => {
  // Database/connection errors can contain credentials or submitted data.
  console.error(/^ORDER_[A-Z_]{1,64}$/.test(error.message) ? error.message : 'ORDER_DATABASE_OPERATION_FAILED')
  process.exitCode = 1
})
module.exports = { parseCommand, run }
