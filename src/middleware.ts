import { defineMiddleware } from 'astro:middleware';
import { validAdminSession } from './lib/admin-auth';
import { adminSecretIsWeak, adminSigningSecret } from './lib/admin-secret';
import { envVar } from './lib/env';
import { db, ensureSchema } from './lib/db';

/**
 * Gates /admin/* and /api/admin/* behind a signed session cookie, issued by the login
 * form at /admin/login. (An earlier comment here described HTTP Basic Auth; that is not
 * what this does and has not been for some time.)
 *
 * Set ADMIN_USER and ADMIN_PASSWORD as environment variables. If either is unset,
 * /admin is refused entirely rather than left open, a missing password must never
 * mean "no password required."
 */

/**
 * Reachable without a session, by necessity.
 *
 * `/admin/login` is the form; `/api/admin/login` is the endpoint that form posts to,
 * and that endpoint is what *issues* the session. Gating it behind a valid session made
 * signing in impossible, every attempt 401'd, correct password or not, so the whole
 * dashboard was unreachable. It does its own credential check, so it is safe here.
 *
 * Exact matches only: a prefix test would also open anything else nested under these.
 */
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/api/admin/login']);

/** Methods that change something, and so are worth a cross-site check. */
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Refuses a state-changing admin request that did not come from this site.
 *
 * Everything behind this gate is a cookie-authenticated form POST - archive, delete,
 * create a team, add or remove staff - and the only thing standing between those and
 * another origin submitting them with the admin's cookie attached was `SameSite=lax` on
 * the cookie. Lax does block a cross-site POST in every browser that implements it
 * correctly, which is why this was never an open door, but it was also the entire
 * defence: one browser bug, one relaxed-by-default setting, or one same-site-but-not-
 * same-origin subdomain and there is nothing behind it.
 *
 * Checked in two ways because neither header is universally present:
 *
 *   `Sec-Fetch-Site` is set by the browser itself and cannot be forged by a page. Where
 *   it exists it is the better answer, and `same-origin` is the only value accepted -
 *   `same-site`, `cross-site` and `none` are all refused.
 *
 *   `Origin` is the fallback for anything that does not send Sec-Fetch-Site. It is also
 *   browser-controlled, and compared against the origin this request actually arrived on
 *   rather than a configured one, so it keeps working on preview deployments.
 *
 * A request with neither header is refused too. Those are not browsers submitting forms,
 * and nothing in the dashboard is a documented API anyone should be scripting against.
 */
function isCrossSiteWrite(request: Request, url: URL): boolean {
  if (!UNSAFE_METHODS.has(request.method)) return false;

  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite) return fetchSite !== 'same-origin';

  const origin = request.headers.get('origin');
  if (origin) return origin !== url.origin;

  return true;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) return next();

  // Before the session is even looked at: a forged cross-site POST arrives WITH a valid
  // cookie, so authentication cannot be what catches it.
  if (isCrossSiteWrite(context.request, context.url)) {
    return new Response('Cross-site request refused.', { status: 403 });
  }

  const user = envVar('ADMIN_USER');
  const pass = envVar('ADMIN_PASSWORD');

  // Checked before the public-path exemption, so an unconfigured deployment refuses
  // the login endpoint too rather than letting it fail as a bad password.
  if (!user || !pass) {
    return new Response('Admin area not configured. Set ADMIN_USER and ADMIN_PASSWORD.', {
      status: 503,
    });
  }

  /**
   * In production, a dedicated signing key is required rather than merely recommended.
   *
   * Without ADMIN_SESSION_SECRET the session cookie is signed with ADMIN_PASSWORD, which
   * ties two things that should be independent: how hard the password is to guess through
   * a rate-limited form, and how hard the signing key is to brute-force offline. With a
   * weak password an attacker skips the form entirely - derive the key, mint a valid
   * `big_dave_admin` cookie, and walk past the gate and past the throttle together.
   *
   * The login page has warned about this for a while, but a warning only works on someone
   * who is standing at the login page and reads it, and the deployment most likely to be
   * missing the variable is the one nobody is looking at. A refusal cannot be missed.
   *
   * Development keeps the fallback, so `astro dev` still works from a bare clone.
   */
  if (import.meta.env.PROD && adminSecretIsWeak()) {
    console.error(
      '[admin] refused, because ADMIN_SESSION_SECRET is unset or shorter than 16 characters. ' +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
    return new Response(
      'Admin area not configured. Set ADMIN_SESSION_SECRET to a long random value.',
      { status: 503 },
    );
  }

  if (PUBLIC_ADMIN_PATHS.has(pathname)) return next();

  const session = context.cookies.get('big_dave_admin')?.value;
  let identity = await validAdminSession(session, adminSigningSecret());

  // A staff cookie can be cryptographically valid and still name a login that no
  // longer exists - deleting the row in /admin/staff is how master revokes access, and
  // that only means anything if this checks the row is still there on every request.
  if (identity?.role === 'staff') {
    await ensureSchema();
    const result = await db.execute({
      sql: 'SELECT 1 FROM staff_accounts WHERE id = ?',
      args: [identity.id],
    });
    if (result.rows.length === 0) identity = null;
  }

  if (identity) {
    context.locals.admin = identity;
    const response = await next();
    // Nothing behind this gate should be cached by a shared proxy or indexed. Only set
    // this where the route hasn't already chosen, the signature endpoint deliberately
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
