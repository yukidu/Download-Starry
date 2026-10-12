'use strict';

const CACHE_NAME = 'savevideo-shell-v1';
const OFFLINE_URL = '/static/offline.html';
const SHELL_ASSETS = [
  '/static/style.css',
  '/static/custom.css',
  '/static/compact.css',
  '/static/provider-ui.css',
  '/static/platform.js',
  '/static/api.js',
  '/static/app.js',
  '/static/app-core.js',
  '/static/provider-ui.js',
  '/static/ui.js',
  '/static/manifest.webmanifest',
  '/static/app-icon.svg',
  OFFLINE_URL,
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API、下載進度與影音檔案永遠直接走網路，避免快取私人或過期資料。
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error())
    );
    return;
  }

  if (!url.pathname.startsWith('/static/')) return;

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) {
      event.waitUntil(
        fetch(request)
          .then(response => {
            if (response.ok) return caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
            return null;
          })
          .catch(() => null)
      );
      return cached;
    }

    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
