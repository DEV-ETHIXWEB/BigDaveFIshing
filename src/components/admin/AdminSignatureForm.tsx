import { useRef, useState } from 'react';
import SignaturePad, { type SignaturePadHandle } from '../waivers/SignaturePad';

interface Props {
  /** The signature already on file, if any - shown above the pad so redrawing is a
   *  deliberate choice, not something that silently wipes a signature nobody meant to
   *  touch. */
  existingSignatureUrl: string | null;
  /** Used for the company-logo-plus-name stand-in shown when nothing's been drawn yet. */
  adminName: string;
}

/**
 * Draw once, reused everywhere. Every admin action route stamps its log entry with
 * whatever is on file at /api/admin/my-signature - this is the only place that ever
 * changes it, and there is no confirmation step anywhere else for it to interrupt.
 *
 * Nobody is required to draw anything before acting: without a saved signature, actions
 * are stamped with the company logo next to the admin's own name instead (the same
 * fallback the activity panel on /admin/waivers shows) - a real, honestly-labelled
 * default rather than a fabricated scribble, and it still distinguishes admins from each
 * other, since the name differs even when the logo doesn't.
 */
export default function AdminSignatureForm({ existingSignatureUrl, adminName }: Props) {
  const sigRef = useRef<SignaturePadHandle>(null);
  const [redrawing, setRedrawing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  /**
   * The signature currently on file, as this component understands it.
   *
   * Seeded from the server's value but owned here from then on, because saving changes it
   * and the prop cannot: it was captured when the page rendered. Reading the prop after a
   * save meant the screen said "Saved." and, directly above it, "You haven't drawn a
   * signature yet" - the save had worked, but the only way to see that was a reload, and
   * the obvious response to being told it had not worked is to draw it again.
   */
  const [signatureUrl, setSignatureUrl] = useState<string | null>(existingSignatureUrl);

  const onSave = async () => {
    const signaturePng = sigRef.current?.toPNG();
    if (!signaturePng) {
      setError('Please sign above before saving.');
      return;
    }
    setStatus('saving');
    setError(null);
    try {
      const res = await fetch('/api/admin/my-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signaturePng }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Could not save your signature.');
      }
      // Cache-busted so the <img> refetches rather than redisplaying the old drawing.
      // The endpoint already sends no-store, but a query that changes every save makes
      // this independent of what any layer in between decides to do.
      setSignatureUrl(`/api/admin/my-signature?v=${Date.now()}`);
      setStatus('saved');
      setRedrawing(false);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not save your signature.');
    }
  };

  // This whole component only ever renders inside the dark bg-ink card on
  // /admin/signature.astro - every color here is light-on-dark to match, not the
  // ink-toned text the rest of the admin dashboard uses on its white cards. The pad
  // itself is the exception: SignaturePad is always a white box with black ink.
  if (!redrawing) {
    return (
      <div>
        <p className="text-cream/70 text-sm">
          {signatureUrl
            ? 'This is what gets attached to your actions.'
            : "You haven't drawn a signature yet - until you do, this is what gets attached instead:"}
        </p>

        {signatureUrl ? (
          <img
            src={signatureUrl}
            alt="Your saved signature"
            className="border-cream/25 bg-cream mt-3 h-24 w-full max-w-xs border object-contain object-left"
          />
        ) : (
          <div className="border-cream/25 bg-cream mt-3 flex h-24 w-full max-w-xs items-center gap-3 border px-4">
            <img src="/email-logo.png" alt="" className="h-14 w-14 shrink-0 object-contain" />
            <span className="font-display text-ink truncate text-xl italic">{adminName}</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setRedrawing(true)}
          className="text-cream mt-4 text-sm underline underline-offset-2"
        >
          {signatureUrl ? 'Redraw signature' : 'Draw your own signature'}
        </button>
        {status === 'saved' && <p className="text-cream mt-3 text-sm">Saved.</p>}
      </div>
    );
  }

  return (
    <div>
      <p className="text-cream/70 text-sm">
        Draw your signature below. It&rsquo;s saved to your account and used automatically from then
        on - you won&rsquo;t be asked again.
      </p>
      <div className="mt-4">
        <SignaturePad ref={sigRef} />
      </div>
      {error && <p className="text-cream/90 mt-3 text-sm">{error}</p>}
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={status === 'saving'}
          className="btn btn-solid-light disabled:opacity-60"
        >
          {status === 'saving' ? 'Saving…' : 'Save signature'}
        </button>
        <button type="button" onClick={() => setRedrawing(false)} className="btn btn-outline-light">
          Cancel
        </button>
      </div>
    </div>
  );
}
