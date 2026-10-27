-- Apply explicitly before deploying the backend with Event.minTicketsPerTransaction.
-- Existing events retain a one-ticket minimum. No orders, tickets or payments change.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';
ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "minTicketsPerTransaction" integer NOT NULL DEFAULT 1
  CHECK ("minTicketsPerTransaction" >= 1 AND "minTicketsPerTransaction" <= "maxTicketsPerTransaction");
COMMIT;
