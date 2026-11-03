-- Apply after 001_initial.sql. 010-019 remain reserved for the DB collaborator.
BEGIN;
CREATE TABLE lecture_manual_confirmations (
 order_id uuid PRIMARY KEY REFERENCES lecture_orders(id),
 amount_won integer NOT NULL CHECK (amount_won > 0),
 operator_name text NOT NULL CHECK (length(trim(operator_name)) BETWEEN 1 AND 50),
 note text NOT NULL CHECK (length(trim(note)) BETWEEN 5 AND 500),
 confirmed_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
