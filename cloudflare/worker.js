import {Container} from '@cloudflare/containers';
import {digest, handleRequest} from './access.js';

export class VideoDownloader extends Container {
  defaultPort = 8080;
  sleepAfter = '2m';
  enableInternet = true;

  async fetch(request) {
    this.envVars = {
      APP_MODE: 'cloud',
      CLOUD_BACKEND_TOKEN: await digest(`backend:${this.env.AUTH_PASSWORD}`),
      MAX_ACTIVE_JOBS: '1',
      MAX_DOWNLOAD_BYTES: '536870912',
      JOB_TTL_SECONDS: '900',
    };
    return super.fetch(request);
  }
}

export default {fetch: handleRequest};
