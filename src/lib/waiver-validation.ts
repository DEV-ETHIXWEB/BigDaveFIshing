import { z } from 'zod';

/**
 * Field rules shared by the browser form and the API route.
 *
 * They used to be declared twice, once in WaiverForm.tsx and once in api/waivers.ts,
 * which is how the two came to disagree about what a name was. Client-side validation is
 * only a courtesy anyway; the server copy is the one that actually protects the table, so
 * they have to be the same object.
 */

/**
 * Letters, spaces, hyphens, apostrophes and full stops. Must start with a letter.
 *
 * `\p{L}` rather than A-Z: it still rejects digits and symbols, but it does not reject
 * José, Müller or Ngô. A strict A-Z rule would refuse real guests their own names.
 * Hyphen, apostrophe and stop are there for Mary-Jane, O'Brien and St. John.
 */
const NAME_PATTERN = /^\p{L}[\p{L}\s'.-]*$/u;

export const nameField = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `Enter ${label}`)
    .max(200, 'That name is too long')
    .regex(NAME_PATTERN, 'Letters only, no numbers or symbols');

/** Digits only. The form strips everything else as it is typed, so this is the backstop. */
export const phoneField = z
  .string()
  .trim()
  .regex(/^\d{7,15}$/, 'Numbers only, 7–15 digits');

export const emailField = z
  .string()
  .trim()
  .max(200)
  .email('Enter a valid email')
  .optional()
  .or(z.literal(''));

/** The guest-supplied fields, identical on both sides of the request. */
export const waiverGuestFields = {
  guestName: nameField('your name'),
  guestEmail: emailField,
  guestPhone: phoneField,
  emergencyContactName: nameField("a contact's name"),
  emergencyContactPhone: phoneField,
};

/** Strips anything that is not a digit, and caps length. Used on every keystroke. */
export const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 15);

/**
 * Strips characters a name cannot contain, as it is typed.
 *
 * Deliberately gentler than NAME_PATTERN: it removes digits and symbols but leaves
 * spaces, hyphens and apostrophes wherever they fall, so someone mid-way through typing
 * "O'" or "Mary-" is not fighting the field. The regex above still has the final say.
 */
export const lettersOnly = (value: string) => value.replace(/[^\p{L}\s'.-]/gu, '').slice(0, 200);
