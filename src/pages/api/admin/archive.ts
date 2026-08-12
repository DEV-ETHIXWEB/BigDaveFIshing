import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db, ensureSchema } from '../../../lib/db';

export const prerender = false;

/**
 * Archiving is a human pressing a button, never a timer.
 *
 * A trip is "done" for reasons no schedule knows about — the boat went out a day late,
 * the party rebooked, someone signed for a trip that never happened. So this clears a
 * party off the active list only when staff say so, and it is deliberately independent
 * of the digest email: if the mail provider has a bad day, the dashboard still works and
 * whoever is on admin is not left wondering why the list stopped clearing.
 *
 * Nothing is deleted. `archived_at` is a timestamp, and the archived view can put any
 * party straight back.
 *
 * Under /api/admin, so the middleware has already required a valid admin session. The
 * session cookie is SameSite=lax, which means another site cannot make this POST fire
 * with the cookie attached.
 */
const schema = z.object({
  action: z.enum(['archive', 'restore']),
  // Comma-separated waiver ids: one party's members, as rendered on the dashboard.
  // Parsed by hand rather than piped through z.coerce — a single bad id rejects the whole
  // list, so a malformed request can't archive some arbitrary subset of a party.
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
});

export const POST: APIRoute = async ({ request, redirect }) => {
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return redirect('/admin/waivers?archive-error=1', 303);

  const { action, ids } = parsed.data;

  await ensureSchema();
  // Placeholders rather than interpolation: these came off a request, and an id list is
  // exactly the shape that tempts string-building.
  const placeholders = ids.map(() => '?').join(',');
  const result = await db.execute({
    sql:
      action === 'archive'
        ? `UPDATE waivers SET archived_at = datetime('now') WHERE id IN (${placeholders}) AND archived_at IS NULL`
        : `UPDATE waivers SET archived_at = NULL WHERE id IN (${placeholders})`,
    args: ids,
  });

  const changed = Number(result.rowsAffected ?? 0);
  const view = action === 'restore' ? '&view=archived' : '';
  return redirect(`/admin/waivers?${action}d=${changed}${view}`, 303);
};
