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

export async function createCustomerSession(customerId: number, secret: string) {
  const expires = Math.floor(Date.now() / 1000) + customerSessionMaxAge;
  const value = `customer.${customerId}.${expires}`;
  return `${value}.${await signature(value, secret)}`;
}

/** Returns the customer id the cookie names, or null if it's missing, malformed, expired, or forged. */
export async function validCustomerSession(
  cookie: string | undefined,
  secret: string | undefined,
): Promise<number | null> {
  if (!cookie || !secret) return null;
  const [role, idRaw, expires, suppliedSignature] = cookie.split('.');
  const id = Number(idRaw);
  if (
    role !== 'customer' ||
    !Number.isInteger(id) ||
    id <= 0 ||
    !expires ||
    !suppliedSignature ||
    Number(expires) < Date.now() / 1000
  ) {
    return null;
  }
  // Constant time, see the note in src/lib/hmac.ts on why `===` is wrong here.
  return (await verify(`${role}.${idRaw}.${expires}`, suppliedSignature, secret)) ? id : null;
}
