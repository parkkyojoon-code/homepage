BEGIN;
CREATE TABLE daechion_automation.admin_actions (
  id uuid PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES daechion_automation.applications(id),
  fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
  action text NOT NULL CHECK(action IN ('HOLD','RESUME','MANUAL_COMPLETE','REVOKED','CONFIRM_PAYMENT')),
  operator_name text NOT NULL CHECK(length(operator_name) BETWEEN 1 AND 80),
  reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 1000),
  evidence jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE daechion_automation.applications ADD COLUMN manual_access_action uuid REFERENCES daechion_automation.admin_actions(id);
ALTER TABLE daechion_automation.identity_checks ADD COLUMN manual_review_id uuid REFERENCES daechion_automation.admin_actions(id);
CREATE TABLE daechion_automation.ready_receipts (
  id uuid PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES daechion_automation.applications(id),
  phone text NOT NULL CHECK(phone ~ '^01[0-9]{9}$'),
  state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','UNKNOWN','SENT')),
  provider_message_id text,
  accepted_at timestamptz,
  UNIQUE(application_id,phone),
  CHECK(state<>'SENT' OR (provider_message_id IS NOT NULL AND accepted_at IS NOT NULL))
);
COMMIT;
