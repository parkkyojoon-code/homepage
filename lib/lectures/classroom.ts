import { database } from './db'
import { hasLectureAccess, playableVideo, type AccessEvidence } from './access-policy'
import { HttpError } from './http'
import type { PoolClient } from 'pg'

// Check the purchase source as well as the grant; sale closure never removes an existing purchase.
export async function classroom(userId: string, client: Pick<PoolClient,'query'> = database()) {
  const { rows } = await client.query(`SELECT l.id,l.title,l.description,l.video_url FROM lectures l
    WHERE EXISTS (SELECT 1 FROM lecture_entitlements e
      JOIN lecture_order_items i ON i.id=e.order_item_id AND i.lecture_id=e.lecture_id
      JOIN lecture_orders o ON o.id=i.order_id AND o.user_id=e.user_id
      WHERE e.lecture_id=l.id AND e.user_id=$1 AND e.revoked_at IS NULL AND o.status='PAID' AND o.access_control<>'MANUAL_CLOSED')
    ORDER BY l.created_at DESC,l.id`, [userId])
  return rows.map(row => ({ id: row.id, title: row.title, description: row.description, video_ready: Boolean(playableVideo(row.video_url)) }))
}
export async function lectureDestination(userId: string, lectureId: string, client: Pick<PoolClient,'query'> = database()) {
  const { rows } = await client.query<AccessEvidence & { video_url: string | null }>(`SELECT e.user_id,e.lecture_id,e.revoked_at,
    o.user_id AS order_user_id,o.status AS order_status,o.access_control,i.lecture_id AS item_lecture_id,l.video_url
    FROM lecture_entitlements e JOIN lecture_order_items i ON i.id=e.order_item_id
    JOIN lecture_orders o ON o.id=i.order_id JOIN lectures l ON l.id=e.lecture_id
    WHERE e.user_id=$1 AND e.lecture_id=$2`, [userId, lectureId])
  if (!hasLectureAccess(userId, lectureId, rows)) throw new HttpError(404, '이용 가능한 강의를 찾을 수 없습니다.')
  const destination = playableVideo(rows[0]?.video_url ?? null)
  if (!destination) throw new HttpError(409, '강의 영상을 준비 중입니다. 잠시 후 다시 확인해주세요.')
  return destination
}
