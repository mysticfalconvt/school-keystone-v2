// The one place the database URL is resolved.
//
// Both the running app (keystone.ts) and Prisma's own tooling (prisma.config.ts,
// which `keystone dev` uses to sync the schema) read it from here, so the schema
// can never be pushed to a different database than the one the app talks to.
export function resolveDatabaseUrl(): string {
  return (
    process.env.LOCAL_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/postgres'
  );
}
