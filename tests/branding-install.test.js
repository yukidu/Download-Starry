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

test('網站 Logo 與 PWA 安裝圖示共用同一個 App Icon', async () => {
  const manifest = JSON.parse(await read('static/manifest.webmanifest'));
  const toolbar = await read('static/toolbar.js');
  const icon = await read('static/app-icon.svg');
  const iconSrc = '/static/app-icon.svg?v=4';

  assert.ok(manifest.icons.length >= 2);
  assert.ok(manifest.icons.every(item => item.src === iconSrc));
  assert.match(toolbar, /background:url\(\/static\/app-icon\.svg\?v=4\) center\/cover/);
  assert.match(toolbar, /\.replaceChildren\(\)/);
  assert.match(icon, /id="download-arrow"/);
  assert.match(icon, /id="play-mark"/);
  assert.match(icon, /id="star-mark"/);
});

test('原始 HTML 品牌直接使用繁星下載', async () => {
  const template = await read('templates/index.html');
  assert.match(template, /<title>繁星下載（串流影音下載）<\/title>/);
  assert.match(template, /site-brand-text">繁星下載<\/span>/);
  assert.doesNotMatch(template, /繁星回憶/);
});

test('安裝入口只留在漢堡選單並導向原生頁', async () => {
  const toolbar = await read('static/toolbar.js');
  assert.match(toolbar, /install-app-button/);
  assert.doesNotMatch(toolbar, /top-install-button/);
  assert.match(toolbar, /go\('\/install'\)/);
  assert.match(toolbar, /install-pwa\.js/);
});

test('PWA platform layer 管理原生安裝提示與已安裝狀態', async () => {
  const platform = await read('static/platform.js');
  assert.match(platform, /beforeinstallprompt/);
  assert.match(platform, /canPromptInstall/);
  assert.match(platform, /promptInstall/);
  assert.match(platform, /isInstalled/);
  assert.match(platform, /iPad\|iPhone\|iPod/);
});

test('安裝功能使用原生頁而非自訂彈窗', async () => {
  const install = await read('static/install-pwa.js');
  assert.match(install, /downloadstarry-install-page/);
  assert.match(install, /加入主畫面/);
  assert.match(install, /Object\.freeze\(\{mount\}\)/);
  assert.doesNotMatch(install, /createElement\('dialog'\)|showModal|window\.alert/);
});
