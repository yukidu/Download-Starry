import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const advanced = read('static/advanced-member.js');
const advancedCss = read('static/advanced-member.css');
const reportGate = read('static/report-gate.js');
const loader = read('static/result-loader.js');
const worker = read('cloudflare/worker.js');
const access = read('cloudflare/access.js');
const favorites = read('cloudflare/favorites.js');
const dockerfile = read('Dockerfile');

test('解析按鈕位置改為回報錯誤，但保留隱藏 submit 給自動解析使用', () => {
  assert.match(reportGate, /lookupButton\.hidden = true/);
  assert.match(reportGate, /top-report-button/);
  assert.match(reportGate, /reportButton\.textContent = '回報錯誤'/);
  assert.match(reportGate, /#menu-report-button,#top-report-button/);
  assert.doesNotMatch(reportGate, /#menu-report-button,#report-download-button/);
});

test('舊回報區改成會員限定進階展開按鈕', () => {
  assert.match(advanced, /進階功能｜會員限定/);
  assert.match(advanced, /advanced-member-panel/);
  assert.match(advanced, /toggle\.setAttribute\('aria-expanded'/);
  assert.match(advancedCss, /advanced-member-toggle/);
  assert.match(loader, /advanced-member\.js/);
  assert.match(loader, /advanced-member\.css/);
});

test('CC 字幕被移入進階功能且只有存在字幕時才顯示', () => {
  assert.match(advanced, /advanced-cc-slot/);
  assert.match(advanced, /ccSlot\.appendChild\(subtitleActions\)/);
  assert.match(advanced, /subtitleActions\.querySelector\('option'\)/);
  assert.match(advanced, /ccSection\.hidden = !available/);
});

test('會員收藏由 D1 持久化並綁定目前會員', () => {
  assert.match(favorites, /CREATE TABLE IF NOT EXISTS downloadstarry_favorites/);
  assert.match(favorites, /PRIMARY KEY \(userId, url\)/);
  assert.match(favorites, /authenticatedDownloadStarryMember/);
  assert.match(favorites, /INSERT INTO downloadstarry_favorites/);
  assert.match(favorites, /DELETE FROM downloadstarry_favorites/);
  assert.match(advanced, /☆ 加入我的收藏/);
  assert.match(advanced, /\/api\/favorites/);
});

test('自訂裁切提供雙端時間軸、即時預覽、下載與分享', () => {
  assert.match(advanced, /advanced-trim-start/);
  assert.match(advanced, /advanced-trim-end/);
  assert.match(advanced, /previewVideo\.currentTime/);
  assert.match(advanced, /previewSelection/);
  assert.match(advanced, /mode: 'preview'/);
  assert.match(advanced, /mode: 'trim'/);
  assert.match(advanced, /advanced-trim-download/);
  assert.match(advanced, /advanced-trim-share/);
  assert.match(advancedCss, /advanced-timeline/);
});

test('進階處理在 Worker 層強制要求會員登入', () => {
  assert.match(worker, /url\.pathname\.startsWith\('\/api\/advanced\/'\)/);
  assert.match(worker, /authenticatedDownloadStarryMember/);
  assert.match(worker, /進階功能為會員限定/);
  assert.match(access, /path === '\/api\/advanced\/download'/);
  assert.match(access, /api\\\/advanced\\\/file/);
});

test('Cloud container 啟用進階裁切入口', () => {
  assert.match(dockerfile, /deployment\/advanced\.py/);
  assert.match(dockerfile, /deployment\.advanced_server:app/);
});
