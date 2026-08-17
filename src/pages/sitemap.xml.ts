import type { APIRoute } from 'astro';
import { nav, waiverLinks } from '../lib/business';
import { siteOrigin } from '../lib/site-url';

export const prerender = false;

/**
 * The sitemap.
 *
 * Built from `nav` and `waiverLinks` rather than a second hand-written list, so a page
 * added to the navigation is in the sitemap by the same edit. A sitemap maintained
 * separately is a sitemap that goes stale, and a stale one is worse than none, because
 * it hands Google URLs that 404.
 *
 * Deliberately excluded: `/admin/*` and `/api/*` (gated, and noindex), `/500` and `/404`
 * (error states), and `/waivers` sub-pages are included because guests reach them from a
 * link Dave sends and a crawlable copy does no harm.
 */
const priorities: Record<string, string> = {
  '/': '1.0',
  '/oregon-rates-packages': '0.9',
  '/contact': '0.9',
  '/wilson-river-lodge': '0.8',
  '/oregon-fishing': '0.8',
};

export const GET: APIRoute = ({ request }) => {
  const origin = siteOrigin(request.url);
  const paths = [...nav.map((link) => link.href), '/waivers', ...waiverLinks.map((l) => l.href)];

  // Guards against a duplicate entry if a path ever appears in both lists, Search
  // Console flags duplicate <loc> values as an error.
  const unique = [...new Set(paths)];

  const urls = unique
    .map((path) => {
      const loc = `${origin}${path === '/' ? '' : path}` || `${origin}/`;
      return `  <url>
    <loc>${escapeXml(path === '/' ? `${origin}/` : loc)}</loc>
    <priority>${priorities[path] ?? '0.7'}</priority>
  </url>`;
    })
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
