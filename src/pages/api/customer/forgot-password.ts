import type { APIRoute } from 'astro';
import { db, ensureSchema, type Customer } from '../../../lib/db';
import { customerEmailField } from '../../../lib/customer-validation';
import { createPasswordResetToken } from '../../../lib/customer-password-reset';
import { sendPasswordResetEmail } from '../../../lib/customer-password-reset-email';
import { mailIsConfigured } from '../../../lib/email';
import { envSetting } from '../../../lib/env';
import { siteOrigin } from '../../../lib/site-url';
import { callerKey, submissionRetryAfter } from '../../../lib/submission-throttle';

export const prerender = false;

/**
 * Requests a password reset link.
 *
 * The one rule this route cannot break: whether an email address has an account here
 * must never be observable from the response. So every outcome that isn't a hard,
 * account-independent failure (accounts switched off, rate limited) redirects to the
 * exact same "check your email" state, regardless of whether an account was found, and
 * regardless of whether the send to a real one actually succeeded - a real customer
 * sees a real email land when the mail provider cooperates, and someone probing for
 * registered addresses learns nothing either way from the response body.
 *
 * Known, accepted gap: the "found" branch does real work (a DB insert, an outbound call
 * to the mail provider) that the "not found" branch skips, so response *timing* still
 * leaks a little over many samples - the same class of risk already accepted for the
 * comparisons documented in hmac.ts. A fixed artificial delay was considered and
 * rejected: mail-provider latency varies enough that a constant delay would not
 * actually close the gap, and it would slow down every real customer to add it.
 */
export const POST: APIRoute = async ({ request, redirect }) => {
  const secret = envSetting('CUSTOMER_SESSION_SECRET');
  if (!secret) {
    console.error('[customer/forgot-password] refused, because CUSTOMER_SESSION_SECRET is not set');
    return redirect('/login?error=unavailable', 303);
  }

  // Own namespace: separate from login/signup so a burst of reset requests cannot
  // exhaust a budget those flows depend on, or vice versa.
  const caller = `customer-forgot-password:${callerKey(request)}`;
  const retryAfter = submissionRetryAfter(caller);
  if (retryAfter > 0) {
    return redirect('/forgot-password?error=rate-limited', 303);
  }

  // Checked before anything else, and independent of the submitted address: whether
  // mail is configured is a fact about this deployment, not about `email`. Checking it
  // only inside the "customer exists" branch was the actual bug an earlier version of
  // this route had - "unavailable" would only ever come back for a real account, and
  // "sent" for everything else, which hands a prober exactly the oracle this whole
  // route exists to deny them. Checking it first means every caller with a
  // never-registered address gets the identical outcome as the branch below produces.
  if (!mailIsConfigured()) {
    console.error('[customer/forgot-password] refused, mail is not configured');
    return redirect('/forgot-password?error=unavailable', 303);
  }

  const form = await request.formData();
  const parsed = customerEmailField.safeParse(String(form.get('email') || ''));
  if (!parsed.success) {
    return redirect('/forgot-password?error=invalid-email', 303);
  }
  const email = parsed.data;

  await ensureSchema();
  const result = await db.execute({
    sql: 'SELECT * FROM customers WHERE email = ? COLLATE NOCASE',
    args: [email],
  });
  const customer = result.rows[0] as unknown as Customer | undefined;

  if (customer) {
    const token = await createPasswordResetToken(customer.id);
    const resetUrl = `${siteOrigin(request.url)}/reset-password?token=${token}`;
    const outcome = await sendPasswordResetEmail(customer.email, resetUrl);

    // A transient failure here (network blip, provider outage) used to answer
    // ?error=unavailable while a never-registered address fell through to ?sent=1 below
    // - two different responses for one input, which is exactly the oracle this route
    // exists to deny a prober, even though the underlying cause (a flaky send, not a
    // missing account) has nothing to do with whether the address is real. Logged for
    // whoever is watching the mail provider; the caller still sees the same
    // confirmation either way, same as every other outcome here.
    if (outcome.status === 'failed') {
      console.error('[customer/forgot-password] send failed:', outcome.error);
    }
  }

  // No account for that address, or a real one whose send just failed: same
  // confirmation either way, silently.
  return redirect('/forgot-password?sent=1', 303);
};
