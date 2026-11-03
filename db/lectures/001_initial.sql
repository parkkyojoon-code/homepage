BEGIN;
CREATE TABLE lecture_users (
 id uuid PRIMARY KEY, username text NOT NULL UNIQUE, name text NOT NULL,
 phone text NOT NULL, password_hash text NOT NULL, disabled_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE lecture_sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES lecture_users(id), expires_at timestamptz NOT NULL
);
CREATE INDEX lecture_sessions_expiry ON lecture_sessions(expires_at);
CREATE TABLE lecture_auth_attempts (username text PRIMARY KEY, started_at timestamptz NOT NULL, attempts integer NOT NULL);
CREATE TABLE lectures (
 id uuid PRIMARY KEY, title text NOT NULL, description text NOT NULL DEFAULT '',
 price_won integer NOT NULL CHECK(price_won>0),
 sale_status text NOT NULL DEFAULT 'DRAFT' CHECK(sale_status IN ('DRAFT','ON_SALE','CLOSED')),
 video_url text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE lecture_orders (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES lecture_users(id), request_key uuid NOT NULL,
 status text NOT NULL DEFAULT 'CREATED' CHECK(status IN ('CREATED','AWAITING_PAYMENT','PAID','CANCELLED','EXPIRED','REFUNDED')),
 total_won integer NOT NULL CHECK(total_won>0), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,request_key)
);
CREATE INDEX lecture_orders_user ON lecture_orders(user_id,created_at DESC);
CREATE TABLE lecture_order_items (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES lecture_orders(id), lecture_id uuid NOT NULL REFERENCES lectures(id),
 title_snapshot text NOT NULL, price_won integer NOT NULL CHECK(price_won>0), UNIQUE(order_id,lecture_id)
);
CREATE TABLE lecture_entitlements (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES lecture_users(id), lecture_id uuid NOT NULL REFERENCES lectures(id),
 order_item_id uuid NOT NULL UNIQUE REFERENCES lecture_order_items(id), granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
);
CREATE INDEX lecture_entitlements_user ON lecture_entitlements(user_id,lecture_id) WHERE revoked_at IS NULL;
COMMIT;
