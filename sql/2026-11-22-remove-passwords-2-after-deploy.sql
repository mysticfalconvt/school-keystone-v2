-- Passwords are removed (sign-in is magic link or Google only). Step 2 of 2.
--
-- Drops the password hashes and the password-reset token columns. Nothing in
-- the new code reads them. Do NOT run this before the new build is live: the
-- previous build still selects these columns and would fail.
--
-- Apply AFTER the build that removes passwords is deployed:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f sql/2026-11-22-remove-passwords-2-after-deploy.sql
--
-- Afterwards
--   npx prisma migrate diff --from-config-datasource --to-schema schema.prisma --script
-- should print an empty migration.

BEGIN;

ALTER TABLE "User"
  DROP COLUMN "password",
  DROP COLUMN "passwordResetToken",
  DROP COLUMN "passwordResetIssuedAt",
  DROP COLUMN "passwordResetRedeemedAt";

COMMIT;
