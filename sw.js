/* Service Worker — نظام المشاريع (PWA)
   - التنقل والـ CSS/JS: الشبكة أولاً (دائماً أحدث نسخة)، وعند انقطاع الإنترنت من الكاش.
   - الخطوط والصور ومكتبة Supabase: الكاش أولاً.
   - لا يعترض أي طلب لـ Supabase أو دومين آخر → البيانات دائماً مباشرة من السيرفر.
   - غيّر VERSION و ?v= في الصفحات عند كل إصدار. */
const VERSION = "projects-v3";
const STATIC = VERSION + "-static";
const RUNTIME = VERSION + "-runtime";
const PRECACHE = [
  "offline.html",
  "manifest.webmanifest",
  "css/style.css?v=3",
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
  try { return await putRuntime(req, await fetch(req)); }
  catch (err) { const hit = await caches.match(req); if (hit) return hit; throw err; }
}
async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  return putRuntime(req, await fetch(req));
}
async function navigate(req) {
  try { return await putRuntime(req, await fetch(req)); }
  catch (err) {
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
  if (!same && !lib) return;
  if (same && url.pathname.endsWith("/sw.js")) return;
  if (req.mode === "navigate") { e.respondWith(navigate(req)); return; }
  if (lib || (same && /\/assets\//.test(url.pathname))) { e.respondWith(cacheFirst(req)); return; }
  e.respondWith(networkFirst(req));
});

// ——— الإشعارات: النقر يفتح/يركّز التطبيق (يدعم لاحقاً Web Push من الخادم) ———
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "نظام المشاريع", {
    body: d.body || "", icon: "assets/img/icon-192.png", badge: "assets/img/icon-192.png",
    dir: "rtl", lang: "ar", tag: d.tag || "pm-push", data: { url: d.url || "dashboard.html" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || "dashboard.html", self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) { if ("focus" in w) { await w.focus(); if ("navigate" in w) { try { await w.navigate(target); } catch (_) {} } return; } }
    await self.clients.openWindow(target);
  })());
});
