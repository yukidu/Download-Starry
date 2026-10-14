import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const resourceActions = fs.readFileSync(new URL('../static/resource-actions.js', import.meta.url), 'utf8');
const memberPlatform = fs.readFileSync(new URL('../static/member-platform.js', import.meta.url), 'utf8');
const corePlatform = fs.readFileSync(new URL('../static/platform.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../static/app.js', import.meta.url), 'utf8');

test('resource actions group video and audio pairs while keeping four primary actions on one row', () => {
  assert.match(resourceActions, /resource-action-group-video/);
  assert.match(resourceActions, /resource-action-group-audio/);
  assert.match(resourceActions, /resource-action-group-buttons/);
  assert.match(resourceActions, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(resourceActions, /videoGroup\.querySelector\('\.resource-action-group-buttons'\)\?\.append\(videoButton, shareVideo\)/);
  assert.match(resourceActions, /audioGroup\.querySelector\('\.resource-action-group-buttons'\)\?\.append\(audioButton, shareAudio\)/);
  assert.match(resourceActions, /report-download-button\{grid-column:1\/-1/);
  assert.match(resourceActions, /回報當前資源無法下載/);
});

test('five resource buttons keep the same button colors and share icons are extra large', () => {
  assert.match(resourceActions, /background:var\(--button-bg\)!important;color:var\(--button-text\)!important/);
  assert.match(resourceActions, /resource-share-icon/);
  assert.match(resourceActions, /M12 15V4/);
  assert.match(resourceActions, /width:34px!important;height:34px!important/);
  assert.match(resourceActions, /width:32px!important;height:32px!important/);
});

test('quality hint box and source arrow badge are removed from the parsed result', () => {
  assert.match(resourceActions, /quality-display'\)\?\.remove\(\)/);
  assert.match(resourceActions, /media-card\.media-source-link::after\{content:none!important;display:none!important\}/);
});

test('preview keeps thumbnail left and title text right on desktop and phone', () => {
  assert.match(resourceActions, /grid-template-areas:"thumb meta" "sub meta"/);
  assert.match(resourceActions, /@media\(max-width:650px\)/);
  assert.match(resourceActions, /grid-template-columns:minmax\(118px,42%\) minmax\(0,1fr\)/);
  assert.match(resourceActions, /media-card>\.thumb-wrap\{grid-area:thumb/);
  assert.match(resourceActions, /media-card>\.media-meta\{grid-area:meta/);
});

test('resource share downloads the actual file before opening the device share sheet', () => {
  assert.match(resourceActions, /api\.startDownload/);
  assert.match(resourceActions, /api\.fileResponse/);
  assert.match(resourceActions, /response\.blob\(\)/);
  assert.match(resourceActions, /new File\(/);
  assert.match(resourceActions, /\/static\/member-platform\.js/);
  assert.match(resourceActions, /share\.file\(prepared\.file/);
  assert.match(memberPlatform, /shareFile/);
  assert.match(memberPlatform, /shareFiles/);
  assert.match(memberPlatform, /navigator\.canShare/);
  assert.match(memberPlatform, /navigator\.share\(\{files: \[file\]/);
  assert.doesNotMatch(corePlatform, /navigator\.share/);
  assert.match(resourceActions, /點此分享/);
});

test('resource share remains lazy-loaded until parsed result is shown', () => {
  assert.match(app, /resource-actions\.js/);
  assert.match(app, /MutationObserver/);
  assert.match(app, /\.hidden/);
  assert.match(resourceActions, /loadSharePlatform/);
});

test('desktop media title is constrained and wraps safely', () => {
  assert.match(resourceActions, /media-meta h2/);
  assert.match(resourceActions, /overflow-wrap:anywhere/);
  assert.match(resourceActions, /word-break:break-word/);
});
