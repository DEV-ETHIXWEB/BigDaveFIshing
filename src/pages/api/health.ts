import type { APIRoute } from 'astro';
import { db, ensureSchema } from '../../lib/db';
import { envVar } from '../../lib/env';

export const prerender = false;

/**
 * Deployment self-check.
 *
 * Born out of a live 500 that could not be diagnosed from outside: every page that used
 * the database returned an empty error page, Vercel's logs were the only source of truth,
 * and there was no way to tell from the public site whether a given fix had even shipped.
 * This answers both: which commit is running, and whether the database and mail
 * configuration are actually visible to the running function.
 *
 * Deliberately public, and deliberately leaks nothing: environment variables are reported
 * as present/absent booleans, never values, and the database error is reduced to its type
 * plus a truncated message with any connection string stripped out. It exposes no guest
 * data and no credentials, nothing here helps an attacker who can already see that the
 * site is up.
 */
export const GET: APIRoute = async () => {
  const present = (name: string) => Boolean(envVar(name));

  let database: { ok: boolean; error?: string } = { ok: false };
  try {
    await ensureSchema();
    await db.execute('SELECT COUNT(*) AS count FROM waivers');
    database = { ok: true };
  } catch (error) {
    database = { ok: false, error: redact(error) };
  }

  return new Response(
    JSON.stringify(
      {
        // Vercel injects this at runtime. It is how you tell whether the deployment you
        // are looking at contains the commit you just pushed.
        commit: envVar('VERCEL_GIT_COMMIT_SHA')?.slice(0, 7) ?? 'unknown',
        environment: envVar('VERCEL_ENV') ?? 'local',
        database,
        config: {
          TURSO_DATABASE_URL: present('TURSO_DATABASE_URL'),
          TURSO_AUTH_TOKEN: present('TURSO_AUTH_TOKEN'),
          ADMIN_USER: present('ADMIN_USER'),
          ADMIN_PASSWORD: present('ADMIN_PASSWORD'),
          ADMIN_SESSION_SECRET: present('ADMIN_SESSION_SECRET'),
          SMTP2GO_API_KEY: present('SMTP2GO_API_KEY'),
          RESEND_API_KEY: present('RESEND_API_KEY'),
          WAIVER_DIGEST_FROM: present('WAIVER_DIGEST_FROM'),
          WAIVER_DIGEST_TO: present('WAIVER_DIGEST_TO'),
          CRON_SECRET: present('CRON_SECRET'),
          PUBLIC_SITE_URL: present('PUBLIC_SITE_URL'),
        },
      },
      null,
      2,
    ),
    { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
  );
};

/** Error type and a short message, with anything URL-shaped removed. */
function redact(error: unknown) {
  if (!(error instanceof Error)) return String(error).slice(0, 120);
  const message = error.message.replace(/[a-z]+:\/\/[^\s"')]+/gi, '[url]');
  return `${error.name}: ${message}`.slice(0, 200);
}
