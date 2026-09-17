/**
 * Customer session cookies. Same shape and reasoning as admin-auth.ts, kept as a
 * separate module and a separate cookie (`big_dave_customer`, not `big_dave_admin`) on
 * purpose: two different trust domains, one shared admin login and one per-user
 * customer login, must never be able to be confused for each other by anything reading
 * a cookie name alone.
 */

import { sign as signature, verify } from './hmac';

export const customerSessionMaxAge = 60 * 60 * 12;

/**
 * A second, deliberately readable cookie that says only "somebody is signed in".
 *
 * The session cookie is httpOnly, which is what keeps it out of reach of any script on
 * the page - that must not change. But almost every page on this site is prerendered
 * static HTML, so the footer bar cannot be told server-side who is looking at it, and it
 * offered "Login" and "Sign Up" to people who were already signed in and reading their
 * own account page.
 *
 * This carries no name, no id and no token: just `1`. It is a hint for swapping two
 * links, it is never trusted for access, and every page that actually holds anything
 * still checks the real signed session. Worst case the two fall out of step and the bar
 * offers "My Account" to someone whose session has expired - /account then sends them to
 * the login page, which is the same place the old bar would have.
 */
export const CUSTOMER_HINT_COOKIE = 'big_dave_customer_present';

/**
 * `sessionVersion` is `customers.session_version` at the moment this cookie is issued,
 * carried inside the signed payload so it can be checked with no extra database round
 * trip on most requests - only the pages that already load the customer row (currently
 * just /account) compare it against the live column. See that column's own comment in
 * db.ts for why it exists: it is what makes a password reset actually end a session
 * that was already open, rather than only blocking new logins with the old password.
 */
export async function createCustomerSession(
  customerId: number,
  sessionVersion: number,
  secret: string,
) {
  const expires = Math.floor(Date.now() / 1000) + customerSessionMaxAge;
  const value = `customer.${customerId}.${sessionVersion}.${expires}`;
  return `${value}.${await signature(value, secret)}`;
}

export interface CustomerSession {
  id: number;
  sessionVersion: number;
}

/**
 * Returns the identity a cookie names, or null if it's missing, malformed, expired, or
 * forged. Does not by itself confirm the session is still current - see sessionVersion
 * above; a caller that has already loaded the customer row must compare the two.
 */
export async function validCustomerSession(
  cookie: string | undefined,
  secret: string | undefined,
): Promise<CustomerSession | null> {
  if (!cookie || !secret) return null;
  const [role, idRaw, sessionVersionRaw, expires, suppliedSignature] = cookie.split('.');
  const id = Number(idRaw);
  const sessionVersion = Number(sessionVersionRaw);
  if (
    role !== 'customer' ||
    !Number.isInteger(id) ||
    id <= 0 ||
    !Number.isInteger(sessionVersion) ||
    sessionVersion <= 0 ||
    !expires ||
    !suppliedSignature ||
    Number(expires) < Date.now() / 1000
  ) {
    return null;
  }
  const value = `${role}.${idRaw}.${sessionVersionRaw}.${expires}`;
  // Constant time, see the note in src/lib/hmac.ts on why `===` is wrong here.
  return (await verify(value, suppliedSignature, secret)) ? { id, sessionVersion } : null;
}
