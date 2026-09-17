import type { APIRoute } from 'astro';
import { bookingEnquirySchema } from '../../lib/booking-enquiry';
import { sendBookingEnquiry } from '../../lib/booking-notify';
import { db, ensureSchema } from '../../lib/db';
import { validCustomerSession } from '../../lib/customer-auth';
import { envSetting } from '../../lib/env';
import { isSameOrigin } from '../../lib/origin-check';
import {
  callerKey,
  recordAcceptedSubmission,
  submissionRetryAfter,
} from '../../lib/submission-throttle';
import { siteOrigin } from '../../lib/site-url';

// Sends mail on each request, so it can never be prerendered.
export const prerender = false;

/**
 * The homepage booking form's endpoint.
 *
 * Until now that form resolved a timer, wrote the enquiry to `console.log` and showed
 * "Thanks, we got it". Every enquiry anyone ever made through it was discarded, and the
 * visitor was told otherwise. This route is what makes the confirmation true: it only
 * answers 2xx once the mail provider has confirmed it accepted the message.
 *
 * Anything short of that answers an error and the form says to call instead. Failing
 * loudly is the point, a booking form that degrades silently is worse than one that is
 * plainly broken, because nobody notices it stopped.
 */
export const POST: APIRoute = async ({ request, cookies, url }) => {
  // See src/lib/origin-check.ts for why this route checks it explicitly rather than
  // relying only on Astro's built-in same-origin check, which does not look at
  // application/json requests.
  if (!isSameOrigin(request, url)) {
    return json({ error: 'Cross-site submissions are forbidden' }, 403);
  }

  // Own namespace, like customer signup: enquiring and signing a waiver are different
  // actions and must not share a budget. They used to, which meant a party working
  // through their waivers on the lodge wifi could use up the allowance and leave the
  // booking form answering 429 to the next visitor on that connection.
  //
  // Within that namespace the limit keeps the mail provider from being used as a relay.
  // Only a message the provider actually accepted spends the smaller budget, so someone
  // mistyping their phone number three times is not locked out of enquiring.
  const caller = `booking:${callerKey(request)}`;
  const retryAfter = submissionRetryAfter(caller);
  if (retryAfter > 0) {
    return json(
      { error: 'Too many messages from this connection. Please try shortly, or give us a call.' },
      429,
      { 'Retry-After': String(retryAfter) },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const parsed = bookingEnquirySchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'Please check the form and try again.' }, 400);
  }

  const outcome = await sendBookingEnquiry(parsed.data, siteOrigin(request.url));

  if (outcome.status === 'not-configured') {
    // 503, and the missing variable names go to the server log rather than the response:
    // the visitor cannot act on them, and naming configuration to the public is not
    // something a form should do.
    console.error(
      '[booking] enquiry not sent, because mail is not configured:',
      outcome.missing.join(', '),
    );
    return json({ error: 'notConfigured' }, 503);
  }

  if (outcome.status === 'failed') {
    console.error('[booking] enquiry not sent, because the provider rejected it:', outcome.error);
    return json({ error: 'sendFailed' }, 502);
  }

  // The provider confirmed it, so this is the point the expensive budget is spent.
  recordAcceptedSubmission(caller);

  // Persisted only now, after the email that actually is this feature's success
  // condition has already been confirmed sent - this table is a record of that
  // success for a signed-in customer to see on /account, never a second thing that
  // could itself fail the request. A guest with no account gets customer_id NULL and
  // nothing else changes for them.
  try {
    await ensureSchema();
    const session = await validCustomerSession(
      cookies.get('big_dave_customer')?.value,
      envSetting('CUSTOMER_SESSION_SECRET'),
    );
    await db.execute({
      sql: `INSERT INTO bookings (customer_id, name, phone, email, trip_type, message)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        session?.id ?? null,
        parsed.data.name,
        parsed.data.phone,
        parsed.data.email || null,
        parsed.data.tripType,
        parsed.data.message || null,
      ],
    });
  } catch (error) {
    // The enquiry already reached Dave's inbox regardless - see the comment above.
    console.error('[booking] enquiry sent but not recorded for account history:', error);
  }

  return json({ ok: true }, 201);
};

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}
