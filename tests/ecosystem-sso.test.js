import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('繁星捕手以 Starry ID 中央 session 與一次性票證承接登入', async () => {
  const sso = await read('static/ecosystem-sso.js');
  assert.match(sso, /https:\/\/id\.starry\.phd/);
  assert.match(sso, /api\/ecosystem\/session/);
  assert.match(sso, /api\/apps\/downloadstarry\/ticket/);
  assert.match(sso, /credentials: 'include'/);
  assert.match(sso, /\/auth\/callback/);
});

test('登入可直接在繁星捕手內選 Google 帳號', async () => {
  const sso = await read('static/ecosystem-sso.js');
  assert.match(sso, /accounts\.google\.com\/gsi\/client/);
  assert.match(sso, /api\/google-sync/);
  assert.match(sso, /appId: 'downloadstarry'/);
  assert.match(sso, /完成後會留在繁星捕手/);
});

test('繁星捕手不共用或直接讀取 Starry ID 敏感 Cookie', async () => {
  const files = [
    await read('static/ecosystem-sso.js'),
    await read('cloudflare/central-sso.js'),
    await read('cloudflare/worker.js')
  ].join('\n');
  assert.doesNotMatch(files, /Domain=\.starry\.phd/);
  assert.doesNotMatch(files, /starry_id_session/);
});

test('登入登出與帳號切換會在回到頁面時重新確認中央身份', async () => {
  const sso = await read('static/ecosystem-sso.js');
  assert.match(sso, /window\.addEventListener\('focus'/);
  assert.match(sso, /visibilitychange/);
  assert.match(sso, /window\.addEventListener\('online'/);
  assert.match(sso, /centralLogout/);
  assert.match(sso, /localId === centralId/);
});
