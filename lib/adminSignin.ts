// POST /admin-signin: hand a dashboard session over to the Admin UI.
//
// The dashboard keeps its session token in the browser and sends it as a
// Bearer header, so the Admin UI (on this server) can't see it. The "Keystone
// Admin" button on the dashboard's super-user settings page submits the token
// to this route in a form POST. If it belongs to a super admin, we set the
// Admin UI's session cookie and redirect into the Admin UI.
//
// The token travels in a POST body, never a URL, so it stays out of browser
// history and access logs. Only a valid, current super admin session gets a
// cookie; anything else gets a plain 403 and no cookie.

import type { IncomingMessage, ServerResponse } from 'node:http';

const MAX_BODY_BYTES = 8 * 1024;

function readFormToken(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const params = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
      resolve(params.get('token') || null);
    });
    req.on('error', () => resolve(null));
  });
}

function deny(res: ServerResponse) {
  res.statusCode = 403;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(
    'Admin sign-in failed. Sign in to the dashboard as a super admin, then use the Keystone Admin button on the Super User Settings page.',
  );
}

export function adminSigninRoute(commonContext: any) {
  return async (req: any, res: any) => {
    try {
      const token = await readFormToken(req);
      if (!token) return deny(res);

      // Resolve the session exactly as an API request with this token would.
      req.headers.authorization = `Bearer ${token}`;
      const context = await commonContext.withRequest(req, res);
      if (!context.session?.data?.isSuperAdmin) return deny(res);

      // Sets the session cookie on this response.
      await context.sessionStrategy.start({
        data: { listKey: 'User', itemId: String(context.session.itemId) },
        context,
      });
      res.setHeader('Cache-Control', 'no-store');
      res.redirect(303, '/');
    } catch (error) {
      console.error('[auth] admin sign-in failed', error);
      deny(res);
    }
  };
}
