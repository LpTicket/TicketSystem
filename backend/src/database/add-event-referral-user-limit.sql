-- Apply before deploying the backend that reads EventReferral.maxTicketsPerUser.
-- Existing code quotas and previously issued tickets are preserved.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "event_referrals"
  ADD COLUMN IF NOT EXISTS maxticketsperuser integer NOT NULL DEFAULT 1
  CHECK (maxticketsperuser BETWEEN 1 AND 1000000);
COMMIT;
