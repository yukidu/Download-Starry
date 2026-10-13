import {Container} from '@cloudflare/containers';
import {digest, handleRequest} from './access.js';
import {handleCentralSso} from './central-sso.js';
import {handlePushRequest, notifyReportCreated, saveReportPushState} from './push.js';

export class VideoDownloader extends Container {
  defaultPort = 8080;
  sleepAfter = '2m';
  enableInternet = true;

  async fetch(request) {
    this.envVars = {
      APP_MODE: 'cloud',
      YUANBAO_COOKIE: this.env.YUANBAO_COOKIE || '',
      CLOUD_BACKEND_TOKEN: await digest(`backend:${this.env.AUTH_PASSWORD}`),
      MAX_ACTIVE_JOBS: '1',
      MAX_DOWNLOAD_BYTES: '536870912',
      JOB_TTL_SECONDS: '900',
    };
    return super.fetch(request);
  }
}

async function fetchHandler(request, env, ctx) {
  try {
    const centralSsoResponse = await handleCentralSso(request, env);
    if (centralSsoResponse) return centralSsoResponse;
  } catch {
    return Response.json({error: 'Starry ID 中央登入服務暫時無法使用'}, {status: 503, headers: {'Cache-Control': 'no-store'}});
  }

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/push/')) {
    try {
      return await handlePushRequest(request, env);
    } catch {
      return Response.json({error: '系統通知服務暫時無法使用'}, {status: 503, headers: {'Cache-Control': 'no-store'}});
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/reports') {
    const reportRequest = request.clone();
    const response = await handleRequest(request, env);
    if (response.ok) {
      const report = await reportRequest.json().catch(() => ({}));
      const result = await response.clone().json().catch(() => ({}));
      ctx?.waitUntil?.((async () => {
        const push = await notifyReportCreated(env, report).catch(error => ({status: 'failed', error: String(error?.message || error)}));
        await saveReportPushState(env, result?.id, push);
      })());
    }
    return response;
  }

  return handleRequest(request, env);
}

export default {fetch: fetchHandler};
