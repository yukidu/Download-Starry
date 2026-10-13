import test from 'node:test';
import assert from 'node:assert/strict';
import {stat, readFile} from 'node:fs/promises';

const bytes = async path => (await stat(new URL(`../${path}`, import.meta.url))).size;

const HOMEPAGE_JS = [
  'static/app.js',
  'static/platform.js',
  'static/api.js',
  'static/app-core.js',
  'static/provider-ui.js',
  'static/ui.js',
];

const HOMEPAGE_CSS = [
  'static/style.css',
  'static/custom.css',
  'static/compact.css',
  'static/provider-ui.css',
];

test('web-first homepage JS stays within the requested-feature performance budget', async () => {
  const total = (await Promise.all(HOMEPAGE_JS.map(bytes))).reduce((sum, value) => sum + value, 0);
  assert.ok(total <= 71600, `homepage JS grew to ${total} bytes; budget is 71600`);
});

test('PWA install dialog code stays lazy-loaded until the user clicks install', async () => {
  const app = await readFile(new URL('../static/app.js', import.meta.url), 'utf8');
  const sourceList = app.match(/const sources = \[([^\]]+)\]/s)?.[1] || '';
  assert.doesNotMatch(sourceList, /install-pwa\.js/);
  assert.match(app, /load\('\/static\/install-pwa\.js'\)/);
});

test('Capacitor-ready work does not grow homepage CSS', async () => {
  const total = (await Promise.all(HOMEPAGE_CSS.map(bytes))).reduce((sum, value) => sum + value, 0);
  assert.ok(total <= 36000, `homepage CSS grew to ${total} bytes; budget is 36000`);
});

test('unused native stacks stay out of current web dependencies', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const names = Object.keys({...packageJson.dependencies, ...packageJson.devDependencies});
  assert.equal(names.some(name => name.startsWith('@capacitor/')), false);
  assert.equal(names.some(name => /firebase/i.test(name)), false);
});