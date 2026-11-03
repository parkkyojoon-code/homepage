import { z } from 'zod'
import { FRESH_PAID_READ_SQL, CAN_REFRESH_BILL_SQL } from './billing-proof'

export const adminOrderQuery = z.object({
  status: z.enum(['pending','paid','corrected','all']).default('pending'),
  q: z.string().trim().max(100, '검색어는 100자 이내로 입력해주세요.').default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1),
})
export const ADMIN_ORDER_PAGE_SIZE = 20
export function parseAdminOrderQuery(params: URLSearchParams) {
  return adminOrderQuery.parse({ status: params.get('status') ?? undefined, q: params.get('q') ?? undefined, page: params.get('page') ?? undefined })
}

export const ADMIN_ORDERS_SQL = `WITH filtered AS (
      SELECT o.id,o.status,o.total_won,o.created_at,o.access_control,o.version,o.recipient_name,o.recipient_phone,u.name,u.username,u.phone,
      b.bill_id,b.state AS billing_state,b.sent_at,b.due_at,b.last_state,b.last_amount_won,b.checked_at,b.needs_review,b.review_reason,
      ${CAN_REFRESH_BILL_SQL} AS can_refresh_billing,
      EXISTS(SELECT 1 FROM lecture_billing_refreshes f WHERE f.order_id=o.id AND f.completed_at IS NULL) AS refresh_pending,
      (o.status='PAID' AND o.access_control<>'AUTO' AND ${FRESH_PAID_READ_SQL}) AS can_resume_auto,
      c.operator_name,c.confirmed_at,r.operator_name AS correction_operator,r.note AS correction_note,r.revoked_at,
      (SELECT json_agg(json_build_object('title',i.title_snapshot,'price_won',i.price_won) ORDER BY i.id) FROM lecture_order_items i WHERE i.order_id=o.id) AS items
      FROM lecture_orders o JOIN lecture_users u ON u.id=o.user_id
      LEFT JOIN lecture_billing_requests b ON b.order_id=o.id
      LEFT JOIN lecture_billing_events e ON e.id=b.checked_event_id AND e.order_id=b.order_id
      LEFT JOIN lecture_manual_confirmations c ON c.order_id=o.id
      LEFT JOIN lecture_manual_revocations r ON r.order_id=o.id
      WHERE o.status=ANY($1::text[]) AND (NOT $6::boolean OR r.order_id IS NOT NULL) AND ($2='' OR
        strpos(lower(o.id::text),lower($2))>0 OR strpos(lower(COALESCE(b.bill_id,'')),lower($2))>0 OR strpos(lower(u.name),lower($2))>0 OR
        strpos(lower(u.username),lower($2))>0 OR strpos(u.phone,$2)>0 OR
        ($3<>'' AND strpos(regexp_replace(u.phone,'[^0-9]','','g'),$3)>0))
      ), paged AS (SELECT * FROM filtered ORDER BY created_at DESC,id LIMIT $4 OFFSET $5)
      SELECT (SELECT count(*)::integer FROM filtered) AS total,
      COALESCE((SELECT json_agg(paged ORDER BY created_at DESC,id) FROM paged),'[]'::json) AS orders`
