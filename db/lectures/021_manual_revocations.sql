-- Apply after 020_manual_confirmations.sql. This records approval corrections, not refunds.
BEGIN;
CREATE TABLE lecture_manual_revocations (
 order_id uuid PRIMARY KEY REFERENCES lecture_manual_confirmations(order_id),
 operator_name text NOT NULL CHECK (length(trim(operator_name)) BETWEEN 1 AND 50),
 note text NOT NULL CHECK (length(trim(note)) BETWEEN 5 AND 500),
 revoked_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
