import { z } from 'zod';

/**
 * Field rules for customer accounts, shared by the signup/login forms and the API
 * routes behind them - same reasoning as waiver-validation.ts: client-side checks are a
 * courtesy, these are what actually protect the table.
 */

/**
 * Required, unlike waiver-validation.ts's emailField, which is optional (a guest's email).
 *
 * Piped into `z.email()` rather than the deprecated `.email()` method, so trim and the
 * length cap still run before the format check - see the matching note in
 * account-validation.ts.
 */
export const customerEmailField = z
  .string()
  .trim()
  .max(200)
  .pipe(z.email('Enter a valid email address'));

/**
 * A floor, not a strength meter. 8 characters is the common baseline; the cap keeps a
 * pathological input from being handed to scrypt, which is deliberately slow.
 */
export const customerPasswordField = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(200, 'That password is too long');
