// شيل الواجهة — نظام إدارة المشاريع والتشطيبات
(function () {
  "use strict";

  function html(strings) {
    var vals = Array.prototype.slice.call(arguments, 1);
    var out = "";
    strings.forEach(function (s, i) {
      var v = vals[i];
      out += s + (v == null ? "" : v);
    });
    return out;
  }

  // تهريب HTML — أي نص قادم من قاعدة البيانات يجب أن يمر من هنا قبل إدراجه في القالب
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function currency() {
    try { var c = DB.getCompany(); return (c && c.currency) || "ج.م"; } catch (e) { return "ج.م"; }
  }
  function money(n) {
    if (n == null || isNaN(n)) return "—";
    var t = Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return t.charAt(0) === "-" ? "\u200E" + t : t;
  }
  function moneyC(n) {
    var c = currency();
    var t = money(n);
    return c && t !== "—" ? t + " " + c : t;
  }
  function num(n) {
    return Number(n || 0).toLocaleString("en-US");
  }
  function fmtDate(d, opts) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("ar-EG-u-nu-latn", opts || { day: "numeric", month: "short", year: "numeric" });
  }
  function pct(n) {
    if (n == null || isNaN(n)) return "—";
    return (Number(n) * 100).toFixed(1) + "%";
  }

  function toast(msg, isErr) {
    var d = document.createElement("div");
    d.className = "toast " + (isErr ? "error" : "ok");
    d.textContent = msg;
    d.setAttribute("role", "status");
    document.body.appendChild(d);
    setTimeout(function () { d.classList.add("show"); }, 10);
    setTimeout(function () {
      d.classList.remove("show");
      setTimeout(function () { d.remove(); }, 300);
    }, 2800);
  }

  function svg(d) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
  }

  var ICON = {
    dashboard: svg('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
    projects: svg('<path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/>'),
    engineers: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    suppliers: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6"/><path d="M19 8v6"/>'),
    items: svg('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05"/><path d="M12 22.08V12"/>'),
    warehouses: svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
    cashboxes: svg('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>'),
    purchases: svg('<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>'),
    stock: svg('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>'),
    payments: svg('<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>'),
    invoices: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'),
    receipts: svg('<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
    expenses: svg('<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
    labor: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>'),
    transport: svg('<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>'),
    storage: svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    profits: svg('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'),
    reports: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
    users: svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    bell: svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
    download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
    logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'),
    menu: svg('<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>'),
    search: svg('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>')
  };

  var NAV = [
    { key: "dashboard", label: "لوحة التحكم", icon: "dashboard" },
    { key: "projects", label: "المشاريع", icon: "projects" },
    { key: "engineers", label: "المهندسون", icon: "engineers" },
    { key: "suppliers", label: "الموردون", icon: "suppliers" },
    { key: "items", label: "الأصناف", icon: "items" },
    { key: "warehouses", label: "المخازن", icon: "warehouses" },
    { key: "cashboxes", label: "الخزائن", icon: "cashboxes" },
    { key: "purchases", label: "فواتير المشتريات", icon: "purchases" },
    { key: "stock", label: "حركات المخزون", icon: "stock" },
    { key: "supplier-payments", label: "مدفوعات الموردين", icon: "payments" },
    { key: "project-invoices", label: "فواتير المشاريع", icon: "invoices" },
    { key: "receipts", label: "مقبوضات العملاء", icon: "receipts" },
    { key: "project-expenses", label: "مصروفات المشاريع", icon: "expenses" },
    { key: "labor", label: "العمالة", icon: "labor" },
    { key: "transports", label: "النقل", icon: "transport" },
    { key: "storages", label: "التشوين", icon: "storage" },
    { key: "profits", label: "ربحية المشاريع", icon: "profits" },
    { key: "reports", label: "التقارير", icon: "reports" },
    { key: "users", label: "المستخدمون", icon: "users", adminOnly: true },
    { key: "settings", label: "الإعدادات", icon: "settings" }
  ];

  var TITLES = {
    dashboard: ["لوحة التحكم", ""],
    projects: ["المشاريع", ""],
    engineers: ["المهندسون", ""],
    suppliers: ["الموردون", ""],
    items: ["الأصناف", ""],
    warehouses: ["المخازن", ""],
    cashboxes: ["الخزائن", ""],
    purchases: ["فواتير المشتريات", ""],
    stock: ["حركات المخزون", ""],
    "supplier-payments": ["مدفوعات الموردين", ""],
    "project-invoices": ["فواتير المشاريع", ""],
    receipts: ["مقبوضات العملاء", ""],
    "project-expenses": ["مصروفات المشاريع", ""],
    labor: ["العمالة", ""],
    transports: ["النقل", ""],
    storages: ["التشوين", ""],
    profits: ["ربحية المشاريع", ""],
    reports: ["التقارير", ""],
    users: ["المستخدمون", ""],
    settings: ["الإعدادات", ""]
  };

  function navHtml(active) {
    return NAV.filter(function (n) { return DB.allowed(n.key); }).map(function (n) {
      var on = n.key === active ? " on" : "";
      return '<a class="nav' + on + '" href="' + n.key + '.html" data-key="' + n.key + '">' +
        '<span class="nav-ic">' + (ICON[n.icon] || "") + '</span>' +
        '<span class="nav-label">' + n.label + '</span></a>';
    }).join("");
  }

  function buildShell(active) {
    var title = TITLES[active] || [active, ""];
    var company = {};
    try { company = DB.getCompany() || {}; } catch (e) {}
    var brand = esc(company.name || "نظام المشاريع");
    var prof = (DB.getProfile && DB.getProfile()) || null;
    var sub = DB.demoMode ? "وضع تجريبي" : esc(prof ? prof.name : "");

    document.body.innerHTML =
      '<div class="layout" id="layout">' +
        '<aside class="sidebar" id="sidebar">' +
          '<div class="brand">' +
            '<div class="brand-icon">' + ICON.projects + '</div>' +
            '<div class="brand-text"><b>' + brand + '</b><span>' + sub + '</span></div>' +
          '</div>' +
          '<div class="sidebar-search-wrap">' + ICON.search +
            '<input class="menu-search" id="menu-search" type="search" placeholder="بحث في القائمة…" autocomplete="off" />' +
          '</div>' +
          '<nav class="sidebar-nav" id="sidebar-nav">' + navHtml(active) + '</nav>' +
          '<div class="sidebar-foot">' +
            '<div class="sidebar-ver"><b>نظام المشاريع</b><span>v' + String((window.APP_CONFIG || {}).APP_VERSION || "0.1") + '</span></div>' +
          '</div>' +
        '</aside>' +
        '<div class="main">' +
          '<header class="topbar">' +
            '<button class="menu-btn ghost" id="toggle-nav" type="button" aria-label="القائمة">' + ICON.menu + '</button>' +
            '<div class="topbar-title"><h1 id="page-h1">' + title[0] + '</h1><p class="sub" id="page-sub">' + title[1] + '</p></div>' +
            '<div class="topbar-end">' +
              '<button type="button" class="ghost install-btn" id="install-btn" title="تثبيت التطبيق على جهازك" aria-label="تثبيت التطبيق" hidden>' + ICON.download + '</button>' +
              '<div class="notif-wrap"><button type="button" class="ghost bell-btn" id="bell-btn" title="التنبيهات" aria-label="التنبيهات">' + ICON.bell + '<span class="notif-badge" id="notif-badge" hidden>0</span></button>' +
              '<div class="notif-panel card" id="notif-panel" hidden></div></div>' +
              (DB.demoMode ? "" : '<button type="button" class="ghost" id="logout-btn" title="تسجيل الخروج" aria-label="تسجيل الخروج">' + ICON.logout + '</button>') + '</div>' +
          '</header>' +
          '<main class="content" id="page"></main>' +
        '</div>' +
      '</div>';

    var layout = document.getElementById("layout");
    var toggle = document.getElementById("toggle-nav");
    if (toggle) toggle.addEventListener("click", function () {
      layout.classList.toggle("nav-open");
    });
    layout.addEventListener("click", function (e) {
      if (e.target === layout) layout.classList.remove("nav-open");
      if (e.target.closest && e.target.closest("a.nav")) layout.classList.remove("nav-open");
    });
    var logout = document.getElementById("logout-btn");
    if (logout) logout.addEventListener("click", function () {
      DB.signOut().then(function () { location.replace("login.html"); });
    });
    var inst = document.getElementById("install-btn");
    if (inst) inst.addEventListener("click", function () { if (window.PWA) PWA.install(); });
    if (window.Notify) Notify.mount();
    document.dispatchEvent(new Event("shell-ready"));
    var search = document.getElementById("menu-search");
    if (search) {
      search.addEventListener("input", function () {
        var q = (search.value || "").trim().toLowerCase();
        document.querySelectorAll("#sidebar-nav a.nav").forEach(function (a) {
          var label = (a.textContent || "").toLowerCase();
          a.style.display = !q || label.indexOf(q) >= 0 ? "" : "none";
        });
      });
    }
  }

  function loadPageScript(pageKey) {
    var s = document.createElement("script");
    s.src = "js/pages/" + pageKey + ".js?v=" + ((window.APP_CONFIG && APP_CONFIG.APP_VERSION) || "1");
    s.onerror = function () {
      var page = document.getElementById("page");
      if (page) page.innerHTML = '<div class="card pad"><p class="muted">غير متاحة.</p></div>';
    };
    document.body.appendChild(s);
  }

  function modal(opts) {
    opts = opts || {};
    var root = document.getElementById("modal-root") || document.body;
    var overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML =
      '<div class="modal card">' +
        '<div class="modal-head"><h3>' + (opts.title || "") + '</h3>' +
        '<button type="button" class="icon-btn modal-close" aria-label="إغلاق">×</button></div>' +
        '<div class="modal-body">' + (opts.body || "") + '</div>' +
        '<div class="modal-foot"></div></div>';
    root.appendChild(overlay);
    function close() { overlay.remove(); }
    overlay.querySelector(".modal-close").onclick = close;
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    var foot = overlay.querySelector(".modal-foot");
    if (opts.actions) {
      opts.actions.forEach(function (a) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = a.cls || "btn";
        b.textContent = a.label;
        b.onclick = function () { if (a.onClick) a.onClick(close); else close(); };
        foot.appendChild(b);
      });
    }
    return { close: close, el: overlay };
  }

  window.UI = {
    html: html,
    esc: esc,
    money: money,
    moneyC: moneyC,
    num: num,
    fmtDate: fmtDate,
    pct: pct,
    toast: toast,
    icon: ICON,
    modal: modal,
    mountShell: function () {
      var pageKey = document.body.getAttribute("data-page") || "dashboard";
      buildShell(pageKey);
    },
    loadPageScript: loadPageScript
  };

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.DB) {
      document.body.innerHTML = '<p style="padding:2rem">خطأ في تحميل النظام</p>';
      return;
    }
    DB.init().then(function () {
      if (document.body.classList.contains("auth-body")) return;
      UI.mountShell();
      var pageKey = document.body.getAttribute("data-page") || "dashboard";
      if (!DB.allowed(pageKey)) {
        var pg = document.getElementById("page");
        if (pg) pg.innerHTML = '<div class="card empty" style="padding:48px 20px"><h3 style="margin:0 0 8px">غير مصرّح لك بهذه الصفحة</h3></div>';
        return;
      }
      loadPageScript(pageKey);
    }).catch(function (e) {
      console.error(e);
      var p = document.createElement("p");
      p.style.padding = "2rem";
      p.textContent = "تعذّر تهيئة النظام" + (e && e.message ? " — " + e.message : "");
      document.body.innerHTML = "";
      document.body.appendChild(p);
    });
  });
})();
