import type { APIRoute } from 'astro';
import { CUSTOMER_HINT_COOKIE } from '../../../lib/customer-auth';
export const prerender = false;
export const POST: APIRoute = ({ cookies, redirect }) => {
  cookies.delete('big_dave_customer', { path: '/' });
  // Cleared together with the session, or the bar would keep offering "My Account".
  cookies.delete(CUSTOMER_HINT_COOKIE, { path: '/' });
  return redirect('/', 303);
};
