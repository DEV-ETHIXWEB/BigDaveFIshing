import type { APIRoute } from 'astro';
import {
  adminSessionMaxAge,
  createAdminSession,
  createStaffSession,
} from '../../../lib/admin-auth';
import { adminSigningSecret } from '../../../lib/admin-secret';
import { envVar } from '../../../lib/env';
import { db, ensureSchema, type StaffAccount } from '../../../lib/db';
import { hashPassword, verifyPassword } from '../../../lib/password-hashing';
import {
  callerKey,
  clearFailures,
  lockoutRemaining,
  recordFailure,
} from '../../../lib/login-throttle';

export const prerender = false;

/** Constant-time string compare, so a wrong username can't be found a byte at a time. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const username = String(form.get('username') || '');
  const password = String(form.get('password') || '');
  const next = String(form.get('next') || '/admin/waivers');

  // Only ever redirect to an admin path of our own. Rejects protocol-relative targets
  // like //evil.com, which would otherwise be an open redirect off the back of a login.
  const safeNext = next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin/waivers';

  const user = envVar('ADMIN_USER');
  const pass = envVar('ADMIN_PASSWORD');
  const caller = callerKey(request);

  const locked = lockoutRemaining(caller);
  if (locked > 0) {
    return redirect(`/admin/login?locked=${locked}`, 303);
  }

  const secret = adminSigningSecret()!;

  // Master first - the one credential this area has always had, checked exactly as
  // before. Anything that doesn't match it falls through to staff, which the master
  // account itself can never accidentally satisfy: ADMIN_USER is a username, not
  // guaranteed to be a valid email, and staff are looked up by email only.
  if (user && pass && safeEqual(username, user) && safeEqual(password, pass)) {
    clearFailures(caller);
    cookies.set('big_dave_admin', await createAdminSession(secret), {
      httpOnly: true,
      sameSite: 'lax',
      secure: import.meta.env.PROD,
      path: '/',
      maxAge: adminSessionMaxAge,
    });
    return redirect(safeNext, 303);
  }

  await ensureSchema();
  const result = await db.execute({
    sql: 'SELECT * FROM staff_accounts WHERE email = ? COLLATE NOCASE',
    args: [username.trim().toLowerCase()],
  });
  const staff = result.rows[0] as unknown as StaffAccount | undefined;

  // No such account still costs a scrypt call, so a timing difference can't be used to
  // find out which emails are staff.
  const staffPasswordOk = staff
    ? await verifyPassword(password, staff.password_hash)
    : await hashPassword(password).then(() => false);

  if (!staff || !staffPasswordOk) {
    recordFailure(caller);
    return redirect('/admin/login?error=1', 303);
  }

  clearFailures(caller);

  cookies.set('big_dave_admin', await createStaffSession(staff.id, secret), {
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    path: '/',
    maxAge: adminSessionMaxAge,
  });

  return redirect(safeNext, 303);
};
