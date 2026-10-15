import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const text = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('background star layer is disabled so it no longer animates on phones', async () => {
  const style = await text('static/style.css');
  assert.match(style, /body:before\{display:none;/);
});

test('heavy background orb and ambient sweep effects stay disabled', async () => {
  const compact = await text('static/compact.css');
  assert.match(compact, /\.cosmic-orb\s*\{[^}]*display:\s*none\s*!important;[^}]*animation:\s*none\s*!important;/s);
  assert.match(compact, /body::after\s*\{[^}]*content:\s*none\s*!important;[^}]*display:\s*none\s*!important;[^}]*animation:\s*none\s*!important;/s);
});
