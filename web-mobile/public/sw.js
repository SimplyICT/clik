const CACHE = 'simplyclik-mobile';
const VERSION = 1;

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith('simplyclik-mobile')).map(k => caches.delete(k))
    )).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Never cache API or sw.js
  if (url.pathname.startsWith('/api/') || url.pathname === '/mobile/sw.js') {
    e.respondWith(fetch(e.request));
    return;
  }

  // Network-first for everything else
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

self.addEventListener('push', (e) => {
  let data = { title: 'SimplyClik', body: 'New job available' };
  try { if (e.data) data = e.data.json(); } catch {}
  const opts = {
    body: data.body,
    icon: '/mobile/icon-192.svg',
    badge: '/mobile/icon-192.svg',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/mobile/' },
  };
  e.waitUntil(self.registration.showNotification(data.title, opts));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/mobile/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
