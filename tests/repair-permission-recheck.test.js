import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('回報頁載入通知重新檢查修復腳本', async () => {
  const shell = await read('static/member-shell.js');
  assert.match(shell, /\/static\/repair-permission-recheck\.js/);
});

test('重新檢查會重新整理 PWA 權限上下文並保留表單內容', async () => {
  const fix = await read('static/repair-permission-recheck.js');
  assert.match(fix, /downloadstarry_repair_permission_retry/);
  assert.match(fix, /downloadstarry_repair_permission_draft/);
  assert.match(fix, /sessionStorage\.setItem\(RETRY_KEY, '1'\)/);
  assert.match(fix, /location\.reload\(\)/);
  assert.match(fix, /正在重新檢查…/);
  assert.match(fix, /正在重新讀取手機通知權限…/);
  assert.match(fix, /notifyButton\.click\(\)/);
  assert.match(fix, /#dsr-url/);
  assert.match(fix, /#dsr-time/);
  assert.match(fix, /#dsr-note/);
});

test('重新檢查攔截舊的同頁假重試，避免立即重開相同視窗', async () => {
  const fix = await read('static/repair-permission-recheck.js');
  assert.match(fix, /#dsr-permission-retry/);
  assert.match(fix, /stopImmediatePropagation\(\)/);
  assert.match(fix, /document\.addEventListener\('click',[\s\S]*true\)/);
});
