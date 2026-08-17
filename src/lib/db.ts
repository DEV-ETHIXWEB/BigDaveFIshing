import { createClient, type Client } from '@libsql/client';
import { envVar } from './env';

/**
 * Waiver storage. Uses libSQL rather than a plain file-based SQLite driver
 * (e.g. better-sqlite3): this project deploys to Vercel, whose functions have a
 * read-only filesystem outside of a request and don't persist /tmp between
 * invocations, so a local file wouldn't survive past one submission.
 *
 * libSQL speaks the same SQL and defaults to a local file, so right now, with zero
 * setup, this works end to end. For a real deployment, create a free database at
 * https://turso.tech and set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN as environment
 * variables; no code changes needed, same client either way.
 */

/**
 * The client is built on first use, not on import.
 *
 * Creating it at module scope meant a misconfigured environment threw while the module
 * was still loading, which Astro can only turn into a blank 500 on every page that
 * imports it, including pages that never touch the database. Deferring it means a config
 * problem surfaces at the query, as a normal error, on the one page that actually needs
 * the data.
 */
let client: Client | null = null;
function getClient(): Client {
  if (!client) {
    const url = envVar('TURSO_DATABASE_URL') || 'file:./data/waivers.db';
    const authToken = envVar('TURSO_AUTH_TOKEN');
    client = createClient(authToken ? { url, authToken } : { url });
  }
  return client;
}

/**
 * Kept as a `db.execute(...)` value so every existing call site is unchanged; the proxy
 * just makes the connection lazy.
 */
export const db = new Proxy({} as Client, {
  get(_target, property) {
    const active = getClient() as unknown as Record<string | symbol, unknown>;
    const value = active[property];
    return typeof value === 'function' ? value.bind(active) : value;
  },
});

let initialized: Promise<void> | null = null;

/** Creates the table on first use. Safe to call on every request; it's a no-op after. */
export function ensureSchema() {
  if (!initialized) {
    initialized = db
      .execute(
        `
      CREATE TABLE IF NOT EXISTS waivers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        waiver_type TEXT NOT NULL,
        group_code TEXT,
        group_leader_name TEXT,
        trip_date TEXT,
        guest_name TEXT NOT NULL,
        guest_email TEXT,
        guest_phone TEXT NOT NULL,
        emergency_contact_name TEXT NOT NULL,
        emergency_contact_phone TEXT NOT NULL,
        signature_png TEXT NOT NULL,
        signed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `,
      )
      .then(() =>
        db.batch([
          `CREATE UNIQUE INDEX IF NOT EXISTS waivers_one_submission_per_guest
             ON waivers (waiver_type, COALESCE(group_code, ''), guest_phone)`,
          `CREATE TABLE IF NOT EXISTS waiver_teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_number INTEGER NOT NULL UNIQUE,
            leader_name TEXT NOT NULL,
            waiver_type TEXT NOT NULL,
            trip_date TEXT,
            group_code TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
          // The dashboard orders every waiver by signed_at and the submit path looks a
          // team up by group_code on each insert. Both were full scans.
          `CREATE INDEX IF NOT EXISTS waivers_signed_at ON waivers (signed_at DESC)`,
          `CREATE INDEX IF NOT EXISTS waivers_group_code ON waivers (group_code)`,
        ]),
      )
      .then(() => migrate())
      .then(() => undefined);
  }
  return initialized;
}

/**
 * Columns added after the table was first shipped.
 *
 * SQLite has no `ADD COLUMN IF NOT EXISTS`, and a live database already holds signed
 * waivers, so this reads the existing shape and only adds what is missing. Both columns
 * are nullable with no default, a NULL means "not yet", which is exactly the state
 * every existing row is in.
 *
 * `archived_at` is set when a human presses Archive on the dashboard. `emailed_at` is
 * set only after a mail provider has confirmed the digest went out, so a failed send
 * leaves the row queued for tomorrow rather than silently dropping it.
 */
async function migrate() {
  const info = await db.execute('PRAGMA table_info(waivers)');
  const existing = new Set(info.rows.map((row) => String(row.name)));

  const statements = [
    !existing.has('archived_at') && 'ALTER TABLE waivers ADD COLUMN archived_at TEXT',
    !existing.has('emailed_at') && 'ALTER TABLE waivers ADD COLUMN emailed_at TEXT',
  ].filter((sql): sql is string => Boolean(sql));

  if (statements.length) await db.batch(statements);

  // The dashboard's default view is "not archived", and the digest's query is
  // "not archived and not yet emailed". Both filter on these before ordering.
  await db.batch([
    `CREATE INDEX IF NOT EXISTS waivers_archived_at ON waivers (archived_at)`,
    `CREATE INDEX IF NOT EXISTS waivers_emailed_at ON waivers (emailed_at)`,
  ]);
}

export interface WaiverRecord {
  id: number;
  waiver_type: string;
  group_code: string | null;
  group_leader_name: string | null;
  trip_date: string | null;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  signature_png: string;
  signed_at: string;
  /** Set when staff pressed Archive. NULL while the waiver is still on the active list. */
  archived_at: string | null;
  /** Set only after a provider confirmed the digest send that included this row. */
  emailed_at: string | null;
}

/**
 * A waiver as the dashboard lists it: everything except the signature image.
 *
 * The signature is a base64 data URL, typically 8–15 kB each. Selecting it into the list
 * meant a page of 61 waivers shipped 1 MB of HTML, 88% of it signature payload, on every
 * load and on every poll-triggered refresh. The dashboard now renders each signature as
 * an <img> pointing at /api/admin/signature/[id], which lazy-loads and caches.
 *
 * Keep signature_png out of any query that returns more than one row.
 */
export type WaiverListRow = Omit<WaiverRecord, 'signature_png'>;

/** Column list for list views. Explicit so `SELECT *` can't quietly re-add the blob. */
export const WAIVER_LIST_COLUMNS = `id, waiver_type, group_code, group_leader_name, trip_date,
  guest_name, guest_email, guest_phone, emergency_contact_name, emergency_contact_phone, signed_at,
  archived_at, emailed_at`;

export interface WaiverTeam {
  id: number;
  team_number: number;
  leader_name: string;
  waiver_type: 'fishing-adventure' | 'lodge';
  trip_date: string | null;
  group_code: string;
  created_at: string;
}
