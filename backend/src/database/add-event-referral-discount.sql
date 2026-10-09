-- Existing codes retain their attribution-only behavior (0% discount).
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "event_referrals"
  ADD COLUMN IF NOT EXISTS "discountPercent" integer NOT NULL DEFAULT 0
  CHECK ("discountPercent" BETWEEN 0 AND 100);
COMMIT;
