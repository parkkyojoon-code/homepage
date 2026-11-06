BEGIN;

-- Existing API registrations are not evidence of content access. Do not backfill
-- VERIFIED or replay existing external writes during migration.
ALTER TABLE daechion_automation.registrations
  ADD COLUMN access_state text NOT NULL DEFAULT 'NOT_VERIFIED'
    CHECK (access_state IN ('NOT_VERIFIED','PENDING','VERIFIED','MANUAL')),
  ADD COLUMN access_targets jsonb,
  ADD COLUMN access_checked_at timestamptz;
ALTER TABLE daechion_automation.registrations ADD CONSTRAINT content_access_evidence
  CHECK (access_state NOT IN ('VERIFIED','MANUAL') OR
    (student_id IS NOT NULL AND access_checked_at IS NOT NULL));

COMMIT;
