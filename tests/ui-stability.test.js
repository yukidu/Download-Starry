import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('貼上網址按鈕文字固定，不再跟著解析狀態切換', async () => {
  const app = await read('static/app.js');
  const fix = await read('static/ui-stability.js');
  assert.match(app, /\/static\/ui-stability\.js\?v=20261015-1/);
  assert.match(fix, /paste-url-button/);
  assert.match(fix, /pasteButton\.textContent !== '貼上網址'/);
  assert.match(fix, /pasteButton\.textContent = '貼上網址'/);
  assert.match(fix, /MutationObserver\(pinPasteLabel\)/);
  assert.match(fix, /lookupButton\.style\.setProperty\('display', 'none', 'important'\)/);
});

test('進階會員按鈕會先移除舊回報按鈕的點擊事件再交給新功能', async () => {
  const app = await read('static/app.js');
  const toolbar = await read('static/toolbar.js');
  const fix = await read('static/ui-stability.js');
  const advanced = await read('static/advanced-member.js');
  assert.match(toolbar, /parsed\?\.addEventListener\('click'/);
  assert.match(fix, /legacyAdvancedButton\.cloneNode\(true\)/);
  assert.match(fix, /legacyAdvancedButton\.replaceWith\(cleanAdvancedButton\)/);
  assert.match(fix, /進階功能｜會員限定/);
  assert.match(advanced, /toggle\.addEventListener\('click'/);
  assert.ok(app.indexOf('/static/toolbar.js') < app.indexOf('/static/ui-stability.js?v=20261015-1'));
});
