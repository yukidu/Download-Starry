import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const text = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('platform layer exposes shared runtime and device capability boundaries', async () => {
  const source = await text('static/platform.js');
  for (const capability of [
    'isWeb', 'isPWA', 'isCapacitor', 'isAndroid', 'isIOS', 'isStandalone',
    'clipboard', 'storage', 'files', 'browser', 'network', 'lifecycle', 'pwa', 'version',
  ]) {
    assert.match(source, new RegExp(capability));
  }
  assert.match(source, /SaveVideoNative/);
  assert.doesNotMatch(source, /@capacitor\//);
});

test('download core uses platform and API services instead of direct device APIs', async () => {
  const source = await text('static/app-core.js');
  assert.match(source, /SaveVideoPlatform/);
  assert.match(source, /SaveVideoAPI/);
  assert.doesNotMatch(source, /navigator\.clipboard/);
  assert.doesNotMatch(source, /window\.showDirectoryPicker/);
  assert.doesNotMatch(source, /navigator\.sendBeacon/);
  assert.doesNotMatch(source, /fetch\(['"`]\/api\//);
});

test('API endpoints are centralized and default to same-origin', async () => {
  const source = await text('static/api.js');
  assert.match(source, /app-api-base/);
  assert.match(source, /apiBaseUrl/);
  assert.match(source, /endpoint\('\/api\/info'\)/);
  assert.match(source, /endpoint\('\/api\/download'\)/);
  assert.doesNotMatch(source, /workers\.dev/);
  assert.doesNotMatch(source, /download\.starry\.phd/);
});

test('PWA manifest remains web-first and standalone capable', async () => {
  const manifest = JSON.parse(await text('static/manifest.webmanifest'));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 1);
});

test('service worker never caches API/download responses', async () => {
  const source = await text('static/service-worker.js');
  assert.match(source, /pathname\.startsWith\('\/api\/'\)/);
  assert.match(source, /OFFLINE_URL/);
  assert.match(source, /app-core\.js/);
  assert.doesNotMatch(source, /cache\.addAll\([^)]*\/api\//s);
});

test('bootstrap loads platform, API, then shared core without Capacitor dependency', async () => {
  const bootstrap = await text('static/app.js');
  const packageJson = JSON.parse(await text('package.json'));
  assert.ok(bootstrap.indexOf('/static/platform.js') < bootstrap.indexOf('/static/api.js'));
  assert.ok(bootstrap.indexOf('/static/api.js') < bootstrap.indexOf('/static/app-core.js'));
  assert.equal(Object.keys(packageJson.dependencies || {}).some(name => name.startsWith('@capacitor/')), false);
});
