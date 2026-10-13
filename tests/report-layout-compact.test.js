import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('首頁回報按鈕使用完整文字並與下載按鈕共用樣式', async () => {
  const toolbar = await read('static/toolbar.js');
  assert.match(toolbar, /parsed\.className='download-button download-action-button report-download-button'/);
  assert.match(toolbar, /parsed\.textContent='回報無法下載'/);
  assert.doesNotMatch(toolbar, /parsed\.innerHTML='<span>!<\/span> 無法下載'/);
  assert.doesNotMatch(toolbar, /\.report-download-button\{background:/);
});

test('影片、回報、音檔三顆主按鈕不顯示 icon', async () => {
  const toolbar = await read('static/toolbar.js');
  assert.match(toolbar, /const stripActionIcon=button=>/);
  assert.match(toolbar, /\[video,audio\]\.forEach/);
  assert.match(toolbar, /download-action-grid \.download-action-button>span\{display:none!important\}/);
});

test('CC 字幕控制移到預覽縮圖下方', async () => {
  const toolbar = await read('static/toolbar.js');
  assert.match(toolbar, /media-preview-column/);
  assert.match(toolbar, /preview\.append\(thumbWrap,subtitleActions\)/);
  assert.match(toolbar, /subtitle-download-actions:not\(\[hidden\]\)/);
});

test('回報頁使用緊湊單畫面版面', async () => {
  const toolbar = await read('static/toolbar.js');
  assert.match(toolbar, /downloadstarry-report-route/);
  assert.match(toolbar, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(toolbar, /textarea\{min-height:54px!important;max-height:76px!important\}/);
  assert.match(toolbar, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
});
