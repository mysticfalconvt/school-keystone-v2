import {
  createTransport,
  getTestMessageUrl,
  SendMailOptions,
  SentMessageInfo,
} from 'nodemailer';

import 'dotenv/config';

const mailPort = Number(process.env.MAIL_PORT || 587);

if (!process.env.MAIL_HOST || !process.env.MAIL_USER || !process.env.MAIL_PASS) {
  throw new Error('MAIL_HOST, MAIL_USER, and MAIL_PASS must be configured');
}

if (!Number.isInteger(mailPort) || mailPort <= 0) {
  throw new Error('MAIL_PORT must be a valid port number');
}

const transport = createTransport({
  pool: true,
  host: process.env.MAIL_HOST,
  port: mailPort,
  secure: mailPort === 465,
  requireTLS: mailPort !== 465,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  maxConnections: 2,
  maxMessages: 50,
  rateDelta: 1000,
  rateLimit: 5,
  tls: {
    minVersion: 'TLSv1.2',
  },
});

const RETRY_DELAYS_MS = [2000, 8000];

async function sendMail(options: SendMailOptions): Promise<SentMessageInfo> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await transport.sendMail(options);
    } catch (error) {
      const responseCode =
        error instanceof Error && 'responseCode' in error
          ? Number(error.responseCode)
          : undefined;
      const delayMs = RETRY_DELAYS_MS[attempt];

      if (!delayMs || (responseCode !== 421 && responseCode !== 454)) {
        throw error;
      }

      console.warn('[mail] transient SMTP failure; retrying', {
        responseCode,
        attempt: attempt + 1,
        delayMs,
      });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

function logSentMessage(info: SentMessageInfo) {
  console.log('[mail] message sent', { messageId: info?.messageId });
}

function makeANiceEmail(text: string) {
  return `
    <div className="email" style="
      border: 1px solid black;
      padding: 20px;
      font-family: sans-serif;
      line-height: 2;
      font-size: 20px;
    ">
      <h2>Hello There!</h2>
      <p>${text}</p>

      <p>NCUJHS.Tech</p>
    </div>
  `;
}

export async function sendPasswordResetEmail(
  resetToken: string,
  to: string,
): Promise<void> {
  // email the user a token
  const info = await sendMail({
    to,
    from: process.env.MAIL_USER,
    subject: 'Your password reset token!',
    html: makeANiceEmail(`Your Password Reset Token is here!
      <a href="${process.env.FRONTEND_URL}/reset?token=${resetToken}">Click Here to reset</a>
    `),
  });
  logSentMessage(info);
  if (process.env.MAIL_USER?.includes('ethereal.email')) {
    console.log(`💌 Message Sent!  Preview it at ${getTestMessageUrl(info)}`);
  }
}

export async function sendMagicLinkEmail(
  token: string,
  email: string,
): Promise<void> {
  const info = await sendMail({
    to: email,
    from: process.env.MAIL_USER,
    subject: 'Your Magic Link',
    html: makeANiceEmail(`
      <br/>
      Here is your link to login:
      <a href="${process.env.FRONTEND_URL}/loginLink?token=${token}&email=${email}">Click Here to login</a>
      <br/>
      <p>or copy this link: ${process.env.FRONTEND_URL}/loginLink?token=${token}&email=${email}</p>
    `),
  });
  logSentMessage(info);
  if (process.env.MAIL_USER?.includes('ethereal.email')) {
    console.log(`💌 Message Sent!  Preview it at ${getTestMessageUrl(info)}`);
  }
}

export async function sendAnEmail(
  to: string,
  from: string,
  subject: string,
  body: string,
): Promise<void> {
  const info = await sendMail({
    to,
    from: process.env.MAIL_USER,
    replyTo: from,
    subject,
    html: makeANiceEmail(body),
  });
  logSentMessage(info);
  if (process.env.MAIL_USER?.includes('ethereal.email')) {
    console.log(`💌 Message Sent!  Preview it at ${getTestMessageUrl(info)}`);
  }
}
