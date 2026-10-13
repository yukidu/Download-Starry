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

test('CC 字幕固定在預覽縮圖下方且不再用額外 wrapper 搬動縮圖', async () => {
  const toolbar = await read('static/toolbar.js');
  assert.match(toolbar, /thumbWrap\.after\(subtitleActions\)/);
  assert.doesNotMatch(toolbar, /media-preview-column/);
  assert.doesNotMatch(toolbar, /preview\.append\(thumbWrap,subtitleActions\)/);
  assert.match(toolbar, /grid-template-areas:"thumb meta" "sub meta"/);
  assert.match(toolbar, /\.media-card>#subtitle-download-actions\{grid-area:sub/);
});

test('手機版影片資訊固定為標題資訊、縮圖、CC 字幕的垂直順序', async () => {
  const toolbar = await read('static/toolbar.js');
  assert.match(toolbar, /@media\(max-width:650px\)\{\.media-card\{display:flex!important;flex-direction:column!important/);
  assert.match(toolbar, /\.media-card>\.media-meta\{order:1!important/);
  assert.match(toolbar, /\.media-card>\.thumb-wrap\{order:2!important;width:100%!important;height:auto!important;aspect-ratio:16\/9!important/);
  assert.match(toolbar, /\.media-card>#subtitle-download-actions\{order:3!important;width:100%!important/);
  assert.match(toolbar, /#subtitle-group\{display:flex!important;flex-direction:column!important/);
  assert.match(toolbar, /#subtitle-language\{display:block!important;width:100%!important;max-width:none!important/);
});

test('影片標題為來源標籤保留空間', async () => {
  const toolbar = await read('static/toolbar.js');
  assert.match(toolbar, /\.media-card>\.media-meta\{grid-area:meta;min-width:0!important;width:100%!important;align-self:start!important;padding-right:82px!important\}/);
  assert.match(toolbar, /\.media-card\.media-source-link::after\{top:6px!important;right:2px!important\}/);
});

test('回報頁使用更緊湊的單畫面版面', async () => {
  const toolbar = await read('static/toolbar.js');
  assert.match(toolbar, /downloadstarry-report-route/);
  assert.match(toolbar, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(toolbar, /textarea\{min-height:54px!important;max-height:76px!important\}/);
  assert.match(toolbar, /textarea\{min-height:42px!important;max-height:54px!important\}/);
});
