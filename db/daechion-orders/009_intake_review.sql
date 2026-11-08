BEGIN;
ALTER TABLE daechion_orders.admin_actions DROP CONSTRAINT order_admin_identity_actions, DROP CONSTRAINT order_admin_identity_evidence;
ALTER TABLE daechion_orders.admin_actions
  ADD CONSTRAINT order_admin_intake_actions CHECK(action IN ('HOLD','RETRY_ACCESS','APPROVE_EXISTING','RESUME_UNBILLED','RESUME_PAID','RECONCILE_SHEETS','MANUAL_ACCESS','RECORD_REVOKED','RECONCILE_IDENTITY','CONFIRM_NEW_INTAKE','CLOSE_INTAKE')),
  ADD CONSTRAINT order_admin_intake_evidence CHECK(
    (action IN ('APPROVE_EXISTING','RECONCILE_IDENTITY') AND student_id IS NOT NULL AND profile_fingerprint IS NOT NULL AND context_fingerprint IS NOT NULL AND order_request_fingerprint IS NOT NULL AND jsonb_array_length(target_ids) BETWEEN 1 AND 30 AND checked_at IS NOT NULL) OR
    (action='CONFIRM_NEW_INTAKE' AND student_id IS NULL AND profile_fingerprint IS NULL AND context_fingerprint IS NOT NULL AND order_request_fingerprint IS NOT NULL AND jsonb_array_length(target_ids) BETWEEN 1 AND 30 AND checked_at IS NOT NULL) OR
    (action NOT IN ('APPROVE_EXISTING','RECONCILE_IDENTITY','CONFIRM_NEW_INTAKE') AND student_id IS NULL AND profile_fingerprint IS NULL AND context_fingerprint IS NULL AND order_request_fingerprint IS NULL AND target_ids='[]'::jsonb AND checked_at IS NULL));
ALTER TABLE daechion_orders.orders
  ADD COLUMN intake_action_id uuid REFERENCES daechion_orders.admin_actions(request_key) DEFERRABLE INITIALLY DEFERRED,
  ADD COLUMN closed_action_id uuid REFERENCES daechion_orders.admin_actions(request_key) DEFERRABLE INITIALLY DEFERRED;
CREATE FUNCTION daechion_orders.guard_intake_order() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE confirming boolean; closing boolean;
BEGIN
  IF OLD.closed_action_id IS NOT NULL AND
    (NEW.checkout_state,NEW.review_code,NEW.payment_state,NEW.student_id,NEW.identity_state,NEW.identity_write_started,NEW.identity_token,NEW.closed_action_id,NEW.intake_action_id)
    IS DISTINCT FROM
    (OLD.checkout_state,OLD.review_code,OLD.payment_state,OLD.student_id,OLD.identity_state,OLD.identity_write_started,OLD.identity_token,OLD.closed_action_id,OLD.intake_action_id)
    THEN RAISE EXCEPTION 'ORDER_CLOSED_INTAKE_FROZEN'; END IF;
  confirming=NEW.intake_action_id IS DISTINCT FROM OLD.intake_action_id;
  closing=NEW.closed_action_id IS DISTINCT FROM OLD.closed_action_id;
  IF confirming OR closing THEN
    IF confirming AND closing OR OLD.checkout_state NOT IN ('READY','REVIEW') OR OLD.payment_state<>'PENDING' OR OLD.identity_state<>'WAITING'
      OR OLD.student_id IS NOT NULL OR OLD.identity_write_started OR OLD.identity_token IS NOT NULL
      OR EXISTS(SELECT 1 FROM daechion_orders.bills WHERE order_id=OLD.id)
      OR EXISTS(SELECT 1 FROM daechion_orders.ready_receipts WHERE order_id=OLD.id)
      OR EXISTS(SELECT 1 FROM daechion_orders.grants WHERE order_id=OLD.id AND (state<>'PENDING' OR enrollment_recorded OR lease_token IS NOT NULL OR weekly_ids<>'[]'::jsonb))
      OR (NEW.identity_state,NEW.student_id,NEW.identity_write_started,NEW.identity_token,NEW.payment_state) IS DISTINCT FROM (OLD.identity_state,OLD.student_id,OLD.identity_write_started,OLD.identity_token,OLD.payment_state)
      THEN RAISE EXCEPTION 'ORDER_INTAKE_ALREADY_ATTEMPTED'; END IF;
    IF confirming AND (OLD.checkout_state<>'REVIEW' OR NEW.checkout_state<>'READY' OR NEW.review_code IS NOT NULL OR OLD.contact_snapshot->>'studentHistory'<>'NEW'
      OR NOT EXISTS(SELECT 1 FROM daechion_orders.admin_actions a WHERE a.request_key=NEW.intake_action_id AND a.order_id=OLD.id AND a.action='CONFIRM_NEW_INTAKE'
        AND a.before_version=OLD.version AND a.order_request_fingerprint=OLD.request_fingerprint
        AND a.target_ids=(SELECT jsonb_agg(g.lecture_id ORDER BY g.lecture_id) FROM daechion_orders.grants g WHERE g.order_id=OLD.id)
        AND a.checked_at>now()-interval '60 seconds' AND a.checked_at<=now()+interval '5 seconds'))
      THEN RAISE EXCEPTION 'ORDER_INTAKE_APPROVAL_REQUIRED'; END IF;
    IF closing AND (NEW.checkout_state<>'CLOSED' OR NEW.review_code<>'intake_closed'
      OR NOT EXISTS(SELECT 1 FROM daechion_orders.admin_actions a WHERE a.request_key=NEW.closed_action_id AND a.order_id=OLD.id AND a.action='CLOSE_INTAKE' AND a.before_version=OLD.version))
      THEN RAISE EXCEPTION 'ORDER_INTAKE_CLOSURE_APPROVAL_REQUIRED'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_intake_order BEFORE UPDATE ON daechion_orders.orders FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_intake_order();
CREATE FUNCTION daechion_orders.guard_closed_intake_bill() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM daechion_orders.orders WHERE id=NEW.order_id AND closed_action_id IS NOT NULL)
    THEN RAISE EXCEPTION 'ORDER_CLOSED_INTAKE_CANNOT_BILL'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_closed_intake_bill BEFORE INSERT ON daechion_orders.bills FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_closed_intake_bill();

CREATE OR REPLACE FUNCTION daechion_orders.guard_order() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE q daechion_orders.quotes; item record; manual_review boolean;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.checkout_state<>'DRAFT' OR NEW.payment_state<>'PENDING' OR NEW.notification_state<>'NOT_READY' OR NEW.identity_state<>'WAITING' OR NEW.student_id IS NOT NULL OR NEW.confirmed_at IS NOT NULL
      THEN RAISE EXCEPTION 'ORDER_MUST_START_DRAFT'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at THEN RAISE EXCEPTION 'ORDER_CONFIRMATION_FROZEN'; END IF;
  IF OLD.checkout_state<>'DRAFT' AND
    (NEW.quote_id,NEW.request_key,NEW.request_fingerprint,NEW.cart_fingerprint,NEW.subject_key,NEW.tenant_id,NEW.student_phone,NEW.contact_snapshot,NEW.total_won)
    IS DISTINCT FROM
    (OLD.quote_id,OLD.request_key,OLD.request_fingerprint,OLD.cart_fingerprint,OLD.subject_key,OLD.tenant_id,OLD.student_phone,OLD.contact_snapshot,OLD.total_won)
    THEN RAISE EXCEPTION 'ORDER_SNAPSHOT_FROZEN'; END IF;
  IF OLD.checkout_state<>'DRAFT' AND NEW.checkout_state='DRAFT' THEN RAISE EXCEPTION 'ORDER_CANNOT_REOPEN_DRAFT'; END IF;
  IF OLD.identity_state='PASSED' AND NEW.student_id IS DISTINCT FROM OLD.student_id THEN RAISE EXCEPTION 'ORDER_STUDENT_FROZEN'; END IF;
  IF NEW.payment_state='PAID' AND OLD.payment_state<>'PAID' AND NOT EXISTS(
    SELECT 1 FROM daechion_orders.bills WHERE order_id=NEW.id AND is_current AND state='SENT' AND last_payment_state='PAID')
    THEN RAISE EXCEPTION 'ORDER_PAYMENT_EVIDENCE_REQUIRED'; END IF;
  IF OLD.checkout_state<>'READY' AND NEW.checkout_state='READY' THEN
    SELECT * INTO q FROM daechion_orders.quotes WHERE id=NEW.quote_id FOR UPDATE;
    manual_review=q.state='REVIEW' AND EXISTS(SELECT 1 FROM daechion_orders.admin_actions a WHERE a.order_id=OLD.id AND a.action IN ('APPROVE_EXISTING','CONFIRM_NEW_INTAKE') AND a.before_version=OLD.version AND a.order_request_fingerprint=OLD.request_fingerprint AND a.target_ids=(SELECT jsonb_agg(g.lecture_id ORDER BY g.lecture_id) FROM daechion_orders.grants g WHERE g.order_id=OLD.id) AND a.checked_at>now()-interval '60 seconds' AND a.checked_at<=now()+interval '5 seconds');
    IF (NOT manual_review AND q.state NOT IN ('READY','CONSUMED')) OR (q.state='CONSUMED' AND OLD.confirmed_at IS NULL) OR
      (NOT manual_review AND q.state='READY' AND q.expires_at<=now()) OR q.total_won<>NEW.total_won OR q.cart_fingerprint<>NEW.cart_fingerprint OR q.subject_key<>NEW.subject_key OR
      jsonb_typeof(q.snapshot->'items') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'ORDER_QUOTE_NOT_READY'; END IF;
    IF (SELECT count(*) FROM daechion_orders.items WHERE order_id=NEW.id)=0 OR
      (SELECT sum(price_won) FROM daechion_orders.items WHERE order_id=NEW.id)<>NEW.total_won OR
      (SELECT count(*) FROM daechion_orders.items WHERE order_id=NEW.id)<>jsonb_array_length(q.snapshot->'items') THEN RAISE EXCEPTION 'ORDER_SUM_MISMATCH'; END IF;
    FOR item IN SELECT * FROM daechion_orders.items WHERE order_id=NEW.id LOOP
      IF NOT (q.snapshot->'items' @> jsonb_build_array(item.snapshot)) OR
        item.snapshot->>'productId' IS DISTINCT FROM item.product_id OR item.snapshot->>'saleKind' IS DISTINCT FROM item.sale_kind OR
        item.snapshot->>'title' IS DISTINCT FROM item.title OR item.snapshot->>'tenantId' IS DISTINCT FROM NEW.tenant_id OR
        (item.snapshot->>'priceWon')::integer IS DISTINCT FROM item.price_won OR
        (item.sale_kind='SINGLE' AND jsonb_array_length(item.snapshot->'lectures')<>1) OR
        (item.sale_kind='BUNDLE' AND jsonb_array_length(item.snapshot->'lectures')<2) OR
        (SELECT count(*) FROM daechion_orders.grants WHERE item_id=item.id)<>jsonb_array_length(item.snapshot->'lectures') OR
        EXISTS(SELECT 1 FROM jsonb_array_elements(item.snapshot->'lectures') AS t
          WHERE NOT EXISTS(SELECT 1 FROM daechion_orders.grants g WHERE g.item_id=item.id AND g.lecture_id=(t->>'id')::bigint))
        THEN RAISE EXCEPTION 'ORDER_TARGETS_MISMATCH'; END IF;
    END LOOP;
    IF OLD.confirmed_at IS NULL THEN NEW.confirmed_at=now(); END IF;
    UPDATE daechion_orders.quotes SET state='CONSUMED' WHERE id=q.id;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION daechion_orders.guard_quote() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id,NEW.token_hash,NEW.cart_fingerprint,NEW.subject_key,NEW.snapshot,NEW.total_won,NEW.created_at,NEW.expires_at)
    IS DISTINCT FROM (OLD.id,OLD.token_hash,OLD.cart_fingerprint,OLD.subject_key,OLD.snapshot,OLD.total_won,OLD.created_at,OLD.expires_at)
    THEN RAISE EXCEPTION 'ORDER_QUOTE_SNAPSHOT_FROZEN'; END IF;
  IF NEW.state<>OLD.state AND NOT ((OLD.state='READY' AND NEW.state IN ('CONSUMED','REVIEW','EXPIRED')) OR (OLD.state='REVIEW' AND NEW.state='EXPIRED') OR (OLD.state='REVIEW' AND NEW.state='CONSUMED' AND EXISTS(SELECT 1 FROM daechion_orders.orders o JOIN daechion_orders.admin_actions a ON a.order_id=o.id WHERE o.quote_id=OLD.id AND o.checkout_state='REVIEW' AND a.action IN ('APPROVE_EXISTING','CONFIRM_NEW_INTAKE') AND a.before_version=o.version AND a.order_request_fingerprint=o.request_fingerprint AND a.target_ids=(SELECT jsonb_agg(g.lecture_id ORDER BY g.lecture_id) FROM daechion_orders.grants g WHERE g.order_id=o.id) AND a.checked_at>now()-interval '60 seconds' AND a.checked_at<=now()+interval '5 seconds')))
    THEN RAISE EXCEPTION 'ORDER_QUOTE_TRANSITION_INVALID'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION daechion_orders.guard_admin_commit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM daechion_orders.orders o WHERE o.id=NEW.order_id AND o.version>=NEW.after_version
    AND (NEW.action NOT IN ('APPROVE_EXISTING','RECONCILE_IDENTITY','CONFIRM_NEW_INTAKE') OR (NEW.order_request_fingerprint=o.request_fingerprint AND NEW.target_ids=(SELECT jsonb_agg(g.lecture_id ORDER BY g.lecture_id) FROM daechion_orders.grants g WHERE g.order_id=o.id)))
    AND (NEW.action<>'RECONCILE_IDENTITY' OR (o.identity_recovery_action_id=NEW.request_key AND o.identity_state='PASSED' AND o.student_id=NEW.student_id))
    AND (NEW.action<>'CONFIRM_NEW_INTAKE' OR (o.intake_action_id=NEW.request_key AND o.confirmed_at IS NOT NULL))
    AND (NEW.action<>'CLOSE_INTAKE' OR (o.closed_action_id=NEW.request_key AND o.checkout_state='CLOSED' AND o.review_code='intake_closed')))
    THEN RAISE EXCEPTION 'ORDER_ADMIN_COMMIT_INCOMPLETE'; END IF;
  RETURN NEW;
END $$;
COMMIT;
