import { mailConfig, sendEmail } from './email';
import { business } from './business';
import { formatSignedAt, formatTripDate } from './dates';

/**
 * The "someone just signed" alert, sent the moment a waiver is saved.
 *
 * The daily roster (waiver-digest-send.ts) is the full record and stays exactly as it
 * was: it still mails every waiver the next morning, with the CSV. This exists because
 * the hosts were told they would hear about a waiver when it was signed, and a roster
 * that arrives the following morning is not that.
 *
 * Same mailbox settings as the roster and the booking form, so there is still one
 * provider, one verified sender and one inbox to check. Like the roster, the signature
 * image is left out and stays behind the admin login.
 *
 * Never allowed to fail the guest's submission: the waiver is already saved by the time
 * this runs, and a guest told "something went wrong" after signing would sign again.
 */

export interface WaiverAlert {
  waiverType: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  minorNames: string[];
  partyLeader: string | null;
  tripDate: string | null;
  signedAt: string;
}

export type AlertOutcome =
  | { status: 'sent' }
  | { status: 'not-configured'; missing: string[] }
  | { status: 'failed'; error: string };

const TRIP_LABEL: Record<string, string> = {
  'fishing-adventure': 'Fishing adventure',
  lodge: 'Wilson River Lodge',
};

/** Long enough for a healthy provider, short enough that the guest isn't left waiting. */
const SEND_TIMEOUT_MS = 8000;

export async function sendWaiverAlert(alert: WaiverAlert, origin: string): Promise<AlertOutcome> {
  const mail = mailConfig();
  if ('missing' in mail) return { status: 'not-configured', missing: mail.missing };

  const dashboardUrl = `${origin.replace(/\/+$/, '')}/admin/waivers`;
  const timeout = new Promise<{ ok: false; error: string }>((resolve) =>
    setTimeout(
      () => resolve({ ok: false, error: `timed out after ${SEND_TIMEOUT_MS}ms` }),
      SEND_TIMEOUT_MS,
    ),
  );

  const result = await Promise.race([
    sendEmail(mail.config, {
      to: mail.config.to,
      subject: alertSubject(alert),
      html: alertHtml(alert, dashboardUrl, origin),
      text: alertText(alert, dashboardUrl),
      ...(alert.guestEmail ? { replyTo: alert.guestEmail } : {}),
    }),
    timeout,
  ]);

  return result.ok ? { status: 'sent' } : { status: 'failed', error: result.error };
}

function tripLine(alert: WaiverAlert) {
  const label = TRIP_LABEL[alert.waiverType] || alert.waiverType;
  return alert.tripDate ? `${label} · ${formatTripDate(alert.tripDate)}` : label;
}

export function alertSubject(alert: WaiverAlert) {
  const party = alert.partyLeader ? ` (${alert.partyLeader}'s party)` : '';
  return `Waiver signed: ${alert.guestName}${party}`;
}

export function alertText(alert: WaiverAlert, dashboardUrl: string) {
  return [
    'A waiver was just signed on the website.',
    '',
    `Guest:      ${alert.guestName}`,
    `Phone:      ${alert.guestPhone}`,
    `Email:      ${alert.guestEmail || '(not given)'}`,
    `Trip:       ${tripLine(alert)}`,
    `Party:      ${alert.partyLeader || '(no team leader recorded)'}`,
    `Emergency:  ${alert.emergencyContactName}, ${alert.emergencyContactPhone}`,
    ...(alert.minorNames.length ? [`Children:   ${alert.minorNames.join(', ')}`] : []),
    `Signed:     ${formatSignedAt(alert.signedAt)}`,
    '',
    `View the signature: ${dashboardUrl}`,
    '',
    'The full roster still arrives each morning as usual.',
  ].join('\n');
}

const ink = '#1c1a17';
const cream = '#ece0cb';
const muted = '#8c867e';

export function alertHtml(alert: WaiverAlert, dashboardUrl: string, origin: string) {
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:8px 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${muted};width:110px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;font-size:16px;color:${ink};">${value}</td>
    </tr>`;
  const tel = (phone: string) =>
    `<a href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ''))}" style="color:${ink};font-weight:600;">${escapeHtml(phone)}</a>`;
  const logoUrl = `${origin.replace(/\/+$/, '')}/email-logo.png`;

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:${cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#fff;padding:28px;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
      <tr>
        <td style="padding-right:12px;">
          <img src="${escapeHtml(logoUrl)}" width="40" height="40" alt="" style="display:block;width:40px;height:40px;border-radius:50%;border:0;" />
        </td>
        <td style="vertical-align:middle;">
          <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${muted};">${escapeHtml(business.name)}</div>
        </td>
      </tr>
    </table>
    <h1 style="font-size:22px;color:${ink};margin:6px 0 20px;">New waiver signed</h1>

    <table style="width:100%;border-collapse:collapse;">
      ${row('Guest', escapeHtml(alert.guestName))}
      ${row('Phone', tel(alert.guestPhone))}
      ${row(
        'Email',
        alert.guestEmail
          ? `<a href="mailto:${escapeHtml(alert.guestEmail)}" style="color:${ink};">${escapeHtml(alert.guestEmail)}</a>`
          : `<span style="color:${muted};">not given</span>`,
      )}
      ${row('Trip', escapeHtml(tripLine(alert)))}
      ${row(
        'Party',
        alert.partyLeader
          ? escapeHtml(alert.partyLeader)
          : `<span style="color:${muted};">no team leader recorded</span>`,
      )}
      ${row('Emergency', `${escapeHtml(alert.emergencyContactName)} &middot; ${tel(alert.emergencyContactPhone)}`)}
      ${alert.minorNames.length ? row('Children', escapeHtml(alert.minorNames.join(', '))) : ''}
      ${row('Signed', escapeHtml(formatSignedAt(alert.signedAt)))}
    </table>

    <div style="margin-top:24px;">
      <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:${ink};color:${cream};padding:12px 20px;text-decoration:none;font-size:14px;">View the signature in the dashboard</a>
    </div>

    <p style="margin:24px 0 0;font-size:12px;color:${muted};">The full roster still arrives each morning as usual.</p>
  </div>
</body></html>`;
}

/** Every value above comes off a public form, so it is escaped without exception. */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
