/**
 * Shared geometry for the torn-paper edges, so a filled tear and a mask cut along
 * the same rip are guaranteed to line up exactly.
 */
export const TEAR_W = 1440;
export const TEAR_H = 56;

/** Deterministic pseudo-random, so the tear is stable between builds. */
function rand(i: number) {
  const n = Math.sin(i * 127.1) * 43758.5453;
  return n - Math.floor(n);
}

export function tornEdgePoints(steps = 150) {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = (TEAR_W / steps) * i;
    // Long slow undulation, a mid ripple, plus fine fibre jitter.
    const wave = 11 * Math.sin(i * 0.075) + 5 * Math.sin(i * 0.26 + 1.7);
    const jitter = (rand(i) - 0.5) * 6 + (rand(i * 3.7) - 0.5) * 3;
    points.push({ x, y: 26 + wave + jitter });
  }
  return points;
}

const fmt = (p: { x: number; y: number }) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;

/** The rip itself, left to right. */
export function tornEdgeLine(points = tornEdgePoints()) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${fmt(p)}`).join(' ');
}

/** Everything BELOW the rip - used when the tear is filled with the next colour. */
export function tornEdgeBelow(points = tornEdgePoints()) {
  return `${tornEdgeLine(points)} L ${TEAR_W},${TEAR_H} L 0,${TEAR_H} Z`;
}

/** Everything ABOVE the rip - used as a mask so a section ends on the rip. */
export function tornEdgeAbove(points = tornEdgePoints()) {
  const back = [...points]
    .reverse()
    .map((p) => `L ${fmt(p)}`)
    .join(' ');
  return `M 0,0 L ${TEAR_W},0 ${back} Z`;
}

/**
 * CSS `mask-image` value that cuts a section off along the rip. Pair with the
 * `.torn-bottom` class, which positions and sizes it.
 */
export function tornMaskUrl(points = tornEdgePoints()) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TEAR_W} ${TEAR_H}" ` +
    `preserveAspectRatio="none"><path d="${tornEdgeAbove(points)}" fill="#fff"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
