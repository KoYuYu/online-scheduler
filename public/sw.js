const CACHE_NAME = "online-scheduler-pwa-v3";
const APP_SHELL_URLS = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/app-icon-fashion-192.png",
  "/icons/app-icon-fashion-512.png",
  "/icons/app-icon-fashion-1024.png",
  "/icons/app-icon-fashion-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .catch(() => undefined)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (shouldCacheAsset(request, url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event);
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || "/icons/app-icon-fashion-192.png",
      badge: payload.badge || "/icons/app-icon-fashion-192.png",
      tag: payload.tag || "online-scheduler-admin",
      data: {
        url: payload.url || "/admin",
        bookingId: payload.bookingId || null,
        kind: payload.kind || "admin",
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/admin", self.location.origin).href;
  event.waitUntil(openOrFocusClient(targetUrl));
});

function shouldCacheAsset(request, url) {
  return (
    ["style", "script", "worker", "image", "font"].includes(request.destination) ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  );
}

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match("/offline.html");
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetched = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  return cached || fetched || caches.match("/offline.html");
}

function readPushPayload(event) {
  const fallback = {
    title: "預約系統通知",
    body: "你有新的預約通知。",
    url: "/admin",
  };
  if (!event.data) {
    return fallback;
  }

  try {
    return { ...fallback, ...event.data.json() };
  } catch {
    return { ...fallback, body: event.data.text() || fallback.body };
  }
}

async function openOrFocusClient(targetUrl) {
  const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clientList) {
    if ("focus" in client && new URL(client.url).origin === self.location.origin) {
      await client.focus();
      if ("navigate" in client) {
        return client.navigate(targetUrl);
      }
      return;
    }
  }
  return clients.openWindow(targetUrl);
}
