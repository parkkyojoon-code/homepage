BEGIN;
CREATE TABLE daechion_automation.identity_checks (
  application_id uuid PRIMARY KEY REFERENCES daechion_automation.applications(id),
  status text NOT NULL DEFAULT 'WAITING' CHECK(status IN ('WAITING','PASSED','REVIEW')),
  detected_type text NOT NULL DEFAULT 'UNKNOWN' CHECK(detected_type IN ('UNKNOWN','NEW','EXISTING')),
  student_id bigint CHECK(student_id>0),
  origin text CHECK(origin IN ('CREATED','EXISTING')),
  reason_code text CHECK(reason_code ~ '^[a-z_]{1,64}$'),
  checked_at timestamptz,
  CHECK ((student_id IS NULL) = (origin IS NULL)),
  CHECK (status<>'PASSED' OR (student_id IS NOT NULL AND checked_at IS NOT NULL AND reason_code IS NULL))
);
CREATE TABLE daechion_automation.identity_phone_claims (
  phone text PRIMARY KEY CHECK(phone ~ '^01[0-9]{9}$'),
  application_id uuid NOT NULL REFERENCES daechion_automation.applications(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Existing immutable submissions are not rewritten or assumed to be NEW.
INSERT INTO daechion_automation.identity_checks(application_id) SELECT id FROM daechion_automation.applications;
COMMIT;
