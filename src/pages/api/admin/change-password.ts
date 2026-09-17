import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db, ensureSchema, type StaffAccount } from '../../../lib/db';
import { accountPasswordField } from '../../../lib/account-validation';
import { hashPassword, verifyPassword } from '../../../lib/password-hashing';
import { adminKey, logAdminAction } from '../../../lib/admin-signature';
import { lockoutRemaining, recordFailure, clearFailures } from '../../../lib/login-throttle';

export const prerender = false;

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: accountPasswordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * A staff member changing their own password. Master-excluded on purpose: the master
 * credential is ADMIN_USER/ADMIN_PASSWORD, an environment variable this app has no
 * business rewriting, not a `staff_accounts` row - see the note on /admin/change-password
 * for where that one actually gets changed.
 */
export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const identity = locals.admin;
  if (!identity) return redirect('/admin/login', 303);

  if (identity.role !== 'staff') {
    return redirect('/admin/change-password?error=master-not-supported', 303);
  }

  // Keyed by identity, not IP: this route already requires a valid session, so the
  // thing worth throttling is repeated wrong guesses at *this account's* current
  // password, not requests from a particular address.
  const throttleKey = `staff-change-password:${adminKey(identity)}`;
  const locked = lockoutRemaining(throttleKey);
  if (locked > 0) {
    return redirect('/admin/change-password?error=locked', 303);
  }

  const raw = Object.fromEntries(await request.formData());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields = Object.keys(z.flattenError(parsed.error).fieldErrors);
    const code = fields.includes('newPassword')
      ? 'password'
      : fields.includes('confirmPassword')
        ? 'confirm'
        : 'current-password';
    return redirect(`/admin/change-password?error=${code}`, 303);
  }

  await ensureSchema();
  const result = await db.execute({
    sql: 'SELECT * FROM staff_accounts WHERE id = ?',
    args: [identity.id],
  });
  const staff = result.rows[0] as unknown as StaffAccount | undefined;
  // The row is gone (removed by master between page load and submit). middleware.ts
  // would already have redirected a *later* request to /admin/login for this; this
  // request is already in flight, so handle it here rather than let a missing row throw.
  if (!staff) return redirect('/admin/login', 303);

  const currentOk = await verifyPassword(parsed.data.currentPassword, staff.password_hash);
  if (!currentOk) {
    recordFailure(throttleKey);
    return redirect('/admin/change-password?error=current-password', 303);
  }
  clearFailures(throttleKey);

  const newHash = await hashPassword(parsed.data.newPassword);
  await db.execute({
    sql: 'UPDATE staff_accounts SET password_hash = ? WHERE id = ?',
    args: [newHash, staff.id],
  });

  await logAdminAction(identity, 'staff.change-password');

  return redirect('/admin/change-password?success=1', 303);
};
