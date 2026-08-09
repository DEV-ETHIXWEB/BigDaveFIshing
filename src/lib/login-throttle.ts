/**
 * Rate limiting for the admin login endpoint.
 *
 * Without it, /api/admin/login accepts unlimited guesses at whatever pace an attacker can
 * send them — and with a short password that is a matter of seconds. Every failure now
 * costs the caller, and after enough of them their IP is locked out for a while.
 *
 * In-memory on purpose, with eyes open about the limits: on a serverless host each
 * instance keeps its own counters, so a determined attacker spread across many cold
 * starts gets more attempts than the numbers below suggest. It is still the difference
 * between "unlimited" and "a few per instance", it costs nothing, and it needs no extra
 * infrastructure. If this ever guards something more valuable than one guide's waiver
 * list, move the counters to the database or a KV store.
 */

interface Attempt {
  failures: number;
  /** Epoch ms after which attempts are allowed again. */
  lockedUntil: number;
  /** Epoch ms of the last failure, used to expire idle entries. */
  seen: number;
}

const attempts = new Map<string, Attempt>();

const MAX_FAILURES = 8;
const LOCKOUT_MS = 15 * 60 * 1000;
const WINDOW_MS = 30 * 60 * 1000;
/** Stops the map growing without bound if someone sprays requests from many addresses. */
const MAX_TRACKED = 5000;

function sweep(now: number) {
  if (attempts.size < MAX_TRACKED) return;
  for (const [key, attempt] of attempts) {
    if (now > attempt.seen + WINDOW_MS && now > attempt.lockedUntil) attempts.delete(key);
  }
  // Still oversized: the entries are all live, so drop the oldest rather than grow.
  if (attempts.size >= MAX_TRACKED) {
    const oldest = [...attempts.entries()].sort((a, b) => a[1].seen - b[1].seen);
    for (const [key] of oldest.slice(0, Math.floor(MAX_TRACKED / 4))) attempts.delete(key);
  }
}

/** Seconds remaining on a lockout, or 0 if this caller may try. */
export function lockoutRemaining(key: string, now = Date.now()): number {
  const attempt = attempts.get(key);
  if (!attempt) return 0;
  if (now > attempt.seen + WINDOW_MS && now > attempt.lockedUntil) {
    attempts.delete(key);
    return 0;
  }
  return attempt.lockedUntil > now ? Math.ceil((attempt.lockedUntil - now) / 1000) : 0;
}

export function recordFailure(key: string, now = Date.now()): void {
  sweep(now);
  const attempt = attempts.get(key) ?? { failures: 0, lockedUntil: 0, seen: now };
  // A window that has gone quiet resets, so an honest typo today doesn't count against
  // someone next week.
  if (now > attempt.seen + WINDOW_MS) attempt.failures = 0;
  attempt.failures += 1;
  attempt.seen = now;
  if (attempt.failures >= MAX_FAILURES) {
    attempt.lockedUntil = now + LOCKOUT_MS;
    attempt.failures = 0;
  }
  attempts.set(key, attempt);
}

export function clearFailures(key: string): void {
  attempts.delete(key);
}

/**
 * Best-effort caller identity. Vercel and most proxies set x-forwarded-for; the first
 * entry is the client. Falls back to a single shared bucket, which is deliberately
 * conservative — if we cannot tell callers apart, they share one budget.
 */
export function callerKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}
