import type { APIRoute } from 'astro';
import { dashboardUrl, runDigest } from '../../../lib/waiver-digest-send';

export const prerender = false;

/**
 * "Send it to me now" — the same digest the cron sends, on demand from the dashboard.
 *
 * Worth having for two reasons: it is how you confirm the mail keys work without waiting
 * until tomorrow morning, and it is what Dave presses when a group signs an hour before
 * they launch and he wants the roster in his phone before he loses signal.
 *
 * Same queue as the scheduled run, so pressing this simply means the morning email is
 * smaller — a guest is never mailed twice.
 */
export const POST: APIRoute = async ({ request, redirect }) => {
  const outcome = await runDigest(dashboardUrl(request.url));

  const params = new URLSearchParams();
  switch (outcome.status) {
    case 'sent':
      params.set('digest', 'sent');
      params.set('guests', String(outcome.guests));
      break;
    case 'nothing-to-send':
      params.set('digest', 'empty');
      break;
    case 'not-configured':
      params.set('digest', 'unconfigured');
      params.set('missing', outcome.missing.join(', '));
      break;
    case 'failed':
      params.set('digest', 'failed');
      // Truncated: this lands in a URL and on screen, and provider errors can be long.
      params.set('reason', outcome.error.slice(0, 200));
      break;
  }

  return redirect(`/admin/waivers?${params}`, 303);
};
