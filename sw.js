/**
 * Cairo Business — Service Worker
 *
 * Handles:
 *   1. Web Push notifications (push event → show notification)
 *   2. Notification click (focus tab or open URL)
 *   3. Basic offline page (optional)
 */

const VERSION = 'cb-sw-v3-2026-05-25';

self.addEventListener('install', (event) => {
  /* Activate immediately on first install */
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  /* On activation: delete ALL old caches from previous Workbox-based SW versions
     so users immediately see fresh HTML/JS from the network. */
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (_) {}
      await self.clients.claim();
      /* Force open clients to reload so they pick up the fresh HTML */
      try {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of clients) {
          if ('navigate' in c) {
            try { c.navigate(c.url); } catch (_) {}
          }
        }
      } catch (_) {}
    })()
  );
});

/* Bypass cache for navigations & API calls — always go to network.
   This guarantees fresh HTML and JSON whenever the user opens the site. */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  /* Only intercept requests to our own origin and to the backend API */
  const isApi = url.hostname.includes('cairo-business-backend.vercel.app');
  const isOurSite = url.hostname === 'cairobusiness.net' || url.hostname.endsWith('.cairobusiness.net');
  if (!isApi && !isOurSite) return; /* let other origins be handled normally */
  /* For our HTML/JS/CSS and API calls — always fetch from network, never cache */
  event.respondWith(
    fetch(req, { cache: 'no-store' }).catch(() => fetch(req))
  );
});

/* Receive push from server and show notification */
self.addEventListener('push', (event) => {
  let data = { title: 'Cairo Business', body: 'تحديث جديد على الموقع', url: 'https://cairobusiness.net', icon: 'https://cairobusiness.net/og-image.jpg' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = Object.assign(data, parsed);
    }
  } catch (_) {
    try { data.body = event.data.text(); } catch (_) {}
  }

  const options = {
    body: data.body,
    icon: data.icon || 'https://cairobusiness.net/og-image.jpg',
    badge: data.badge || 'https://cairobusiness.net/og-image.jpg',
    data: { url: data.url || 'https://cairobusiness.net' },
    dir: 'rtl',
    lang: 'ar',
    requireInteraction: false,
    tag: data.tag || 'cb-news',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

/* Open URL on notification click — focus existing tab if possible */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || 'https://cairobusiness.net/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url === targetUrl && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

/* Handle subscription expiration — request fresh sub */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options).then((sub) => {
      return fetch('https://cairo-business-backend.vercel.app/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
            auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
          },
          userAgent: 'sw-renewal',
        }),
      });
    })
  );
});
