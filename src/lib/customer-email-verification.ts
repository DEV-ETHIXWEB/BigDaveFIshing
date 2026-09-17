import { randomBytes, createHash } from 'node:crypto';
import { db } from './db';

/**
 * Email address confirmation for customer accounts. Same shape and reasoning as
 * customer-password-reset.ts - a random token shown once, only its hash ever stored -
 * kept as a separate table and a separate module rather than sharing one: see the
 * table's own comment in db.ts.
 */

const TOKEN_BYTES = 32;
// A day - longer than the password reset window, since confirming an address is not
// time-sensitive the way proving you still hold an account is, and there is no harm in
// a guest clicking it a day later. A SQLite interval literal, not a JS-computed value -
// see the comment on createEmailVerificationToken for why.
const EXPIRY_INTERVAL = '+1 day';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * `expires_at` is computed by SQLite (`datetime('now', ...)`), not by
 * `new Date().toISOString()` - see the identical note on
 * customer-password-reset.ts's createPasswordResetToken for the exact bug this avoids:
 * comparing an ISO string against `datetime('now')` as plain TEXT does not sort the way
 * the timestamps actually order, and a token that should have expired hours ago was
 * still accepted.
 */
export async function createEmailVerificationToken(customerId: number): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString('hex');
  await db.execute({
    sql: `INSERT INTO customer_email_verifications (customer_id, token_hash, expires_at)
          VALUES (?, ?, datetime('now', ?))`,
    args: [customerId, hashToken(token), EXPIRY_INTERVAL],
  });
  return token;
}

/**
 * Spends a token exactly like consumePasswordResetToken does, for the same reason: the
 * UPDATE's WHERE clause is what makes this safe to call twice with the same token (a
 * doubled email client prefetching the link, a guest clicking it from two tabs) without
 * either caller seeing a false negative from a race.
 */
export async function consumeEmailVerificationToken(token: string): Promise<number | null> {
  const tokenHash = hashToken(token);
  const updated = await db.execute({
    sql: `UPDATE customer_email_verifications
          SET used_at = datetime('now')
          WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`,
    args: [tokenHash],
  });
  if (updated.rowsAffected < 1) return null;

  const result = await db.execute({
    sql: 'SELECT customer_id FROM customer_email_verifications WHERE token_hash = ?',
    args: [tokenHash],
  });
  const row = result.rows[0] as unknown as { customer_id: number } | undefined;
  return row?.customer_id ?? null;
}
