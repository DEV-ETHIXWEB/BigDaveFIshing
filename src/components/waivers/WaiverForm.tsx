import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Plus, X } from 'lucide-react';
import SignaturePad, { type SignaturePadHandle } from './SignaturePad';
import {
  waiverGuestFields,
  digitsOnly,
  lettersOnly,
  MAX_MINORS,
} from '../../lib/waiver-validation';
import { sanitize } from '../../lib/field-sanitize';
import { business } from '../../lib/business';

// minorNames is overridden rather than taken from waiverGuestFields: the shared rule is
// an array of strings, and useFieldArray can only key rows by object identity, so the
// browser form holds `[{ name }]` and flattens back to `[string]` on submit. The server
// still validates the shared rule, which is the copy that protects the table.
const { minorNames: _sharedMinorNames, ...guestFields } = waiverGuestFields;

const schema = z.object({
  groupLeaderName: z.string().trim().max(200).optional(),
  tripDate: z.string().trim().max(50).optional(),
  ...guestFields,
  minorNames: z.array(z.object({ name: z.string().trim().max(200) })).max(MAX_MINORS),
  agree: z.literal(true, { error: 'You must agree to continue' }),
});

type FormData = z.infer<typeof schema>;

const field = 'w-full rounded border border-cream/15 bg-cream/[0.06] px-4 pt-2.5 pb-3';
const label = 'block text-[0.5625rem] font-medium uppercase tracking-[0.22em] text-cream/65';
/**
 * 16px on phones, 14px from `sm` up.
 *
 * Not a style choice: iOS Safari zooms the page in whenever a focused input's text is
 * under 16px, and it does not zoom back out. A guest filling this in on a phone got the
 * layout jumping and staying magnified from the first field onwards. 16px is the
 * threshold that stops it, and the smaller size is kept everywhere it does no harm.
 */
const control =
  'mt-1 w-full bg-transparent text-base text-cream outline-none placeholder:text-cream/40 sm:text-sm';

/**
 * A validation message.
 *
 * Set in --color-alert rather than text-cream/90, which was the same colour as the copy
 * around it: an error that looks exactly like a label reads as something that was always
 * there, not as something the guest just got wrong.
 */
const errorText = 'text-alert -mt-1 text-xs';

/**
 * Wires a field to its message so it is not colour alone that reports the problem.
 *
 * `aria-invalid` is what a screen reader announces on landing in the field, and
 * `aria-describedby` is what makes it read the actual reason rather than just "invalid".
 * Without these the messages existed only as loose paragraphs near the input, which a
 * sighted user could associate by position and nobody else could.
 */
const errorProps = (id: string, hasError: unknown) =>
  hasError ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` } : {};

/** What each field is called on screen, for when the server is the one rejecting it. */
const FIELD_LABELS: Record<string, string> = {
  guestName: 'your name',
  guestEmail: 'your email',
  guestPhone: 'your phone number',
  emergencyContactName: "your emergency contact's name",
  emergencyContactPhone: "your emergency contact's phone number",
  minorNames: "a child's name",
  signaturePng: 'your signature',
  waiverType: 'the waiver type',
  groupCode: 'the group link',
};

/**
 * Turns a failed response into something the guest can act on.
 *
 * The server already answers with a specific reason for every rejection - 409 already
 * signed, 400 dead link or bad field, 429 too fast. Those used to be thrown away and
 * replaced with "please try again", which is wrong for all three: two of them can never
 * succeed on a retry and the third is made worse by one.
 */
function messageForFailure(
  status: number,
  body: { error?: string; details?: { fieldErrors?: Record<string, string[] | undefined> } },
): string {
  // A 400 from the shared schema means the browser and the server disagreed about a
  // value, so name the field rather than showing the raw "Invalid submission".
  const fieldErrors = body.details?.fieldErrors;
  if (status === 400 && fieldErrors) {
    const named = Object.entries(fieldErrors)
      .filter(([, messages]) => messages?.length)
      .map(([key, messages]) => `${FIELD_LABELS[key] ?? key}: ${messages![0]}`);
    if (named.length) return `Please check ${named.join('; ')}.`;
  }

  if (body.error) return body.error;

  // No JSON body, or one without a reason. Still says something honest per status.
  if (status === 429) return 'Too many submissions just now. Please wait a minute and try again.';
  if (status >= 500) return 'Our end had a problem saving this. Please try again in a moment.';
  return 'That could not be submitted. Please check your details, or call us.';
}

interface Props {
  waiverType: 'fishing-adventure' | 'lodge';
  waiverTitle: string;
  waiverBodyHtml: string;
}

export default function WaiverForm({ waiverType, waiverTitle, waiverBodyHtml }: Props) {
  const [groupCode, setGroupCode] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [signedName, setSignedName] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const sigRef = useRef<SignaturePadHandle>(null);
  const [sigTouched, setSigTouched] = useState(false);
  const [sigError, setSigError] = useState<string | null>(null);
  /**
   * False until this island has actually hydrated in the browser.
   *
   * Astro server-renders this form as static HTML and only hydrates it on `client:visible`.
   * In the gap, the markup is a plain <form> with no action, so tapping Submit made the
   * browser do its own GET to the current URL - which wiped everything typed and put the
   * guest's name, phone and emergency contact into the address bar, browser history and
   * every server log along the way. Gating the button on this means the browser has
   * nothing to submit until React is in control. Nothing else here works without JS
   * anyway: the signature pad is a canvas.
   */
  const [hydrated, setHydrated] = useState(false);

  // The group code rides on the link Dave sends the group leader
  // (…/waivers/fishing-adventure?g=turner-0814), so guests never have to type it,
  // there's nothing for them to get wrong. Anyone who lands here without one still
  // sees the manual fields below as a fallback.
  useEffect(() => {
    // `window` doesn't exist during Astro's server render of this island's static
    // fallback, so the group code can't be read via a lazy useState initializer, it
    // has to be synchronized in an effect once the component is actually running in a
    // browser. That's exactly the "external system" case the effect docs describe.
    const g = new URLSearchParams(window.location.search).get('g');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (g) setGroupCode(g);
    // Same effect on purpose: the group code and the submit button both become correct
    // at exactly this moment, so flipping them together avoids a render where the button
    // is live but the banner has not replaced the "who booked your trip" fields yet.
    setHydrated(true);
  }, []);

  // The confirmation replaces the form in place, often below the fold on a phone. Move
  // focus to it and scroll it up, or a guest can tap Submit and appear to get nothing.
  useEffect(() => {
    if (!submitted) return;
    confirmRef.current?.focus();
    confirmRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [submitted]);

  const {
    register,
    control: formControl,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { minorNames: [] } });

  // Starts empty. Most guests bring no kids, and an empty row sitting there reads as a
  // field they are required to fill in.
  const minors = useFieldArray({ control: formControl, name: 'minorNames' });

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
          minorNames: data.minorNames.map((minor) => minor.name),
          signaturePng,
        }),
      });
      const response = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: { fieldErrors?: Record<string, string[] | undefined> };
      };

      if (!res.ok) {
        // The server's reason, shown as-is. Every one of these is something the guest can
        // act on - already signed, link no longer valid, slow down - and "please try
        // again" is the one response that helps with none of them: retrying a duplicate
        // or a dead link can never succeed, and retrying a rate limit makes it worse.
        setSubmitError(messageForFailure(res.status, response));
        return;
      }

      // First name only, "Thank you, Michael" reads like a person wrote it; the full
      // legal name they just typed into a waiver does not.
      setSignedName(data.guestName.trim().split(/\s+/)[0] ?? '');
      setSubmitted(true);
    } catch {
      // Only a genuine network failure reaches here now, fetch rejecting rather than
      // answering. That really is worth retrying, so this keeps the old wording.
      setSubmitError(
        'Something went wrong sending this. Please try again, or call us if it keeps happening.',
      );
    }
  };

  if (submitted) {
    return (
      // aria-live + tabIndex: the form is replaced in place, so without an announcement
      // and a focus target a screen-reader user gets no signal that anything happened.
      <div
        ref={confirmRef}
        tabIndex={-1}
        aria-live="polite"
        className="border-cream/20 bg-cream/[0.06] rounded border p-8 text-center outline-none sm:p-10"
      >
        <span
          className="border-cream/30 text-cream mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2"
          aria-hidden="true"
        >
          <Check size={30} strokeWidth={2} className="signed-check" />
        </span>

        <h2 className="font-display text-cream text-2xl leading-tight sm:text-[1.75rem]">
          Thank you{signedName ? `, ${signedName}` : ''}!
        </h2>

        <p className="text-cream/80 mx-auto mt-4 max-w-sm text-sm leading-relaxed sm:text-base">
          Your waiver is signed and on file. We hope you enjoy your trip. Tight lines, and
          we&rsquo;ll see you on the water.
        </p>

        <dl className="border-cream/15 mx-auto mt-7 max-w-xs border-t pt-6 text-left text-sm">
          <div className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="text-cream/55">Waiver</dt>
            <dd className="text-cream">
              {waiverType === 'lodge' ? 'Wilson River Lodge' : 'Fishing Adventure'}
            </dd>
          </div>
          {groupCode && (
            <div className="flex items-baseline justify-between gap-4 py-1.5">
              <dt className="text-cream/55">Group</dt>
              <dd className="text-cream break-all">{groupCode}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="text-cream/55">Signed</dt>
            <dd className="text-cream">{new Date().toLocaleDateString()}</dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href="/" className="btn btn-solid-light">
            Back to Home
          </a>
          <a href={business.phoneHref} className="btn btn-outline-light">
            {business.phone}
          </a>
        </div>

        <p className="text-cream/45 mt-6 text-xs">
          Nothing else to do. There&rsquo;s no copy to print or bring with you.
        </p>
      </div>
    );
  }

  return (
    // react-hook-form's handleSubmit(fn) only builds the submit-event closure at
    // render time; fn itself, and its sigRef.current read, runs later, on the real
    // submit event, never during render. The lint rule can't see through that and
    // flags it defensively.
    //
    // method=post belongs here even though React handles the real submit: it decides what
    // a *native* submit would do if one ever escaped the disabled button above. The
    // default, GET, is what put guest details in the URL. POST cannot.
    // eslint-disable-next-line react-hooks/refs
    <form onSubmit={handleSubmit(onSubmit)} method="post" className="grid gap-3" noValidate>
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
          autoComplete="name"
          className={control}
          {...register('guestName')}
          {...errorProps('guestName', errors.guestName)}
          onInput={sanitize(lettersOnly)}
        />
      </div>
      {errors.guestName && (
        <p id="guestName-error" className={errorText}>
          {errors.guestName.message}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className={field}>
          <label htmlFor="guestPhone" className={label}>
            Phone
          </label>
          <input
            id="guestPhone"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="tel"
            placeholder="5035385607"
            className={control}
            {...register('guestPhone')}
            {...errorProps('guestPhone', errors.guestPhone)}
            onInput={sanitize(digitsOnly)}
          />
        </div>
        <div className={field}>
          <label htmlFor="guestEmail" className={label}>
            Email (optional)
          </label>
          <input
            id="guestEmail"
            type="email"
            className={control}
            {...register('guestEmail')}
            {...errorProps('guestEmail', errors.guestEmail)}
          />
        </div>
      </div>
      {errors.guestPhone && (
        <p id="guestPhone-error" className={errorText}>
          {errors.guestPhone.message}
        </p>
      )}
      {errors.guestEmail && (
        <p id="guestEmail-error" className={errorText}>
          {errors.guestEmail.message}
        </p>
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
            {...errorProps('emergencyContactName', errors.emergencyContactName)}
            onInput={sanitize(lettersOnly)}
          />
        </div>
        <div className={field}>
          <label htmlFor="emergencyContactPhone" className={label}>
            Their Phone
          </label>
          <input
            id="emergencyContactPhone"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            className={control}
            {...register('emergencyContactPhone')}
            {...errorProps('emergencyContactPhone', errors.emergencyContactPhone)}
            onInput={sanitize(digitsOnly)}
          />
        </div>
      </div>
      {errors.emergencyContactName && (
        <p id="emergencyContactName-error" className={errorText}>
          {errors.emergencyContactName.message}
        </p>
      )}
      {errors.emergencyContactPhone && (
        <p id="emergencyContactPhone-error" className={errorText}>
          {errors.emergencyContactPhone.message}
        </p>
      )}

      {/* Children under 18 the signing adult is bringing. Optional and collapsed to a
          single button until used: most guests bring nobody, and an always-open list of
          empty rows reads as something they are required to fill in. */}
      <fieldset className="border-cream/15 bg-cream/[0.04] mt-3 rounded border p-4">
        <legend className={`${label} px-1`}>Children Under 18</legend>

        <p className="text-cream/55 mt-1 text-xs leading-relaxed">
          Only if you are bringing them. List each child by name.
        </p>

        {minors.fields.length > 0 && (
          <ul className="mt-3 space-y-2">
            {minors.fields.map((row, index) => (
              <li key={row.id}>
                <div className="flex items-center gap-2">
                  <div className={`${field} flex-1`}>
                    <label htmlFor={`minor-${index}`} className={label}>
                      {`Child ${index + 1}`}
                    </label>
                    <input
                      id={`minor-${index}`}
                      type="text"
                      placeholder="Full name"
                      className={control}
                      {...register(`minorNames.${index}.name` as const)}
                      {...errorProps(`minor-${index}`, errors.minorNames?.[index]?.name)}
                      onInput={sanitize(lettersOnly)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => minors.remove(index)}
                    aria-label={`Remove child ${index + 1}`}
                    className="border-cream/20 text-cream/70 hover:bg-cream/10 hover:text-cream flex h-9 w-9 shrink-0 items-center justify-center rounded border transition-colors"
                  >
                    <X size={15} strokeWidth={2} aria-hidden="true" />
                  </button>
                </div>
                {errors.minorNames?.[index]?.name && (
                  <p id={`minor-${index}-error`} className="text-alert mt-1 text-xs">
                    {errors.minorNames[index]?.name?.message}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {minors.fields.length < MAX_MINORS && (
          <button
            type="button"
            onClick={() => minors.append({ name: '' })}
            className="border-cream/25 text-cream hover:bg-cream/10 mt-3 inline-flex items-center gap-1.5 rounded border px-3 py-2 text-xs font-medium transition-colors"
          >
            <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
            {minors.fields.length === 0 ? 'Add a child' : 'Add another child'}
          </button>
        )}
      </fieldset>

      <div className="mt-3 max-h-48 overflow-y-auto rounded border border-cream/15 bg-cream/[0.04] p-4 text-xs leading-relaxed text-cream/70">
        <p className="mb-2 font-display text-sm uppercase tracking-[0.06em] text-cream">
          {waiverTitle}
        </p>
        <div dangerouslySetInnerHTML={{ __html: waiverBodyHtml }} />
      </div>

      {/* The one thing a guest is required to tick before signing, and at the browser
          default of 13px it was the smallest target on a page meant to be used one-handed
          on a phone. Sized to 24px, the minimum a pointer target should be. The whole row
          is a <label>, so the text has always been tappable too - this makes the box
          itself worth aiming at. */}
      <label className="mt-1 flex items-start gap-2.5 py-1 text-sm text-cream/80">
        <input
          type="checkbox"
          className="accent-silver mt-0.5 h-6 w-6 shrink-0"
          {...register('agree')}
          {...errorProps('agree', errors.agree)}
        />
        <span className="pt-0.5">I have read and agree to the waiver above.</span>
      </label>
      {errors.agree && (
        <p id="agree-error" className={errorText}>
          {errors.agree.message}
        </p>
      )}

      <div className="mt-2">
        <span className={label}>Your Signature</span>
        <SignaturePad ref={sigRef} className="mt-1" />
        {sigTouched && sigError && (
          <p role="alert" className="text-alert mt-1 text-xs">
            {sigError}
          </p>
        )}
      </div>

      {/* role=alert: the form is long and the button is at the bottom, so a guest who
          taps Submit needs this announced, not just rendered somewhere above them. */}
      {submitError && (
        <p
          role="alert"
          className="border-alert/40 bg-alert/10 text-alert rounded border px-4 py-3 text-sm"
        >
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !hydrated}
        className="btn btn-solid-light mt-2 w-full disabled:opacity-60"
      >
        {isSubmitting ? 'Sending…' : hydrated ? 'Sign & Submit' : 'Preparing form…'}
      </button>
    </form>
  );
}
