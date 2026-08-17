import { envSetting, envVar } from './env';

/**
 * The key the admin session cookie is signed with.
 *
 * Previously the admin password itself was passed to createAdminSession/validAdminSession
 * as the HMAC secret. That coupled two unrelated things: how hard the password is to
 * guess through the login form, and how hard the signing key is to brute-force offline.
 * With a short password an attacker never needs the form at all, they can derive the key
 * and mint their own valid `big_dave_admin` cookie, walking straight past the gate and
 * past any rate limiting on login.
 *
 * Set ADMIN_SESSION_SECRET to a long random value in production:
 *
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * If it is unset we fall back to the password so nothing breaks, but that is the weak
 * configuration described above, `adminSecretIsWeak` reports it so the login page can
 * say so out loud rather than failing quietly.
 *
 * Rotating this value invalidates every existing session, which is the intended way to
 * force everyone to sign in again.
 */
export function adminSigningSecret(): string | undefined {
  const dedicated = envSetting('ADMIN_SESSION_SECRET');
  if (dedicated && dedicated.length >= 16) return dedicated;
  return envVar('ADMIN_PASSWORD');
}

/** True when the signing key is the password (or a too-short dedicated secret). */
export function adminSecretIsWeak(): boolean {
  const dedicated = envSetting('ADMIN_SESSION_SECRET');
  return !dedicated || dedicated.length < 16;
}
