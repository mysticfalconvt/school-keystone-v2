import type { KeystoneContext } from '@keystone-6/core/types';
import type { SendMailOptions } from 'nodemailer';
import { randomUUID } from 'node:crypto';
import { captureError } from './bugsink';
import { deliverEmail, makeANiceEmail } from './mail';

type QueueContext = Pick<KeystoneContext, 'prisma'>;

type QueueEmailInput = {
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  lowPriority?: boolean;
  kind?: 'general' | 'pbis-bulk' | 'magic-link' | 'password-reset';
  batchId?: string;
  requestedById?: string;
  expiresAt?: Date;
};

type ClaimedEmail = {
  id: string;
  recipient: string;
  replyTo: string | null;
  subject: string;
  html: string;
  kind: string;
  lowPriority: boolean;
  batchId: string | null;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date | null;
  lockId: string;
};

const NETWORK_RETRY_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'EDNS',
  'ECONNECTION',
  'ENETDOWN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ESOCKET',
]);
const RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000];
const POLL_INTERVAL_MS = 2_000;
const STALE_LOCK_MS = 5 * 60_000;

function queueModel(context: QueueContext): any {
  return (context.prisma as any).emailDelivery;
}

function requireText(value: string, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${name} is required`);
  return trimmed;
}

export async function enqueueEmail(
  context: QueueContext,
  input: QueueEmailInput,
): Promise<string> {
  const row = await queueModel(context).create({
    data: {
      recipient: requireText(input.to, 'Email recipient'),
      replyTo: input.replyTo?.trim() || '',
      subject: requireText(input.subject, 'Email subject'),
      html: requireText(input.html, 'Email body'),
      kind: input.kind || 'general',
      lowPriority: !!input.lowPriority,
      batchId: input.batchId?.trim() || '',
      requestedById: input.requestedById || '',
      status: 'pending',
      attempts: 0,
      maxAttempts: 5,
      nextAttemptAt: new Date(),
      expiresAt: input.expiresAt || null,
    },
    select: { id: true },
  });

  return row.id;
}

export function enqueueGeneralEmail(
  context: QueueContext,
  input: {
    to: string;
    from: string;
    subject: string;
    body: string;
    lowPriority?: boolean;
    batchId?: string;
    requestedById?: string;
  },
) {
  return enqueueEmail(context, {
    to: input.to,
    replyTo: input.from,
    subject: input.subject,
    html: makeANiceEmail(input.body),
    lowPriority: input.lowPriority,
    kind: input.lowPriority ? 'pbis-bulk' : 'general',
    batchId: input.batchId,
    requestedById: input.requestedById,
  });
}

export function enqueueMagicLinkEmail(
  context: QueueContext,
  token: string,
  email: string,
) {
  const url = `${process.env.FRONTEND_URL}/loginLink?token=${token}&email=${email}`;
  return enqueueEmail(context, {
    to: email,
    subject: 'Your Magic Link',
    kind: 'magic-link',
    expiresAt: new Date(Date.now() + 55 * 60_000),
    html: makeANiceEmail(`
      <br/>
      Here is your link to login:
      <a href="${url}">Click Here to login</a>
      <br/>
      <p>or copy this link: ${url}</p>
    `),
  });
}

export function enqueuePasswordResetEmail(
  context: QueueContext,
  resetToken: string,
  email: string,
) {
  return enqueueEmail(context, {
    to: email,
    subject: 'Your password reset token!',
    kind: 'password-reset',
    expiresAt: new Date(Date.now() + 55 * 60_000),
    html: makeANiceEmail(`Your Password Reset Token is here!
      <a href="${process.env.FRONTEND_URL}/reset?token=${resetToken}">Click Here to reset</a>
    `),
  });
}

function errorDetails(error: unknown) {
  const record = error && typeof error === 'object' ? (error as any) : {};
  const responseCode = Number(record.responseCode) || undefined;
  const code = typeof record.code === 'string' ? record.code : undefined;
  const command = typeof record.command === 'string' ? record.command : undefined;
  const message = error instanceof Error ? error.message : String(error);
  return {
    responseCode,
    code,
    command,
    message: message.replace(/[\r\n]+/g, ' ').slice(0, 1_000),
  };
}

export function isRetryableEmailError(error: unknown): boolean {
  const details = errorDetails(error);
  return (
    (details.responseCode !== undefined &&
      details.responseCode >= 400 &&
      details.responseCode < 500) ||
    (details.code !== undefined && NETWORK_RETRY_CODES.has(details.code))
  );
}

function retryAt(attempts: number): Date {
  const baseDelay = RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)];
  const jitter = Math.floor(baseDelay * Math.random() * 0.2);
  return new Date(Date.now() + baseDelay + jitter);
}

async function expireOldJobs(context: QueueContext) {
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS);
  await queueModel(context).updateMany({
    where: {
      status: { in: ['pending', 'retrying'] },
      expiresAt: { lte: new Date() },
    },
    data: {
      status: 'failed',
      html: '',
      lastError: 'Email expired before it could be delivered',
      lockedAt: null,
      lockId: '',
    },
  });
  await queueModel(context).updateMany({
    where: {
      status: { equals: 'processing' },
      expiresAt: { lte: new Date() },
      lockedAt: { lt: staleBefore },
    },
    data: {
      status: 'failed',
      html: '',
      lastError: 'Email expired before it could be delivered',
      lockedAt: null,
      lockId: '',
    },
  });

  await context.prisma.$executeRaw`
    UPDATE "EmailDelivery"
    SET
      "status" = 'failed',
      "html" = '',
      "lastError" = CASE
        WHEN "lastError" = '' THEN 'Email exhausted its delivery attempts'
        ELSE "lastError"
      END,
      "lockedAt" = NULL,
      "lockId" = ''
    WHERE
      "attempts" >= "maxAttempts"
      AND (
        "status" IN ('pending', 'retrying')
        OR ("status" = 'processing' AND "lockedAt" < ${staleBefore})
      )
  `;
}

async function claimNextEmail(context: QueueContext): Promise<ClaimedEmail | null> {
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS);
  const lockId = randomUUID();
  const rows = await context.prisma.$queryRaw<ClaimedEmail[]>`
    UPDATE "EmailDelivery"
    SET
      "status" = 'processing',
      "lockedAt" = NOW(),
      "lockId" = ${lockId},
      "lastAttemptAt" = NOW(),
      "attempts" = "attempts" + 1
    WHERE "id" = (
      SELECT "id"
      FROM "EmailDelivery"
      WHERE
        (
          ("status" IN ('pending', 'retrying') AND "nextAttemptAt" <= NOW())
          OR ("status" = 'processing' AND "lockedAt" < ${staleBefore})
        )
        AND "attempts" < "maxAttempts"
        AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
      ORDER BY "lowPriority" ASC, "nextAttemptAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING
      "id", "recipient", "replyTo", "subject", "html", "kind",
      "lowPriority", "batchId", "attempts", "maxAttempts", "expiresAt", "lockId"
  `;
  return rows[0] || null;
}

async function processEmail(context: QueueContext, job: ClaimedEmail) {
  const options: SendMailOptions = {
    to: job.recipient,
    from: process.env.MAIL_USER,
    subject: job.subject,
    html: job.html,
  };
  if (job.replyTo) options.replyTo = job.replyTo;

  try {
    const info = await deliverEmail(options);
    const result = await queueModel(context).updateMany({
      where: { id: { equals: job.id }, lockId: { equals: job.lockId } },
      data: {
        status: 'sent',
        sentAt: new Date(),
        providerMessageId: info?.messageId || '',
        lastError: '',
        lockedAt: null,
        lockId: '',
        html: '',
      },
    });
    if (result.count === 0) {
      console.warn('[mail-queue] delivery completed after its lease was lost', {
        jobId: job.id,
      });
      return;
    }
  } catch (error) {
    const details = errorDetails(error);
    const retryable = isRetryableEmailError(error);
    const willRetry = retryable && job.attempts < job.maxAttempts;

    const result = await queueModel(context).updateMany({
      where: { id: { equals: job.id }, lockId: { equals: job.lockId } },
      data: willRetry
        ? {
            status: 'retrying',
            nextAttemptAt: retryAt(job.attempts),
            lastError: details.message,
            lockedAt: null,
            lockId: '',
          }
        : {
            status: 'failed',
            lastError: details.message,
            lockedAt: null,
            lockId: '',
            html: '',
          },
    });
    if (result.count === 0) {
      console.warn('[mail-queue] failed attempt completed after its lease was lost', {
        jobId: job.id,
      });
      return;
    }

    if (willRetry) {
      console.warn('[mail-queue] transient failure; retry scheduled', {
        jobId: job.id,
        attempt: job.attempts,
        responseCode: details.responseCode,
        code: details.code,
      });
      return;
    }

    captureError(error, {
      tags: { source: 'email-queue', kind: job.kind },
      extra: {
        jobId: job.id,
        batchId: job.batchId,
        attempts: job.attempts,
        responseCode: details.responseCode,
        code: details.code,
        command: details.command,
      },
    });
    console.error('[mail-queue] delivery failed', {
      jobId: job.id,
      kind: job.kind,
      attempt: job.attempts,
      responseCode: details.responseCode,
      code: details.code,
    });
  }
}

export function startEmailQueueWorker(
  context: QueueContext,
  onStop: (callback: () => void) => void,
) {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  onStop(() => {
    stopped = true;
    if (timer) clearTimeout(timer);
  });

  const run = async () => {
    if (stopped) return;
    try {
      await expireOldJobs(context);
      const job = await claimNextEmail(context);
      if (job) await processEmail(context, job);
    } catch (error) {
      console.error('[mail-queue] worker iteration failed');
      captureError(error, { tags: { source: 'email-queue', step: 'worker' } });
    } finally {
      if (!stopped) timer = setTimeout(run, POLL_INTERVAL_MS);
    }
  };

  void run();
}
