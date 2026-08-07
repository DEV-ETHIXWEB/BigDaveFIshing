import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db, ensureSchema } from '../../../lib/db';
export const prerender = false;
const schema = z.object({
  teamNumber: z.coerce.number().int().positive().max(999999),
  leaderName: z.string().trim().min(2).max(200),
  waiverType: z.enum(['fishing-adventure', 'lodge']),
  tripDate: z.string().trim().max(50).optional(),
});
export const POST: APIRoute = async ({ request, redirect }) => {
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return redirect('/admin/waivers?team-error=1', 303);
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
      return redirect('/admin/waivers?team-exists=1', 303);
    throw error;
  }
  return redirect('/admin/waivers?team-created=1', 303);
};
