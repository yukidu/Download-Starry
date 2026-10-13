import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('回報按鈕先檢查 Starry ID，訪客顯示免費註冊提醒', async () => {
  const app = await read('static/app.js');
  const gate = await read('static/report-gate.js');
  assert.match(app, /\/static\/report-gate\.js/);
  assert.match(gate, /#menu-report-button,#report-download-button/);
  assert.match(gate, /\/api\/auth\/starry\/session/);
  assert.match(gate, /只提供給註冊會員使用/);
  assert.match(gate, /按此免費註冊/);
  assert.match(gate, /\/api\/auth\/starry\/login\?choose=1/);
});

test('Worker 在建立回報前強制會員身分', async () => {
  const worker = await read('cloudflare/worker.js');
  const repair = await read('cloudflare/report-repair.js');
  assert.match(worker, /enforceMemberReport/);
  assert.match(worker, /membershipRejected/);
  assert.match(repair, /回報無法下載只提供給註冊會員使用/);
  assert.match(repair, /downloadstarry_sessions/);
});

test('回報頁提供修復後通知我並綁定該回報', async () => {
  const shell = await read('static/member-shell.js');
  const ui = await read('static/repair-notifications.js');
  const api = await read('static/member-api.js');
  assert.match(shell, /\/static\/repair-notifications\.js/);
  assert.match(ui, /修復後通知我/);
  assert.match(ui, /repairWatch\(result\.id\)/);
  assert.match(ui, /Notification\.requestPermission/);
  assert.match(api, /\/api\/report-repair\/watch/);
  assert.match(api, /\/api\/report-repair\/subscribe/);
});

test('iPhone iPad 未加入主畫面時不假裝能強制安裝', async () => {
  const ui = await read('static/repair-notifications.js');
  assert.match(ui, /platform\?\.runtime\?\.isIOS && !platform\.runtime\.isStandalone/);
  assert.match(ui, /Apple 不允許網站自動或強制安裝/);
  assert.match(ui, /查看安裝方式/);
  assert.match(ui, /location\.assign\('\/install'\)/);
});

test('管理員標記已解決後只通知有訂閱該回報的會員', async () => {
  const repair = await read('cloudflare/report-repair.js');
  const api = await read('static/member-api.js');
  assert.match(api, /\/api\/report-repair\/status/);
  assert.match(repair, /downloadstarry_report_repair_watch/);
  assert.match(repair, /downloadstarry_repair_push_subscriptions/);
  assert.match(repair, /status === 'resolved'/);
  assert.match(repair, /sendRepairPushToUser/);
  assert.match(repair, /繁星下載｜已修復/);
  assert.match(repair, /notifiedAt/);
});
