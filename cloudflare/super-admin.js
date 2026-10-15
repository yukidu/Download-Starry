const SESSION_COOKIE = 'downloadstarry_session';
const SUPER_ADMIN_EMAIL = 'yukidu@gmail.com';

function cookieToken(request) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return rest.join('=').trim();
  }
  return '';
}

async function hash(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function isSuperAdminRequest(request, env) {
  if (!env.STARRY_ID_DB) return false;
  const token = cookieToken(request);
  if (!token || token.length < 30) return false;
  try {
    const row = await env.STARRY_ID_DB.prepare(`
      SELECT u.primaryEmail, u.status, s.expiresAt
      FROM downloadstarry_sessions s
      JOIN users u ON u.id = s.userId
      WHERE s.tokenHash = ?
      LIMIT 1
    `).bind(await hash(token)).first();
    if (!row || Number(row.expiresAt || 0) <= Date.now()) return false;
    if (String(row.status || 'active') !== 'active') return false;
    return String(row.primaryEmail || '').trim().toLowerCase() === SUPER_ADMIN_EMAIL;
  } catch (_) {
    return false;
  }
}
