import {buildPushPayload} from '@block65/webcrypto-web-push';

const ADMIN_EMAIL = 'yukidu@gmail.com';
const SESSION_COOKIE = 'downloadstarry_session';
const APP_ID = 'downloadstarry';
const PRIMARY_PUSH_TABLE = 'downloadstarry_push_subscriptions';
const REPAIR_PUSH_TABLE = 'downloadstarry_repair_push_subscriptions';
let schemaPromise;

function json(data, status = 200) {
  return Response.json(data, {status, headers: {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }});
}

function clean(value, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
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
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function ensureSchema(env) {
  if (!env.STARRY_ID_DB) throw new Error('STARRY_ID_DB not bound');
  if (!schemaPromise) {
    schemaPromise = env.STARRY_ID_DB.batch([
      env.STARRY_ID_DB.prepare(`CREATE TABLE IF NOT EXISTS ${PRIMARY_PUSH_TABLE} (
        endpoint TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        revokedAt INTEGER
      )`),
      env.STARRY_ID_DB.prepare(`CREATE INDEX IF NOT EXISTS downloadstarry_push_user_active ON ${PRIMARY_PUSH_TABLE}(userId, revokedAt)`),
      env.STARRY_ID_DB.prepare(`CREATE TABLE IF NOT EXISTS ${REPAIR_PUSH_TABLE} (
        endpoint TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        revokedAt INTEGER
      )`),
      env.STARRY_ID_DB.prepare(`CREATE INDEX IF NOT EXISTS downloadstarry_repair_push_user_active ON ${REPAIR_PUSH_TABLE}(userId, revokedAt)`)
    ]).catch(error => {
      schemaPromise = undefined;
      throw error;
    });
  }
  await schemaPromise;
}

async function adminSession(request, env) {
  if (!env.STARRY_ID_DB) return null;
  const token = cookieToken(request);
  if (!token || token.length < 30) return null;
  const now = Date.now();
  const session = await env.STARRY_ID_DB.prepare(
    'SELECT userId, expiresAt FROM downloadstarry_sessions WHERE tokenHash = ? LIMIT 1'
  ).bind(await hash(token)).first();
  if (!session || Number(session.expiresAt || 0) <= now) return null;
  const user = await env.STARRY_ID_DB.prepare(`
    SELECT u.id, u.primaryEmail, u.status,
      EXISTS(SELECT 1 FROM app_memberships am WHERE am.userId = u.id AND am.appId = ? AND am.status = 'active' AND am.isAdminUser = 1) AS isAdmin
    FROM users u
    WHERE u.id = ?
    LIMIT 1
  `).bind(APP_ID, String(session.userId)).first();
  if (!user || String(user.status || 'active') !== 'active') return null;
  const isAdmin = Boolean(user.isAdmin) || String(user.primaryEmail || '').toLowerCase() === ADMIN_EMAIL;
  return isAdmin ? {id: String(user.id), email: String(user.primaryEmail || '')} : null;
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

function pushConfigured(env) {
  return Boolean(
    clean(env.VAPID_PUBLIC_KEY, 512) &&
    clean(env.VAPID_PRIVATE_KEY, 512) &&
    clean(env.VAPID_SUBJECT, 512)
  );
}

function subscriptionFromRow(row) {
  return {
    endpoint: String(row.endpoint),
    expirationTime: null,
    keys: {p256dh: String(row.p256dh), auth: String(row.auth)},
  };
}

function dedupeSubscriptions(rows = [], limit = 12) {
  const byEndpoint = new Map();
  for (const row of rows.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))) {
    const endpoint = String(row.endpoint || '');
    if (!endpoint || byEndpoint.has(endpoint)) continue;
    byEndpoint.set(endpoint, row);
    if (byEndpoint.size >= limit) break;
  }
  return Array.from(byEndpoint.values());
}

async function rowsForUser(env, table, userId) {
  const result = await env.STARRY_ID_DB.prepare(`
    SELECT endpoint, p256dh, auth, updatedAt
    FROM ${table}
    WHERE userId = ? AND revokedAt IS NULL
    ORDER BY updatedAt DESC
    LIMIT 12
  `).bind(String(userId)).all();
  return result.results || [];
}

async function rowsForHighestAdmin(env, table) {
  const preferred = await env.STARRY_ID_DB.prepare(`
    SELECT s.endpoint, s.p256dh, s.auth, s.updatedAt
    FROM ${table} s
    JOIN users u ON u.id = s.userId
    WHERE s.revokedAt IS NULL
      AND LOWER(COALESCE(u.primaryEmail, '')) = ?
      AND COALESCE(u.status, 'active') = 'active'
    ORDER BY s.updatedAt DESC
    LIMIT 12
  `).bind(ADMIN_EMAIL).all();
  if ((preferred.results || []).length) return preferred.results || [];

  const fallback = await env.STARRY_ID_DB.prepare(`
    SELECT s.endpoint, s.p256dh, s.auth, s.updatedAt
    FROM ${table} s
    JOIN users u ON u.id = s.userId
    WHERE s.revokedAt IS NULL
      AND COALESCE(u.status, 'active') = 'active'
      AND EXISTS(
        SELECT 1 FROM app_memberships am
        WHERE am.userId = s.userId AND am.appId = ? AND am.status = 'active' AND am.isAdminUser = 1
      )
    ORDER BY s.updatedAt DESC
    LIMIT 12
  `).bind(APP_ID).all();
  return fallback.results || [];
}

async function loadUserSubscriptions(env, userId) {
  const [primary, repair] = await Promise.all([
    rowsForUser(env, PRIMARY_PUSH_TABLE, userId),
    rowsForUser(env, REPAIR_PUSH_TABLE, userId),
  ]);
  return dedupeSubscriptions([...primary, ...repair]);
}

async function loadHighestAdminSubscriptions(env) {
  const [primary, repair] = await Promise.all([
    rowsForHighestAdmin(env, PRIMARY_PUSH_TABLE),
    rowsForHighestAdmin(env, REPAIR_PUSH_TABLE),
  ]);
  return dedupeSubscriptions([...primary, ...repair]);
}

async function markRevoked(env, endpoint) {
  const now = Date.now();
  await env.STARRY_ID_DB.batch([
    env.STARRY_ID_DB.prepare(
      `UPDATE ${PRIMARY_PUSH_TABLE} SET revokedAt = ?, updatedAt = ? WHERE endpoint = ?`
    ).bind(now, now, endpoint),
    env.STARRY_ID_DB.prepare(
      `UPDATE ${REPAIR_PUSH_TABLE} SET revokedAt = ?, updatedAt = ? WHERE endpoint = ?`
    ).bind(now, now, endpoint),
  ]).catch(() => undefined);
}

async function deliver(env, row, data) {
  const vapid = {
    subject: clean(env.VAPID_SUBJECT, 512),
    publicKey: clean(env.VAPID_PUBLIC_KEY, 512),
    privateKey: clean(env.VAPID_PRIVATE_KEY, 512),
  };
  const payload = await buildPushPayload({
    data,
    options: {ttl: 300, urgency: 'high', topic: 'downloadstarry'},
  }, subscriptionFromRow(row), vapid);
  const response = await fetch(String(row.endpoint), payload);
  if (response.status === 404 || response.status === 410) await markRevoked(env, row.endpoint);
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error(`Push HTTP ${response.status}`);
  }
  return response.ok;
}

export async function sendAdminPushNotification(env, data, targetUserId = '') {
  if (!pushConfigured(env) || !env.STARRY_ID_DB) {
    return {status: 'not_configured', sent: 0, total: 0, error: 'Web Push secrets unavailable'};
  }
  await ensureSchema(env);
  const subscriptions = targetUserId
    ? await loadUserSubscriptions(env, targetUserId)
    : await loadHighestAdminSubscriptions(env);
  let sent = 0;
  await Promise.all(subscriptions.map(async row => {
    try { if (await deliver(env, row, data)) sent += 1; }
    catch (_) {}
  }));
  if (!subscriptions.length) return {status: 'not_configured', sent: 0, total: 0, error: 'No active admin Web Push subscription'};
  return {
    status: sent ? 'sent' : 'failed',
    sent,
    total: subscriptions.length,
    error: sent ? '' : 'Web Push delivery failed',
  };
}

export async function saveReportPushState(env, reportId, result) {
  if (!env.STARRY_ID_DB || !reportId) return;
  const status = ['sent', 'failed', 'not_configured'].includes(result?.status) ? result.status : 'failed';
  const error = clean(result?.error, 180);
  await env.STARRY_ID_DB.prepare(`
    UPDATE downloadstarry_report_notifications
    SET lineStatus = ?, lineError = ?, updatedAt = ?
    WHERE reportId = ?
  `).bind(status, error, Date.now(), String(reportId)).run().catch(() => undefined);
}

export async function notifyReportCreated(env, report = {}) {
  const url = clean(report.url, 360);
  const note = clean(report.note, 220);
  const reportedAt = clean(report.reportedAt, 80);
  const body = [
    reportedAt ? `時間：${reportedAt}` : '',
    url ? `網址：${url}` : '',
    note ? `備註：${note}` : '',
  ].filter(Boolean).join('\n').slice(0, 700) || '收到一筆新的無法下載回報。';
  return sendAdminPushNotification(env, {
    title: '繁星下載｜新的回報',
    body,
    url: '/report',
    tag: 'downloadstarry-report',
  });
}

export async function handlePushRequest(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/push/')) return null;
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const admin = await adminSession(request, env).catch(() => null);
  if (!admin) return json({error: '需要管理員 Starry ID 登入'}, 401);
  await ensureSchema(env);

  if (url.pathname === '/api/push/config' && request.method === 'GET') {
    const subscriptions = await loadUserSubscriptions(env, admin.id);
    return json({
      configured: pushConfigured(env),
      publicKey: pushConfigured(env) ? clean(env.VAPID_PUBLIC_KEY, 512) : '',
      subscriptions: subscriptions.length,
    });
  }

  if (url.pathname === '/api/push/subscribe' && request.method === 'POST') {
    if (!pushConfigured(env)) return json({error: 'Web Push 金鑰尚未完成設定'}, 503);
    const body = await request.json().catch(() => ({}));
    const endpoint = clean(body?.endpoint, 4096);
    const p256dh = clean(body?.keys?.p256dh, 1024);
    const auth = clean(body?.keys?.auth, 512);
    if (!endpoint.startsWith('https://') || p256dh.length < 20 || auth.length < 8) {
      return json({error: 'Push 訂閱資料不完整'}, 400);
    }
    const now = Date.now();
    await env.STARRY_ID_DB.prepare(`
      INSERT INTO ${PRIMARY_PUSH_TABLE} (endpoint, userId, p256dh, auth, createdAt, updatedAt, revokedAt)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(endpoint) DO UPDATE SET userId=excluded.userId, p256dh=excluded.p256dh, auth=excluded.auth,
        updatedAt=excluded.updatedAt, revokedAt=NULL
    `).bind(endpoint, admin.id, p256dh, auth, now, now).run();
    return json({success: true});
  }

  if (url.pathname === '/api/push/unsubscribe' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const endpoint = clean(body?.endpoint, 4096);
    if (endpoint) await markRevoked(env, endpoint);
    return json({success: true});
  }

  if (url.pathname === '/api/push/test' && request.method === 'POST') {
    const result = await sendAdminPushNotification(env, {
      title: '繁星下載｜通知測試成功',
      body: '這支裝置已可以接收繁星下載的系統通知。',
      url: '/account',
      tag: 'downloadstarry-test',
    }, admin.id);
    return json({success: result.sent > 0, ...result}, result.sent > 0 ? 200 : 503);
  }

  return json({error: '找不到此功能'}, 404);
}
