import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const text = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('hamburger menu blurs and dims the page while keeping the menu panel above the overlay', async () => {
  const css = await text('static/compact.css');
  assert.match(css, /\.main-menu-shell:not\(\[hidden\]\)::before\s*\{[\s\S]*backdrop-filter:\s*blur\(4px\)/);
  assert.match(css, /background:\s*rgba\(15,\s*23,\s*42,\s*0\.8\)/);
  assert.match(css, /body\.dark-theme\s+\.main-menu-shell:not\(\[hidden\]\)::before\s*\{[\s\S]*background:\s*rgba\(3,\s*8,\s*18,\s*0\.8\)/);
  assert.match(css, /\.main-menu-shell:not\(\[hidden\]\)\s+\.main-menu-panel\s*\{[\s\S]*z-index:\s*1/);
});
