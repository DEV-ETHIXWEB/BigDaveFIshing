/**
 * Inline scripts whose CSP hash has to be known before any page renders.
 *
 * Plain `.mjs`, not `.ts`, and that is the whole reason this file exists separately:
 * astro.config.mjs has to import it at config-load time to hash it, and the config is
 * not run through the TypeScript pipeline.
 *
 * Why a build-time hash rather than `Astro.csp.insertScriptHash` at render time: Astro
 * streams SSR responses, so it computes the Content-Security-Policy HEADER before the
 * page body has rendered (see renderToAsyncIterable in astro/dist/runtime/server/render/
 * page.js). A hash registered from inside a component therefore arrives too late for
 * every server-rendered route - it works only for prerendered pages, where the policy is
 * written into a <meta> after the page is built. Streaming is not configurable
 * (`defaultStreaming: () => true` in production), so a static hash is the only thing
 * that covers both kinds of route.
 */

/**
 * Arms the reveal animation before first paint, so sections start hidden rather than
 * flashing in once the observer attaches.
 *
 * This is the ONLY thing that sets the class: if the script is blocked or JS is off, the
 * CSS hidden state never applies and the page is simply visible. It has to be inline and
 * blocking - bundled, it would become a deferred module and every section would paint
 * visible, then hide, then animate, which is worse than having no animation at all.
 *
 * Layout.astro renders this exact string with `set:html`. Editing it here changes the
 * hash, which astro.config.mjs recomputes on the next build, so the two cannot drift.
 */
export const REVEAL_BOOTSTRAP = "document.documentElement.classList.add('js-reveal');";
