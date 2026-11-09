BEGIN;
ALTER TABLE daechion_orders.admin_actions DROP CONSTRAINT admin_actions_action_check;
ALTER TABLE daechion_orders.admin_actions
  ADD COLUMN recovery_evidence jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(recovery_evidence)='object'),
  ADD CONSTRAINT order_admin_recovery_actions CHECK(action IN ('HOLD','RETRY_ACCESS','APPROVE_EXISTING','RESUME_UNBILLED','RESUME_PAID','RECONCILE_SHEETS')),
  ADD CONSTRAINT order_admin_recovery_evidence CHECK(
    (action='RESUME_PAID' AND recovery_evidence ?& ARRAY['billId','amountWon','paidAt']) OR
    (action='RECONCILE_SHEETS' AND recovery_evidence ? 'jobId') OR
    (action NOT IN ('RESUME_PAID','RECONCILE_SHEETS') AND recovery_evidence='{}'::jsonb));
CREATE TABLE daechion_orders.sheet_recoveries (
  request_key uuid PRIMARY KEY REFERENCES daechion_orders.admin_actions(request_key) DEFERRABLE INITIALLY DEFERRED,
  order_id uuid NOT NULL REFERENCES daechion_orders.orders(id),
  job_id uuid NOT NULL REFERENCES daechion_orders.jobs(id),
  state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','RUNNING','DONE','UNKNOWN','FAILED')),
  lease_token uuid,
  lease_until timestamptz,
  result_code text CHECK(result_code ~ '^[a-z_]{1,64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((state='RUNNING')=(lease_token IS NOT NULL)),
  CHECK((lease_token IS NULL)=(lease_until IS NULL))
);
CREATE UNIQUE INDEX one_active_order_sheet_recovery ON daechion_orders.sheet_recoveries(order_id) WHERE state IN ('PENDING','RUNNING');
CREATE FUNCTION daechion_orders.guard_sheet_recovery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'ORDER_RECOVERY_CANNOT_DELETE'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'PENDING' OR NEW.lease_token IS NOT NULL OR NEW.result_code IS NOT NULL OR
      NOT EXISTS(SELECT 1 FROM daechion_orders.jobs j WHERE j.id=NEW.job_id AND j.order_id=NEW.order_id AND j.kind='SHEETS' AND j.state='UNKNOWN')
      THEN RAISE EXCEPTION 'ORDER_RECOVERY_TARGET_INVALID'; END IF;
    RETURN NEW;
  END IF;
  IF (NEW.request_key,NEW.order_id,NEW.job_id,NEW.created_at) IS DISTINCT FROM (OLD.request_key,OLD.order_id,OLD.job_id,OLD.created_at)
    THEN RAISE EXCEPTION 'ORDER_RECOVERY_TARGET_FROZEN'; END IF;
  IF NEW.state<>OLD.state AND NOT ((OLD.state='PENDING' AND NEW.state IN ('RUNNING','FAILED')) OR (OLD.state='RUNNING' AND NEW.state IN ('DONE','UNKNOWN','FAILED')))
    THEN RAISE EXCEPTION 'ORDER_RECOVERY_CANNOT_REPLAY'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_sheet_recovery BEFORE INSERT OR UPDATE OR DELETE ON daechion_orders.sheet_recoveries FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_sheet_recovery();
CREATE FUNCTION daechion_orders.guard_sheet_recovery_commit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM daechion_orders.admin_actions a WHERE a.request_key=NEW.request_key AND a.order_id=NEW.order_id
    AND a.action='RECONCILE_SHEETS' AND a.recovery_evidence->>'jobId'=NEW.job_id::text)
    THEN RAISE EXCEPTION 'ORDER_RECOVERY_APPROVAL_MISMATCH'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER guard_sheet_recovery_commit AFTER INSERT ON daechion_orders.sheet_recoveries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_sheet_recovery_commit();
COMMIT;
