BEGIN;
ALTER TABLE daechion_orders.jobs ADD COLUMN last_error text CHECK(last_error ~ '^[a-z_]{1,64}$');
CREATE TABLE daechion_orders.ready_receipts (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES daechion_orders.orders(id),
  phone text NOT NULL CHECK(phone ~ '^01[0-9]{9}$'),
  text_snapshot text NOT NULL CHECK(length(text_snapshot)>0 AND octet_length(text_snapshot)<=2000),
  state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','UNKNOWN','SENT','BLOCKED')),
  provider_message_id text CHECK(length(provider_message_id) BETWEEN 1 AND 120),
  accepted_at timestamptz,
  UNIQUE(order_id,phone),
  CHECK(state<>'SENT' OR (provider_message_id IS NOT NULL AND accepted_at IS NOT NULL))
);
CREATE FUNCTION daechion_orders.guard_ready_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'PENDING' OR NEW.provider_message_id IS NOT NULL OR NEW.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'ORDER_RECEIPT_MUST_START_PENDING'; END IF;
    RETURN NEW;
  END IF;
  IF (NEW.id,NEW.order_id,NEW.phone,NEW.text_snapshot) IS DISTINCT FROM (OLD.id,OLD.order_id,OLD.phone,OLD.text_snapshot)
    THEN RAISE EXCEPTION 'ORDER_RECEIPT_SNAPSHOT_FROZEN'; END IF;
  IF NEW.state<>OLD.state AND NOT ((OLD.state='PENDING' AND NEW.state IN ('UNKNOWN','BLOCKED')) OR (OLD.state='UNKNOWN' AND NEW.state='SENT'))
    THEN RAISE EXCEPTION 'ORDER_RECEIPT_CANNOT_RESEND'; END IF;
  IF OLD.state='SENT' AND (NEW.provider_message_id,NEW.accepted_at) IS DISTINCT FROM (OLD.provider_message_id,OLD.accepted_at)
    THEN RAISE EXCEPTION 'ORDER_RECEIPT_ACCEPTANCE_FROZEN'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_ready_receipt BEFORE INSERT OR UPDATE ON daechion_orders.ready_receipts FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_ready_receipt();
COMMIT;
