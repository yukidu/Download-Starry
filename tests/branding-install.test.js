import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('PWA 安裝名稱統一為繁星下載', async () => {
  const manifest = JSON.parse(await read('static/manifest.webmanifest'));
  assert.equal(manifest.name, '繁星下載');
  assert.equal(manifest.short_name, '繁星下載');
  assert.doesNotMatch(await read('static/offline.html'), /繁星回憶/);
  assert.match(await read('static/app-icon.svg'), /aria-label="繁星下載"/);
});

test('原始 HTML 與執行後首頁品牌都直接使用繁星下載', async () => {
  const template = await read('templates/index.html');
  const app = await read('static/app.js');
  assert.match(template, /<title>繁星下載（串流影音下載）<\/title>/);
  assert.match(template, /site-brand-text">繁星下載<\/span>/);
  assert.doesNotMatch(template, /繁星回憶/);
  assert.match(app, /document\.title = '繁星下載（串流影音下載）'/);
  assert.match(app, /replaceChildren\('繁星下載'\)/);
});

test('首頁主選單提供安裝到桌面入口', async () => {
  const app = await read('static/app.js');
  assert.match(app, /安裝到桌面/);
  assert.match(app, /install-pwa\.js/);
  assert.match(app, /Download Starry bootstrap failed/);
});

test('PWA platform layer 管理原生安裝提示與已安裝狀態', async () => {
  const platform = await read('static/platform.js');
  assert.match(platform, /beforeinstallprompt/);
  assert.match(platform, /canPromptInstall/);
  assert.match(platform, /promptInstall/);
  assert.match(platform, /isInstalled/);
  assert.match(platform, /iPad\|iPhone\|iPod/);
});

test('已安裝提示與 iOS fallback 文案存在', async () => {
  const install = await read('static/install-pwa.js');
  assert.match(install, /你已安裝/);
  assert.match(install, /加入主畫面/);
  assert.match(install, /繁星下載 · Download Starry/);
});