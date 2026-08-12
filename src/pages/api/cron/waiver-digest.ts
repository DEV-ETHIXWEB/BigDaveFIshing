import type { APIRoute } from 'astro';
import { dashboardUrl, runDigest } from '../../../lib/waiver-digest-send';
import { envSetting } from '../../../lib/env';

export const prerender = false;

/**
 * The scheduled digest. Vercel's cron hits this on the schedule in vercel.json.
 *
 * This route is not under /api/admin, so the admin middleware does not cover it — a
 * scheduler has no session cookie. It is gated on CRON_SECRET instead: Vercel sends it
 * as `Authorization: Bearer $CRON_SECRET` automatically once that variable is set on the
 * project. If CRON_SECRET is unset the route refuses rather than running open, because
 * an open endpoint here is a way for anyone to make the roster send on demand.
 */
export const GET: APIRoute = async ({ request }) => {
  const secret = envSetting('CRON_SECRET');
  if (!secret) {
    return json({ error: 'CRON_SECRET is not set — the scheduled digest is disabled.' }, 503);
  }

  const authorization = request.headers.get('authorization');
  if (authorization !== `Bearer ${secret}`) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const outcome = await runDigest(dashboardUrl(request.url));

  // A failed send answers 500 so the scheduler's own log shows it as failed, rather than
  // a quiet 200 that hides a roster which never went out.
  return json(outcome, outcome.status === 'failed' ? 500 : 200);
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
