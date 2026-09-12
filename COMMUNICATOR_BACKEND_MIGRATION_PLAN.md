# Communicator Backend Migration Plan

## Goal

Move the Communicator's server-side query-generation pipeline from `../SchoolDashboard` into `school-keystone-v2`, while leaving the browser UI in the dashboard. This gives the data model, GraphQL execution policy, Communicator schema, authorization, auditing, and LLM orchestration one backend owner.

The migration should remove the current service-to-service loop without accidentally granting the model broader data access.

## Current Architecture

The current request path is:

```text
SchoolDashboard browser
  -> school-keystone-v2 queryCommunicator GraphQL mutation
  -> SchoolDashboard POST /api/communicator/query
  -> LM Studio for schema selection/query generation
  -> school-keystone-v2 GraphQL endpoint using a service header
  -> LM Studio for evaluation/explanation
  -> school-keystone-v2 persists CommunicatorChat
  -> browser refetches history and matches by question text
```

Relevant ownership today:

| Concern | Current location |
| --- | --- |
| Browser UI and chat history | `../SchoolDashboard/pages/communicatorChat.tsx` |
| Query API route | `../SchoolDashboard/pages/api/communicator/query.ts` |
| Model inventory API route | `../SchoolDashboard/pages/api/communicator/models.ts` |
| Query-generation pipeline | `../SchoolDashboard/lib/communicator/queryGenerator.ts` |
| LM Studio client | `../SchoolDashboard/lib/communicator/lmStudio.ts` |
| Static query schema | `../SchoolDashboard/lib/communicator/schema.graphql` |
| Service-authenticated Keystone client | `../SchoolDashboard/lib/communicator/graphql.ts` |
| API-key validation | `../SchoolDashboard/lib/communicator/auth.ts` |
| End-user authorization and proxy | `mutations/queryCommunicator.ts` |
| Chat persistence and list access | `schemas/CommunicatorChat.ts` |

## Why Move It

- Remove the Keystone-to-dashboard-to-Keystone network loop.
- Remove the manually synchronized `COMMUNICATOR_ENDPOINT`, inter-service API key, and separate Keystone service credential.
- Generate/curate the model-visible schema next to the real Keystone lists instead of copying it into the frontend repository.
- Execute generated queries under an explicit caller-aware access policy.
- Keep chat persistence and the returned result in one transaction boundary/service flow.
- Make schema changes and Communicator prompt changes reviewable together.
- Reduce the chance that frontend deployment details determine backend availability.

## Confirmed Problems To Address During Migration

### Stale copied schema

`../SchoolDashboard/lib/communicator/schema.graphql` is a query-only snapshot rather than the current backend contract. It omits current model surface including blocks 11/12, `StaffPbisCard`, and multiple newer lists.

The prompt previously claimed `isTeacher` does not exist, contradicting both the copied schema and the Keystone model. The underlying intent was correct and must be preserved: staff here say "teacher" to mean any employee, so `isStaff` is the right default for most questions. Only the justification was false. `isTeacher` is a real, well-maintained field — a strict subset of `isStaff` marking classroom teachers (42 of 82 staff; exactly those with a TA group or assigned classes). The guidance has been reworded to state the semantics rather than deny the field, so genuinely teacher-scoped questions stay answerable. Do not "fix" this by switching the default to `isTeacher`.

Moving the file without changing ownership would preserve the underlying drift problem. The backend should generate a safe query schema from the active lists and CI should detect drift.

### Ambiguous authorization

The dashboard's Communicator GraphQL client sends a service authorization value. Keystone's `isSignedIn` accepts that value, but multiple list filters rely on an actual session and `session.itemId`. The schema shown to the LLM can therefore advertise fields that the execution context cannot consistently read.

The migration must select and test one policy:

- Caller-scoped execution through the authenticated Keystone context. Recommended default.
- A dedicated Communicator principal with a narrow policy.
- `context.sudo()` only for explicitly allowlisted fields and explicitly approved privileged use cases.

Do not use `sudo()` merely to preserve the apparent breadth of the old service account. It creates a direct data-exfiltration risk for a natural-language interface.

### Raw data exposure

The current flow requests raw GraphQL results, persists them in `CommunicatorChat.rawData`, fetches them in unbounded history queries, and exposes them to the browser. Generated queries and variables are also logged. Explanations may omit IDs/emails while the raw payload still contains them.

The new design should return the minimum user-facing data, redact diagnostics, restrict diagnostic access, and define retention. Raw model/query data should not be included in normal history list queries.

### Untyped mutation result and response matching

`queryCommunicator` returns arbitrary JSON. The mutation persists a chat but does not return its ID, so `communicatorChat.tsx` refetches history and matches the newest record with identical question text. Repeated questions and concurrent tabs can select the wrong record.

The backend should return a typed result containing the persisted chat ID and status.

### Communicator permission mismatch

`CommunicatorChat` allows any staff member to query/create, while the custom mutation additionally requires `isCommunicatorEnabled`. Updates/deletes require superadmin or `canManagePbis`, which prevents an ordinary enabled user from rating their own chat and gives PBIS managers unrelated chat-management authority.

Introduce explicit capabilities or purpose-built mutations for:

- Use Communicator
- Read own history
- Rate/comment on own chat
- View all chats
- Moderate/delete chats

## Target Architecture

Initial synchronous target:

```text
SchoolDashboard browser
  -> school-keystone-v2 queryCommunicator mutation
  -> backend Communicator service
  -> LM Studio
  -> approved query execution in the caller's Keystone context
  -> LM Studio evaluation/explanation
  -> backend persists CommunicatorChat
  -> typed mutation response includes chat ID
```

Possible backend layout:

```text
lib/communicator/
  lmStudio.ts
  queryGenerator.ts
  schema.ts
  types.ts
  policy.ts
mutations/
  queryCommunicator.ts
  rateCommunicatorChat.ts
```

Keep dependencies injectable rather than embedding HTTP or global context in the generator:

- `getApprovedSchema()`
- `executeApprovedQuery(document, variables, context)`
- `getAvailableModels()`
- `completeWithModel(request, signal)`
- redacted logger/telemetry

## Schema Ownership And Reduction

The model should not receive the full administrative GraphQL schema just because it is available.

### Build an approved query contract

1. Generate from the same Keystone lists/build as `schema.graphql`.
2. Remove all mutation types.
3. Allowlist object types and fields by business need.
4. Exclude authentication fields, password/token state, private messages, bug-report details, Communicator raw data, and other sensitive domains by default.
5. Include field descriptions with real semantics, especially date ranges and denormalized counts.
6. Keep domain examples separately from generated schema text.
7. Add a CI check that fails when active schema changes require an allowlist/description review.

### Start with narrow use cases

The initial contract should support tested staff questions rather than every list. Suggested first domains:

- Current caller identity and class/TA relationships
- Students in classes the caller is authorized to see
- Caller-scoped callbacks
- Student and staff PBIS cards with documented count/date semantics
- PBIS collection dates/runs only if there is a real question set requiring them

Adding a domain should require an authorization test and example questions with expected query scope.

## Proposed Typed API

Prefer a custom GraphQL object rather than `JSON`. An initial synchronous shape could contain:

```graphql
type CommunicatorResult {
  chatId: ID!
  status: CommunicatorStatus!
  question: String!
  explanation: String
  generatedQuery: String
  iterations: Int
  evaluationScore: Int
  errorCode: String
  errorMessage: String
  createdAt: DateTime!
}
```

Do not include unrestricted raw query results by default. If diagnostics are required, expose a separate administrator-only field or endpoint with redaction and retention controls.

Validate inputs before model calls:

- Trim and limit question length.
- Allowlist selectable model IDs from backend configuration/inventory.
- Apply per-user quotas/rate limits.
- Reject unsupported models and oversized requests with typed error codes.

## Execution Safety

### Parse generated GraphQL

Replace regex-only read-operation checking with the GraphQL parser:

1. Parse the document into an AST.
2. Require exactly one operation.
3. Require operation type `query`.
4. Reject introspection unless explicitly needed.
5. Walk selected fields and enforce the approved field/type allowlist.
6. Apply depth, alias, node-count, and result-size limits.
7. Execute with caller-scoped context or the selected dedicated policy.

### Bound runtime

Add:

- Per-LM-call timeout via `AbortController`
- Per-GraphQL-execution timeout/budget where supported
- Overall request deadline
- Maximum generation/evaluation iterations
- Result-size limits before sending data back to the LLM
- Per-user and global concurrency limits
- Cancellation when the client disconnects where practical

The current pipeline can make several model calls over as many as four iterations, so moving it does not by itself solve proxy/load-balancer timeout risk.

### Logging and privacy

- Remove `console.log(session.data)` from the current backend mutation.
- Do not log complete generated variables or GraphQL result payloads.
- Log request/chat IDs, duration, model, stage, status, approved root fields, and redacted errors.
- Define retention for questions, generated queries, explanations, ratings, errors, and diagnostics.
- Sanitize or safely render model-generated Markdown in the frontend. The current regex converter is used with `dangerouslySetInnerHTML` and does not sanitize original HTML.

## Migration Phases

### Phase 0: Baseline behavior and policy

1. Decide whether queries run as the caller or through a dedicated Communicator policy. Use caller scope unless a documented requirement says otherwise.
2. List approved data domains and prohibited fields.
3. Record representative questions and expected accessible records for several user roles.
4. Add integration fixtures for enabled staff, disabled staff, non-staff, PBIS manager, and superadmin.
5. Add tests for classes including blocks 11/12, callbacks, student PBIS cards, and staff PBIS cards.
6. Measure current success rate, latency, iteration count, GraphQL errors, and response sizes for comparison.
7. Immediately sanitize frontend model output and paginate chat history, even if the backend move is delayed.

### Phase 1: Prepare the backend model and API

1. Add a typed Communicator result/status contract.
2. Migrate `CommunicatorChat.hasError` to a Boolean or status enum.
3. Select one authoritative creation timestamp and add completion time if useful.
4. Add ownership-safe rating/comment behavior.
5. Separate Communicator management from `canManagePbis`.
6. Restrict generic `CommunicatorChat` create/update operations so users cannot forge result/audit records.
7. Add pagination and indexes for user/status/creation-time history queries.

Use additive fields and a backfill first; remove old fields only after the dashboard has cut over.

### Phase 2: Port pure services

Move or adapt these modules into this repository:

- `../SchoolDashboard/lib/communicator/lmStudio.ts`
- `../SchoolDashboard/lib/communicator/queryGenerator.ts`
- `../SchoolDashboard/lib/communicator/types.ts`

Changes required during the port:

1. Inject schema retrieval and query execution.
2. Remove dependencies on the dashboard `config.ts` and HTTP GraphQL client.
3. Remove the hard-coded LM Studio private-IP fallback; require explicit backend configuration.
4. Correct stale domain guidance, including missing block 11/12 awareness. The `isTeacher` wording is already corrected in the dashboard prompt; carry the reworded version over rather than the original, and keep `isStaff` as the default (see "Stale copied schema" above).
5. Distinguish `PbisCard` and `StaffPbisCard` semantics.
6. Stop treating ambiguous stored PBIS counts as canonical until the data-model audit defines them.
7. Add AST validation, limits, aborts, and redacted telemetry.
8. Unit test each pipeline stage without requiring a running Next.js server.

### Phase 3: Create the backend-owned approved schema

1. Implement the type/field allowlist in this repository.
2. Generate a query-only model schema during build or test setup.
3. Add human-maintained descriptions for approved fields.
4. Add snapshots/drift checks.
5. Test every approved root query against real Keystone access rules for each role.
6. Ensure types that are not executable under the chosen context are not shown to the model.

This phase should happen after or alongside the data-model cleanup in [DATA_MODEL_CLEANUP_PLAN.md](./DATA_MODEL_CLEANUP_PLAN.md), so legacy lists do not become part of the new contract by accident.

### Phase 4: Shadow execution

1. Keep the current dashboard API as the production response path.
2. Run a sampled set of approved requests through the new backend pipeline in shadow mode.
3. Never persist or expose duplicate shadow chats to users.
4. Compare generated query validity, selected fields, authorization scope, explanation quality, latency, and raw result size.
5. Investigate scope differences, especially callbacks and any list whose filter requires `session.itemId`.
6. Establish cutover thresholds and verify the backend host can reliably reach `LM_STUDIO_ENDPOINT`.

Do not send sensitive production prompts/results to extra models merely for shadowing without approval.

### Phase 5: Cut over `queryCommunicator`

1. Change `mutations/queryCommunicator.ts` to call the local Communicator service directly.
2. Keep end-user staff/enabled checks at the API boundary and enforce authorization again at query execution.
3. Persist one chat record and return its ID in the typed response.
4. Make audit persistence behavior explicit. A database failure should not silently convert a successful model answer into an unrelated generic service error.
5. Return the submitted question and typed error code for failed requests.
6. Roll out behind a backend feature flag or percentage gate.
7. Retain a non-destructive rollback path to the old service during the observation window.

### Phase 6: Move model discovery

1. Add an authenticated backend GraphQL field or route for approved available models.
2. Apply the same communicator permission and model allowlist used by `queryCommunicator`.
3. Change `communicatorChat.tsx` to use the backend field instead of `/api/communicator/models`.
4. Remove the public dashboard model route after access logs show no callers.

### Phase 7: Simplify the frontend

1. Use the returned `chatId` instead of matching history by question and timestamp.
2. Use generated/shared GraphQL types rather than duplicating response interfaces.
3. Order and paginate history in GraphQL.
4. Fetch diagnostic details only on demand and only with appropriate permission.
5. Correct the access-denied message, which currently mentions superadmin even though access is based on `isCommunicatorEnabled` and staff status.
6. Replace or sanitize the Markdown rendering path before using `dangerouslySetInnerHTML`.

### Phase 8: Remove the dashboard service path

After the new path meets cutover thresholds for a full observation period:

1. Remove `../SchoolDashboard/pages/api/communicator/query.ts`.
2. Remove `../SchoolDashboard/lib/communicator/graphql.ts`.
3. Remove `../SchoolDashboard/lib/communicator/auth.ts`.
4. Remove the copied `../SchoolDashboard/lib/communicator/schema.graphql`.
5. Remove moved server-only pipeline modules from the dashboard.
6. Remove `COMMUNICATOR_ENDPOINT`, `COMMUNICATOR_API_KEY`, `COMMUNICATOR_API_KEYS`, and the dashboard-side Keystone service authorization if nothing else uses them.
7. Remove the old models route after its client cutover.
8. Confirm dashboard deployment no longer bundles or requires the server-only Communicator code.

## Optional Asynchronous Follow-Up

If synchronous requests remain slow or unreliable, evolve the same typed chat record into a job:

```text
createCommunicatorRequest -> pending chat ID
worker processes request -> succeeded/failed
browser polls or subscribes by ID
```

This supports cancellation, retries around safe stages, concurrency limits, and progress reporting. It is a follow-up, not a prerequisite for removing the cross-repository loop.

## Testing Matrix

Minimum tests before cutover:

| Area | Cases |
| --- | --- |
| Authorization | anonymous, student, disabled staff, enabled staff, manager, superadmin |
| Row scope | own classes, another teacher's classes, own callbacks, unauthorized callbacks |
| PBIS | student cards, staff cards, date filters, collection run/history semantics |
| Schema | allowed field, forbidden field, stale/missing field, blocks 11/12 |
| Generated operation | named query, anonymous query, mutation, multi-operation document, fragment, introspection, excessive depth |
| LLM failure | unavailable model, timeout, malformed tool call, invalid query, empty result, explanation failure |
| Persistence | successful chat, failed chat, database write failure, rating by owner, forbidden result edit |
| Concurrency | repeated identical questions, multiple tabs, duplicate submissions |
| Privacy | redaction, no raw data in normal history, no sensitive payload logs, retention cleanup |

## Cutover Criteria

- The approved schema is generated in this repository and drift-tested.
- Every generated query is AST-validated and executed under the documented access policy.
- No unrestricted raw results are returned in standard history or logs.
- Enabled-user and role tests pass against real Keystone access filters.
- The mutation returns a typed result and persisted chat ID.
- Frontend history no longer matches responses by question text.
- Timeout, iteration, result-size, and concurrency limits are configured.
- Shadow metrics meet agreed validity, scope, latency, and quality thresholds.
- A tested rollback switch exists during rollout.
- The backend deployment can reach the configured LM Studio endpoint.

## Definition Of Done

- `school-keystone-v2` owns all server-side Communicator orchestration, schema policy, query execution, and persistence.
- `SchoolDashboard` owns only the Communicator UI and browser GraphQL calls.
- No dashboard API key or copied Keystone schema is needed for Communicator queries.
- Data access is caller-scoped or governed by a documented dedicated policy.
- The model sees a minimal, current, tested schema rather than the full/stale data model.
- Old dashboard service routes and environment-variable coupling are removed only after production verification.
