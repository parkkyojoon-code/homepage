BEGIN;
-- Read-only failures remain retryable; an unacknowledged create never repeats.
-- The backoff counter saturates at three and subsequent retries wait five minutes.
ALTER TABLE daechion_orders.orders
  ADD COLUMN identity_read_attempts integer NOT NULL DEFAULT 0 CHECK(identity_read_attempts BETWEEN 0 AND 3),
  ADD COLUMN identity_retry_at timestamptz;

ALTER TABLE daechion_orders.admin_actions DROP CONSTRAINT order_admin_access_evidence;
ALTER TABLE daechion_orders.admin_actions ADD CONSTRAINT order_admin_access_evidence CHECK(
  (action='RESUME_PAID' AND recovery_evidence ?& ARRAY['billId','amountWon','paidAt']) OR
  (action='RECONCILE_SHEETS' AND recovery_evidence ? 'jobId') OR
  (action IN ('MANUAL_ACCESS','RECORD_REVOKED') AND recovery_evidence ?& ARRAY['studentId','lectureId','weeklyLectureIds','checkedAt','profileFingerprint','contextFingerprint','requestFingerprint']) OR
  (action='RECONCILE_IDENTITY' AND (recovery_evidence='{}'::jsonb OR
    (recovery_evidence->'allTargetsNotOwned'='true'::jsonb AND jsonb_typeof(recovery_evidence->'payment')='object'))) OR
  (action NOT IN ('RESUME_PAID','RECONCILE_SHEETS','MANUAL_ACCESS','RECORD_REVOKED','RECONCILE_IDENTITY') AND recovery_evidence='{}'::jsonb));

CREATE OR REPLACE FUNCTION daechion_orders.guard_identity_recovery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.identity_recovery_action_id IS NOT NULL AND (NEW.identity_recovery_action_id,NEW.identity_write_started) IS DISTINCT FROM (OLD.identity_recovery_action_id,OLD.identity_write_started)
    THEN RAISE EXCEPTION 'ORDER_IDENTITY_RECOVERY_FROZEN'; END IF;
  IF NEW.identity_recovery_action_id IS DISTINCT FROM OLD.identity_recovery_action_id OR (OLD.identity_state='REVIEW' AND NEW.identity_state='PASSED') THEN
    IF OLD.identity_state<>'REVIEW' OR OLD.checkout_state<>'REVIEW' OR OLD.payment_state<>'PAID' OR OLD.identity_token IS NOT NULL OR OLD.confirmed_at IS NULL
      OR (OLD.identity_write_started AND COALESCE(OLD.review_code NOT IN ('identity_create_unknown','identity_unknown'),true))
      OR (NOT OLD.identity_write_started AND COALESCE(OLD.review_code NOT IN ('identity_review','identity_unknown','identity_lookup_failed'),true))
      OR NEW.checkout_state<>'REVIEW' OR NEW.review_code IS DISTINCT FROM 'identity_reconciled'
      OR NEW.payment_state<>'PAID' OR NEW.identity_state<>'PASSED' OR NEW.identity_write_started IS DISTINCT FROM OLD.identity_write_started OR NEW.identity_token IS NOT NULL
      OR (OLD.student_id IS NOT NULL AND OLD.student_id IS DISTINCT FROM NEW.student_id)
      OR EXISTS(SELECT 1 FROM daechion_orders.grants WHERE order_id=OLD.id AND (state<>'PENDING' OR enrollment_recorded))
      OR NOT EXISTS(SELECT 1 FROM daechion_orders.admin_actions a WHERE a.request_key=NEW.identity_recovery_action_id AND a.order_id=OLD.id AND a.action='RECONCILE_IDENTITY'
        AND a.before_version=OLD.version AND a.student_id=NEW.student_id AND a.order_request_fingerprint=OLD.request_fingerprint
        AND a.target_ids=(SELECT jsonb_agg(g.lecture_id ORDER BY g.lecture_id) FROM daechion_orders.grants g WHERE g.order_id=OLD.id)
        AND a.checked_at>now()-interval '60 seconds' AND a.checked_at<=now()+interval '5 seconds')
      THEN RAISE EXCEPTION 'ORDER_IDENTITY_RECOVERY_APPROVAL_REQUIRED'; END IF;
    -- A previously unattempted create can be replaced by a verified existing
    -- profile only with every cart target attested unowned and current payment.
    IF NOT OLD.identity_write_started AND NOT EXISTS(
      SELECT 1 FROM daechion_orders.admin_actions a JOIN daechion_orders.bills b
        ON b.id=(a.recovery_evidence->'payment'->>'recordId')::uuid AND b.order_id=OLD.id AND b.is_current AND b.state='SENT'
      WHERE a.request_key=NEW.identity_recovery_action_id AND a.recovery_evidence->'allTargetsNotOwned'='true'::jsonb
        AND a.recovery_evidence->'payment'->>'orderId'=OLD.id::text
        AND a.recovery_evidence->'payment'->>'tenantId'=OLD.tenant_id
        AND a.recovery_evidence->'payment'->>'version'=OLD.version::text
        AND a.recovery_evidence->'payment'->>'requestFingerprint'=OLD.request_fingerprint
        AND a.recovery_evidence->'payment'->>'billId'=b.bill_id
        AND a.recovery_evidence->'payment'->>'accountId'=b.provider_account
        AND (a.recovery_evidence->'payment'->>'amountWon')::integer=OLD.total_won AND b.amount_won=OLD.total_won
        AND b.checked_at IS NOT DISTINCT FROM (a.recovery_evidence->'payment'->>'token')::timestamptz
        AND (a.recovery_evidence->'payment'->>'checkedAt')::timestamptz>now()-interval '60 seconds'
        AND (a.recovery_evidence->'payment'->>'checkedAt')::timestamptz<=now()+interval '5 seconds'
        AND (a.recovery_evidence->'payment'->>'paidAt')::timestamptz=OLD.paid_at
        AND (a.recovery_evidence->'payment'->>'paidAt')::timestamptz>=b.sent_at-interval '60 seconds'
        AND (a.recovery_evidence->'payment'->>'paidAt')::timestamptz<=b.due_at
        AND (a.recovery_evidence->'payment'->>'paidAt')::timestamptz<=now()+interval '60 seconds'
        AND NOT EXISTS(SELECT 1 FROM daechion_automation.bills legacy WHERE legacy.provider_account=b.provider_account AND legacy.bill_id=b.bill_id))
      THEN RAISE EXCEPTION 'ORDER_IDENTITY_PAID_REVIEW_REQUIRED'; END IF;
  END IF;
  RETURN NEW;
END $$;

-- Older workers held read-only lookup failures as REVIEW. A never-created NEW
-- identity may be retried only through an audited fresh NEW/payment recheck.
CREATE FUNCTION daechion_orders.guard_paid_new_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.identity_state='REVIEW' AND NEW.identity_state='WAITING' THEN
    IF OLD.checkout_state<>'REVIEW' OR OLD.payment_state<>'PAID' OR OLD.confirmed_at IS NULL
      OR OLD.contact_snapshot->>'studentHistory' IS DISTINCT FROM 'NEW'
      OR COALESCE(OLD.review_code NOT IN ('identity_review','identity_unknown','identity_lookup_failed'),true)
      OR OLD.identity_write_started OR OLD.identity_token IS NOT NULL OR OLD.student_id IS NOT NULL
      OR OLD.identity_recovery_action_id IS NOT NULL OR OLD.closed_action_id IS NOT NULL
      OR NEW.checkout_state<>'READY' OR NEW.review_code IS NOT NULL OR NEW.payment_state<>'PAID'
      OR NEW.student_id IS NOT NULL OR NEW.identity_write_started OR NEW.identity_token IS NOT NULL
      OR EXISTS(SELECT 1 FROM daechion_orders.admin_actions WHERE order_id=OLD.id AND action IN ('APPROVE_EXISTING','RECONCILE_IDENTITY'))
      OR EXISTS(SELECT 1 FROM daechion_orders.ready_receipts WHERE order_id=OLD.id)
      OR EXISTS(SELECT 1 FROM daechion_orders.grants WHERE order_id=OLD.id AND (state<>'PENDING' OR enrollment_recorded OR lease_token IS NOT NULL OR weekly_ids<>'[]'::jsonb))
      OR NOT EXISTS(SELECT 1 FROM daechion_orders.admin_actions a JOIN daechion_orders.bills b
          ON b.id=(a.recovery_evidence->'payment'->>'recordId')::uuid AND b.order_id=OLD.id AND b.is_current AND b.state='SENT'
        WHERE a.order_id=OLD.id AND a.action='RESUME_PAID' AND a.before_version=OLD.version
          AND a.recovery_evidence->'newIdentity'->>'binding' ~ '^[a-f0-9]{64}$'
          AND a.recovery_evidence->'newIdentity'->'targetIds'=(SELECT jsonb_agg(g.lecture_id ORDER BY g.lecture_id) FROM daechion_orders.grants g WHERE g.order_id=OLD.id)
          AND (a.recovery_evidence->'newIdentity'->>'checkedAt')::timestamptz>now()-interval '60 seconds'
          AND (a.recovery_evidence->'newIdentity'->>'checkedAt')::timestamptz<=now()+interval '5 seconds'
          AND a.recovery_evidence->'payment'->>'orderId'=OLD.id::text
          AND a.recovery_evidence->'payment'->>'tenantId'=OLD.tenant_id
          AND a.recovery_evidence->'payment'->>'version'=OLD.version::text
          AND a.recovery_evidence->'payment'->>'requestFingerprint'=OLD.request_fingerprint
          AND a.recovery_evidence->'payment'->>'billId'=b.bill_id
          AND a.recovery_evidence->'payment'->>'accountId'=b.provider_account
          AND (a.recovery_evidence->'payment'->>'amountWon')::integer=OLD.total_won AND b.amount_won=OLD.total_won
          AND b.checked_at IS NOT DISTINCT FROM (a.recovery_evidence->'payment'->>'token')::timestamptz
          AND (a.recovery_evidence->'payment'->>'checkedAt')::timestamptz>now()-interval '60 seconds'
          AND (a.recovery_evidence->'payment'->>'checkedAt')::timestamptz<=now()+interval '5 seconds'
          AND (a.recovery_evidence->'payment'->>'paidAt')::timestamptz=OLD.paid_at AND NEW.paid_at=OLD.paid_at
          AND (a.recovery_evidence->'payment'->>'paidAt')::timestamptz>=b.sent_at-interval '60 seconds'
          AND (a.recovery_evidence->'payment'->>'paidAt')::timestamptz<=b.due_at
          AND (a.recovery_evidence->'payment'->>'paidAt')::timestamptz<=now()+interval '60 seconds'
          AND NOT EXISTS(SELECT 1 FROM daechion_automation.bills legacy WHERE legacy.provider_account=b.provider_account AND legacy.bill_id=b.bill_id))
      THEN RAISE EXCEPTION 'ORDER_PAID_NEW_IDENTITY_APPROVAL_REQUIRED'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_paid_new_identity BEFORE UPDATE ON daechion_orders.orders FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_paid_new_identity();
CREATE FUNCTION daechion_orders.guard_paid_new_identity_commit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.action='RESUME_PAID' AND NEW.recovery_evidence ? 'newIdentity' AND NOT EXISTS(
    SELECT 1 FROM daechion_orders.orders o WHERE o.id=NEW.order_id AND o.version>=NEW.after_version
      AND o.checkout_state='READY' AND o.payment_state='PAID' AND o.identity_state='WAITING' AND o.student_id IS NULL AND NOT o.identity_write_started)
    THEN RAISE EXCEPTION 'ORDER_ADMIN_COMMIT_INCOMPLETE'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER guard_paid_new_identity_commit AFTER INSERT ON daechion_orders.admin_actions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_paid_new_identity_commit();
COMMIT;
