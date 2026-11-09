BEGIN;
CREATE TABLE daechion_orders.scheduler_orders (
  order_id uuid PRIMARY KEY REFERENCES daechion_orders.orders(id),
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_version bigint NOT NULL DEFAULT 0 CHECK(last_version>=0),
  started_at timestamptz,
  finished_at timestamptz,
  result text CHECK(result IN ('OK','FAILED')),
  session_issue boolean NOT NULL DEFAULT false
);
CREATE TABLE daechion_orders.scheduler_sessions (
  tenant_id text PRIMARY KEY CHECK(length(tenant_id) BETWEEN 1 AND 120),
  state text NOT NULL CHECK(state IN ('UNKNOWN','READY','FAILED')),
  checked_at timestamptz NOT NULL,
  next_check_at timestamptz NOT NULL
);
CREATE INDEX scheduler_orders_due ON daechion_orders.scheduler_orders(next_run_at,order_id);
COMMIT;
