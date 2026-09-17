/**
 * SHA-256 hashes for the handful of scripts that genuinely have to be inline.
 *
 * Astro's CSP support hashes every script it compiles itself, but an `is:inline` script
 * is passed through untouched and therefore unhashed - enabling CSP without this would
 * have blocked the two in Layout.astro on every page of the site: the JSON-LD block
 * (silently costing the business its structured data in search results) and the reveal
 * bootstrap (leaving every section stuck in its hidden state or flashing).
 *
 * Computed at render time and registered through `Astro.csp.insertScriptHash` rather
 * than written into astro.config.mjs as literals. That matters for more than tidiness:
 *
 *   a literal goes stale the moment anyone edits the script it describes, and the
 *   failure is silent in production and invisible in `astro dev`, which does not apply
 *   CSP at all;
 *
 *   and the JSON-LD is not actually constant - it carries the site origin, which on a
 *   preview deployment or a custom domain is whatever the request arrived on. A fixed
 *   hash would be correct on exactly one host.
 *
 * Hashing the real string every time cannot drift from what is on the page.
 */

const encoder = new TextEncoder();

/**
 * The CSP hash of a script's text content.
 *
 * The digest must be taken over the exact bytes between `<script>` and `</script>`, so
 * every caller renders the same string it hashed - via `set:html`, never by retyping it
 * into the template.
 */
export async function scriptHash(source: string): Promise<`sha256-${string}`> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(source));
  // btoa over the raw bytes: CSP wants standard base64 of the digest, not hex.
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return `sha256-${base64}`;
}
