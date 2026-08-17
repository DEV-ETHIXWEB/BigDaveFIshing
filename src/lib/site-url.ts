import { envSetting } from './env';

/**
 * The site's own public origin, with no trailing slash.
 *
 * `PUBLIC_SITE_URL` wins wherever it is set. Falling back to the incoming request's
 * origin keeps `astro dev` and preview deployments working without configuration, but it
 * is only a fallback: on Vercel a request can arrive on the deployment's internal
 * hostname, and a sitemap full of `*.vercel.app` URLs is a sitemap that tells Google to
 * index the wrong domain.
 */
export function siteOrigin(requestUrl: URL | string): string {
  const configured = envSetting('PUBLIC_SITE_URL');
  if (configured) return configured.replace(/\/+$/, '');
  return new URL(requestUrl).origin;
}

/**
 * True when this deployment must not be indexed.
 *
 * Preview and branch deployments are the ones that quietly get indexed and then compete
 * with the real site for its own search results. Vercel sets VERCEL_ENV to `production`
 * only on the production deployment, so anything else is treated as a preview. If the
 * variable is absent entirely (local, or another host) the answer is "don't index",
 * because the failure that costs something is indexing a staging copy, not missing a
 * crawl on localhost.
 */
export function isIndexable(): boolean {
  const vercelEnv = envSetting('VERCEL_ENV');
  if (vercelEnv) return vercelEnv === 'production';
  return Boolean(envSetting('PUBLIC_SITE_URL')) && envSetting('NODE_ENV') === 'production';
}
