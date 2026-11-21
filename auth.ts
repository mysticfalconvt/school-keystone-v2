/*
Sessions and the sign-in plumbing that does not depend on passwords.

There are no passwords. People sign in with a magic link
(mutations/authTokens.ts) or Google (mutations/authenticateWithGoogle.ts);
both start a session with `context.sessionStrategy.start`. Super admins reach
the Admin UI through POST /admin-signin (lib/adminSignin.ts), which the
dashboard's "Keystone Admin" button submits.

@keystone-6/auth is no longer used: it requires a password field. This file
provides the two things it did that we still need:
  - session.data: the user fields below, loaded fresh on every request
  - the `authenticatedItem` query and `endSession` mutation
*/

import { graphql } from '@keystone-6/core';
import { statelessSessions } from '@keystone-6/core/session';

let sessionSecret = process.env.SESSION_SECRET;

// Not required in dev, always required in production.
//
// The dev fallback must be at least 32 characters, because that is what
// statelessSessions enforces.
const DEV_SESSION_SECRET =
  'keystone-development-session-secret-not-for-production';

if (!sessionSecret) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'The SESSION_SECRET environment variable must be set in production',
    );
  } else {
    sessionSecret = DEV_SESSION_SECRET;
  }
}

/** User fields available as `context.session.data` in access rules. */
export const SESSION_DATA =
  'name id isSuperAdmin canSeeAllCallback canManageCalendar canSeeOtherUsers canManageUsers canManageRoles canManageLinks canManageDiscipline canSeeAllDiscipline canSeeAllTeacherEvents canSeeStudentEvents canSeeOwnCallback isCommunicatorEnabled canManageCommunicator hasTA hasClasses isStudent isParent isStaff isTeacher isGuidance canManagePbis canHaveSpecialGroups';

// How long people stay signed in. Refreshed when they sign in again.
const sessionMaxAge = 60 * 60 * 24 * 30; // 30 days

const baseSession = statelessSessions({
  maxAge: sessionMaxAge,
  secret: sessionSecret!,
  sameSite: 'lax',
  secure: true,
});

// The sealed token only holds { listKey, itemId }. Load the user's current
// flags on each request, so removing someone's access takes effect at once
// and a deleted user's token stops working.
const session = {
  ...baseSession,
  async get({ context }: { context: any }) {
    const stored: any = await baseSession.get({ context });
    if (!stored?.itemId || stored.listKey !== 'User') return;
    try {
      const data = await context.sudo().query.User.findOne({
        where: { id: stored.itemId },
        query: SESSION_DATA,
      });
      if (!data) return;
      return { ...stored, itemId: stored.itemId, data };
    } catch (error) {
      console.error('[auth] failed to load session data', error);
      return;
    }
  },
};

/** `authenticatedItem` and `endSession`, with the same shape as before. */
export function authSchema(base: any) {
  return {
    query: {
      authenticatedItem: graphql.field({
        type: base.object('User'),
        resolve(_root, _args, context) {
          const itemId = context.session?.itemId;
          if (!itemId) return null;
          return context.db.User.findOne({ where: { id: itemId } });
        },
      }),
    },
    mutation: {
      endSession: graphql.field({
        type: graphql.nonNull(graphql.Boolean),
        async resolve(_root, _args, context) {
          await context.sessionStrategy?.end({ context });
          return true;
        },
      }),
    },
  };
}

export { session };
