import type { APIRoute } from 'astro';
import { db, ensureSchema } from '../../../lib/db';
import { consumeEmailVerificationToken } from '../../../lib/customer-email-verification';

export const prerender = false;

/**
 * A GET, not a POST: this is a link clicked from an email client, not a form
 * submission, and email clients (and their link-preview scanners) do sometimes
 * prefetch a GET. That is exactly why the token is single-use and short-lived rather
 * than why it should be a POST - a prefetch consuming it once is harmless (the real
 * click afterwards just finds an already-verified account, see below), whereas a
 * prefetch is not going to construct and submit a form on the visitor's behalf.
 */
export const GET: APIRoute = async ({ url, redirect }) => {
  const token = url.searchParams.get('token');
  if (!token) return redirect('/account?verify-error=1', 303);

  await ensureSchema();
  const customerId = await consumeEmailVerificationToken(token);
  if (!customerId) {
    // Expired, already used (including by an email scanner's prefetch, see above), or
    // never existed - the account may well already be verified, so this doesn't
    // necessarily mean anything went wrong. /account shows the real current state
    // either way, it just won't show a fresh "just verified" confirmation for it.
    return redirect('/account?verify-error=1', 303);
  }

  await db.execute({
    sql: "UPDATE customers SET email_verified_at = datetime('now') WHERE id = ?",
    args: [customerId],
  });

  return redirect('/account?verified=1', 303);
};
