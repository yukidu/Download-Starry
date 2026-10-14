import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const polish = fs.readFileSync(new URL('../static/result-polish.js', import.meta.url), 'utf8');
const resultUi = fs.readFileSync(new URL('../static/result-ui.css', import.meta.url), 'utf8');
const resultLayout = fs.readFileSync(new URL('../static/result-layout.js', import.meta.url), 'utf8');
const urlFieldWrap = fs.readFileSync(new URL('../static/url-field-wrap.js', import.meta.url), 'utf8');
const resultLoader = fs.readFileSync(new URL('../static/result-loader.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../static/app.js', import.meta.url), 'utf8');

test('four primary actions stay on one row as two full-width groups', () => {
  assert.match(polish, /resource-action-group-video/);
  assert.match(polish, /resource-action-group-audio/);
  assert.match(polish, /ensureActionGroup\(grid, 'resource-action-group-video', '影片', videoButton, shareVideo\)/);
  assert.match(polish, /ensureActionGroup\(grid, 'resource-action-group-audio', '音檔', audioButton, shareAudio\)/);
  assert.match(polish, /grid\.replaceChildren\(videoGroup, audioGroup\)/);
  assert.match(resultUi, /download-action-grid[\s\S]*grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)!important/);
  assert.match(resultUi, /resource-action-group-buttons[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(resultUi, /report-download-button[\s\S]*grid-column:1\/-1!important[\s\S]*width:100%!important/);
});

test('mobile action groups keep all four buttons inside screen width', () => {
  assert.match(resultUi, /#video-download-actions[\s\S]*width:100%!important/);
  assert.match(resultUi, /@media\(max-width:650px\)[\s\S]*column-gap:8px!important/);
  assert.match(resultUi, /resource-action-group \.download-action-button[\s\S]*font:800 14px/);
  assert.match(resultUi, /resource-share-button[\s\S]*flex-direction:column!important/);
  assert.match(resultUi, /width:33px!important/);
});

test('video and audio sections are visually separated with larger centered controls', () => {
  assert.match(resultUi, /resource-action-group-video[\s\S]*linear-gradient/);
  assert.match(resultUi, /resource-action-group-audio[\s\S]*linear-gradient/);
  assert.match(resultUi, /resource-action-group-label[\s\S]*font:900 25px/);
  assert.match(resultUi, /download-action-button[\s\S]*min-height:72px!important[\s\S]*width:100%!important/);
  assert.match(resultUi, /justify-content:stretch!important/);
});

test('action row fully stretches both groups and aligns the last audio button with clear', () => {
  assert.match(resultUi, /resource-action-group[\s\S]*max-width:none!important[\s\S]*justify-self:stretch!important/);
  assert.match(resultLayout, /clear-url-button/);
  assert.match(resultLayout, /share-audio-button/);
  assert.match(resultLayout, /getBoundingClientRect\(\)/);
  assert.match(resultLayout, /rightInset = Math\.max\(0, audioRect\.right - lastRect\.right\)/);
  assert.match(resultLayout, /targetRight - actionRect\.left \+ rightInset/);
  assert.match(resultLayout, /grid\.style\.width = '100%'/);
});

test('report button uses a pale non-black treatment', () => {
  assert.match(resultUi, /report-download-button[\s\S]*background:linear-gradient/);
  assert.match(resultUi, /color:#53637c!important/);
  assert.doesNotMatch(resultUi, /report-download-button\{[\s\S]{0,500}background:var\(--button-bg\)!important/);
});

test('preview card keeps filename at the top on mobile and desktop', () => {
  assert.match(resultUi, /grid-template-areas:"thumb meta"!important/);
  assert.match(resultUi, /media-card>\.media-meta[\s\S]*display:flex!important[\s\S]*justify-content:flex-start!important/);
  assert.match(resultUi, /media-card>\.media-meta h2[\s\S]*order:1!important[\s\S]*margin:0!important/);
  assert.match(resultUi, /media-card>\.media-meta>span[\s\S]*order:2!important/);
  assert.match(resultUi, /thumb-wrap img[\s\S]*object-fit:cover!important/);
  assert.match(resultUi, /@media\(max-width:650px\)[\s\S]*grid-template-columns:minmax\(118px,42%\) minmax\(0,1fr\)!important/);
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

test('URL field becomes a smaller auto-growing three-line textarea before handlers mount', () => {
  assert.match(app, /document\.createElement\('textarea'\)/);
  assert.match(app, /u\.replaceWith\(t\)/);
  assert.match(app, /url-field-wrap\.js\?5/);
  assert.match(urlFieldWrap, /l\*3/);
  assert.match(urlFieldWrap, /font:700 16px\/1\.35/);
  assert.match(urlFieldWrap, /@media\(max-width:700px\)[\s\S]*font-size:15px/);
  assert.match(urlFieldWrap, /f\.form\?\.requestSubmit\(\)/);
});

test('result UI stays hidden until one final visual layer is ready', () => {
  assert.match(app, /r\.style\.opacity=0/);
  assert.match(app, /result-loader\.js\?7/);
  assert.match(app, /DownloadStarryResultReady/);
  assert.match(app, /r\.style\.opacity=1/);
  assert.match(resultLoader, /result-ui\.css\?v=20261015-7/);
  assert.match(resultLoader, /resource-actions\.js\?v=20261015-7/);
  assert.match(resultLoader, /result-polish\.js\?v=20261015-7/);
  assert.match(resultLoader, /result-layout\.js\?v=20261015-7/);
  assert.doesNotMatch(resultLoader, /result-visual-tune\.js/);
  assert.match(resultLoader, /downloadstarry-resource-actions-style/);
  assert.match(resultLoader, /downloadstarry-result-polish-style/);
  assert.match(resultLoader, /removeLegacyVisualLayers\(\)/);
});
