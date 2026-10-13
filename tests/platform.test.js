import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const text = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('loaded platform layer keeps only current web/native boundaries', async () => {
  const source = await text('static/platform.js');
  for (const capability of [
    'isWeb', 'isPWA', 'isCapacitor', 'isAndroid', 'isIOS', 'isStandalone',
    'clipboard', 'files', 'lifecycle', 'pwa',
  ]) assert.match(source, new RegExp(capability));
  assert.match(source, /SaveVideoNative/);
  assert.match(source, /beforeinstallprompt/);
  assert.match(source, /appinstalled/);
  assert.doesNotMatch(source, /@capacitor\//);
  assert.doesNotMatch(source, /addEventListener\(['"]online/);
  assert.doesNotMatch(source, /addEventListener\(['"]offline/);
});

test('runtime detection is snapshotted instead of recalculated by getters', async () => {
  const source = await text('static/platform.js');
  assert.match(source, /const runtime = Object\.freeze\(\{/);
  assert.doesNotMatch(source, /get isCapacitor\(\)/);
  assert.doesNotMatch(source, /get isAndroid\(\)/);
  assert.doesNotMatch(source, /get isIOS\(\)/);
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

test('PWA manifest and iOS web-app metadata remain available', async () => {
  const manifest = JSON.parse(await text('static/manifest.webmanifest'));
  const bootstrap = await text('static/app.js');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 1);
  assert.match(bootstrap, /\/static\/manifest\.webmanifest/);
  assert.match(bootstrap, /theme-color/);
  assert.match(bootstrap, /apple-mobile-web-app-capable/);
  assert.match(bootstrap, /apple-mobile-web-app-status-bar-style/);
});

test('service worker keeps API and static assets out of runtime cache interception', async () => {
  const source = await text('static/service-worker.js');
  assert.match(source, /pathname\.startsWith\('\/api\/'\)/);
  assert.match(source, /OFFLINE_URL/);
  assert.match(source, /request\.mode !== 'navigate'/);
  assert.doesNotMatch(source, /app-core\.js/);
  assert.doesNotMatch(source, /SHELL_ASSETS/);
  assert.doesNotMatch(source, /cache\.put\(/);
});

test('bootstrap preloads current core in parallel without Capacitor dependency', async () => {
  const bootstrap = await text('static/app.js');
  const packageJson = JSON.parse(await text('package.json'));
  assert.match(bootstrap, /rel = 'preload'/);
  assert.match(bootstrap, /Promise\.all\(\[/);
  assert.match(bootstrap, /\/static\/platform\.js/);
  assert.match(bootstrap, /\/static\/api\.js/);
  assert.match(bootstrap, /\/static\/app-core\.js/);
  assert.equal(Object.keys(packageJson.dependencies || {}).some(name => name.startsWith('@capacitor/')), false);
});