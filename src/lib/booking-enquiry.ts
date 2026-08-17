import { z } from 'zod';
import { nameField, phoneField, emailField } from './waiver-validation';

/**
 * The booking enquiry, declared once for both sides of the request.
 *
 * Same reasoning as `waiver-validation.ts`: the browser copy is a courtesy, the server
 * copy is what actually decides what gets emailed to Dave, and two separate declarations
 * are how they drift apart.
 *
 * Name/phone/email reuse the waiver field rules so a guest who fills in both forms is
 * held to the same standard by each.
 */

export const tripTypes = ['day-trip', 'lodge', 'not-sure'] as const;
export type TripType = (typeof tripTypes)[number];

/** How each trip type reads in the email, the values above are not for humans. */
export const tripTypeLabels: Record<TripType, string> = {
  'day-trip': 'Guided Day Trip',
  lodge: 'Wilson River Lodge Package',
  'not-sure': 'Not Sure Yet',
};

export const bookingEnquiryFields = {
  name: nameField('your name'),
  phone: phoneField,
  email: emailField,
  tripType: z.enum(tripTypes),
  // Generous, but bounded: an enquiry is a paragraph, not an upload channel.
  message: z.string().trim().max(2000, 'That message is too long').optional(),
};

export const bookingEnquirySchema = z.object(bookingEnquiryFields);

export type BookingEnquiry = z.infer<typeof bookingEnquirySchema>;

/**
 * What the form shows when the send fails for any reason.
 *
 * It names the phone number rather than saying "try again later", because the failure
 * mode being guarded against is a lead quietly evaporating: if the email cannot go out,
 * the person on the other end still has a way to reach the business.
 */
export const enquiryFailureMessage =
  "We couldn't send that just now. Please call (503) 538-5607 and we'll get you booked.";
