import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const polish = fs.readFileSync(new URL('../static/result-polish.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../static/app.js', import.meta.url), 'utf8');

test('A layout keeps four equal primary actions in a 2x2 grid', () => {
  assert.match(polish, /grid\.replaceChildren\(videoButton, shareVideo, audioButton, shareAudio\)/);
  assert.match(polish, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(polish, /download-action-grid>\.download-action-button/);
  assert.match(polish, /min-height:58px!important/);
  assert.match(polish, /border-radius:14px!important/);
  assert.match(polish, /report-download-button[\s\S]*grid-column:1\/-1!important/);
});

test('preview card keeps thumbnail left and title top-right without extra grid row', () => {
  assert.match(polish, /grid-template-areas:"thumb meta"!important/);
  assert.match(polish, /grid-template-rows:auto!important/);
  assert.match(polish, /media-card>\.media-meta[\s\S]*align-self:start!important/);
  assert.match(polish, /result:not\(\[hidden\]\) \.media-card[\s\S]*margin:12px 0 0!important/);
  assert.match(polish, /@media\(max-width:650px\)[\s\S]*grid-template-columns:minmax\(118px,42%\) minmax\(0,1fr\)!important/);
});

test('parsed URL is returned to the beginning of the visible input', () => {
  assert.match(polish, /urlInput\.setSelectionRange\(0, 0\)/);
  assert.match(polish, /urlInput\.scrollLeft = 0/);
  assert.match(polish, /observer\.observe\(result, \{attributes: true, attributeFilter: \['hidden'\]\}\)/);
});

test('result polish loads after resource actions', () => {
  assert.match(app, /resource-actions\.js'\)\.then\(\(\)=>L\('\/static\/result-polish\.js'\)\)/);
});
