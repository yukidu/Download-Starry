const encoder = new TextEncoder();

export async function digest(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function equalSecret(left, right) {
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

export function errorResponse(message, status, extraHeaders = {}) {
  return Response.json({error: message}, {status, headers: {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  }});
}

export async function authorize(request, env) {
  if (!env.AUTH_PASSWORD || env.AUTH_PASSWORD.length < 20) {
    return errorResponse('管理員尚未完成登入設定', 503);
  }
  let credentials = '';
  try {
    const header = request.headers.get('Authorization') || '';
    if (/^Basic /i.test(header)) credentials = atob(header.slice(6));
  } catch { /* Treat malformed Base64 as unauthenticated. */ }
  if (!await equalSecret(credentials, `${env.AUTH_USER || 'samuel'}:${env.AUTH_PASSWORD}`)) {
    return errorResponse('請輸入此工具的使用者名稱與密碼', 401, {
      'WWW-Authenticate': 'Basic realm="SaveVideo", charset="UTF-8"',
    });
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('Origin');
    if ((origin && origin !== new URL(request.url).origin) ||
        request.headers.get('Sec-Fetch-Site') === 'cross-site') {
      return errorResponse('不接受來自其他網站的操作', 403);
    }
  }
  return null;
}

export function allowedRoute(path, method) {
  if (['GET', 'HEAD'].includes(method)) {
    return path === '/' || path === '/api/health' ||
      /^\/static\/[A-Za-z0-9._-]+$/.test(path) ||
      /^\/api\/download\/[a-f0-9]{32}\/(progress|file)$/.test(path);
  }
  return method === 'POST' && (
    path === '/api/info' || path === '/api/download' ||
    /^\/api\/download\/[a-f0-9]{32}\/cancel$/.test(path)
  );
}

export async function handleRequest(request, env) {
  const rejected = await authorize(request, env);
  if (rejected) return rejected;
  if (!allowedRoute(new URL(request.url).pathname, request.method)) {
    return errorResponse('找不到此功能', 404);
  }
  const forwarded = new Request(request);
  forwarded.headers.delete('Authorization');
  forwarded.headers.delete('Cookie');
  forwarded.headers.delete('cf-container-target-port');
  forwarded.headers.set('X-Backend-Token', await digest(`backend:${env.AUTH_PASSWORD}`));
  try {
    // Every job, progress request and file transfer must reach the same instance.
    const response = await env.DOWNLOADER.getByName('personal-downloader').fetch(forwarded);
    if (response.status >= 500 && !response.headers.get('Content-Type')?.includes('application/json')) {
      await response.body?.cancel();
      return errorResponse('下載服務正在啟動或暫時無法連線，請稍後重試', 503);
    }
    const result = new Response(response.body, response);
    result.headers.set('Cache-Control', 'private, no-store');
    result.headers.set('X-Content-Type-Options', 'nosniff');
    result.headers.set('Referrer-Policy', 'no-referrer');
    result.headers.set('X-Frame-Options', 'DENY');
    return result;
  } catch {
    return errorResponse('下載服務正在啟動或暫時無法連線，請稍後重試', 503);
  }
}
