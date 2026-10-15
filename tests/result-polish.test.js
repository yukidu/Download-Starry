import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const polish = fs.readFileSync(new URL('../static/result-polish.js', import.meta.url), 'utf8');
const resultUi = fs.readFileSync(new URL('../static/result-ui.css', import.meta.url), 'utf8');
const resultLayout = fs.readFileSync(new URL('../static/result-layout.js', import.meta.url), 'utf8');
const urlFieldWrap = fs.readFileSync(new URL('../static/url-field-wrap.js', import.meta.url), 'utf8');
const resultLoader = fs.readFileSync(new URL('../static/result-loader.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../static/app.js', import.meta.url), 'utf8');
const advancedCss = fs.readFileSync(new URL('../static/advanced-member.css', import.meta.url), 'utf8');

test('four primary actions stay on one row as two full-width groups', () => {
  assert.match(polish, /resource-action-group-video/);
  assert.match(polish, /resource-action-group-audio/);
  assert.match(polish, /ensureActionGroup\(grid, 'resource-action-group-video', '影片', videoButton, shareVideo\)/);
  assert.match(polish, /ensureActionGroup\(grid, 'resource-action-group-audio', '音檔', audioButton, shareAudio\)/);
  assert.match(polish, /grid\.replaceChildren\(videoGroup, audioGroup\)/);
  assert.match(resultUi, /download-action-grid[\s\S]*grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)!important/);
  assert.match(resultUi, /resource-action-group-buttons[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
});

test('button labels remove repeated media words but keep section headings', () => {
  assert.match(polish, /renderDownloadButton\(videoButton, '下載'\)/);
  assert.match(polish, /renderDownloadButton\(audioButton, '下載'\)/);
  assert.match(polish, /renderShareButton\(shareVideo, '分享'\)/);
  assert.match(polish, /renderShareButton\(shareAudio, '分享'\)/);
  assert.doesNotMatch(polish, /'下載影片'|'下載音檔'|'分享影片'|'分享音檔'/);
  assert.match(polish, /labelNode\.textContent = label/);
});

test('download buttons include a visible download icon', () => {
  assert.match(polish, /resource-download-icon/);
  assert.match(polish, /const renderDownloadButton/);
  assert.match(polish, /button\.innerHTML = `\$\{downloadIcon\}\$\{label\}`/);
  assert.match(polish, /button\.style\.setProperty\('flex-direction', 'column', 'important'\)/);
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

test('action row uses fixed equal columns without measuring the clear button', () => {
  assert.match(resultUi, /resource-action-group[\s\S]*max-width:none!important[\s\S]*justify-self:stretch!important/);
  assert.match(resultLayout, /grid-template-columns/);
  assert.match(resultLayout, /minmax\(0,1fr\) minmax\(0,1fr\)/);
  assert.match(resultLayout, /videoGroup\.style\.setProperty\('grid-column', '1', 'important'\)/);
  assert.match(resultLayout, /audioGroup\.style\.setProperty\('grid-column', '2', 'important'\)/);
  assert.doesNotMatch(resultLayout, /clear-url-button/);
  assert.doesNotMatch(resultLayout, /getBoundingClientRect/);
});

test('member advanced toggle is centered and compact in the old report area', () => {
  assert.match(advancedCss, /advanced-member-toggle/);
  assert.match(resultLayout, /width', 'min\(82%, 480px\)'/);
  assert.match(resultLayout, /min-height', '46px'/);
  assert.match(resultLayout, /justify-self', 'center'/);
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

test('URL field extracts the first http URL from pasted ad text', () => {
  assert.match(app, /url-field-wrap\.js\?6/);
  assert.match(urlFieldWrap, /match\(\/https\?:\\\/\\\/\\S\+\/i\)/);
  assert.match(urlFieldWrap, /extractHttpUrl:u/);
  assert.match(urlFieldWrap, /f\.form\?\.addEventListener\('submit'/);
  assert.match(urlFieldWrap, /f\.form\?\.requestSubmit\(\)/);
});

test('URL field remains a smaller auto-growing three-line textarea before handlers mount', () => {
  assert.match(app, /document\.createElement\('textarea'\)/);
  assert.match(app, /u\.replaceWith\(t\)/);
  assert.match(urlFieldWrap, /l\*3/);
  assert.match(urlFieldWrap, /font:700 16px\/1\.35/);
  assert.match(urlFieldWrap, /@media\(max-width:700px\)[\s\S]*font-size:15px/);
});

test('second parse cannot restore the old all-black legacy button layer', () => {
  assert.match(resultLoader, /const polishStyle = document\.getElementById\('downloadstarry-result-polish-style'\)/);
  assert.match(resultLoader, /polishStyle\.textContent = ''/);
  assert.match(resultLoader, /polishStyle\.dataset\.neutralized = '1'/);
  assert.match(resultUi, /resource-action-group-video \.download-action-button[\s\S]*#7447d7/);
  assert.match(resultUi, /resource-action-group-audio \.download-action-button[\s\S]*#2f8bd6/);
});

test('result UI stays hidden until one final visual layer is ready', () => {
  assert.match(app, /r\.style\.opacity=0/);
  assert.match(app, /result-loader\.js\?e/);
  assert.match(app, /DownloadStarryResultReady/);
  assert.match(app, /r\.style\.opacity=1/);
  assert.match(resultLoader, /result-ui\.css\?v=20261015-11/);
  assert.match(resultLoader, /resource-actions\.js\?v=20261015-11/);
  assert.match(resultLoader, /result-polish\.js\?v=20261015-11/);
  assert.match(resultLoader, /result-layout\.js\?v=20261015-11/);
  assert.match(resultLoader, /share-one-tap\.js\?v=20261015-4/);
  assert.match(resultLoader, /advanced-member\.js\?v=20261015-1/);
  assert.match(resultLoader, /advanced-preview-guard\.js\?v=20261015-1/);
  assert.doesNotMatch(resultLoader, /result-visual-tune\.js/);
  assert.match(resultLoader, /downloadstarry-resource-actions-style/);
  assert.match(resultLoader, /downloadstarry-result-polish-style/);
  assert.match(resultLoader, /removeLegacyVisualLayers\(\)/);
});
