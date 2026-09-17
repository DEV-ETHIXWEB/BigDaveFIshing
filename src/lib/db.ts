import { createClient, type Client } from '@libsql/client';
import { mkdirSync } from 'node:fs';
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
    const configured = envVar('TURSO_DATABASE_URL');
    const url = configured || 'file:./data/waivers.db';
    const authToken = envVar('TURSO_AUTH_TOKEN');

    if (url.startsWith('file:')) {
      /**
       * The local-file fallback is a convenience for `astro dev`, and it cannot work on
       * a serverless host: the filesystem is read-only outside /tmp, and /tmp does not
       * survive between invocations. Reaching here in production means TURSO_DATABASE_URL
       * was never set on the deployment.
       *
       * It used to call mkdirSync and let it throw EROFS, which surfaced as a bare 500
       * on every page that touches the database and named nothing useful - the failure
       * looked like a code fault rather than a missing environment variable. Saying so
       * directly is the whole fix; the condition is unchanged.
       */
      // Only the FALLBACK is refused, not a file: URL someone configured on purpose.
      // Deliberately choosing a local file - a self-hosted Node deployment with a real
      // disk, say - is a decision this has no business overriding; silently falling back
      // to one on a serverless host is the accident worth stopping.
      if (import.meta.env.PROD && !configured) {
        throw new Error(
          'TURSO_DATABASE_URL is not set. This deployment fell back to a local SQLite file, ' +
            'which cannot work on a read-only serverless filesystem. Create a database at ' +
            'https://turso.tech and set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN on the project.',
        );
      }

      // A fresh clone has no ./data yet, and libSQL fails to open the file rather than
      // creating the parent directory itself - so "zero setup" needs this one line.
      // Wrapped because a directory that already exists, or one another process just
      // created, must not take the request down.
      try {
        mkdirSync('./data', { recursive: true });
      } catch (error) {
        throw new Error(
          `Could not create the local ./data directory for the development database: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

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

/**
 * Creates the table on first use. Safe to call on every request; it's a no-op after.
 *
 * A failure clears the memo rather than keeping it. The promise used to be cached
 * whatever happened, so one transient error - the database asleep, a network blip on
 * the first request an instance served - poisoned that instance permanently: every
 * later request awaited the same rejected promise and 500'd, and only a cold start
 * ever cleared it. Now a failed attempt is simply retried by the next request.
 */
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
        minor_names TEXT,
        signature_png TEXT NOT NULL,
        signed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `,
      )
      .then(() =>
        db.batch([
          /**
           * Duplicate protection, scoped to the thing being protected against.
           *
           * There was one index here: UNIQUE (waiver_type, COALESCE(group_code,''),
           * guest_phone). For a team link that is right - one person signs once for one
           * trip. For a sign-ahead waiver, where group_code is NULL, it collapsed to
           * "this phone number may sign this waiver type once, ever". A guest who fished
           * last September and booked again this year was told "a waiver has already been
           * submitted for this phone number" and had no way past it. So was the second
           * adult in a couple who share a phone. That is a returning customer turned away
           * by the booking system, which is the most expensive thing this table can do.
           *
           * Replaced by two narrower rules, both strictly looser than the old one, so no
           * existing row can violate them:
           *
           *   team link  -> one signature per phone per team. Unchanged behaviour.
           *   sign-ahead -> one signature per phone per waiver type PER DAY, which still
           *                 stops a double-tap or a refreshed form, and says nothing about
           *                 next season.
           */
          `DROP INDEX IF EXISTS waivers_one_submission_per_guest`,
          `CREATE UNIQUE INDEX IF NOT EXISTS waivers_one_per_team_guest
             ON waivers (waiver_type, group_code, guest_phone)
             WHERE group_code IS NOT NULL`,
          `CREATE UNIQUE INDEX IF NOT EXISTS waivers_one_per_day_guest
             ON waivers (waiver_type, guest_phone, date(signed_at))
             WHERE group_code IS NULL`,
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
          // Customer accounts: unrelated to waivers, just created alongside them since
          // this is the one place schema setup happens. COLLATE NOCASE on email so
          // Jane@x.com and jane@x.com are the same account, not two.
          `CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
          // A customer's forgot-password flow. Only ever stores the SHA-256 of the
          // token that goes out in the email, never the token itself - a leaked table
          // must not hand out working reset links, the same reasoning that already
          // keeps session cookies signed rather than storing a raw shared secret.
          // customer_id has no foreign-key ON DELETE action because nothing here ever
          // deletes a customer row; if that changes, this table needs the same look.
          `CREATE TABLE IF NOT EXISTS customer_password_resets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at TEXT NOT NULL,
            used_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
          `CREATE INDEX IF NOT EXISTS customer_password_resets_token_hash ON customer_password_resets (token_hash)`,
          `CREATE INDEX IF NOT EXISTS customer_password_resets_customer_id ON customer_password_resets (customer_id)`,
          // A separate table from customer_password_resets rather than a shared one
          // with a "purpose" column, on purpose: a token leaked or reused across
          // purposes (a verification link that could also reset a password) is a
          // strictly worse failure mode than two nearly-identical tables, and the two
          // are consumed by completely different routes that have no reason to share a
          // query.
          `CREATE TABLE IF NOT EXISTS customer_email_verifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at TEXT NOT NULL,
            used_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
          `CREATE INDEX IF NOT EXISTS customer_email_verifications_token_hash ON customer_email_verifications (token_hash)`,
          `CREATE INDEX IF NOT EXISTS customer_email_verifications_customer_id ON customer_email_verifications (customer_id)`,
          // A record of a booking enquiry, kept for a signed-in customer to see on
          // /account. Written only after the email to Dave has already been confirmed
          // sent (see sendBookingEnquiry's caller in api/booking.ts) - this table is a
          // side effect of a successful enquiry, never what decides whether one
          // succeeded. customer_id is NULL for every enquiry from a visitor who wasn't
          // signed in, which is most of them; nothing here requires an account.
          `CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT,
            trip_type TEXT NOT NULL,
            message TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
          `CREATE INDEX IF NOT EXISTS bookings_customer_id ON bookings (customer_id)`,
          // Staff logins the master admin (env-var ADMIN_USER/ADMIN_PASSWORD) creates.
          // Deliberately a separate table from `customers`: two unrelated kinds of
          // account that happen to share a hashing scheme should never share a table,
          // an accidental join or a copy-pasted query must not be able to hand a
          // customer staff access or vice versa.
          `CREATE TABLE IF NOT EXISTS staff_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
          // One signature per admin identity ('master', or 'staff:<staff_accounts.id>'),
          // not per action - an admin who acts 50 times a day doesn't store the same PNG
          // 50 times, and a redrawn signature is reflected everywhere at once rather than
          // needing every past record migrated.
          `CREATE TABLE IF NOT EXISTS admin_signatures (
            admin_key TEXT PRIMARY KEY,
            signature_png TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
          // Who did what, automatically stamped from the session, never from anything
          // the request claims. admin_name is captured at the time rather than joined
          // live, so removing a staff login later doesn't rewrite what the log already
          // says happened.
          `CREATE TABLE IF NOT EXISTS admin_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_key TEXT NOT NULL,
            admin_name TEXT NOT NULL,
            action TEXT NOT NULL,
            target TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`,
          `CREATE INDEX IF NOT EXISTS admin_actions_created_at ON admin_actions (created_at DESC)`,
        ]),
      )
      .then(() => migrate())
      .then(() => undefined)
      .catch((error) => {
        // Drop the memo so the next request starts a fresh attempt, then re-throw so
        // this caller still fails honestly rather than continuing against a database
        // whose schema was never confirmed.
        initialized = null;
        throw error;
      });
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
 * leaves the row queued for tomorrow rather than silently dropping it. `minor_names`
 * holds the under-18s a signing adult is bringing; NULL on every waiver signed before
 * the form asked, which is not the same as "came alone" and is why nothing infers a
 * child count from its absence.
 */
async function migrate() {
  const info = await db.execute('PRAGMA table_info(waivers)');
  const existing = new Set(info.rows.map((row) => String(row.name)));

  const statements = [
    !existing.has('archived_at') && 'ALTER TABLE waivers ADD COLUMN archived_at TEXT',
    !existing.has('emailed_at') && 'ALTER TABLE waivers ADD COLUMN emailed_at TEXT',
    !existing.has('minor_names') && 'ALTER TABLE waivers ADD COLUMN minor_names TEXT',
    // NULL for every waiver signed by a guest with no account, which is most of them,
    // and for every waiver signed before this column existed - both correctly, there is
    // no account to attribute those to. Set only going forward, at submission time, for
    // whoever is actually signed in at that moment (api/waivers.ts) - never guessed
    // afterwards by matching name, phone or email against old rows, which would risk
    // handing one guest's signed waiver to a different customer's account on nothing
    // more than a coincidence of contact details.
    !existing.has('customer_id') && 'ALTER TABLE waivers ADD COLUMN customer_id INTEGER',
  ].filter((sql): sql is string => Boolean(sql));

  if (statements.length) await db.batch(statements);

  // The dashboard's default view is "not archived", and the digest's query is
  // "not archived and not yet emailed". Both filter on these before ordering.
  // customer_id is what /account's own waiver list filters and orders by.
  await db.batch([
    `CREATE INDEX IF NOT EXISTS waivers_archived_at ON waivers (archived_at)`,
    `CREATE INDEX IF NOT EXISTS waivers_emailed_at ON waivers (emailed_at)`,
    `CREATE INDEX IF NOT EXISTS waivers_customer_id ON waivers (customer_id)`,
  ]);

  // Added after `customers` first shipped, same reasoning as above: read the existing
  // shape, only add what's missing. Every pre-existing row gets DEFAULT 1, which is
  // exactly right - it is indistinguishable from an account that has never had its
  // password reset.
  const customerInfo = await db.execute('PRAGMA table_info(customers)');
  const customerColumns = new Set(customerInfo.rows.map((row) => String(row.name)));
  if (!customerColumns.has('session_version')) {
    await db.execute('ALTER TABLE customers ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1');
  }
  // NULL until the address is confirmed. Every row that existed before this column did
  // starts NULL too - correctly: nobody had proven ownership of their address before
  // this existed either, so treating pre-existing accounts as verified would be the
  // one actively wrong default here.
  if (!customerColumns.has('email_verified_at')) {
    await db.execute('ALTER TABLE customers ADD COLUMN email_verified_at TEXT');
  }
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
  /**
   * JSON array of the under-18s this adult is bringing, e.g. `["Sam Ruiz","Ada Ruiz"]`.
   * NULL for waivers signed before the field existed, and for adults bringing no kids.
   * Read it through `parseMinorNames`, never `JSON.parse` at the call site.
   */
  minor_names: string | null;
  signature_png: string;
  signed_at: string;
  /** Set when staff pressed Archive. NULL while the waiver is still on the active list. */
  archived_at: string | null;
  /** Set only after a provider confirmed the digest send that included this row. */
  emailed_at: string | null;
  /** The signed-in customer who submitted this, if any - see the column's own note in db.ts. */
  customer_id: number | null;
}

export interface Booking {
  id: number;
  customer_id: number | null;
  name: string;
  phone: string;
  email: string | null;
  trip_type: string;
  message: string | null;
  created_at: string;
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
  guest_name, guest_email, guest_phone, emergency_contact_name, emergency_contact_phone,
  minor_names, signed_at, archived_at, emailed_at`;

/**
 * Reads the `minor_names` column back into a list.
 *
 * Tolerant on purpose: the column is NULL on every row written before the field shipped,
 * and a malformed value should cost one waiver its child list, not throw and take down
 * the whole dashboard or digest send.
 */
export function parseMinorNames(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((name): name is string => typeof name === 'string' && name.trim() !== '');
  } catch {
    return [];
  }
}

export interface WaiverTeam {
  id: number;
  team_number: number;
  leader_name: string;
  waiver_type: 'fishing-adventure' | 'lodge';
  trip_date: string | null;
  group_code: string;
  created_at: string;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  /**
   * Bumped on every successful password reset (never on a normal login). A session
   * cookie signed under an older version fails validation - see customer-auth.ts - so
   * resetting a password also closes out any session issued before the reset, without
   * needing a server-side session table.
   */
  session_version: number;
  /** NULL until the address is confirmed via the link sent on signup. See db.ts's migration note. */
  email_verified_at: string | null;
  created_at: string;
}

export interface CustomerPasswordReset {
  id: number;
  customer_id: number;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface StaffAccount {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface AdminAction {
  id: number;
  admin_key: string;
  admin_name: string;
  action: string;
  target: string | null;
  created_at: string;
}
