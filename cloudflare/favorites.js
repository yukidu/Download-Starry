const encoder = new TextEncoder();
const SESSION_COOKIE = 'downloadstarry_session';
const schemaReady = new WeakMap();

function json(data, status = 200) {
  return Response.json(data, {status, headers: {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }});
}

async function hash(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
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
      db.prepare(`CREATE TABLE IF NOT EXISTS downloadstarry_favorites (
        userId TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        thumbnail TEXT NOT NULL DEFAULT '',
        platform TEXT NOT NULL DEFAULT '',
        duration INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        PRIMARY KEY (userId, url)
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS downloadstarry_favorites_user_updated ON downloadstarry_favorites(userId, updatedAt DESC)')
    ]);
    schemaReady.set(db, task);
    task.catch(() => schemaReady.delete(db));
  }
  await schemaReady.get(db);
}

export async function authenticatedDownloadStarryMember(request, env) {
  if (!env.STARRY_ID_DB) return null;
  const token = cookieToken(request);
  if (!token || token.length < 30) return null;
  const tokenHash = await hash(token);
  const now = Date.now();
  const row = await env.STARRY_ID_DB.prepare(`
    SELECT s.userId, s.expiresAt, u.status
    FROM downloadstarry_sessions s
    LEFT JOIN users u ON u.id = s.userId
    WHERE s.tokenHash = ?
    LIMIT 1
  `).bind(tokenHash).first();
  if (!row || Number(row.expiresAt || 0) <= now || String(row.status || 'active') !== 'active') return null;
  return {id: String(row.userId || '')};
}

function clean(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function validUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

export async function handleFavoritesRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/favorites') return null;
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  await ensureSchema(env);
  const member = await authenticatedDownloadStarryMember(request, env);
  if (!member?.id) return json({error: '請先登入 Starry ID'}, 401);

  if (request.method === 'GET') {
    const sourceUrl = validUrl(url.searchParams.get('url') || '');
    if (sourceUrl) {
      const row = await env.STARRY_ID_DB.prepare(`
        SELECT url, title, thumbnail, platform, duration, createdAt, updatedAt
        FROM downloadstarry_favorites WHERE userId = ? AND url = ? LIMIT 1
      `).bind(member.id, sourceUrl).first();
      return json({favorite: Boolean(row), item: row || null});
    }
    const {results} = await env.STARRY_ID_DB.prepare(`
      SELECT url, title, thumbnail, platform, duration, createdAt, updatedAt
      FROM downloadstarry_favorites WHERE userId = ? ORDER BY updatedAt DESC LIMIT 200
    `).bind(member.id).all();
    return json({favorites: results || []});
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const sourceUrl = validUrl(body.url || '');
    if (!sourceUrl) return json({error: '收藏網址格式不正確'}, 400);
    const now = Date.now();
    await env.STARRY_ID_DB.prepare(`
      INSERT INTO downloadstarry_favorites (userId, url, title, thumbnail, platform, duration, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(userId, url) DO UPDATE SET
        title=excluded.title, thumbnail=excluded.thumbnail, platform=excluded.platform,
        duration=excluded.duration, updatedAt=excluded.updatedAt
    `).bind(
      member.id,
      sourceUrl,
      clean(body.title, 300),
      clean(body.thumbnail, 2000),
      clean(body.platform, 80),
      Math.max(0, Math.floor(Number(body.duration) || 0)),
      now,
      now,
    ).run();
    return json({success: true, favorite: true});
  }

  if (request.method === 'DELETE') {
    const body = await request.json().catch(() => ({}));
    const sourceUrl = validUrl(body.url || url.searchParams.get('url') || '');
    if (!sourceUrl) return json({error: '收藏網址格式不正確'}, 400);
    await env.STARRY_ID_DB.prepare('DELETE FROM downloadstarry_favorites WHERE userId = ? AND url = ?')
      .bind(member.id, sourceUrl).run();
    return json({success: true, favorite: false});
  }

  return json({error: '不支援此操作'}, 405);
}
