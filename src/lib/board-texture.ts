import { getImage } from 'astro:assets';
import wood from '../assets/photos/wood-texture.png';

/**
 * The weathered-board texture behind the brand rail and the mobile menu.
 *
 * It used to be referenced as the raw source, a 1920x1280 PNG served untouched at 964 KB
 * on every page - the single heaviest file on the site, requested at high priority on
 * phones, where it competed with the hero photo for the connection. It is only ever
 * shown greyscaled and lightened behind text (see .board-tex in global.css), so a
 * compressed WebP is visually identical there at a fraction of the weight.
 */
export const boardTexture = await getImage({
  src: wood,
  format: 'webp',
  width: 1600,
  quality: 55,
});
