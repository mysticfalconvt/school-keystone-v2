import {
  createTransport,
  getTestMessageUrl,
  SendMailOptions,
  SentMessageInfo,
  type Transporter,
} from 'nodemailer';

import 'dotenv/config';

// Configuration is validated on first send, not at import.
//
// This module used to throw while loading, which made a missing MAIL_* variable
// fatal to the whole process rather than to the emails that need it. Keystone
// imports the built config to generate artifacts, so `keystone postinstall` -
// and therefore `npm ci` - failed anywhere the mail credentials were not
// present, CI included. The same shape as lmStudio's endpoint check, and for
// the same reason: a singleton that throws at construction takes the server
// down at boot instead of failing the one request that needs it.
let transport: Transporter | null = null;

function getRequireTls(mailPort: number): boolean {
  const configured = process.env.MAIL_REQUIRE_TLS;
  if (configured === undefined || configured === '') return mailPort === 587;
  if (configured === 'true' || configured === '1') return true;
  if (configured === 'false' || configured === '0') return false;
  throw new Error('MAIL_REQUIRE_TLS must be true or false');
}

function getTransport(): Transporter {
  if (transport) return transport;

  const mailPort = Number(process.env.MAIL_PORT || 587);

  if (
    !process.env.MAIL_HOST ||
    !process.env.MAIL_USER ||
    !process.env.MAIL_PASS
  ) {
    throw new Error('MAIL_HOST, MAIL_USER, and MAIL_PASS must be configured');
  }

  if (!Number.isInteger(mailPort) || mailPort <= 0) {
    throw new Error('MAIL_PORT must be a valid port number');
  }

  transport = createTransport({
    pool: true,
    host: process.env.MAIL_HOST,
    port: mailPort,
    secure: mailPort === 465,
    requireTLS: getRequireTls(mailPort),
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    maxConnections: 2,
    maxMessages: 50,
    rateDelta: 1000,
    rateLimit: 5,
    connectionTimeout: 30_000,
    greetingTimeout: 30_000,
    socketTimeout: 120_000,
    tls: {
      minVersion: 'TLSv1.2',
    },
  });

  return transport;
}

export async function deliverEmail(
  options: SendMailOptions,
): Promise<SentMessageInfo> {
  return getTransport().sendMail(options);
}

function logSentMessage(info: SentMessageInfo) {
  console.log('[mail] message sent', { messageId: info?.messageId });
}

export function makeANiceEmail(text: string) {
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
  const info = await deliverEmail({
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
  const info = await deliverEmail({
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
  const info = await deliverEmail({
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
