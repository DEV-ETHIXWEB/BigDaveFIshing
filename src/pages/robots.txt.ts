import type { APIRoute } from 'astro';
import { isIndexable, siteOrigin } from '../lib/site-url';

// Built per request, because what it says depends on which deployment is serving it.
export const prerender = false;

/**
 * robots.txt.
 *
 * Two different files depending on the deployment. Production invites crawlers and points
 * at the sitemap; every preview and branch deployment refuses them outright. Shipping one
 * permissive file for both is how a staging copy ends up in Google competing with the
 * real site for its own name.
 *
 * `/admin` and `/api` are disallowed in both. The admin area is already behind a session
 * and sends `X-Robots-Tag: noindex` (see src/middleware.ts), this is belt and braces, and
 * keeps crawlers from spending the site's budget on routes that answer 401.
 */
export const GET: APIRoute = ({ request }) => {
  const origin = siteOrigin(request.url);

  const body = isIndexable()
    ? [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /api/',
        '',
        `Sitemap: ${origin}/sitemap.xml`,
        '',
      ].join('\n')
    : ['# Non-production deployment. Not for indexing.', 'User-agent: *', 'Disallow: /', ''].join(
        '\n',
      );

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
