import {buildPushPayload} from '@block65/webcrypto-web-push';

const ADMIN_EMAIL = 'yukidu@gmail.com';
const SESSION_COOKIE = 'downloadstarry_session';
const schemaReady = new WeakMap();

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
      db.prepare(`CREATE TABLE IF NOT EXISTS downloadstarry_repair_push_subscriptions (
        endpoint TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        revokedAt INTEGER
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS downloadstarry_repair_push_user_active ON downloadstarry_repair_push_subscriptions(userId, revokedAt)'),
      db.prepare(`CREATE TABLE IF NOT EXISTS downloadstarry_report_repair_watch (
        reportId TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        notifiedAt INTEGER,
        notifyStatus TEXT NOT NULL DEFAULT 'pending',
        notifyError TEXT NOT NULL DEFAULT ''
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS downloadstarry_repair_watch_user ON downloadstarry_report_repair_watch(userId, enabled)')
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
  return {
    id: String(user.id),
    email: String(user.primaryEmail || ''),
    isAdmin: Boolean(user.isAdmin) || String(user.primaryEmail || '').toLowerCase() === ADMIN_EMAIL,
  };
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

async function markRevoked(env, endpoint, userId = '') {
  const sql = userId
    ? 'UPDATE downloadstarry_repair_push_subscriptions SET revokedAt = ?, updatedAt = ? WHERE endpoint = ? AND userId = ?'
    : 'UPDATE downloadstarry_repair_push_subscriptions SET revokedAt = ?, updatedAt = ? WHERE endpoint = ?';
  const statement = env.STARRY_ID_DB.prepare(sql);
  const now = Date.now();
  const bound = userId ? statement.bind(now, now, endpoint, userId) : statement.bind(now, now, endpoint);
  await bound.run().catch(() => undefined);
}

async function deliver(env, row, data) {
  const vapid = {
    subject: clean(env.VAPID_SUBJECT, 512),
    publicKey: clean(env.VAPID_PUBLIC_KEY, 512),
    privateKey: clean(env.VAPID_PRIVATE_KEY, 512),
  };
  const payload = await buildPushPayload({
    data,
    options: {ttl: 3600, urgency: 'high', topic: 'downloadstarry-repair'},
  }, subscriptionFromRow(row), vapid);
  const response = await fetch(String(row.endpoint), payload);
  if (response.status === 404 || response.status === 410) await markRevoked(env, String(row.endpoint));
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error(`Push HTTP ${response.status}`);
  }
  return response.ok;
}

export async function sendRepairPushToUser(env, userId, data) {
  if (!pushConfigured(env) || !env.STARRY_ID_DB) {
    return {status: 'not_configured', sent: 0, total: 0, error: 'Web Push secrets unavailable'};
  }
  await ensureSchema(env);
  const rows = await env.STARRY_ID_DB.prepare(`
    SELECT endpoint, p256dh, auth
    FROM downloadstarry_repair_push_subscriptions
    WHERE userId = ? AND revokedAt IS NULL
    ORDER BY updatedAt DESC
    LIMIT 8
  `).bind(String(userId)).all();
  const subscriptions = rows.results || [];
  if (!subscriptions.length) {
    return {status: 'not_configured', sent: 0, total: 0, error: 'No active repair notification subscription'};
  }
  let sent = 0;
  await Promise.all(subscriptions.map(async row => {
    try { if (await deliver(env, row, data)) sent += 1; }
    catch (_) {}
  }));
  return {
    status: sent ? 'sent' : 'failed',
    sent,
    total: subscriptions.length,
    error: sent ? '' : 'Web Push delivery failed',
  };
}

export async function enforceMemberReport(request, env) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  if (!env.STARRY_ID_DB) return json({error: 'Starry ID 中央會員服務尚未連線'}, 503);
  const member = await sessionMember(request, env).catch(() => null);
  if (!member) return json({error: '回報無法下載只提供給註冊會員使用'}, 401);
  return null;
}

async function saveWatch(env, member, reportId) {
  const report = await env.STARRY_ID_DB.prepare(
    'SELECT id, userId, status FROM downloadstarry_reports WHERE id = ? LIMIT 1'
  ).bind(reportId).first();
  if (!report) return json({error: '找不到這筆回報'}, 404);
  if (String(report.userId || '') !== member.id) return json({error: '這不是你的回報'}, 403);
  if (String(report.status || '') === 'resolved') return json({error: '這筆回報已經修復完成'}, 409);
  const now = Date.now();
  await env.STARRY_ID_DB.prepare(`
    INSERT INTO downloadstarry_report_repair_watch
      (reportId, userId, enabled, createdAt, updatedAt, notifiedAt, notifyStatus, notifyError)
    VALUES (?, ?, 1, ?, ?, NULL, 'pending', '')
    ON CONFLICT(reportId) DO UPDATE SET
      userId=excluded.userId, enabled=1, updatedAt=excluded.updatedAt,
      notifiedAt=NULL, notifyStatus='pending', notifyError=''
  `).bind(reportId, member.id, now, now).run();
  return json({success: true, watching: true});
}

async function updateStatus(env, member, reportId, status) {
  if (!member.isAdmin) return json({error: '只有管理員可處理回報'}, 403);
  if (!['new', 'in_progress', 'resolved'].includes(status)) return json({error: '無效的處理狀態'}, 400);
  const now = Date.now();
  const result = await env.STARRY_ID_DB.prepare(`UPDATE downloadstarry_reports SET
    status = ?, updatedAt = ?, resolvedBy = ?, resolvedAt = ? WHERE id = ?`)
    .bind(status, now, status === 'resolved' ? member.id : null, status === 'resolved' ? now : null, reportId).run();
  if (!result.meta?.changes) return json({error: '找不到回報'}, 404);

  let repairNotification = {status: 'not_requested', sent: 0};
  if (status === 'resolved') {
    const watched = await env.STARRY_ID_DB.prepare(`
      SELECT w.userId, w.notifiedAt, r.url
      FROM downloadstarry_report_repair_watch w
      JOIN downloadstarry_reports r ON r.id = w.reportId
      WHERE w.reportId = ? AND w.enabled = 1
      LIMIT 1
    `).bind(reportId).first();
    if (watched?.userId) {
      if (Number(watched.notifiedAt || 0) > 0) {
        repairNotification = {status: 'already_sent', sent: 0};
      } else {
        const sourceUrl = clean(watched.url, 360);
        const body = sourceUrl
          ? `你回報的影片下載問題已修復，可以回到繁星下載重新嘗試。\n${sourceUrl}`
          : '你回報的影片下載問題已修復，可以回到繁星下載重新嘗試。';
        repairNotification = await sendRepairPushToUser(env, String(watched.userId), {
          title: '繁星下載｜已修復',
          body: body.slice(0, 700),
          url: '/',
          tag: `downloadstarry-repaired-${reportId}`,
        }).catch(error => ({status: 'failed', sent: 0, error: String(error?.message || error)}));
        await env.STARRY_ID_DB.prepare(`
          UPDATE downloadstarry_report_repair_watch
          SET updatedAt = ?, notifiedAt = ?, notifyStatus = ?, notifyError = ?
          WHERE reportId = ?
        `).bind(
          Date.now(),
          repairNotification.status === 'sent' ? Date.now() : null,
          clean(repairNotification.status, 40) || 'failed',
          clean(repairNotification.error, 180),
          reportId
        ).run().catch(() => undefined);
      }
    }
  }
  return json({success: true, status, repairNotification});
}

export async function handleReportRepairRequest(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/report-repair/')) return null;
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  if (!env.STARRY_ID_DB) return json({error: 'Starry ID 中央會員服務尚未連線'}, 503);
  await ensureSchema(env);
  const member = await sessionMember(request, env).catch(() => null);
  if (!member) return json({error: '請先登入 Starry ID'}, 401);

  if (url.pathname === '/api/report-repair/config' && request.method === 'GET') {
    const count = await env.STARRY_ID_DB.prepare(
      'SELECT COUNT(*) AS count FROM downloadstarry_repair_push_subscriptions WHERE userId = ? AND revokedAt IS NULL'
    ).bind(member.id).first();
    return json({
      configured: pushConfigured(env),
      publicKey: pushConfigured(env) ? clean(env.VAPID_PUBLIC_KEY, 512) : '',
      subscriptions: Number(count?.count || 0),
    });
  }

  if (url.pathname === '/api/report-repair/subscribe' && request.method === 'POST') {
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
      INSERT INTO downloadstarry_repair_push_subscriptions
        (endpoint, userId, p256dh, auth, createdAt, updatedAt, revokedAt)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(endpoint) DO UPDATE SET
        userId=excluded.userId, p256dh=excluded.p256dh, auth=excluded.auth,
        updatedAt=excluded.updatedAt, revokedAt=NULL
    `).bind(endpoint, member.id, p256dh, auth, now, now).run();
    return json({success: true});
  }

  if (url.pathname === '/api/report-repair/unsubscribe' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const endpoint = clean(body?.endpoint, 4096);
    if (endpoint) await markRevoked(env, endpoint, member.id);
    return json({success: true});
  }

  if (url.pathname === '/api/report-repair/test' && request.method === 'POST') {
    const result = await sendRepairPushToUser(env, member.id, {
      title: '繁星下載｜修復通知測試',
      body: '這支裝置已可以接收「修復後通知我」的系統通知。',
      url: '/report',
      tag: 'downloadstarry-repair-test',
    });
    return json({success: result.sent > 0, ...result}, result.sent > 0 ? 200 : 503);
  }

  if (url.pathname === '/api/report-repair/watch' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const reportId = clean(body.reportId, 80);
    if (!reportId) return json({error: '缺少回報編號'}, 400);
    return saveWatch(env, member, reportId);
  }

  if (url.pathname === '/api/report-repair/status' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const reportId = clean(body.id, 80);
    const status = clean(body.status, 40);
    if (!reportId) return json({error: '缺少回報編號'}, 400);
    return updateStatus(env, member, reportId, status);
  }

  return json({error: '找不到此功能'}, 404);
}
