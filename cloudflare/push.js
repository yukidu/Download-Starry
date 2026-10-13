import {buildPushPayload} from '@block65/webcrypto-web-push';

const ADMIN_EMAIL = 'yukidu@gmail.com';
const SESSION_COOKIE = 'downloadstarry_session';
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
      env.STARRY_ID_DB.prepare(`CREATE TABLE IF NOT EXISTS downloadstarry_push_subscriptions (
        endpoint TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        revokedAt INTEGER
      )`),
      env.STARRY_ID_DB.prepare('CREATE INDEX IF NOT EXISTS downloadstarry_push_user_active ON downloadstarry_push_subscriptions(userId, revokedAt)')
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
      EXISTS(SELECT 1 FROM app_memberships am WHERE am.userId = u.id AND am.status = 'active' AND am.isAdminUser = 1) AS isAdmin
    FROM users u
    WHERE u.id = ?
    LIMIT 1
  `).bind(String(session.userId)).first();
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

async function markRevoked(env, endpoint) {
  await env.STARRY_ID_DB.prepare(
    'UPDATE downloadstarry_push_subscriptions SET revokedAt = ?, updatedAt = ? WHERE endpoint = ?'
  ).bind(Date.now(), Date.now(), endpoint).run().catch(() => undefined);
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

export async function sendAdminPushNotification(env, data) {
  if (!pushConfigured(env) || !env.STARRY_ID_DB) {
    return {status: 'not_configured', sent: 0, total: 0};
  }
  await ensureSchema(env);
  const rows = await env.STARRY_ID_DB.prepare(`
    SELECT endpoint, p256dh, auth
    FROM downloadstarry_push_subscriptions
    WHERE revokedAt IS NULL
    ORDER BY updatedAt DESC
    LIMIT 12
  `).all();
  const subscriptions = rows.results || [];
  let sent = 0;
  await Promise.all(subscriptions.map(async row => {
    try { if (await deliver(env, row, data)) sent += 1; }
    catch (_) {}
  }));
  return {status: subscriptions.length ? (sent ? 'sent' : 'failed') : 'no_subscribers', sent, total: subscriptions.length};
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
    const count = await env.STARRY_ID_DB.prepare(
      'SELECT COUNT(*) AS count FROM downloadstarry_push_subscriptions WHERE userId = ? AND revokedAt IS NULL'
    ).bind(admin.id).first();
    return json({
      configured: pushConfigured(env),
      publicKey: pushConfigured(env) ? clean(env.VAPID_PUBLIC_KEY, 512) : '',
      subscriptions: Number(count?.count || 0),
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
      INSERT INTO downloadstarry_push_subscriptions (endpoint, userId, p256dh, auth, createdAt, updatedAt, revokedAt)
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
    });
    return json({success: result.sent > 0, ...result}, result.sent > 0 ? 200 : 503);
  }

  return json({error: '找不到此功能'}, 404);
}
