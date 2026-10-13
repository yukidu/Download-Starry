import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleCentralSso} from '../cloudflare/central-sso.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('繁星下載登入固定前往 id.starry.phd', async () => {
  const response = await handleCentralSso(
    new Request('https://download.starry.phd/api/auth/starry/login'),
    {}
  );
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://id.starry.phd/auth/downloadstarry');
});

test('繁星下載直接消耗中央 D1 一次性授權碼，不依賴 Echo API', async () => {
  const source = await read('cloudflare/central-sso.js');
  assert.match(source, /STARRY_ID_ORIGIN = 'https:\/\/id\.starry\.phd'/);
  assert.match(source, /starry_app_auth_codes/);
  assert.match(source, /DELETE FROM starry_app_auth_codes/);
  assert.match(source, /appId = \?/);
  assert.match(source, /downloadstarry_sessions/);
  assert.match(source, /app_memberships/);
  assert.doesNotMatch(source, /echo\.starry\.phd/);
  assert.doesNotMatch(source, /downloadstarry-exchange/);
});

test('Worker 在舊 Starry handler 前攔截中央登入路徑', async () => {
  const worker = await read('cloudflare/worker.js');
  const centralIndex = worker.indexOf('handleCentralSso(request, env)');
  const legacyIndex = worker.indexOf('handleRequest(request, env)');
  assert.ok(centralIndex >= 0);
  assert.ok(legacyIndex > centralIndex);
});
