/**
 * How dates are rendered anywhere a human reads one.
 *
 * Every formatter here pins both the locale and the timezone, deliberately. A bare
 * `toLocaleString()` uses whatever the *runtime* is set to, and on a server-rendered page
 * that is the server, not the reader: on Vercel that means UTC, and a locale that is not
 * guaranteed to be American. The dashboard used bare calls and showed `11/9/2026` for the
 * 9th of November where the digest email, which already pinned both, said `Sep 11`. Two
 * different dates for one signing, and for a trip date that is a real chance of reading
 * the wrong day.
 *
 * The business runs in Tillamook, Oregon, so that is the timezone every reader wants,
 * whichever machine happens to render the page.
 */
const SHOP_TIME_ZONE = 'America/Los_Angeles';
const SHOP_LOCALE = 'en-US';

/**
 * A `signed_at` value from the database, which is UTC and stored as `2026-08-12 14:30`.
 *
 * `full` is for the dashboard, where a waiver may be looked at months later and the year
 * matters. The short form is for the daily digest, which is always about today.
 */
export function formatSignedAt(signedAt: string, style: 'full' | 'short' = 'full'): string {
  const date = new Date(signedAt.replace(' ', 'T') + 'Z');
  // An unparseable value is handed back untouched rather than shown as "Invalid Date":
  // seeing the raw column is more use to whoever has to work out what went wrong.
  if (Number.isNaN(date.getTime())) return signedAt;

  return date.toLocaleString(SHOP_LOCALE, {
    timeZone: SHOP_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    ...(style === 'full' ? { year: 'numeric' } : {}),
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * A trip date, stored as a plain `2026-03-14` with no time, read back as `Mar 14, 2026`.
 *
 * Built through `Date.UTC` and rendered in UTC on purpose: this is a calendar date, not a
 * moment. Parsing it as local time then rendering it in Pacific would shift it a day
 * backwards for anyone east of the shop.
 */
export function formatTripDate(tripDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tripDate.trim());
  // Anything that is not a plain ISO date is passed through untouched, which is what the
  // column allowed before this format was settled on.
  if (!match) return tripDate;

  const date = new Date(Date.UTC(+match[1]!, +match[2]! - 1, +match[3]!));
  if (Number.isNaN(date.getTime())) return tripDate;

  return date.toLocaleDateString(SHOP_LOCALE, {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
