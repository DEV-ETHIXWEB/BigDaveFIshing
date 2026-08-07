import type { APIRoute } from 'astro';
import { adminSessionMaxAge, createAdminSession } from '../../../lib/admin-auth';
export const prerender = false;
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const username = String(form.get('username') || '');
  const password = String(form.get('password') || '');
  const next = String(form.get('next') || '/admin/waivers');
  const safeNext = next.startsWith('/admin') ? next : '/admin/waivers';
  const user = import.meta.env.ADMIN_USER;
  const pass = import.meta.env.ADMIN_PASSWORD;
  if (!user || !pass || username !== user || password !== pass)
    return redirect('/admin/login?error=1', 303);
  cookies.set('big_dave_admin', await createAdminSession(pass), {
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    path: '/',
    maxAge: adminSessionMaxAge,
  });
  return redirect(safeNext, 303);
};
