import type { APIRoute } from 'astro';
export const prerender = false;
export const POST: APIRoute = ({ cookies, redirect }) => {
  cookies.delete('big_dave_customer', { path: '/' });
  return redirect('/', 303);
};
