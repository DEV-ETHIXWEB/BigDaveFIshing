import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db, ensureSchema } from '../../../lib/db';
import { nameField } from '../../../lib/waiver-validation';
import { customerEmailField, customerPasswordField } from '../../../lib/customer-validation';
import { hashPassword } from '../../../lib/customer-password';
import { createCustomerSession, customerSessionMaxAge } from '../../../lib/customer-auth';
import { envSetting } from '../../../lib/env';
import { callerKey, submissionRetryAfter } from '../../../lib/submission-throttle';

export const prerender = false;

const schema = z
  .object({
    name: nameField('your name'),
    email: customerEmailField,
    password: customerPasswordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const secret = envSetting('CUSTOMER_SESSION_SECRET');
  if (!secret) {
    return new Response('Accounts are not configured. Set CUSTOMER_SESSION_SECRET.', {
      status: 503,
    });
  }

  // Own namespace so this never shares a budget with waiver/booking submissions or
  // with the login throttle below - creating an account is a different action from
  // signing into one, and each deserves its own limit.
  const caller = `customer-signup:${callerKey(request)}`;
  const retryAfter = submissionRetryAfter(caller);
  if (retryAfter > 0) {
    return redirect(`/signup?error=rate-limited`, 303);
  }

  const raw = Object.fromEntries(await request.formData());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields = Object.keys(parsed.error.flatten().fieldErrors);
    return redirect(`/signup?error=${fields[0] ?? 'invalid'}`, 303);
  }

  await ensureSchema();
  const passwordHash = await hashPassword(parsed.data.password);

  let customerId: number;
  try {
    const result = await db.execute({
      sql: 'INSERT INTO customers (name, email, password_hash) VALUES (?, ?, ?)',
      args: [parsed.data.name, parsed.data.email, passwordHash],
    });
    customerId = Number(result.lastInsertRowid);
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) {
      return redirect('/signup?error=email-exists', 303);
    }
    throw error;
  }

  cookies.set('big_dave_customer', await createCustomerSession(customerId, secret), {
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    path: '/',
    maxAge: customerSessionMaxAge,
  });

  return redirect('/account', 303);
};
