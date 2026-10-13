import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleStarryRequest} from '../cloudflare/starry.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('首頁依需求調整 CTA、網址按鈕順序與暗色 Logo', async () => {
  const app = await read('static/app.js');
  assert.match(app, /請開發者喝杯咖啡/);
  assert.match(app, /p\.after\(l\);l\.after\(c\)/);
  assert.match(app, /body\.dark-theme \.site-brand-mark/);
  assert.match(app, /#263158/);
});

test('會員回報 shell 與會員模組都保持互動後 lazy-load', async () => {
  const app = await read('static/app.js');
  const shell = await read('static/member-shell.js');
  const sourceList = app.match(/const sources=\[([^\]]+)\]/s)?.[1] || '';
  assert.doesNotMatch(sourceList, /member-shell\.js|member-report\.js|member-api\.js|member-platform\.js/);
  assert.match(app, /load\('\/static\/member-shell\.js'\)/);
  assert.match(app, /menu-toggle/);
  assert.match(app, /lookup-form/);
  assert.match(shell, /report-download-button/);
  assert.match(shell, /無法下載/);
  assert.match(shell, /menu-report-button/);
  assert.match(shell, /回報無法下載/);
  assert.match(shell, /Starry ID 登入/);
  for (const file of ['member-report.js','member-api.js','member-platform.js']) assert.match(shell, new RegExp(`/static/${file.replace('.', '\\.')}`));
});

test('Starry ID 使用 lazy platform auth/session storage，不把會員 token 放 localStorage', async () => {
  const platform = await read('static/member-platform.js');
  const report = await read('static/member-report.js');
  assert.match(platform, /sessionStorage/);
  assert.match(platform, /\/api\/auth\/starry\/login/);
  assert.match(platform, /native\(\)\?\.auth/);
  assert.doesNotMatch(report, /localStorage/);
  assert.match(report, /platform\.session/);
  assert.match(report, /platform\.auth\.login/);
});

test('回報資料與會員 API 集中在 lazy API layer', async () => {
  const api = await read('static/member-api.js');
  const report = await read('static/member-report.js');
  for (const endpoint of ['/api/auth/starry/session','/api/auth/starry/logout','/api/reports']) assert.match(api, new RegExp(endpoint.replaceAll('/', '\\/')));
  assert.match(api, /updateReportStatus/);
  assert.doesNotMatch(report, /fetch\(/);
});

test('parsed 回報自動帶網址時間會員，manual 保持欄位空白', async () => {
  const report = await read('static/member-report.js');
  assert.match(report, /source === 'parsed'/);
  assert.match(report, /time\.value = parsed \?/);
  assert.match(report, /url\.readOnly = parsed/);
  assert.match(report, /time\.readOnly = parsed/);
  assert.match(report, /Starry ID/);
  assert.match(report, /請手動填寫網址、日期時間與備註/);
});

test('Worker 綁中央 Starry ID 且 app 專屬資料表 namespaced', async () => {
  const wrangler = JSON.parse(await read('wrangler.jsonc'));
  assert.equal(wrangler.d1_databases?.[0]?.binding, 'STARRY_ID_DB');
  assert.equal(wrangler.d1_databases?.[0]?.database_name, 'starry_id_db');
  const worker = await read('cloudflare/starry.js');
  assert.match(worker, /downloadstarry_sessions/);
  assert.match(worker, /downloadstarry_reports/);
  assert.match(worker, /app_memberships/);
  assert.match(worker, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(worker, /ECHO_STARRY_ORIGIN = 'https:\/\/echo\.starry\.phd'/);
});

test('回報寫入前拒絕跨站 POST', async () => {
  const request = new Request('https://download.starry.phd/api/reports', {
    method: 'POST',
    headers: {Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site'}
  });
  const response = await handleStarryRequest(request, {});
  assert.equal(response.status, 403);
});

test('Starry login route redirects to central Google login bridge without D1 lookup', async () => {
  const response = await handleStarryRequest(new Request('https://download.starry.phd/api/auth/starry/login'), {});
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), 'https://echo.starry.phd/auth/downloadstarry');
});
