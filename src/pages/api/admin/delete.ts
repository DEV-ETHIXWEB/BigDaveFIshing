import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db, ensureSchema } from '../../../lib/db';
import { logAdminAction } from '../../../lib/admin-signature';

export const prerender = false;

/**
 * Permanent deletion, for things created by mistake.
 *
 * Distinct from Archive, and deliberately so. Archive means "this trip happened and is
 * dealt with", the record stays, because a signed waiver is a legal document and the
 * database is the system of record for it. Delete means "this should never have existed":
 * a team link made with the wrong number, a duplicate, a test row. There is no undo.
 *
 * Deleting a team takes its signed waivers with it, because a waiver filed under a team
 * that no longer exists is orphaned, invisible on the dashboard and impossible to clear.
 * The dashboard says how many will go and makes you confirm before posting here.
 *
 * Under /api/admin, so a valid admin session is already required, and the session cookie
 * is SameSite=lax so another site cannot make this POST fire with the cookie attached.
 */
const schema = z.union([
  z.object({
    target: z.literal('team'),
    teamId: z.coerce.number().int().positive(),
  }),
  z.object({
    target: z.literal('waivers'),
    ids: z
      .string()
      .trim()
      .min(1)
      .max(4000)
      .transform((value, ctx) => {
        const parts = value.split(',').map((part) => Number(part.trim()));
        if (parts.length > 500 || parts.some((id) => !Number.isInteger(id) || id <= 0)) {
          ctx.addIssue({ code: 'custom', message: 'Invalid waiver id list' });
          return z.NEVER;
        }
        return parts;
      }),
  }),
]);

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  // Master only, the same guard staff/create.ts and staff/delete.ts use. A signed waiver
  // is a legal record and this is the one action that destroys one with no undo, so it
  // belongs with the other things only the owner can do. Staff still archive, which is
  // how a finished trip leaves the list and is fully reversible.
  if (locals.admin?.role !== 'master') {
    return new Response('Only the master admin can delete waivers or teams.', { status: 403 });
  }

  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return redirect('/admin/waivers?delete-error=1', 303);

  await ensureSchema();

  if (parsed.data.target === 'team') {
    // The team's group_code is what its waivers are filed under, so both go in one step.
    const found = await db.execute({
      sql: 'SELECT group_code, team_number FROM waiver_teams WHERE id = ?',
      args: [parsed.data.teamId],
    });
    const team = found.rows[0] as { group_code?: string; team_number?: number } | undefined;
    if (!team?.group_code) return redirect('/admin/waivers?delete-error=1', 303);

    const removed = await db.execute({
      sql: 'DELETE FROM waivers WHERE group_code = ?',
      args: [team.group_code],
    });
    await db.execute({ sql: 'DELETE FROM waiver_teams WHERE id = ?', args: [parsed.data.teamId] });

    const withCount = Number(removed.rowsAffected ?? 0);
    await logAdminAction(
      locals.admin!,
      'team.delete',
      `Team #${team.team_number} (${withCount} waiver${withCount === 1 ? '' : 's'})`,
    );

    return redirect(`/admin/waivers?team-deleted=1&with=${withCount}`, 303);
  }

  const ids = parsed.data.ids;
  const result = await db.execute({
    sql: `DELETE FROM waivers WHERE id IN (${ids.map(() => '?').join(',')})`,
    args: ids,
  });

  const deletedCount = Number(result.rowsAffected ?? 0);
  if (deletedCount > 0) {
    await logAdminAction(
      locals.admin!,
      'waiver.delete',
      `${deletedCount} waiver${deletedCount === 1 ? '' : 's'}`,
    );
  }

  return redirect(`/admin/waivers?deleted=${deletedCount}`, 303);
};
