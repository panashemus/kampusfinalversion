// Kampus Service Worker - handles web push notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'Kampus Alert', body: 'You have a new notification.' };
  try {
    if (event.data) data = event.data.json();
  } catch {
    if (event.data) data = { title: 'Kampus Alert', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Kampus Alert', {
      body: data.body || '',
      icon: '/images/ClipSnap_20260723201232.png',
      badge: '/images/ClipSnap_20260723201232.png',
      data: data.url ? { url: data.url } : {},
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
