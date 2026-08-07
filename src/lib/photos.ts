/**
 * Single manifest for every real photograph on the site.
 *
 * These files were pulled from the live bigdavesfishing.com so the rebuild could be
 * judged against real imagery rather than grey placeholder blocks. They are the
 * client's own photos, but they are the web-sized copies WordPress had on hand -
 * mostly 800-1500px on the long edge. When the hi-res originals arrive, drop them
 * into `src/assets/photos/` under the same filenames and nothing else has to change:
 * every component reads its image from this file, never by path.
 *
 * `alt` lives here too, so the wording stays consistent wherever a photo is reused.
 */
import type { ImageMetadata } from 'astro';

import bayChinookPair from '../assets/photos/Untitled3-1.webp';
import chumBushLodge from '../assets/photos/alaska-chum-fishing-bush-lodge.webp';
import daveSalmonTillamook from '../assets/photos/big-dave-salmon-oregon-fishing-guide-tillamook.webp';
import chumSalmon from '../assets/photos/chum-salmon-alaska-fishing-big-daves.webp';
import daveAndLeslie from '../assets/photos/david-leslie-manners-contact-big-daves-fishing-opt.webp';
import halibut from '../assets/photos/halibut-big-daves-fishing-adventures.webp';
import salmonWilsonRiver from '../assets/photos/oregon-fishing-big-daves-salmon-wilson-river.webp';
import cohoKing from '../assets/photos/oregon-silver-king-coho-salmon-big-daves.webp';
import rainbowTrout from '../assets/photos/rainbow-trout-fishing-oregon.webp';
import silverSalmon from '../assets/photos/silver-salmon-fishing-oregon.webp';
import threeAnglers from '../assets/photos/slide2-1.webp';
import boatCatch from '../assets/photos/slide3-1.webp';
import wilsonRiverLevel from '../assets/photos/wilson-river-level-fishing-salmon.webp';
import lodgeSilverSalmon from '../assets/photos/wilson-river-lodge-fishing-guide-silver-salmon.webp';
import lodgeFishing from '../assets/photos/wilson-river-lodge-fishing.webp';
import lodgeRiver from '../assets/photos/wilson-river-lodge-oregon-river-fishing.webp';

export interface Photo {
  src: ImageMetadata;
  alt: string;
}

export const photos = {
  threeAnglers: {
    src: threeAnglers,
    alt: 'Three anglers on the boat holding up a morning of bright salmon on Tillamook Bay',
  },
  boatCatch: {
    src: boatCatch,
    alt: 'Anglers in the boat with a pair of chrome salmon caught on the Oregon coast',
  },
  bayChinookPair: {
    src: bayChinookPair,
    alt: 'Two guests holding a matched pair of chinook salmon on the river bank',
  },
  daveSalmonTillamook: {
    src: daveSalmonTillamook,
    alt: 'Big Dave and a guest holding a heavy Tillamook chinook salmon over the water',
  },
  salmonWilsonRiver: {
    src: salmonWilsonRiver,
    alt: 'A guest cradling a chrome salmon caught on the Wilson River',
  },
  cohoKing: {
    src: cohoKing,
    alt: 'Guests in the boat holding a coho and a king salmon side by side',
  },
  silverSalmon: {
    src: silverSalmon,
    alt: 'A bright silver coho salmon held above the net at the side of the boat',
  },
  rainbowTrout: {
    src: rainbowTrout,
    alt: 'An angler holding a broad-shouldered steelhead beside the river',
  },
  chumSalmon: {
    src: chumSalmon,
    alt: 'A chum salmon in full spawning colours held low over the grass',
  },
  chumBushLodge: {
    src: chumBushLodge,
    alt: 'An angler kneeling in the shallows with a chum salmon',
  },
  halibut: { src: halibut, alt: 'A halibut landed on a Big Dave saltwater trip' },
  wilsonRiverLevel: {
    src: wilsonRiverLevel,
    alt: 'The Wilson River running clear and green through the coast range',
  },
  lodgeRiver: {
    src: lodgeRiver,
    alt: 'The stretch of the Wilson River behind the lodge, framed by mossy timber',
  },
  lodgeFishing: {
    src: lodgeFishing,
    alt: 'Private river access behind the Wilson River Lodge',
  },
  lodgeSilverSalmon: {
    src: lodgeSilverSalmon,
    alt: 'A guest at the Wilson River Lodge holding a silver salmon',
  },
  daveAndLeslie: {
    src: daveAndLeslie,
    alt: 'Hosts Dave and Leslie Manners holding a pair of king salmon on the river',
  },
} satisfies Record<string, Photo>;

/**
 * Homepage "Recent Catches" accordion. Each panel carries a label, so the section
 * doubles as a quick answer to "what will I actually catch?" - the panels line up
 * with the runs named on the Oregon Fishing page.
 *
 * Five is deliberate: at the default 0.52 expand ratio the open panel takes just
 * over half the row, which leaves the four closed panels wide enough to still read
 * as photographs rather than as slivers. Adding more makes them slivers.
 */
export const accordionPhotos: (Photo & { label: string })[] = [
  { ...photos.daveSalmonTillamook, label: 'Fall Chinook' },
  { ...photos.silverSalmon, label: 'Silver Coho' },
  { ...photos.rainbowTrout, label: 'Winter Steelhead' },
  { ...photos.bayChinookPair, label: 'Tillamook Bay' },
  { ...photos.halibut, label: 'Halibut' },
];
