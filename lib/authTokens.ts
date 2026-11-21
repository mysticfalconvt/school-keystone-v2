import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

// One-time email tokens for password reset and magic-link sign in.
//
// These used to come from @keystone-6/auth's `passwordResetLink` and
// `magicAuthLink` options, which auth v10 (Keystone 8) removes. This module
// keeps the same storage and behaviour so tokens, columns and the GraphQL
// contract carry over unchanged:
//
//   - The token is stored bcrypt-hashed in a `password` field on User
//     (`<type>Token`), next to `<type>IssuedAt` and `<type>RedeemedAt`.
//   - Tokens are single use and valid for AUTH_TOKEN_VALID_MINS.
//   - An unknown email, a missing token and a wrong token all return FAILURE,
//     after the same bcrypt work, so a caller cannot tell which emails exist.
//
// Two deliberate improvements over the auth package:
//   - Redemption is claimed atomically (`redeemedAt IS NULL` in the UPDATE), so
//     two concurrent requests cannot both redeem one token.
//   - Tokens carry 256 bits of randomness instead of 120.

export type AuthTokenType = 'passwordReset' | 'magicAuth';

export const AUTH_TOKEN_ERROR_CODES = [
  'FAILURE',
  'TOKEN_EXPIRED',
  'TOKEN_REDEEMED',
] as const;
export type AuthTokenErrorCode = (typeof AUTH_TOKEN_ERROR_CODES)[number];

export const AUTH_TOKEN_VALID_MINS = 60;

// Same wording the auth package returned, which the frontend may display.
export const AUTH_TOKEN_ERROR_MESSAGES: Record<AuthTokenErrorCode, string> = {
  FAILURE: 'Auth token redemption failed.',
  TOKEN_EXPIRED: 'The auth token provided has expired.',
  TOKEN_REDEEMED:
    'Auth tokens are single use and the auth token provided has already been redeemed.',
};

export type AuthTokenCheck =
  | { ok: true }
  | { ok: false; code: AuthTokenErrorCode };

export interface StoredAuthToken {
  tokenHash: string | null | undefined;
  issuedAt: Date | null | undefined;
  redeemedAt: Date | null | undefined;
}

export function authTokenFieldKeys(type: AuthTokenType) {
  return {
    token: `${type}Token`,
    issuedAt: `${type}IssuedAt`,
    redeemedAt: `${type}RedeemedAt`,
  } as const;
}

export function generateAuthToken(): string {
  return randomBytes(32).toString('base64url');
}

// Hash compared against when there is no stored token, so the "no such user"
// path costs the same as a real comparison. Created on first use rather than at
// import so it does not slow down boot or the test runner.
let timingHash: Promise<string> | undefined;
function getTimingHash() {
  timingHash ??= bcrypt.hash('simulated-token-to-counter-timing-attack', 10);
  return timingHash;
}

/**
 * Decide whether `token` redeems `stored`. Pure apart from the bcrypt work, so
 * the rules can be tested without a database.
 */
export async function checkAuthToken(
  stored: StoredAuthToken | null,
  token: string,
  now: number = Date.now(),
  validForMins: number = AUTH_TOKEN_VALID_MINS,
): Promise<AuthTokenCheck> {
  if (!stored?.tokenHash) {
    await bcrypt.compare(token, await getTimingHash());
    return { ok: false, code: 'FAILURE' };
  }

  if (!(await bcrypt.compare(token, stored.tokenHash))) {
    return { ok: false, code: 'FAILURE' };
  }

  // Past this point the caller has proven they hold the token, so it is safe to
  // be specific about why it cannot be used.
  if (stored.redeemedAt) return { ok: false, code: 'TOKEN_REDEEMED' };

  const issuedAt = stored.issuedAt?.getTime();
  if (issuedAt === undefined || Number.isNaN(issuedAt)) {
    return { ok: false, code: 'TOKEN_EXPIRED' };
  }
  if (now - issuedAt > validForMins * 60_000) {
    return { ok: false, code: 'TOKEN_EXPIRED' };
  }

  return { ok: true };
}

// The narrow slice of KeystoneContext this module touches, so tests can pass a
// fake.
export interface AuthTokenContext {
  sudo(): { db: { User: any } };
  prisma: { user: { updateMany(args: any): Promise<{ count: number }> } };
}

/**
 * Create and store a new token for the user with `email`. Returns null when no
 * such user exists; callers must not reveal that difference to the client.
 */
export async function issueAuthToken(
  context: AuthTokenContext,
  type: AuthTokenType,
  email: string,
): Promise<{ token: string; userId: string } | null> {
  const users = context.sudo().db.User;
  const user = await users.findOne({ where: { email } });
  if (!user) return null;

  const keys = authTokenFieldKeys(type);
  const token = generateAuthToken();
  await users.updateOne({
    where: { id: String(user.id) },
    data: {
      [keys.token]: token,
      [keys.issuedAt]: new Date().toISOString(),
      [keys.redeemedAt]: null,
    },
  });

  return { token, userId: String(user.id) };
}

async function findAndCheck(
  context: AuthTokenContext,
  type: AuthTokenType,
  email: string,
  token: string,
) {
  const keys = authTokenFieldKeys(type);
  const user = await context.sudo().db.User.findOne({ where: { email } });
  const check = await checkAuthToken(
    user
      ? {
          tokenHash: user[keys.token],
          issuedAt: user[keys.issuedAt],
          redeemedAt: user[keys.redeemedAt],
        }
      : null,
    token,
  );
  return { user, check };
}

/** Check a token without using it up. */
export async function validateAuthToken(
  context: AuthTokenContext,
  type: AuthTokenType,
  email: string,
  token: string,
): Promise<AuthTokenCheck> {
  return (await findAndCheck(context, type, email, token)).check;
}

/**
 * Check a token and mark it redeemed. Returns the stored user on success.
 */
export async function redeemAuthToken(
  context: AuthTokenContext,
  type: AuthTokenType,
  email: string,
  token: string,
): Promise<
  { ok: true; user: { id: string | number; [key: string]: unknown } } | {
    ok: false;
    code: AuthTokenErrorCode;
  }
> {
  const { user, check } = await findAndCheck(context, type, email, token);
  if (!check.ok) return check;

  // Claim the token in the same statement that checks it is unclaimed. Prisma
  // directly rather than the Keystone db API, which has no conditional update;
  // these are hidden bookkeeping fields with no hooks to skip.
  const keys = authTokenFieldKeys(type);
  const claimed = await context.prisma.user.updateMany({
    where: { id: user.id, [keys.redeemedAt]: null },
    data: { [keys.redeemedAt]: new Date() },
  });
  if (claimed.count === 0) return { ok: false, code: 'TOKEN_REDEEMED' };

  return { ok: true, user };
}
