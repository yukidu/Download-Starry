import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../cloudflare/access.js';

const password = 'test-only-password-123456789';
const req = path => new Request(`https://download.example${path}`);

const backend = responseFactory => ({
  AUTH_PASSWORD: password,
  DOWNLOADER: {
    getByName() {
      return {fetch: responseFactory};
    },
  },
});

test('service worker is allowed to control the web app root scope', async () => {
  const response = await handleRequest(
    req('/static/service-worker.js'),
    backend(() => new Response('self.addEventListener("fetch",()=>{})', {
      headers: {'Content-Type': 'application/javascript'},
    })),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Service-Worker-Allowed'), '/');
});

test('manifest is served with the manifest media type', async () => {
  const response = await handleRequest(
    req('/static/manifest.webmanifest'),
    backend(() => new Response('{}', {headers: {'Content-Type': 'application/octet-stream'}})),
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type') || '', /application\/manifest\+json/);
});
