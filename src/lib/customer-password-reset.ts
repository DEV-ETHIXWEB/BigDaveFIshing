import { randomBytes, createHash } from 'node:crypto';
import { db } from './db';

/**
 * Forgot-password tokens for customer accounts.
 *
 * The token that goes out in the email is a 32-byte random value, shown to nobody but
 * the customer. Only its SHA-256 is ever written to `customer_password_resets` - see
 * the table's own comment in db.ts. A GET on the reset link would otherwise land the
 * raw token in server access logs and any link-preview crawler along the way; hashing
 * before storage protects the database, not the link itself, but there is no reason to
 * make the stored copy usable if the two ever diverge.
 */

const TOKEN_BYTES = 32;
const EXPIRY_MS = 60 * 60 * 1000; // 1 hour, long enough for an inbox check, short
// enough that a stale link found later in an old email cannot still work.

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Issues a new token for this customer. The raw token is returned once and never stored. */
export async function createPasswordResetToken(customerId: number): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString('hex');
  const expiresAt = new Date(Date.now() + EXPIRY_MS).toISOString();
  await db.execute({
    sql: 'INSERT INTO customer_password_resets (customer_id, token_hash, expires_at) VALUES (?, ?, ?)',
    args: [customerId, hashToken(token), expiresAt],
  });
  return token;
}

/**
 * Spends a token: valid, unused and unexpired tokens return the customer id they were
 * issued for, and are marked used in the same statement so two requests racing the same
 * token cannot both succeed - the UPDATE's WHERE clause only ever matches once.
 */
export async function consumePasswordResetToken(token: string): Promise<number | null> {
  const tokenHash = hashToken(token);
  const updated = await db.execute({
    sql: `UPDATE customer_password_resets
          SET used_at = datetime('now')
          WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`,
    args: [tokenHash],
  });
  if (updated.rowsAffected < 1) return null;

  const result = await db.execute({
    sql: 'SELECT customer_id FROM customer_password_resets WHERE token_hash = ?',
    args: [tokenHash],
  });
  const row = result.rows[0] as unknown as { customer_id: number } | undefined;
  return row?.customer_id ?? null;
}

/**
 * Called once a password has actually been changed, so a second, still-unused link from
 * an earlier request (a customer who asked twice, or an old email surfacing later)
 * cannot reset it again to something the account owner never chose.
 */
export async function invalidateOtherPasswordResetTokens(customerId: number): Promise<void> {
  await db.execute({
    sql: `UPDATE customer_password_resets
          SET used_at = datetime('now')
          WHERE customer_id = ? AND used_at IS NULL`,
    args: [customerId],
  });
}
