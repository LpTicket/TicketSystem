-- Apply before deploying the backend with Event.klarnaEnabled.
-- Existing events keep their current Klarna availability; no sales data changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';
ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "klarnaEnabled" boolean NOT NULL DEFAULT true;
COMMIT;
