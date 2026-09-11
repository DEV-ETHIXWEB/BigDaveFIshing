import { z } from 'zod';

/**
 * Email/password field rules shared by every account system this app has (customer
 * and staff signup/login alike). Named for what the fields are, not for who uses them -
 * same reasoning as password-hashing.ts. Client-side checks on top of these are only a
 * courtesy; these are what actually protect each account table.
 */

/** Required, unlike waiver-validation.ts's emailField, which is optional (a guest's email). */
export const accountEmailField = z.string().trim().max(200).email('Enter a valid email address');

/**
 * A floor, not a strength meter. 8 characters is the common baseline; the cap keeps a
 * pathological input from being handed to scrypt, which is deliberately slow.
 */
export const accountPasswordField = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(200, 'That password is too long');
