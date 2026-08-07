const encoder = new TextEncoder();
export const adminSessionMaxAge = 60 * 60 * 12;

async function signature(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const buffer = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(buffer), (part) => part.toString(16).padStart(2, '0')).join('');
}

export async function createAdminSession(secret: string) {
  const expires = Math.floor(Date.now() / 1000) + adminSessionMaxAge;
  const value = `admin.${expires}`;
  return `${value}.${await signature(value, secret)}`;
}

export async function validAdminSession(cookie: string | undefined, secret: string | undefined) {
  if (!cookie || !secret) return false;
  const [role, expires, suppliedSignature] = cookie.split('.');
  if (role !== 'admin' || !expires || !suppliedSignature || Number(expires) < Date.now() / 1000)
    return false;
  return suppliedSignature === (await signature(`${role}.${expires}`, secret));
}
