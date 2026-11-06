import { Pool } from 'pg'
import type { LedgerClient } from './ledger'

let pool: Pool | undefined

// No connection or environment lookup occurs at import/build time. The retired
// LECTURES_DATABASE_URL and generic DATABASE_URL are intentionally not fallbacks.
function automationPool() {
  if (!process.env.DAECHION_DATABASE_URL) throw new Error('DAECHION_DATABASE_NOT_CONFIGURED')
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DAECHION_DATABASE_URL, max: 5,
      connectionTimeoutMillis: 10000, statement_timeout: 30000, idle_in_transaction_session_timeout: 30000,
      options: '-c search_path=public -c timezone=UTC' })
    pool.on('error', () => console.error('Daechion database idle connection failed'))
  }
  return pool
}

export async function withAutomationClient<T>(run: (client: LedgerClient) => Promise<T>): Promise<T> {
  const client = await automationPool().connect()
  // createApplication owns BEGIN/COMMIT/ROLLBACK. Do not wrap it in another transaction.
  try { return await run(client) }
  finally { client.release() }
}
