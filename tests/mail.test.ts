// Mail configuration must not be required to import this module.
//
// It used to throw while loading, which made a missing MAIL_* variable fatal to
// the whole process instead of to the emails that need it. Keystone imports the
// built config to generate its artifacts, so `keystone postinstall` - and
// therefore `npm ci` - failed anywhere the credentials were absent. That is how
// it broke CI on its first run.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

// A throwing module would fail here, before any test runs.
import { sendAnEmail, sendMagicLinkEmail, sendPasswordResetEmail } from '../lib/mail';

describe('mail configuration', () => {
  test('importing the module needs no configuration', () => {
    // Reaching this line is the assertion: the import above already happened.
    for (const fn of [sendAnEmail, sendMagicLinkEmail, sendPasswordResetEmail]) {
      assert.equal(typeof fn, 'function');
    }
  });

  test('an unconfigured send fails on send, with the same message as before', async () => {
    // lib/mail pulls in dotenv, so clear these at call time rather than trusting
    // the environment to be bare.
    delete process.env.MAIL_HOST;
    delete process.env.MAIL_USER;
    delete process.env.MAIL_PASS;

    await assert.rejects(
      () => sendAnEmail('to@example.test', 'from@example.test', 'subject', 'body'),
      /MAIL_HOST, MAIL_USER, and MAIL_PASS must be configured/,
    );
  });

  test('a bad port is still rejected', async () => {
    process.env.MAIL_HOST = 'smtp.example.test';
    process.env.MAIL_USER = 'user';
    process.env.MAIL_PASS = 'pass';
    process.env.MAIL_PORT = 'not-a-port';

    await assert.rejects(
      () => sendAnEmail('to@example.test', 'from@example.test', 'subject', 'body'),
      /MAIL_PORT must be a valid port number/,
    );
  });
});
