import { db, ensureSchema, type StaffAccount } from './db';
import { envVar } from './env';
import type { AdminIdentity } from './admin-auth';

/**
 * Ties the two admin identity sources this app has - the single env-var master account,
 * and rows in `staff_accounts` - to one signature and one activity log, without forcing
 * master into a database table it was never part of. Every admin action route calls
 * `logAdminAction` once, from `context.locals.admin` (set by src/middleware.ts from the
 * session cookie), never from anything the request body claims.
 */

/** Stable key for both signature storage and the activity log. Never client-supplied. */
export function adminKey(identity: AdminIdentity): string {
  return identity.role === 'master' ? 'master' : `staff:${identity.id}`;
}

/** A human name for the log and the activity panel. */
export async function adminDisplayName(identity: AdminIdentity): Promise<string> {
  if (identity.role === 'master') return envVar('ADMIN_USER') || 'Master admin';
  await ensureSchema();
  const result = await db.execute({
    sql: 'SELECT * FROM staff_accounts WHERE id = ?',
    args: [identity.id],
  });
  const staff = result.rows[0] as unknown as StaffAccount | undefined;
  // The row can be gone by the time this runs (deleted between the auth check and here);
  // middleware already refuses a session with no matching row, so in practice this only
  // covers the same instant-of-deletion race every other lookup in this app has.
  return staff?.name ?? 'Former staff member';
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Same check as the guest waiver signature: the prefix only claims to be a PNG. */
function isRealPng(dataUrl: string): boolean {
  if (!dataUrl.startsWith('data:image/png;base64,')) return false;
  try {
    const base64 = dataUrl.slice('data:image/png;base64,'.length);
    return Buffer.from(base64, 'base64').subarray(0, 8).equals(PNG_MAGIC);
  } catch {
    return false;
  }
}

export async function getAdminSignaturePng(key: string): Promise<string | null> {
  await ensureSchema();
  const result = await db.execute({
    sql: 'SELECT signature_png FROM admin_signatures WHERE admin_key = ?',
    args: [key],
  });
  const row = result.rows[0] as { signature_png?: string } | undefined;
  return row?.signature_png ?? null;
}

/** Throws on a non-PNG payload - callers are expected to catch and show a plain error. */
export async function saveAdminSignature(key: string, signaturePng: string): Promise<void> {
  if (!isRealPng(signaturePng) || signaturePng.length > 400_000) {
    throw new Error('That signature could not be read. Please sign again.');
  }
  await ensureSchema();
  await db.execute({
    sql: `INSERT INTO admin_signatures (admin_key, signature_png, updated_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT (admin_key) DO UPDATE SET signature_png = excluded.signature_png,
            updated_at = excluded.updated_at`,
    args: [key, signaturePng],
  });
}

/**
 * The one call every action route makes after its own logic succeeds. Never blocks or
 * throws on the caller's behalf - a logging failure must not undo a waiver archive or a
 * staff removal that already happened, so errors here are swallowed after being reported
 * to the server log, the same "don't fail the request over this" reasoning the digest
 * send already uses for its own failure paths.
 */
export async function logAdminAction(
  identity: AdminIdentity,
  action: string,
  target?: string,
): Promise<void> {
  try {
    const key = adminKey(identity);
    const name = await adminDisplayName(identity);
    await ensureSchema();
    await db.execute({
      sql: 'INSERT INTO admin_actions (admin_key, admin_name, action, target) VALUES (?, ?, ?, ?)',
      args: [key, name, action, target ?? null],
    });
  } catch (error) {
    console.error('[admin-actions] failed to log action', action, error);
  }
}
