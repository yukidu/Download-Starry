import test from 'node:test';
import assert from 'node:assert/strict';
import {authorize, allowedRoute, handleRequest, digest} from '../cloudflare/access.js';

const password = 'test-only-password-123456789';
const env = {AUTH_PASSWORD: password};
const req = (path = '/', options = {}) => new Request(`https://video.example${path}`, options);

test('missing internal secret fails closed without starting any container', async () => {
  assert.equal((await handleRequest(req(), {})).status, 503);
});
test('anonymous access is allowed and visitor credentials are ignored', async () => {
  assert.equal(await authorize(req(), env), null);
  assert.equal(await authorize(req('/', {headers: {Authorization: 'Basic %%%'}}), env), null);
});
test('cross-site state changes are still blocked', async () => {
  const crossSite = req('/api/download', {method: 'POST', headers: {
    Origin: 'https://other.example',
  }});
  assert.equal((await authorize(crossSite, env)).status, 403);
});
test('desktop control routes and unsupported methods are not exposed', () => {
  assert.equal(allowedRoute('/api/integration/update', 'POST'), false);
  assert.equal(allowedRoute('/api/download', 'DELETE'), false);
  assert.equal(allowedRoute('/api/download/' + 'a'.repeat(32) + '/file', 'GET'), true);
});
test('anonymous forwarding uses one stable instance, replaces spoofed tokens and streams files', async () => {
  let upstream;
  const backend = {...env, DOWNLOADER: {getByName(name) {
    assert.equal(name, 'personal-downloader');
    return {fetch(request) {
      upstream = request;
      return new Response('file-bytes', {headers: {'Content-Disposition': 'attachment; filename="video.mp4"'}});
    }};
  }}};
  const response = await handleRequest(req('/api/download/' + 'a'.repeat(32) + '/file', {headers: {
    Authorization: 'Basic ignored-by-public-site', 'X-Backend-Token': 'spoof', Cookie: 'private=cookie', Range: 'bytes=0-9',
  }}), backend);
  assert.equal(upstream.headers.get('X-Backend-Token'), await digest(`backend:${password}`));
  assert.equal(upstream.headers.get('Authorization'), null);
  assert.equal(upstream.headers.get('Cookie'), null);
  assert.equal(upstream.headers.get('Range'), 'bytes=0-9');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.match(response.headers.get('Content-Disposition'), /attachment/);
  assert.equal(await response.text(), 'file-bytes');
});
test('container startup failure returns a retryable error', async () => {
  const broken = {...env, DOWNLOADER: {getByName() {return {fetch() {throw new Error('internal detail');}};}}};
  const response = await handleRequest(req('/'), broken);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /internal detail/);
});
test('transient static resource failures retry without duplicating download POSTs', async () => {
  let calls = 0;
  const backend = {...env, DOWNLOADER: {getByName() {return {fetch() {
    calls++;
    return calls === 1 ? new Response('starting', {status: 503}) : new Response('/* css */');
  }};}}};
  const response = await handleRequest(req('/static/style.css'), backend);
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  calls = 0;
  const post = await handleRequest(req('/api/download', {method: 'POST', body: 'url=test'}), backend);
  assert.equal(post.status, 503);
  assert.equal(calls, 1);
});
