# Follow-Up Plan

## Purpose

The data-model cleanup and the Communicator backend migration are deployed. This
plan covers what is left, in the order it is worth doing.

Companion documents, both now largely executed:
[DATA_MODEL_CLEANUP_PLAN.md](./DATA_MODEL_CLEANUP_PLAN.md) and
[COMMUNICATOR_BACKEND_MIGRATION_PLAN.md](./COMMUNICATOR_BACKEND_MIGRATION_PLAN.md).

## Ordering

Verification comes before features. The rollout changed access control on
`CommunicatorChat` and there is no automated test in this repository that
exercises it. Building new capability on top of unverified authorization is the
wrong order, and the checks are cheap.

After that, correctness work beats new features, because the failures found so
far were not missing capability — they were confident wrong answers produced by
a pipeline that looked like it was working.

---

## Phase 1: Verify what shipped

### 1.1 Exercise the access rules as a non-manager — resolved by reading Keystone

The two open questions were both about Keystone's own mechanics, and both are
settled in `@keystone-6/core`, so no sign-in was needed:

- **A denied field read returns null. It does not throw.** `outputTypeField`
  resolves `if (!fieldAccess) return null` before it ever touches the value, so
  an ordinary staff user selecting `rawData` gets `rawData: null` and the rest
  of the query succeeds. No access change, no redeploy.
- **Field-level update rules only cover fields present in the input.**
  `enforceFieldLevelAccessControl` iterates `Object.keys(inputData)`, so an
  owner writing `userRating` and `userComment` passes, and an owner writing
  `question` is refused with `you cannot update the fields ["question"]`.

`auth.ts` carries `isStaff`, `isSuperAdmin`, `isCommunicatorEnabled` and
`canManageCommunicator` in `sessionData`, so the access functions see real
values rather than undefined.

What this does not prove is the row filter at runtime — that a non-manager's
`communicatorChats` query returns only their own rows. That needs a database,
and it is the first thing to cover if 1.2 ever gets its integration half.

### 1.2 Add a backend test script — pure tests done

`npm test` exists. `scripts/runTests.js` bundles `tests/*.test.ts` with the
esbuild that Keystone already brings in and hands the result to node's built-in
test runner, so the suite is TypeScript without a test framework or a
transpiler in `devDependencies`.

`tests/buildApprovedSchema.test.ts` covers the contract: that `buildSchema`
accepts it, that it carries no mutation and no object type outside the
allowlist, that no denied `User` field survives on the type or its inputs, that
no input type belonging to an unapproved list is reachable, and that no
argument on an approved type reaches one. Two of those are written against the
generated schema rather than against the allowlist, so they keep holding when a
new `canSomething` permission is added or a deny entry is deleted — the
direction the allowlist-iterating tests cannot catch. A second set drives the
pruner with a hand-written source schema to pin the rules themselves.

Still outstanding, both needing a database:

- Access control on `CommunicatorChat` across the roles in 1.1.
- The `queryCommunicator` boundary checks: signed out, non-staff, staff without
  `isCommunicatorEnabled`, enabled staff.

Note that `@keystone-6/core/testing` is only `resetDatabase` in 6.5 — the old
`setupTestEnv` is gone, so these go through `getContext` from
`@keystone-6/core/context` against a throwaway Postgres.

### 1.3 Wire the contract drift check into CI — done

`.github/workflows/ci.yml` runs, on push to master and on every pull request:
`npm ci`, `npx keystone postinstall` (fails if `schema.graphql` or
`schema.prisma` are behind the lists), `npm run communicator:schema:check`,
`npm run typecheck`, `npm test`. None of it needs a database or a model
endpoint, which is the point — a check that needs infrastructure is a check
that gets turned off.

---

## Phase 2: Finish the cleanup that is already safe

### 2.1 Remove `CommunicatorChat.hasError` — done in code, column drop pending

The field is gone from `schemas/CommunicatorChat.ts` and both dual-writes are
gone from `queryCommunicator`. `schema.graphql` and `schema.prisma` are
regenerated; the Communicator contract is unchanged, because `CommunicatorChat`
is not a list the model can see.

No consumer selected it. Both dashboard history queries already read `status`,
and the `queryResponse.hasError` checks in `communicatorChat.tsx` read the
mutation's JSON result, which never carried the field — they are dead
comparisons against `undefined`, already ORed with the real `error` flag. The
only other occurrence anywhere is the stale schema snapshot in the retired
standalone `communicator` service.

`sql/2026-09-13-drop-communicator-chat-haserror.sql` drops the column. **Deploy
first, then run it.** The order matters in one direction only: an extra column
the application no longer knows about is harmless, since it is NOT NULL with a
default, but dropping it while the previous release is still writing to it
would fail every insert. The preflight in that file checks for rows left at
`pending` and for any row where `status` and `hasError` disagree, either of
which means an outcome is about to be lost.

### 2.2 Remove the dashboard's dead Communicator service path

Nothing calls these now that the pipeline runs in this service:

- `../SchoolDashboard/pages/api/communicator/query.ts`
- `../SchoolDashboard/lib/communicator/` — `graphql.ts`, `auth.ts`,
  `lmStudio.ts`, `queryGenerator.ts`, `types.ts`, `schema.graphql`

Confirm no access-log traffic to `/api/communicator/query` first. The copied
`schema.graphql` there is the stale snapshot the whole contract work replaced;
leaving it invites someone to edit the wrong file.

### 2.3 Drop the dead environment variables

`COMMUNICATOR_ENDPOINT` and `COMMUNICATOR_API_KEY` here, `COMMUNICATOR_API_KEYS`
in the dashboard. Also `COOKIE_SECRET` and `API_KEY`, which are in `.env` but
read nowhere in this repository.

### 2.4 Drop the vestigial `model` argument

`queryCommunicator(question, model)` still accepts `model` and ignores it, so
that a browser tab left open on the old page keeps working. Once the dashboard
deploy has been live long enough that no client sends it, remove the argument.

---

## Phase 3: Make the pipeline genuinely multi-step

This is the largest item and the one that stops the current pattern of patching
each ambiguous phrase with a prompt rule.

### The problem

There is a loop — `MAX_ITERATIONS` is 4 — but it cannot chain data.
`generateQuery(question, model, userId, userName)` receives a string. Step two
never sees step one's query or its results, so a value fetched in one step has
nowhere to live. The only channel is whatever the evaluator happens to write
into `suggestedFollowup` as prose.

It also rarely iterates at all: the loop exits when `score >= MIN_SCORE_THRESHOLD`
(6), and answers score 7–10 — including the wrong ones.

### The change

1. **Carry results forward.** Pass prior queries and their results into the
   query-generation prompt. This is the enabling step; the other two do nothing
   without it.
2. **Let the model request a lookup.** Add `needs_followup` and `reason` to the
   query tool. When set, skip explain and evaluate and loop immediately with the
   data in context. This distinguishes "the evaluator judged this inadequate"
   from "I know I need a value before I can answer", which is the actual agentic
   signal.
3. **Then guide it.** For collection-scoped questions, fetch
   `pbisCollectionDates(orderBy: { collectionDate: desc }, take: 2)` first and
   use that as a bounded range rather than an open-ended `gte`.

### Cost

Today a question is one generate, one explain, one evaluate. A deliberate lookup
adds a generate and an execute per hop. Cap lookup hops separately from
refinement hops so a confused model cannot spend the whole budget looking things
up.

---

## Phase 4: Correctness and honesty

### 4.1 The evaluation score does not track correctness

It scored **10** on an answer that named the wrong student, **8** on the correct
version of the same question, and **7** on a chat the user rated **1**. Of the
two human ratings ever given, one is a 10 and one is a 1, and the self-score
disagreed with the 1.

Either recalibrate it against the questions whose right answers are now known,
or stop surfacing it as if it means something. A number that looks like
confidence and is uncorrelated with correctness is worse than no number.

### 4.2 Aggregation has no honest answer yet

Asked which teacher has the most callbacks sharing a description, the model
answered Carrie with 18. The real answer is Jessica with 144. This was not
truncation — the full 76,343-character payload reached the model. It was asked
to group and count across 76KB of JSON and could not.

This GraphQL API has no `GROUP BY`, so the question is not expressible in one
query. The prompt now tells the model to say so rather than guess. If these
questions matter, the fix is a purpose-built resolver that groups in SQL.

### 4.3 Remaining semantics gaps

Each one produced a wrong answer that looked right:

- **"TA"** means an advisory group, not the teacher. Asked which TA has the most
  cards, the model ranked staff by cards *given* (James, 660). The group reading
  is Michael Ingram's TA at 476.
- **Counts default to all-time.** Fixed for callbacks; audit the rest.
- **"This week"** likely has the same collection-period ambiguity as "last
  collection".

Put semantics in field descriptions in `approvedSchema.ts`. Put rules the model
must follow regardless of which fields it selects in the prompt — a description
is only seen if that field is selected, which is why the `isSuperAdmin` note was
ignored until it became a prompt rule.

### 4.4 A greeting costs four model calls

"hi" ran all four iterations, produced no evaluation score, and concluded that
no users were returned when 678 were. Cheap guard: if the question has no
answerable content, say so without entering the loop.

---

## Phase 5: Interface and retention

### 5.1 Typed result instead of `JSON`

`queryCommunicator` returns `graphql.JSON`. The shape is now consistent across
success and failure and includes `chatId`, so the remaining work is declaring
it. See the migration plan's proposed `CommunicatorResult`.

### 5.2 Use the returned `chatId`

The mutation returns it. The dashboard still matches history by question text,
which picks the wrong record on repeated questions or concurrent tabs.

### 5.3 Retention

Nothing expires. `rawData` access is restricted but it is kept forever, and it
can hold broad student and staff records. Decide a retention window for raw
payloads separately from questions, explanations and ratings — the second group
is the useful history and should outlive the first.

---

## Explicitly not doing

- **Rebuilding chromebook assignments.** The feature was replaced by damage-only
  checks, not broken. The old model is gone; if device-number tracking is wanted
  it is a new build.
- **Restructuring `RandomDrawingWin`.** Whether to collapse it into a direct
  many-to-many or keep it auditable is a requirements decision, and the feature
  is switched off. Leave it until someone wants the feature back.
- **Re-adding a model picker.** Model choice is configuration now.
- **A preemptive "service unavailable" banner.** Removing model discovery
  removed the health signal it was based on. An unreachable LLM now surfaces on
  submit with a clear error. Revisit only if that proves annoying in practice.

## Definition of done

- Access rules on `CommunicatorChat` are covered by tests, not by reading.
- The contract drift check runs in CI.
- `hasError`, the dashboard service path, and the dead environment variables are
  gone.
- The pipeline can fetch a value and use it in a following step.
- No answer asserts a maximum, ranking or total it cannot support.
- Raw payload retention is bounded.
