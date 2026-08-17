import { mailConfig, sendEmail, type SendResult } from './email';
import { business } from './business';
import { tripTypeLabels, type BookingEnquiry } from './booking-enquiry';

/**
 * Delivers a booking enquiry from the homepage form.
 *
 * This is the lead path, so it is deliberately strict about what counts as success: the
 * caller only ever gets `ok` once the mail provider has confirmed it accepted the
 * message. Anything else, no provider configured, provider rejected, network down,
 * comes back as a failure so the form can tell the visitor to phone instead. A form that
 * says "thanks, we got it" without that confirmation is the single most expensive bug
 * this site could ship, because nobody finds out until the bookings don't arrive.
 *
 * It reuses the same `WAIVER_DIGEST_*` mailbox settings as the roster digest. One
 * provider, one verified sender, one inbox to check, see docs/waiver-email-setup.md.
 */

export type EnquiryOutcome =
  | { status: 'sent'; provider: string; id: string | null }
  | { status: 'not-configured'; missing: string[] }
  | { status: 'failed'; error: string };

export async function sendBookingEnquiry(enquiry: BookingEnquiry): Promise<EnquiryOutcome> {
  const mail = mailConfig();
  if ('missing' in mail) return { status: 'not-configured', missing: mail.missing };

  const result: SendResult = await sendEmail(mail.config, {
    to: mail.config.to,
    subject: enquirySubject(enquiry),
    html: enquiryHtml(enquiry),
    text: enquiryText(enquiry),
    // So hitting reply in the inbox answers the person who enquired, not the sending
    // address. Only set when they left one, an invalid Reply-To can get a message
    // rejected outright.
    ...(enquiry.email ? { replyTo: enquiry.email } : {}),
  });

  if (!result.ok) return { status: 'failed', error: result.error };
  return { status: 'sent', provider: result.provider, id: result.id };
}

export function enquirySubject(enquiry: BookingEnquiry) {
  return `Booking enquiry from ${enquiry.name} (${tripTypeLabels[enquiry.tripType]})`;
}

export function enquiryText(enquiry: BookingEnquiry) {
  const lines = [
    'New booking enquiry from the website.',
    '',
    `Name:      ${enquiry.name}`,
    `Phone:     ${enquiry.phone}`,
    `Email:     ${enquiry.email || '(not given)'}`,
    `Interest:  ${tripTypeLabels[enquiry.tripType]}`,
    '',
    'Message:',
    enquiry.message?.trim() || '(none)',
    '',
    `Received ${new Date().toUTCString()}`,
  ];
  return lines.join('\n');
}

const ink = '#1c1a17';
const cream = '#ece0cb';

export function enquiryHtml(enquiry: BookingEnquiry) {
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:8px 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8c867e;width:110px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;font-size:16px;color:${ink};">${value}</td>
    </tr>`;

  const phoneDigits = enquiry.phone.replace(/[^\d+]/g, '');

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:${cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#fff;padding:28px;">
    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8c867e;">${escapeHtml(business.name)}</div>
    <h1 style="font-size:22px;color:${ink};margin:6px 0 20px;">New booking enquiry</h1>

    <table style="width:100%;border-collapse:collapse;">
      ${row('Name', escapeHtml(enquiry.name))}
      ${row('Phone', `<a href="tel:${escapeHtml(phoneDigits)}" style="color:${ink};font-weight:600;">${escapeHtml(enquiry.phone)}</a>`)}
      ${row(
        'Email',
        enquiry.email
          ? `<a href="mailto:${escapeHtml(enquiry.email)}" style="color:${ink};">${escapeHtml(enquiry.email)}</a>`
          : '<span style="color:#8c867e;">not given</span>',
      )}
      ${row('Interest', escapeHtml(tripTypeLabels[enquiry.tripType]))}
    </table>

    <div style="margin-top:20px;padding-top:18px;border-top:1px solid #e5ded2;">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8c867e;margin-bottom:8px;">Message</div>
      <div style="font-size:15px;line-height:1.6;color:${ink};white-space:pre-wrap;">${
        enquiry.message?.trim()
          ? escapeHtml(enquiry.message.trim())
          : '<span style="color:#8c867e;">(none)</span>'
      }</div>
    </div>

    <p style="margin:24px 0 0;font-size:12px;color:#8c867e;">Received ${escapeHtml(new Date().toUTCString())}. Reply to this email to answer them directly.</p>
  </div>
</body></html>`;
}

/**
 * Every interpolated value above comes off a public form, so it is escaped without
 * exception, an enquiry is untrusted input that lands in someone's mail client.
 */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
