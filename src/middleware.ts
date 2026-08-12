import { defineMiddleware } from 'astro:middleware';
import { validAdminSession } from './lib/admin-auth';
import { adminSigningSecret } from './lib/admin-secret';
import { envVar } from './lib/env';

/**
 * Gates /admin/* and /api/admin/* behind a signed session cookie, issued by the login
 * form at /admin/login. (An earlier comment here described HTTP Basic Auth; that is not
 * what this does and has not been for some time.)
 *
 * Set ADMIN_USER and ADMIN_PASSWORD as environment variables. If either is unset,
 * /admin is refused entirely rather than left open — a missing password must never
 * mean "no password required."
 */

/**
 * Reachable without a session, by necessity.
 *
 * `/admin/login` is the form; `/api/admin/login` is the endpoint that form posts to,
 * and that endpoint is what *issues* the session. Gating it behind a valid session made
 * signing in impossible — every attempt 401'd, correct password or not, so the whole
 * dashboard was unreachable. It does its own credential check, so it is safe here.
 *
 * Exact matches only: a prefix test would also open anything else nested under these.
 */
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/api/admin/login']);

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) return next();

  const user = envVar('ADMIN_USER');
  const pass = envVar('ADMIN_PASSWORD');

  // Checked before the public-path exemption, so an unconfigured deployment refuses
  // the login endpoint too rather than letting it fail as a bad password.
  if (!user || !pass) {
    return new Response('Admin area not configured. Set ADMIN_USER and ADMIN_PASSWORD.', {
      status: 503,
    });
  }

  if (PUBLIC_ADMIN_PATHS.has(pathname)) return next();

  const session = context.cookies.get('big_dave_admin')?.value;
  if (await validAdminSession(session, adminSigningSecret())) {
    const response = await next();
    // Nothing behind this gate should be cached by a shared proxy or indexed. Only set
    // this where the route hasn't already chosen — the signature endpoint deliberately
    // caches hard in the browser (private + immutable), and that is what keeps the
    // dashboard fast on refresh. Overwriting it here would undo exactly that.
    if (!response.headers.has('Cache-Control')) {
      response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    }
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  }

  if (pathname.startsWith('/api/')) return new Response('Authentication required', { status: 401 });
  return context.redirect(`/admin/login?next=${encodeURIComponent(pathname)}`, 303);
});
