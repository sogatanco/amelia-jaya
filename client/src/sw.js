import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);
self.skipWaiting();
self.clientsClaim();

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const targetUrl = new URL(data.url || data.targetUrl || data.path || '/laporan', self.location.origin);
  if (targetUrl.origin !== self.location.origin) targetUrl.href = new URL('/laporan', self.location.origin).href;
  event.waitUntil(
    self.registration.showNotification(data.title || 'Amelia Jaya', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: targetUrl.href, targetUrl: targetUrl.href },
      requireInteraction: true,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const requestedUrl = event.notification.data?.url || event.notification.data?.targetUrl || '/laporan';
    const targetUrl = new URL(requestedUrl, self.location.origin);
    if (targetUrl.origin !== self.location.origin) targetUrl.href = new URL('/laporan', self.location.origin).href;

    // iOS Home Screen PWAs handle a fresh absolute open more reliably than
    // navigating an existing WindowClient from notificationclick.
    return self.clients.openWindow(targetUrl.href);
  })());
});