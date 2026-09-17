import type { APIRoute } from 'astro';
import { db, ensureSchema, type Customer } from '../../../lib/db';
import { hashPassword, verifyPassword } from '../../../lib/customer-password';
import {
  createCustomerSession,
  customerSessionMaxAge,
  CUSTOMER_HINT_COOKIE,
} from '../../../lib/customer-auth';
import { envSetting } from '../../../lib/env';
import {
  callerKey,
  clearFailures,
  lockoutRemaining,
  recordFailure,
} from '../../../lib/login-throttle';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const secret = envSetting('CUSTOMER_SESSION_SECRET');
  if (!secret) {
    // Named in the log, not to the visitor - see the matching note in signup.ts.
    console.error('[customer/login] refused, because CUSTOMER_SESSION_SECRET is not set');
    return redirect('/login?error=unavailable', 303);
  }

  const form = await request.formData();
  const email = String(form.get('email') || '')
    .trim()
    .toLowerCase();
  const password = String(form.get('password') || '');

  // Own namespace: a run of bad guesses against a customer account must not lock out
  // (or share a budget with) staff signing into /admin/login from the same IP.
  const caller = `customer-login:${callerKey(request)}`;
  const locked = lockoutRemaining(caller);
  if (locked > 0) {
    return redirect(`/login?locked=${locked}`, 303);
  }

  await ensureSchema();
  const result = await db.execute({
    sql: 'SELECT * FROM customers WHERE email = ? COLLATE NOCASE',
    args: [email],
  });
  const customer = result.rows[0] as unknown as Customer | undefined;

  // No such account still costs a scrypt call, the same shape of work a real password
  // check does, so a timing difference can't be used to find out which emails exist.
  const passwordOk = customer
    ? await verifyPassword(password, customer.password_hash)
    : await hashPassword(password).then(() => false);

  if (!customer || !passwordOk) {
    recordFailure(caller);
    return redirect('/login?error=1', 303);
  }

  clearFailures(caller);

  cookies.set(
    'big_dave_customer',
    await createCustomerSession(customer.id, customer.session_version, secret),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: import.meta.env.PROD,
      path: '/',
      maxAge: customerSessionMaxAge,
    },
  );

  // Readable companion cookie so the prerendered footer bar can tell it is showing a
  // signed-in visitor. Carries no identity - see CUSTOMER_HINT_COOKIE.
  cookies.set(CUSTOMER_HINT_COOKIE, '1', {
    httpOnly: false,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    path: '/',
    maxAge: customerSessionMaxAge,
  });

  return redirect('/account', 303);
};
