import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('會員頁文案不再宣稱訪客可回報', async () => {
  const shell = await read('static/member-shell.js');
  assert.match(shell, /只提供給註冊會員使用/);
  assert.match(shell, /回報無法下載需登入或免費註冊 Starry ID/);
});

test('管理員已解決動作顯示為已修復', async () => {
  const repair = await read('static/repair-notifications.js');
  assert.match(repair, /data-status="resolved"/);
  assert.match(repair, /button\.textContent = '已修復'/);
  assert.match(repair, /管理員標記「已修復」時會通知這支裝置/);
});
