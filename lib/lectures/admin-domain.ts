import type { PoolClient } from 'pg'
import { HttpError } from './http'

export type AdminActor = { id: string; sessionHash: string }
export type AdminIdentity = { id: string; username: string; name: string; role: 'OWNER' | 'OPERATOR' }
export type QueryClient = Pick<PoolClient, 'query'>

// Mutations call this inside their transaction. The account lock serializes with disabling/role changes.
export async function lockAdmin(client: QueryClient, actor: AdminActor): Promise<AdminIdentity> {
  const { rows } = await client.query<AdminIdentity>(`SELECT a.id,a.username,a.name,a.role
    FROM lecture_admin_users a JOIN lecture_admin_sessions s ON s.admin_id=a.id
    WHERE a.id=$1 AND s.token_hash=$2 AND s.expires_at>now() AND a.disabled_at IS NULL
    FOR SHARE OF a,s`, [actor.id,actor.sessionHash])
  if (!rows[0]) throw new HttpError(401, '관리자 로그인이 필요합니다.')
  return rows[0]
}
