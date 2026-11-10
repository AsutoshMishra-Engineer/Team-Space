// TeamSpace Production Service Worker for Android Web Push
function toSameOriginPath(rawUrl) {
  try {
    const resolved = new URL(rawUrl || '/', self.location.origin);
    if (resolved.origin === self.location.origin) {
      return resolved.href;
    }
  } catch (e) {
    // ignore invalid URL
  }
  return self.location.origin + '/';
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Allow client pages to trigger native system notifications via ServiceWorker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    const origin = self.location.origin;
    const resolvedOptions = {
      icon: origin + '/logo.png',
      badge: origin + '/logo.png',
      vibrate: [300, 100, 300, 100, 300],
      renotify: true,
      requireInteraction: true,
      silent: false,
      ...options
    };
    self.registration.showNotification(title || '📢 TeamSpace Alert', resolvedOptions);
  }
});

// Listen for Web Push events from Google FCM (even when Chrome/App is completely closed)
self.addEventListener('push', (event) => {
  const origin = self.location.origin;
  let data = {
    title: '📢 TeamSpace Alert',
    body: 'New update from your team workspace!',
    icon: origin + '/logo.png',
    badge: origin + '/logo.png',
    url: '/',
    tag: 'teamspace-alert'
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const iconUrl = origin + '/logo.png';
  const safeTargetUrl = toSameOriginPath(data.url);
  const options = {
    body: data.body,
    icon: iconUrl,
    badge: iconUrl,
    tag: data.tag ? `${data.tag}-${Date.now()}` : `teamspace-${Date.now()}`,
    vibrate: [300, 100, 300, 100, 300],
    data: {
      url: safeTargetUrl,
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: '👀 Open' }
    ],
    renotify: true,
    requireInteraction: true,
    silent: false
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Click notification to open or focus the app (same-origin enforced)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = toSameOriginPath(event.notification.data?.url);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client && client.url && client.url.startsWith(self.location.origin)) {
          client.focus();
          if ('navigate' in client && targetUrl !== self.location.origin + '/') {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  // Clean up if needed
});
