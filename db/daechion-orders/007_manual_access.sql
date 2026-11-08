BEGIN;
ALTER TABLE daechion_orders.admin_actions DROP CONSTRAINT order_admin_recovery_actions, DROP CONSTRAINT order_admin_recovery_evidence, DROP CONSTRAINT admin_actions_check1;
ALTER TABLE daechion_orders.admin_actions
  ADD CONSTRAINT order_admin_access_actions CHECK(action IN ('HOLD','RETRY_ACCESS','APPROVE_EXISTING','RESUME_UNBILLED','RESUME_PAID','RECONCILE_SHEETS','MANUAL_ACCESS','RECORD_REVOKED')),
  ADD CONSTRAINT order_admin_access_target CHECK((action IN ('RETRY_ACCESS','MANUAL_ACCESS','RECORD_REVOKED') AND lecture_id IS NOT NULL) OR (action NOT IN ('RETRY_ACCESS','MANUAL_ACCESS','RECORD_REVOKED') AND lecture_id IS NULL)),
  ADD CONSTRAINT order_admin_access_evidence CHECK(
    (action='RESUME_PAID' AND recovery_evidence ?& ARRAY['billId','amountWon','paidAt']) OR
    (action='RECONCILE_SHEETS' AND recovery_evidence ? 'jobId') OR
    (action IN ('MANUAL_ACCESS','RECORD_REVOKED') AND recovery_evidence ?& ARRAY['studentId','lectureId','weeklyLectureIds','checkedAt','profileFingerprint','contextFingerprint','requestFingerprint']) OR
    (action NOT IN ('RESUME_PAID','RECONCILE_SHEETS','MANUAL_ACCESS','RECORD_REVOKED') AND recovery_evidence='{}'::jsonb));
ALTER TABLE daechion_orders.grants DROP CONSTRAINT grants_state_check;
ALTER TABLE daechion_orders.grants
  ADD COLUMN manual_action_id uuid REFERENCES daechion_orders.admin_actions(request_key) DEFERRABLE INITIALLY DEFERRED,
  ADD COLUMN revoked_at timestamptz,
  ADD CONSTRAINT order_grant_access_states CHECK(state IN ('PENDING','RUNNING','REVIEW','VERIFIED','MANUAL','REVOKED')),
  ADD CONSTRAINT order_grant_revoked_evidence CHECK(state<>'REVOKED' OR (revoked_at IS NOT NULL AND manual_action_id IS NOT NULL));
CREATE FUNCTION daechion_orders.guard_manual_access() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state='REVOKED' AND (NEW.state,NEW.manual_action_id,NEW.revoked_at) IS DISTINCT FROM (OLD.state,OLD.manual_action_id,OLD.revoked_at)
    THEN RAISE EXCEPTION 'ORDER_REVOKED_ACCESS_FROZEN'; END IF;
  IF NEW.state IN ('MANUAL','REVOKED') AND (NEW.state IS DISTINCT FROM OLD.state OR NEW.manual_action_id IS DISTINCT FROM OLD.manual_action_id) THEN
    IF NOT EXISTS(SELECT 1 FROM daechion_orders.admin_actions a JOIN daechion_orders.orders o ON o.id=a.order_id
      WHERE a.request_key=NEW.manual_action_id AND a.order_id=NEW.order_id AND a.lecture_id=NEW.lecture_id AND a.before_version=o.version
      AND a.action=CASE WHEN NEW.state='MANUAL' THEN 'MANUAL_ACCESS' ELSE 'RECORD_REVOKED' END
      AND o.identity_state='PASSED' AND (a.recovery_evidence->>'studentId')::bigint=o.student_id
      AND (a.recovery_evidence->>'lectureId')::bigint=NEW.lecture_id
      AND a.recovery_evidence->>'requestFingerprint'=o.request_fingerprint
      AND (NEW.state<>'MANUAL' OR (jsonb_array_length(a.recovery_evidence->'weeklyLectureIds')>0 AND a.recovery_evidence->'weeklyLectureIds'=NEW.weekly_ids))
      AND (NEW.state<>'REVOKED' OR a.recovery_evidence->'weeklyLectureIds'='[]'::jsonb)
      AND (a.recovery_evidence->>'checkedAt')::timestamptz>now()-interval '60 seconds'
      AND (a.recovery_evidence->>'checkedAt')::timestamptz<=now()+interval '5 seconds')
      THEN RAISE EXCEPTION 'ORDER_MANUAL_ACCESS_APPROVAL_REQUIRED'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_manual_access BEFORE UPDATE ON daechion_orders.grants FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_manual_access();
CREATE FUNCTION daechion_orders.guard_revoked_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.checkout_state='READY' AND EXISTS(SELECT 1 FROM daechion_orders.grants WHERE order_id=NEW.id AND state='REVOKED')
    THEN RAISE EXCEPTION 'ORDER_REVOKED_ACCESS_BLOCKS_READY'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_revoked_order BEFORE UPDATE ON daechion_orders.orders FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_revoked_order();
COMMIT;
