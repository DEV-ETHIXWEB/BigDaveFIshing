import baseService from 'astro/assets/services/sharp';
import type { ImageTransform, LocalImageService } from 'astro';
import sharp from 'sharp';

/**
 * The built-in sharp service, with a higher default encode quality and a sharpening
 * pass after every resize.
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

  validateOptions(options, imageConfig, logger) {
    const validated = baseService.validateOptions
      ? baseService.validateOptions(options, imageConfig, logger)
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

  /**
   * Every resize algorithm, Sharp's `lanczos3` default included, softens an image a
   * little - it is an unavoidable side effect of averaging pixels together, not a bug in
   * the kernel choice. Photographers and print houses always sharpen *after* resizing to
   * compensate, never before; this does the same thing here, once, for every image this
   * site ships, since `withoutEnlargement: true` in Astro's own sharp service means every
   * candidate this project generates is a downscale (or a 1:1 copy) of an already-modest
   * source photo, exactly the case this compensates for.
   *
   * `sigma: 0.8` was chosen by comparing output side by side against no sharpening and
   * against a stronger setting: 0.8 restores real edge contrast (scales, fabric weave,
   * cloud definition) with no visible halo, where a stronger pass started to ring around
   * high-contrast edges like sunglasses frames. The base service is called first and
   * unmodified - this only adds one step after it, so the resize, format selection and
   * quality logic above are exactly what they were before.
   */
  async transform(inputBuffer, transformOptions, config, logger) {
    const result = await baseService.transform(inputBuffer, transformOptions, config, logger);

    // SVGs are passed through unrasterized by the base service; sharpening would force
    // a decode that either fails outright or throws away the vector data for nothing.
    if (result.format === 'svg') return result;

    const quality = typeof transformOptions.quality === 'number' ? transformOptions.quality : 90;
    // Astro's own TransformResult['format'] is a wider string type than Sharp's format
    // enum; every value it can actually hold here (webp/png/avif/jpeg/jpg - svg already
    // returned above) is one Sharp accepts, so this narrows what's already been checked
    // rather than asserting past a real type mismatch.
    const sharpened = await sharp(result.data)
      .sharpen({ sigma: 0.8 })
      .toFormat(result.format as keyof import('sharp').FormatEnum, { quality })
      .toBuffer();

    return { data: sharpened, format: result.format };
  },
};

export default service;
