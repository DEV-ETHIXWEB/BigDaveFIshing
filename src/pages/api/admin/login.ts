import type { APIRoute } from 'astro';
import { adminSessionMaxAge, createAdminSession } from '../../../lib/admin-auth';
import { adminSigningSecret } from '../../../lib/admin-secret';
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

  const user = import.meta.env.ADMIN_USER;
  const pass = import.meta.env.ADMIN_PASSWORD;
  const caller = callerKey(request);

  const locked = lockoutRemaining(caller);
  if (locked > 0) {
    return redirect(`/admin/login?locked=${locked}`, 303);
  }

  if (!user || !pass || !safeEqual(username, user) || !safeEqual(password, pass)) {
    recordFailure(caller);
    return redirect('/admin/login?error=1', 303);
  }

  clearFailures(caller);

  cookies.set('big_dave_admin', await createAdminSession(adminSigningSecret()!), {
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    path: '/',
    maxAge: adminSessionMaxAge,
  });

  return redirect(safeNext, 303);
};
