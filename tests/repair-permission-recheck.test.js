import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('回報管理頁不再載入舊通知權限重新檢查腳本', async () => {
  const shell = await read('static/member-shell.js');
  assert.doesNotMatch(shell, /\/static\/repair-permission-recheck\.js/);
});

test('保留的舊重新檢查模組仍能獨立處理 PWA 權限上下文', async () => {
  const fix = await read('static/repair-permission-recheck.js');
  assert.match(fix, /downloadstarry_repair_permission_retry/);
  assert.match(fix, /downloadstarry_repair_permission_draft/);
  assert.match(fix, /sessionStorage\.setItem\(RETRY_KEY, '1'\)/);
  assert.match(fix, /location\.reload\(\)/);
  assert.match(fix, /正在重新檢查…/);
  assert.match(fix, /正在重新讀取手機通知權限…/);
  assert.match(fix, /notifyButton\.click\(\)/);
});

test('重新檢查攔截舊的同頁假重試，避免立即重開相同視窗', async () => {
  const fix = await read('static/repair-permission-recheck.js');
  assert.match(fix, /#dsr-permission-retry/);
  assert.match(fix, /stopImmediatePropagation\(\)/);
  assert.match(fix, /document\.addEventListener\('click',[\s\S]*true\)/);
});
