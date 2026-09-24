import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const targetUrl = new URL(data.url || '/laporan', self.location.origin);
  if (targetUrl.origin !== self.location.origin) targetUrl.href = new URL('/laporan', self.location.origin).href;
  event.waitUntil(
    self.registration.showNotification(data.title || 'Amelia Jaya', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: targetUrl.href },
      requireInteraction: true,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const requestedUrl = event.notification.data?.url || '/laporan';
    const targetUrl = new URL(requestedUrl, self.location.origin);
    if (targetUrl.origin !== self.location.origin) targetUrl.href = new URL('/laporan', self.location.origin).href;

    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const appWindow = windows.find((client) => client.url.startsWith(self.location.origin));
    if (appWindow) {
      try {
        await appWindow.navigate(targetUrl.href);
        return appWindow.focus();
      } catch {
        return self.clients.openWindow(targetUrl.href);
      }
    }
    return self.clients.openWindow(targetUrl.href);
  })());
});