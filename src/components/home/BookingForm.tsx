import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { ChevronDown } from 'lucide-react';
import { bookingEnquirySchema, enquiryFailureMessage } from '../../lib/booking-enquiry';
import { submitEnquiry } from '../../lib/submit-enquiry';
import { sanitize } from '../../lib/field-sanitize';
import { digitsOnly, lettersOnly } from '../../lib/waiver-validation';

const schema = bookingEnquirySchema;

type FormData = z.infer<typeof schema>;

/** Fields in the design are a dark rounded block with a tiny caps label inset above
 *  the value, and an icon on the right where there's a control. */
const field = 'w-full rounded border border-cream/15 bg-cream/[0.06] px-4 pt-2.5 pb-3';
const label = 'block text-[0.5625rem] font-medium uppercase tracking-[0.22em] text-cream/65';
const control =
  'mt-1 w-full bg-transparent text-sm text-cream outline-none placeholder:text-cream/40';

export default function BookingForm() {
  // The mobile and desktop layouts each render this form, and both are in the DOM at
  // once (one is display:none), so the field ids have to be unique per instance or the
  // labels all point at the first copy's inputs.
  const uid = useId();
  const fieldId = (name: string) => `${uid}-${name}`;
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // The confirmation below is only shown once the server has confirmed the email went
  // out. If it didn't, the visitor is told so and given the phone number, rather than
  // being thanked for a message nobody will ever read.
  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    if (await submitEnquiry(data)) {
      setSubmitted(true);
      return;
    }
    setSubmitError(enquiryFailureMessage);
  };

  if (submitted) {
    return (
      <div className="border-cream/20 bg-cream/[0.06] rounded border p-8 text-center">
        <p className="font-display text-cream text-xl tracking-[0.06em] uppercase">
          Thanks, we got it
        </p>
        <p className="text-cream/70 mt-3 text-sm">
          We&rsquo;ll get back to you shortly. For anything urgent, call the number below.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3" noValidate>
      <div className={field}>
        <label htmlFor={fieldId('name')} className={label}>
          Your Name
        </label>
        <input
          id={fieldId('name')}
          type="text"
          placeholder="Full name"
          className={control}
          onInput={sanitize(lettersOnly)}
          {...register('name')}
        />
      </div>
      {errors.name && <p className="text-cream/90 -mt-1 text-xs">{errors.name.message}</p>}

      <div className={field}>
        <label htmlFor={fieldId('phone')} className={label}>
          Phone
        </label>
        <input
          id={fieldId('phone')}
          type="tel"
          placeholder="Best number to reach you"
          className={control}
          onInput={sanitize(digitsOnly)}
          {...register('phone')}
        />
      </div>
      {errors.phone && <p className="text-cream/90 -mt-1 text-xs">{errors.phone.message}</p>}

      <div className={field}>
        <label htmlFor={fieldId('email')} className={label}>
          Email (optional)
        </label>
        <input
          id={fieldId('email')}
          type="email"
          placeholder="you@example.com"
          className={control}
          {...register('email')}
        />
      </div>
      {errors.email && <p className="text-cream/90 -mt-1 text-xs">{errors.email.message}</p>}

      <div className={`${field} relative`}>
        <label htmlFor={fieldId('tripType')} className={label}>
          Trip Type
        </label>
        <select
          id={fieldId('tripType')}
          className={`${control} appearance-none pr-6`}
          defaultValue="day-trip"
          {...register('tripType')}
        >
          <option value="day-trip">Guided Day Trip</option>
          <option value="lodge">Wilson River Lodge Package</option>
          <option value="not-sure">Not Sure Yet</option>
        </select>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className="text-cream/65 pointer-events-none absolute right-4 bottom-3.5"
        />
      </div>

      <div className={field}>
        <label htmlFor={fieldId('message')} className={label}>
          Message (optional)
        </label>
        <textarea
          id={fieldId('message')}
          rows={3}
          placeholder="Dates you have in mind, group size…"
          className={`${control} resize-none`}
          {...register('message')}
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn btn-solid-light mt-2 w-full disabled:opacity-60"
      >
        {isSubmitting ? 'Sending…' : 'Send Enquiry'}
      </button>

      {submitError && (
        <p role="alert" className="text-cream/85 border-cream/25 rounded border px-4 py-3 text-sm">
          {submitError}
        </p>
      )}
    </form>
  );
}
