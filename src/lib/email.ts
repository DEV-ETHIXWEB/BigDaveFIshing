/**
 * Outbound mail, over the provider's HTTP API rather than SMTP.
 *
 * Vercel functions can't hold an SMTP connection open, and nothing here needs a
 * dependency: each provider is one POST. Which one is used is decided by whichever key
 * is present, so switching is a matter of swapping environment variables — no code
 * change, no redeploy of anything but the settings.
 *
 * Deliverability is the part that actually decides whether this system is trusted.
 * `WAIVER_DIGEST_FROM` must be a sender the provider has verified. Best is a verified
 * domain with SPF and DKIM published; a single verified address works with no DNS at all
 * but aligns neither, so more of it is filtered. A digest in spam is worse than no
 * digest — Dave stops looking for it and nobody notices the roster stopped arriving. See
 * docs/waiver-email-setup.md.
 */

export interface EmailAttachment {
  filename: string;
  /** Base64-encoded content. */
  content: string;
  contentType: string;
}

export interface EmailMessage {
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export type MailProvider = 'smtp2go' | 'resend' | 'postmark';

export type SendResult =
  { ok: true; id: string | null; provider: MailProvider } | { ok: false; error: string };

export interface MailConfig {
  provider: MailProvider;
  apiKey: string;
  from: string;
  to: string[];
}

/** Splits a comma- or semicolon-separated recipient list, tolerating stray whitespace. */
export function parseRecipients(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((address) => address.trim())
    .filter(Boolean);
}

/**
 * Reads mail settings from the environment, or explains what is missing.
 *
 * Returning the reason rather than throwing lets the dashboard say "email isn't set up
 * yet, here's what's missing" instead of the digest failing invisibly at 6am.
 */
export function mailConfig(): { config: MailConfig } | { missing: string[] } {
  // Fixed precedence, so a leftover key from a provider you moved away from can never
  // silently take over the send. First one set wins, in this order.
  const candidates: Array<[MailProvider, string | undefined]> = [
    ['smtp2go', import.meta.env.SMTP2GO_API_KEY?.trim()],
    ['resend', import.meta.env.RESEND_API_KEY?.trim()],
    ['postmark', import.meta.env.POSTMARK_SERVER_TOKEN?.trim()],
  ];
  const chosen = candidates.find(([, key]) => Boolean(key));

  const from = import.meta.env.WAIVER_DIGEST_FROM?.trim();
  const to = parseRecipients(import.meta.env.WAIVER_DIGEST_TO);

  const missing: string[] = [];
  if (!chosen) missing.push('SMTP2GO_API_KEY (or RESEND_API_KEY / POSTMARK_SERVER_TOKEN)');
  if (!from) missing.push('WAIVER_DIGEST_FROM');
  if (to.length === 0) missing.push('WAIVER_DIGEST_TO');
  if (missing.length) return { missing };

  const [provider, apiKey] = chosen!;
  return { config: { provider, apiKey: apiKey!, from: from!, to } };
}

/** True when the environment has everything the digest needs to send. */
export function mailIsConfigured() {
  return 'config' in mailConfig();
}

export async function sendEmail(config: MailConfig, message: EmailMessage): Promise<SendResult> {
  try {
    if (config.provider === 'smtp2go') return await sendViaSmtp2go(config, message);
    if (config.provider === 'resend') return await sendViaResend(config, message);
    return await sendViaPostmark(config, message);
  } catch (error) {
    // Network failure, DNS, timeout. Reported rather than thrown so the caller can
    // leave emailed_at unset and try again on the next run.
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * SMTP2GO, over its HTTP API rather than SMTP — same reasoning as the others, and it
 * avoids a serverless function holding a socket open.
 *
 * Chosen for this project because it is the one provider here that will send from a
 * *single verified sender address* — you click a link in that inbox and you are done, no
 * DNS records and no domain of your own. Resend refuses to send anywhere but your own
 * signup address until a domain is verified, which makes it useless without control of
 * bigdavesfishing.com.
 *
 * The trade-off is real and worth knowing: a single verified sender does not align SPF
 * and DKIM with the From domain, so deliverability is meaningfully worse than a verified
 * domain. Fine for a demo and for early use; verify the real domain before Dave depends
 * on it.
 */
async function sendViaSmtp2go(config: MailConfig, message: EmailMessage): Promise<SendResult> {
  const response = await fetch('https://api.smtp2go.com/v3/email/send', {
    method: 'POST',
    headers: {
      'X-Smtp2go-Api-Key': config.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: config.from,
      to: message.to,
      subject: message.subject,
      html_body: message.html,
      text_body: message.text,
      ...(message.replyTo
        ? { custom_headers: [{ header: 'Reply-To', value: message.replyTo }] }
        : {}),
      ...(message.attachments?.length
        ? {
            attachments: message.attachments.map((file) => ({
              filename: file.filename,
              fileblob: file.content,
              mimetype: file.contentType,
            })),
          }
        : {}),
    }),
  });

  const body = await readJson(response);
  const data = (body?.data ?? null) as Record<string, unknown> | null;

  // SMTP2GO answers 200 even when it accepted nothing — an unverified sender comes back
  // as succeeded: 0 with the reason in `failures`. Treating that as success is exactly
  // how a roster gets marked sent and never arrives.
  const succeeded = typeof data?.succeeded === 'number' ? data.succeeded : 0;
  if (!response.ok || succeeded < 1) {
    const failures = Array.isArray(data?.failures) ? data.failures.join('; ') : '';
    const reason =
      (typeof data?.error === 'string' && data.error) ||
      failures ||
      (body ? JSON.stringify(body).slice(0, 300) : 'no response body');
    return { ok: false, error: `SMTP2GO rejected the send (HTTP ${response.status}): ${reason}` };
  }

  return {
    ok: true,
    id: typeof data?.email_id === 'string' ? data.email_id : null,
    provider: 'smtp2go',
  };
}

async function sendViaResend(config: MailConfig, message: EmailMessage): Promise<SendResult> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      ...(message.attachments?.length
        ? {
            attachments: message.attachments.map((file) => ({
              filename: file.filename,
              content: file.content,
            })),
          }
        : {}),
    }),
  });

  const body = await readJson(response);
  if (!response.ok) {
    return { ok: false, error: providerError('Resend', response.status, body) };
  }
  return { ok: true, id: typeof body?.id === 'string' ? body.id : null, provider: 'resend' };
}

async function sendViaPostmark(config: MailConfig, message: EmailMessage): Promise<SendResult> {
  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'X-Postmark-Server-Token': config.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      From: config.from,
      To: message.to.join(', '),
      Subject: message.subject,
      HtmlBody: message.html,
      TextBody: message.text,
      // The transactional stream. A roster Dave depends on must never go out on a
      // broadcast stream, where a single unsubscribe click would stop it arriving.
      MessageStream: 'outbound',
      ...(message.replyTo ? { ReplyTo: message.replyTo } : {}),
      ...(message.attachments?.length
        ? {
            Attachments: message.attachments.map((file) => ({
              Name: file.filename,
              Content: file.content,
              ContentType: file.contentType,
            })),
          }
        : {}),
    }),
  });

  const body = await readJson(response);
  // Postmark can answer 200 with an ErrorCode in the body — a non-zero code is a failure
  // even though the HTTP status says otherwise.
  if (!response.ok || (typeof body?.ErrorCode === 'number' && body.ErrorCode !== 0)) {
    return { ok: false, error: providerError('Postmark', response.status, body) };
  }
  return {
    ok: true,
    id: typeof body?.MessageID === 'string' ? body.MessageID : null,
    provider: 'postmark',
  };
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function providerError(name: string, status: number, body: Record<string, unknown> | null) {
  const detail =
    (typeof body?.message === 'string' && body.message) ||
    (typeof body?.Message === 'string' && body.Message) ||
    (body ? JSON.stringify(body).slice(0, 300) : 'no response body');
  return `${name} rejected the send (HTTP ${status}): ${detail}`;
}
