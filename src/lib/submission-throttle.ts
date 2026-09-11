import { callerKey } from './login-throttle';

export { callerKey };

/**
 * Sliding-window rate limits for the public submission endpoints.
 *
 * Without them the endpoints accept submissions as fast as they can be sent, and a waiver
 * row carries up to 400 kB of signature data, a cheap way to bloat a hosted database.
 *
 * The limits have to be generous, and the reason matters: a fishing party all sign from
 * the lodge's wifi, so a whole group shares one IP. A tight per-IP limit would block
 * exactly the case this feature exists for.
 *
 * There are deliberately two budgets, because "a stored waiver" and "a request that was
 * thrown out" cost wildly different things and must not share a number:
 *
 *   ACCEPTED  what actually lands in the table. This is the real resource.
 *   ATTEMPTS  every request, including ones rejected for a bad phone number. Only there
 *             to stop a flood; rejection is cheap, so it can be much higher.
 *
 * One counter used to serve both, incremented before the payload was even parsed. Six
 * guests making three typos each came to eighteen of twenty, so a group could lock itself
 * out of the form on mistakes alone - and the endpoint then answered 429 to the very
 * people it exists for.
 *
 * In-memory, with the same caveat as the login throttle: per-instance on a serverless
 * host, so a spread-out attacker gets more than the number suggests. It costs nothing and
 * needs no extra infrastructure. Move it to the database if abuse ever becomes real.
 */
const MAX_ACCEPTED_PER_WINDOW = 20;
const MAX_ATTEMPTS_PER_WINDOW = 60;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_TRACKED = 5000;

/** Caller key -> timestamps of requests made, whatever their outcome. */
const attempts = new Map<string, number[]>();
/** Caller key -> timestamps of submissions that were actually stored. */
const accepted = new Map<string, number[]>();

function prune(store: Map<string, number[]>, now: number) {
  if (store.size < MAX_TRACKED) return;
  for (const [key, times] of store) {
    if (times.every((t) => now - t > WINDOW_MS)) store.delete(key);
  }
}

/** Timestamps for this key still inside the window. */
function recent(store: Map<string, number[]>, key: string, now: number): number[] {
  return (store.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
}

/** Seconds until the oldest entry in the window frees a slot. */
function secondsUntilFree(times: number[], now: number): number {
  return Math.max(1, Math.ceil((WINDOW_MS - (now - times[0]!)) / 1000));
}

/**
 * Records an attempt and reports whether the caller is over either limit.
 * Returns seconds until they may try again, or 0 when allowed.
 *
 * Call this before doing any work. Then, once a submission has actually been stored,
 * call `recordAcceptedSubmission` - that is what consumes the smaller budget.
 */
export function submissionRetryAfter(key: string, now = Date.now()): number {
  prune(attempts, now);
  prune(accepted, now);

  // The expensive budget first: already at the ceiling for stored submissions means no
  // amount of further attempts can succeed, so say so rather than letting them retry.
  const stored = recent(accepted, key, now);
  if (stored.length >= MAX_ACCEPTED_PER_WINDOW) {
    accepted.set(key, stored);
    return secondsUntilFree(stored, now);
  }

  const tried = recent(attempts, key, now);
  if (tried.length >= MAX_ATTEMPTS_PER_WINDOW) {
    attempts.set(key, tried);
    return secondsUntilFree(tried, now);
  }

  tried.push(now);
  attempts.set(key, tried);
  return 0;
}

/**
 * Marks one submission as having been stored. Call it only on success - a rejected
 * request has already been counted as an attempt and must not also spend this budget.
 */
export function recordAcceptedSubmission(key: string, now = Date.now()): void {
  accepted.set(key, [...recent(accepted, key, now), now]);
}
