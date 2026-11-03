BEGIN;
CREATE TABLE lecture_admin_users (
 id uuid PRIMARY KEY, username text NOT NULL UNIQUE, name text NOT NULL,
 role text NOT NULL CHECK(role IN ('OWNER','OPERATOR')), password_hash text NOT NULL,
 disabled_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE lecture_admin_sessions (
 token_hash text PRIMARY KEY, admin_id uuid NOT NULL REFERENCES lecture_admin_users(id),
 expires_at timestamptz NOT NULL
);
CREATE INDEX lecture_admin_sessions_expiry ON lecture_admin_sessions(expires_at);
CREATE TABLE lecture_admin_auth_attempts (
 username text PRIMARY KEY, started_at timestamptz NOT NULL, attempts integer NOT NULL
);
ALTER TABLE lecture_orders ADD COLUMN access_control text NOT NULL DEFAULT 'AUTO'
 CHECK(access_control IN ('AUTO','MANUAL_OPEN','MANUAL_CLOSED'));
ALTER TABLE lecture_orders ADD COLUMN version integer NOT NULL DEFAULT 0 CHECK(version>=0);
-- Preserve prototype corrections when this migration is applied to a populated development DB.
UPDATE lecture_orders SET access_control='MANUAL_CLOSED'
 WHERE id IN (SELECT order_id FROM lecture_manual_revocations);
UPDATE lecture_orders SET access_control='MANUAL_OPEN'
 WHERE status='PAID' AND id IN (SELECT order_id FROM lecture_manual_confirmations);
CREATE TABLE lecture_admin_actions (
 id uuid PRIMARY KEY, admin_id uuid NOT NULL REFERENCES lecture_admin_users(id),
 actor_name text NOT NULL, order_id uuid NOT NULL REFERENCES lecture_orders(id),
 action text NOT NULL CHECK(action IN ('OPEN','CLOSE','RESTORE','RESUME_AUTO','CLOSE_UNPAID')),
 reason text NOT NULL, checked_at timestamptz NOT NULL,
 request_key uuid NOT NULL, request_hash text NOT NULL,
 before_state jsonb NOT NULL, after_state jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(admin_id,request_key)
);
CREATE INDEX lecture_admin_actions_order ON lecture_admin_actions(order_id,created_at,id);
COMMIT;
