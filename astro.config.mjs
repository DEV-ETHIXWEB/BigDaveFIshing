// @ts-check
import { createHash } from 'node:crypto';
import { defineConfig } from 'astro/config';
import { REVEAL_BOOTSTRAP } from './src/lib/inline-scripts.mjs';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

import vercel from '@astrojs/vercel';

/**
 * The CSP hash of an inline script's exact text content.
 *
 * @param {string} source
 * @returns {`sha256-${string}`} the value CSP expects inside quotes
 */
const hashOf = (source) => `sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}`;

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  /**
   * No trailing slashes. Every address on the old WordPress site ended in one
   * (/gallery/, /fishing-adventure-waiver/), and the redirects below only match the bare
   * form. With this set, the Vercel adapter emits Vercel's own rule that sends /x/ to /x
   * first, so the old links reach their redirect instead of a 404 - and /contact and
   * /contact/ stop being served as two separate pages.
   */
  trailingSlash: 'never',

  /**
   * Addresses from the WordPress site this replaces, taken from its own wp-sitemap.
   *
   * The two waiver pages are the ones that matter most: they are in the old site's main
   * menu, and they are the links Dave has been sending guests. Everything else either
   * moved (the gallery is the video page now) or has no equivalent here - the Alaska
   * pages were already out of the old menu, so they go to the home page rather than to
   * a 404. 301 so search engines carry the old pages' standing across to the new ones.
   *
   * `/admin` has no page of its own; without this it answered 404 after signing in.
   */
  redirects: {
    '/fishing-adventure-waiver': { status: 301, destination: '/waivers/fishing-adventure' },
    '/wilson-river-lodge-waiver': { status: 301, destination: '/waivers/lodge' },
    '/gallery': { status: 301, destination: '/videos' },
    '/blog': { status: 301, destination: '/' },
    '/alaska-fishing': { status: 301, destination: '/' },
    '/alaska-lodge': { status: 301, destination: '/' },
    '/alaska-faq': { status: 301, destination: '/' },
    '/alaska-rates-packages': { status: 301, destination: '/' },
    '/alaska-lodge-getting-here': { status: 301, destination: '/' },
    '/alaska-packing-list': { status: 301, destination: '/' },
    '/admin': { status: 302, destination: '/admin/waivers' },
  },

  // No .md/.mdx anywhere in this project, so Shiki (Astro's default code-block
  // highlighter) never actually runs - but it stays configured by default regardless,
  // and it renders inline styles that this site's CSP (below) does not allow, which is
  // exactly what Astro's own build warned about. Turned off outright rather than left
  // as a warning for a feature nothing here uses.
  markdown: {
    syntaxHighlight: false,
  },

  /**
   * Content-Security-Policy.
   *
   * The policy used to live entirely in vercel.json and carried `script-src 'self'
   * 'unsafe-inline'`, which is the one value that gives up most of what CSP is for: an
   * injected <script> is inline, so allowing all inline scripts allows the attack the
   * directive exists to stop.
   *
   * Astro hashes every script and style it compiles and emits them in a <meta> element
   * per page, so `unsafe-inline` is no longer needed for scripts. The two scripts that
   * genuinely must stay inline (the JSON-LD block and the reveal bootstrap, both in
   * src/layouts/Layout.astro) register their own hashes at render time through
   * `Astro.csp.insertScriptHash` - see src/lib/csp-hash.ts.
   *
   * ALL the directives live here rather than being split with the header. Two policies
   * both apply, and a header carrying `default-src 'self'` with no `script-src` would
   * fall back to default-src for scripts and refuse the very inline scripts these hashes
   * exist to admit - the hashes in the <meta> policy cannot satisfy the header's policy.
   * vercel.json keeps only `frame-ancestors`, which a <meta> policy is required to ignore.
   *
   * Not applied by `astro dev`; verify with `astro build` and `astro preview`.
   */
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        // data: for the signature canvas PNGs, blob: for canvas export.
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        'upgrade-insecure-requests',
      ],
      scriptDirective: {
        /**
         * The reveal bootstrap, hashed here rather than registered at render time.
         *
         * Astro streams SSR responses and builds the CSP header before the body renders,
         * so a hash inserted from inside Layout.astro never reaches a server-rendered
         * route - verified: the bootstrap was blocked on /waivers/lodge with the browser
         * naming this exact hash as the one it wanted. Declaring it in config puts it in
         * the manifest, which covers the prerendered <meta> and the SSR header alike.
         *
         * Computed from the same constant Layout.astro renders, so editing the script
         * updates the hash automatically instead of leaving a stale literal behind.
         */
        hashes: [hashOf(REVEAL_BOOTSTRAP)],
      },
      styleDirective: {
        /**
         * Inline `style` attributes stay allowed, deliberately.
         *
         * Astro sets them for real work - the board texture URL on the nav, the reveal
         * stagger delay on the rates cards, React's own inline styles in the gallery -
         * and a style ATTRIBUTE cannot be covered by a hash without `unsafe-hashes`,
         * which is a bigger concession than this one. A style attribute cannot execute
         * script, so this is a far smaller allowance than the `script-src 'unsafe-inline'`
         * it replaces.
         *
         * ONLY the `attribute` kind is listed, and that is deliberate. Adding an
         * `element` resource here would emit `style-src-elem`, which browsers do NOT
         * fall back from - it would override `style-src` for <style> blocks and
         * <link rel=stylesheet>, dropping the very hashes Astro generates for them.
         * Leaving it out means elements keep using `style-src 'self' <hashes>` and only
         * attributes get the exemption.
         */
        resources: [{ resource: "'unsafe-inline'", kind: 'attribute' }],
      },
    },
  },

  // Wraps Astro's own sharp service to raise the default encode quality from 80 to 90.
  // See src/lib/image-service.ts for why. sharp is a direct dependency now rather than
  // something inherited from Astro's own tree.
  image: {
    service: { entrypoint: './src/lib/image-service.ts' },
  },

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ['lucide-react'],
    },
    // Adding a new React island used to make the dev server discover React's runtime
    // late, re-optimise mid-session, and then serve a stale bundle: every island on the
    // site died with `504 (Outdated Optimize Dep)` and `_jsxDEV is not a function`,
    // including ones that had been working. Pre-declaring these means the dep graph is
    // known at startup and a new island cannot invalidate it.
    // Production builds were never affected - they use jsx-runtime, not the dev runtime.
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
      ],
    },
  },

  adapter: vercel(),
});
