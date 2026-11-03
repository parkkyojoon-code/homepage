BEGIN;
ALTER TABLE lectures ADD COLUMN version integer NOT NULL DEFAULT 0 CHECK(version>=0);
CREATE TABLE lecture_catalog_changes (
 id uuid PRIMARY KEY, lecture_id uuid NOT NULL REFERENCES lectures(id),
 admin_id uuid NOT NULL REFERENCES lecture_admin_users(id), actor_name text NOT NULL,
 action text NOT NULL CHECK(action IN ('CREATE','UPDATE')), version integer NOT NULL CHECK(version>=0),
 before_state jsonb, after_state jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(lecture_id,version)
);
CREATE INDEX lecture_orders_buyer_paging ON lecture_orders(user_id,created_at DESC,id DESC);
COMMIT;
