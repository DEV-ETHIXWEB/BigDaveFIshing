import { enquiryFailureMessage, type BookingEnquiry } from './booking-enquiry';

/**
 * Posts an enquiry and reports honestly whether it arrived.
 *
 * The mobile and desktop booking forms are separate components for layout reasons, but
 * there is only one correct way to submit, and getting it wrong in one of them is the
 * bug this whole path exists to prevent, so the submit lives here once and both call it.
 *
 * Resolves `true` only on a 2xx. Every other outcome, including a network failure,
 * resolves `false`; there is no case where the caller should show a confirmation it
 * cannot back up.
 */
export async function submitEnquiry(data: BookingEnquiry): Promise<boolean> {
  try {
    const res = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export { enquiryFailureMessage };
