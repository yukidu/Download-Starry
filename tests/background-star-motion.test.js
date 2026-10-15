import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const text = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('background star layer is disabled so it no longer animates on phones', async () => {
  const style = await text('static/style.css');
  assert.match(style, /body:before\{display:none;/);
});
