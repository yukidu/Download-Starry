import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('下載紀錄保存影片標題與預覽縮圖並顯示修復通知狀態', async () => {
  const history = await read('cloudflare/history.js');
  assert.match(history, /downloadstarry_url_metadata/);
  assert.match(history, /form\.get\('title'\)/);
  assert.match(history, /form\.get\('thumbnail'\)/);
  assert.match(history, /downloadstarry_report_repair_watch/);
  assert.match(history, /watching/);
  assert.match(history, /notifyStatus/);
});

test('下載 API 會把目前解析出的標題與縮圖一起寫入歷史紀錄', async () => {
  const api = await read('static/api.js');
  assert.match(api, /document\.querySelector\('#title'\)/);
  assert.match(api, /document\.querySelector\('#thumbnail'\)/);
  assert.match(api, /formData\.append\('title'/);
  assert.match(api, /formData\.append\('thumbnail'/);
});

test('下載紀錄卡片提供縮圖名稱最佳畫質中文重新下載與分享', async () => {
  const ui = await read('static/download-history.js');
  assert.match(ui, /最佳畫質/);
  assert.match(ui, /history-thumb/);
  assert.match(ui, /history-link-title/);
  assert.match(ui, /重新下載/);
  assert.match(ui, /history-share/);
  assert.match(ui, /修復後會通知/);
  assert.match(ui, /downloadstarry\.redownload\.v1/);
});

test('分享功能集中在懶載入會員 platform layer 並優先使用行動裝置原生分享', async () => {
  const memberPlatform = await read('static/member-platform.js');
  const corePlatform = await read('static/platform.js');
  assert.match(memberPlatform, /native\(\)\?\.share/);
  assert.match(memberPlatform, /navigator\.share/);
  assert.match(memberPlatform, /navigator\.clipboard\?\.writeText/);
  assert.match(memberPlatform, /Object\.freeze\(\{session, auth, share\}\)/);
  assert.doesNotMatch(corePlatform, /navigator\.share/);
});

test('重新下載會回首頁解析原網址並重新觸發原下載格式', async () => {
  const app = await read('static/app.js');
  const helper = await read('static/history-redownload.js');
  assert.match(app, /history-redownload\.js/);
  assert.match(helper, /form\.requestSubmit\(\)/);
  assert.match(helper, /download-video-button/);
  assert.match(helper, /download-audio-button/);
  assert.match(helper, /button\.click\(\)/);
});

test('漢堡選單登入登出固定在最下方且主登入文案更新', async () => {
  const header = await read('static/header-member-fix.js');
  assert.match(header, /menu\.appendChild\(authRow\)/);
  assert.match(header, /authenticated\?'登出':'登入'/);
  assert.match(header, /\/api\/auth\/starry\/logout/);
  assert.match(header, /按此註冊或登入/);
  assert.match(header, /font-weight:400!important/);
});

test('回報當前影片會保存標題縮圖供下載紀錄顯示', async () => {
  const header = await read('static/header-member-fix.js');
  const api = await read('static/member-api.js');
  assert.match(header, /downloadstarry\.report-metadata\.v1/);
  assert.match(header, /document\.getElementById\('title'\)/);
  assert.match(header, /document\.getElementById\('thumbnail'\)/);
  assert.match(api, /\/api\/download-history\/metadata/);
});
