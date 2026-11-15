BEGIN;
-- Default to uncertainty for historical jobs and older workers. Only a worker
-- holding a fresh lease-bound read token may prove that it has not sent a write.
ALTER TABLE daechion_orders.jobs
  ADD COLUMN sheet_write_started boolean NOT NULL DEFAULT true,
  ADD COLUMN sheet_read_token uuid,
  ADD COLUMN sheet_read_attempts integer NOT NULL DEFAULT 0 CHECK(sheet_read_attempts>=0);

-- The old worker persisted this code only when no mutating request was sent.
-- A missing marker or generic UNKNOWN error is never proof of a failed read.
UPDATE daechion_orders.jobs SET sheet_write_started=false,
  sheet_read_attempts=attempts
  WHERE kind='SHEETS' AND state IN ('PENDING','UNKNOWN') AND last_error='sheet_read_retry';
UPDATE daechion_orders.jobs j SET state='PENDING',available_at=now()
  WHERE kind='SHEETS' AND state='UNKNOWN' AND NOT sheet_write_started
    AND NOT EXISTS(SELECT 1 FROM daechion_orders.sheet_recoveries r
      WHERE r.order_id=j.order_id AND r.state IN ('PENDING','RUNNING'));

CREATE FUNCTION daechion_orders.guard_sheet_write_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE trusted_claim boolean;
BEGIN
  IF NEW.kind<>'SHEETS' THEN RETURN NEW; END IF;
  trusted_claim := NEW.state='RUNNING' AND
    (OLD.state<>'RUNNING' OR NEW.lease_token IS DISTINCT FROM OLD.lease_token) AND
    NEW.sheet_read_token=NEW.lease_token AND NEW.sheet_read_token IS DISTINCT FROM OLD.sheet_read_token;
  IF NEW.state='RUNNING' AND (OLD.state<>'RUNNING' OR NEW.lease_token IS DISTINCT FROM OLD.lease_token)
    AND NOT COALESCE(trusted_claim,false) THEN
    -- An old worker does not write our read token. Its writes may already have
    -- been sent if it disappears, including when taking over a safe retry.
    NEW.sheet_write_started := true;
  END IF;
  IF OLD.sheet_write_started AND NOT NEW.sheet_write_started AND
    NOT (COALESCE(trusted_claim,false) AND
      (OLD.last_error='sheet_read_retry' OR OLD.state='PENDING' AND OLD.attempts=0))
    THEN RAISE EXCEPTION 'ORDER_SHEET_WRITE_EVIDENCE_FROZEN'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_sheet_write_evidence BEFORE UPDATE ON daechion_orders.jobs
  FOR EACH ROW EXECUTE FUNCTION daechion_orders.guard_sheet_write_evidence();
COMMIT;
