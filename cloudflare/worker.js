import {Container} from '@cloudflare/containers';
import {digest, handleRequest} from './access.js';
import {handlePushRequest, notifyReportCreated} from './push.js';

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
  const pushResponse = await handlePushRequest(request, env).catch(() => null);
  if (pushResponse) return pushResponse;

  const url = new URL(request.url);
  if (request.method === 'POST' && url.pathname === '/api/reports') {
    const reportRequest = request.clone();
    const response = await handleRequest(request, env);
    if (response.ok) {
      const report = await reportRequest.json().catch(() => ({}));
      ctx?.waitUntil?.(notifyReportCreated(env, report).catch(() => undefined));
    }
    return response;
  }

  return handleRequest(request, env);
}

export default {fetch: fetchHandler};
