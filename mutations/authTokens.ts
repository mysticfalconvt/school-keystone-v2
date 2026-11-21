import { graphql } from '@keystone-6/core';
import { captureError } from '../lib/bugsink';
import {
  AUTH_TOKEN_ERROR_CODES,
  AUTH_TOKEN_ERROR_MESSAGES,
  type AuthTokenErrorCode,
  type AuthTokenType,
  issueAuthToken,
  redeemAuthToken,
  validateAuthToken,
} from '../lib/authTokens';
import {
  enqueueMagicLinkEmail,
  enqueuePasswordResetEmail,
} from '../lib/emailQueue';

// Password reset and magic-link GraphQL operations.
//
// These replace the ones @keystone-6/auth generated from its `passwordResetLink`
// and `magicAuthLink` options (removed in auth v10). Every name and shape below
// matches what the auth package produced, so schema.graphql and the frontend
// are unaffected:
//
//   sendUserPasswordResetLink(email): Boolean!
//   redeemUserPasswordResetToken(email, token, password): RedeemUserPasswordResetTokenResult
//   validateUserPasswordResetToken(email, token): ValidateUserPasswordResetTokenResult   (query)
//   sendUserMagicAuthLink(email): Boolean!
//   redeemUserMagicAuthToken(email, token): RedeemUserMagicAuthTokenResult!

const PasswordResetRedemptionErrorCode = graphql.enum({
  name: 'PasswordResetRedemptionErrorCode',
  values: graphql.enumValues(AUTH_TOKEN_ERROR_CODES),
});

const MagicLinkRedemptionErrorCode = graphql.enum({
  name: 'MagicLinkRedemptionErrorCode',
  values: graphql.enumValues(AUTH_TOKEN_ERROR_CODES),
});

type Failure = { code: AuthTokenErrorCode; message: string };

const failure = (code: AuthTokenErrorCode): Failure => ({
  code,
  message: AUTH_TOKEN_ERROR_MESSAGES[code],
});

const passwordResetResult = (name: string) =>
  graphql.object<Failure>()({
    name,
    fields: {
      code: graphql.field({
        type: graphql.nonNull(PasswordResetRedemptionErrorCode),
      }),
      message: graphql.field({ type: graphql.nonNull(graphql.String) }),
    },
  });

const RedeemUserPasswordResetTokenResult = passwordResetResult(
  'RedeemUserPasswordResetTokenResult',
);
const ValidateUserPasswordResetTokenResult = passwordResetResult(
  'ValidateUserPasswordResetTokenResult',
);

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
      sendUserPasswordResetLink: sendLink(
        'passwordReset',
        enqueuePasswordResetEmail,
      ),

      redeemUserPasswordResetToken: graphql.field({
        type: RedeemUserPasswordResetTokenResult,
        args: {
          email: emailArg,
          token: tokenArg,
          password: graphql.arg({ type: graphql.nonNull(graphql.String) }),
        },
        async resolve(_root, { email, token, password }, context: any) {
          const result = await redeemAuthToken(
            context,
            'passwordReset',
            email,
            token,
          );
          if (!result.ok) return failure(result.code);

          // Separate from the redemption so that a password the field rejects
          // still uses up the token, as the auth package did. The validation
          // error reaches the client as a GraphQL error.
          await context.sudo().db.User.updateOne({
            where: { id: String(result.user.id) },
            data: { password },
          });
          return null;
        },
      }),

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

    query: {
      validateUserPasswordResetToken: graphql.field({
        type: ValidateUserPasswordResetTokenResult,
        args: { email: emailArg, token: tokenArg },
        async resolve(_root, { email, token }, context: any) {
          const result = await validateAuthToken(
            context,
            'passwordReset',
            email,
            token,
          );
          return result.ok ? null : failure(result.code);
        },
      }),
    },
  };
};
