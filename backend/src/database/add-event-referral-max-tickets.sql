-- Apply before deploying the backend that reads EventReferral.maxTickets.
-- NULL keeps every existing referral unlimited.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "event_referrals"
  ADD COLUMN IF NOT EXISTS maxtickets integer;
COMMIT;
