import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db, ensureSchema } from '../../../lib/db';
import { customerPasswordField } from '../../../lib/customer-validation';
import { hashPassword } from '../../../lib/customer-password';
import {
  consumePasswordResetToken,
  invalidateOtherPasswordResetTokens,
} from '../../../lib/customer-password-reset';
import { envSetting } from '../../../lib/env';
import { callerKey, submissionRetryAfter } from '../../../lib/submission-throttle';

export const prerender = false;

const schema = z
  .object({
    token: z.string().min(1),
    password: customerPasswordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const POST: APIRoute = async ({ request, redirect }) => {
  const secret = envSetting('CUSTOMER_SESSION_SECRET');
  if (!secret) {
    console.error('[customer/reset-password] refused, because CUSTOMER_SESSION_SECRET is not set');
    return redirect('/login?error=unavailable', 303);
  }

  // The token itself is 32 random bytes, effectively unguessable, but this still keeps
  // the endpoint from being hammered - same reasoning as every other public POST here.
  const caller = `customer-reset-password:${callerKey(request)}`;
  const retryAfter = submissionRetryAfter(caller);
  if (retryAfter > 0) {
    return redirect('/reset-password?error=rate-limited', 303);
  }

  const raw = Object.fromEntries(await request.formData());
  const parsed = schema.safeParse(raw);
  const token = typeof raw.token === 'string' ? raw.token : '';
  if (!parsed.success) {
    const fields = Object.keys(z.flattenError(parsed.error).fieldErrors);
    const errorCode = fields.includes('password')
      ? 'password'
      : fields.includes('confirmPassword')
        ? 'confirm'
        : 'invalid';
    return redirect(`/reset-password?token=${encodeURIComponent(token)}&error=${errorCode}`, 303);
  }

  await ensureSchema();
  const customerId = await consumePasswordResetToken(parsed.data.token);
  if (!customerId) {
    // Expired, already used, or never existed - all three look identical to the caller,
    // on purpose: distinguishing them would tell a guesser which tokens are "close".
    return redirect('/reset-password?error=invalid-token', 303);
  }

  const passwordHash = await hashPassword(parsed.data.password);
  // Bumping session_version in the same statement is what makes this a real reset:
  // any session cookie already out there, on any device, was signed under the old
  // version and stops validating the moment this commits - see customer-auth.ts.
  await db.execute({
    sql: 'UPDATE customers SET password_hash = ?, session_version = session_version + 1 WHERE id = ?',
    args: [passwordHash, customerId],
  });

  // Any other outstanding reset link for this account is now stale - the password it
  // would have set is no longer the current one the customer chose.
  await invalidateOtherPasswordResetTokens(customerId);

  // Deliberately does not sign the customer in. Proving control of a reset link is not
  // the same event as a login, and the existing session (if any) was issued under the
  // old password - /login is the one path that already knows how to open a fresh one.
  return redirect('/login?reset=1', 303);
};
