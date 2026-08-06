import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import SignaturePad, { type SignaturePadHandle } from './SignaturePad';

const schema = z.object({
  groupLeaderName: z.string().trim().max(200).optional(),
  tripDate: z.string().trim().max(50).optional(),
  guestName: z.string().trim().min(2, 'Enter your name'),
  guestEmail: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  guestPhone: z.string().trim().min(7, 'Enter a phone number'),
  emergencyContactName: z.string().trim().min(2, "Enter a contact's name"),
  emergencyContactPhone: z.string().trim().min(7, 'Enter a phone number'),
  agree: z.literal(true, { error: 'You must agree to continue' }),
});

type FormData = z.infer<typeof schema>;

const field = 'w-full rounded border border-cream/15 bg-cream/[0.06] px-4 pt-2.5 pb-3';
const label = 'block text-[0.5625rem] font-medium uppercase tracking-[0.22em] text-cream/65';
const control =
  'mt-1 w-full bg-transparent text-sm text-cream outline-none placeholder:text-cream/40';

interface Props {
  waiverType: 'fishing-adventure' | 'lodge';
  waiverTitle: string;
  waiverBodyHtml: string;
}

export default function WaiverForm({ waiverType, waiverTitle, waiverBodyHtml }: Props) {
  const [groupCode, setGroupCode] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const sigRef = useRef<SignaturePadHandle>(null);
  const [sigTouched, setSigTouched] = useState(false);
  const [sigError, setSigError] = useState<string | null>(null);

  // The group code rides on the link Dave sends the group leader
  // (…/waivers/fishing-adventure?g=turner-0814), so guests never have to type it —
  // there's nothing for them to get wrong. Anyone who lands here without one still
  // sees the manual fields below as a fallback.
  useEffect(() => {
    // `window` doesn't exist during Astro's server render of this island's static
    // fallback, so the group code can't be read via a lazy useState initializer — it
    // has to be synchronized in an effect once the component is actually running in a
    // browser. That's exactly the "external system" case the effect docs describe.
    const g = new URLSearchParams(window.location.search).get('g');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (g) setGroupCode(g);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    const signaturePng = sigRef.current?.toPNG() ?? null;
    setSigTouched(true);
    if (!signaturePng) {
      setSigError('Please sign above before submitting.');
      return;
    }
    setSigError(null);
    setSubmitError(null);

    try {
      const res = await fetch('/api/waivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waiverType,
          groupCode: groupCode ?? undefined,
          groupLeaderName: data.groupLeaderName,
          tripDate: data.tripDate,
          guestName: data.guestName,
          guestEmail: data.guestEmail,
          guestPhone: data.guestPhone,
          emergencyContactName: data.emergencyContactName,
          emergencyContactPhone: data.emergencyContactPhone,
          signaturePng,
        }),
      });
      if (!res.ok) throw new Error('Submission failed');
      setSubmitted(true);
    } catch {
      setSubmitError(
        'Something went wrong sending this — please try again, or call us if it keeps happening.',
      );
    }
  };

  if (submitted) {
    return (
      <div className="rounded border border-cream/20 bg-cream/[0.06] p-8 text-center">
        <p className="font-display text-xl uppercase tracking-[0.06em] text-cream">
          Signed &mdash; you&rsquo;re all set
        </p>
        <p className="mt-3 text-sm text-cream/70">
          Thanks{groupCode ? `, and see you on the water with the group` : ''}. We&rsquo;ll have
          this on file for your trip.
        </p>
      </div>
    );
  }

  return (
    // react-hook-form's handleSubmit(fn) only builds the submit-event closure at
    // render time; fn itself — and its sigRef.current read — runs later, on the real
    // submit event, never during render. The lint rule can't see through that and
    // flags it defensively.
    // eslint-disable-next-line react-hooks/refs
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3" noValidate>
      {groupCode ? (
        <div className="rounded border border-copper/30 bg-copper/10 px-4 py-3 text-sm text-cream/85">
          Signing as part of group: <span className="font-medium text-copper">{groupCode}</span>
        </div>
      ) : (
        <>
          <div className={field}>
            <label htmlFor="groupLeaderName" className={label}>
              Who booked your trip? (group leader&rsquo;s name)
            </label>
            <input
              id="groupLeaderName"
              type="text"
              placeholder="e.g. Mike Turner"
              className={control}
              {...register('groupLeaderName')}
            />
          </div>
          <div className={field}>
            <label htmlFor="tripDate" className={label}>
              Trip date (if known)
            </label>
            <input id="tripDate" type="date" className={control} {...register('tripDate')} />
          </div>
        </>
      )}

      <div className={field}>
        <label htmlFor="guestName" className={label}>
          Your Name
        </label>
        <input
          id="guestName"
          type="text"
          placeholder="Full name"
          className={control}
          {...register('guestName')}
        />
      </div>
      {errors.guestName && (
        <p className="-mt-1 text-xs text-cream/90">{errors.guestName.message}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className={field}>
          <label htmlFor="guestPhone" className={label}>
            Phone
          </label>
          <input id="guestPhone" type="tel" className={control} {...register('guestPhone')} />
        </div>
        <div className={field}>
          <label htmlFor="guestEmail" className={label}>
            Email (optional)
          </label>
          <input id="guestEmail" type="email" className={control} {...register('guestEmail')} />
        </div>
      </div>
      {errors.guestPhone && (
        <p className="-mt-1 text-xs text-cream/90">{errors.guestPhone.message}</p>
      )}
      {errors.guestEmail && (
        <p className="-mt-1 text-xs text-cream/90">{errors.guestEmail.message}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className={field}>
          <label htmlFor="emergencyContactName" className={label}>
            Emergency Contact
          </label>
          <input
            id="emergencyContactName"
            type="text"
            placeholder="Name"
            className={control}
            {...register('emergencyContactName')}
          />
        </div>
        <div className={field}>
          <label htmlFor="emergencyContactPhone" className={label}>
            Their Phone
          </label>
          <input
            id="emergencyContactPhone"
            type="tel"
            className={control}
            {...register('emergencyContactPhone')}
          />
        </div>
      </div>
      {errors.emergencyContactName && (
        <p className="-mt-1 text-xs text-cream/90">{errors.emergencyContactName.message}</p>
      )}
      {errors.emergencyContactPhone && (
        <p className="-mt-1 text-xs text-cream/90">{errors.emergencyContactPhone.message}</p>
      )}

      <div className="mt-3 max-h-48 overflow-y-auto rounded border border-cream/15 bg-cream/[0.04] p-4 text-xs leading-relaxed text-cream/70">
        <p className="mb-2 font-display text-sm uppercase tracking-[0.06em] text-cream">
          {waiverTitle}
        </p>
        <div dangerouslySetInnerHTML={{ __html: waiverBodyHtml }} />
      </div>

      <label className="mt-1 flex items-start gap-2.5 text-sm text-cream/80">
        <input type="checkbox" className="mt-1" {...register('agree')} />
        <span>I have read and agree to the waiver above.</span>
      </label>
      {errors.agree && <p className="-mt-1 text-xs text-cream/90">{errors.agree.message}</p>}

      <div className="mt-2">
        <span className={label}>Your Signature</span>
        <SignaturePad ref={sigRef} className="mt-1" />
        {sigTouched && sigError && <p className="mt-1 text-xs text-cream/90">{sigError}</p>}
      </div>

      {submitError && <p className="text-sm text-cream/90">{submitError}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn btn-solid-light mt-2 w-full disabled:opacity-60"
      >
        {isSubmitting ? 'Sending…' : 'Sign & Submit'}
      </button>
    </form>
  );
}
