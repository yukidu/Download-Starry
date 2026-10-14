const encoder = new TextEncoder();
const SESSION_COOKIE = 'downloadstarry_session';
const schemaReady = new WeakMap();

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
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

function clean(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function httpUrl(value, max = 4096) {
  const url = clean(value, max);
  return /^https?:\/\//i.test(url) ? url : '';
}

async function ensureSchema(env) {
  if (!env.STARRY_ID_DB) throw new Error('STARRY_ID_DB not bound');
  const db = env.STARRY_ID_DB;
  if (!schemaReady.has(db)) {
    const task = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS downloadstarry_history (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        jobId TEXT NOT NULL DEFAULT '',
        url TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL DEFAULT '',
        quality TEXT NOT NULL DEFAULT '',
        subtitle TEXT NOT NULL DEFAULT '',
        createdAt INTEGER NOT NULL
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS downloadstarry_history_user_created ON downloadstarry_history(userId, createdAt DESC)'),
      db.prepare(`CREATE TABLE IF NOT EXISTS downloadstarry_url_metadata (
        userId TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        thumbnail TEXT NOT NULL DEFAULT '',
        updatedAt INTEGER NOT NULL,
        PRIMARY KEY (userId, url)
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS downloadstarry_url_metadata_user_updated ON downloadstarry_url_metadata(userId, updatedAt DESC)'),
      db.prepare(`CREATE TABLE IF NOT EXISTS downloadstarry_report_repair_watch (
        reportId TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        notifiedAt INTEGER,
        notifyStatus TEXT NOT NULL DEFAULT 'pending',
        notifyError TEXT NOT NULL DEFAULT ''
      )`)
    ]).catch(error => {
      schemaReady.delete(db);
      throw error;
    });
    schemaReady.set(db, task);
  }
  await schemaReady.get(db);
}

async function sessionUserId(request, env) {
  if (!env.STARRY_ID_DB) return '';
  await ensureSchema(env);
  const token = cookieToken(request);
  if (!token || token.length < 30) return '';
  const tokenHash = await hash(token);
  const row = await env.STARRY_ID_DB.prepare(`
    SELECT s.userId
    FROM downloadstarry_sessions s
    JOIN users u ON u.id = s.userId AND u.status = 'active'
    JOIN app_memberships am ON am.userId = s.userId AND am.appId = 'downloadstarry' AND am.status = 'active'
    WHERE s.tokenHash = ? AND s.expiresAt > ?
    LIMIT 1
  `).bind(tokenHash, Date.now()).first();
  return clean(row?.userId, 160);
}

async function upsertMetadata(env, userId, url, title, thumbnail) {
  const safeUrl = httpUrl(url);
  const safeTitle = clean(title, 500);
  const safeThumbnail = httpUrl(thumbnail, 4096);
  if (!userId || !safeUrl || (!safeTitle && !safeThumbnail)) return false;
  await env.STARRY_ID_DB.prepare(`
    INSERT INTO downloadstarry_url_metadata (userId,url,title,thumbnail,updatedAt)
    VALUES (?,?,?,?,?)
    ON CONFLICT(userId,url) DO UPDATE SET
      title=CASE WHEN excluded.title <> '' THEN excluded.title ELSE downloadstarry_url_metadata.title END,
      thumbnail=CASE WHEN excluded.thumbnail <> '' THEN excluded.thumbnail ELSE downloadstarry_url_metadata.thumbnail END,
      updatedAt=excluded.updatedAt
  `).bind(userId, safeUrl, safeTitle, safeThumbnail, Date.now()).run();
  return true;
}

export async function recordDownloadStart(request, env, result = {}) {
  try {
    const userId = await sessionUserId(request, env);
    if (!userId) return {recorded: false, reason: 'guest'};
    const form = await request.formData();
    const url = httpUrl(form.get('url'));
    const type = clean(form.get('type'), 40);
    if (!url || !type) return {recorded: false, reason: 'missing_data'};
    await env.STARRY_ID_DB.prepare(`
      INSERT INTO downloadstarry_history (id,userId,jobId,url,type,quality,subtitle,createdAt)
      VALUES (?,?,?,?,?,?,?,?)
    `).bind(
      crypto.randomUUID(),
      userId,
      clean(result?.job_id || result?.jobId, 160),
      url,
      type,
      clean(form.get('quality'), 80),
      clean(form.get('subtitle'), 120),
      Date.now()
    ).run();
    await upsertMetadata(env, userId, url, form.get('title'), form.get('thumbnail')).catch(() => undefined);
    return {recorded: true};
  } catch (error) {
    console.warn('Download Starry history write skipped', {
      code: error instanceof Error ? error.message : 'unknown'
    });
    return {recorded: false, reason: 'error'};
  }
}

async function saveMetadataRequest(request, env) {
  const userId = await sessionUserId(request, env);
  if (!userId) return json({error: '請先登入 Starry ID'}, 401);
  const body = await request.json().catch(() => ({}));
  const url = httpUrl(body.url);
  if (!url) return json({error: '網址格式不正確'}, 400);
  const saved = await upsertMetadata(env, userId, url, body.title, body.thumbnail);
  return json({success: true, saved});
}

export async function handleDownloadHistoryRequest(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/download-history')) return null;
  if (!env.STARRY_ID_DB) return json({error: '下載紀錄服務尚未連線'}, 503);
  await ensureSchema(env);

  if (url.pathname === '/api/download-history/metadata') {
    if (request.method.toUpperCase() !== 'POST') return json({error: 'Method not allowed'}, 405);
    return saveMetadataRequest(request, env);
  }

  if (url.pathname !== '/api/download-history') return json({error: '找不到下載紀錄服務'}, 404);
  if (request.method.toUpperCase() !== 'GET') return json({error: 'Method not allowed'}, 405);
  const userId = await sessionUserId(request, env);
  if (!userId) return json({error: '請先登入 Starry ID'}, 401);
  const rows = await env.STARRY_ID_DB.prepare(`
    SELECT id,jobId,url,type,quality,subtitle,title,thumbnail,createdAt,recordKind,status,watching,notifyStatus
    FROM (
      SELECT h.id,h.jobId,h.url,h.type,h.quality,h.subtitle,
        COALESCE(m.title,'') AS title,COALESCE(m.thumbnail,'') AS thumbnail,
        h.createdAt,'download' AS recordKind,'' AS status,0 AS watching,'' AS notifyStatus
      FROM downloadstarry_history h
      LEFT JOIN downloadstarry_url_metadata m ON m.userId = h.userId AND m.url = h.url
      WHERE h.userId = ?
      UNION ALL
      SELECT r.id,'' AS jobId,r.url,'report' AS type,'' AS quality,'' AS subtitle,
        COALESCE(m.title,'') AS title,COALESCE(m.thumbnail,'') AS thumbnail,
        r.createdAt,'report' AS recordKind,r.status,
        CASE WHEN w.enabled = 1 THEN 1 ELSE 0 END AS watching,
        COALESCE(w.notifyStatus,'') AS notifyStatus
      FROM downloadstarry_reports r
      LEFT JOIN downloadstarry_url_metadata m ON m.userId = r.userId AND m.url = r.url
      LEFT JOIN downloadstarry_report_repair_watch w ON w.reportId = r.id AND w.userId = r.userId
      WHERE r.userId = ? AND r.url <> ''
    )
    ORDER BY createdAt DESC
    LIMIT 100
  `).bind(userId, userId).all();
  return json({history: rows?.results || []});
}
