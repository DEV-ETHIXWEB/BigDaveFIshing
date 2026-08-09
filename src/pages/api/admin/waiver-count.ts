import type { APIRoute } from 'astro';
import { db, ensureSchema } from '../../../lib/db';

export const prerender = false;

/**
 * How many waivers exist right now. Nothing else — no names, no signatures.
 *
 * The dashboard polls this so it notices guests signing while it sits open on the
 * counter. Dave sends a team link, the group fills it in on their phones, and the page
 * he is already looking at updates instead of him having to think to refresh it.
 *
 * Deliberately the narrowest possible response: this is on a timer, so it should stay
 * cheap, and a poll loop is the last place to be shipping guest PII repeatedly.
 *
 * It sits under /api/admin, so the middleware already requires a valid admin session —
 * an expired one gets 401 and the poller quietly stops.
 */
export const GET: APIRoute = async () => {
  await ensureSchema();
  const result = await db.execute('SELECT COUNT(*) AS count FROM waivers');
  const count = Number((result.rows[0] as { count?: number | bigint })?.count ?? 0);

  return new Response(JSON.stringify({ count }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
