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

/** The one shared credential from ADMIN_USER/ADMIN_PASSWORD - unchanged since this existed alone. */
export async function createAdminSession(secret: string) {
  const expires = Math.floor(Date.now() / 1000) + adminSessionMaxAge;
  const value = `admin.${expires}`;
  return `${value}.${await signature(value, secret)}`;
}

/**
 * A login the master admin created in `staff_accounts`. Same cookie name and gate as
 * master, a different token shape so the two can never be confused for each other by
 * anything reading a cookie's role field alone.
 *
 * This proves the token was legitimately issued for this id and hasn't expired - it does
 * not prove the id is still a staff member today. Deleting a staff row doesn't invalidate
 * an outstanding cookie by itself; whatever calls validAdminSession for a `staff` result
 * is expected to check the row still exists (src/middleware.ts does this).
 */
export async function createStaffSession(staffId: number, secret: string) {
  const expires = Math.floor(Date.now() / 1000) + adminSessionMaxAge;
  const value = `staff.${staffId}.${expires}`;
  return `${value}.${await signature(value, secret)}`;
}

export type AdminIdentity = { role: 'master' } | { role: 'staff'; id: number };

export async function validAdminSession(
  cookie: string | undefined,
  secret: string | undefined,
): Promise<AdminIdentity | null> {
  if (!cookie || !secret) return null;
  const parts = cookie.split('.');

  if (parts.length === 3) {
    const [role, expires, suppliedSignature] = parts;
    if (role !== 'admin' || !expires || !suppliedSignature) return null;
    if (Number(expires) < Date.now() / 1000) return null;
    const expected = await signature(`${role}.${expires}`, secret);
    return expected === suppliedSignature ? { role: 'master' } : null;
  }

  if (parts.length === 4) {
    const [role, idRaw, expires, suppliedSignature] = parts;
    const id = Number(idRaw);
    if (role !== 'staff' || !Number.isInteger(id) || id <= 0 || !expires || !suppliedSignature) {
      return null;
    }
    if (Number(expires) < Date.now() / 1000) return null;
    const expected = await signature(`${role}.${idRaw}.${expires}`, secret);
    return expected === suppliedSignature ? { role: 'staff', id } : null;
  }

  return null;
}
