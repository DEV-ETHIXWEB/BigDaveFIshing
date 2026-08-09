import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db, ensureSchema } from '../../lib/db';
import { waiverGuestFields } from '../../lib/waiver-validation';
import { callerKey, submissionRetryAfter } from '../../lib/submission-throttle';

// On-demand, not prerendered: this route writes to the database on each request.
export const prerender = false;

const schema = z.object({
  waiverType: z.enum(['fishing-adventure', 'lodge']),
  groupCode: z.string().trim().max(100).optional(),
  groupLeaderName: z.string().trim().max(200).optional(),
  tripDate: z.string().trim().max(50).optional(),
  // Shared with the browser form, so the two cannot drift apart — the client copy is
  // only a courtesy, this is the one that protects the table.
  ...waiverGuestFields,
  // A data: URL PNG from the signature canvas. Capped well above what a signature
  // trace actually produces, to keep someone from posting an arbitrary large blob.
  signaturePng: z.string().startsWith('data:image/png;base64,').max(400_000),
});

export const POST: APIRoute = async ({ request }) => {
  // Checked before parsing, so a flood costs us as little work as possible.
  const retryAfter = submissionRetryAfter(callerKey(request));
  if (retryAfter > 0) {
    return new Response(
      JSON.stringify({ error: 'Too many submissions from this connection. Please try shortly.' }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid submission', details: parsed.error.flatten() }),
      {
        status: 400,
      },
    );
  }

  const w = parsed.data;

  await ensureSchema();
  let team: { leader_name: string; trip_date: string | null } | undefined;
  if (w.groupCode) {
    const result = await db.execute({
      sql: 'SELECT leader_name, trip_date FROM waiver_teams WHERE group_code = ? AND waiver_type = ?',
      args: [w.groupCode, w.waiverType],
    });
    // Through unknown: libSQL's Row is an index signature, so TypeScript rightly
    // refuses the direct cast to a named shape.
    team = result.rows[0] as unknown as typeof team;
    if (!team) {
      return new Response(JSON.stringify({ error: 'This team link is no longer valid.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    await db.execute({
      sql: `INSERT INTO waivers
      (waiver_type, group_code, group_leader_name, trip_date, guest_name, guest_email,
       guest_phone, emergency_contact_name, emergency_contact_phone, signature_png)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        w.waiverType,
        w.groupCode || null,
        team?.leader_name || w.groupLeaderName || null,
        team?.trip_date || w.tripDate || null,
        w.guestName,
        w.guestEmail || null,
        w.guestPhone,
        w.emergencyContactName,
        w.emergencyContactPhone,
        w.signaturePng,
      ],
    });
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) {
      return new Response(
        JSON.stringify({ error: 'A waiver has already been submitted for this phone number.' }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    throw error;
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
