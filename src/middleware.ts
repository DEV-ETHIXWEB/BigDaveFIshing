import { defineMiddleware } from 'astro:middleware';
import { validAdminSession } from './lib/admin-auth';

/**
 * Gates /admin/* behind HTTP Basic Auth. This is a small internal tool for one
 * business owner, not a multi-user system — a browser-native auth prompt checked
 * against env-configured credentials is proportionate; a login form + session store
 * would be more code for no real benefit here.
 *
 * Set ADMIN_USER and ADMIN_PASSWORD as environment variables. If either is unset,
 * /admin is refused entirely rather than left open — a missing password must never
 * mean "no password required."
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  if (pathname === '/admin/login') return next();
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) return next();

  const user = import.meta.env.ADMIN_USER;
  const pass = import.meta.env.ADMIN_PASSWORD;

  if (!user || !pass) {
    return new Response('Admin area not configured. Set ADMIN_USER and ADMIN_PASSWORD.', {
      status: 503,
    });
  }

  if (await validAdminSession(context.cookies.get('big_dave_admin')?.value, pass)) return next();
  if (pathname.startsWith('/api/')) return new Response('Authentication required', { status: 401 });
  return context.redirect(`/admin/login?next=${encodeURIComponent(pathname)}`, 303);
});
