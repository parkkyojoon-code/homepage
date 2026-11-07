BEGIN;

-- Only authenticated ciphertext is stored. The key remains in the worker's
-- existing private API-key configuration, not in this database or the web app.
CREATE TABLE daechion_automation.browser_sessions (
  tenant_id text PRIMARY KEY CHECK (length(tenant_id) BETWEEN 1 AND 120),
  seed_fingerprint text NOT NULL CHECK (seed_fingerprint ~ '^[a-f0-9]{64}$'),
  state_ciphertext text NOT NULL CHECK (length(state_ciphertext) BETWEEN 32 AND 400000),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
