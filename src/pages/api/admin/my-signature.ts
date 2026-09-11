import type { APIRoute } from 'astro';
import { adminKey, getAdminSignaturePng, saveAdminSignature } from '../../../lib/admin-signature';

export const prerender = false;

/**
 * The signed-in admin's own signature - never anyone else's. There is no id in this
 * path on purpose: middleware.ts has already put the caller's identity on
 * context.locals from their session cookie, so "my signature" is the only thing this
 * route can possibly mean, and there is nothing for a request to override it with.
 *
 * Distinct from api/admin/signature/[id].ts, which serves a *guest's* waiver signature
 * by waiver id - a different resource, a different owner, deliberately not reused here.
 */
export const GET: APIRoute = async ({ locals }) => {
  const key = adminKey(locals.admin!);
  const signaturePng = await getAdminSignaturePng(key);
  if (!signaturePng) return new Response('Not found', { status: 404 });

  const base64 = signaturePng.replace(/^data:image\/png;base64,/, '');
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
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const key = adminKey(locals.admin!);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const signaturePng = (body as { signaturePng?: unknown }).signaturePng;
  if (typeof signaturePng !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing signature' }), { status: 400 });
  }

  try {
    await saveAdminSignature(key, signaturePng);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save signature';
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
