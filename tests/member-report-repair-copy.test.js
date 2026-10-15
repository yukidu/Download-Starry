import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('回報管理頁不再載入舊手動回報與修復通知表單', async () => {
  const shell = await read('static/member-shell.js');
  const report = await read('static/member-report.js');
  assert.doesNotMatch(shell, /repair-notifications\.js|repair-permission-recheck\.js/);
  assert.doesNotMatch(report, /送出給管理員|dsr-form|textarea/);
  assert.match(report, /回報錯誤管理/);
});

test('管理員已解決動作仍顯示為已修復通知狀態', async () => {
  const repair = await read('static/repair-notifications.js');
  assert.match(repair, /data-status="resolved"/);
  assert.match(repair, /button\.textContent = '已修復'/);
  assert.match(repair, /管理員標記「已修復」時會通知這支裝置/);
});
