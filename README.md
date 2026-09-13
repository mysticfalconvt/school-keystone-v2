# school-keystone-v2

Keystone 6 backend for the NCUJHS school dashboard. It owns the data model,
the GraphQL API, authentication, and a handful of custom mutations. The browser
UI lives in a separate repository (`../SchoolDashboard`, a Next.js app) and talks
to this service over GraphQL.

## Requirements

- Node.js 18+
- A PostgreSQL database (v17 in production)

## Setup

```bash
npm install
```

Create a `.env` file in the repository root. The variables actually read at
runtime are:

| Variable | Required | Purpose |
| --- | --- | --- |
| `LOCAL_DATABASE_URL` | one of these two | PostgreSQL connection string. Checked first. |
| `DATABASE_URL` | one of these two | Fallback connection string. |
| `SESSION_SECRET` | yes in production | Signs session cookies (`auth.ts`). A value is generated in development if unset. |
| `PORT` | no | Server port. Defaults to `4000`. |
| `FRONTEND_URL` | yes | Used in outgoing email links (`lib/mail.ts`). |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_USER` / `MAIL_PASS` | for email | SMTP transport for `sendEmail`. |
| `AUTH_HEADER_SECRET` | yes | Accepted `Authorization` value for service-to-service calls (`access.ts`). |
| `GOOGLE_OAUTH_CLIENT_ID` | for Google sign-in | Must match the dashboard's `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. |
| `LM_STUDIO_ENDPOINT` | for Communicator | OpenAI-compatible base URL of the LM Studio server, e.g. `http://10.0.0.156:1234/v1`. Required — there is no fallback, and this host must be able to reach it. |
| `COMMUNICATOR_MODEL` | no | Model used for every Communicator request. Blank or unset falls back to `openai/gpt-oss-120b`. Users do not choose a model; the resolved value is recorded on each chat. |
| `ALLOW_IMPERSONATION` | no | Enables the `impersonateUser` mutation. Development only. |
| `BUGSINK_DSN` | no | Error reporting (`lib/bugsink.ts`). |

`.env` also currently contains `COOKIE_SECRET`, `API_KEY`, `COMMUNICATOR_ENDPOINT`
and `COMMUNICATOR_API_KEY`. None of them is read anywhere in this repository any
more — the last two became dead when the Communicator pipeline moved into this
service and stopped calling the dashboard over HTTP. They can be removed once
you have confirmed nothing external depends on them being present.

## Running

```bash
npm run dev     # keystone dev  - Admin UI, GraphQL playground, schema sync
npm start       # keystone start - production, no schema sync
npm run build   # keystone build
```

Development defaults to <http://localhost:4000>. The GraphQL endpoint is at
`/api/graphql` and the Admin UI at `/`. Admin UI access requires a session with
`isSuperAdmin`; the GraphQL playground is only enabled when
`NODE_ENV=development`.

Authentication is email plus password (`auth.ts`). On an empty database Keystone
prompts to create the first user.

## Schema and migrations

Lists are defined in `schemas/` and registered in `keystone.ts`. There is
**no Prisma migration history in this repository** and `keystone.ts` does not set
`db.useMigrations`, so `keystone dev` synchronises the schema with `prisma db push`
semantics: it compares the live database to the current lists and prompts before
applying changes, including destructive ones. `keystone start` does not sync
anything.

In practice, schema changes have been applied to production by pointing
`npm run dev` at the production database and accepting the prompts. That works,
but note what it implies:

- It pushes **all** accumulated drift at once, not just your intended change.
- Dropped columns and tables are not recoverable without a database backup.
- There is no migration file to review before the fact or roll back after it.

Take a backup before any run that will drop something.

`schema.graphql` and `schema.prisma` are generated and committed. Regenerate them
by running `npm run dev` after a model change; never hand-edit them. `.keystone/`
holds build output — `.keystone/config.js` is currently tracked, so confirm
whether deployment depends on it before changing that.

## Custom mutations

Defined in `mutations/` and wired up through `extendGraphqlSchema` in `keystone.ts`:

- `addStaff` — bulk staff creation
- `authenticateUserWithGoogle` — Google OAuth sign-in
- `impersonateUser` — development-only user switching, gated by `ALLOW_IMPERSONATION`
- `queryCommunicator` — proxies the natural-language query pipeline
- `recalculateCallback` — recomputes callback state
- `sendEmail` — outgoing mail
- `updateStudentSchedules` — bulk schedule import

## Tests

There is no test script in this repository yet. The dashboard repo has a Jest
suite (`npm test` there).

## Planning documents

- [DATA_MODEL_CLEANUP_PLAN.md](./DATA_MODEL_CLEANUP_PLAN.md) — reducing obsolete
  and overlapping schema surface
- [COMMUNICATOR_BACKEND_MIGRATION_PLAN.md](./COMMUNICATOR_BACKEND_MIGRATION_PLAN.md) —
  moving the Communicator pipeline out of the dashboard and into this service
