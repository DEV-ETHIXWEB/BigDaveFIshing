import type { APIRoute } from 'astro';
export const prerender = false;
export const POST: APIRoute = ({ cookies, redirect }) => {
  cookies.delete('big_dave_admin', { path: '/' });
  return redirect('/admin/login', 303);
};
