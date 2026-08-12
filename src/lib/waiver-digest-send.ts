import { db } from './db';
import { mailConfig, sendEmail } from './email';
import {
  digestCsv,
  digestHtml,
  digestSubject,
  digestText,
  groupIntoParties,
  pendingWaivers,
} from './waiver-digest';

/**
 * One digest run: gather what hasn't been mailed, send it, and only then mark it sent.
 *
 * The order matters. `emailed_at` is written after the provider has confirmed, never
 * before — if the send fails, the rows stay queued and the next run picks them up. The
 * failure mode of getting this backwards is the one that actually hurts: a roster that
 * was marked sent but never arrived is invisible, and nobody goes looking for it.
 */
export type DigestOutcome =
  | { status: 'sent'; guests: number; parties: number; provider: string; id: string | null }
  | { status: 'nothing-to-send' }
  | { status: 'not-configured'; missing: string[] }
  | { status: 'failed'; error: string };

export async function runDigest(dashboardUrl: string): Promise<DigestOutcome> {
  const mail = mailConfig();
  if ('missing' in mail) return { status: 'not-configured', missing: mail.missing };

  const waivers = await pendingWaivers();
  if (waivers.length === 0) return { status: 'nothing-to-send' };

  const parties = groupIntoParties(waivers);
  const result = await sendEmail(mail.config, {
    to: mail.config.to,
    subject: digestSubject(parties, waivers.length),
    html: digestHtml(parties, dashboardUrl),
    text: digestText(parties, dashboardUrl),
    attachments: [
      {
        filename: `waivers-${new Date().toISOString().slice(0, 10)}.csv`,
        content: Buffer.from(digestCsv(parties), 'utf8').toString('base64'),
        contentType: 'text/csv',
      },
    ],
  });

  if (!result.ok) return { status: 'failed', error: result.error };

  // Confirmed sent — now, and only now, take these out of the queue. Chunked because a
  // backlog after several failed days can exceed what one statement should carry.
  const ids = waivers.map((waiver) => waiver.id);
  for (let start = 0; start < ids.length; start += 200) {
    const chunk = ids.slice(start, start + 200);
    await db.execute({
      sql: `UPDATE waivers SET emailed_at = datetime('now') WHERE id IN (${chunk
        .map(() => '?')
        .join(',')})`,
      args: chunk,
    });
  }

  return {
    status: 'sent',
    guests: waivers.length,
    parties: parties.length,
    provider: result.provider,
    id: result.id,
  };
}

/**
 * Where the email's "view signatures" button points.
 *
 * PUBLIC_SITE_URL wins because a cron invocation's own request URL is the deployment's
 * internal hostname, not the address Dave should be tapping on his phone.
 */
export function dashboardUrl(requestUrl: string) {
  const configured = import.meta.env.PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
  const origin = configured || new URL(requestUrl).origin;
  return `${origin}/admin/waivers`;
}
