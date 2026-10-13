import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleCentralSso} from '../cloudflare/central-sso.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('重新登入可要求 Starry ID 顯示 Google 帳戶選擇', async () => {
  const response = await handleCentralSso(
    new Request('https://download.starry.phd/api/auth/starry/login?choose=1'),
    {}
  );
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://id.starry.phd/auth/downloadstarry?choose=1');
  const platform = await read('static/member-platform.js');
  assert.match(platform, /chooseAccount = true/);
  assert.match(platform, /\?choose=1/);
});

test('下載紀錄有獨立頁面、API 與登入會員資料隔離', async () => {
  const [access, worker, history, shell, client] = await Promise.all([
    read('cloudflare/access.js'),
    read('cloudflare/worker.js'),
    read('cloudflare/history.js'),
    read('static/member-shell.js'),
    read('static/download-history.js'),
  ]);
  assert.match(access, /'\/history'/);
  assert.match(worker, /handleDownloadHistoryRequest/);
  assert.match(worker, /recordDownloadStart/);
  assert.match(history, /downloadstarry_history/);
  assert.match(history, /WHERE userId = \?/);
  assert.match(history, /downloadstarry_sessions/);
  assert.match(shell, /location\.pathname==='\/history'/);
  assert.match(client, /下載紀錄/);
  assert.match(client, /最近 100 筆/);
});

test('登入後不再露出登入按鈕，無獎銜時隱藏第二行', async () => {
  const fix = await read('static/header-member-fix.js');
  assert.match(fix, /#top-login-button\[hidden\]/);
  assert.match(fix, /\.top-member-rank\[hidden\]/);
  assert.match(fix, /'無'/);
  assert.match(fix, /menu-history-button/);
});
