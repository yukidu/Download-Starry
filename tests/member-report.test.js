import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleStarryRequest} from '../cloudflare/starry.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('固定置頂工具列與漢堡選單都提供完整雲端功能', async () => {
  const toolbar = await read('static/toolbar.js');
  for (const text of ['首頁','貼網址','Starry ID','回報錯誤','安裝']) assert.match(toolbar, new RegExp(text));
  assert.match(toolbar, /starry-member-button/);
  assert.match(toolbar, /menu-report-button/);
  assert.match(toolbar, /install-app-button/);
  assert.match(toolbar, /position:sticky!important/);
  assert.match(toolbar, /overflow-x:auto/);
});

test('首頁依需求調整 CTA、網址按鈕順序與暗色 Logo', async () => {
  const toolbar = await read('static/toolbar.js');
  assert.match(toolbar, /請開發者喝杯咖啡/);
  assert.match(toolbar, /paste\.after\(lookup\);lookup\.after\(clear\)/);
  assert.match(toolbar, /outline:1px solid #263158/);
});

test('會員與回報深層模組仍保持互動後 lazy-load', async () => {
  const app = await read('static/app.js');
  const toolbar = await read('static/toolbar.js');
  const shell = await read('static/member-shell.js');
  assert.doesNotMatch(app, /member-shell\.js|member-report\.js|member-api\.js|member-platform\.js/);
  assert.match(toolbar, /load\('\/static\/member-shell\.js'\)/);
  for (const file of ['member-report.js','member-api.js','member-platform.js']) assert.match(shell, new RegExp(`/static/${file.replace('.', '\\.')}`));
});

test('回報錯誤不要求登入，Starry ID 帳戶頁才需要登入', async () => {
  const report = await read('static/member-report.js');
  assert.match(report, /訪客（不需登入）/);
  assert.match(report, /不需登入即可送出/);
  assert.match(report, /const data = await session\(\);/);
  assert.match(report, /const user = data\?\.authenticated \? data\.user : null/);
  assert.match(report, /async function account\(\)/);
  assert.match(report, /prepareMember\(\{mode: 'account'\}\)/);
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

test('parsed 回報自動帶網址時間，manual 保持欄位空白', async () => {
  const report = await read('static/member-report.js');
  assert.match(report, /source === 'parsed'/);
  assert.match(report, /time\.value = parsed \?/);
  assert.match(report, /url\.readOnly = parsed/);
  assert.match(report, /time\.readOnly = parsed/);
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
  const insertAt = worker.indexOf('INSERT INTO downloadstarry_reports');
  const notifyAt = worker.indexOf('sendEmailNotification(env, report, member)');
  assert.ok(insertAt >= 0 && notifyAt > insertAt);
  assert.match(worker, /saveNotificationState\(env, id, email, line\)\.catch/);
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
