// Self-unregistering service worker - old SW caused navigation issues
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => {
  self.registration.unregister();
  clients.matchAll({ type: 'window' }).then(clients => clients.forEach(c => c.navigate(c.url)));
});