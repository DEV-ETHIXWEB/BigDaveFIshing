import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown } from 'lucide-react';

const schema = z.object({
  name: z.string().min(2, 'Enter your name'),
  phone: z.string().min(7, 'Enter a phone number'),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  tripType: z.enum(['day-trip', 'lodge', 'not-sure']),
  message: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

/** Fields in the design are a dark rounded block with a tiny caps label inset above
 *  the value, and an icon on the right where there's a control. */
const field = 'w-full rounded border border-cream/15 bg-cream/[0.06] px-4 pt-2.5 pb-3';
const label = 'block text-[0.5625rem] font-medium uppercase tracking-[0.22em] text-cream/65';
const control =
  'mt-1 w-full bg-transparent text-sm text-cream outline-none placeholder:text-cream/40';

export default function BookingForm() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // TODO: wire to real submission endpoint (email service / CRM) before launch.
  const onSubmit = async (data: FormData) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    console.log('Booking enquiry (placeholder - not sent anywhere yet):', data);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="border-cream/20 bg-cream/[0.06] rounded border p-8 text-center">
        <p className="font-display text-cream text-xl tracking-[0.06em] uppercase">
          Thanks — we got it
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
        <label htmlFor="name" className={label}>
          Your Name
        </label>
        <input
          id="name"
          type="text"
          placeholder="Full name"
          className={control}
          {...register('name')}
        />
      </div>
      {errors.name && <p className="text-cream/90 -mt-1 text-xs">{errors.name.message}</p>}

      <div className={field}>
        <label htmlFor="phone" className={label}>
          Phone
        </label>
        <input
          id="phone"
          type="tel"
          placeholder="Best number to reach you"
          className={control}
          {...register('phone')}
        />
      </div>
      {errors.phone && <p className="text-cream/90 -mt-1 text-xs">{errors.phone.message}</p>}

      <div className={field}>
        <label htmlFor="email" className={label}>
          Email (optional)
        </label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          className={control}
          {...register('email')}
        />
      </div>
      {errors.email && <p className="text-cream/90 -mt-1 text-xs">{errors.email.message}</p>}

      <div className={`${field} relative`}>
        <label htmlFor="tripType" className={label}>
          Trip Type
        </label>
        <select
          id="tripType"
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
        <label htmlFor="message" className={label}>
          Message (optional)
        </label>
        <textarea
          id="message"
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
    </form>
  );
}
