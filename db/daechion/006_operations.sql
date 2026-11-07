BEGIN;

-- Fixed codes only: never persist provider errors, credentials or phone numbers.
CREATE TABLE daechion_automation.operation_issues (
  scope text NOT NULL,
  phase text NOT NULL CHECK (phase IN ('sessionRefresh','billing','paymentRead','enrollment','readyMessage','sheets','diagnostics')),
  application_id uuid REFERENCES daechion_automation.applications(id),
  state text NOT NULL CHECK (state IN ('OPEN','RESOLVED')),
  code text NOT NULL CHECK (code IN ('FAILED','UNKNOWN','DEFERRED','API_PREFLIGHT','BROWSER_LAUNCH','BROWSER_CONTEXT','SESSION_REFRESH')),
  occurrences bigint NOT NULL DEFAULT 1 CHECK (occurrences > 0),
  first_failed_at timestamptz NOT NULL DEFAULT now(),
  last_failed_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  PRIMARY KEY (scope,phase),
  CHECK (scope=COALESCE(application_id::text,'WORKER')),
  CHECK ((state='RESOLVED')=(resolved_at IS NOT NULL))
);

COMMIT;
