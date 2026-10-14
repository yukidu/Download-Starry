import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const resourceActions = fs.readFileSync(new URL('../static/resource-actions.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../static/app.js', import.meta.url), 'utf8');

test('resource action layout keeps two columns and report full width', () => {
  assert.match(resourceActions, /repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(resourceActions, /report-download-button\{grid-column:1\/-1/);
  assert.match(resourceActions, /分享影片/);
  assert.match(resourceActions, /分享音檔/);
  assert.match(resourceActions, /回報當前資源無法下載/);
});

test('resource share invokes native or Web Share and remains lazy-loaded', () => {
  assert.match(resourceActions, /navigator\.share/);
  assert.match(resourceActions, /SaveVideoNative/);
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