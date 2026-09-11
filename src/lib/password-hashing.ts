import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing shared by every account system this app has (customer and staff
 * alike), over Node's built-in scrypt rather than a dependency (bcrypt/argon2) - the
 * codebase already leans on built-in crypto where it covers the need (see
 * admin-auth.ts's use of crypto.subtle for HMAC), and scrypt is a memory-hard,
 * OWASP-acceptable choice for exactly this.
 *
 * Deliberately named for what it does, not for who uses it: customer accounts and
 * staff accounts are kept in separate tables on purpose (an accidental join must never
 * hand one kind of account the other's access), and importing a "customer" module from
 * staff code would quietly wire the two together anyway, at the file-dependency level,
 * for no reason - hashing a password has nothing to do with which table it's stored in.
 *
 * Stored as `salt:hash`, both hex. The salt travels with the hash rather than in a
 * separate column: one column to migrate, one value to pass around, and scrypt needs
 * the salt back to recompute the hash for a comparison anyway.
 */

const KEY_LENGTH = 64;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await deriveKey(password, salt);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

/**
 * Constant-time by construction: scrypt runs regardless of where a plaintext guess
 * would first differ, and the final comparison uses timingSafeEqual rather than `===`,
 * so neither step leaks anything through response timing.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== KEY_LENGTH) return false;

  const derived = await deriveKey(password, salt);
  return timingSafeEqual(derived, expected);
}
