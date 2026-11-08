BEGIN;
CREATE TABLE daechion_orders.admin_actions (
  request_key uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES daechion_orders.orders(id),
  fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
  action text NOT NULL CHECK(action IN ('HOLD','RETRY_ACCESS')),
  lecture_id bigint,
  operator_name text NOT NULL CHECK(length(operator_name) BETWEEN 1 AND 80),
  reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 1000),
  before_version bigint NOT NULL CHECK(before_version>0),
  after_version bigint NOT NULL CHECK(after_version=before_version+1),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(order_id,lecture_id) REFERENCES daechion_orders.grants(order_id,lecture_id),
  CHECK((action='HOLD' AND lecture_id IS NULL) OR (action='RETRY_ACCESS' AND lecture_id IS NOT NULL))
);
CREATE INDEX order_admin_action_history ON daechion_orders.admin_actions(order_id,created_at,request_key);
CREATE FUNCTION daechion_orders.guard_admin_action() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ORDER_ADMIN_HISTORY_IMMUTABLE';
END $$;
CREATE TRIGGER guard_admin_action BEFORE UPDATE OR DELETE ON daechion_orders.admin_actions FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_admin_action();
COMMIT;
