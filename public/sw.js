// Bump this version on each deploy that changes cached assets so the activate
// handler below evicts stale caches. Only same-origin static GET assets are
// cached; dynamic API traffic is deliberately never cached (see fetch handler).
const CACHE_NAME = "meals-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// Requests that must always hit the network and must NEVER be cached.
// /api/* is dynamic shared state guarded by ETag optimistic concurrency and a
// 3s poll — caching it would serve stale state and break sync entirely.
function isNeverCacheable(url) {
  return url.pathname.startsWith("/api/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET requests are eligible for any caching consideration.
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Never intercept cross-origin requests or dynamic API calls: let them go
  // straight to the network with no cache read or write.
  if (url.origin !== self.location.origin || isNeverCacheable(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Network-first for static same-origin assets: try the server, cache the
  // successful response for offline fallback, and fall back to cache offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
