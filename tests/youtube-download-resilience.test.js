import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleRequest} from '../cloudflare/access.js';

const password = 'test-only-password-123456789';
const req = path => new Request(`https://download.example${path}`);

test('active download progress survives a transient container 503', async () => {
  let calls = 0;
  const env = {
    AUTH_PASSWORD: password,
    DOWNLOADER: {getByName() { return {fetch() {
      calls++;
      if (calls === 1) return new Response('container reconnecting', {status: 503});
      return Response.json({status: 'downloading', progress: 9, downloaded_bytes: 3600000});
    }}; }},
  };
  const jobId = 'a'.repeat(32);
  const response = await handleRequest(req(`/api/download/${jobId}/progress`), env);
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.equal((await response.json()).progress, 9);
});

test('cloud YouTube downloads keep a longer heartbeat and faster transport tuning', async () => {
  const source = await readFile(new URL('../deployment/advanced_server.py', import.meta.url), 'utf8');
  assert.match(source, /CLIENT_HEARTBEAT_TIMEOUT\s*=\s*45/);
  assert.match(source, /concurrent_fragment_downloads["']\]\s*=\s*max\([\s\S]*?4,/);
  assert.match(source, /http_chunk_size["']\]\s*=\s*8\s*\*\s*1024\s*\*\s*1024/);
  assert.match(source, /throttled_rate["']\]\s*=\s*512\s*\*\s*1024/);
  assert.match(source, /platform_for_url\(url\)\s*==\s*["']YouTube["']/);
});
