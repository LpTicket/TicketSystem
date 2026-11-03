-- Apply explicitly before enabling the notification administration page.
-- Existing notifications stay enabled; new sign-in emails start disabled.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';
CREATE TABLE IF NOT EXISTS "notification_settings" (
  "id" varchar PRIMARY KEY CHECK ("id" = 'global'),
  "preferences" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "version" integer NOT NULL DEFAULT 1,
  "updatedBy" uuid NULL,
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);
INSERT INTO "notification_settings" ("id") VALUES ('global') ON CONFLICT ("id") DO NOTHING;
COMMIT;
