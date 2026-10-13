import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleStarryRequest} from '../cloudflare/starry.js';
import {allowedRoute} from '../cloudflare/access.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('置頂主工具列只增加燈光與登入，完整功能留在漢堡選單', async () => {
  const toolbar = await read('static/toolbar.js');
  assert.match(toolbar, /top-theme-toggle/);
  assert.match(toolbar, /top-login-button/);
  assert.match(toolbar, /<span>登入<\/span>/);
  for (const id of ['starry-member-button','menu-report-button','install-app-button']) assert.match(toolbar, new RegExp(id));
  for (const id of ['top-home-button','top-url-button','top-starry-member-button','top-report-button','top-install-button']) assert.doesNotMatch(toolbar, new RegExp(id));
  assert.match(toolbar, /position:sticky!important/);
  assert.doesNotMatch(toolbar, /overflow-x:auto/);
});

test('首頁依需求調整 CTA、網址按鈕順序與暗色 Logo', async () => {
  const toolbar = await read('static/toolbar.js');
  assert.match(toolbar, /請開發者喝杯咖啡/);
  assert.match(toolbar, /paste\.after\(lookup\);lookup\.after\(clear\)/);
  assert.match(toolbar, /outline:1px solid #263158/);
});

test('會員與回報深層模組維持 lazy-load', async () => {
  const app = await read('static/app.js');
  const toolbar = await read('static/toolbar.js');
  const shell = await read('static/member-shell.js');
  assert.doesNotMatch(app, /member-shell\.js|member-report\.js|member-api\.js|member-platform\.js/);
  assert.match(toolbar, /load\('\/static\/member-shell\.js'\)/);
  for (const file of ['member-report.js','member-api.js','member-platform.js']) assert.match(shell, new RegExp(`/static/${file.replace('.', '\\.')}`));
  assert.match(shell, /Object\.freeze\(\{mount\}\)/);
});

test('回報與登入改為原生頁，不使用 dialog 或 alert', async () => {
  const report = await read('static/member-report.js');
  assert.match(report, /downloadstarry-page/);
  assert.match(report, /location\.pathname === '\/report'/);
  assert.match(report, /Starry ID 登入/);
  assert.match(report, /訪客（不需登入）/);
  assert.match(report, /不需登入即可送出/);
  assert.doesNotMatch(report, /createElement\('dialog'\)|showModal|window\.alert|\balert\(/);
});

test('所有原生功能頁由 Cloudflare 路由支援且共用固定 Header', async () => {
  const access = await read('cloudflare/access.js');
  const toolbar = await read('static/toolbar.js');
  for (const path of ['/report','/account','/install']) {
    assert.equal(allowedRoute(path, 'GET'), true);
    assert.match(access, new RegExp(path.replace('/', '\\/')));
  }
  assert.match(access, /forwardedUrl\.pathname = '\/'/);
  assert.match(toolbar, /location\.pathname==='\/account'\|\|location\.pathname==='\/report'/);
});

test('回報錯誤不要求登入，登入頁才啟動 Google 登入', async () => {
  const report = await read('static/member-report.js');
  assert.match(report, /const user = data\?\.authenticated \? data\.user : null/);
  assert.match(report, /api\.createReport/);
  assert.match(report, /platform\.auth\.login\(\)/);
  assert.match(report, /下載與回報錯誤仍可在未登入狀態使用/);
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

test('parsed 回報用 session draft 帶入網址時間，manual 保持空白', async () => {
  const toolbar = await read('static/toolbar.js');
  const report = await read('static/member-report.js');
  assert.match(toolbar, /downloadstarry\.report-draft\.v2/);
  assert.match(toolbar, /\/report\?source=parsed/);
  assert.match(report, /params\.get\('source'\) === 'parsed'/);
  assert.match(report, /platform\.session\.get\(DRAFT_KEY\)/);
  assert.match(report, /目前以訪客身分回報/);
  assert.match(report, /請手動填寫網址、日期時間與備註/);
});

test('Worker 支援匿名工單、防濫用、Email 與 LINE 通知', async () => {
  const wrangler = JSON.parse(await read('wrangler.jsonc'));
  const worker = await read('cloudflare/starry.js');
  assert.equal(wrangler.d1_databases?.[0]?.binding, 'STARRY_ID_DB');
  assert.equal(wrangler.send_email?.[0]?.name, 'REPORT_EMAIL');
  assert.equal(wrangler.send_email?.[0]?.destination_address, 'yukidu@gmail.com');
  assert.match(worker, /downloadstarry_report_notifications/);
  assert.match(worker, /downloadstarry_report_rate/);
  assert.match(worker, /REPORT_WINDOW_MAX = 6/);
  assert.match(worker, /env\.REPORT_EMAIL\.send/);
  assert.match(worker, /LINE_CHANNEL_ACCESS_TOKEN/);
  assert.match(worker, /LINE_ADMIN_USER_ID/);
  assert.match(worker, /https:\/\/api\.line\.me\/v2\/bot\/message\/push/);
  assert.match(worker, /member\?\.id \|\| ''/);
  assert.match(worker, /path === '\/api\/reports' && method === 'POST'/);
});

test('通知失敗不會回滾已建立的工單', async () => {
  const worker = await read('cloudflare/starry.js');
  const createReport = worker.match(/async function createReport[\s\S]*?\n}\n\nasync function listReports/)?.[0] || '';
  assert.match(createReport, /INSERT INTO downloadstarry_reports[\s\S]*?\.run\(\);[\s\S]*?sendEmailNotification\(env, report, member\)/);
  assert.match(createReport, /saveNotificationState\(env, id, email, line\)\.catch/);
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
