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
      db.prepare('CREATE INDEX IF NOT EXISTS downloadstarry_history_user_created ON downloadstarry_history(userId, createdAt DESC)')
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

export async function recordDownloadStart(request, env, result = {}) {
  try {
    const userId = await sessionUserId(request, env);
    if (!userId) return {recorded: false, reason: 'guest'};
    const form = await request.formData();
    const url = clean(form.get('url'), 2048);
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
    return {recorded: true};
  } catch (error) {
    console.warn('Download Starry history write skipped', {
      code: error instanceof Error ? error.message : 'unknown'
    });
    return {recorded: false, reason: 'error'};
  }
}

export async function handleDownloadHistoryRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/download-history') return null;
  if (request.method.toUpperCase() !== 'GET') return json({error: 'Method not allowed'}, 405);
  if (!env.STARRY_ID_DB) return json({error: '下載紀錄服務尚未連線'}, 503);
  const userId = await sessionUserId(request, env);
  if (!userId) return json({error: '請先登入 Starry ID'}, 401);
  const rows = await env.STARRY_ID_DB.prepare(`
    SELECT id,jobId,url,type,quality,subtitle,createdAt
    FROM downloadstarry_history
    WHERE userId = ?
    ORDER BY createdAt DESC
    LIMIT 100
  `).bind(userId).all();
  return json({history: rows?.results || []});
}
