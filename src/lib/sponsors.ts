/**
 * The sponsor logos from the live site's "Our Sponsors" marquee, in the same order.
 *
 * `href` is left null for every sponsor: the live site's marquee does not link out,
 * and inventing destination URLs for someone else's brand is not ours to do. If the
 * client wants them clickable, fill these in from their sponsor agreements.
 */
import type { ImageMetadata } from 'astro';

import fishField from '../assets/photos/sponsors/fish-field-logo.png';
import pautzke from '../assets/photos/sponsors/pautzke-logo.png';
import sts from '../assets/photos/sponsors/sts-logo.png';
import yakima from '../assets/photos/sponsors/yakima-bait.png';
import addicted from '../assets/photos/sponsors/addicted-logo.png';
import catchzone from '../assets/photos/sponsors/catchzone-header-logo-black.png';
import anglerWest from '../assets/photos/sponsors/angler-westtv.png';
import aquaz from '../assets/photos/sponsors/aquaz-logo.png';
import clacka from '../assets/photos/sponsors/clacka-logo.png';

export interface Sponsor {
  src: ImageMetadata;
  name: string;
  href: string | null;
}

// TODO: Pro-Cure Bait Scents is missing from this list and it should not be — it is a
// real sponsor and it renders on the live site. Its logo is the one asset that could not
// be recovered: the live markup points at
// /wp-content/uploads/2019/01/procure-logo.png, and that URL (plus every -300x150,
// .webp and alternate-year variant tried) returns a 404 HTML page rather than an image,
// so the site is serving it through something a direct request can't reach. Ask the
// client for the logo file and add it back at the top of this list.
export const sponsors: Sponsor[] = [
  { src: fishField, name: 'Fish Field', href: null },
  { src: pautzke, name: 'Pautzke Bait Co.', href: null },
  { src: sts, name: 'Salmon Trout Steelheader', href: null },
  { src: yakima, name: 'Yakima Bait', href: null },
  { src: addicted, name: 'Addicted Fishing', href: null },
  { src: catchzone, name: 'Catch Zone', href: null },
  { src: anglerWest, name: 'Angler West TV', href: null },
  { src: aquaz, name: 'Aquaz Premium Fishing', href: null },
  { src: clacka, name: 'Clacka Craft', href: null },
];
