import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const layout = fs.readFileSync(new URL('../static/result-layout.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../static/result-loader.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../static/app.js', import.meta.url), 'utf8');

test('parsed video and audio action groups always use two equal full-width columns', () => {
  assert.match(layout, /grid-template-columns/);
  assert.match(layout, /minmax\(0,1fr\) minmax\(0,1fr\)/);
  assert.match(layout, /videoGroup\.style\.setProperty\('grid-column', '1', 'important'\)/);
  assert.match(layout, /audioGroup\.style\.setProperty\('grid-column', '2', 'important'\)/);
  assert.match(layout, /reportButton\.style\.setProperty\('grid-column', '1 \/ -1', 'important'\)/);
  assert.doesNotMatch(layout, /getBoundingClientRect/);
  assert.doesNotMatch(layout, /viewportRight/);
});

test('download progress sits directly above the report button', () => {
  assert.match(layout, /grid\.insertBefore\(progressPanel, reportButton\)/);
  assert.match(layout, /result-download-progress/);
  assert.match(layout, /restoreProgressPanel/);
});

test('result layout cache version is refreshed together', () => {
  assert.match(loader, /result-layout\.js\?v=20261015-10/);
  assert.match(loader, /syncActionWidth/);
  assert.match(app, /result-loader\.js\?b/);
});
