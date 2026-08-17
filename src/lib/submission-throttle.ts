import { callerKey } from './login-throttle';

export { callerKey };

/**
 * Sliding-window rate limit for the public waiver endpoint.
 *
 * Without it the endpoint accepts submissions as fast as they can be sent, and each row
 * carries up to 400 kB of signature data, a cheap way to bloat a hosted database.
 *
 * The limit has to be generous, and the reason matters: a fishing party all sign from the
 * lodge's wifi, so a whole group shares one IP. A tight per-IP limit would block exactly
 * the case this feature exists for. Twenty in ten minutes comfortably clears the largest
 * group the lodge sleeps (six) plus retries and mistakes, while still turning "unlimited"
 * into a number.
 *
 * In-memory, with the same caveat as the login throttle: per-instance on a serverless
 * host, so a spread-out attacker gets more than the number suggests. It costs nothing and
 * needs no extra infrastructure. Move it to the database if abuse ever becomes real.
 */
const MAX_PER_WINDOW = 20;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_TRACKED = 5000;

/** Caller key -> timestamps of recent accepted submissions. */
const hits = new Map<string, number[]>();

function prune(now: number) {
  if (hits.size < MAX_TRACKED) return;
  for (const [key, times] of hits) {
    if (times.every((t) => now - t > WINDOW_MS)) hits.delete(key);
  }
}

/**
 * Records an attempt and reports whether it is over the limit.
 * Returns seconds until the caller may try again, or 0 when allowed.
 */
export function submissionRetryAfter(key: string, now = Date.now()): number {
  prune(now);
  const times = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (times.length >= MAX_PER_WINDOW) {
    hits.set(key, times);
    // Oldest entry in the window decides when a slot frees up.
    return Math.max(1, Math.ceil((WINDOW_MS - (now - times[0]!)) / 1000));
  }

  times.push(now);
  hits.set(key, times);
  return 0;
}
