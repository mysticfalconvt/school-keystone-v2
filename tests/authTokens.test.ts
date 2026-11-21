import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import bcrypt from 'bcryptjs';
import {
  checkAuthToken,
  generateAuthToken,
  issueAuthToken,
  redeemAuthToken,
  validateAuthToken,
} from '../lib/authTokens';

const MIN = 60_000;

async function stored(token: string, overrides: Record<string, unknown> = {}) {
  return {
    tokenHash: await bcrypt.hash(token, 4),
    issuedAt: new Date(),
    redeemedAt: null,
    ...overrides,
  };
}

describe('auth token rules', () => {
  test('accepts a fresh, unredeemed token', async () => {
    assert.deepEqual(await checkAuthToken(await stored('abc'), 'abc'), {
      ok: true,
    });
  });

  test('a wrong token, a missing token and a missing user all look the same', async () => {
    const failure = { ok: false, code: 'FAILURE' };
    assert.deepEqual(await checkAuthToken(await stored('abc'), 'xyz'), failure);
    assert.deepEqual(
      await checkAuthToken(
        { tokenHash: null, issuedAt: null, redeemedAt: null },
        'abc',
      ),
      failure,
    );
    assert.deepEqual(await checkAuthToken(null, 'abc'), failure);
  });

  test('wrong token is FAILURE even when the stored token is redeemed or expired', async () => {
    const redeemed = await stored('abc', { redeemedAt: new Date() });
    assert.equal(
      ((await checkAuthToken(redeemed, 'xyz')) as any).code,
      'FAILURE',
    );
    const old = await stored('abc', { issuedAt: new Date(Date.now() - 600 * MIN) });
    assert.equal(((await checkAuthToken(old, 'xyz')) as any).code, 'FAILURE');
  });

  test('rejects a redeemed token', async () => {
    const result = await checkAuthToken(
      await stored('abc', { redeemedAt: new Date() }),
      'abc',
    );
    assert.deepEqual(result, { ok: false, code: 'TOKEN_REDEEMED' });
  });

  test('expires after the validity window', async () => {
    const issuedAt = new Date('2026-01-01T00:00:00Z');
    const token = await stored('abc', { issuedAt });
    const at = (mins: number) => issuedAt.getTime() + mins * MIN;
    assert.deepEqual(await checkAuthToken(token, 'abc', at(59), 60), { ok: true });
    assert.deepEqual(await checkAuthToken(token, 'abc', at(61), 60), {
      ok: false,
      code: 'TOKEN_EXPIRED',
    });
  });

  test('treats a missing issue time as expired', async () => {
    const result = await checkAuthToken(
      await stored('abc', { issuedAt: null }),
      'abc',
    );
    assert.deepEqual(result, { ok: false, code: 'TOKEN_EXPIRED' });
  });

  test('generates long, URL-safe, unique tokens', () => {
    const a = generateAuthToken();
    const b = generateAuthToken();
    assert.match(a, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(a, b);
  });
});

// In-memory stand-in for the slice of KeystoneContext the module uses. The
// password field hashes on write, so updateOne does the same here.
function fakeContext(users: Record<string, any>[]) {
  const updates: any[] = [];
  const User = {
    async findOne({ where }: any) {
      return users.find((u) => u.email === where.email) ?? null;
    },
    async updateOne({ where, data }: any) {
      updates.push(data);
      const user = users.find((u) => String(u.id) === where.id)!;
      for (const [key, value] of Object.entries(data)) {
        if (key.endsWith('Token') && typeof value === 'string') {
          user[key] = await bcrypt.hash(value, 4);
        } else if (key.endsWith('At') && typeof value === 'string') {
          user[key] = new Date(value);
        } else {
          user[key] = value;
        }
      }
      return user;
    },
  };
  return {
    updates,
    sudo: () => ({ db: { User } }),
    prisma: {
      user: {
        async updateMany({ where, data }: any) {
          const [field] = Object.keys(data);
          const user = users.find((u) => u.id === where.id);
          if (!user || user[field] != null) return { count: 0 };
          user[field] = data[field];
          return { count: 1 };
        },
      },
    },
  };
}

describe('issuing and redeeming tokens', () => {
  test('issue then redeem once', async () => {
    const users = [{ id: 7, email: 'a@example.test' }];
    const context = fakeContext(users);

    const issued = await issueAuthToken(context, 'magicAuth', 'a@example.test');
    assert.ok(issued);
    assert.equal(issued.userId, '7');
    assert.notEqual((users[0] as any).magicAuthToken, issued.token, 'stored hashed');

    assert.deepEqual(
      await validateAuthToken(context, 'magicAuth', 'a@example.test', issued.token),
      { ok: true },
      'validating does not use the token up',
    );

    const first = await redeemAuthToken(context, 'magicAuth', 'a@example.test', issued.token);
    assert.equal(first.ok, true);

    const second = await redeemAuthToken(context, 'magicAuth', 'a@example.test', issued.token);
    assert.deepEqual(second, { ok: false, code: 'TOKEN_REDEEMED' });
  });

  test('issuing for an unknown email writes nothing', async () => {
    const context = fakeContext([{ id: 1, email: 'a@example.test' }]);
    assert.equal(await issueAuthToken(context, 'passwordReset', 'nobody@example.test'), null);
    assert.equal(context.updates.length, 0);
  });

  test('a new token replaces the old one and clears redemption', async () => {
    const users = [{ id: 1, email: 'a@example.test' }];
    const context = fakeContext(users);
    const first = (await issueAuthToken(context, 'passwordReset', 'a@example.test'))!;
    await redeemAuthToken(context, 'passwordReset', 'a@example.test', first.token);
    const second = (await issueAuthToken(context, 'passwordReset', 'a@example.test'))!;

    assert.equal(
      ((await redeemAuthToken(context, 'passwordReset', 'a@example.test', first.token)) as any).code,
      'FAILURE',
    );
    assert.equal(
      (await redeemAuthToken(context, 'passwordReset', 'a@example.test', second.token)).ok,
      true,
    );
  });

  test('token types are independent', async () => {
    const context = fakeContext([{ id: 1, email: 'a@example.test' }]);
    const reset = (await issueAuthToken(context, 'passwordReset', 'a@example.test'))!;
    assert.equal(
      ((await redeemAuthToken(context, 'magicAuth', 'a@example.test', reset.token)) as any).code,
      'FAILURE',
    );
  });

  test('a lost race to claim the token reports it as redeemed', async () => {
    const users = [{ id: 1, email: 'a@example.test' }];
    const context = fakeContext(users);
    const issued = (await issueAuthToken(context, 'magicAuth', 'a@example.test'))!;
    // Another request claims it between our check and our update.
    context.prisma.user.updateMany = async () => ({ count: 0 });
    assert.deepEqual(
      await redeemAuthToken(context, 'magicAuth', 'a@example.test', issued.token),
      { ok: false, code: 'TOKEN_REDEEMED' },
    );
  });
});
