import { Pool, type PoolClient } from 'pg'

let pool: Pool | undefined
export function database() {
  if (!process.env.LECTURES_DATABASE_URL) throw new Error('LECTURES_DATABASE_URL is required')
  if (!pool) {
    pool = new Pool({ connectionString: process.env.LECTURES_DATABASE_URL, max: 5,
      connectionTimeoutMillis: 10000, statement_timeout: 30000, idle_in_transaction_session_timeout: 30000,
      options: '-c search_path=public -c timezone=UTC' })
    // An idle connection failure must not crash the existing homepage process.
    pool.on('error', () => console.error('Lecture database idle connection failed'))
  }
  return pool
}
export async function transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database().connect()
  try {
    await client.query('BEGIN')
    const result = await run(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}
