BEGIN;
ALTER TABLE lecture_users ADD COLUMN credential_version integer NOT NULL DEFAULT 0 CHECK(credential_version>=0);
ALTER TABLE lecture_users ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE lecture_users ADD COLUMN password_expires_at timestamptz;
ALTER TABLE lecture_users ADD CONSTRAINT lecture_users_password_expiry
 CHECK((must_change_password AND password_expires_at IS NOT NULL) OR (NOT must_change_password AND password_expires_at IS NULL));
ALTER TABLE lecture_sessions ADD COLUMN credential_version integer NOT NULL DEFAULT 0 CHECK(credential_version>=0);
CREATE TABLE lecture_account_recoveries (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES lecture_users(id),
 admin_id uuid NOT NULL REFERENCES lecture_admin_users(id), actor_name text NOT NULL,
 credential_version integer NOT NULL, reason text NOT NULL,
 request_key uuid NOT NULL, request_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 completed_at timestamptz, UNIQUE(admin_id,request_key), UNIQUE(user_id,credential_version)
);
CREATE INDEX lecture_account_recoveries_user ON lecture_account_recoveries(user_id,created_at DESC);
COMMIT;
