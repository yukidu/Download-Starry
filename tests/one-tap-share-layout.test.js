import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const share = fs.readFileSync(new URL('../static/share-one-tap.js', import.meta.url), 'utf8');
const layout = fs.readFileSync(new URL('../static/result-layout.js', import.meta.url), 'utf8');
const providerCss = fs.readFileSync(new URL('../static/provider-ui.css', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../static/result-loader.js', import.meta.url), 'utf8');

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

test('share buttons run one automatic download-to-native-share flow without second tap', () => {
  assert.match(share, /cloneNode\(true\)/);
  assert.match(share, /const oneTapShare = async type/);
  assert.match(share, /await share\.file\(file, sharePayload\(type\)\)/);
  assert.match(share, /shareVideo\.addEventListener\('click', \(\) => oneTapShare\('video'\)\)/);
  assert.match(share, /shareAudio\.addEventListener\('click', \(\) => oneTapShare\('audio'\)\)/);
  assert.doesNotMatch(share, /點此分享|pendingShare/);
  assert.match(loader, /share-one-tap\.js\?v=20261015-1/);
});
