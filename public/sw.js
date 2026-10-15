// Private pages and payment proofs are never cached. Internet is required.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') event.respondWith(fetch(event.request).catch(() => new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Rentmate · Offline</title><body style="font:18px system-ui;padding:48px;background:#f5f5f7;color:#1d1d1f"><h1>You’re offline.</h1><p>Connect to the internet to use Rentmate.</p><button onclick="location.reload()">Try again</button></body></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })));
});
