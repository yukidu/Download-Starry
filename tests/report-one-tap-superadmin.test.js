import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('首頁回報錯誤改為一鍵送出且成功後顯示已回報', async () => {
  const gate = await read('static/report-gate.js');
  assert.match(gate, /async function reportCurrent/);
  assert.match(gate, /script\.src = '\/static\/member-api\.js'/);
  assert.match(gate, /api\.createReport\(\{/);
  assert.match(gate, /source: 'parsed'/);
  assert.match(gate, /reportedAt: new Date\(\)\.toISOString\(\)/);
  assert.match(gate, /button\.textContent = '回報中…'/);
  assert.match(gate, /button\.textContent = '已回報'/);
  assert.match(gate, /button\.dataset\.reportedUrl = resourceUrl/);
  assert.doesNotMatch(gate, /location\.assign\('\/report\?source=parsed'\)/);
});

test('漢堡回報管理入口只顯示給超級管理員', async () => {
  const gate = await read('static/report-gate.js');
  assert.match(gate, /SUPER_ADMIN_EMAIL = 'yukidu@gmail\.com'/);
  assert.match(gate, /menuReport\.hidden = true/);
  assert.match(gate, /document\.body\.classList\.toggle\('downloadstarry-super-admin', allowed\)/);
  assert.match(gate, /body:not\(\.downloadstarry-super-admin\) \.dsr-admin\{display:none!important\}/);
  assert.match(gate, /label\.textContent = '回報錯誤管理'/);
  assert.match(gate, /location\.replace\('\/'\)/);
});

test('Worker 從伺服器端限制回報管理頁、清單與處理動作', async () => {
  const worker = await read('cloudflare/worker.js');
  const helper = await read('cloudflare/super-admin.js');
  assert.match(worker, /import \{isSuperAdminRequest\} from '\.\/super-admin\.js'/);
  assert.match(worker, /url\.pathname === '\/report'/);
  assert.match(worker, /url\.pathname === '\/api\/reports' && method === 'GET'/);
  assert.match(worker, /url\.pathname === '\/api\/report-repair\/status' && method === 'POST'/);
  assert.match(worker, /isSuperAdminRequest\(request, env\)/);
  assert.match(worker, /只有超級管理員可以使用此功能/);
  assert.match(helper, /downloadstarry_sessions/);
  assert.match(helper, /JOIN users u ON u\.id = s\.userId/);
  assert.match(helper, /SUPER_ADMIN_EMAIL = 'yukidu@gmail\.com'/);
});
