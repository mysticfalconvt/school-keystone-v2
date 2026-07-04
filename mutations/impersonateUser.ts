import { graphql } from '@keystone-6/core';

/**
 * DEV TOOL — impersonate another user.
 *
 * Mints a Keystone stateless session token for an arbitrary user so a developer
 * can browse the app as them. This is a powerful, account-takeover-shaped
 * capability, so it is locked behind BOTH:
 *   1. `ALLOW_IMPERSONATION === 'true'` (env flag, OFF by default — keep it off
 *      in production), and
 *   2. the caller already being a superadmin.
 *
 * Returns JSON { success, sessionToken?, item?, message? } — the same shape the
 * frontend already handles for password / Google login.
 */
export const impersonateUser = (base: any) =>
  graphql.field({
    type: graphql.JSON,
    args: {
      userId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    },
    resolve: (async (
      source: unknown,
      { userId }: { userId: string },
      context: any,
    ) => {
      // Dev-only: never available in a production build, regardless of flags.
      if (process.env.NODE_ENV === 'production') {
        return { success: false, message: 'Impersonation is disabled' };
      }

      if (process.env.ALLOW_IMPERSONATION !== 'true') {
        return { success: false, message: 'Impersonation is disabled' };
      }

      if (!context.session?.data?.isSuperAdmin) {
        return {
          success: false,
          message: 'Only superadmins can impersonate users',
        };
      }

      const user = await context.sudo().query.User.findOne({
        where: { id: String(userId) },
        query: 'id name email',
      });

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      const sessionToken = await context.sessionStrategy?.start({
        data: { listKey: 'User', itemId: String(user.id) },
        context,
      });

      if (!sessionToken || typeof sessionToken !== 'string') {
        return { success: false, message: 'Could not start session' };
      }

      console.log(
        `[impersonate] ${context.session?.itemId} -> ${user.id} (${user.email})`,
      );

      return {
        success: true,
        sessionToken,
        item: { id: user.id, name: user.name, email: user.email },
      };
    }) as any,
  });
