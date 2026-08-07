import { createClient } from '@libsql/client';

/**
 * Waiver storage. Uses libSQL rather than a plain file-based SQLite driver
 * (e.g. better-sqlite3): this project deploys to Vercel, whose functions have a
 * read-only filesystem outside of a request and don't persist /tmp between
 * invocations, so a local file wouldn't survive past one submission.
 *
 * libSQL speaks the same SQL and defaults to a local file — so right now, with zero
 * setup, this works end to end. For a real deployment, create a free database at
 * https://turso.tech and set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN as environment
 * variables; no code changes needed, same client either way.
 */
const url = import.meta.env.TURSO_DATABASE_URL || 'file:./data/waivers.db';
const authToken = import.meta.env.TURSO_AUTH_TOKEN;

export const db = createClient(authToken ? { url, authToken } : { url });

let initialized: Promise<void> | null = null;

/** Creates the table on first use. Safe to call on every request — it's a no-op after. */
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
        ]),
      )
      .then(() => undefined);
  }
  return initialized;
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
