import baseService from 'astro/assets/services/sharp';
import type { ImageTransform, LocalImageService } from 'astro';

/**
 * The built-in sharp service, with a higher default encode quality.
 *
 * Astro's sharp service defaults to quality 80. That is a sensible default for stock
 * photography, but these are the client's own catch photos, already only 800–1500px
 * web-resized copies from WordPress, so they have been through one lossy pass before we
 * ever see them. Encoding a second lossy pass at 80 on top of that is what puts visible
 * mush in the water and blocking in the sky.
 *
 * Doing it here rather than by adding `quality={90}` to each `<Image>` matters: there are
 * 22 call sites plus two getImage() calls, and this also covers every image added later.
 * Per-image quality still wins; the default only fills in when nothing was specified.
 */
const service: LocalImageService = {
  ...baseService,

  validateOptions(options, imageConfig) {
    const validated = baseService.validateOptions
      ? baseService.validateOptions(options, imageConfig)
      : options;

    const withDefault = (transform: ImageTransform): ImageTransform => ({
      ...transform,
      // ?? not ||, so an explicit quality of 0 is honoured rather than silently
      // replaced. Per-image quality always wins; this only fills the gap.
      quality: transform.quality ?? 90,
    });

    // The contract allows validateOptions to be async. sharp's is synchronous today,
    // but branching here means this keeps working if that ever changes rather than
    // quietly spreading a pending Promise into the options object.
    return validated instanceof Promise ? validated.then(withDefault) : withDefault(validated);
  },
};

export default service;
