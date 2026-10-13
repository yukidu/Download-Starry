import {handleStarryRequest} from './starry.js';

const encoder = new TextEncoder();
const PAGE_ROUTES = new Set(['/', '/report', '/account', '/install']);

export async function digest(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
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
    return errorResponse('服務尚未完成安全設定', 503);
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
    return PAGE_ROUTES.has(path) || path === '/api/health' ||
      /^\/static\/[A-Za-z0-9._-]+$/.test(path) ||
      /^\/api\/download\/[a-f0-9]{32}\/(progress|file)$/.test(path);
  }
  return method === 'POST' && (
    path === '/api/info' || path === '/api/download' ||
    /^\/api\/download\/[a-f0-9]{32}\/cancel$/.test(path)
  );
}

export async function handleRequest(request, env) {
  try {
    const starryResponse = await handleStarryRequest(request, env);
    if (starryResponse) return starryResponse;
  } catch {
    return errorResponse('Starry ID 會員服務暫時無法連線，請稍後重試', 503);
  }

  const rejected = await authorize(request, env);
  if (rejected) return rejected;
  const path = new URL(request.url).pathname;
  if (!allowedRoute(path, request.method)) {
    return errorResponse('找不到此功能', 404);
  }
  const forwardedUrl = new URL(request.url);
  if (PAGE_ROUTES.has(path) && path !== '/') forwardedUrl.pathname = '/';
  const forwarded = new Request(forwardedUrl, request);
  forwarded.headers.delete('Authorization');
  forwarded.headers.delete('Cookie');
  forwarded.headers.delete('cf-container-target-port');
  forwarded.headers.set('X-Backend-Token', await digest(`backend:${env.AUTH_PASSWORD}`));
  try {
    // Every job, progress request and file transfer must reach the same instance.
    const container = env.DOWNLOADER.getByName('personal-downloader');
    // Retry only page resources: never repeat a download-creation POST.
    const retryable = ['GET', 'HEAD'].includes(request.method) &&
      (PAGE_ROUTES.has(path) || path.startsWith('/static/'));
    let response;
    for (let attempt = 0; attempt < (retryable ? 3 : 1); attempt++) {
      try {
        response = await container.fetch(retryable ? forwarded.clone() : forwarded);
        if (!retryable || response.status < 500 || attempt === 2) break;
        await response.body?.cancel();
      } catch (error) {
        if (!retryable || attempt === 2) throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
    }
    if (response.status >= 500 && !response.headers.get('Content-Type')?.includes('application/json')) {
      await response.body?.cancel();
      return errorResponse('下載服務正在啟動或暫時無法連線，請稍後重試', 503);
    }
    const result = new Response(response.body, response);
    result.headers.set('Cache-Control', 'private, no-store');
    result.headers.set('X-Content-Type-Options', 'nosniff');
    result.headers.set('Referrer-Policy', 'no-referrer');
    result.headers.set('X-Frame-Options', 'DENY');
    if (path === '/static/service-worker.js') {
      result.headers.set('Service-Worker-Allowed', '/');
    }
    if (path === '/static/manifest.webmanifest') {
      result.headers.set('Content-Type', 'application/manifest+json; charset=utf-8');
    }
    return result;
  } catch {
    return errorResponse('下載服務正在啟動或暫時無法連線，請稍後重試', 503);
  }
}