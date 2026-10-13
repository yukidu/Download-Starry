import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('首頁回報按鈕固定兩行文字並與下載按鈕共用樣式', async () => {
  const toolbar = await read('static/toolbar.js');
  assert.match(toolbar, /parsed\.className='download-button download-action-button report-download-button'/);
  assert.match(toolbar, /button\.innerHTML='回報當前影片<br>無法下載'/);
  assert.match(toolbar, /aria-label','回報當前影片無法下載'/);
  assert.doesNotMatch(toolbar, /parsed\.textContent='回報無法下載'/);
  assert.doesNotMatch(toolbar, /\.report-download-button\{background:/);
});

test('影片、回報、音檔三顆主按鈕不顯示 icon', async () => {
  const toolbar = await read('static/toolbar.js');
  assert.match(toolbar, /const stripActionIcon=button=>/);
  assert.match(toolbar, /\[video,audio\]\.forEach/);
  assert.match(toolbar, /download-action-grid \.download-action-button>span\{display:none!important\}/);
});

test('CC 字幕固定在預覽縮圖下方且手機不會直排', async () => {
  const toolbar = await read('static/toolbar.js');
  assert.match(toolbar, /preview\.append\(thumbWrap,subtitleActions\)/);
  assert.match(toolbar, /grid-template-areas:"preview meta"/);
  assert.match(toolbar, /grid-template-areas:"meta" "preview"/);
  assert.match(toolbar, /#subtitle-group\{display:grid!important/);
  assert.match(toolbar, /white-space:nowrap!important/);
  assert.match(toolbar, /#subtitle-language\{display:block!important;width:100%!important;max-width:none!important/);
});

test('影片標題為來源標籤保留空間', async () => {
  const toolbar = await read('static/toolbar.js');
  assert.match(toolbar, /\.media-meta\{grid-area:meta;min-width:0!important;align-self:start!important;padding-right:82px\}/);
  assert.match(toolbar, /\.media-card\.media-source-link::after\{top:6px!important;right:2px!important\}/);
});

test('回報頁使用更緊湊的單畫面版面', async () => {
  const toolbar = await read('static/toolbar.js');
  assert.match(toolbar, /downloadstarry-report-route/);
  assert.match(toolbar, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(toolbar, /textarea\{min-height:54px!important;max-height:76px!important\}/);
  assert.match(toolbar, /textarea\{min-height:42px!important;max-height:54px!important\}/);
});
