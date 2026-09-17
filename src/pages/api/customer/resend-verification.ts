import type { APIRoute } from 'astro';
import { db, ensureSchema, type Customer } from '../../../lib/db';
import { validCustomerSession } from '../../../lib/customer-auth';
import { createEmailVerificationToken } from '../../../lib/customer-email-verification';
import { sendVerificationEmail } from '../../../lib/customer-email-verification-email';
import { envSetting } from '../../../lib/env';
import { siteOrigin } from '../../../lib/site-url';
import { callerKey, submissionRetryAfter } from '../../../lib/submission-throttle';

export const prerender = false;

/**
 * Re-sends the confirmation link, from /account. Requires an actual signed-in session -
 * unlike forgot-password, there's no "prove ownership of an address you can't currently
 * access" case to support here, so there's no reason to accept an email from the
 * request body at all.
 */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const secret = envSetting('CUSTOMER_SESSION_SECRET');
  const session = await validCustomerSession(cookies.get('big_dave_customer')?.value, secret);
  if (!session) return redirect('/login', 303);

  const caller = `customer-resend-verification:${callerKey(request)}`;
  const retryAfter = submissionRetryAfter(caller);
  if (retryAfter > 0) {
    return redirect('/account?resend-error=rate-limited', 303);
  }

  await ensureSchema();
  const result = await db.execute({
    sql: 'SELECT * FROM customers WHERE id = ?',
    args: [session.id],
  });
  const customer = result.rows[0] as unknown as Customer | undefined;
  if (!customer || customer.session_version !== session.sessionVersion) {
    return redirect('/login', 303);
  }
  if (customer.email_verified_at) {
    // Already verified - nothing to resend. Not an error, just a no-op back to a
    // page that will now show them as verified.
    return redirect('/account', 303);
  }

  const token = await createEmailVerificationToken(customer.id);
  const verifyUrl = `${siteOrigin(request.url)}/api/customer/verify-email?token=${token}`;
  const outcome = await sendVerificationEmail(customer.email, verifyUrl);
  if (outcome.status !== 'sent') {
    console.error('[customer/resend-verification] not sent:', outcome);
    return redirect('/account?resend-error=unavailable', 303);
  }

  return redirect('/account?resent=1', 303);
};
