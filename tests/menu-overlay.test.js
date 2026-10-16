import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const text = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('hamburger menu uses one full-viewport overlay on every route and keeps the panel clear', async () => {
  const css = await text('static/compact.css');
  assert.match(css, /\.main-menu-shell:not\(\[hidden\]\)\s*\{[\s\S]*position:\s*fixed!important;[\s\S]*inset:\s*0!important;[\s\S]*backdrop-filter:\s*blur\(1px\)/);
  assert.match(css, /background:\s*rgba\(15,\s*23,\s*42,\s*\.3\)/);
  assert.match(css, /body\.dark-theme\s+\.main-menu-shell:not\(\[hidden\]\)\s*\{[\s\S]*background:\s*rgba\(3,\s*8,\s*18,\s*\.4\)/);
  assert.match(css, /\.site-header:has\(\.main-menu-shell:not\(\[hidden\]\)\)\s*\{[\s\S]*backdrop-filter:\s*none!important/);
  assert.doesNotMatch(css, /\.main-menu-shell:not\(\[hidden\]\)::before/);
});

test('hamburger menu panel shrinks to its content instead of stretching full-page', async () => {
  const css = await text('static/compact.css');
  assert.match(css, /\.main-menu-shell:not\(\[hidden\]\)\s+\.main-menu-panel\s*\{[\s\S]*width:\s*max-content!important/);
  assert.match(css, /height:\s*max-content!important/);
  assert.match(css, /align-self:\s*flex-start!important/);
});
