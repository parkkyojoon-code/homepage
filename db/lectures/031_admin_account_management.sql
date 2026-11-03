BEGIN;
ALTER TABLE lecture_admin_users ADD COLUMN version integer NOT NULL DEFAULT 0 CHECK(version>=0);
CREATE TABLE lecture_admin_tokens (
 token_hash text PRIMARY KEY, admin_id uuid NOT NULL REFERENCES lecture_admin_users(id),
 purpose text NOT NULL CHECK(purpose IN ('INVITE','RESET')),
 issued_by uuid NOT NULL REFERENCES lecture_admin_users(id),
 expires_at timestamptz NOT NULL, used_at timestamptz
);
CREATE TABLE lecture_admin_account_events (
 id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES lecture_admin_users(id),
 target_id uuid NOT NULL REFERENCES lecture_admin_users(id),
 action text NOT NULL CHECK(action IN ('CREATE','UPDATE','RESET','ACTIVATE')),
 detail jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
