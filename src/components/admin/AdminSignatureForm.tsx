import { useRef, useState } from 'react';
import SignaturePad, { type SignaturePadHandle } from '../waivers/SignaturePad';

interface Props {
  /** The signature already on file, if any - shown above the pad so redrawing is a
   *  deliberate choice, not something that silently wipes a signature nobody meant to
   *  touch. */
  existingSignatureUrl: string | null;
}

/**
 * Draw once, reused everywhere. Every admin action route stamps its log entry with
 * whatever is on file at /api/admin/my-signature - this is the only place that ever
 * changes it, and there is no confirmation step anywhere else for it to interrupt.
 */
export default function AdminSignatureForm({ existingSignatureUrl }: Props) {
  const sigRef = useRef<SignaturePadHandle>(null);
  const [redrawing, setRedrawing] = useState(!existingSignatureUrl);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

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
      setStatus('saved');
      setRedrawing(false);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not save your signature.');
    }
  };

  // This whole component only ever renders inside the dark bg-ink card on
  // /admin/signature.astro (the same context SignaturePad's own canvas already assumes,
  // hence its cream-toned placeholder text) - every color here is light-on-dark to
  // match, not the ink-toned text the rest of the admin dashboard uses on its white cards.
  if (!redrawing && existingSignatureUrl) {
    return (
      <div>
        <p className="text-cream/70 text-sm">This is what gets attached to your actions.</p>
        <img
          src={existingSignatureUrl}
          alt="Your saved signature"
          className="border-cream/25 bg-cream mt-3 h-24 w-full max-w-xs border object-contain object-left"
        />
        <button
          type="button"
          onClick={() => setRedrawing(true)}
          className="text-cream mt-4 text-sm underline underline-offset-2"
        >
          Redraw signature
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
        {existingSignatureUrl && (
          <button
            type="button"
            onClick={() => setRedrawing(false)}
            className="btn btn-outline-light"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
