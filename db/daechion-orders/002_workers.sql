BEGIN;
-- Isolated order-worker support; never run by the existing single-intake runner.
ALTER TABLE daechion_orders.orders
  ADD COLUMN review_code text CHECK(review_code ~ '^[a-z_]{1,64}$'),
  ADD COLUMN paid_at timestamptz,
  ADD COLUMN identity_token uuid,
  ADD COLUMN identity_until timestamptz,
  ADD COLUMN identity_write_started boolean NOT NULL DEFAULT false,
  ADD CHECK((identity_token IS NULL)=(identity_until IS NULL));
ALTER TABLE daechion_orders.bills ADD COLUMN checked_at timestamptz;
ALTER TABLE daechion_orders.grants
  ADD COLUMN review_code text CHECK(review_code ~ '^[a-z_]{1,64}$'),
  ADD COLUMN enrollment_recorded boolean NOT NULL DEFAULT false,
  ADD COLUMN weekly_ids jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(weekly_ids)='array');
CREATE UNIQUE INDEX one_order_ready_job ON daechion_orders.jobs(order_id) WHERE kind='READY_MESSAGE';

CREATE FUNCTION daechion_orders.paid_eligible(oid uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM daechion_orders.orders o JOIN daechion_orders.bills b ON b.order_id=o.id AND b.is_current
    WHERE o.id=oid AND o.checkout_state='READY' AND o.review_code IS NULL AND o.payment_state='PAID'
    AND b.state='SENT' AND b.last_payment_state='PAID' AND b.checked_at>now()-interval '3 minutes')
$$;
CREATE FUNCTION daechion_orders.guard_worker_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.checkout_state='READY' AND NEW.review_code IS NOT NULL THEN RAISE EXCEPTION 'ORDER_REVIEW_BLOCKS_READY'; END IF;
  IF NEW.identity_state='PASSED' AND OLD.identity_state<>'PASSED' AND NOT daechion_orders.paid_eligible(NEW.id)
    THEN RAISE EXCEPTION 'ORDER_IDENTITY_REQUIRES_PAYMENT'; END IF;
  IF NEW.notification_state='PENDING' AND OLD.notification_state<>'PENDING' AND
    (NOT daechion_orders.paid_eligible(NEW.id) OR NEW.identity_state<>'PASSED' OR NOT EXISTS(SELECT 1 FROM daechion_orders.grants WHERE order_id=NEW.id) OR
      EXISTS(SELECT 1 FROM daechion_orders.grants WHERE order_id=NEW.id AND state NOT IN ('VERIFIED','MANUAL')))
    THEN RAISE EXCEPTION 'ORDER_CONTENT_NOT_READY'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_worker_order BEFORE UPDATE ON daechion_orders.orders FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_worker_order();
CREATE FUNCTION daechion_orders.guard_worker_grant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state IN ('RUNNING','VERIFIED','MANUAL') AND NEW.state IS DISTINCT FROM OLD.state AND NOT daechion_orders.paid_eligible(NEW.order_id)
    THEN RAISE EXCEPTION 'ORDER_PAYMENT_NOT_CURRENT'; END IF;
  IF NEW.state='VERIFIED' AND (NOT NEW.enrollment_recorded OR jsonb_array_length(NEW.weekly_ids)=0)
    THEN RAISE EXCEPTION 'ORDER_ENROLLMENT_EVIDENCE_REQUIRED'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_worker_grant BEFORE UPDATE ON daechion_orders.grants FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_worker_grant();
CREATE FUNCTION daechion_orders.guard_ready_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind='READY_MESSAGE' AND (NOT daechion_orders.paid_eligible(NEW.order_id) OR
    NOT EXISTS(SELECT 1 FROM daechion_orders.orders WHERE id=NEW.order_id AND identity_state='PASSED' AND notification_state='PENDING') OR
    NOT EXISTS(SELECT 1 FROM daechion_orders.grants WHERE order_id=NEW.order_id) OR
    EXISTS(SELECT 1 FROM daechion_orders.grants WHERE order_id=NEW.order_id AND state NOT IN ('VERIFIED','MANUAL')))
    THEN RAISE EXCEPTION 'ORDER_CONTENT_NOT_READY'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_ready_job BEFORE INSERT ON daechion_orders.jobs FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_ready_job();
COMMIT;
