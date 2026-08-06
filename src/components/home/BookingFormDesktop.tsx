import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown, Mail, Pencil, Phone, User, ArrowRight, Lock, Ship } from 'lucide-react';
import SalmonIcon from '../ui/SalmonIcon';

const schema = z.object({
  name: z.string().min(2, 'Enter your name'),
  phone: z.string().min(7, 'Enter a phone number'),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  tripType: z.enum(['day-trip', 'lodge', 'not-sure']),
  message: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const label = 'block text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-copper';
const shell =
  'mt-2 flex items-center gap-3 rounded border border-cream/15 bg-cream/[0.03] px-4 ' +
  'focus-within:border-copper/70 transition-colors';
const control =
  'w-full bg-transparent py-3.5 text-sm text-cream outline-none placeholder:text-cream/35';
const iconProps = { size: 17, strokeWidth: 1.5, className: 'shrink-0 text-cream/45' } as const;
const error = 'mt-1.5 text-xs text-cream/80';

export default function BookingFormDesktop() {
  // Both stacks are in the DOM at once (one is display:none), so ids must be unique
  // per instance or every label points at the first copy's inputs.
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
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
      <div className="border-cream/15 bg-cream/[0.03] rounded-lg border px-10 py-16 text-center">
        <p className="font-display text-cream text-2xl tracking-[0.06em] uppercase">
          Thanks — we got it
        </p>
        <p className="text-cream/70 mx-auto mt-4 max-w-sm text-sm">
          We&rsquo;ll get back to you shortly. For anything urgent, call the number on the left.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* The stitched fob over the top edge of the panel. Drawn as one SVG rather than a
          clip-pathed box: clipping a bordered element cuts the border off, which is why
          it read as a flat grey shape. */}
      <span
        aria-hidden="true"
        className="text-copper absolute -top-8 left-1/2 block h-17 w-22 -translate-x-1/2"
      >
        <svg viewBox="0 0 88 68" className="absolute inset-0 h-full w-full">
          <path
            d="M4 12a8 8 0 0 1 8-8h64a8 8 0 0 1 8 8v26L44 62 4 38Z"
            fill="currentColor"
            fillOpacity="0.14"
            stroke="currentColor"
            strokeOpacity="0.5"
            strokeWidth="1.5"
          />
          <path
            d="M10 13a5 5 0 0 1 5-5h58a5 5 0 0 1 5 5v22L44 55 10 35Z"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.4"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        </svg>
        {/* Kept within the fob's flat upper area, clear of the pointed tip. */}
        <SalmonIcon className="absolute top-[19%] left-1/2 w-10 -translate-x-1/2" />
      </span>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="border-cream/15 bg-cream/[0.02] rounded-lg border px-8 pt-12 pb-9 lg:px-10"
        noValidate
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor={id('name')} className={label}>
              Name
            </label>
            <div className={shell}>
              <User {...iconProps} aria-hidden="true" />
              <input id={id('name')} type="text" className={control} {...register('name')} />
            </div>
            {errors.name && <p className={error}>{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor={id('phone')} className={label}>
              Phone
            </label>
            <div className={shell}>
              <Phone {...iconProps} aria-hidden="true" />
              <input id={id('phone')} type="tel" className={control} {...register('phone')} />
            </div>
            {errors.phone && <p className={error}>{errors.phone.message}</p>}
          </div>
        </div>

        <div className="mt-6">
          <label htmlFor={id('email')} className={label}>
            Email (optional)
          </label>
          <div className={shell}>
            <Mail {...iconProps} aria-hidden="true" />
            <input id={id('email')} type="email" className={control} {...register('email')} />
          </div>
          {errors.email && <p className={error}>{errors.email.message}</p>}
        </div>

        <div className="mt-6">
          <label htmlFor={id('tripType')} className={label}>
            Interested In
          </label>
          <div className={`${shell} relative`}>
            <Ship {...iconProps} aria-hidden="true" />
            <select
              id={id('tripType')}
              className={`${control} appearance-none pr-8`}
              defaultValue="day-trip"
              {...register('tripType')}
            >
              <option value="day-trip">Guided Day Trip</option>
              <option value="lodge">Wilson River Lodge Package</option>
              <option value="not-sure">Not Sure Yet</option>
            </select>
            <ChevronDown
              size={18}
              strokeWidth={1.5}
              aria-hidden="true"
              className="text-cream/45 pointer-events-none absolute right-4"
            />
          </div>
        </div>

        <div className="mt-6">
          <label htmlFor={id('message')} className={label}>
            Message (optional)
          </label>
          <div className={`${shell} items-start`}>
            <Pencil {...iconProps} aria-hidden="true" className="mt-4 shrink-0 text-cream/45" />
            <textarea
              id={id('message')}
              rows={5}
              className={`${control} resize-none`}
              {...register('message')}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="font-display border-copper/50 from-copper/35 via-copper/25 to-copper/35 text-cream hover:via-copper/35 mt-8 flex w-full items-center justify-center gap-3 rounded border bg-gradient-to-b py-4 text-sm tracking-[0.18em] uppercase transition-colors disabled:opacity-60"
        >
          {isSubmitting ? 'Sending…' : 'Send Enquiry'}
          <ArrowRight size={17} strokeWidth={1.5} aria-hidden="true" />
        </button>

        <p className="text-cream/45 mt-4 flex items-center justify-center gap-2 text-xs">
          <Lock size={13} strokeWidth={1.5} aria-hidden="true" />
          Your information is safe with us.
        </p>
      </form>
    </div>
  );
}
