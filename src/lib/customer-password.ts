import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing for customer accounts, over Node's built-in scrypt rather than a
 * dependency (bcrypt/argon2) - the codebase already leans on built-in crypto where it
 * covers the need (see admin-auth.ts's use of crypto.subtle), and scrypt is a
 * memory-hard, OWASP-acceptable choice for exactly this.
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
