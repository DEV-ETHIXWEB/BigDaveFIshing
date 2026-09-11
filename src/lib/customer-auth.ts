/**
 * Customer session cookies. Same shape and reasoning as admin-auth.ts, kept as a
 * separate module and a separate cookie (`big_dave_customer`, not `big_dave_admin`) on
 * purpose: two different trust domains, one shared admin login and one per-user
 * customer login, must never be able to be confused for each other by anything reading
 * a cookie name alone.
 */

const encoder = new TextEncoder();
export const customerSessionMaxAge = 60 * 60 * 12;

async function signature(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const buffer = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(buffer), (part) => part.toString(16).padStart(2, '0')).join('');
}

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
  const expected = await signature(`${role}.${idRaw}.${expires}`, secret);
  return expected === suppliedSignature ? id : null;
}
