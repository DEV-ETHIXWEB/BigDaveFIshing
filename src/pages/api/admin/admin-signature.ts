import type { APIRoute } from 'astro';
import { getAdminSignaturePng } from '../../../lib/admin-signature';

export const prerender = false;

/**
 * Serves one admin's saved signature as a real PNG, addressed by their admin key.
 *
 * The activity panel on /admin/waivers shows who did what, with their signature beside
 * each entry. Those used to be inlined as base64 data URLs: one lookup per distinct
 * admin, but the resulting string was then written into the HTML once per row. With the
 * panel's fifteen-entry cap and one person doing the work - which is the normal case -
 * that put fifteen copies of the same image in the markup. Measured on a nine-entry
 * page it was 106 kB of a 216 kB document, just under half of it, re-sent on every
 * poll-triggered reload. The same reasoning that pulled guest signatures out of the
 * dashboard (see ./signature/[id].ts) applies here, and more so, because these repeat.
 *
 * Keyed rather than per-row on purpose: every entry by the same admin points at one URL,
 * so the browser fetches it once and serves the rest from cache.
 *
 * The key goes in the query string rather than the path because it contains a colon
 * (`staff:3`), which is awkward to carry through a path segment.
 *
 * Under /api/admin, so the middleware already requires a valid admin session.
 */

/** `master`, or `staff:` and a positive integer. Anything else is not a key we issue. */
const KEY_PATTERN = /^(master|staff:[1-9]\d*)$/;

export const GET: APIRoute = async ({ url }) => {
  const key = url.searchParams.get('key') ?? '';
  // Rejected by shape before it reaches a query. The statement is parameterised anyway,
  // this just keeps the route answering only for keys the app actually mints.
  if (!KEY_PATTERN.test(key)) return new Response('Not found', { status: 404 });

  const dataUrl = await getAdminSignaturePng(key);
  // No signature drawn yet is a normal state, not an error: the dashboard falls back to
  // the logo-and-name stand-in and never requests this.
  if (!dataUrl) return new Response('Not found', { status: 404 });

  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  let bytes: Buffer;
  try {
    bytes = Buffer.from(base64, 'base64');
  } catch {
    return new Response('Not found', { status: 404 });
  }

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(bytes.byteLength),
      // Unlike a guest's signature on a signed waiver, this one changes whenever the
      // admin redraws it, so it cannot be immutable. A short private cache still collapses
      // the repeats within a page and across a poll-triggered reload, which is the whole
      // point, while a redraw shows up almost immediately.
      'Cache-Control': 'private, max-age=60',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
};
