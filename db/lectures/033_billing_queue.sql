BEGIN;
ALTER TABLE lecture_orders ADD COLUMN request_hash text;
ALTER TABLE lecture_orders ADD COLUMN recipient_type text CHECK(recipient_type IN ('SELF','GUARDIAN'));
ALTER TABLE lecture_orders ADD COLUMN recipient_name text;
ALTER TABLE lecture_orders ADD COLUMN recipient_phone text;
ALTER TABLE lecture_orders ADD CONSTRAINT lecture_order_recipient_snapshot CHECK(
 (request_hash IS NULL AND recipient_type IS NULL AND recipient_name IS NULL AND recipient_phone IS NULL)
 OR (request_hash IS NOT NULL AND request_hash ~ '^[a-f0-9]{64}$' AND recipient_type IS NOT NULL
 AND recipient_name IS NOT NULL AND length(trim(recipient_name)) BETWEEN 1 AND 50
 AND recipient_phone IS NOT NULL AND recipient_phone ~ '^010[0-9]{8}$'));
ALTER TABLE lecture_orders ADD CONSTRAINT lecture_order_bill_amount UNIQUE(id,total_won);
CREATE TABLE lecture_billing_requests (
 order_id uuid PRIMARY KEY, bill_id text NOT NULL UNIQUE CHECK(bill_id ~ '^L[0-9a-f]{19}$'),
 amount_won integer NOT NULL CHECK(amount_won>0),
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','SENDING','SENT','UNKNOWN','STOPPED')),
 sent_at timestamptz, due_at timestamptz,
 last_state text CHECK(last_state IN ('F','W','C','D','ERROR')),
 last_amount_won integer, checked_at timestamptz,
 needs_review boolean NOT NULL DEFAULT false, review_reason text,
 next_check_at timestamptz NOT NULL DEFAULT now(),
 lease_hash text, lease_kind text CHECK(lease_kind IN ('SEND','READ')),
 lease_until timestamptz, lease_version integer,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(order_id,amount_won) REFERENCES lecture_orders(id,total_won),
 CHECK((sent_at IS NULL AND due_at IS NULL) OR (sent_at IS NOT NULL AND due_at IS NOT NULL AND due_at=sent_at+interval '168 hours')),
 CHECK((lease_hash IS NULL AND lease_kind IS NULL AND lease_until IS NULL AND lease_version IS NULL)
 OR (lease_hash IS NOT NULL AND lease_kind IS NOT NULL AND lease_until IS NOT NULL AND lease_version IS NOT NULL))
);
CREATE INDEX lecture_billing_due ON lecture_billing_requests(next_check_at) WHERE state IN ('SENT','UNKNOWN','SENDING');
CREATE TABLE lecture_billing_events (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES lecture_billing_requests(order_id),
 claim_hash text NOT NULL, kind text NOT NULL CHECK(kind IN ('SEND','READ')),
 fingerprint text NOT NULL, result jsonb NOT NULL, applied boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(order_id,claim_hash)
);
COMMIT;
