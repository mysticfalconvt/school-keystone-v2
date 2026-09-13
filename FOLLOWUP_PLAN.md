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

### 1.1 Exercise the access rules as a non-manager

The `sudo()` write path is proven by production traffic. Two rules are not:

- `rawData` read is restricted to chat managers. If Keystone raises an error
  rather than returning null for a denied field read, an ordinary staff user's
  history query fails. Only visible when signed in as someone without
  `canManageCommunicator`.
- An owner may set `userRating` and `userComment` on their own chat and nothing
  else. Field-level rules are easy to get wrong in either direction.

Check as three users: a plain enabled staff member, a chat manager, and a
superadmin. Confirm the first can read their own history and rate a chat, and
cannot see `rawData` or edit `question`.

If the first case breaks it is a one-line access change and a redeploy. No
database involvement, so no rollback.

### 1.2 Add a backend test script

There is no `test` script in this repository at all. Everything shipped is
backed by `tsc` and by reading the code.

Minimum worth having, using `@keystone-6/core/testing`:

- Access control on `CommunicatorChat` for the five roles above.
- The `queryCommunicator` boundary checks: signed out, non-staff, staff without
  `isCommunicatorEnabled`, enabled staff.
- `buildApprovedSchema`: that the generated contract excludes auth fields and
  per-list inputs for unapproved lists, and that `buildSchema` accepts it. This
  one is pure and needs no database — it is the cheapest real test here and it
  guards the security boundary that took two attempts to get right.

### 1.3 Wire the contract drift check into CI

`npm run communicator:schema:check` exits 1 when `schema.graphql` has moved and
the contract has not been regenerated. It only helps if something runs it.

---

## Phase 2: Finish the cleanup that is already safe

### 2.1 Remove `CommunicatorChat.hasError`

The backfill ran in production and was verified: 26 succeeded, 12 failed, no
rows left at `pending`. `status` is now authoritative and `hasError` is a
duplicate that the mutation still dual-writes.

Delete the field, drop the dual-write in `queryCommunicator`, regenerate, and
apply. One column drop, no data at risk.

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
