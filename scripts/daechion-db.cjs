const { Pool } = require('pg')
const { loadEnvConfig } = require('@next/env')
const { status, migrate, checkSchema } = require('./daechion-migrations.cjs')

async function main() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production', { info() {}, error() {} })
  const [command, ...args] = process.argv.slice(2)
  if (!['status','check','migrate'].includes(command) ||
    (command !== 'migrate' && args.length) ||
    (command === 'migrate' && (args.length !== 2 || args[0] !== '--database' || !args[1]))) throw Error('INVALID_DB_COMMAND')
  const url = process.env.DAECHION_DATABASE_URL
  if (!url) throw Error('MISSING_AUTOMATION_DATABASE_URL')
  let parsed
  try { parsed = new URL(url) } catch { throw Error('INVALID_AUTOMATION_DATABASE_URL') }
  if (!['postgres:','postgresql:'].includes(parsed.protocol)) throw Error('INVALID_AUTOMATION_DATABASE_URL')
  const pool = new Pool({ connectionString:url,max:1,connectionTimeoutMillis:10000,statement_timeout:30000 })
  pool.on('error', () => {})
  let client
  try {
    client = await pool.connect()
    await client.query("SET TIME ZONE 'UTC'")
    if (command === 'migrate') {
      const result = await client.query('SELECT current_database() AS name')
      if (result.rows[0].name !== args[1]) throw Error('AUTOMATION_DATABASE_NAME_MISMATCH')
      const appliedNow = await migrate(client)
      console.log(JSON.stringify({ok:true,schema:'daechion_automation',appliedNow}))
    } else {
      const result = await status(client)
      if (command === 'check') {
        if (result.pending.length) throw Error('AUTOMATION_SCHEMA_NOT_READY')
        await checkSchema(client)
      }
      console.log(JSON.stringify({reachable:true,schema:'daechion_automation',...result,...(command==='check'?{schemaChecked:true}:{})}))
    }
  } finally { client?.release(); await pool.end() }
}
main().catch(error => {
  // Never print arbitrary provider/connection errors, URLs, or env values.
  const code = /^[A-Z_]{1,64}$/.test(error.message) ? error.message : 'AUTOMATION_DATABASE_OPERATION_FAILED'
  console.error(code); process.exitCode = 1
})
