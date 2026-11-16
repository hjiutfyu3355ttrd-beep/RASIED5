/* مركز التنبيهات
   - تنبيهات مشتقة من بيانات الشركة: مشاريع متأخرة · مخزون منخفض · مستحقات عملاء · مشروع خاسر · مستحق للمورد · خزينة بالسالب
   - جرس + عدّاد + لوحة إعدادات (كل نوع قابل للتعطيل) + شارة على أيقونة التطبيق
   - إشعارات الجهاز عند فتح التطبيق، + Web Push من الخادم يصل والتطبيق مغلق (send-push + pg_cron) */
window.Notify = (function () {
  "use strict";
  var started = false, items = [], store = null, uid = "demo";
  var esc = function (v) { return UI.esc(v); };
  var TYPES = {
    late: ["المشاريع المتأخرة", "projects"], stock: ["المخزون المنخفض", "stock"], recv: ["مستحقات العملاء", "profits"],
    loss: ["المشاريع الخاسرة", "profits"], supplier: ["مستحقات الموردين", "suppliers"], cash: ["الخزائن بالسالب", "cashboxes"]
  };
  var SEV = { danger: 0, warn: 1, info: 2 };
  var LABEL = { danger: "عاجل", warn: "تنبيه", info: "معلومة" };
  var today = function () { return new Date().toISOString().slice(0, 10); };

  /* ---------- التخزين المحلي (لكل مستخدم على الجهاز) ---------- */
  function load() {
    try { store = JSON.parse(localStorage.getItem("pm_alerts_" + uid) || "null"); } catch (e) { store = null; }
    store = store || {}; store.prefs = store.prefs || {}; store.read = store.read || {}; store.pushed = store.pushed || {};
  }
  function save() {
    var cut = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
    ["read", "pushed"].forEach(function (k) { Object.keys(store[k]).forEach(function (x) { if (store[k][x] < cut) delete store[k][x]; }); });
    try { localStorage.setItem("pm_alerts_" + uid, JSON.stringify(store)); } catch (e) {}
  }
  var enabled = function (t) { if (!store) load(); return store.prefs[t] !== false; };
  var can = function (t) { return DB.allowed(TYPES[t][1]); };

  /* ---------- حساب التنبيهات ---------- */
  function compute() {
    var out = [], t = today();
    function add(a) { if (can(a.type) && enabled(a.type)) out.push(a); }

    DB.listStockBalances().forEach(function (r) {
      if (r.low) add({ key: "low:" + r.item_id + "|" + r.warehouse_id, type: "stock", sev: "warn", href: "stock.html",
        title: "مخزون منخفض: " + r.item_name, body: "الرصيد " + UI.num(r.qty) + " (الحد الأدنى " + UI.num(r.reorder_level) + ") — " + r.warehouse_name });
    });
    (DB.list("projects") || []).forEach(function (p) {
      if (["new", "in_progress", "paused"].indexOf(p.status) !== -1 && p.expected_end && p.expected_end < t)
        add({ key: "late:" + p.id, type: "late", sev: "danger", href: "projects.html", title: "مشروع متأخر: " + p.name, body: "كان تسليمه المتوقع " + p.expected_end });
    });
    DB.listProjectProfits().forEach(function (p) {
      if (["completed", "delivered", "closed"].indexOf(p.status) !== -1 && p.receivable > 0.5)
        add({ key: "recv:" + p.project_id + ":" + Math.round(p.receivable), type: "recv", sev: "warn", href: "profits.html", title: "مستحقات على العميل: " + p.project_name, body: "المتبقي " + UI.money(p.receivable) });
      if (p.revenue > 0 && p.net < 0)
        add({ key: "loss:" + p.project_id, type: "loss", sev: "danger", href: "profits.html", title: "مشروع خاسر: " + p.project_name, body: "صافي " + UI.money(p.net) });
    });
    (DB.list("suppliers") || []).forEach(function (s) {
      var b = DB.calcSupplierBalance(s.id);
      if (b.due > 0.5) add({ key: "sup:" + s.id + ":" + Math.round(b.due), type: "supplier", sev: "info", href: "suppliers.html", title: "مستحق للمورد: " + s.name, body: UI.money(b.due) });
    });
    (DB.list("cashboxes") || []).forEach(function (c) {
      var bal = DB.calcCashboxBalance(c.id);
      if (bal < 0) add({ key: "cash:" + c.id, type: "cash", sev: "danger", href: "cashboxes.html", title: "خزينة بالسالب: " + c.name, body: UI.money(bal) });
    });
    out.sort(function (a, b) { return SEV[a.sev] - SEV[b.sev]; });
    return out;
  }

  /* ---------- الجرس واللوحة ---------- */
  var unread = function () { return items.filter(function (a) { return !store.read[a.key]; }); };
  function renderBadge() {
    var n = unread().length, b = document.getElementById("notif-badge");
    if (b) { b.hidden = n === 0; b.textContent = n > 9 ? "9+" : String(n); }
    try { if (navigator.setAppBadge) { if (n) navigator.setAppBadge(n); else navigator.clearAppBadge(); } } catch (e) {}
  }
  var osState = function () { return "Notification" in window ? Notification.permission : "unsupported"; };

  function osBlock(os, compact) {
    if (os === "granted") {
      if (compact) return pushSupported() && !store.push ? '<div class="notif-os"><span>فعّل الإشعار والتطبيق مغلق</span><button type="button" class="primary small" data-al="enablepush">تفعيل</button></div>' : "";
      return '<p class="muted notif-hint">إشعارات الجهاز مفعّلة' + (store.push ? " (تصلك والتطبيق مغلق)" : "") + '</p>' +
        (pushSupported() && !store.push ? '<button type="button" class="primary small" data-al="enablepush">تفعيل الإشعار والتطبيق مغلق</button>' : "");
    }
    if (os === "denied") return '<p class="muted notif-hint">الإشعارات محظورة من إعدادات المتصفح لهذا الموقع.</p>';
    if (os === "unsupported") return '<p class="muted notif-hint">على الآيفون: ثبّت التطبيق أولاً (مشاركة ← إضافة إلى الشاشة الرئيسية) ثم افتحه من الأيقونة.</p>';
    return '<div class="notif-os"><span>فعّل إشعارات الجهاز</span><button type="button" class="primary small" data-al="enable">تفعيل</button></div>';
  }

  function renderPanel() {
    var p = document.getElementById("notif-panel"); if (!p) return;
    var os = osState(), settings = p.getAttribute("data-mode") === "settings";
    var head = '<div class="notif-head"><b>التنبيهات</b><span class="notif-tools">' +
      (items.length && !settings ? '<button type="button" class="ghost small" data-al="readall">تعليم الكل كمقروء</button>' : "") +
      '<button type="button" class="ghost small" data-al="' + (settings ? "back" : "settings") + '">' + (settings ? "رجوع" : "الإعدادات") + '</button></span></div>';
    var body;
    if (settings) {
      body = '<div class="notif-set">' + Object.keys(TYPES).filter(can).map(function (k) {
        return '<label class="notif-opt"><input type="checkbox" data-pref="' + k + '"' + (enabled(k) ? " checked" : "") + '> ' + TYPES[k][0] + '</label>';
      }).join("") + '<hr><label class="notif-opt"><input type="checkbox" data-pref="os"' + (store.prefs.os === false ? "" : " checked") + '> إشعارات على الجهاز</label>' + osBlock(os) + '</div>';
    } else {
      body = (os === "default" || os === "unsupported" || (os === "granted" && pushSupported() && !store.push) ? osBlock(os, true) : "") +
        '<div class="notif-list">' + (items.length ? items.map(function (a) {
          return '<a class="notif-item ' + a.sev + (store.read[a.key] ? "" : " new") + '" href="' + esc(a.href) + '" data-key="' + esc(a.key) + '">' +
            '<span class="notif-dot"></span><span class="notif-body"><b>' + esc(a.title) + '</b><span>' + esc(a.body) + '</span></span>' +
            '<span class="badge ' + (a.sev === "danger" ? "err" : a.sev === "warn" ? "warn" : "") + '">' + LABEL[a.sev] + '</span></a>';
        }).join("") : '<div class="empty" style="padding:24px 12px">لا توجد تنبيهات</div>') + '</div>';
    }
    p.innerHTML = head + body;
  }

  /* ---------- Web Push (الإشعار والتطبيق مغلق) ---------- */
  function pushSupported() { return !!(!DB.demoMode && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window); }
  function b64urlToU8(s) {
    var pad = "=".repeat((4 - (s.length % 4)) % 4), raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/")), o = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) o[i] = raw.charCodeAt(i);
    return o;
  }
  function u8ToB64url(buf) {
    var u = new Uint8Array(buf), s = "";
    for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function prefsForServer() {
    var o = {};
    Object.keys(TYPES).forEach(function (k) { if (store.prefs[k] === false) o[k] = false; });
    if (store.prefs.os === false) o.os = false;
    return o;
  }
  function pushSubscribe() {
    var cl = DB.client(), reg, sub;
    return cl.rpc("push_public_key").then(function (kr) {
      if (kr.error || !kr.data) throw new Error("الخدمة غير مفعّلة على الخادم");
      return navigator.serviceWorker.ready.then(function (r) { reg = r; return reg.pushManager.getSubscription(); }).then(function (s) {
        sub = s;
        if (sub && sub.options && sub.options.applicationServerKey && u8ToB64url(sub.options.applicationServerKey) !== kr.data) return sub.unsubscribe().then(function () { sub = null; });
      }).then(function () {
        return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToU8(kr.data) });
      });
    }).then(function (s) {
      var j = s.toJSON();
      return cl.rpc("push_subscribe", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: navigator.userAgent, p_prefs: prefsForServer() });
    }).then(function (r) {
      if (r.error) throw new Error(r.error.message);
      store.push = true; store.pushAt = today(); save();
    });
  }
  // مزامنة صامتة يومية: تجدد الاشتراك وتحدّث التفضيلات عند الخادم
  function pushSync(force) {
    if (!pushSupported() || osState() !== "granted") return;
    if (!force && store.pushAt === today()) return;
    pushSubscribe().catch(function () {});
  }

  /* ---------- إشعارات النظام (أثناء فتح التطبيق) ---------- */
  function osNotify() {
    if (osState() !== "granted" || store.prefs.os === false) return;
    var t = today(), fresh = items.filter(function (a) { return !store.read[a.key] && store.pushed[a.key] !== t && a.sev !== "info"; });
    if (!fresh.length) return;
    var base = { icon: "assets/img/icon-192.png", badge: "assets/img/icon-192.png", dir: "rtl", lang: "ar" };
    function show(title, o) {
      var opts = Object.assign({}, base, o);
      if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(function (reg) { reg.showNotification(title, opts); }).catch(function () { try { new Notification(title, opts); } catch (e) {} });
      else { try { new Notification(title, opts); } catch (e) {} }
    }
    if (fresh.length <= 3) fresh.forEach(function (a) { show(a.title, { body: a.body, tag: a.key, data: { url: a.href } }); });
    else show("لديك " + fresh.length + " تنبيهات", { body: fresh.slice(0, 3).map(function (a) { return a.title; }).join(" • "), tag: "pm-summary", data: { url: "dashboard.html" } });
    fresh.forEach(function (a) { store.pushed[a.key] = t; });
    save();
  }

  function refresh() {
    try { items = compute(); } catch (e) { items = []; }
    renderBadge();
    var p = document.getElementById("notif-panel"); if (p && !p.hidden) renderPanel();
    osNotify();
  }

  function onClick(e) {
    var p = document.getElementById("notif-panel"), btn = document.getElementById("bell-btn");
    if (!p || !btn) return;
    if (btn.contains(e.target)) {
      p.hidden = !p.hidden;
      if (!p.hidden) { p.removeAttribute("data-mode"); renderPanel(); }
      return;
    }
    if (!p.contains(e.target)) { p.hidden = true; return; }
    var b = e.target.closest("[data-al]"), a = e.target.closest(".notif-item"), pref = e.target.closest("[data-pref]");
    if (b) {
      var act = b.getAttribute("data-al");
      if (act === "settings") { p.setAttribute("data-mode", "settings"); renderPanel(); }
      else if (act === "back") { p.removeAttribute("data-mode"); renderPanel(); }
      else if (act === "readall") { items.forEach(function (x) { store.read[x.key] = today(); }); save(); renderBadge(); renderPanel(); }
      else if (act === "enable" || act === "enablepush") {
        if (!("Notification" in window)) return;
        Promise.resolve(Notification.permission === "granted" ? "granted" : Notification.requestPermission()).then(function () {
          var granted = Notification.permission === "granted";
          var done = function (note) { renderPanel(); osNotify(); UI.toast(note, !granted); };
          if (granted && pushSupported()) {
            pushSubscribe().then(function () { done("تم تفعيل الإشعارات — ستصلك والتطبيق مغلق"); },
              function (err) { done("الإشعارات تعمل أثناء فتح التطبيق فقط (" + (err.message || "تعذّر التفعيل") + ")"); });
          } else done(granted ? "تم تفعيل الإشعارات" : "لم يتم تفعيل الإشعارات");
        });
      }
    } else if (a) {
      store.read[a.getAttribute("data-key")] = today(); save(); renderBadge(); p.hidden = true;
    } else if (pref) {
      var k = pref.getAttribute("data-pref"); store.prefs[k] = pref.checked; save();
      pushSync(true);
      if (k !== "os") refresh();
    }
  }

  function mount() {
    if (!document.getElementById("bell-btn")) return;
    try { uid = (DB.getProfile() && DB.getProfile().id) || "demo"; } catch (e) {}
    load();
    if (!started) {
      started = true;
      document.addEventListener("click", onClick);
      document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
      setInterval(function () { if (!document.hidden) refresh(); }, 15 * 60 * 1000);
    }
    refresh();
    pushSync(false);
  }

  return { mount: mount, refresh: refresh, compute: compute };
})();
