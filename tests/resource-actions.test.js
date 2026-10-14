import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const resourceActions = fs.readFileSync(new URL('../static/resource-actions.js', import.meta.url), 'utf8');
const platform = fs.readFileSync(new URL('../static/platform.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../static/app.js', import.meta.url), 'utf8');

test('resource action layout keeps four primary buttons in one row and report full width', () => {
  assert.match(resourceActions, /repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(resourceActions, /report-download-button\{grid-column:1\/-1/);
  assert.match(resourceActions, /grid\.append\(videoButton, shareVideo, audioButton, shareAudio\)/);
  assert.match(resourceActions, /分享影片/);
  assert.match(resourceActions, /分享音檔/);
  assert.match(resourceActions, /回報當前資源無法下載/);
});

test('five resource buttons use the same button colors and share buttons include native-share icon', () => {
  assert.match(resourceActions, /background:var\(--button-bg\)!important;color:var\(--button-text\)!important/);
  assert.match(resourceActions, /resource-share-icon/);
  assert.match(resourceActions, /M12 15V4/);
});

test('resource share downloads the actual file before opening the device share sheet', () => {
  assert.match(resourceActions, /api\.startDownload/);
  assert.match(resourceActions, /api\.fileResponse/);
  assert.match(resourceActions, /response\.blob\(\)/);
  assert.match(resourceActions, /new File\(/);
  assert.match(resourceActions, /platform\.sharing\.shareFile/);
  assert.match(platform, /navigator\.share/);
  assert.match(platform, /files: \[file\]/);
  assert.match(resourceActions, /點此分享/);
});

test('resource share remains lazy-loaded until parsed result is shown', () => {
  assert.match(app, /resource-actions\.js/);
  assert.match(app, /MutationObserver/);
  assert.match(app, /\.hidden/);
});

test('desktop media title is constrained and wraps safely', () => {
  assert.match(resourceActions, /@media\(min-width:651px\)/);
  assert.match(resourceActions, /media-meta h2/);
  assert.match(resourceActions, /overflow-wrap:anywhere/);
  assert.match(resourceActions, /word-break:break-word/);
});
