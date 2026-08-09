/**
 * Normalises every illustration's background to one of the two site colours, so that
 * artwork and page background are identical and section boundaries leave no seam.
 *
 * Two kinds of artwork:
 *
 *  - Parchment (most of them). Each was drawn on its own slightly different paper
 *    (#f0e5d6 down to a much browner #d1b38b). A per-channel multiplicative gain maps
 *    the paper to --color-cream; because it is multiplicative, near-black ink stays
 *    near-black and only paper and midtones move.
 *
 *  - Dark ground (e.g. the About medallion: white linework on near-black). A gain
 *    would blow out the linework, so these get a levels adjustment instead, mapping
 *    the black floor up to --color-ink while pinning white at white.
 *
 * Originals are preserved in src/assets/images/originals/ and are never overwritten,
 * so this script is safe to re-run: it always reads from the originals.
 *
 * Usage: node scripts/normalize-paper.mjs
 */
import sharp from 'sharp';
import { readdir, mkdir, copyFile, access } from 'node:fs/promises';
import path from 'node:path';

const IMAGE_DIR = path.resolve('src/assets/images');
const ORIGINAL_DIR = path.join(IMAGE_DIR, 'originals');
// Transparent artwork is emitted here as ready-made WebP. Astro's image pipeline
// flattens alpha when it converts to WebP, and its PNG fallback is ~2MB, so these
// are encoded directly and referenced as plain <img srcset>.
const PUBLIC_ART_DIR = path.resolve('public/art');
const ART_WIDTHS = [768, 1200, 1536];

// Must match --color-cream and --color-ink in src/styles/global.css.
const TARGET = { r: 236, g: 224, b: 203 };
const INK = { r: 23, g: 19, b: 15 };

/**
 * Artwork whose baked-in torn edge should become the section boundary itself.
 * The paper below the rip is cut to transparent so whatever sits behind shows
 * through it, which lets the illustrated tear reveal a dark section instead of
 * only ever revealing its own cream paper.
 */
const TEAR_CUT = new Set(['hero-background.png']);

/**
 * The brand mark is the medallion drawn inside the About artwork. Rather than keep a
 * hand-cropped duplicate, it is cut out here: the linework's bounding box is detected,
 * squared off and padded. Its ground is already levelled to --color-ink, so it sits
 * seamlessly on the dark header and footer.
 */
const LOGO = { from: 'about-dave.png', out: 'logo-badge', widths: [160, 320, 640], pad: 0.06 };

/** Estimate the paper tone: the mean of the brightest cluster of pixels. */
async function samplePaper(file) {
  const { data, info } = await sharp(file)
    .resize(240, 240, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const px = [];
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    px.push({ r, g, b, lum: 0.2126 * r + 0.7152 * g + 0.0722 * b });
  }
  px.sort((a, b) => b.lum - a.lum);
  // Skip the very brightest 2% (specular white fray on the torn edges), then
  // average the next 15% - that band is the paper itself.
  const start = Math.floor(px.length * 0.02);
  const end = Math.floor(px.length * 0.17);
  const band = px.slice(start, end);
  const avg = band.reduce((acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }), {
    r: 0,
    g: 0,
    b: 0,
  });
  return {
    r: avg.r / band.length,
    g: avg.g / band.length,
    b: avg.b / band.length,
  };
}

/** Estimate the dark floor of a dark-ground image: the mean of its darkest 40%. */
async function sampleFloor(file) {
  const { data, info } = await sharp(file)
    .resize(240, 240, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const px = [];
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    px.push({ r, g, b, lum: 0.2126 * r + 0.7152 * g + 0.0722 * b });
  }
  px.sort((a, b) => a.lum - b.lum);
  const band = px.slice(0, Math.floor(px.length * 0.4));
  const avg = band.reduce((acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }), {
    r: 0,
    g: 0,
    b: 0,
  });
  return { r: avg.r / band.length, g: avg.g / band.length, b: avg.b / band.length };
}

/**
 * True when the artwork sits on a dark ground rather than parchment. Tested on the
 * border pixels, not the whole image - several parchment scenes are mostly black
 * forest but still sit on paper, and only the border tells them apart.
 */
async function isDarkGround(file) {
  const { data, info } = await sharp(file)
    .resize(120, 120, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const lums = [];
  const at = (x, y) => {
    const i = (y * w + x) * ch;
    return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  };
  for (let x = 0; x < w; x++) {
    lums.push(at(x, 0), at(x, h - 1));
  }
  for (let y = 0; y < h; y++) {
    lums.push(at(0, y), at(w - 1, y));
  }
  lums.sort((a, b) => a - b);
  return lums[Math.floor(lums.length / 2)] < 60;
}

/**
 * Cuts the paper below a baked-in torn edge to transparent, walking up each column
 * from the bottom until it meets the ink of the rip. Returns the PNG buffer plus how
 * far up the cut reached, which the layout needs in order to overlap the next section
 * by exactly that much.
 */
async function cutBelowTear(buffer) {
  const img = sharp(buffer).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;

  let deepest = 0;
  for (let x = 0; x < w; x++) {
    for (let y = h - 1; y >= 0; y--) {
      const i = (y * w + x) * ch;
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      if (lum < 150) {
        deepest = Math.max(deepest, h - 1 - y);
        break;
      }
      data[i + 3] = 0;
    }
  }

  const out = await sharp(data, { raw: { width: w, height: h, channels: ch } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { out, cutFraction: deepest / h };
}

/** Square crop around the bright linework in a dark-ground image. */
async function extractLogo(buffer) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const lum = (x, y) => {
    const i = (y * w + x) * ch;
    return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  };

  let minX = w,
    maxX = 0,
    minY = h,
    maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (lum(x, y) > 110) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const side = Math.round(Math.max(maxX - minX, maxY - minY) * (1 + LOGO.pad * 2));
  // Keep the square inside the source.
  const half = Math.min(side / 2, cx, cy, w - cx, h - cy);
  const size = Math.floor(half * 2);

  return sharp(buffer)
    .extract({
      left: Math.round(cx - size / 2),
      top: Math.round(cy - size / 2),
      width: size,
      height: size,
    })
    .toBuffer();
}

/**
 * Turns the medallion (pale linework on a dark ground) into a flat single-colour mark
 * on a transparent ground, so it can sit on any background instead of carrying its own
 * black square around. Alpha comes from how bright each pixel was, with the dark ground
 * mapped to fully transparent; the RGB is replaced with the requested ink or cream.
 */
async function flattenLogoTo(buffer, colour) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const out = Buffer.alloc(w * h * 4);

  // The ground sits at --color-ink after levelling, not pure black.
  const floor = 0.2126 * INK.r + 0.7152 * INK.g + 0.0722 * INK.b;
  // Black point. The illustration's ground carries fine grain, and mapping luminance
  // straight to alpha turned every speck of it into a faintly visible pixel — which is
  // what showed up as a grey halo of stray dots around the mark. Anything below this
  // is forced fully transparent.
  const toe = floor + (255 - floor) * 0.16;
  // White point. Strokes are thin and anti-aliased, so most of their pixels sit at mid
  // luminance; without this the mark renders grey and washed out. Anything above is
  // fully opaque, leaving only the softest edges to feather.
  const knee = floor + (255 - floor) * 0.46;
  const span = knee - toe;

  for (let p = 0, q = 0; p < data.length; p += ch, q += 4) {
    const lum = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
    const alpha = Math.max(0, Math.min(255, Math.round(((lum - toe) / span) * 255)));
    out[q] = colour.r;
    out[q + 1] = colour.g;
    out[q + 2] = colour.b;
    out[q + 3] = alpha;
  }

  return sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const hex = (c) =>
  '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

const files = (await readdir(IMAGE_DIR)).filter((f) => f.toLowerCase().endsWith('.png'));
await mkdir(ORIGINAL_DIR, { recursive: true });

for (const file of files) {
  const live = path.join(IMAGE_DIR, file);
  const original = path.join(ORIGINAL_DIR, file);

  // First run: stash the pristine copy. Later runs: always start from it.
  if (!(await exists(original))) await copyFile(live, original);

  if (await isDarkGround(original)) {
    // Levels: lift the black floor to --color-ink, pin white at white, so the
    // white linework survives intact.
    const floor = await sampleFloor(original);
    const mul = [
      (255 - INK.r) / (255 - floor.r),
      (255 - INK.g) / (255 - floor.g),
      (255 - INK.b) / (255 - floor.b),
    ];
    const off = [INK.r - floor.r * mul[0], INK.g - floor.g * mul[1], INK.b - floor.b * mul[2]];

    const buf = await sharp(original).linear(mul, off).png({ compressionLevel: 9 }).toBuffer();
    await sharp(buf).toFile(live);

    const after = await sampleFloor(live);
    let logoNote = '';

    if (file === LOGO.from) {
      await mkdir(PUBLIC_ART_DIR, { recursive: true });
      const cropped = await extractLogo(buf);
      const meta = await sharp(cropped).metadata();

      // Two flat variants on transparent grounds: ink for pale backgrounds, cream for
      // dark ones. The original pale-on-black coin is kept for anywhere that wants it.
      const variants = [
        { name: LOGO.out, source: cropped },
        { name: `${LOGO.out}-ink`, source: await flattenLogoTo(cropped, INK) },
        { name: `${LOGO.out}-cream`, source: await flattenLogoTo(cropped, TARGET) },
      ];

      const notes = [];
      for (const variant of variants) {
        const sizes = [];
        for (const width of LOGO.widths) {
          const target = path.join(PUBLIC_ART_DIR, `${variant.name}-${width}.webp`);
          const out = await sharp(variant.source)
            .resize({ width })
            // Lossless: this is two-tone line art on a flat/transparent ground, and
            // lossy WebP puts ringing noise around the high-contrast strokes and in
            // the alpha channel, which shows as a grey halo of stray pixels around
            // the medallion. Lossless costs a little size and removes it entirely.
            .webp({ lossless: true, effort: 6 })
            .toFile(target);
          sizes.push(`${width}px ${Math.round(out.size / 1024)}kB`);
        }
        notes.push(`${variant.name}-*.webp (${sizes.join(', ')})`);
      }

      logoNote =
        `\n${' '.repeat(36)}brand mark cropped ${meta.width}x${meta.height} -> public/art/` +
        notes.map((n) => `\n${' '.repeat(38)}${n}`).join('');
    }

    console.log(
      `${file.padEnd(34)} dark ground ${hex(floor)} -> ${hex(after)}  (levels to ink)${logoNote}`,
    );
    continue;
  }

  const paper = await samplePaper(original);
  const gain = [TARGET.r / paper.r, TARGET.g / paper.g, TARGET.b / paper.b];

  let buf = await sharp(original).linear(gain, [0, 0, 0]).png({ compressionLevel: 9 }).toBuffer();

  let cutNote = '';
  if (TEAR_CUT.has(file)) {
    const { out, cutFraction } = await cutBelowTear(buf);
    buf = out;

    await mkdir(PUBLIC_ART_DIR, { recursive: true });
    const base = file.replace(/\.png$/i, '');
    const sizes = [];
    for (const width of ART_WIDTHS) {
      const target = path.join(PUBLIC_ART_DIR, `${base}-${width}.webp`);
      const info = await sharp(buf)
        .resize({ width })
        .webp({ quality: 82, alphaQuality: 100 })
        .toFile(target);
      sizes.push(`${width}w ${Math.round(info.size / 1024)}kB`);
    }

    const meta = await sharp(buf).metadata();
    const overlapPct = ((cutFraction * meta.height) / meta.width) * 100;
    cutNote =
      `  torn edge cut to transparent, deepest ${(cutFraction * 100).toFixed(1)}% of height` +
      `\n${' '.repeat(36)}overlap next section by ${overlapPct.toFixed(1)}% of page width` +
      `\n${' '.repeat(36)}public/art: ${sizes.join(', ')}`;
  }

  await sharp(buf).toFile(live);

  const after = await samplePaper(live);
  console.log(
    `${file.padEnd(34)} paper ${hex(paper)} -> ${hex(after)}  ` +
      `gain [${gain.map((g) => g.toFixed(3)).join(', ')}]${cutNote}`,
  );
}

console.log(`\nTarget parchment: ${hex(TARGET)}`);
console.log(`Originals preserved in ${path.relative(process.cwd(), ORIGINAL_DIR)}`);
