import { graphql } from '@keystone-6/core';
import { OAuth2Client } from 'google-auth-library';
import { captureError } from '../lib/bugsink';

// The OAuth client ID created in Google Cloud (type: Web application).
// Must be the SAME id the frontend uses to render the Google Sign-In button,
// because we verify the token's audience against it.
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;

const client = new OAuth2Client();

/**
 * Authenticate an EXISTING user via a Google ID token.
 *
 * Google is used only to *identify* a user that already exists in the `User`
 * list — this mutation never creates accounts. Students/staff arrive on their
 * `@ncsuvt.org` Workspace accounts and parents on their personal emails; in
 * both cases the verified Google email must already match a stored user.
 *
 * Returns JSON: { success, sessionToken?, item?, message? } — mirroring the
 * shape the frontend already handles for password auth.
 */
export const authenticateUserWithGoogle = (base: any) =>
  graphql.field({
    type: graphql.JSON,
    args: {
      idToken: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    },
    // Cast to any: the resolver returns a small JSON object, but the inferred
    // union of branches includes optional `undefined` props which the strict
    // JSONValue type rejects. The runtime shape is valid JSON.
    resolve: (async (source: unknown, { idToken }: { idToken: string }, context: any) => {
      if (!CLIENT_ID) {
        console.error(
          '[auth] authenticateUserWithGoogle: GOOGLE_OAUTH_CLIENT_ID is not set',
        );
        return { success: false, message: 'Google sign-in is not configured' };
      }

      // 1. Verify the Google ID token: signature, audience (our client id), expiry.
      let payload;
      try {
        const ticket = await client.verifyIdToken({
          idToken,
          audience: CLIENT_ID,
        });
        payload = ticket.getPayload();
      } catch (err) {
        console.warn('[auth] Google ID token verification failed', err);
        return { success: false, message: 'Invalid Google sign-in' };
      }

      if (!payload?.email || payload.email_verified !== true) {
        return {
          success: false,
          message: 'Your Google account email is not verified',
        };
      }

      const email = payload.email.toLowerCase();

      // 2. Find an EXISTING user by verified email. sudo() bypasses read access
      //    control for this unauthenticated lookup. We never create a user.
      const user = await context.sudo().query.User.findOne({
        where: { email },
        query: 'id name email',
      });

      if (!user) {
        console.log('[auth] Google sign-in: no account for', email, {
          hd: payload.hd,
        });
        return {
          success: false,
          message: 'No account found for this Google email',
        };
      }

      // 3. Mint a Keystone stateless session token — same data shape the auth
      //    package uses for password/magic-link login.
      const sessionToken = await context.sessionStrategy?.start({
        data: { listKey: 'User', itemId: String(user.id) },
        context,
      });

      if (!sessionToken || typeof sessionToken !== 'string') {
        console.error('[auth] Google sign-in: failed to start session');
        // A rejected token is normal; failing to mint a session for a verified,
        // known user is not.
        captureError(
          new Error('Google sign-in: sessionStrategy.start returned no token'),
          {
            tags: { mutation: 'authenticateUserWithGoogle' },
            userId: String(user.id),
          },
        );
        return { success: false, message: 'Could not start session' };
      }

      return {
        success: true,
        sessionToken,
        item: { id: user.id, name: user.name, email: user.email },
      };
    }) as any,
  });
