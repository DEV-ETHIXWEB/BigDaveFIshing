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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const prior = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx?.scale(dpr, dpr);
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2.25;
        ctx.strokeStyle = '#17130f';
      }
      if (prior && ctx) ctx.putImageData(prior, 0, 0);
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

  useImperativeHandle(ref, () => ({
    toPNG: () => (hasStroke.current ? canvasRef.current?.toDataURL('image/png') || null : null),
    clear,
  }));

  return (
    <div className={className}>
      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          className="h-40 w-full touch-none rounded border border-cream/25 bg-cream/5"
          role="img"
          aria-label={empty ? 'Signature — not yet signed' : 'Signature — signed'}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-cream/35">
            Sign here
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        className="mt-2 text-xs tracking-wide text-cream/60 underline underline-offset-2 hover:text-cream"
      >
        Clear
      </button>
    </div>
  );
});

export default SignaturePad;
