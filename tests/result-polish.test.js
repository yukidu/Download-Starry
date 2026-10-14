import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const polish = fs.readFileSync(new URL('../static/result-polish.js', import.meta.url), 'utf8');
const visualTune = fs.readFileSync(new URL('../static/result-visual-tune.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../static/app.js', import.meta.url), 'utf8');

test('four primary actions stay on one row as two full-width groups', () => {
  assert.match(polish, /resource-action-group-video/);
  assert.match(polish, /resource-action-group-audio/);
  assert.match(polish, /ensureActionGroup\(grid, 'resource-action-group-video', '影片', videoButton, shareVideo\)/);
  assert.match(polish, /ensureActionGroup\(grid, 'resource-action-group-audio', '音檔', audioButton, shareAudio\)/);
  assert.match(polish, /grid\.replaceChildren\(videoGroup, audioGroup\)/);
  assert.match(polish, /download-action-grid[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(polish, /resource-action-group-buttons[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(polish, /report-download-button[\s\S]*grid-column:1\/-1!important[\s\S]*width:100%!important/);
});

test('mobile action groups keep all four buttons inside screen width', () => {
  assert.match(polish, /#video-download-actions,[\s\S]*width:100%!important/);
  assert.match(polish, /@media\(max-width:650px\)[\s\S]*column-gap:10px!important/);
  assert.match(polish, /resource-action-group \.download-action-button[\s\S]*font-size:13px!important/);
  assert.match(polish, /resource-share-button[\s\S]*flex-direction:column!important/);
  assert.match(polish, /width:31px!important/);
});

test('video and audio sections are visually separated with larger centered controls', () => {
  assert.match(visualTune, /resource-action-group-video[\s\S]*linear-gradient/);
  assert.match(visualTune, /resource-action-group-audio[\s\S]*linear-gradient/);
  assert.match(visualTune, /resource-action-group-label[\s\S]*font:900 25px/);
  assert.match(visualTune, /download-action-button[\s\S]*min-height:72px!important[\s\S]*width:100%!important/);
  assert.match(visualTune, /justify-content:center!important/);
});

test('report button uses a pale non-black treatment', () => {
  assert.match(visualTune, /report-download-button[\s\S]*background:linear-gradient/);
  assert.match(visualTune, /color:#53637c!important/);
  assert.doesNotMatch(visualTune, /report-download-button\{[\s\S]{0,500}background:var\(--button-bg\)!important/);
});

test('preview card keeps filename at the top on mobile and desktop', () => {
  assert.match(polish, /grid-template-areas:"thumb meta"!important/);
  assert.match(polish, /media-card>\.media-meta[\s\S]*display:flex!important[\s\S]*justify-content:flex-start!important/);
  assert.match(polish, /media-card>\.media-meta h2[\s\S]*order:1!important[\s\S]*margin:0!important/);
  assert.match(polish, /media-card>\.media-meta>span[\s\S]*order:2!important/);
  assert.match(polish, /thumb-wrap img[\s\S]*object-fit:cover!important/);
  assert.match(polish, /@media\(max-width:650px\)[\s\S]*grid-template-columns:minmax\(118px,42%\) minmax\(0,1fr\)!important/);
});

test('share buttons use device-specific icons and keep labels visible', () => {
  assert.match(polish, /platform\?\.runtime\?\.isIOS/);
  assert.match(polish, /platform\?\.runtime\?\.isAndroid/);
  assert.match(polish, /resource-share-icon-ios/);
  assert.match(polish, /resource-share-icon-android/);
  assert.match(polish, /button\.innerHTML = `\$\{shareIconMarkup\(\)\}\$\{label\}`/);
  assert.match(polish, /button\.dataset\.shareDevice/);
});

test('parsed URL is returned to the beginning of the visible input', () => {
  assert.match(polish, /urlInput\.setSelectionRange\(0, 0\)/);
  assert.match(polish, /urlInput\.scrollLeft = 0/);
  assert.match(polish, /observer\.observe\(result, \{attributes: true, attributeFilter: \['hidden'\]\}\)/);
});

test('result UI scripts are cache-busted and loaded in order', () => {
  assert.match(app, /resource-actions\.js\?v=20261015-4/);
  assert.match(app, /result-polish\.js\?v=20261015-4/);
  assert.match(app, /result-visual-tune\.js\?v=20261015-4/);
});
