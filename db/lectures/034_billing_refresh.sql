BEGIN;
ALTER TABLE lecture_billing_events ADD CONSTRAINT lecture_billing_event_order UNIQUE(id,order_id);
ALTER TABLE lecture_billing_requests ADD COLUMN checked_order_version integer;
ALTER TABLE lecture_billing_requests ADD COLUMN checked_event_id uuid;
ALTER TABLE lecture_billing_requests ADD COLUMN refresh_sequence integer NOT NULL DEFAULT 0 CHECK(refresh_sequence>=0);
ALTER TABLE lecture_billing_requests ADD COLUMN lease_refresh_sequence integer;
UPDATE lecture_billing_requests SET lease_refresh_sequence=0 WHERE lease_hash IS NOT NULL;
ALTER TABLE lecture_billing_requests ADD CONSTRAINT lecture_billing_refresh_lease CHECK(
 (lease_hash IS NULL AND lease_refresh_sequence IS NULL) OR (lease_hash IS NOT NULL AND lease_refresh_sequence IS NOT NULL));
ALTER TABLE lecture_billing_requests ADD CONSTRAINT lecture_billing_checked_source
 FOREIGN KEY(checked_event_id,order_id) REFERENCES lecture_billing_events(id,order_id);
CREATE TABLE lecture_billing_refreshes (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES lecture_billing_requests(order_id),
 admin_id uuid NOT NULL REFERENCES lecture_admin_users(id), actor_name text NOT NULL,
 sequence integer NOT NULL CHECK(sequence>0), request_key uuid NOT NULL, request_hash text NOT NULL,
 requested_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, result_event_id uuid,
 UNIQUE(admin_id,request_key), UNIQUE(order_id,sequence),
 FOREIGN KEY(result_event_id,order_id) REFERENCES lecture_billing_events(id,order_id),
 CHECK((completed_at IS NULL AND result_event_id IS NULL) OR (completed_at IS NOT NULL AND result_event_id IS NOT NULL))
);
CREATE INDEX lecture_billing_refresh_pending ON lecture_billing_refreshes(order_id,sequence) WHERE completed_at IS NULL;
COMMIT;
