/**
 * Side-view salmon, drawn flat. lucide's `Fish` is a generic cartoon fish; this has the
 * salmonid shape — fusiform body, forked tail, and the small adipose fin between the
 * dorsal and the tail that only salmon and trout have.
 *
 * Filled rather than stroked so it stays legible at tab size (~20px). The eye is a hole
 * punched with `evenodd` rather than a coloured dot, so it reads on any background.
 */
export default function SalmonIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 32" fill="none" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d="
          M4 16 C7 10.5 11.5 8.2 16.5 7.6 C25 6.6 34.5 7.8 42.5 11.4
          L47.5 13.6 L60.5 3.5 C56.5 8.6 55 12.4 54.6 16
          C55 19.6 56.5 23.4 60.5 28.5 L47.5 18.4 L42.5 20.6
          C34.5 24.2 25 25.4 16.5 24.4 C11.5 23.8 7 21.5 4 16 Z
          M24 7.4 L28.6 1.6 L34.6 8.4 Z
          M43.4 11 L46 7.5 L46.9 11.9 Z
          M26.2 23.4 L28.8 27.8 L32.8 24 Z
          M36.4 21.6 L38.6 26.2 L43 19.9 Z
          M11.9 13.7 A1.35 1.35 0 1 1 9.2 13.7 A1.35 1.35 0 1 1 11.9 13.7 Z
        "
      />
      {/* gill plate and pectoral fin, kept as strokes so they read as creases */}
      <path
        d="M15.6 8.8 C13.7 12.1 13.7 19.9 15.6 23.2"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M18.2 18.6 C20.8 22 23.2 23.2 23.2 23.2"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}
