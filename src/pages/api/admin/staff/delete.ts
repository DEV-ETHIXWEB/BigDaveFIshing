import type { APIRoute } from 'astro';
import { db, ensureSchema, type StaffAccount } from '../../../../lib/db';
import { logAdminAction } from '../../../../lib/admin-signature';

export const prerender = false;

/**
 * Removing a staff login. Master-only, same guard as create.ts. Permanent - there is no
 * "restore" here the way waivers have archive/restore, a removed login is meant to stop
 * working, not be hidden and reversible.
 *
 * The row's removal is what actually revokes access: src/middleware.ts checks
 * staff_accounts on every request for a staff session, so their existing cookie stops
 * being honoured on their very next request, no separate token-blacklist needed.
 */
export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (locals.admin?.role !== 'master') {
    return new Response('Only the master admin can remove staff logins.', { status: 403 });
  }

  const form = await request.formData();
  const id = Number(form.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return redirect('/admin/staff?delete-error=1', 303);
  }

  await ensureSchema();
  const found = await db.execute({ sql: 'SELECT * FROM staff_accounts WHERE id = ?', args: [id] });
  const removedStaff = found.rows[0] as unknown as StaffAccount | undefined;

  await db.execute({ sql: 'DELETE FROM staff_accounts WHERE id = ?', args: [id] });

  if (removedStaff) {
    await logAdminAction(locals.admin!, 'staff.remove', removedStaff.email);
  }

  return redirect('/admin/staff?removed=1', 303);
};
