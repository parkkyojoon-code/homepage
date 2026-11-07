BEGIN;

-- New order ledger only. Not registered with the live V1 migration runner.
CREATE SCHEMA daechion_orders;
CREATE TABLE daechion_orders.quotes (
  id uuid PRIMARY KEY,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  cart_fingerprint text NOT NULL CHECK (cart_fingerprint ~ '^[a-f0-9]{64}$'),
  subject_key text NOT NULL CHECK (subject_key ~ '^[a-f0-9]{64}$'),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
  total_won integer NOT NULL CHECK (total_won>0),
  state text NOT NULL CHECK (state IN ('READY','REVIEW','CONSUMED','EXPIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at=created_at+interval '10 minutes')
);
CREATE TABLE daechion_orders.orders (
  id uuid PRIMARY KEY,
  quote_id uuid NOT NULL UNIQUE REFERENCES daechion_orders.quotes(id),
  request_key uuid NOT NULL UNIQUE,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  cart_fingerprint text NOT NULL CHECK (cart_fingerprint ~ '^[a-f0-9]{64}$'),
  subject_key text NOT NULL CHECK (subject_key ~ '^[a-f0-9]{64}$'),
  tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 120),
  student_phone text NOT NULL CHECK (student_phone ~ '^01[0-9]{9}$'),
  contact_snapshot jsonb NOT NULL CHECK (jsonb_typeof(contact_snapshot)='object'),
  total_won integer NOT NULL CHECK (total_won>0),
  checkout_state text NOT NULL DEFAULT 'DRAFT' CHECK (checkout_state IN ('DRAFT','READY','REVIEW','CLOSED')),
  payment_state text NOT NULL DEFAULT 'PENDING' CHECK (payment_state IN ('PENDING','PAID','CANCELLED','UNKNOWN')),
  notification_state text NOT NULL DEFAULT 'NOT_READY' CHECK (notification_state IN ('NOT_READY','PENDING','SENT','UNKNOWN','FAILED')),
  student_id bigint CHECK (student_id>0),
  identity_state text NOT NULL DEFAULT 'WAITING' CHECK (identity_state IN ('WAITING','PASSED','REVIEW')),
  version bigint NOT NULL DEFAULT 1 CHECK (version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  UNIQUE(id,total_won),
  CHECK (identity_state<>'PASSED' OR student_id IS NOT NULL)
);
CREATE TABLE daechion_orders.items (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES daechion_orders.orders(id),
  product_id text NOT NULL CHECK (length(product_id)>0 AND product_id NOT IN ('12course','chuweol')),
  sale_kind text NOT NULL CHECK (sale_kind IN ('SINGLE','BUNDLE')),
  title text NOT NULL CHECK (length(title)>0),
  price_won integer NOT NULL CHECK (price_won>0),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object' AND jsonb_typeof(snapshot->'lectures')='array' AND snapshot ? 'lectures'),
  UNIQUE(order_id,product_id), UNIQUE(id,order_id)
);
CREATE TABLE daechion_orders.grants (
  order_id uuid NOT NULL,
  item_id uuid NOT NULL,
  lecture_id bigint NOT NULL CHECK (lecture_id>0),
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','RUNNING','REVIEW','VERIFIED','MANUAL')),
  lease_token uuid,
  lease_until timestamptz,
  verified_at timestamptz,
  PRIMARY KEY(order_id,lecture_id),
  FOREIGN KEY(item_id,order_id) REFERENCES daechion_orders.items(id,order_id),
  CHECK ((lease_token IS NULL)=(lease_until IS NULL)),
  CHECK (state<>'RUNNING' OR lease_token IS NOT NULL),
  CHECK (state NOT IN ('VERIFIED','MANUAL') OR verified_at IS NOT NULL)
);
CREATE TABLE daechion_orders.bills (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  amount_won integer NOT NULL,
  provider_account text NOT NULL CHECK (length(provider_account)>0),
  bill_id text NOT NULL CHECK (bill_id ~ '^[0-9]{20}$'),
  revision integer NOT NULL CHECK (revision>0),
  is_current boolean NOT NULL DEFAULT true,
  state text NOT NULL DEFAULT 'RESERVED' CHECK (state IN ('RESERVED','SEND_UNKNOWN','SENT','CANCELLED','DESTROYED')),
  last_payment_state text CHECK (last_payment_state IN ('PENDING','PAID','CANCELLED','UNKNOWN')),
  sent_at timestamptz,
  due_at timestamptz,
  FOREIGN KEY(order_id,amount_won) REFERENCES daechion_orders.orders(id,total_won),
  UNIQUE(provider_account,bill_id), UNIQUE(order_id,revision),
  CHECK ((sent_at IS NULL)=(due_at IS NULL)),
  CHECK (sent_at IS NULL OR due_at=sent_at+interval '7 days'),
  CHECK (state<>'SENT' OR sent_at IS NOT NULL)
);
CREATE UNIQUE INDEX one_current_order_bill ON daechion_orders.bills(order_id) WHERE is_current;
CREATE TABLE daechion_orders.phone_claims (
  phone text PRIMARY KEY CHECK (phone ~ '^01[0-9]{9}$'),
  order_id uuid NOT NULL REFERENCES daechion_orders.orders(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE daechion_orders.jobs (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES daechion_orders.orders(id),
  kind text NOT NULL CHECK (kind IN ('SHEETS','READY_MESSAGE')),
  event_version bigint NOT NULL CHECK (event_version>0),
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','RUNNING','DONE','UNKNOWN','FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts>=0),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  UNIQUE(order_id,kind,event_version),
  CHECK ((lease_token IS NULL)=(lease_until IS NULL)),
  CHECK (state<>'RUNNING' OR lease_token IS NOT NULL)
);
CREATE TABLE daechion_orders.events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES daechion_orders.orders(id),
  kind text NOT NULL CHECK (kind ~ '^[a-z_]{1,64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Assemble all rows in one transaction, then set READY. No empty, incomplete,
-- double-target or mismatched-sum order may become billable.
CREATE FUNCTION daechion_orders.guard_order() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE q daechion_orders.quotes; item record;
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
    IF q.state NOT IN ('READY','CONSUMED') OR (q.state='CONSUMED' AND OLD.confirmed_at IS NULL) OR
      (q.state='READY' AND q.expires_at<=now()) OR q.total_won<>NEW.total_won OR q.cart_fingerprint<>NEW.cart_fingerprint OR q.subject_key<>NEW.subject_key OR
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
CREATE TRIGGER guard_order BEFORE INSERT OR UPDATE ON daechion_orders.orders FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_order();

CREATE FUNCTION daechion_orders.guard_components() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE oid uuid;
BEGIN
  oid=CASE WHEN TG_OP='DELETE' THEN OLD.order_id ELSE NEW.order_id END;
  IF TG_TABLE_NAME='grants' AND TG_OP='INSERT' THEN
    IF NEW.state<>'PENDING' OR NEW.lease_token IS NOT NULL OR NEW.verified_at IS NOT NULL THEN RAISE EXCEPTION 'ORDER_GRANT_MUST_START_PENDING'; END IF;
  END IF;
  IF TG_OP='UPDATE' AND NEW.order_id<>OLD.order_id THEN RAISE EXCEPTION 'ORDER_COMPONENT_CANNOT_MOVE'; END IF;
  PERFORM id FROM daechion_orders.orders WHERE id=oid AND checkout_state='DRAFT' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_COMPONENTS_FROZEN'; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER guard_items BEFORE INSERT OR UPDATE OR DELETE ON daechion_orders.items FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_components();
CREATE TRIGGER guard_grant_targets BEFORE INSERT OR DELETE OR UPDATE OF order_id,item_id,lecture_id ON daechion_orders.grants FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_components();

CREATE FUNCTION daechion_orders.guard_bill() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF (NEW.order_id,NEW.amount_won,NEW.provider_account,NEW.bill_id,NEW.revision) IS DISTINCT FROM (OLD.order_id,OLD.amount_won,OLD.provider_account,OLD.bill_id,OLD.revision)
      THEN RAISE EXCEPTION 'ORDER_BILL_IDENTITY_FROZEN'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.state<>'RESERVED' OR NEW.last_payment_state IS NOT NULL OR NEW.sent_at IS NOT NULL THEN RAISE EXCEPTION 'ORDER_BILL_MUST_START_RESERVED'; END IF;
  PERFORM id FROM daechion_orders.orders WHERE id=NEW.order_id AND checkout_state='READY' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_BILLABLE'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_bill BEFORE INSERT OR UPDATE ON daechion_orders.bills FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_bill();

CREATE FUNCTION daechion_orders.guard_grant_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state IN ('RUNNING','VERIFIED','MANUAL') AND NEW.state IS DISTINCT FROM OLD.state AND NOT EXISTS(
    SELECT 1 FROM daechion_orders.orders o JOIN daechion_orders.bills b ON b.order_id=o.id AND b.is_current
    WHERE o.id=NEW.order_id AND o.checkout_state='READY' AND o.payment_state='PAID' AND o.identity_state='PASSED'
      AND b.state='SENT' AND b.last_payment_state='PAID') THEN RAISE EXCEPTION 'ORDER_PAID_IDENTITY_REQUIRED'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_grant_state BEFORE UPDATE OF state ON daechion_orders.grants FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_grant_state();

CREATE FUNCTION daechion_orders.guard_quote() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id,NEW.token_hash,NEW.cart_fingerprint,NEW.subject_key,NEW.snapshot,NEW.total_won,NEW.created_at,NEW.expires_at)
    IS DISTINCT FROM (OLD.id,OLD.token_hash,OLD.cart_fingerprint,OLD.subject_key,OLD.snapshot,OLD.total_won,OLD.created_at,OLD.expires_at)
    THEN RAISE EXCEPTION 'ORDER_QUOTE_SNAPSHOT_FROZEN'; END IF;
  IF NEW.state<>OLD.state AND NOT ((OLD.state='READY' AND NEW.state IN ('CONSUMED','REVIEW','EXPIRED')) OR (OLD.state='REVIEW' AND NEW.state='EXPIRED'))
    THEN RAISE EXCEPTION 'ORDER_QUOTE_TRANSITION_INVALID'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_quote BEFORE UPDATE ON daechion_orders.quotes FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_quote();

COMMIT;
