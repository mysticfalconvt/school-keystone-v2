# Data Model Cleanup Plan

## Purpose

Reduce obsolete and overlapping data-model surface area before expanding the Communicator. A smaller, better-defined schema will make generated queries more reliable, reduce the amount of sensitive data exposed to the model, and make access rules easier to reason about.

This is an investigation and execution plan only. Nothing identified below should be deleted solely because it has no source reference. This Keystone app has external GraphQL consumers, and the repository does not contain a migration history, so production data and request usage must be checked first.

The companion plan, [COMMUNICATOR_BACKEND_MIGRATION_PLAN.md](./COMMUNICATOR_BACKEND_MIGRATION_PLAN.md), covers moving the Communicator pipeline out of `../SchoolDashboard` and into this service.

## Repositories Reviewed

- Backend: `school-keystone-v2`
- Frontend and current Communicator service: `../SchoolDashboard`
- Generated contracts reviewed: `schema.graphql` and `schema.prisma`

## Summary Of Candidates

| Candidate | Confidence | Recommendation | Why it matters |
| --- | --- | --- | --- |
| Legacy `PbisCollection` list | High, pending data verification | Migrate any unique history, then retire | Overlaps the active relational `PbisCollectionDate` model and enlarges the GraphQL schema |
| Old weekly PBIS frontend implementations | High | Remove after one release of usage verification | They target legacy or invalid GraphQL contracts |
| `ChromebookAssignment` feature remnants | High that it is nonfunctional; intent unknown | Decide whether to retire or rebuild | Backend is ID-only while disabled frontend code expects removed fields |
| Detached `SchoolPbisInfo` schema file | High | Retire source after checking for an orphaned production table | It is not registered and duplicates `PbisTeam`-like aggregate fields |
| Starter `schema.ts` and starter README content | High | Remove/replace as repository cleanup | They describe an unused blog schema and SQLite setup |
| Stored PBIS and callback aggregate fields on `User`/`PbisTeam` | Medium | Audit one field at a time; prefer one canonical source | Some are active UI inputs, some are aliases, and some may be stale caches |
| PBIS winner representation | Medium | Normalize only after history/requirements review | Winner state is split across self-relations, collection relations, and `RandomDrawingWin` |
| `CommunicatorChat` field types and duplication | High | Migrate the model rather than dropping it | String Boolean, duplicate timestamps, broad raw data, and permission mismatch complicate the endpoint |
| Generated/conflict artifacts | High for conflict file; deployment-dependent for generated files | Define generation policy, then prune | Generated copies can be mistaken for authoritative source |

## 1. Consolidate PBIS Collection History

### Evidence

Two active Keystone lists represent weekly collection history:

- `schemas/PbisCollection.ts` stores winners and team snapshots in text fields such as `personalLevelWinners`, `randomDrawingWinners`, `taTeamsLevels`, and `taTeamNewLevelWinners`.
- `schemas/PbisCollectionDate.ts` stores winners as relationships to `User` and `RandomDrawingWin`.
- Both are registered in `keystone.ts` and therefore both produce database tables and public GraphQL operations.
- The active collection UI imports `useV3PbisCollection` from `../SchoolDashboard/components/PBIS/NewWeeklyPbisCollection.tsx`.
- `useV3PbisCollection.ts` reads, creates, and updates `pbisCollectionDates`.
- The current PBIS dashboard and weekly-reading page query `pbisCollectionDates` in `../SchoolDashboard/pages/pbis.tsx` and `../SchoolDashboard/pages/PbisWeeklyReading.tsx`.
- No active frontend import of `WeeklyPbisCollection.tsx`, `useNewPbisCollection.ts`, or `useCreateCollectionMutation.ts` was found.

### Important difference to preserve

`PbisCollection` is not a byte-for-byte duplicate. It can contain historical values with no direct field on `PbisCollectionDate`:

- `name`
- `taTeamsLevels`
- `currentPbisTeamGoal`
- `dateModified`

Current `PbisTeam` values are not a safe substitute for old team-level snapshots. Do not drop the legacy table until these fields have been profiled and either migrated or intentionally archived.

### Proposed target

Use one collection-run entity as the authoritative historical record. `PbisCollectionDate` is the practical starting point because it is the model used by the active frontend, but consider renaming it to `PbisCollectionRun` in a later, separate migration. The current name describes only a date even though the entity represents an event with winners, totals, and an editor.

Recommended target fields:

- `collectedAt`: required timestamp, indexed
- `cardsCollected`: integer rather than text
- `personalLevelWinners`: user relationship
- `taNewLevelWinners`: user relationship
- `staffRandomWinners`: user relationship
- `studentRandomWinners`: either a direct user relationship or an explicit win entity if win-specific metadata is needed
- `teamLevelSnapshots`: structured child records or JSON only if historical team state is actually used
- `schoolGoal`: integer only if it is historical information the UI needs
- `createdBy` or `lastModifiedBy`: required user relationship where feasible
- `createdAt` and optionally `updatedAt`: clear audit semantics

### Verification queries/checks before migration

Run read-only production checks and save the results with the eventual migration ticket:

1. Count rows in `PbisCollection`, `PbisCollectionDate`, and `RandomDrawingWin`.
2. Compare minimum/maximum dates and group records by calendar day to identify matching runs.
3. Count blank versus nonblank values for every legacy text field.
4. Parse samples and then all values from the legacy winner/team fields to establish whether they are JSON, names, IDs, or display text.
5. Compare legacy and new records on matching dates for winner and card-count completeness.
6. Search GraphQL request logs for `pbisCollections`, `createPbisCollection`, `updatePbisCollection`, and `deletePbisCollection` over a representative period.
7. Search any other deployed clients or scripts, not just `SchoolDashboard`.
8. Back up/export the legacy records before applying a destructive database migration.

### Phased removal

1. Mark `PbisCollection` as deprecated in code/documentation and stop granting new write access.
2. Remove or quarantine the unused frontend implementations that write it: `WeeklyPbisCollection.tsx`, `usePbisCollection.ts`, `useNewPbisCollection.ts`, and `useCreateCollectionMutation.ts` under `../SchoolDashboard/components/PBIS/`.
3. Migrate unique historical values into the target model or an archive table.
4. Run the active PBIS collection, PBIS page, and weekly-reading tests against the migrated data.
5. Remove the list registration and regenerate `schema.graphql`/`schema.prisma`.
6. Deploy without dropping the database table first if a reversible two-step rollout is preferred.
7. Drop/archive the old table only after production observation confirms no callers remain.

## 2. Resolve Chromebook Assignment Remnants

### Evidence

- `schemas/ChromebookAssignment.ts` has no active fields.
- Its Admin UI configuration still names `number`, `student`, and `checkLog`, which do not exist.
- The resulting Prisma model contains only `id`.
- `../SchoolDashboard/components/Chromebooks/CreateChromebookAssignments.tsx` queries `student`, `teacher`, and `number` and attempts to create records with `teacher` and `number`.
- That component is commented out in `../SchoolDashboard/pages/superUserSettings.tsx` and has no active caller.

### Decision needed

Choose one path before touching data:

- Retire the abandoned assignment feature, its disabled frontend component, and the ID-only list.
- Rebuild it with an explicit device/assignment/check data model and tests.

Do not restore the commented fields without reviewing relationship direction. The old comments refer to `ChromebookCheck.assignment`, while the active `ChromebookCheck` model now relates checks to a `student` and a `classroom` user.

### Proof gate

Check the production row count and API logs for `chromebookAssignments`. If rows exist, confirm whether IDs have any out-of-band meaning before archiving the table.

## 3. Retire Detached Starter And Duplicate Schema Files

### `SchoolPbisInfo`

- `schemas/SchoolPbisInfo.ts` is not imported or registered; its import is commented out in `keystone.ts`.
- Its aggregate fields substantially overlap fields on `PbisTeam`.
- It does not appear in the generated GraphQL or Prisma schema.

Action: check PostgreSQL for an old `SchoolPbisInfo` table and inspect its contents. If there is no data that needs migration, remove the detached source file and later remove/archive the old table through an explicit migration.

### Starter `schema.ts`

- Root `schema.ts` defines the untouched Keystone starter `User`/`Post`/`Tag` blog model.
- Runtime lists are assembled directly in `keystone.ts`; `schema.ts` is not imported.
- It references generated `.keystone/types` that are not the source of the active model.

Action: remove it after confirming no local tooling imports it. This is source cleanup only and should not produce a database migration.

### README and local SQLite artifact

- `README.md` still says the project uses SQLite and the default port 3000.
- `keystone.ts` uses PostgreSQL and defaults to port 4000.
- `keystone.db` is ignored and appears to be a starter/local artifact rather than the configured application database.

Action: replace the starter README with actual development, schema-generation, migration, environment-variable, and deployment instructions. Confirm the ignored SQLite file has no needed local data before manually discarding it.

## 4. Audit Denormalized User And PBIS Fields

These fields should not be removed as a group. Several are still read or written by active frontend paths.

### PBIS fields to inventory

`schemas/User.ts` contains:

- `individualPbisLevel`
- `taTeamPbisLevel`
- `taTeamAveragePbisCardsPerStudent`
- `PbisCardCount`
- `YearPbisCount`
- `taPbisCardCount`
- `currentTaWinner` / `previousTaWinner` and inverse self-relations

`schemas/PbisTeam.ts` separately contains:

- `uncountedCards`
- `countedCards`
- `currentLevel`
- `numberOfStudents`
- `averageCardsPerStudent`

### Current-use warning

- The active collection flow updates `individualPbisLevel`, `taTeamPbisLevel`, and `taTeamAveragePbisCardsPerStudent`.
- Several dashboard pages display those stored values.
- Some frontend queries use aliases such as `YearPbisCount: studentPbisCardsCount`, which can obscure whether the stored `YearPbisCount` field is being read.
- The Communicator prompt currently treats some count fields as canonical even though relationship counts may be more trustworthy.

### Audit method

For each field independently:

1. Identify all readers and writers across frontend, backend, scripts, and scheduled jobs.
2. Compare stored values to a recomputed value from source relationships.
3. Define whether the value is current state, lifetime total, school-year total, or since-last-collection total.
4. Define the school-year boundary and collection boundary centrally.
5. Decide whether the field is authoritative, a cache, or a presentation alias.
6. If it is a cache, move updates behind one backend service and add reconciliation tests/metrics.
7. If it is unused or consistently derivable at acceptable cost, deprecate and remove it through a field migration.

Do not optimize the Communicator around ambiguous names. Give the model a curated field with documented semantics, or expose a backend resolver such as a clearly named count for the required date range.

## 5. Simplify Winner Modeling

Winner information currently exists in multiple forms:

- Legacy serialized winner fields on `PbisCollection`
- User relationships on `PbisCollectionDate`
- `RandomDrawingWin` join records for student random winners
- `currentTaWinner` and `previousTaWinner` self-relations on `User`

`RandomDrawingWin` currently has only `student`, `collectionDate`, and `lastModifiedBy`. If no per-win metadata or independent lifecycle is needed, a direct many-to-many user relationship would match the other winner fields and shrink the schema. If award auditing is important, keep the entity and add explicit fields such as winner type, draw position, eligibility basis, and creation time.

The `currentTaWinner`/`previousTaWinner` relations appear in older collection code and some current display queries. Determine whether current pages still require them or whether collection history is the canonical record before removing them.

## 6. Repair The Communicator Chat Model

This model is active and should be migrated, not simply pruned.

### Current issues

Most of this section is now done. Remaining work is called out at the end.

- ~~`hasError` is text containing `'true'` or `'false'`~~ — replaced by `status` (`pending` / `succeeded` / `failed`), indexed. `hasError` is now removed from the list and the mutation; `sql/2026-09-13-drop-communicator-chat-haserror.sql` drops the column.
- ~~`timestamp` and `createdAt` can represent the same event with different sources~~ — `timestamp` removed. It was within 0.017s of `createdAt` on all 26 rows that had it, so it carried no information. `createdAt` is authoritative and indexed.
- ~~`rawData` ... may retain broad student/staff query results~~ — read restricted to chat managers, never writable through the API, and no longer selected by dashboard history queries.
- ~~`userRating` and `userComment` are writable only by users with the all-chat management permission~~ — owners can now update their own chat, and field-level rules make every result/audit field read-only so a record cannot be edited after the fact.
- ~~Chat administration is coupled to `canManagePbis`~~ — replaced by a dedicated `canManageCommunicator` permission.
- ~~Any staff user can use generic `createCommunicatorChat`~~ — generic create is disabled. Chats are written only by `queryCommunicator`, which uses an elevated context.
- ~~History queries in the dashboard fetch all records and include `rawData`, with no `take` or server ordering~~ — both queries now order by `createdAt desc` and take a bounded page.

Still open:

- Retention policy for `rawData` and questions. Access is restricted now, but nothing expires.
- The mutation returns `chatId`, but the dashboard still matches history by question text. Switching to the returned id is Phase 7 of the migration plan.
- `queryCommunicator` still returns untyped JSON rather than a typed result object.

### Proposed target

- Replace `hasError` with `status` using values such as `pending`, `succeeded`, and `failed`, or at minimum use a Boolean.
- Keep one authoritative creation timestamp and an optional completion timestamp.
- Return and persist the created chat ID from `queryCommunicator`.
- Permit owners to rate/comment on their own completed chats without permitting changes to query/result fields.
- Introduce communicator-specific management permissions rather than reusing PBIS permissions.
- Disable generic create/update paths where a purpose-built mutation is safer.
- Make raw result retention opt-in, redacted, access-restricted, and time-limited; preferably do not return raw data in history lists.
- Add indexes needed by history access, especially user plus creation time/status.
- Paginate and order history server-side.

## 7. Generated And Conflict Artifacts

- `schema.graphql` and `schema.prisma` state that they are generated but are tracked.
- `.keystone/config.js` and its source map are generated output.
- `.keystone/config.sync-conflict-20260718-053111-REC6DP4.js` is a stale sync-conflict copy of compiled application code.
- `.keystone/admin` and `node_modules` are ignored build/dependency output.

Action:

1. Confirm whether deployment expects tracked `.keystone/config.js` or runs `keystone build` itself.
2. Decide whether `schema.graphql` is a checked-in API contract. Keeping it is reasonable if CI regenerates it and fails on unexpected drift.
3. Remove the sync-conflict artifact after confirming it is not referenced by deployment.
4. Update `.gitignore` to cover the chosen generated-output policy.
5. Regenerate derived schemas after every model change rather than editing them manually.

## 8. Other Cleanup Opportunities

These are not primary data-model removals but affect maintainability and Communicator safety:

- Replace broad source logging of sessions, generated GraphQL variables, and query results with redacted structured logs.
- Add tests for custom mutations and access filters; this backend currently has no test script.
- Review list access that uses broad `isSignedIn` for create/update/delete, particularly PBIS collection records.
- Replace raw-header array membership in `access.ts` with explicit authorization-header parsing and a dedicated service-auth policy if service credentials remain.
- Remove unused imports and commented-out field blocks as part of the same changes that resolve the underlying feature, not as an isolated cosmetic pass.
- Correct naming only through intentional migrations. Examples include uppercase fields such as `PbisCardCount`/`YearPbisCount` and ambiguous names such as `PbisCollectionDate`.

## Execution Order

### Phase 0: Establish safety

1. Take a production database backup.
2. Add a repeatable data-profile script or read-only SQL report for candidate tables/fields.
3. Capture GraphQL operation usage for at least one normal operating cycle, including a weekly PBIS collection.
4. Inventory other clients, imports, cron jobs, and one-off scripts.
5. Add backend integration tests for current PBIS and Communicator access behavior.

### Phase 1: Source-only cleanup

1. Remove confirmed unused frontend PBIS implementations after the usage window.
2. Resolve the disabled Chromebook assignment feature decision.
3. Remove detached starter schema files and replace stale documentation.
4. Remove the sync-conflict artifact and formalize generated-file policy.

### Phase 2: Nondestructive model changes

1. Add the target collection fields/model without removing old fields.
2. Add the revised `CommunicatorChat` status, timestamp, permission, and retention model.
3. Dual-read or dual-write only where a concrete production transition requires it.
4. Backfill and validate migrated values with counts and checksums.

### Phase 3: Client cutover

1. Update active frontend operations to the target schema.
2. Update the curated Communicator schema/domain descriptions.
3. Observe errors and old GraphQL operation usage in production.
4. Remove old writes first, then old reads.

### Phase 4: Destructive cleanup

1. Export/archive old records.
2. Remove old Keystone fields/lists and regenerate contracts.
3. Deploy and verify before dropping old columns/tables where possible.
4. Apply explicit database migrations with a documented rollback/restore procedure.

## Definition Of Done

- One documented, active PBIS collection-history model remains.
- Legacy PBIS collection operations receive no production traffic.
- All retained cached/aggregate fields have documented semantics and one owner.
- Communicator-facing types and fields are intentionally allowlisted and described.
- `CommunicatorChat` permissions, retention, and field types match frontend behavior.
- Generated schema files are reproducible and checked for drift.
- Every destructive change has a backup, data-validation result, migration, and rollback procedure.
