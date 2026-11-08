BEGIN;
ALTER TABLE daechion_orders.admin_actions DROP CONSTRAINT order_admin_access_actions, DROP CONSTRAINT admin_actions_check2;
ALTER TABLE daechion_orders.admin_actions
  ADD CONSTRAINT order_admin_identity_actions CHECK(action IN ('HOLD','RETRY_ACCESS','APPROVE_EXISTING','RESUME_UNBILLED','RESUME_PAID','RECONCILE_SHEETS','MANUAL_ACCESS','RECORD_REVOKED','RECONCILE_IDENTITY')),
  ADD CONSTRAINT order_admin_identity_evidence CHECK(
    (action IN ('APPROVE_EXISTING','RECONCILE_IDENTITY') AND student_id IS NOT NULL AND profile_fingerprint IS NOT NULL AND context_fingerprint IS NOT NULL AND order_request_fingerprint IS NOT NULL AND jsonb_array_length(target_ids) BETWEEN 1 AND 30 AND checked_at IS NOT NULL) OR
    (action NOT IN ('APPROVE_EXISTING','RECONCILE_IDENTITY') AND student_id IS NULL AND profile_fingerprint IS NULL AND context_fingerprint IS NULL AND order_request_fingerprint IS NULL AND target_ids='[]'::jsonb AND checked_at IS NULL));
ALTER TABLE daechion_orders.orders ADD COLUMN identity_recovery_action_id uuid REFERENCES daechion_orders.admin_actions(request_key) DEFERRABLE INITIALLY DEFERRED;
CREATE FUNCTION daechion_orders.guard_identity_recovery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.identity_recovery_action_id IS NOT NULL AND (NEW.identity_recovery_action_id,NEW.identity_write_started) IS DISTINCT FROM (OLD.identity_recovery_action_id,OLD.identity_write_started)
    THEN RAISE EXCEPTION 'ORDER_IDENTITY_RECOVERY_FROZEN'; END IF;
  IF NEW.identity_recovery_action_id IS DISTINCT FROM OLD.identity_recovery_action_id OR (OLD.identity_state='REVIEW' AND NEW.identity_state='PASSED') THEN
    IF OLD.identity_state<>'REVIEW' OR OLD.checkout_state<>'REVIEW' OR OLD.payment_state<>'PAID' OR NOT OLD.identity_write_started OR OLD.identity_token IS NOT NULL OR OLD.confirmed_at IS NULL
      OR OLD.review_code NOT IN ('identity_create_unknown','identity_unknown') OR NEW.checkout_state<>'REVIEW' OR NEW.review_code<>'identity_reconciled'
      OR NEW.payment_state<>'PAID' OR NEW.identity_state<>'PASSED' OR NOT NEW.identity_write_started OR NEW.identity_token IS NOT NULL
      OR (OLD.student_id IS NOT NULL AND OLD.student_id IS DISTINCT FROM NEW.student_id)
      OR EXISTS(SELECT 1 FROM daechion_orders.grants WHERE order_id=OLD.id AND (state<>'PENDING' OR enrollment_recorded))
      OR NOT EXISTS(SELECT 1 FROM daechion_orders.admin_actions a WHERE a.request_key=NEW.identity_recovery_action_id AND a.order_id=OLD.id AND a.action='RECONCILE_IDENTITY'
        AND a.before_version=OLD.version AND a.student_id=NEW.student_id AND a.order_request_fingerprint=OLD.request_fingerprint
        AND a.target_ids=(SELECT jsonb_agg(g.lecture_id ORDER BY g.lecture_id) FROM daechion_orders.grants g WHERE g.order_id=OLD.id)
        AND a.checked_at>now()-interval '60 seconds' AND a.checked_at<=now()+interval '5 seconds')
      THEN RAISE EXCEPTION 'ORDER_IDENTITY_RECOVERY_APPROVAL_REQUIRED'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_identity_recovery BEFORE UPDATE ON daechion_orders.orders FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_identity_recovery();
CREATE OR REPLACE FUNCTION daechion_orders.guard_admin_commit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM daechion_orders.orders o WHERE o.id=NEW.order_id AND o.version>=NEW.after_version
    AND (NEW.action NOT IN ('APPROVE_EXISTING','RECONCILE_IDENTITY') OR (NEW.order_request_fingerprint=o.request_fingerprint AND NEW.target_ids=(SELECT jsonb_agg(g.lecture_id ORDER BY g.lecture_id) FROM daechion_orders.grants g WHERE g.order_id=o.id)))
    AND (NEW.action<>'RECONCILE_IDENTITY' OR (o.identity_recovery_action_id=NEW.request_key AND o.identity_state='PASSED' AND o.student_id=NEW.student_id)))
    THEN RAISE EXCEPTION 'ORDER_ADMIN_COMMIT_INCOMPLETE'; END IF;
  RETURN NEW;
END $$;
-- A reconciled identity may be recorded while held. The trigger above requires
-- a fresh audited profile match; content/payment eligibility is unchanged.
CREATE OR REPLACE FUNCTION daechion_orders.guard_worker_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.checkout_state='READY' AND NEW.review_code IS NOT NULL THEN RAISE EXCEPTION 'ORDER_REVIEW_BLOCKS_READY'; END IF;
  IF NEW.identity_state='PASSED' AND OLD.identity_state<>'PASSED' AND NOT daechion_orders.paid_eligible(NEW.id)
    AND NOT (OLD.identity_state='REVIEW' AND NEW.identity_recovery_action_id IS NOT NULL)
    THEN RAISE EXCEPTION 'ORDER_IDENTITY_REQUIRES_PAYMENT'; END IF;
  IF NEW.notification_state='PENDING' AND OLD.notification_state<>'PENDING' AND
    (NOT daechion_orders.paid_eligible(NEW.id) OR NEW.identity_state<>'PASSED' OR NOT EXISTS(SELECT 1 FROM daechion_orders.grants WHERE order_id=NEW.id) OR
      EXISTS(SELECT 1 FROM daechion_orders.grants WHERE order_id=NEW.id AND state NOT IN ('VERIFIED','MANUAL')))
    THEN RAISE EXCEPTION 'ORDER_CONTENT_NOT_READY'; END IF;
  RETURN NEW;
END $$;
COMMIT;
