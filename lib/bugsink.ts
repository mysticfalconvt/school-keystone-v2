/*
Error reporting to Bugsink (https://bugsink.rboskind.com).

Bugsink speaks the Sentry ingest protocol, so we use the official @sentry/node
SDK and simply point the DSN at our own server. Nothing is sent unless
BUGSINK_DSN is set, so an unconfigured checkout stays completely silent.

What gets reported:
  - uncaught exceptions / unhandled promise rejections (Sentry defaults)
  - GraphQL resolver errors, via `bugsinkApolloPlugin` in keystone.ts
  - anything we hand to `captureError()` from a catch block
  - user-submitted BugReport records, via `reportUserBug()`
*/

import 'dotenv/config';
import * as Sentry from '@sentry/node';
import type { ApolloServerPlugin } from '@apollo/server';
import type { GraphQLError } from 'graphql';

const dsn = process.env.BUGSINK_DSN;

export const bugsinkEnabled = Boolean(dsn);

if (dsn) {
  Sentry.init({
    dsn,
    release: `school-keystone-v2@${process.env.npm_package_version || 'dev'}`,
    environment: process.env.NODE_ENV || 'development',
    // Bugsink is an error tracker only — it does not ingest traces or profiles.
    tracesSampleRate: 0,
    // This app holds student data. Never let the SDK attach request bodies,
    // headers, cookies or IPs on its own; we attach specific fields by hand.
    sendDefaultPii: false,
  });
  console.log(`[bugsink] error reporting enabled -> ${new URL(dsn).origin}`);
} else {
  console.log('[bugsink] BUGSINK_DSN not set — error reporting disabled');
}

type CaptureContext = {
  /** Short indexed labels, e.g. { mutation: 'sendEmail' } */
  tags?: Record<string, string>;
  /** Anything else worth seeing on the event */
  extra?: Record<string, unknown>;
  /** Keystone user id. We deliberately do not send names or emails. */
  userId?: string;
};

/**
 * Send an error to Bugsink. Safe to call unconditionally — it is a no-op when
 * BUGSINK_DSN is unset, and it never throws, so it can sit inside a catch block
 * without changing behaviour.
 */
export function captureError(error: unknown, context: CaptureContext = {}) {
  if (!bugsinkEnabled) return;
  try {
    Sentry.withScope((scope) => {
      if (context.tags) scope.setTags(context.tags);
      if (context.extra) scope.setExtras(context.extra);
      if (context.userId) scope.setUser({ id: context.userId });

      if (error instanceof Error) {
        Sentry.captureException(error);
      } else {
        // Non-Error throws still deserve an issue, just without a stack.
        Sentry.captureMessage(String(error), 'error');
      }
    });
  } catch (bugsinkError) {
    console.error('[bugsink] failed to report error', bugsinkError);
  }
}

/**
 * Forward a bug a human reported through the BugReport list. These are grouped
 * by title so repeat reports of the same problem land on one issue.
 */
export function reportUserBug(report: {
  title: string;
  description?: string;
  submittedById?: string;
}) {
  if (!bugsinkEnabled) return;
  try {
    Sentry.withScope((scope) => {
      scope.setLevel('warning');
      scope.setTag('source', 'bug-report');
      scope.setFingerprint(['bug-report', report.title]);
      if (report.description) scope.setExtra('description', report.description);
      if (report.submittedById) scope.setUser({ id: report.submittedById });
      Sentry.captureMessage(`Bug report: ${report.title}`);
    });
  } catch (bugsinkError) {
    console.error('[bugsink] failed to report user bug', bugsinkError);
  }
}

/*
Errors we do not want as issues: these are the API telling a client "no", not
the server being broken. Without this filter every typo'd query and every
access-denied check would open an issue.
*/
const IGNORED_ERROR_CODES = new Set([
  'GRAPHQL_PARSE_FAILED',
  'GRAPHQL_VALIDATION_FAILED',
  'BAD_USER_INPUT',
  'BAD_REQUEST',
  'PERSISTED_QUERY_NOT_FOUND',
]);

const IGNORED_MESSAGE_PATTERNS = [
  /access denied/i,
  /must be logged in/i,
  /not authoriz/i,
  /permission/i,
];

function isExpectedError(error: GraphQLError) {
  const code = error.extensions?.code;
  if (typeof code === 'string' && IGNORED_ERROR_CODES.has(code)) return true;
  return IGNORED_MESSAGE_PATTERNS.some((pattern) => pattern.test(error.message));
}

/**
 * Apollo plugin that reports GraphQL errors. This is where nearly everything in
 * a Keystone app surfaces, since resolver errors never reach an Express error
 * handler.
 */
export const bugsinkApolloPlugin: ApolloServerPlugin = {
  async requestDidStart() {
    return {
      async didEncounterErrors({ errors, request, contextValue }) {
        if (!bugsinkEnabled) return;

        const userId = (contextValue as any)?.session?.itemId;

        for (const error of errors) {
          if (isExpectedError(error)) continue;

          captureError(error.originalError ?? error, {
            tags: {
              source: 'graphql',
              ...(request.operationName
                ? { operation: request.operationName }
                : {}),
            },
            extra: {
              // The query text is safe to log; variables can hold student data,
              // so only their names go along.
              query: request.query,
              variableNames: Object.keys(request.variables ?? {}),
              path: error.path?.join('.'),
            },
            userId: userId ? String(userId) : undefined,
          });
        }
      },
    };
  },
};

export { Sentry };
