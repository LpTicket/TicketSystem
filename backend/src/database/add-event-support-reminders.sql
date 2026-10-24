-- Apply before deploying the backend with automatic support reminders.
-- No email is sent by this script. Existing reminder settings are unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';
ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "organizerSupportReminderForDate" timestamp NULL,
  ADD COLUMN IF NOT EXISTS "adminSupportReminderForDate" timestamp NULL;
COMMIT;
