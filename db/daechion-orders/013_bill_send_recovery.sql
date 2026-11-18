BEGIN;
-- Keep the original dispatch boundary, including across a lost send response.
-- Old rows are only recoverable when one bill and one original dispatch event
-- identify the attempt unambiguously. Missing evidence remains missing.
ALTER TABLE daechion_orders.bills
  ADD COLUMN send_attempted_at timestamptz,
  ADD COLUMN send_recovery_action_id uuid REFERENCES daechion_orders.admin_actions(request_key) DEFERRABLE INITIALLY DEFERRED;
WITH proven AS (
  SELECT b.id,min(e.created_at) AS attempted_at
  FROM daechion_orders.bills b JOIN daechion_orders.orders o ON o.id=b.order_id
    JOIN daechion_orders.events e ON e.order_id=o.id AND e.kind='bill_send_attempted'
  WHERE b.revision=1 AND b.state IN ('SEND_UNKNOWN','SENT','CANCELLED','DESTROYED') AND o.confirmed_at IS NOT NULL
    AND e.created_at>=o.created_at AND e.created_at<=now()
    AND (SELECT count(*) FROM daechion_orders.bills same_order WHERE same_order.order_id=b.order_id)=1
    AND (SELECT count(*) FROM daechion_orders.events attempts WHERE attempts.order_id=b.order_id AND attempts.kind='bill_send_attempted')=1
  GROUP BY b.id HAVING count(*)=1
)
UPDATE daechion_orders.bills b SET send_attempted_at=p.attempted_at FROM proven p WHERE p.id=b.id;
ALTER TABLE daechion_orders.bills
  ALTER COLUMN send_attempted_at SET DEFAULT now(),
  ADD CONSTRAINT order_bill_recovery_times CHECK(send_recovery_action_id IS NULL OR
    (send_attempted_at IS NOT NULL AND sent_at IS NOT NULL AND due_at IS NOT NULL AND
      sent_at=send_attempted_at AND due_at=send_attempted_at+interval '7 days'));

ALTER TABLE daechion_orders.admin_actions DROP CONSTRAINT order_admin_intake_actions,DROP CONSTRAINT order_admin_access_evidence;
ALTER TABLE daechion_orders.admin_actions
  ADD CONSTRAINT order_admin_bill_actions CHECK(action IN ('HOLD','RETRY_ACCESS','APPROVE_EXISTING','RESUME_UNBILLED','RESUME_PAID','RECONCILE_SHEETS','MANUAL_ACCESS','RECORD_REVOKED','RECONCILE_IDENTITY','CONFIRM_NEW_INTAKE','CLOSE_INTAKE','RECONCILE_BILL')),
  ADD CONSTRAINT order_admin_access_evidence CHECK(
    (action='RESUME_PAID' AND recovery_evidence ?& ARRAY['billId','amountWon','paidAt']) OR
    (action='RECONCILE_SHEETS' AND recovery_evidence ? 'jobId') OR
    (action IN ('MANUAL_ACCESS','RECORD_REVOKED') AND recovery_evidence ?& ARRAY['studentId','lectureId','weeklyLectureIds','checkedAt','profileFingerprint','contextFingerprint','requestFingerprint']) OR
    (action='RECONCILE_IDENTITY' AND (recovery_evidence='{}'::jsonb OR
      (recovery_evidence->'allTargetsNotOwned'='true'::jsonb AND jsonb_typeof(recovery_evidence->'payment')='object'))) OR
    (action='RECONCILE_BILL' AND jsonb_typeof(recovery_evidence->'billRecovery')='object' AND
      (recovery_evidence->'billRecovery') ?& ARRAY['orderId','tenantId','version','requestFingerprint','recordId','token','accountId','billId','amountWon','attemptedAt','paidAt','checkedAt']) OR
    (action NOT IN ('RESUME_PAID','RECONCILE_SHEETS','MANUAL_ACCESS','RECORD_REVOKED','RECONCILE_IDENTITY','RECONCILE_BILL') AND recovery_evidence='{}'::jsonb));

CREATE FUNCTION daechion_orders.guard_bill_attempt_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.kind='bill_send_attempted' OR (TG_OP='UPDATE' AND NEW.kind='bill_send_attempted')
    THEN RAISE EXCEPTION 'ORDER_BILL_ATTEMPT_HISTORY_IMMUTABLE'; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER guard_bill_attempt_event BEFORE UPDATE OR DELETE ON daechion_orders.events
  FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_bill_attempt_event();

CREATE FUNCTION daechion_orders.guard_bill_send_recovery() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE o daechion_orders.orders; a daechion_orders.admin_actions; e jsonb;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.send_attempted_at IS DISTINCT FROM now() OR NEW.send_recovery_action_id IS NOT NULL
      THEN RAISE EXCEPTION 'ORDER_BILL_ATTEMPT_MUST_START_CURRENT'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.send_attempted_at IS DISTINCT FROM OLD.send_attempted_at
    THEN RAISE EXCEPTION 'ORDER_BILL_ATTEMPT_FROZEN'; END IF;
  IF OLD.send_recovery_action_id IS NOT NULL AND NEW.send_recovery_action_id IS DISTINCT FROM OLD.send_recovery_action_id
    THEN RAISE EXCEPTION 'ORDER_BILL_RECOVERY_FROZEN'; END IF;
  IF NEW.send_recovery_action_id IS NOT DISTINCT FROM OLD.send_recovery_action_id THEN RETURN NEW; END IF;
  SELECT * INTO o FROM daechion_orders.orders WHERE id=OLD.order_id FOR UPDATE;
  SELECT * INTO a FROM daechion_orders.admin_actions WHERE request_key=NEW.send_recovery_action_id;
  e=a.recovery_evidence->'billRecovery';
  IF OLD.state<>'SEND_UNKNOWN' OR NOT OLD.is_current OR OLD.sent_at IS NOT NULL OR OLD.due_at IS NOT NULL OR OLD.send_attempted_at IS NULL
    OR NEW.state<>'SENT' OR NOT NEW.is_current OR NEW.last_payment_state IS DISTINCT FROM 'PAID'
    OR NEW.sent_at IS DISTINCT FROM OLD.send_attempted_at OR NEW.due_at IS DISTINCT FROM OLD.send_attempted_at+interval '7 days'
    OR NEW.checked_at IS NULL OR (OLD.checked_at IS NOT NULL AND NEW.checked_at<=OLD.checked_at)
    OR o.checkout_state<>'REVIEW' OR o.review_code IS DISTINCT FROM 'bill_send_unknown' OR o.payment_state NOT IN ('PENDING','UNKNOWN')
    OR o.identity_state<>'WAITING' OR o.student_id IS NOT NULL OR o.identity_write_started OR o.identity_token IS NOT NULL
    OR o.closed_action_id IS NOT NULL OR o.identity_recovery_action_id IS NOT NULL OR o.confirmed_at IS NULL OR o.paid_at IS NOT NULL
    OR a.action IS DISTINCT FROM 'RECONCILE_BILL' OR a.order_id IS DISTINCT FROM OLD.order_id OR a.before_version IS DISTINCT FROM o.version
    OR e->>'orderId' IS DISTINCT FROM o.id::text OR e->>'tenantId' IS DISTINCT FROM o.tenant_id OR e->>'version' IS DISTINCT FROM o.version::text
    OR e->>'requestFingerprint' IS DISTINCT FROM o.request_fingerprint OR e->>'recordId' IS DISTINCT FROM OLD.id::text
    OR e->>'accountId' IS DISTINCT FROM OLD.provider_account OR e->>'billId' IS DISTINCT FROM OLD.bill_id
    OR (e->>'amountWon')::integer IS DISTINCT FROM o.total_won OR OLD.amount_won IS DISTINCT FROM o.total_won
    OR OLD.checked_at IS DISTINCT FROM (e->>'token')::timestamptz
    OR OLD.send_attempted_at IS DISTINCT FROM (e->>'attemptedAt')::timestamptz
    OR (e->>'checkedAt')::timestamptz IS NULL OR (e->>'checkedAt')::timestamptz<=now()-interval '60 seconds'
    OR (e->>'checkedAt')::timestamptz>now()+interval '5 seconds'
    OR (e->>'paidAt')::timestamptz IS NULL OR (e->>'paidAt')::timestamptz<OLD.send_attempted_at-interval '60 seconds'
    OR (e->>'paidAt')::timestamptz>OLD.send_attempted_at+interval '7 days' OR (e->>'paidAt')::timestamptz>now()+interval '60 seconds'
    OR EXISTS(SELECT 1 FROM daechion_orders.grants WHERE order_id=o.id AND (state<>'PENDING' OR enrollment_recorded OR lease_token IS NOT NULL OR weekly_ids<>'[]'::jsonb))
    OR EXISTS(SELECT 1 FROM daechion_orders.ready_receipts WHERE order_id=o.id)
    OR EXISTS(SELECT 1 FROM daechion_automation.bills legacy WHERE legacy.provider_account=OLD.provider_account AND legacy.bill_id=OLD.bill_id)
    THEN RAISE EXCEPTION 'ORDER_BILL_RECOVERY_APPROVAL_REQUIRED'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_bill_send_recovery BEFORE INSERT OR UPDATE ON daechion_orders.bills
  FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_bill_send_recovery();

CREATE FUNCTION daechion_orders.guard_reconciled_bill_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.review_code='bill_reconciled' AND OLD.review_code IS DISTINCT FROM NEW.review_code THEN
    IF OLD.checkout_state<>'REVIEW' OR OLD.review_code IS DISTINCT FROM 'bill_send_unknown' OR OLD.payment_state NOT IN ('PENDING','UNKNOWN')
      OR NEW.checkout_state<>'REVIEW' OR NEW.payment_state<>'PAID' OR
      (NEW.student_id,NEW.identity_state,NEW.identity_write_started,NEW.identity_token,NEW.identity_recovery_action_id,NEW.closed_action_id)
      IS DISTINCT FROM (OLD.student_id,OLD.identity_state,OLD.identity_write_started,OLD.identity_token,OLD.identity_recovery_action_id,OLD.closed_action_id)
      OR NOT EXISTS(SELECT 1 FROM daechion_orders.bills b JOIN daechion_orders.admin_actions a ON a.request_key=b.send_recovery_action_id
        WHERE b.order_id=OLD.id AND b.is_current AND b.state='SENT' AND b.last_payment_state='PAID' AND a.action='RECONCILE_BILL'
          AND a.order_id=OLD.id AND a.before_version=OLD.version AND NEW.paid_at=(a.recovery_evidence->'billRecovery'->>'paidAt')::timestamptz)
      THEN RAISE EXCEPTION 'ORDER_BILL_RECOVERY_APPROVAL_REQUIRED'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_reconciled_bill_order BEFORE UPDATE ON daechion_orders.orders
  FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_reconciled_bill_order();

CREATE FUNCTION daechion_orders.guard_bill_recovery_commit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.action='RECONCILE_BILL' AND NOT EXISTS(
    SELECT 1 FROM daechion_orders.orders o JOIN daechion_orders.bills b ON b.order_id=o.id
    WHERE o.id=NEW.order_id AND o.version>=NEW.after_version AND o.checkout_state='REVIEW' AND o.payment_state='PAID'
      AND o.review_code='bill_reconciled' AND o.paid_at=(NEW.recovery_evidence->'billRecovery'->>'paidAt')::timestamptz
      AND b.send_recovery_action_id=NEW.request_key AND b.is_current AND b.state='SENT' AND b.last_payment_state='PAID'
      AND b.id::text=NEW.recovery_evidence->'billRecovery'->>'recordId'
      AND b.sent_at=b.send_attempted_at AND b.due_at=b.send_attempted_at+interval '7 days')
    THEN RAISE EXCEPTION 'ORDER_ADMIN_COMMIT_INCOMPLETE'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER guard_bill_recovery_commit AFTER INSERT ON daechion_orders.admin_actions DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_bill_recovery_commit();
COMMIT;
