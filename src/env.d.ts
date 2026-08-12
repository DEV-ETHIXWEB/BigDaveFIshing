/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly TURSO_DATABASE_URL?: string;
  readonly TURSO_AUTH_TOKEN?: string;
  readonly ADMIN_USER?: string;
  readonly ADMIN_PASSWORD?: string;
  readonly ADMIN_SESSION_SECRET?: string;
  /** Set whichever one matches the provider you signed up with. First set wins, in this order. */
  readonly SMTP2GO_API_KEY?: string;
  readonly RESEND_API_KEY?: string;
  readonly POSTMARK_SERVER_TOKEN?: string;
  /** Must be on a domain verified with the provider, or the digest lands in spam. */
  readonly WAIVER_DIGEST_FROM?: string;
  /** Comma-separated. Who receives the roster. */
  readonly WAIVER_DIGEST_TO?: string;
  /** Vercel sends this as a bearer token to the cron route. */
  readonly CRON_SECRET?: string;
  /** Public site origin, used for the dashboard link inside the email. */
  readonly PUBLIC_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
