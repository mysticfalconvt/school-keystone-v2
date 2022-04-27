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
  // console.log(session?.data?.isSuperAdmin)

  const isAllowed = hasSession || isAuth;

  // console.log("itemId", itemId)
  // return !!session;
  return !!isAllowed;
}

export function isAdmin({ session, context}: ListAccessArgs) {
  const isSuperAdmin = session?.data?.isSuperAdmin || false;

  return !!isSuperAdmin;
}
