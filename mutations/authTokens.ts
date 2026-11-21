import { graphql } from '@keystone-6/core';
import { captureError } from '../lib/bugsink';
import {
  AUTH_TOKEN_ERROR_CODES,
  AUTH_TOKEN_ERROR_MESSAGES,
  type AuthTokenErrorCode,
  type AuthTokenType,
  issueAuthToken,
  redeemAuthToken,
} from '../lib/authTokens';
import { enqueueMagicLinkEmail } from '../lib/emailQueue';

// Magic-link sign-in. There are no passwords, so this and Google sign-in are
// the only ways in. Names and shapes match what @keystone-6/auth used to
// generate, so the frontend is unaffected:
//
//   sendUserMagicAuthLink(email): Boolean!
//   redeemUserMagicAuthToken(email, token): RedeemUserMagicAuthTokenResult!

const MagicLinkRedemptionErrorCode = graphql.enum({
  name: 'MagicLinkRedemptionErrorCode',
  values: graphql.enumValues(AUTH_TOKEN_ERROR_CODES),
});

type Failure = { code: AuthTokenErrorCode; message: string };

const failure = (code: AuthTokenErrorCode): Failure => ({
  code,
  message: AUTH_TOKEN_ERROR_MESSAGES[code],
});

const RedeemUserMagicAuthTokenFailure = graphql.object<Failure>()({
  name: 'RedeemUserMagicAuthTokenFailure',
  fields: {
    code: graphql.field({ type: graphql.nonNull(MagicLinkRedemptionErrorCode) }),
    message: graphql.field({ type: graphql.nonNull(graphql.String) }),
  },
});

const emailArg = graphql.arg({ type: graphql.nonNull(graphql.String) });
const tokenArg = graphql.arg({ type: graphql.nonNull(graphql.String) });

/**
 * Shared "send link" resolver. Always returns true so the response does not
 * reveal whether the email belongs to an account. A failure to queue the
 * email is reported to Bugsink rather than to the caller for the same reason.
 */
function sendLink(
  type: AuthTokenType,
  enqueue: (context: any, token: string, email: string) => Promise<unknown>,
) {
  return graphql.field({
    type: graphql.nonNull(graphql.Boolean),
    args: { email: emailArg },
    async resolve(_root, { email }, context: any) {
      try {
        const issued = await issueAuthToken(context, type, email);
        if (issued) await enqueue(context, issued.token, email);
      } catch (error) {
        console.error(`[auth] failed to send ${type} link`, error);
        captureError(error, { tags: { mutation: `send ${type} link` } });
      }
      return true;
    },
  });
}

export const authTokenSchema = (base: any) => {
  const RedeemUserMagicAuthTokenSuccess = graphql.object<{
    token: string;
    item: any;
  }>()({
    name: 'RedeemUserMagicAuthTokenSuccess',
    fields: {
      token: graphql.field({ type: graphql.nonNull(graphql.String) }),
      item: graphql.field({ type: graphql.nonNull(base.object('User')) }),
    },
  });

  const RedeemUserMagicAuthTokenResult = graphql.union({
    name: 'RedeemUserMagicAuthTokenResult',
    types: [RedeemUserMagicAuthTokenSuccess, RedeemUserMagicAuthTokenFailure],
    resolveType: (value: any) =>
      'token' in value
        ? 'RedeemUserMagicAuthTokenSuccess'
        : 'RedeemUserMagicAuthTokenFailure',
  });

  return {
    mutation: {
      sendUserMagicAuthLink: sendLink('magicAuth', enqueueMagicLinkEmail),

      redeemUserMagicAuthToken: graphql.field({
        type: graphql.nonNull(RedeemUserMagicAuthTokenResult),
        args: { email: emailArg, token: tokenArg },
        async resolve(_root, { email, token }, context: any) {
          if (!context.sessionStrategy) {
            throw new Error('No session implementation available on context');
          }

          const result = await redeemAuthToken(
            context,
            'magicAuth',
            email,
            token,
          );
          if (!result.ok) return failure(result.code);

          const sessionToken = await context.sessionStrategy.start({
            data: { listKey: 'User', itemId: String(result.user.id) },
            context,
          });
          if (typeof sessionToken !== 'string' || sessionToken.length === 0) {
            captureError(
              new Error('Magic link: sessionStrategy.start returned no token'),
              {
                tags: { mutation: 'redeemUserMagicAuthToken' },
                userId: String(result.user.id),
              },
            );
            return { code: 'FAILURE', message: 'Failed to start session.' };
          }

          return { token: sessionToken, item: result.user };
        },
      }),
    },
  };
};
