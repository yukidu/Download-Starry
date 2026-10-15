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

test('share files are prepared after parsing before the user taps share', () => {
  assert.match(share, /const prepareAll = async \(\) =>/);
  assert.match(share, /videoReady = await prepareType\('video', token\)/);
  assert.match(share, /audioReady = await prepareType\('audio', token\)/);
  assert.match(share, /button\.disabled = !ready/);
  assert.match(share, /button\.dataset\.shareReady = ready \? '1' : '0'/);
  assert.match(share, /queueMicrotask\(\(\) => \{ if \(!result\.hidden\) void prepareAll\(\); \}\)/);
});

test('one tap calls native file share immediately from the click handler path', () => {
  assert.match(share, /const sharePrepared = type =>/);
  assert.match(share, /shareResult = share\.file\(cached\.file, sharePayload\(type\)\)/);
  assert.match(share, /shareVideo\.addEventListener\('click', \(\) => sharePrepared\('video'\)\)/);
  assert.match(share, /shareAudio\.addEventListener\('click', \(\) => sharePrepared\('audio'\)\)/);
  assert.doesNotMatch(share, /await share\.file/);
  assert.doesNotMatch(share, /點此分享|pendingShare|禁止在檔案準備完成後自動叫出分享選單/);
});

test('new share flow has fresh cache versions', () => {
  assert.match(loader, /share-one-tap\.js\?v=20261015-2/);
  assert.match(app, /result-loader\.js\?b/);
});
