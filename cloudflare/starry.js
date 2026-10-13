const encoder = new TextEncoder();
const SESSION_COOKIE = 'downloadstarry_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ECHO_STARRY_ORIGIN = 'https://echo.starry.phd';
const schemaReady = new WeakMap();

async function hash(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {status, headers: {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  }});
}

function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; Priority=High`;
}

function clearedCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Priority=High`;
}

function cookieToken(request) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return rest.join('=').trim();
  }
  return '';
}

function rejectCrossSite(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return null;
  const origin = request.headers.get('Origin');
  const ownOrigin = new URL(request.url).origin;
  if ((origin && origin !== ownOrigin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    return json({error: '不接受來自其他網站的操作'}, 403);
  }
  return null;
}

async function ensureSchema(env) {
  if (!env.STARRY_ID_DB) throw new Error('STARRY_ID_DB not bound');
  const db = env.STARRY_ID_DB;
  if (!schemaReady.has(db)) {
    const task = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS downloadstarry_sessions (
        tokenHash TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        expiresAt INTEGER NOT NULL,
        createdAt INTEGER NOT NULL
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS downloadstarry_sessions_user ON downloadstarry_sessions(userId)'),
      db.prepare('CREATE INDEX IF NOT EXISTS downloadstarry_sessions_expiry ON downloadstarry_sessions(expiresAt)'),
      db.prepare(`CREATE TABLE IF NOT EXISTS downloadstarry_reports (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        source TEXT NOT NULL,
        url TEXT NOT NULL DEFAULT '',
        reportedAt TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'new',
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        resolvedBy TEXT,
        resolvedAt INTEGER
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS downloadstarry_reports_status_created ON downloadstarry_reports(status, createdAt DESC)'),
      db.prepare('CREATE INDEX IF NOT EXISTS downloadstarry_reports_user_created ON downloadstarry_reports(userId, createdAt DESC)')
    ]);
    schemaReady.set(db, task);
    task.catch(() => schemaReady.delete(db));
  }
  await schemaReady.get(db);
}

async function centralMember(db, userId) {
  return db.prepare(`
    SELECT u.id, u.primaryEmail, u.status,
      p.name, p.avatar, p.googleAvatar, p.center, p.rank, p.approvedRank,
      p.rankApproved, p.residence, p.birthday, p.motto,
      EXISTS(SELECT 1 FROM app_memberships am WHERE am.userId = u.id AND am.status = 'active' AND am.isAdminUser = 1) AS isAdmin
    FROM users u
    LEFT JOIN profiles p ON p.userId = u.id
    WHERE u.id = ?
    LIMIT 1
  `).bind(userId).first();
}

function publicMember(row) {
  return {
    id: String(row.id || ''),
    email: String(row.primaryEmail || ''),
    name: String(row.name || row.primaryEmail || '會員'),
    avatar: String(row.avatar || row.googleAvatar || ''),
    center: String(row.center || ''),
    rank: String(row.approvedRank || row.rank || ''),
    rankApproved: Boolean(row.rankApproved),
    residence: String(row.residence || ''),
    birthday: String(row.birthday || ''),
    motto: String(row.motto || ''),
    isAdmin: Boolean(row.isAdmin) || String(row.primaryEmail || '').toLowerCase() === 'yukidu@gmail.com'
  };
}

async function sessionMember(request, env) {
  if (!env.STARRY_ID_DB) return null;
  await ensureSchema(env);
  const token = cookieToken(request);
  if (!token || token.length < 30) return null;
  const tokenHash = await hash(token);
  const now = Date.now();
  const session = await env.STARRY_ID_DB.prepare(
    'SELECT userId, expiresAt FROM downloadstarry_sessions WHERE tokenHash = ? LIMIT 1'
  ).bind(tokenHash).first();
  if (!session || Number(session.expiresAt || 0) <= now) {
    if (session) await env.STARRY_ID_DB.prepare('DELETE FROM downloadstarry_sessions WHERE tokenHash = ?').bind(tokenHash).run().catch(() => undefined);
    return null;
  }
  const member = await centralMember(env.STARRY_ID_DB, String(session.userId));
  if (!member || String(member.status || 'active') !== 'active') return null;
  return {...publicMember(member), __tokenHash: tokenHash};
}

async function createAppSession(env, userId) {
  await ensureSchema(env);
  const db = env.STARRY_ID_DB;
  const token = randomToken();
  const tokenHash = await hash(token);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  await db.batch([
    db.prepare('DELETE FROM downloadstarry_sessions WHERE expiresAt <= ?').bind(now),
    db.prepare('INSERT INTO downloadstarry_sessions (tokenHash, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?)')
      .bind(tokenHash, userId, expiresAt, now),
    db.prepare(`INSERT INTO app_memberships
      (userId, appId, status, role, isAdminUser, isContributor, canUpload, joinedAt, updatedAt)
      VALUES (?, 'downloadstarry', 'active', 'member', 0, 0, 0, ?, ?)
      ON CONFLICT(userId, appId) DO UPDATE SET status = 'active', updatedAt = excluded.updatedAt`)
      .bind(userId, now, now)
  ]);
  return {token, expiresAt};
}

async function callback(request, env) {
  if (!env.STARRY_ID_DB) return Response.redirect(`${new URL(request.url).origin}/?starry=unavailable`, 302);
  const code = new URL(request.url).searchParams.get('code')?.trim() || '';
  if (!code) return Response.redirect(`${new URL(request.url).origin}/?starry=error`, 302);
  try {
    const response = await fetch(`${ECHO_STARRY_ORIGIN}/api/auth/downloadstarry-exchange`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({code})
    });
    const data = await response.json().catch(() => ({}));
    const userId = String(data?.user?.id || '');
    if (!response.ok || !userId) return Response.redirect(`${new URL(request.url).origin}/?starry=error`, 302);

    await ensureSchema(env);
    const member = await centralMember(env.STARRY_ID_DB, userId);
    if (!member || String(member.status || 'active') !== 'active') {
      return Response.redirect(`${new URL(request.url).origin}/?starry=error`, 302);
    }
    const session = await createAppSession(env, userId);
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${new URL(request.url).origin}/?starry=login`,
        'Set-Cookie': sessionCookie(session.token),
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer'
      }
    });
  } catch {
    return Response.redirect(`${new URL(request.url).origin}/?starry=error`, 302);
  }
}

async function logout(request, env) {
  const token = cookieToken(request);
  if (token && env.STARRY_ID_DB) {
    await ensureSchema(env);
    await env.STARRY_ID_DB.prepare('DELETE FROM downloadstarry_sessions WHERE tokenHash = ?')
      .bind(await hash(token)).run().catch(() => undefined);
  }
  return json({success: true}, 200, {'Set-Cookie': clearedCookie()});
}

function cleanText(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

async function createReport(request, env, member) {
  const body = await request.json().catch(() => ({}));
  const source = body.source === 'parsed' ? 'parsed' : 'manual';
  const url = cleanText(body.url, 4096);
  const reportedAt = cleanText(body.reportedAt, 64);
  const note = cleanText(body.note, 2000);
  if (source === 'parsed' && !url) return json({error: '缺少目前網址'}, 400);
  if (!reportedAt) return json({error: '請填寫日期時間'}, 400);
  const now = Date.now();
  const id = crypto.randomUUID();
  await env.STARRY_ID_DB.prepare(`INSERT INTO downloadstarry_reports
    (id, userId, source, url, reportedAt, note, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?)`)
    .bind(id, member.id, source, url, reportedAt, note, now, now).run();
  return json({success: true, id, status: 'new'});
}

async function listReports(env) {
  const {results} = await env.STARRY_ID_DB.prepare(`
    SELECT r.id, r.source, r.url, r.reportedAt, r.note, r.status, r.createdAt, r.updatedAt,
      r.resolvedBy, r.resolvedAt, u.id AS userId, u.primaryEmail AS email,
      p.name, p.center, p.rank, p.approvedRank
    FROM downloadstarry_reports r
    JOIN users u ON u.id = r.userId
    LEFT JOIN profiles p ON p.userId = r.userId
    ORDER BY CASE r.status WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, r.createdAt DESC
    LIMIT 300
  `).all();
  return json({reports: results || []});
}

async function updateReport(request, env, member, reportId) {
  const body = await request.json().catch(() => ({}));
  const status = ['new', 'in_progress', 'resolved'].includes(body.status) ? body.status : '';
  if (!status) return json({error: '無效的處理狀態'}, 400);
  const now = Date.now();
  const result = await env.STARRY_ID_DB.prepare(`UPDATE downloadstarry_reports SET
    status = ?, updatedAt = ?, resolvedBy = ?, resolvedAt = ? WHERE id = ?`)
    .bind(status, now, status === 'resolved' ? member.id : null, status === 'resolved' ? now : null, reportId).run();
  if (!result.meta?.changes) return json({error: '找不到回報'}, 404);
  return json({success: true, status});
}

export async function handleStarryRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();
  const isStarryPath = path === '/auth/callback' || path.startsWith('/api/auth/starry/') || path === '/api/reports' || /^\/api\/reports\/[^/]+\/status$/.test(path);
  if (!isStarryPath) return null;

  if (path === '/api/auth/starry/login' && method === 'GET') {
    return Response.redirect(`${ECHO_STARRY_ORIGIN}/auth/downloadstarry`, 302);
  }
  if (path === '/auth/callback' && method === 'GET') return callback(request, env);

  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  if (!env.STARRY_ID_DB) return json({error: 'Starry ID 中央會員服務尚未連線'}, 503);
  await ensureSchema(env);

  if (path === '/api/auth/starry/session' && method === 'GET') {
    const member = await sessionMember(request, env);
    if (!member) return json({authenticated: false}, 401);
    const {__tokenHash, ...user} = member;
    return json({authenticated: true, user});
  }
  if (path === '/api/auth/starry/logout' && method === 'POST') return logout(request, env);

  const member = await sessionMember(request, env);
  if (!member) return json({error: '請先登入 Starry ID'}, 401);

  if (path === '/api/reports' && method === 'POST') return createReport(request, env, member);
  if (path === '/api/reports' && method === 'GET') {
    if (!member.isAdmin) return json({error: '只有管理員可查看回報'}, 403);
    return listReports(env);
  }
  const statusMatch = path.match(/^\/api\/reports\/([^/]+)\/status$/);
  if (statusMatch && method === 'POST') {
    if (!member.isAdmin) return json({error: '只有管理員可處理回報'}, 403);
    return updateReport(request, env, member, decodeURIComponent(statusMatch[1]));
  }
  return json({error: '找不到此功能'}, 404);
}
