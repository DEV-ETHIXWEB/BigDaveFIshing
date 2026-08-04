import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(2, 'Enter your name'),
  phone: z.string().min(7, 'Enter a phone number'),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  tripType: z.enum(['day-trip', 'lodge', 'not-sure']),
  message: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

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
    console.log('Booking enquiry (placeholder — not sent anywhere yet):', data);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="border-copper/40 bg-cream/10 text-cream rounded-sm border p-8">
        <p className="font-display text-xl">Thanks — we got it.</p>
        <p className="text-cream/75 mt-2">
          We&rsquo;ll get back to you shortly. For anything urgent, call the number above.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="border-cream/15 bg-cream/5 grid gap-4 rounded-sm border p-6 md:p-8"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="font-display text-copper block text-sm tracking-wide">
            Name
          </label>
          <input
            id="name"
            type="text"
            className="border-cream/25 bg-ink text-cream focus-visible:border-copper mt-1 w-full rounded-sm border px-3 py-2 outline-none"
            {...register('name')}
          />
          {errors.name && <p className="mt-1 text-sm text-red-300">{errors.name.message}</p>}
        </div>
        <div>
          <label htmlFor="phone" className="font-display text-copper block text-sm tracking-wide">
            Phone
          </label>
          <input
            id="phone"
            type="tel"
            className="border-cream/25 bg-ink text-cream focus-visible:border-copper mt-1 w-full rounded-sm border px-3 py-2 outline-none"
            {...register('phone')}
          />
          {errors.phone && <p className="mt-1 text-sm text-red-300">{errors.phone.message}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="email" className="font-display text-copper block text-sm tracking-wide">
          Email (optional)
        </label>
        <input
          id="email"
          type="email"
          className="border-cream/25 bg-ink text-cream focus-visible:border-copper mt-1 w-full rounded-sm border px-3 py-2 outline-none"
          {...register('email')}
        />
        {errors.email && <p className="mt-1 text-sm text-red-300">{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="tripType" className="font-display text-copper block text-sm tracking-wide">
          Interested In
        </label>
        <select
          id="tripType"
          className="border-cream/25 bg-ink text-cream focus-visible:border-copper mt-1 w-full rounded-sm border px-3 py-2 outline-none"
          defaultValue="day-trip"
          {...register('tripType')}
        >
          <option value="day-trip">Guided Day Trip</option>
          <option value="lodge">Wilson River Lodge Package</option>
          <option value="not-sure">Not Sure Yet</option>
        </select>
      </div>

      <div>
        <label htmlFor="message" className="font-display text-copper block text-sm tracking-wide">
          Message (optional)
        </label>
        <textarea
          id="message"
          rows={3}
          className="border-cream/25 bg-ink text-cream focus-visible:border-copper mt-1 w-full rounded-sm border px-3 py-2 outline-none"
          {...register('message')}
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-cedar font-display text-cream hover:bg-cedar/80 mt-2 rounded-full px-6 py-3 text-xs tracking-[0.15em] transition-colors disabled:opacity-60"
      >
        {isSubmitting ? 'Sending…' : 'Send Enquiry'}
      </button>
    </form>
  );
}
