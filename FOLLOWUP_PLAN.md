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

### 2.2 Remove the dashboard's dead Communicator service path — done

Deleted on the `remove-dead-communicator-service-path` branch of
`../SchoolDashboard`: `pages/api/communicator/query.ts` and the whole of
`lib/communicator/`. Nothing outside those files imported any of them; the
dashboard's typecheck and its 608 tests pass without them.

The access-log check was waived rather than performed — nothing in either
repository has called that route since the pipeline moved in-process.

Two things the deletion settled that are worth carrying into 2.3. Its auth
returned true when `COMMUNICATOR_API_KEYS` was unset, so the route was open: an
unauthenticated endpoint running LLM calls against school data. And that
variable, along with the dashboard's `LM_STUDIO_*` settings, now appears
nowhere in that repository, so it only needs removing from the deployment
environment.

### 2.3 Drop the dead environment variables

`COMMUNICATOR_ENDPOINT` and `COMMUNICATOR_API_KEY` here. Also `COOKIE_SECRET`
and `API_KEY`, which are in `.env` but read nowhere in this repository.

`COMMUNICATOR_API_KEYS` in the dashboard is already unreferenced in source as
of 2.2 — what is left there is removing it from the deployment environment.

### 2.4 Drop the vestigial `model` argument — done, with a caveat

The argument is gone; the signature is now `queryCommunicator(question)`. The
resolved model is still written to `CommunicatorChat.model` on both the success
and failure paths and still tagged on Sentry reports, so history keeps showing
which model produced an answer. Only the input went.

The caveat is timing. The dashboard stopped sending `model` in 757e6b7, on
2026-09-12 — about a day before this change, and it is the only caller in any
repository. The plan's condition was that the dashboard deploy be live "long
enough that no client sends it", and a day is not obviously long enough: a tab
opened before that deploy still runs the old bundle, and an unknown argument
fails GraphQL validation for the whole request, so those sessions error until
someone refreshes.

That is the exact failure the argument was kept to avoid, so if the backend
deploy is going out soon after the dashboard one, this is the commit to hold.
Reverting it is one line and no database involvement.

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

### What shipped

All three, plus the budget split.

`generateQuery` takes a `PriorStep[]` — each completed step's query and its
result — and renders them into the generation prompt ahead of the schema, under
instructions to use those values and not re-fetch or invent them. Results are
truncated to 1500 characters per step, much tighter than the explanation step's
budget, because they share a context window with the schema.

The query tool gained `needs_followup` and `followup_reason`. When set, the loop
records the result, skips explain and evaluate, and regenerates with the data in
context. `MAX_LOOKUP_HOPS` is 2 and is spent separately from `MAX_ITERATIONS`,
so two lookups still leave all four refinement passes. When the lookup budget is
gone the model is made to answer with what it has rather than looping.

Collection-scoped questions are seeded before the loop starts: a narrow pattern
match triggers one GraphQL call for `pbisCollectionDates(orderBy: {
collectionDate: desc }, take: 2)`, pushed in as the first prior step. Two runs,
not one, because a collection period is a range — the prompt now spells out that
"the last collection" is `gte` the earlier date and `lt` the later one, while
"since the last collection" is `gte` the later one. An open-ended `gte` answers a
different question and looks right. A failed prefetch is logged and skipped, not
raised.

`iterations` on `CommunicatorChat` now counts lookups too, so the persisted
number reflects what an answer cost.

### What is not verified

The tests cover the machinery — which questions seed, how steps render and are
bounded, how the signal parses, how the budgets are spent — and each assertion
was checked by breaking the code under it. None of that says the model uses any
of it well. Whether it sets `needs_followup` when it should, and whether having
the collection dates in front of it actually stops the invented-date answers,
needs real questions against a real endpoint. The questions in 4.3 are the ones
to try first, since their right answers are already known.

---

## Phase 4: Correctness and honesty

### 4.1 The evaluation score does not track correctness — no longer surfaced

Measured across all 51 chats rather than the handful the plan started from. Of
the 35 that carry a score, every one is between **6 and 10**, mean **7.9**:

```
 6: 2    7: 9    8: 16    9: 6    10: 2
```

So `MIN_SCORE_THRESHOLD` of 6 has never gated a final answer — nothing has ever
scored below it. And the two human ratings sit at 10-vs-self-8 and 1-vs-self-7:
a nine point difference the score reads as one.

The decision was to stop surfacing it rather than recalibrate. With two labelled
answers there is no ground truth to calibrate against, and a number that looks
like confidence while tracking nothing is worse than no number. The ⭐ chip is
gone from the dashboard and the history queries no longer select it. It is still
computed and still recorded on each chat, so it stays available for diagnostics
and for a future recalibration; the reason not to put it back is written at the
field in `communicatorChat.tsx`.

Related: refinements that repeat an already-executed query now stop (4.5), which
removes one visible symptom of the same problem.

### 4.2 Aggregation — honest refusal, no resolver

Asked which teacher has the most callbacks sharing a description, the model
answered Carrie with 18. The real answer is Jessica with 144. This was not
truncation — the full 76,343-character payload reached the model. It was asked
to group and count across 76KB of JSON and could not.

The decision was to leave this unanswerable rather than build a SQL-grouping
resolver. So the prompt now has to carry the whole weight, and it says the limit
explicitly: this API cannot group, there is no resolver that does, fetching more
rows is not a workaround, and ranking by reading rows is the specific thing that
fails. It gives two acceptable routes — exact per-candidate counts when the
candidates are few and named, or saying plainly that it cannot rank and
answering the nearest exact question instead — and states that "I cannot rank
these exactly" is a correct answer while a wrong number is not.

The Carrie/Jessica case is written into the prompt as the worked example,
because the failure mode is a confident number rather than an error.

**Tested, failed, fixed, still unverified.** Run against a real endpoint, the
model did exactly what the prompt forbade: fetched all 263 callbacks and
grouped them by eye, answering Vicky with 11. The right answer is Jessica with
144 — and her group is *more than half of the 263 rows the model was given*.

The stored `rawData` settles what it saw: 60,182 characters, `_truncated`
undefined, all 263 rows present. Not a truncation problem.

The rules were in the wrong prompt. They sat in the query-generation system
prompt, and the false claim is made in `explainResults`, which never saw them.
This is the same mistake the plan records about field descriptions — a rule is
only obeyed where it is read — made one level up. The rules are now in the
explanation prompt, where the ranking claim is actually written, and they apply
whether or not the data was truncated: complete data does not make eyeball
counting reliable, it only removes the excuse.

Needs another run of the same question to know whether it took.

### 4.3 Remaining semantics gaps — done

Both readings were confirmed against the database first: staff by cards given is
James Pacheco at 660, and the TA group reading is Michael Ingram's at 476,
exactly as recorded here.

- **"TA"** now has a prompt rule, not just a field description, because the
  model will not select `taStudents` unless it already understood the term. It
  says a TA is the advisory group, that "which TA has the most cards" asks about
  cards the group's students *received*, and gives the query shape.
- **Group size varies** — 8 to 11 students — so a total and a per-student
  average rank differently, and the rule says to state which was answered.
- **`taTeamAveragePbisCardsPerStudent` is a trap** and is now documented as one.
  It is written by the collection run, so it describes that run rather than all
  time. Sorting by it looks like an exact answer and gets the top two right,
  then reranks: Carrie McGraw moves from 9th to 4th and Adam Dobler from 3rd to
  5th.
- **Counts defaulting to all-time**: audited. `teacherPbisCardsCount`,
  `staffPbisCardsGivenCount` and `staffPbisCardsReceivedCount` had no such
  warning and now do.
- **"This week"** is seeded as a collection question when the question is also
  about cards. "How many callbacks were assigned this week" really does mean a
  calendar week and is left alone.

### 4.4 A greeting costs four model calls — done

`hasNoAnswerableContent` returns before the loop, so a greeting costs no model
call and no database call. The token set contains no domain words, so any real
question has at least one token outside it; the tests push hardest on that
direction, since refusing a real question would be far worse than running the
loop on a greeting.

### 4.5 Refinements that repeat a query — done

Not in the original plan; found in production while checking Phase 3. The
evaluator scored an answer below the threshold, asked for a follow-up, got back
a byte-identical query, and scored the identical result an 8. The loop now
compares each generated query against the ones already executed and keeps the
existing answer rather than paying for an execute and an explain that cannot
change it. This is a symptom of 4.1 rather than a fix for it.


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
