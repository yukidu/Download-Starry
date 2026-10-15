const encoder = new TextEncoder();
const SESSION_COOKIE = 'downloadstarry_session';
const SUPER_ADMIN_EMAIL = 'yukidu@gmail.com';
const schemaReady = new WeakMap();

function json(data, status = 200) {
  return Response.json(data, {status, headers: {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }});
}

function cookieToken(request) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return rest.join('=').trim();
  }
  return '';
}

async function hash(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function ensureMetadataSchema(env) {
  if (!env.STARRY_ID_DB) throw new Error('STARRY_ID_DB not bound');
  const db = env.STARRY_ID_DB;
  if (!schemaReady.has(db)) {
    const task = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS downloadstarry_url_metadata (
        userId TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        thumbnail TEXT NOT NULL DEFAULT '',
        updatedAt INTEGER NOT NULL,
        PRIMARY KEY (userId, url)
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS downloadstarry_url_metadata_user_updated ON downloadstarry_url_metadata(userId, updatedAt DESC)')
    ]);
    schemaReady.set(db, task);
    task.catch(() => schemaReady.delete(db));
  }
  await schemaReady.get(db);
}

async function sessionMember(request, env) {
  if (!env.STARRY_ID_DB) return null;
  const token = cookieToken(request);
  if (!token || token.length < 30) return null;
  const row = await env.STARRY_ID_DB.prepare(`
    SELECT s.userId, s.expiresAt, u.primaryEmail, u.status
    FROM downloadstarry_sessions s
    JOIN users u ON u.id = s.userId
    WHERE s.tokenHash = ?
    LIMIT 1
  `).bind(await hash(token)).first();
  if (!row || Number(row.expiresAt || 0) <= Date.now() || String(row.status || 'active') !== 'active') return null;
  return {
    id: String(row.userId || ''),
    email: String(row.primaryEmail || '').trim().toLowerCase(),
  };
}

export async function isDownloadStarrySuperAdmin(request, env) {
  const member = await sessionMember(request, env).catch(() => null);
  return Boolean(member?.id && member.email === SUPER_ADMIN_EMAIL);
}

export async function requireDownloadStarrySuperAdmin(request, env, {redirect = false} = {}) {
  if (await isDownloadStarrySuperAdmin(request, env)) return null;
  if (redirect) return Response.redirect(`${new URL(request.url).origin}/`, 302);
  return json({error: '只有超級管理員可使用此功能'}, 403);
}

export async function handleAdminReportList(request, env) {
  if (request.method !== 'GET' || new URL(request.url).pathname !== '/api/reports') return null;
  const rejected = await requireDownloadStarrySuperAdmin(request, env);
  if (rejected) return rejected;
  await ensureMetadataSchema(env);
  const {results} = await env.STARRY_ID_DB.prepare(`
    SELECT r.id, r.source, r.url, r.reportedAt, r.note, r.status, r.createdAt, r.updatedAt,
      r.resolvedBy, r.resolvedAt, r.userId, u.primaryEmail AS email,
      p.name, p.center, p.rank, p.approvedRank,
      n.emailStatus, n.lineStatus,
      COALESCE(m.title, '') AS title,
      COALESCE(m.thumbnail, '') AS thumbnail
    FROM downloadstarry_reports r
    LEFT JOIN users u ON u.id = r.userId
    LEFT JOIN profiles p ON p.userId = r.userId
    LEFT JOIN downloadstarry_report_notifications n ON n.reportId = r.id
    LEFT JOIN downloadstarry_url_metadata m ON m.userId = r.userId AND m.url = r.url
    ORDER BY CASE r.status WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, r.createdAt DESC
    LIMIT 300
  `).all();
  return json({reports: results || []});
}
