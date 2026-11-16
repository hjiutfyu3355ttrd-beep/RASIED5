/* مركز التنبيهات: تنبيهات مشتقة من بيانات النظام + إشعارات الجهاز (محلية عند فتح التطبيق)
   - الأنواع: مخزون منخفض · مشروع متأخر · مستحقات عملاء · مستحقات موردين · خزينة بالسالب · مشروع خاسر
   - الحالة (مقروء/تم إشعاره) محفوظة لكل مستخدم في المتصفح */
(function () {
  "use strict";
  var esc = function (v) { return UI.esc(v); };

  function uid() { var p = DB.getProfile && DB.getProfile(); return p ? p.id : "demo"; }
  function load(k) { try { return JSON.parse(localStorage.getItem(k + "_" + uid()) || "[]"); } catch (e) { return []; } }
  function save(k, v) { try { localStorage.setItem(k + "_" + uid(), JSON.stringify(v.slice(-300))); } catch (e) {} }

  var PAGE_OF = { stock: "stock", projects: "projects", suppliers: "suppliers", cashboxes: "cashboxes", profits: "profits" };

  function compute() {
    var out = [], today = DB.today ? DB.today() : new Date().toISOString().slice(0, 10);
    function add(a) { if (DB.allowed(PAGE_OF[a.page] || a.page)) out.push(a); }

    DB.listStockBalances().forEach(function (r) {
      if (r.low) add({ key: "low:" + r.item_id + "|" + r.warehouse_id, level: "warn", page: "stock",
        title: "مخزون منخفض: " + r.item_name, text: "الرصيد " + UI.num(r.qty) + " (الحد الأدنى " + UI.num(r.reorder_level) + ") — " + r.warehouse_name });
    });

    (DB.list("projects") || []).forEach(function (p) {
      if (["new", "in_progress", "paused"].indexOf(p.status) !== -1 && p.expected_end && p.expected_end < today)
        add({ key: "late:" + p.id, level: "danger", page: "projects", title: "مشروع متأخر: " + p.name, text: "كان تسليمه المتوقع " + p.expected_end });
    });

    DB.listProjectProfits().forEach(function (p) {
      if (["completed", "delivered", "closed"].indexOf(p.status) !== -1 && p.receivable > 0.5)
        add({ key: "recv:" + p.project_id + ":" + Math.round(p.receivable), level: "warn", page: "profits", title: "مستحقات على العميل: " + p.project_name, text: "المتبقي " + UI.money(p.receivable) });
      if (p.revenue > 0 && p.net < 0)
        add({ key: "loss:" + p.project_id, level: "danger", page: "profits", title: "مشروع خاسر: " + p.project_name, text: "صافي " + UI.money(p.net) });
    });

    (DB.list("suppliers") || []).forEach(function (s) {
      var b = DB.calcSupplierBalance(s.id);
      if (b.due > 0.5) add({ key: "sup:" + s.id + ":" + Math.round(b.due), level: "info", page: "suppliers", title: "مستحق للمورد: " + s.name, text: UI.money(b.due) });
    });

    (DB.list("cashboxes") || []).forEach(function (c) {
      var bal = DB.calcCashboxBalance(c.id);
      if (bal < 0) add({ key: "cash:" + c.id, level: "danger", page: "cashboxes", title: "خزينة بالسالب: " + c.name, text: UI.money(bal) });
    });

    var rank = { danger: 0, warn: 1, info: 2 };
    out.sort(function (a, b) { return rank[a.level] - rank[b.level]; });
    return out;
  }

  function unread(list) { var seen = load("pm_notif_seen"); return list.filter(function (a) { return seen.indexOf(a.key) === -1; }); }

  var LABEL = { danger: "عاجل", warn: "تنبيه", info: "معلومة" };
  function render(list) {
    var panel = document.getElementById("notif-panel"); if (!panel) return;
    var seen = load("pm_notif_seen");
    var perm = ("Notification" in window) ? Notification.permission : "unsupported";
    var devBtn = perm === "default" ? '<button type="button" class="small" id="notif-enable">تفعيل إشعارات الجهاز</button>' :
      perm === "granted" ? '<span class="muted" style="font-size:12px">إشعارات الجهاز مفعّلة</span>' :
      perm === "denied" ? '<span class="muted" style="font-size:12px">إشعارات الجهاز محظورة</span>' : "";
    panel.innerHTML = '<div class="notif-head"><b>التنبيهات</b>' + devBtn + '</div>' +
      '<div class="notif-list">' + (list.length ? list.map(function (a) {
        return '<a class="notif-item ' + a.level + (seen.indexOf(a.key) === -1 ? " new" : "") + '" href="' + esc(PAGE_OF[a.page] || a.page) + '.html">' +
          '<span class="notif-dot"></span><span class="notif-body"><b>' + esc(a.title) + '</b><span>' + esc(a.text) + '</span></span>' +
          '<span class="badge ' + (a.level === "danger" ? "err" : a.level === "warn" ? "warn" : "") + '">' + LABEL[a.level] + '</span></a>';
      }).join("") : '<div class="empty" style="padding:24px 12px">لا توجد تنبيهات</div>') + '</div>';
    var en = document.getElementById("notif-enable");
    if (en) en.onclick = function () {
      Notification.requestPermission().then(function () { refresh(true); });
    };
  }

  function badge(n) {
    var b = document.getElementById("notif-badge"); if (!b) return;
    b.textContent = n > 99 ? "99+" : String(n); b.hidden = n === 0;
  }

  // إشعار جهاز محلي (يظهر في مركز إشعارات الموبايل/الكمبيوتر) للتنبيهات الجديدة فقط
  function deviceNotify(list) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    var done = load("pm_notif_pushed");
    var fresh = list.filter(function (a) { return a.level !== "info" && done.indexOf(a.key) === -1; });
    if (!fresh.length) return;
    var title = fresh.length === 1 ? fresh[0].title : "لديك " + fresh.length + " تنبيهات جديدة";
    var body = fresh.length === 1 ? fresh[0].text : fresh.slice(0, 3).map(function (a) { return "• " + a.title; }).join("\n");
    var opts = { body: body, icon: "assets/img/icon-192.png", badge: "assets/img/icon-192.png", tag: "pm-alerts", dir: "rtl", lang: "ar", data: { url: "dashboard.html" } };
    var show = function () {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(function (reg) { reg.showNotification(title, opts); }).catch(function () { try { new Notification(title, opts); } catch (e) {} });
      } else { try { new Notification(title, opts); } catch (e) {} }
    };
    show();
    save("pm_notif_pushed", done.concat(fresh.map(function (a) { return a.key; })));
  }

  var current = [];
  function refresh(skipDevice) {
    try { current = compute(); } catch (e) { current = []; }
    badge(unread(current).length); render(current);
    if (!skipDevice) deviceNotify(current);
  }

  function mount() {
    var btn = document.getElementById("bell-btn"), panel = document.getElementById("notif-panel");
    if (!btn || !panel) return;
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = panel.hidden;
      panel.hidden = !open;
      if (open) { render(current); save("pm_notif_seen", load("pm_notif_seen").concat(current.map(function (a) { return a.key; }))); badge(0); }
    });
    document.addEventListener("click", function (e) { if (!panel.hidden && !panel.contains(e.target)) panel.hidden = true; });
    refresh();
  }

  window.Notify = { compute: compute, refresh: refresh, mount: mount };
})();
