BEGIN;

-- Isolated from the legacy homepage files/Sheets and the retired lecture tables.
CREATE SCHEMA daechion_automation;

CREATE TABLE daechion_automation.applications (
  id uuid PRIMARY KEY,
  request_key uuid NOT NULL UNIQUE,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  product_id text NOT NULL CHECK (product_id NOT IN ('12course', 'chuweol')),
  product_title text NOT NULL CHECK (length(product_title) > 0),
  tuition_won integer NOT NULL CHECK (tuition_won >= 0),
  textbook_won integer NOT NULL CHECK (textbook_won >= 0),
  total_won integer NOT NULL CHECK (total_won > 0 AND total_won = tuition_won + textbook_won),
  submission jsonb NOT NULL CHECK (jsonb_typeof(submission) = 'object'),
  payment_state text NOT NULL DEFAULT 'PENDING' CHECK (payment_state IN ('PENDING','PAID','CANCELLED','UNKNOWN')),
  automation_state text NOT NULL DEFAULT 'ACTIVE' CHECK (automation_state IN ('ACTIVE','HOLD','REVOKED','CLOSED')),
  notification_state text NOT NULL DEFAULT 'NOT_READY' CHECK (notification_state IN ('NOT_READY','PENDING','SENT','UNKNOWN','FAILED')),
  paid_at timestamptz,
  review_code text CHECK (review_code ~ '^[a-z_]{1,64}$'),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, total_won)
);

CREATE TABLE daechion_automation.bills (
  id uuid PRIMARY KEY,
  application_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  provider_account text NOT NULL CHECK (length(provider_account) > 0),
  bill_id text NOT NULL CHECK (bill_id ~ '^[0-9]{1,64}$'),
  amount_won integer NOT NULL,
  is_current boolean NOT NULL DEFAULT true,
  state text NOT NULL DEFAULT 'RESERVED' CHECK (state IN ('RESERVED','SEND_UNKNOWN','SENT','CANCELLED','DESTROYED')),
  last_payment_state text CHECK (last_payment_state IN ('PENDING','PAID','CANCELLED','UNKNOWN')),
  sent_at timestamptz,
  due_at timestamptz,
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (application_id, amount_won) REFERENCES daechion_automation.applications(id, total_won),
  UNIQUE (application_id, revision),
  UNIQUE (provider_account, bill_id),
  CHECK ((sent_at IS NULL) = (due_at IS NULL)),
  CHECK (sent_at IS NULL OR due_at = sent_at + interval '7 days'),
  CHECK (state <> 'SENT' OR (sent_at IS NOT NULL AND due_at IS NOT NULL))
);
CREATE UNIQUE INDEX one_current_bill_per_application ON daechion_automation.bills(application_id) WHERE is_current;

CREATE TABLE daechion_automation.registrations (
  application_id uuid NOT NULL REFERENCES daechion_automation.applications(id),
  lecture_id bigint NOT NULL CHECK (lecture_id > 0),
  student_id bigint CHECK (student_id > 0),
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','RUNNING','DONE','REVIEW','STOPPED')),
  lease_token uuid,
  lease_until timestamptz,
  completed_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (application_id, lecture_id),
  CHECK ((lease_token IS NULL) = (lease_until IS NULL)),
  CHECK (state <> 'RUNNING' OR lease_token IS NOT NULL),
  CHECK (state <> 'DONE' OR (student_id IS NOT NULL AND completed_at IS NOT NULL))
);

CREATE TABLE daechion_automation.outbox (
  id uuid PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES daechion_automation.applications(id),
  kind text NOT NULL CHECK (kind IN ('SHEETS','READY_MESSAGE')),
  event_version bigint NOT NULL CHECK (event_version > 0),
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','RUNNING','DONE','UNKNOWN','FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, kind, event_version),
  CHECK ((lease_token IS NULL) = (lease_until IS NULL)),
  CHECK (state <> 'RUNNING' OR lease_token IS NOT NULL)
);

CREATE TABLE daechion_automation.events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES daechion_automation.applications(id),
  kind text NOT NULL CHECK (kind ~ '^[a-z_]{1,64}$'),
  actor text NOT NULL CHECK (actor IN ('SYSTEM','ADMIN','BILLING_WORKER','ENROLLMENT_WORKER')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
