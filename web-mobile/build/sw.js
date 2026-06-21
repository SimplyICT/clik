const CACHE = 'simplyclik-m-v2';
const ASSETS = ['/mobile/', '/mobile/manifest.json', '/mobile/icon-192.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// Push notification handling
self.addEventListener('push', (e) => {
  let data = { title: 'SimplyClik', body: 'New job available' };
  try {
    if (e.data) data = e.data.json();
  } catch {}
  
  const options = {
    body: data.body,
    icon: '/mobile/icon-192.svg',
    badge: '/mobile/icon-192.svg',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/mobile/' },
  };

  e.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const urlToOpen = e.notification.data?.url || '/mobile/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(urlToOpen);
    })
  );
});
