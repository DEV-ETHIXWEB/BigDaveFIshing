import type { APIRoute } from 'astro';
import { bookingEnquirySchema } from '../../lib/booking-enquiry';
import { sendBookingEnquiry } from '../../lib/booking-notify';
import { callerKey, submissionRetryAfter } from '../../lib/submission-throttle';

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
export const POST: APIRoute = async ({ request }) => {
  // Shared with the waiver endpoint: 20 submissions per caller per 10 minutes. An
  // enquiry form has no legitimate reason to exceed that, and it keeps the mail provider
  // from being used as a relay.
  const retryAfter = submissionRetryAfter(callerKey(request));
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

  const outcome = await sendBookingEnquiry(parsed.data);

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

  return json({ ok: true }, 201);
};

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}
