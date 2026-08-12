import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db, ensureSchema } from '../../../lib/db';
export const prerender = false;

/**
 * Creating a team link.
 *
 * Every failure here used to come back as one of two vague messages — "That team number
 * already exists" or "Complete the team details" — with the form wiped, so whoever was
 * making the link had to retype everything and guess which field was wrong. A one-letter
 * leader name and a duplicate number looked much the same from the outside: it just
 * didn't work.
 *
 * Now the specific reason and the values already typed come back with the redirect, so
 * the form can repopulate itself and point at the actual problem.
 */
const schema = z.object({
  teamNumber: z.coerce.number().int().positive().max(999999),
  leaderName: z.string().trim().min(2).max(200),
  waiverType: z.enum(['fishing-adventure', 'lodge']),
  tripDate: z.string().trim().max(50).optional(),
});

export const POST: APIRoute = async ({ request, redirect }) => {
  const raw = Object.fromEntries(await request.formData());
  const parsed = schema.safeParse(raw);

  /** Sends the typed values back so nothing has to be entered twice. */
  const back = (params: Record<string, string>) => {
    const query = new URLSearchParams(params);
    for (const field of ['teamNumber', 'leaderName', 'waiverType', 'tripDate']) {
      const value = raw[field];
      if (typeof value === 'string' && value) query.set(`prev_${field}`, value.slice(0, 200));
    }
    return redirect(`/admin/waivers?${query}`, 303);
  };

  if (!parsed.success) {
    // Name the field rather than saying "complete the details" — a leader name of one
    // character is the common case and was impossible to spot.
    const fields = Object.keys(parsed.error.flatten().fieldErrors);
    return back({ 'team-error': fields[0] ?? 'unknown' });
  }

  const team = parsed.data;
  await ensureSchema();
  const groupCode = `team-${team.teamNumber}-${crypto.randomUUID().slice(0, 8)}`;
  try {
    await db.execute({
      sql: 'INSERT INTO waiver_teams (team_number, leader_name, waiver_type, trip_date, group_code) VALUES (?, ?, ?, ?, ?)',
      args: [team.teamNumber, team.leaderName, team.waiverType, team.tripDate || null, groupCode],
    });
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message))
      return back({ 'team-exists': String(team.teamNumber) });
    throw error;
  }
  return redirect('/admin/waivers?team-created=1', 303);
};
