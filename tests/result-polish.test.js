import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const polish = fs.readFileSync(new URL('../static/result-polish.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../static/app.js', import.meta.url), 'utf8');

test('four primary actions are wrapped in a dedicated 2x2 grid', () => {
  assert.match(polish, /primaryGrid\.replaceChildren\(videoButton, shareVideo, audioButton, shareAudio\)/);
  assert.match(polish, /download-primary-2x2/);
  assert.match(polish, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(polish, /grid-template-rows:repeat\(2,minmax\(58px,auto\)\)!important/);
  assert.match(polish, /grid\.replaceChildren\(primaryGrid\)/);
  assert.match(polish, /report-download-button[\s\S]*width:100%!important/);
});

test('preview card keeps filename at the top on mobile and desktop', () => {
  assert.match(polish, /grid-template-areas:"thumb meta"!important/);
  assert.match(polish, /media-card>\.media-meta[\s\S]*display:flex!important[\s\S]*justify-content:flex-start!important/);
  assert.match(polish, /media-card>\.media-meta h2[\s\S]*order:1!important[\s\S]*margin:0!important/);
  assert.match(polish, /media-card>\.media-meta>span[\s\S]*order:2!important/);
  assert.match(polish, /thumb-wrap img[\s\S]*object-fit:cover!important/);
  assert.match(polish, /@media\(max-width:650px\)[\s\S]*grid-template-columns:minmax\(118px,42%\) minmax\(0,1fr\)!important/);
});

test('share buttons use device-specific icons and larger mobile sizing', () => {
  assert.match(polish, /platform\?\.runtime\?\.isIOS/);
  assert.match(polish, /platform\?\.runtime\?\.isAndroid/);
  assert.match(polish, /resource-share-icon-ios/);
  assert.match(polish, /resource-share-icon-android/);
  assert.match(polish, /width:32px!important/);
  assert.match(polish, /button\.dataset\.shareDevice/);
});

test('parsed URL is returned to the beginning of the visible input', () => {
  assert.match(polish, /urlInput\.setSelectionRange\(0, 0\)/);
  assert.match(polish, /urlInput\.scrollLeft = 0/);
  assert.match(polish, /observer\.observe\(result, \{attributes: true, attributeFilter: \['hidden'\]\}\)/);
});

test('result UI scripts are cache-busted and loaded in order', () => {
  assert.match(app, /resource-actions\.js\?v=20261015-2/);
  assert.match(app, /result-polish\.js\?v=20261015-2/);
});
