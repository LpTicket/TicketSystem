-- Apply with explicit authorization BEFORE deploying the backend changes.
-- No existing order, ticket, payment, or payout is removed or rewritten.
-- After deployment, synchronize historical disputes from the administrative page.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "stripeDisputes" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "organizerDisputeAdjustment" numeric(10,2) NOT NULL DEFAULT 0;
COMMIT;
