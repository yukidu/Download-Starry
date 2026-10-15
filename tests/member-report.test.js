import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('會員與回報深層模組維持 lazy-load', async () => {
  const app = await read('static/app.js');
  const toolbar = await read('static/toolbar.js');
  const shell = await read('static/member-shell.js');
  assert.doesNotMatch(app, /member-report\.js|member-api\.js|member-platform\.js/);
  assert.match(toolbar, /load\('\/static\/member-shell\.js'\)/);
  for (const file of ['member-report.js','member-api.js','member-platform.js']) assert.match(shell, new RegExp(`/static/${file.replace('.', '\\.')}`));
  assert.match(shell, /Object\.freeze\(\{mount\}\)/);
});

test('回報管理頁只保留管理清單，不再有手動輸入表單', async () => {
  const report = await read('static/member-report.js');
  assert.match(report, /回報錯誤管理/);
  assert.match(report, /renderReportAdmin/);
  assert.match(report, /api\.reports\(\)/);
  assert.match(report, /api\.updateReportStatus/);
  assert.doesNotMatch(report, /dsr-form|dsr-url|dsr-time|dsr-note|送出給管理員|textarea/);
  assert.doesNotMatch(report, /report-draft|DRAFT_KEY|visitorHtml|localDateTime/);
});

test('回報管理顯示縮圖並固定用台北時間', async () => {
  const report = await read('static/member-report.js');
  const admin = await read('cloudflare/admin-reports.js');
  assert.match(report, /Asia\/Taipei/);
  assert.match(report, /dsr-report-thumb/);
  assert.match(report, /row\.thumbnail/);
  assert.match(report, /row\?\.createdAt/);
  assert.match(admin, /downloadstarry_url_metadata/);
  assert.match(admin, /COALESCE\(m\.thumbnail, ''\) AS thumbnail/);
  assert.match(admin, /COALESCE\(m\.title, ''\) AS title/);
});

test('首頁一鍵回報會同步保存目前標題與縮圖，不跳回報頁', async () => {
  const gate = await read('static/report-gate.js');
  assert.match(gate, /downloadstarry\.report-metadata\.v1/);
  assert.match(gate, /currentMetadata/);
  assert.match(gate, /api\.createReport/);
  assert.match(gate, /button\.textContent = '已回報'/);
  assert.doesNotMatch(gate, /location\.assign\('\/report\?source=parsed'\)/);
});

test('回報管理頁與 API 由 Worker 限定超級管理員', async () => {
  const worker = await read('cloudflare/worker.js');
  const superAdmin = await read('cloudflare/super-admin.js');
  assert.match(worker, /reportManagementRequest/);
  assert.match(worker, /isSuperAdminRequest/);
  assert.match(worker, /handleAdminReportList/);
  assert.match(superAdmin, /SUPER_ADMIN_EMAIL/);
  assert.match(superAdmin, /primaryEmail/);
});

test('帳號頁保留 Starry ID 登入與登出，不再混入回報管理清單', async () => {
  const report = await read('static/member-report.js');
  assert.match(report, /Starry ID 登入/);
  assert.match(report, /platform\.auth\.login\(\)/);
  assert.match(report, /api\.logout\(\)/);
  const accountBlock = report.match(/async function renderAccount\(\)[\s\S]*?\n  }\n\n  async function mount/)?.[0] || '';
  assert.doesNotMatch(accountBlock, /renderAdmin\(/);
});
