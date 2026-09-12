-- Backfill for the CommunicatorChat status/permission rework.
--
-- RUN THIS AFTER deploying the schema change that adds CommunicatorChat.status
-- and User.canManageCommunicator, and BEFORE any change that drops
-- CommunicatorChat.hasError.
--
-- Both statements are idempotent; running them twice is harmless.
--
-- Take a backup first. There is no migration history in this repository, so
-- there is no automatic way back.

BEGIN;

-- 1. Derive the new status column from the old hasError text column.
--    hasError held the strings 'true' / 'false'. Every existing row is one or
--    the other, so nothing should be left as 'pending' afterwards.
UPDATE "CommunicatorChat"
SET "status" = CASE
  WHEN "hasError" = 'true' THEN 'failed'
  ELSE 'succeeded'
END
WHERE "status" = 'pending';

-- 2. Chat administration used to be granted by canManagePbis. Carry the
--    existing administrators across so nobody loses access on deploy. Review
--    the result: this is the moment to decide who should actually keep it,
--    since the two capabilities are now independent.
UPDATE "User"
SET "canManageCommunicator" = true
WHERE "canManagePbis" = true
  AND "canManageCommunicator" = false;

COMMIT;

-- Verification. Expect no 'pending' rows, and a status split matching the old
-- hasError split (as of 2026-09-12: 12 failed, 26 succeeded).
--
--   SELECT "status", count(*) FROM "CommunicatorChat" GROUP BY 1 ORDER BY 1;
--   SELECT "hasError", "status", count(*) FROM "CommunicatorChat"
--     GROUP BY 1, 2 ORDER BY 1, 2;
--   SELECT count(*) FROM "User" WHERE "canManageCommunicator";
--
-- Once this has run and been verified, CommunicatorChat.hasError can be
-- removed from schemas/CommunicatorChat.ts in a follow-up change.
