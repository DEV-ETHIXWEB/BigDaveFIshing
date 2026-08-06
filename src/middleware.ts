import { defineMiddleware } from 'astro:middleware';

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
  if (!context.url.pathname.startsWith('/admin')) return next();

  const user = import.meta.env.ADMIN_USER;
  const pass = import.meta.env.ADMIN_PASSWORD;

  if (!user || !pass) {
    return new Response('Admin area not configured. Set ADMIN_USER and ADMIN_PASSWORD.', {
      status: 503,
    });
  }

  const authHeader = context.request.headers.get('authorization');
  if (authHeader?.startsWith('Basic ')) {
    const decoded = atob(authHeader.slice(6));
    const sep = decoded.indexOf(':');
    const suppliedUser = decoded.slice(0, sep);
    const suppliedPass = decoded.slice(sep + 1);
    if (suppliedUser === user && suppliedPass === pass) {
      return next();
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
  });
});
