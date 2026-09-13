-- Drops CommunicatorChat.hasError.
--
-- RUN THIS AFTER deploying the code change that removes the field from
-- schemas/CommunicatorChat.ts and the dual-write from
-- mutations/queryCommunicator.ts.
--
-- The order matters in one direction only. An extra column that the
-- application no longer knows about is harmless - it is NOT NULL with a
-- default, so inserts that omit it still succeed - but dropping it while the
-- previous release is still writing to it would fail every insert. Deploy
-- first, then run this.
--
-- Take a backup first. There is no migration history in this repository, so
-- there is no automatic way back, and unlike the backfill this statement is
-- destructive: the column and its contents are gone.

-- Preflight. Run these BEFORE the transaction below and read the results.
-- Nothing here changes anything.
--
-- 1. No row should still be at 'pending'. A pending row means the backfill in
--    sql/2026-09-12-communicator-chat-backfill.sql did not cover it, and its
--    outcome is about to be lost with the column.
--
--      SELECT count(*) FROM "CommunicatorChat" WHERE "status" = 'pending';
--      -- expect 0
--
-- 2. status and hasError should agree on every row. A disagreement means
--    something wrote one without the other, and the two sources need
--    reconciling before the older one is discarded.
--
--      SELECT "hasError", "status", count(*) FROM "CommunicatorChat"
--        GROUP BY 1, 2 ORDER BY 1, 2;
--      -- expect exactly two groups: ('true','failed') and ('false','succeeded')
--
-- As of 2026-09-12 that split was 12 failed and 26 succeeded. It will have
-- grown since; what matters is that no row appears in a mixed group.

BEGIN;

ALTER TABLE "CommunicatorChat" DROP COLUMN "hasError";

COMMIT;

-- Verification. The column is gone and the outcome is still recorded.
--
--   SELECT "status", count(*) FROM "CommunicatorChat" GROUP BY 1 ORDER BY 1;
