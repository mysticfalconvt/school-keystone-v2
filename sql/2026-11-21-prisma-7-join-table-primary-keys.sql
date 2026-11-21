-- Prisma 7 (via Keystone 8): implicit many-to-many join tables use a primary
-- key on ("A", "B") instead of a unique index on the same columns.
--
-- Generated with:
--   npx prisma migrate diff --from-config-datasource --to-schema schema.prisma --script
-- and that diff contained nothing else.
--
-- Safe on existing data: the unique index being replaced already guarantees
-- there are no duplicate ("A", "B") pairs, and both columns are NOT NULL. No
-- rows change. Apply before (or right after) deploying the Keystone 8 build:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f sql/2026-11-21-prisma-7-join-table-primary-keys.sql
--
-- Afterwards the same `prisma migrate diff` command should print an empty
-- migration.

BEGIN;

-- AlterTable
ALTER TABLE "_CallbackRewardRun_eligibleStudents" ADD CONSTRAINT "_CallbackRewardRun_eligibleStudents_AB_pkey" PRIMARY KEY ("A", "B");
-- DropIndex
DROP INDEX "_CallbackRewardRun_eligibleStudents_AB_unique";

-- AlterTable
ALTER TABLE "_CallbackRewardRun_ineligibleStudents" ADD CONSTRAINT "_CallbackRewardRun_ineligibleStudents_AB_pkey" PRIMARY KEY ("A", "B");
-- DropIndex
DROP INDEX "_CallbackRewardRun_ineligibleStudents_AB_unique";

-- AlterTable
ALTER TABLE "_PbisCollectionDate_personalLevelWinners" ADD CONSTRAINT "_PbisCollectionDate_personalLevelWinners_AB_pkey" PRIMARY KEY ("A", "B");
-- DropIndex
DROP INDEX "_PbisCollectionDate_personalLevelWinners_AB_unique";

-- AlterTable
ALTER TABLE "_PbisCollectionDate_staffRandomWinners" ADD CONSTRAINT "_PbisCollectionDate_staffRandomWinners_AB_pkey" PRIMARY KEY ("A", "B");
-- DropIndex
DROP INDEX "_PbisCollectionDate_staffRandomWinners_AB_unique";

-- AlterTable
ALTER TABLE "_PbisCollectionDate_taNewLevelWinners" ADD CONSTRAINT "_PbisCollectionDate_taNewLevelWinners_AB_pkey" PRIMARY KEY ("A", "B");
-- DropIndex
DROP INDEX "_PbisCollectionDate_taNewLevelWinners_AB_unique";

-- AlterTable
ALTER TABLE "_User_children" ADD CONSTRAINT "_User_children_AB_pkey" PRIMARY KEY ("A", "B");
-- DropIndex
DROP INDEX "_User_children_AB_unique";

-- AlterTable
ALTER TABLE "_User_coTeachesWithTeacher" ADD CONSTRAINT "_User_coTeachesWithTeacher_AB_pkey" PRIMARY KEY ("A", "B");
-- DropIndex
DROP INDEX "_User_coTeachesWithTeacher_AB_unique";

-- AlterTable
ALTER TABLE "_User_specialGroupStudents" ADD CONSTRAINT "_User_specialGroupStudents_AB_pkey" PRIMARY KEY ("A", "B");
-- DropIndex
DROP INDEX "_User_specialGroupStudents_AB_unique";

COMMIT;
