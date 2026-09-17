import { mailConfig, sendEmail, type SendResult } from './email';
import { business } from './business';

/** Delivers an email-confirmation link. Same reasoning as customer-password-reset-email.ts. */
export type VerificationEmailOutcome =
  { status: 'sent' } | { status: 'not-configured' } | { status: 'failed'; error: string };

export async function sendVerificationEmail(
  toEmail: string,
  verifyUrl: string,
): Promise<VerificationEmailOutcome> {
  const mail = mailConfig();
  if ('missing' in mail) return { status: 'not-configured' };

  const result: SendResult = await sendEmail(mail.config, {
    to: [toEmail],
    subject: `Confirm your ${business.name} account`,
    html: verificationEmailHtml(verifyUrl),
    text: verificationEmailText(verifyUrl),
  });

  if (!result.ok) return { status: 'failed', error: result.error };
  return { status: 'sent' };
}

export function verificationEmailText(verifyUrl: string) {
  return [
    `Confirm your ${business.name} account`,
    '',
    'One more step: confirm this is your email address. This link is valid for 24 hours.',
    '',
    verifyUrl,
    '',
    "If you didn't create this account, you can ignore this email.",
  ].join('\n');
}

const ink = '#1c1a17';
const cream = '#ece0cb';

export function verificationEmailHtml(verifyUrl: string) {
  const logoUrl = `${new URL(verifyUrl).origin}/email-logo.png`;

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
    <h1 style="font-size:22px;color:${ink};margin:6px 0 16px;">Confirm your email</h1>
    <p style="font-size:15px;line-height:1.6;color:${ink};margin:0 0 22px;">
      One more step: confirm this is your email address. This link is valid for 24 hours.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:${ink};border-radius:4px;">
          <a href="${escapeHtml(verifyUrl)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;">Confirm email</a>
        </td>
      </tr>
    </table>
    <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#8c867e;">
      Or paste this link into your browser:<br />
      <span style="word-break:break-all;">${escapeHtml(verifyUrl)}</span>
    </p>
    <p style="margin:22px 0 0;padding-top:18px;border-top:1px solid #e5ded2;font-size:13px;color:#8c867e;">
      Didn't create this account? You can ignore this email.
    </p>
  </div>
</body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
