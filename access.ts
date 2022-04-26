import { permissionsList } from './schemas/fields';
import { ListAccessArgs } from './types';
import { Session } from './types';
import { SessionContext } from '@keystone-6/core/types';
import { KeystoneContext } from '@keystone-6/core/types';
// At it's simplest, the access control returns a yes or no value depending on the users session

export function isSignedIn({ session, context}: ListAccessArgs) {
// check if user is signed in, or if they sent the header to access the list

// console.log(context)
  // console.log("context", context.req.rawHeaders)
  const isAuth = context?.req?.rawHeaders?.includes("test auth for keystone")
  // console.log("isAuth", isAuth)
  const hasSession = !!session;
  console.log(session?.data?.isSuperAdmin)

  const isAllowed = hasSession || isAuth;

  // console.log("itemId", itemId)
  // return !!session;
  return isAllowed;
}

export function isAdmin({ session, context}: ListAccessArgs) {
  const isSuperAdmin = session?.data?.isSuperAdmin;

  return isSuperAdmin;
}

const generatedPermissions = Object.fromEntries(
  permissionsList.map((permission) => [
    permission,
    function ({ session }: ListAccessArgs) {
      return !!session?.data[permission];
    },
  ]),
);
// Permissions check if someone meets a criteria - yes or no.
export const permissions = {
  ...generatedPermissions,

};

// Rule based function
// Rules can return a boolean - yes or no - or a filter which limits which products they can CRUD.
export const rules = {
  canManageCalendar({ session }: ListAccessArgs) {
    if (!isSignedIn({ session })) {
      return false;
    }
    // 1. Do they have the permission of canManageProducts
    if (permissions.canManageCalendar({ session })) {
      return true;
    }
    // 2. If not, do they own this item?
    return false;
  },
  canViewCalendar({ session }: ListAccessArgs) {
    if (!isSignedIn({ session })) {
      return false;
    }
    // 1. Do they have the permission of canManageProducts
    if (permissions.canManageCalendar({ session })) {
      return true;
    }
    // 2. If not, do they own this item?
    return false;
  },
  canSeeLinks({ session }: ListAccessArgs) {
    if (!isSignedIn({ session })) {
      return false;
    }

    if (permissions.isStaff({ session })) {
      return { forTeachers: true }
    }
  },
  canManageLinks({ session }: ListAccessArgs) {
    if (!isSignedIn({ session })) {
      return false;
    }
    // 1. Do they have the permission of canManageProducts
    if (permissions.canManageLinks({ session })) {
      return true;
    }
    // 2. If not, do they own this item?
    return false;
  },
  canManageUsers({ session }: ListAccessArgs) {
    if (!isSignedIn({ session })) {
      return false;
    }

    // Otherwise they may only update themselves!
    return { id: session.itemId };
  },
};
