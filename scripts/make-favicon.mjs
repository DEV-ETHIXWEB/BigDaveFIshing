/**
 * Generates the site's favicons from the brand badge.
 *
 * Run with: node scripts/make-favicon.mjs
 *
 * Two things this has to get right:
 *
 * 1. The badge is black linework on a fully transparent ground, so left as-is it
 *    disappears against a dark browser tab strip. Every output is therefore flattened
 *    onto the page ground colour rather than shipped with alpha.
 * 2. At 16px the ring lettering is unreadable no matter what, so the small sizes use
 *    tighter padding to give the mark itself as many pixels as possible.
 */
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const SOURCE = 'src/assets/photos/logo-badge.png';
const GROUND = { r: 244, g: 244, b: 244, alpha: 1 }; // --color-cream

/**
 * Badge trimmed of its transparent margin, padded, sitting on a ground.
 *
 * `shape: 'circle'` puts it on a disc with transparent corners, so the icon reads as
 * the round emblem it is rather than as a square tile, the badge's own outer ring
 * lands just inside the disc edge.
 *
 * `shape: 'square'` keeps a fully opaque square, which is what apple-touch-icon needs:
 * iOS applies its own mask and renders any transparency it finds as solid black.
 */
async function icon(size, padRatio, shape = 'circle') {
  const inner = Math.round(size * (1 - padRatio * 2));
  const mark = await sharp(SOURCE)
    .trim()
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const offset = Math.round((size - inner) / 2);
  const layers = [];

  if (shape === 'circle') {
    const r = size / 2;
    const disc = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
         <circle cx="${r}" cy="${r}" r="${r}" fill="rgb(${GROUND.r},${GROUND.g},${GROUND.b})"/>
       </svg>`,
    );
    layers.push({ input: disc, top: 0, left: 0 });
  }

  layers.push({ input: mark, top: offset, left: offset });

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: shape === 'circle' ? { r: 0, g: 0, b: 0, alpha: 0 } : GROUND,
    },
  })
    .composite(layers)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Packs PNG buffers into an .ico. Vista and every browser since accept PNG-encoded
 * entries, so there is no need to emit legacy BMP/DIB data.
 */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + pngs.length * 16;
  const entries = [];
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 means 256
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // palette count
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

// Padding is near-zero for the circular icons: the badge's own ring is the edge of the
// mark, so any inset just shrinks it inside a visible ring of blank disc.
const icoSizes = [16, 32, 48];
const ico = buildIco(
  await Promise.all(
    icoSizes.map(async (size) => ({ size, data: await icon(size, 0.01, 'circle') })),
  ),
);
await writeFile('public/favicon.ico', ico);

const files = [
  ['public/favicon-32.png', 32, 0.01, 'circle'],
  ['public/favicon-96.png', 96, 0.02, 'circle'],
  // Square and opaque on purpose, see the note on icon().
  ['public/apple-touch-icon.png', 180, 0.1, 'square'],
];

for (const [path, size, pad, shape] of files) {
  await writeFile(path, await icon(size, pad, shape));
}

console.log(`favicon.ico (${icoSizes.join('/')}) + ${files.map(([p]) => p).join(', ')}`);
