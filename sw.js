/* Service Worker — رصيد (PWA)
   - التنقل والـ CSS/JS: الشبكة أولًا (دائمًا أحدث نسخة) وعند انقطاع الإنترنت من الكاش.
   - الخطوط والصور ومكتبة Supabase المثبّتة الإصدار: الكاش أولًا (سريعة).
   - لا يعترض أي طلب لواجهة Supabase أو أي دومين آخر → البيانات دائمًا مباشرة من السيرفر. */
const VERSION = "fleet-v67";
const STATIC = VERSION + "-static";
const RUNTIME = VERSION + "-runtime";
const PRECACHE = [
  "offline.html",
  "manifest.webmanifest",
  "favicon.ico",
  "css/style.css?v=67",
  "assets/fonts/Cairo-Regular.ttf",
  "assets/fonts/Cairo-SemiBold.ttf",
  "assets/fonts/Cairo-Bold.ttf",
  "assets/img/icon-192.png",
  "assets/img/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(STATIC);
    await Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.indexOf(VERSION) !== 0).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function putRuntime(req, res) {
  if (res && res.ok && res.type !== "opaque") {
    const c = await caches.open(RUNTIME);
    c.put(req, res.clone());
  }
  return res;
}

async function networkFirst(req) {
  try {
    return await putRuntime(req, await fetch(req));
  } catch (err) {
    const hit = await caches.match(req);
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  return putRuntime(req, await fetch(req));
}

async function navigate(req) {
  try {
    return await putRuntime(req, await fetch(req));
  } catch (err) {
    const hit = await caches.match(req, { ignoreSearch: true });
    return hit || (await caches.match("offline.html")) || Response.error();
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const lib = url.hostname === "cdn.jsdelivr.net";
  if (!same && !lib) return;               // Supabase وغيره: مباشرة بدون تدخل
  if (same && url.pathname.endsWith("/sw.js")) return;

  if (req.mode === "navigate") { e.respondWith(navigate(req)); return; }
  if (lib || (same && /\/assets\//.test(url.pathname))) { e.respondWith(cacheFirst(req)); return; }
  e.respondWith(networkFirst(req));
});

/* ——— التنبيهات (Web Push) ——— */
async function setBadge(n) {
  try {
    if (n > 0 && self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(n);
    else if (self.navigator && self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
  } catch (e) {}
}
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: "نظام السيارات", body: e.data ? e.data.text() : "" }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || "نظام السيارات", {
      body: d.body || "",
      icon: "assets/img/icon-192.png",
      badge: "assets/img/icon-192.png",
      tag: d.tag || "fleet",
      renotify: !!d.urgent,
      dir: "rtl",
      lang: "ar",
      vibrate: d.urgent ? [200, 100, 200] : [120],
      data: { url: d.url || "notifications.html" },
    });
    if (typeof d.badge === "number") await setBadge(d.badge);
  })());
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || "notifications.html", self.registration.scope).href;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of list) {
      if (c.url.indexOf(self.registration.scope) === 0 && "focus" in c) {
        try { await c.focus(); if ("navigate" in c) await c.navigate(target); return; } catch (err) { /* نافذة جديدة */ }
      }
    }
    await self.clients.openWindow(target);
  })());
});
self.addEventListener("message", (e) => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });
