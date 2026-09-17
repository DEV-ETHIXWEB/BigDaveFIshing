import { mailConfig, sendEmail, type SendResult } from './email';
import { business } from './business';

/**
 * Delivers a password reset link to a customer's own inbox.
 *
 * Reuses the same verified sender as the booking/digest mail (`WAIVER_DIGEST_FROM`) -
 * this project has exactly one verified sender, and introducing a second env var for
 * one more outbound address would be configuration for its own sake. Unlike those two,
 * the recipient here is the customer, never `WAIVER_DIGEST_TO`, so the message's own
 * `to` is set explicitly rather than taken from `mailConfig()`.
 */
export type ResetEmailOutcome =
  { status: 'sent' } | { status: 'not-configured' } | { status: 'failed'; error: string };

export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string,
): Promise<ResetEmailOutcome> {
  const mail = mailConfig();
  if ('missing' in mail) return { status: 'not-configured' };

  const result: SendResult = await sendEmail(mail.config, {
    to: [toEmail],
    subject: `Reset your ${business.name} password`,
    html: resetEmailHtml(resetUrl),
    text: resetEmailText(resetUrl),
  });

  if (!result.ok) return { status: 'failed', error: result.error };
  return { status: 'sent' };
}

export function resetEmailText(resetUrl: string) {
  return [
    `Reset your ${business.name} password`,
    '',
    "We received a request to reset your account's password. This link is valid for one hour and can only be used once:",
    '',
    resetUrl,
    '',
    "If you didn't ask for this, you can ignore this email - your password will not change.",
  ].join('\n');
}

const ink = '#1c1a17';
const cream = '#ece0cb';

/**
 * The logo is a PNG on an absolute URL for the same reason booking-notify.ts's is: most
 * email clients don't render the site's own WebP, and a relative path resolves to
 * nothing once the HTML has left the site. `resetUrl` already carries the site's own
 * origin (see api/customer/forgot-password.ts), so the logo is built from the same
 * origin rather than threading a second parameter through for it.
 */
export function resetEmailHtml(resetUrl: string) {
  const logoUrl = `${new URL(resetUrl).origin}/email-logo.png`;

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:${cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#fff;padding:28px;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
      <tr>
        <td style="padding-right:12px;">
          <img
            src="${escapeHtml(logoUrl)}"
            width="40"
            height="40"
            alt=""
            style="display:block;width:40px;height:40px;border-radius:50%;border:0;"
          />
        </td>
        <td style="vertical-align:middle;">
          <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8c867e;">${escapeHtml(business.name)}</div>
        </td>
      </tr>
    </table>
    <h1 style="font-size:22px;color:${ink};margin:6px 0 16px;">Reset your password</h1>
    <p style="font-size:15px;line-height:1.6;color:${ink};margin:0 0 22px;">
      We received a request to reset your account's password. This link is valid for one hour and can only be used once.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:${ink};border-radius:4px;">
          <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;">Reset password</a>
        </td>
      </tr>
    </table>
    <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#8c867e;">
      Or paste this link into your browser:<br />
      <span style="word-break:break-all;">${escapeHtml(resetUrl)}</span>
    </p>
    <p style="margin:22px 0 0;padding-top:18px;border-top:1px solid #e5ded2;font-size:13px;color:#8c867e;">
      Didn't ask for this? You can ignore this email, your password will not change.
    </p>
  </div>
</body></html>`;
}

/** The reset URL and business name are the only interpolated values; both still escaped on principle. */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
