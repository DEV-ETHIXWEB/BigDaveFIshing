import type { APIRoute } from 'astro';
import { db, ensureSchema } from '../../../../lib/db';

export const prerender = false;

/**
 * Serves one guest's signature as a real PNG.
 *
 * Signatures used to be inlined into the dashboard as base64 data URLs. With 61 waivers
 * that made the page 1 MB, 88% of it signature payload — re-downloaded in full every time
 * the poller noticed a new signing. Pulling them out drops the page to a fraction of that
 * and lets the browser lazy-load and cache each image independently.
 *
 * Under /api/admin, so the middleware already requires a valid admin session. Signature
 * images are the most sensitive thing in this system — they are handwriting on a legal
 * document — so this must never become a public route.
 */
export const GET: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response('Not found', { status: 404 });
  }

  await ensureSchema();
  const result = await db.execute({
    sql: 'SELECT signature_png FROM waivers WHERE id = ?',
    args: [id],
  });

  const row = result.rows[0] as { signature_png?: string } | undefined;
  if (!row?.signature_png) return new Response('Not found', { status: 404 });

  const base64 = row.signature_png.replace(/^data:image\/png;base64,/, '');
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
      // A signed waiver is never edited, so this can cache hard. `private` keeps it out
      // of any shared cache — this is one guest's signature, not a public asset.
      'Cache-Control': 'private, max-age=31536000, immutable',
      // Belt and braces: never let a stored blob be sniffed into another content type.
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
};
