import { db, ensureSchema, WAIVER_LIST_COLUMNS, type WaiverListRow } from './db';
import { business } from './business';

/**
 * Builds the daily roster email.
 *
 * What goes in: everything Dave acts on at the ramp: who is in the party, their phone
 * and email, and the emergency contact name and number for each guest. What stays out:
 * the signature image. The signature is the legal artifact, not information anyone works
 * from, and it is the one item that would genuinely hurt in a compromised inbox. It stays
 * in the database behind the admin session; the email carries a link to it.
 *
 * The email is deliberately not the archive. The database remains the system of record,
 * deleting a digest loses nothing.
 */

export interface DigestParty {
  key: string;
  leader: string;
  tripDate: string | null;
  waiverType: string;
  groupCode: string | null;
  members: WaiverListRow[];
}

const TRIP_LABEL: Record<string, string> = {
  'fishing-adventure': 'Fishing adventure',
  lodge: 'Wilson River Lodge',
};

/**
 * Waivers signed since the last confirmed send.
 *
 * Archived rows are excluded: archiving is staff saying "this trip is dealt with", and
 * re-mailing it the next morning would undo that. Selection is driven by emailed_at
 * rather than a date window, so a run that fails, or a day the cron never fired, is
 * picked up by the next successful run instead of being skipped forever.
 */
export async function pendingWaivers(): Promise<WaiverListRow[]> {
  await ensureSchema();
  const result = await db.execute(
    `SELECT ${WAIVER_LIST_COLUMNS} FROM waivers
     WHERE emailed_at IS NULL AND archived_at IS NULL
     ORDER BY signed_at ASC`,
  );
  return result.rows as unknown as WaiverListRow[];
}

/** Groups waivers the way the dashboard does: by team link, else by leader name. */
export function groupIntoParties(waivers: WaiverListRow[]): DigestParty[] {
  const parties = new Map<string, DigestParty>();

  for (const waiver of waivers) {
    const key = waiver.group_code || `manual:${waiver.group_leader_name || 'ungrouped'}`;
    let party = parties.get(key);
    if (!party) {
      party = {
        key,
        leader: waiver.group_leader_name || 'No team leader recorded',
        tripDate: waiver.trip_date,
        waiverType: waiver.waiver_type,
        groupCode: waiver.group_code,
        members: [],
      };
      parties.set(key, party);
    }
    // A party's trip date is whichever member recorded one, guests who signed ahead of
    // a team link existing often have none.
    if (!party.tripDate && waiver.trip_date) party.tripDate = waiver.trip_date;
    party.members.push(waiver);
  }

  // Dated trips first and soonest-first, so the top of the email is what happens next.
  return [...parties.values()].sort((a, b) => {
    if (a.tripDate && b.tripDate) return a.tripDate.localeCompare(b.tripDate);
    if (a.tripDate) return -1;
    if (b.tripDate) return 1;
    return a.leader.localeCompare(b.leader);
  });
}

/** `2026-08-12 14:30` in the database is UTC; render it in the shop's own timezone. */
function formatSigned(signedAt: string) {
  const date = new Date(signedAt.replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return signedAt;
  return date.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function digestSubject(parties: DigestParty[], guestCount: number) {
  const partyLabel = `${parties.length} part${parties.length === 1 ? 'y' : 'ies'}`;
  const guestLabel = `${guestCount} guest${guestCount === 1 ? '' : 's'}`;
  const dated = parties.filter((party) => party.tripDate).map((party) => party.tripDate!);
  const next = dated.length ? ` · next trip ${dated[0]}` : '';
  return `Waivers: ${guestLabel}, ${partyLabel}${next}`;
}

/**
 * Plain-text body. Not a fallback nobody reads, a phone with one bar at the ramp may
 * render this and nothing else, so it carries every field the HTML version does.
 */
export function digestText(parties: DigestParty[], dashboardUrl: string) {
  const lines: string[] = ["Big Dave's Fishing: new signed waivers", ''];

  for (const party of parties) {
    lines.push(
      `${party.leader}: ${TRIP_LABEL[party.waiverType] || party.waiverType}${
        party.tripDate ? `, ${party.tripDate}` : ', no trip date'
      }`,
    );
    for (const member of party.members) {
      lines.push(`  ${member.guest_name}`);
      lines.push(`    Phone: ${member.guest_phone}`);
      if (member.guest_email) lines.push(`    Email: ${member.guest_email}`);
      lines.push(
        `    Emergency: ${member.emergency_contact_name}, ${member.emergency_contact_phone}`,
      );
      lines.push(`    Signed: ${formatSigned(member.signed_at)}`);
    }
    lines.push('');
  }

  lines.push(`Signatures and full records: ${dashboardUrl}`);
  lines.push('');
  lines.push(
    'This email is a copy, not the file. Every waiver stays in the dashboard, so deleting this loses nothing.',
  );
  return lines.join('\n');
}

/**
 * HTML body, built for a phone held one-handed on a boat ramp: a single column, tables
 * only for layout, inline styles, no images and no web fonts. Email clients strip
 * <style> blocks and external CSS, so everything that must survive is on the element.
 */
export function digestHtml(parties: DigestParty[], dashboardUrl: string) {
  const ink = '#1c1a17';
  const cream = '#ece0cb';

  const partyBlocks = parties
    .map((party) => {
      const rows = party.members
        .map(
          (member) => `
      <tr>
        <td style="padding:14px 0;border-top:1px solid #e2ddd3;">
          <div style="font-size:16px;font-weight:600;color:${ink};">${escapeHtml(member.guest_name)}</div>
          <div style="font-size:14px;color:#55504a;margin-top:4px;">
            <a href="tel:${escapeHtml(member.guest_phone.replace(/[^\d+]/g, ''))}" style="color:#55504a;">${escapeHtml(member.guest_phone)}</a>
            ${member.guest_email ? ` &middot; <a href="mailto:${escapeHtml(member.guest_email)}" style="color:#55504a;">${escapeHtml(member.guest_email)}</a>` : ''}
          </div>
          <div style="font-size:14px;color:#8a2d2d;margin-top:6px;">
            Emergency: ${escapeHtml(member.emergency_contact_name)} &middot;
            <a href="tel:${escapeHtml(member.emergency_contact_phone.replace(/[^\d+]/g, ''))}" style="color:#8a2d2d;font-weight:600;">${escapeHtml(member.emergency_contact_phone)}</a>
          </div>
          <div style="font-size:12px;color:#8c867e;margin-top:6px;">Signed ${escapeHtml(formatSigned(member.signed_at))}</div>
        </td>
      </tr>`,
        )
        .join('');

      return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ddd6ca;margin-bottom:20px;">
      <tr>
        <td style="background:${ink};color:${cream};padding:14px 18px;">
          <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#c9bda8;">
            ${escapeHtml(TRIP_LABEL[party.waiverType] || party.waiverType)}${party.tripDate ? ` &middot; ${escapeHtml(party.tripDate)}` : ' &middot; no trip date'}
          </div>
          <div style="font-size:19px;margin-top:4px;">${escapeHtml(party.leader)}</div>
          <div style="font-size:13px;color:#c9bda8;margin-top:2px;">${party.members.length} guest${party.members.length === 1 ? '' : 's'}</div>
        </td>
      </tr>
      <tr><td style="padding:4px 18px 14px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
    </table>`;
    })
    .join('');

  return `<div style="background:#f6f1e8;padding:22px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;padding:24px;">
        <tr><td>
          <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8c867e;">${escapeHtml(business.name)}</div>
          <h1 style="font-size:24px;margin:6px 0 4px;color:${ink};font-weight:600;">New signed waivers</h1>
          <p style="font-size:14px;color:#55504a;margin:0 0 22px;">Everyone who has signed since the last of these emails.</p>
          ${partyBlocks}
          <p style="margin:24px 0 0;">
            <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:${ink};color:${cream};padding:12px 20px;text-decoration:none;font-size:14px;">View signatures in the dashboard</a>
          </p>
          <p style="font-size:12px;color:#8c867e;margin-top:20px;line-height:1.6;border-top:1px solid #e2ddd3;padding-top:16px;">
            Signature images are not included in this email. They stay in the dashboard, behind your login.
            This email is a copy, not the file: every waiver remains in the dashboard, so deleting this loses nothing.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`;
}

/** Quotes a CSV field. Commas, quotes and newlines all appear in real names and addresses. */
function csvCell(value: string | null) {
  const text = value ?? '';
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The same roster as a spreadsheet, for anyone who would rather sort and print it. */
export function digestCsv(parties: DigestParty[]) {
  const rows = [
    [
      'Trip date',
      'Party leader',
      'Trip type',
      'Guest name',
      'Guest phone',
      'Guest email',
      'Emergency contact',
      'Emergency phone',
      'Signed (UTC)',
    ].join(','),
  ];

  for (const party of parties) {
    for (const member of party.members) {
      rows.push(
        [
          csvCell(party.tripDate),
          csvCell(party.leader),
          csvCell(TRIP_LABEL[party.waiverType] || party.waiverType),
          csvCell(member.guest_name),
          csvCell(member.guest_phone),
          csvCell(member.guest_email),
          csvCell(member.emergency_contact_name),
          csvCell(member.emergency_contact_phone),
          csvCell(member.signed_at),
        ].join(','),
      );
    }
  }

  // The BOM is what makes Excel open UTF-8 correctly on a double-click; without it,
  // accented names arrive mangled.
  return '﻿' + rows.join('\r\n') + '\r\n';
}
