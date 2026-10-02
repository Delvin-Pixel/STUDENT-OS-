/* Student OS — offline-first service worker. Caches the app shell so core
   features keep working without an internet connection after first load. */
const CACHE = "studentos-v15";
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/logo.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];
const PRECACHE_MANIFEST = "/precache.json";

self.addEventListener("install", event => {
  // A partial shell must not replace the last known-good worker. If a required
  // asset is unavailable, installation fails and the previous worker remains.
  event.waitUntil(
    caches.open(CACHE).then(async cache => {
      let emittedAssets = [];
      try {
        const response = await fetch(PRECACHE_MANIFEST, { cache: "no-store" });
        if (response.ok) {
          const parsed = await response.json();
          if (Array.isArray(parsed))
            emittedAssets = parsed.filter(
              value =>
                typeof value === "string" &&
                value.startsWith("/") &&
                !value.startsWith("//")
            );
        }
      } catch {
        // Development and older deployments may not expose a manifest; the shell remains usable.
      }
      await cache.addAll([...new Set([...SHELL, ...emittedAssets])]);
      // Critical: only make the new worker active after precaching succeeds.
      await self.skipWaiting();
    })
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE && k.startsWith("studentos-"))
            .map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* Network-first for navigation, falls back to cache when offline */
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  // Account, workspace, and push requests must always reach the server. Never
  // place an authenticated response in the device-wide Cache API.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/storage/"))
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(cache => cache.put("/", clone));
          }
          return res;
        })
        .catch(() => caches.match("/").then(r => r || caches.match(SHELL[0])))
    );
    return;
  }
  /* Keep application code fresh after a release, but retain its last working
     copy for offline use. This also prevents an installed client from holding
     an older page module after a Student OS update. */
  if (
    url.pathname.startsWith("/src/") ||
    ["script", "style", "worker"].includes(event.request.destination)
  ) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res.ok)
            caches
              .open(CACHE)
              .then(cache => cache.put(event.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  /* Static media can remain cache-first. */
  event.respondWith(
    caches.match(event.request).then(
      r =>
        r ||
        fetch(event.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, clone));
          }
          return res;
        })
    )
  );
});

self.addEventListener("push", event => {
  let payload = {
    title: "Student OS",
    body: "You have a study reminder.",
    targetUrl: "/",
    tag: "studentos-reminder",
  };
  try {
    payload = { ...payload, ...(event.data ? event.data.json() : {}) };
  } catch {
    payload.body = event.data?.text() || payload.body;
  }
  const vibration = Array.isArray(payload.vibration)
    ? payload.vibration
        .filter(value => Number.isInteger(value) && value >= 0 && value <= 1000)
        .slice(0, 8)
    : undefined;
  const options = {
    body: payload.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag,
    data: { targetUrl: payload.targetUrl || "/" },
    renotify: false,
  };
  if (vibration?.length) options.vibrate = vibration;
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const requestedTarget = new URL(
    event.notification.data?.targetUrl || "/",
    self.location.origin
  );
  const targetUrl =
    requestedTarget.origin === self.location.origin
      ? requestedTarget.href
      : new URL("/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find(client =>
        client.url.startsWith(self.location.origin)
      );
      if (existing) {
        await existing.focus();
        return existing.navigate(targetUrl);
      }
      return clients.openWindow(targetUrl);
    })()
  );
});
