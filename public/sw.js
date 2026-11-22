/*
 * FitTracker service worker. It does one thing: when a page load fails
 * because the device is offline, it shows /offline.html instead of the
 * browser's error page.
 *
 * It deliberately caches nothing else. Pages and API responses are private
 * and change constantly, so they always come from the network.
 */
const CACHE = "ft-offline-v2";
const OFFLINE_ASSETS = ["/offline.html", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(OFFLINE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // Only full page loads. Everything else is left to the browser untouched.
  if (request.mode !== "navigate" || request.method !== "GET") return;

  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch {
        const cached = await caches.match("/offline.html");
        return cached || Response.error();
      }
    })()
  );
});
