-- Passwords are removed (sign-in is magic link or Google only). Step 1 of 2.
--
-- The new code creates users without a password, so the column must accept
-- NULL before it deploys. The currently deployed code still reads and writes
-- the column and is unaffected by this change. No rows change.
--
-- Apply BEFORE deploying the build that removes passwords:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f sql/2026-11-22-remove-passwords-1-before-deploy.sql
--
-- Then deploy, then apply step 2.

BEGIN;

ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;

COMMIT;
