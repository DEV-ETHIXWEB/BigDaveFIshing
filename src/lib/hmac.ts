/**
 * Signing and verifying the session cookies this app issues.
 *
 * admin-auth.ts and customer-auth.ts each carried their own byte-identical copy of the
 * signing function, and each compared the result with `===`. That is the one comparison
 * a signature check must not use: `===` on strings stops at the first byte that differs,
 * so how long the answer takes to come back is a function of how much of the signature
 * the caller got right. Given a cookie a caller can rewrite and retry, that is a channel
 * for recovering a valid signature a byte at a time without ever knowing the key.
 *
 * The practical difficulty of measuring a few nanoseconds across the public internet is
 * real, and this is a fishing guide's waiver list rather than a bank - but a constant
 * time compare costs nothing, api/admin/login.ts already had one for its password check,
 * and the sessions those passwords issue deserve the same treatment.
 *
 * Kept as one module rather than two so the fix cannot be applied to one trust domain
 * and forgotten in the other, which is exactly how the two copies came to differ from
 * the login route in the first place.
 */

const encoder = new TextEncoder();

/** Hex-encoded HMAC-SHA256 of `value` under `secret`. */
export async function sign(value: string, secret: string): Promise<string> {
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

/**
 * Compares two strings in time that does not depend on where they first differ.
 *
 * The length check leaks only the length, which for a hex SHA-256 is a fixed 64 and
 * therefore tells an attacker nothing. `|=` accumulates rather than short-circuits, so
 * the loop always runs to the end whatever the input.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/** True when `suppliedSignature` is the signature this app would have produced. */
export async function verify(
  value: string,
  suppliedSignature: string,
  secret: string,
): Promise<boolean> {
  return constantTimeEqual(await sign(value, secret), suppliedSignature);
}
