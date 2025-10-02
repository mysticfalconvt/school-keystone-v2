import { ListAccessArgs } from './types';
// At it's simplest, the access control returns a yes or no value depending on the users session

export function isSignedIn({ session, context }: ListAccessArgs) {
  // check if user is signed in, or if they sent the header to access the list

  // console.log(context)
  // console.log("context", context.req.rawHeaders)

  // Get the authentication header from environment variable
  const authHeader = process.env.AUTH_HEADER_SECRET;

  // Security check: ensure the environment variable is set
  if (!authHeader) {
    console.warn(
      'AUTH_HEADER_SECRET environment variable is not set. Authentication header check will be disabled.',
    );
    // In production, you might want to throw an error instead
    if (process.env.NODE_ENV === 'production') {
      console.error('AUTH_HEADER_SECRET is required in production environment');
    }
  }

  // Check if the request includes the authentication header
  const isAuth = authHeader
    ? context?.req?.rawHeaders?.includes(authHeader)
    : false;
  // console.log("isAuth", isAuth)
  const hasSession = !!session;
  // console.log(session?.data?.isSuperAdmin)
  // console.log('hasSession', hasSession, 'isAuth', isAuth);
  const isAllowed = hasSession || isAuth;

  // console.log("itemId", itemId)
  // return !!session;
  return !!isAllowed;
}

export function isAdmin({ session, context }: ListAccessArgs) {
  const isSuperAdmin = session?.data?.isSuperAdmin || false;

  return !!isSuperAdmin;
}
