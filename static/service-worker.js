'use strict';

const CACHE_NAME = 'downloadstarry-offline-v3';
const OFFLINE_URL = '/static/offline.html';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => (key.startsWith('savevideo-') || key.startsWith('downloadstarry-')) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error())
  );
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json?.() || {}; } catch (_) {
    data = {body: event.data?.text?.() || ''};
  }
  const title = String(data.title || '繁星下載');
  const options = {
    body: String(data.body || ''),
    icon: '/static/app-icon.svg?v=4',
    badge: '/static/app-icon.svg?v=4',
    tag: String(data.tag || 'downloadstarry'),
    renotify: true,
    data: {url: String(data.url || '/account')},
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification?.data?.url || '/account', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    for (const client of windows) {
      if ('focus' in client && new URL(client.url).origin === self.location.origin) {
        if ('navigate' in client) await client.navigate(target).catch(() => undefined);
        return client.focus();
      }
    }
    return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
  })());
});
