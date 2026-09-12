// In-process replacement for the dashboard's HTTP GraphQL client.
//
// The old path sent generated queries back over HTTP to this same service,
// authenticated with a shared service key. That produced a request with no
// session, so any list whose access rules need session.itemId - Callback most
// importantly - denied access outright, while the schema shown to the model
// still advertised those fields.
//
// Queries now execute in the caller's own Keystone context. Access is whatever
// that user is allowed to see, nothing more. This narrows access relative to
// the old service key; it never widens it.
import { readFileSync } from 'fs';
import { join } from 'path';
import type { GraphQLRequest, GraphQLResponse } from './types';

// The schema the model is shown. Still the trimmed query-only snapshot that
// was copied into the dashboard; generating an allowlisted contract from the
// live lists is a separate piece of work (see
// COMMUNICATOR_BACKEND_MIGRATION_PLAN.md, "Schema Ownership And Reduction").
const SCHEMA_PATH = join(process.cwd(), 'lib', 'communicator', 'schema.graphql');
const SCHEMA_CACHE_TTL = 5 * 60 * 1000;

let cachedSchema: string | null = null;
let cachedAt = 0;

export function loadCommunicatorSchema(forceRefresh = false): string {
  const now = Date.now();
  if (!forceRefresh && cachedSchema && now - cachedAt < SCHEMA_CACHE_TTL) {
    return cachedSchema;
  }
  try {
    cachedSchema = readFileSync(SCHEMA_PATH, 'utf-8');
    cachedAt = now;
    return cachedSchema;
  } catch (error) {
    throw new Error(
      `Could not load the Communicator GraphQL schema from ${SCHEMA_PATH}`,
    );
  }
}

/**
 * Executes generated queries against Keystone in-process, scoped to the caller.
 *
 * One instance per request: it closes over that request's context, so it must
 * not be shared between callers.
 */
export class CallerScopedGraphQL {
  constructor(private readonly context: any) {}

  async query<T = any>(request: GraphQLRequest): Promise<GraphQLResponse<T>> {
    // context.graphql.raw returns { data, errors } and does not throw on
    // GraphQL errors, which the generator relies on to auto-repair invalid
    // queries.
    const result = await this.context.graphql.raw({
      query: request.query,
      variables: request.variables,
    });

    return {
      data: result.data as T,
      errors: result.errors?.map((e: any) => ({
        message: e.message,
        locations: e.locations,
        path: e.path?.map((p: any) => String(p)),
        extensions: e.extensions,
      })),
    } as GraphQLResponse<T>;
  }

  async getSchema(forceRefresh = false): Promise<string> {
    return loadCommunicatorSchema(forceRefresh);
  }
}
