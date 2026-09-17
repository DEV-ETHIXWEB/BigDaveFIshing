/**
 * Same-origin check for the site's JSON API routes.
 *
 * Astro's own built-in CSRF check (security.checkOrigin, on by default) only looks at
 * requests whose Content-Type is form-like (`application/x-www-form-urlencoded`,
 * `multipart/form-data`, `text/plain`) - see astro/dist/core/app/origin-check.js. That
 * is a deliberate, correct scope: a real browser cannot deliver a genuine
 * `application/json` POST cross-origin without a CORS preflight this site does not
 * grant, so the classic "attacker's page auto-submits a form" CSRF is already covered
 * by those three content types, and `application/json` was never a working vector for
 * it in the first place.
 *
 * This check exists anyway, on the two JSON routes that write to the database
 * (waivers, booking), purely as defence in depth: it costs nothing, and it means these
 * routes do not rely on every future reader correctly re-deriving the reasoning above
 * about CORS preflight behaviour before touching them.
 */
export function isSameOrigin(request: Request, url: URL): boolean {
  return request.headers.get('origin') === url.origin;
}
