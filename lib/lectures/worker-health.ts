import type { QueryClient } from './admin-domain'

// Validate the queue schema without claiming jobs, changing leases, or reading customer rows.
export async function checkWorkerDatabase(client: QueryClient) {
  await client.query(`SELECT o.id,o.version,o.access_control,r.bill_id,r.lease_hash,
    r.lease_refresh_sequence,r.refresh_sequence,f.completed_at,e.fingerprint,e.result
    FROM lecture_orders o
    LEFT JOIN lecture_billing_requests r ON r.order_id=o.id
    LEFT JOIN lecture_billing_refreshes f ON f.order_id=o.id
    LEFT JOIN lecture_billing_events e ON e.order_id=o.id LIMIT 0`)
}
