import {
  createTransport,
  getTestMessageUrl,
  SentMessageInfo,
} from 'nodemailer';

import 'dotenv/config';

const transport = createTransport({
  service: 'gmail',
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    ciphers: 'SSLv3',
  },
});

const devTransport = createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

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
  const info: SentMessageInfo = await transport.sendMail({
    to,
    from: process.env.MAIL_USER,
    subject: 'Your password reset token!',
    html: makeANiceEmail(`Your Password Reset Token is here!
      <a href="${process.env.FRONTEND_URL}/reset?token=${resetToken}">Click Here to reset</a>
    `),
  });
  if (process.env.MAIL_USER?.includes('ethereal.email')) {
    console.log(`💌 Message Sent!  Preview it at ${getTestMessageUrl(info)}`);
  }
}

export async function sendMagicLinkEmail(
  token: string,
  email: string,
): Promise<void> {
  // email the user a token
  if (process.env.NODE_ENV === 'development') {
    const info: SentMessageInfo = await devTransport.sendMail({
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
    console.log(info);
  } else {
    const info: SentMessageInfo = await transport.sendMail({
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
  }
}

export async function sendAnEmail(
  to: string,
  from: string,
  subject: string,
  body: string,
): Promise<void> {
  console.log(process.env.MAIL_HOST);
  console.log(process.env.MAIL_USER);
  console.log(process.env.MAIL_PASS);
  console.log(process.env.MAIL_PORT);
  // console.log('to', to);
  // console.log('from', from);
  // console.log('subject', subject);
  // console.log('body', body);
  if (process.env.NODE_ENV === 'development') {
    const info: SentMessageInfo = await devTransport.sendMail({
      to,
      from: process.env.MAIL_USER,
      replyTo: from,
      subject,
      html: makeANiceEmail(body),
    });
    console.log(info);
  } else {
    const info: SentMessageInfo = await transport.sendMail({
      to,
      from: process.env.MAIL_USER,
      replyTo: from,
      subject,
      html: makeANiceEmail(body),
    });
    console.log(info);
    if (process.env.MAIL_USER?.includes('ethereal.email')) {
      console.log(`💌 Message Sent!  Preview it at ${getTestMessageUrl(info)}`);
    }
  }
}
