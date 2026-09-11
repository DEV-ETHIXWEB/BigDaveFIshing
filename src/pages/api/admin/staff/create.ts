import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db, ensureSchema } from '../../../../lib/db';
import { nameField } from '../../../../lib/waiver-validation';
import { accountEmailField, accountPasswordField } from '../../../../lib/account-validation';
import { hashPassword } from '../../../../lib/password-hashing';
import { logAdminAction } from '../../../../lib/admin-signature';

export const prerender = false;

const schema = z.object({
  name: nameField("the staff member's name"),
  email: accountEmailField,
  password: accountPasswordField,
});

/**
 * Creating a staff login. Master-only - checked from context.locals, set by
 * src/middleware.ts from the session cookie itself, not from anything the client sent,
 * so there is nothing here for a staff session to forge its way past.
 */
export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (locals.admin?.role !== 'master') {
    return new Response('Only the master admin can create staff logins.', { status: 403 });
  }

  const raw = Object.fromEntries(await request.formData());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields = Object.keys(parsed.error.flatten().fieldErrors);
    return redirect(`/admin/staff?error=${fields[0] ?? 'invalid'}`, 303);
  }

  await ensureSchema();
  const passwordHash = await hashPassword(parsed.data.password);

  try {
    await db.execute({
      sql: 'INSERT INTO staff_accounts (name, email, password_hash) VALUES (?, ?, ?)',
      args: [parsed.data.name, parsed.data.email, passwordHash],
    });
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) {
      return redirect('/admin/staff?error=email-exists', 303);
    }
    throw error;
  }

  await logAdminAction(locals.admin!, 'staff.create', parsed.data.email);

  return redirect('/admin/staff?created=1', 303);
};
