import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';

export interface SignaturePadHandle {
  /** null if nothing has been drawn yet. */
  toPNG: () => string | null;
  clear: () => void;
}

/**
 * Draw-to-sign canvas. Pointer Events cover mouse, touch, and pen in one code path,
 * so there's no separate touch handling needed.
 *
 * Sized in device pixels at devicePixelRatio so the line stays crisp on phones,
 * while CSS size stays in logical pixels for layout.
 */
const SignaturePad = forwardRef<SignaturePadHandle, { className?: string }>(function SignaturePad(
  { className = '' },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasStroke = useRef(false);
  const [empty, setEmpty] = useState(true);

  /**
   * Drawing is Pointer Events on a canvas, which has no keyboard path at all - not
   * "hard to use with a keyboard", genuinely impossible, since a canvas is not
   * something Tab can even land on. For a legal waiver that is a guest who is simply
   * unable to complete it, not an inconvenience. `typed` renders their name onto the
   * same canvas in the site's own display face instead, so what leaves this component
   * is a PNG either way and nothing downstream (the API's validation, the dashboard's
   * thumbnail, the email digest) needs to know which path produced it.
   */
  const [typed, setTyped] = useState(false);
  const [typedName, setTypedName] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastWidth = 0;
    let lastHeight = 0;

    function resize() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(rect.width * dpr);
      const height = Math.round(rect.height * dpr);

      // On a phone, scrolling shows and hides the URL bar, which fires resize without
      // the canvas actually changing width. Re-running the rest would wipe the drawing
      // mid-signature, so bail unless the size genuinely changed.
      if (width === lastWidth && height === lastHeight) return;

      // Preserve as an image rather than getImageData/putImageData: the bitmap is about
      // to change dimensions, and putImageData ignores scaling, so the old version
      // pasted back at the wrong size and clipped.
      const prior = lastWidth > 0 ? canvas.toDataURL('image/png') : null;
      const priorW = lastWidth;
      const priorH = lastHeight;

      canvas.width = width;
      canvas.height = height;
      lastWidth = width;
      lastHeight = height;

      // setTransform, not scale: scale multiplies onto whatever transform is already
      // there, so every resize compounded and strokes drifted further off the pointer.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.25;
      ctx.strokeStyle = '#111111';

      if (prior) {
        const image = new Image();
        image.onload = () => {
          // Drawn in CSS pixels because the context is already scaled by dpr.
          ctx.drawImage(image, 0, 0, priorW / dpr, priorH / dpr);
        };
        image.src = prior;
      }
    }

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasStroke.current = true;
    setEmpty(false);
  }

  function end() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStroke.current = false;
    setEmpty(true);
  }

  // Renders the typed name onto the same canvas the drawn signature would otherwise
  // occupy, in the site's own display face - so a guest typing "Jordan Reyes" gets
  // something that actually reads as a signature, not a form field masquerading as
  // one, and so toPNG() below needs no branch at all: there is exactly one canvas, and
  // whichever path last drew on it is what gets exported.
  useEffect(() => {
    if (!typed) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const name = typedName.trim();
      if (!name) {
        hasStroke.current = false;
        setEmpty(true);
        return;
      }
      ctx.fillStyle = '#111111';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `italic 32px 'Merienda', cursive`;
      ctx.fillText(name, rect.width / 2, rect.height / 2, rect.width - 24);
      hasStroke.current = true;
      setEmpty(false);
    };

    // The custom face may not have finished loading the first time this runs - canvas
    // text silently falls back to a system font rather than waiting, so what gets
    // exported would quietly not match what every other heading on the site looks
    // like. document.fonts.load resolves once it's actually available, or immediately
    // if it already was; draw runs once now regardless, so typing still shows
    // something without a network round trip in between.
    draw();
    document.fonts
      ?.load("italic 32px 'Merienda'")
      .then(draw)
      .catch(() => {});
  }, [typed, typedName]);

  useImperativeHandle(ref, () => ({
    toPNG: () => (hasStroke.current ? canvasRef.current?.toDataURL('image/png') || null : null),
    clear,
  }));

  return (
    <div className={className}>
      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerDown={typed ? undefined : start}
          onPointerMove={typed ? undefined : move}
          onPointerUp={typed ? undefined : end}
          onPointerLeave={typed ? undefined : end}
          onPointerCancel={typed ? undefined : end}
          className={`h-40 w-full rounded border border-cream/25 bg-cream/5 ${typed ? '' : 'touch-none'}`}
          role="img"
          aria-label={empty ? 'Signature not yet signed' : 'Signature signed'}
        />
        {empty && !typed && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-cream/35">
            Sign here
          </span>
        )}
      </div>

      {typed && (
        <label className="mt-3 block text-sm text-cream/85">
          Type your full name to sign
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            autoComplete="name"
            maxLength={100}
            placeholder="Your full name"
            className="border-cream/25 bg-cream/5 text-cream mt-1 w-full border px-3 py-3 outline-none placeholder:text-cream/35 focus:border-cream/60"
          />
        </label>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={clear}
          /* Padded to a real target rather than a bare 28x16 word. It wipes a signature
             someone has just drawn with a fingertip, so it is the last control on this
             page that should be easy to hit by accident and hard to hit on purpose. */
          className="inline-flex min-h-11 items-center px-1 py-2 text-xs tracking-wide text-cream/60 underline underline-offset-2 hover:text-cream"
        >
          Clear
        </button>
        {/* The only accessible path to signing this form for anyone who cannot use a
            pointer: a canvas has no keyboard interface at all, so without this toggle
            the form is simply impossible to complete without a mouse, finger or pen. */}
        <button
          type="button"
          onClick={() => {
            clear();
            setTypedName('');
            setTyped((current) => !current);
          }}
          className="inline-flex min-h-11 items-center px-1 py-2 text-xs tracking-wide text-cream/60 underline underline-offset-2 hover:text-cream"
        >
          {typed ? 'Draw my signature instead' : "Can't sign above? Type your name instead"}
        </button>
      </div>
    </div>
  );
});

export default SignaturePad;
