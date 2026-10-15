import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const share = fs.readFileSync(new URL('../static/share-one-tap.js', import.meta.url), 'utf8');
const layout = fs.readFileSync(new URL('../static/result-layout.js', import.meta.url), 'utf8');
const providerCss = fs.readFileSync(new URL('../static/provider-ui.css', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../static/result-loader.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../static/app.js', import.meta.url), 'utf8');

test('download progress is moved immediately above the report button', () => {
  assert.match(layout, /grid\.insertBefore\(progressPanel, reportButton\)/);
  assert.match(layout, /progressPanel\.style\.setProperty\('grid-column', '1 \/ -1'/);
  assert.match(layout, /restoreProgressPanel/);
});

test('pasted URL compacts provider logos into exactly two rows', () => {
  assert.match(providerCss, /body:has\(#url:not\(:placeholder-shown\)\) \.platform-icons/);
  assert.match(providerCss, /grid-template-columns:repeat\(8,minmax\(0,1fr\)\)!important/);
  assert.match(providerCss, /grid-template-rows:repeat\(2,auto\)!important/);
  assert.match(providerCss, /width:36px!important/);
});

test('parsing a URL never starts video or audio preparation automatically', () => {
  assert.match(share, /const prepareShare = async type =>/);
  assert.match(share, /shareVideo\.addEventListener\('click', \(\) => sharePrepared\('video'\)\)/);
  assert.match(share, /shareAudio\.addEventListener\('click', \(\) => sharePrepared\('audio'\)\)/);
  assert.doesNotMatch(share, /prepareAll/);
  assert.doesNotMatch(share, /queueMicrotask[\s\S]*prepare/);
  assert.doesNotMatch(share, /else void prepare/);
});

test('first share tap prepares only the selected format and second tap opens native share', () => {
  assert.match(share, /void prepareShare\(type\)/);
  assert.match(share, /api\.startDownload\(\{[\s\S]*type,[\s\S]*quality:/);
  assert.match(share, /setShareLabel\(type, '點此分享'\)/);
  assert.match(share, /shareResult = share\.file\(cached\.file, sharePayload\(type\)\)/);
  assert.match(share, /button\.dataset\.shareReady = '1'/);
});

test('new manual share flow has fresh cache versions', () => {
  assert.match(loader, /share-one-tap\.js\?v=20261015-3/);
  assert.match(app, /result-loader\.js\?c/);
});
