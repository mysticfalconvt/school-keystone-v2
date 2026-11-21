import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  enqueueGeneralEmail,
  enqueueMagicLinkEmail,
  enqueuePasswordResetEmail,
  isRetryableEmailError,
} from '../lib/emailQueue';

describe('email queue retries', () => {
  test('retries temporary SMTP responses and socket resets', () => {
    assert.equal(isRetryableEmailError({ responseCode: 451 }), true);
    assert.equal(isRetryableEmailError({ code: 'ECONNRESET' }), true);
    assert.equal(isRetryableEmailError({ code: 'ESOCKET' }), true);
    assert.equal(isRetryableEmailError({ code: 'EDNS' }), true);
    assert.equal(isRetryableEmailError({ code: 'ECONNECTION' }), true);
  });

  test('does not retry permanent SMTP responses', () => {
    assert.equal(isRetryableEmailError({ responseCode: 550 }), false);
    assert.equal(isRetryableEmailError({ code: 'EAUTH' }), false);
  });
});

describe('email queue inserts', () => {
  test('defaults ordinary email to normal priority', async () => {
    let data: Record<string, unknown> | undefined;
    const context = {
      prisma: {
        emailDelivery: {
          create: async (args: { data: Record<string, unknown> }) => {
            data = args.data;
            return { id: 'job-1' };
          },
        },
      },
    } as any;

    await enqueueGeneralEmail(context, {
      to: 'recipient@example.test',
      from: 'sender@example.test',
      subject: 'Subject',
      body: 'Body',
    });

    assert.equal(data?.lowPriority, false);
    assert.equal(data?.kind, 'general');
    assert.equal(data?.status, 'pending');
  });

  test('records PBIS batch email as low priority', async () => {
    let data: Record<string, unknown> | undefined;
    const context = {
      prisma: {
        emailDelivery: {
          create: async (args: { data: Record<string, unknown> }) => {
            data = args.data;
            return { id: 'job-2' };
          },
        },
      },
    } as any;

    await enqueueGeneralEmail(context, {
      to: 'recipient@example.test',
      from: 'sender@example.test',
      subject: 'PBIS',
      body: 'Congratulations',
      lowPriority: true,
      batchId: 'pbis-week-1',
    });

    assert.equal(data?.lowPriority, true);
    assert.equal(data?.kind, 'pbis-bulk');
    assert.equal(data?.batchId, 'pbis-week-1');
  });
});

describe('sign-in emails supersede older queued ones', () => {
  function recordingContext() {
    const calls: { op: string; args: any }[] = [];
    const context = {
      prisma: {
        emailDelivery: {
          updateMany: async (args: any) => {
            calls.push({ op: 'updateMany', args });
            return { count: 1 };
          },
          create: async (args: any) => {
            calls.push({ op: 'create', args });
            return { id: 'job-3' };
          },
        },
      },
    } as any;
    return { calls, context };
  }

  for (const [name, enqueue, kind] of [
    ['magic link', enqueueMagicLinkEmail, 'magic-link'],
    ['password reset', enqueuePasswordResetEmail, 'password-reset'],
  ] as const) {
    test(`${name}: retires unsent emails of the same kind before queueing`, async () => {
      const { calls, context } = recordingContext();
      await enqueue(context, 'tok', 'person@example.test');

      assert.deepEqual(
        calls.map((c) => c.op),
        ['updateMany', 'create'],
        'supersede runs before the new email is queued',
      );
      const { where, data } = calls[0].args;
      assert.deepEqual(where, {
        recipient: { equals: 'person@example.test' },
        kind: { equals: kind },
        status: { in: ['pending', 'retrying'] },
      });
      assert.equal(data.status, 'failed');
      assert.equal(data.html, '', 'dead link is not kept');
      assert.equal(calls[1].args.data.kind, kind);
    });
  }
});
