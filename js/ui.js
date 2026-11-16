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
    shield: svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
    bell: svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
    download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
    logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'),
    menu: svg('<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>'),
    search: svg('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>')
  };

  var NAV = [
    { group: "الرئيسية", icon: "dashboard", items: [
      { key: "dashboard", label: "لوحة التحكم", icon: "dashboard" }
    ]},
    { group: "المشاريع", icon: "projects", items: [
      { key: "projects", label: "المشاريع", icon: "projects" },
      { key: "engineers", label: "المهندسون", icon: "engineers" },
      { key: "project-invoices", label: "فواتير المشاريع", icon: "invoices" },
      { key: "receipts", label: "مقبوضات العملاء", icon: "receipts" },
      { key: "project-expenses", label: "مصروفات المشاريع", icon: "expenses" },
      { key: "profits", label: "ربحية المشاريع", icon: "profits" }
    ]},
    { group: "المشتريات والموردين", icon: "purchases", items: [
      { key: "purchases", label: "فواتير المشتريات", icon: "purchases" },
      { key: "suppliers", label: "الموردون", icon: "suppliers" },
      { key: "supplier-payments", label: "مدفوعات الموردين", icon: "payments" }
    ]},
    { group: "المخزون", icon: "stock", items: [
      { key: "items", label: "الأصناف", icon: "items" },
      { key: "warehouses", label: "المخازن", icon: "warehouses" },
      { key: "stock", label: "حركات المخزون", icon: "stock" },
      { key: "storages", label: "التشوين", icon: "storage" },
      { key: "transports", label: "النقل", icon: "transport" }
    ]},
    { group: "المالية والعمالة", icon: "cashboxes", items: [
      { key: "cashboxes", label: "الخزائن", icon: "cashboxes" },
      { key: "cash-movements", label: "حركات الخزينة", icon: "payments" },
      { key: "expense-types", label: "أنواع المصروفات", icon: "expenses" },
      { key: "labor", label: "العمالة", icon: "labor" }
    ]},
    { group: "التقارير", icon: "reports", items: [
      { key: "reports", label: "التقارير", icon: "reports" }
    ]},
    { group: "النظام", icon: "settings", items: [
      { key: "users", label: "المستخدمون", icon: "users", adminOnly: true },
      { key: "admin", label: "إدارة المنصة", icon: "shield" },
      { key: "settings", label: "الإعدادات", icon: "settings" }
    ]}
  ];

  var TITLES = {
    dashboard: ["لوحة التحكم", ""],
    projects: ["المشاريع", ""],
    engineers: ["المهندسون", ""],
    suppliers: ["الموردون", ""],
    items: ["الأصناف", ""],
    warehouses: ["المخازن", ""],
    cashboxes: ["الخزائن", ""],
    "cash-movements": ["حركات الخزينة اليدوية", ""],
    "expense-types": ["أنواع المصروفات", ""],
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
    admin: ["إدارة المنصة", ""],
    settings: ["الإعدادات", ""]
  };

  var NAVOPEN_KEY = "project_nav_open";
  var navOpen = null;
  try { navOpen = sessionStorage.getItem(NAVOPEN_KEY); } catch (e) {}

  function groupOfKey(key) {
    for (var i = 0; i < NAV.length; i++) {
      for (var j = 0; j < NAV[i].items.length; j++) {
        if (NAV[i].items[j].key === key) return NAV[i].group;
      }
    }
    return null;
  }

  function filterNav(allowedKeys) {
    var set = null;
    if (allowedKeys && allowedKeys.length) {
      set = {};
      allowedKeys.forEach(function (k) { set[k] = 1; });
    }
    return NAV.map(function (g) {
      var items = g.items.filter(function (it) {
        if (set) return !!set[it.key] || it.key === "dashboard";
        if (window.DB && typeof DB.allowed === "function") {
          try { return DB.allowed(it.key); } catch (e) { return true; }
        }
        return true;
      });
      return { group: g.group, icon: g.icon, items: items };
    }).filter(function (g) { return g.items.length > 0; });
  }

  function navHtml(active, allowedKeys) {
    var groups = filterNav(allowedKeys);
    var activeG = groupOfKey(active);
    if (!navOpen && activeG) navOpen = activeG;
    // افتح مجموعة الصفحة الحالية دائماً
    if (activeG) navOpen = activeG;

    function link(it) {
      var on = it.key === active ? " active" : "";
      return '<a class="nav' + on + '" href="' + it.key + '.html" data-key="' + it.key + '"' +
        (it.key === active ? ' aria-current="page"' : "") + ">" +
        '<span class="nav-ic">' + (ICON[it.icon] || "") + "</span>" +
        '<span class="nav-label">' + it.label + "</span></a>";
    }

    return groups.map(function (g) {
      // مجموعة بعنصر واحد: رابط مباشر بدون طي
      if (g.items.length === 1) return link(g.items[0]);
      var open = g.group === navOpen;
      return '<div class="nav-sec' + (open ? " open" : "") + '" data-grp="' + g.group + '">' +
        '<button type="button" class="nav-group" aria-expanded="' + (open ? "true" : "false") + '">' +
          '<span class="nav-ic">' + (ICON[g.icon] || "") + "</span>" +
          '<span class="nav-glabel">' + g.group + "</span>" +
          '<span class="nav-chev">' + (ICON.chev || "") + "</span>" +
        "</button>" +
        '<div class="nav-sub"><div class="nav-sub-in">' + g.items.map(link).join("") + "</div></div>" +
      "</div>";
    }).join("");
  }

  // ====================================================================
  // شيل ثابت: يُرسم فورًا من الكاش ثم يُطابَق بعد DB دون إعادة بناء كاملة
  // ======================================================================
  var SHELL_KEY = "project_shell_v1";
  var NAVSCROLL_KEY = "project_nav_scroll";
  var shell = null; // { active, bound }

  function readShellCache() {
    try { return JSON.parse(localStorage.getItem(SHELL_KEY) || "null"); } catch (e) { return null; }
  }
  function writeShellCache(o) {
    try { localStorage.setItem(SHELL_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function clearShellCache() {
    try { localStorage.removeItem(SHELL_KEY); sessionStorage.removeItem(NAVSCROLL_KEY); } catch (e) {}
  }

  function saveNavScroll() {
    var nav = document.getElementById("sidebar-nav");
    if (!nav) return;
    try { sessionStorage.setItem(NAVSCROLL_KEY, String(nav.scrollTop)); } catch (e) {}
  }
  function restoreNavScroll() {
    var nav = document.getElementById("sidebar-nav");
    if (!nav) return;
    try {
      var s = sessionStorage.getItem(NAVSCROLL_KEY);
      if (s != null) nav.scrollTop = Number(s) || 0;
    } catch (e) {}
  }

  function bindShellEvents() {
    if (!shell || shell.bound) return;
    shell.bound = true;
    var layout = document.getElementById("layout");
    var toggle = document.getElementById("toggle-nav");
    if (toggle) toggle.addEventListener("click", function () {
      layout.classList.toggle("nav-open");
    });
    if (layout) {
      layout.addEventListener("click", function (e) {
        if (e.target === layout) layout.classList.remove("nav-open");
        if (e.target.closest && e.target.closest("a.nav")) {
          saveNavScroll();
          layout.classList.remove("nav-open");
        }
      });
    }
    // حفظ تمرير القائمة عند أي تنقل
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a.nav");
      if (a) saveNavScroll();
    }, true);

    var logout = document.getElementById("logout-btn");
    if (logout) logout.addEventListener("click", function () {
      clearShellCache();
      if (window.DB && DB.signOut) {
        DB.signOut().then(function () { location.replace("login.html"); });
      } else {
        location.replace("login.html");
      }
    });
    var inst = document.getElementById("install-btn");
    if (inst) inst.addEventListener("click", function () { if (window.PWA) PWA.install(); });
    var navEl = document.getElementById("sidebar-nav");
    if (navEl && !navEl.__grpBound) {
      navEl.__grpBound = true;
      navEl.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest(".nav-group");
        if (!b) return;
        e.preventDefault();
        var sec = b.closest(".nav-sec");
        if (!sec) return;
        var g = sec.getAttribute("data-grp");
        var willOpen = !sec.classList.contains("open");
        // أغلق الباقي وافتح المضغوط فقط (أكورديون)
        navEl.querySelectorAll(".nav-sec").forEach(function (s) {
          var on = willOpen && s === sec;
          s.classList.toggle("open", on);
          var btn = s.querySelector(".nav-group");
          if (btn) btn.setAttribute("aria-expanded", on ? "true" : "false");
        });
        navOpen = willOpen ? g : null;
        try { if (navOpen) sessionStorage.setItem(NAVOPEN_KEY, navOpen); else sessionStorage.removeItem(NAVOPEN_KEY); } catch (err) {}
      });
    }
    var search = document.getElementById("menu-search");
    if (search && !search.__bound) {
      search.__bound = true;
      search.addEventListener("input", function () {
        var q = (search.value || "").trim().toLowerCase();
        var nv = document.getElementById("sidebar-nav");
        if (!nv) return;
        if (q) nv.classList.add("searching"); else nv.classList.remove("searching");
        nv.querySelectorAll("a.nav").forEach(function (a) {
          var label = (a.textContent || "").toLowerCase();
          a.style.display = !q || label.indexOf(q) >= 0 ? "" : "none";
        });
        // أخفِ مجموعات بلا نتائج ظاهرة
        nv.querySelectorAll(".nav-sec").forEach(function (sec) {
          if (!q) { sec.style.display = ""; return; }
          var any = false;
          sec.querySelectorAll("a.nav").forEach(function (a) { if (a.style.display !== "none") any = true; });
          sec.style.display = any ? "" : "none";
        });
      });
    }
    document.dispatchEvent(new Event("shell-ready"));
  }

  function paintShell(active, opts) {
    opts = opts || {};
    var title = TITLES[active] || [active, ""];
    var brand = esc(opts.brand || "نظام المشاريع");
    var sub = esc(opts.sub || "");
    var allowedKeys = opts.allowedKeys || null;
    var showLogout = !!opts.showLogout;

    var htmlStr =
      '<div class="layout" id="layout">' +
        '<aside class="sidebar" id="sidebar">' +
          '<div class="brand">' +
            '<div class="brand-icon" style="padding:0;overflow:hidden;background:none;box-shadow:none"><img src="assets/img/logo-128.png" width="44" height="44" alt="" style="display:block;width:44px;height:44px"/></div>' +
            '<div class="brand-text"><b id="shell-brand">' + brand + '</b><span id="shell-sub">' + sub + '</span></div>' +
          '</div>' +
          '<div class="sidebar-search-wrap">' + ICON.search +
            '<input class="menu-search" id="menu-search" type="search" placeholder="بحث في القائمة…" autocomplete="off" />' +
          '</div>' +
          '<nav class="sidebar-nav" id="sidebar-nav">' + navHtml(active, allowedKeys) + '</nav>' +
          '<div class="sidebar-foot">' +
            '<div class="sidebar-ver"><b>نظام المشاريع</b><span>v' + String((window.APP_CONFIG || {}).APP_VERSION || "0.4") + '</span></div>' +
          '</div>' +
        '</aside>' +
        '<div class="main">' +
          '<header class="topbar">' +
            '<button class="menu-btn ghost" id="toggle-nav" type="button" aria-label="القائمة">' + ICON.menu + '</button>' +
            '<div class="topbar-title"><h1 id="page-h1">' + esc(title[0]) + '</h1><p class="sub" id="page-sub">' + esc(title[1] || "") + '</p></div>' +
            '<div class="topbar-end">' +
              '<button type="button" class="ghost install-btn" id="install-btn" title="تثبيت التطبيق على جهازك" aria-label="تثبيت التطبيق" hidden>' + ICON.download + '</button>' +
              '<div class="notif-wrap"><button type="button" class="ghost bell-btn" id="bell-btn" title="التنبيهات" aria-label="التنبيهات">' + ICON.bell + '<span class="notif-badge" id="notif-badge" hidden>0</span></button>' +
              '<div class="notif-panel card" id="notif-panel" hidden></div></div>' +
              (showLogout ? '<button type="button" class="ghost" id="logout-btn" title="تسجيل الخروج" aria-label="تسجيل الخروج">' + ICON.logout + '</button>' : '') +
            '</div>' +
          '</header>' +
          '<main class="content" id="page"><div class="empty" style="padding:48px 20px;text-align:center;color:var(--muted)">جارٍ التحميل…</div></main>' +
        '</div>' +
      '</div>';

    // استبدل فقط داخل #app إن وُجد، وإلا body — دون مسح الـ scripts
    var app = document.getElementById("app");
    if (app) {
      app.innerHTML = htmlStr;
    } else {
      // أنشئ حاوية app للحفاظ على السكربتات
      var wrap = document.createElement("div");
      wrap.id = "app";
      wrap.innerHTML = htmlStr;
      // أدرج في بداية body دون حذف السكربتات
      if (document.body.firstChild) {
        document.body.insertBefore(wrap, document.body.firstChild);
      } else {
        document.body.appendChild(wrap);
      }
      // احذف أي عناصر تحميل قديمة فارغة
      Array.prototype.slice.call(document.body.children).forEach(function (el) {
        if (el.id !== "app" && el.tagName !== "SCRIPT" && !el.classList.contains("toast")) {
          // لا نحذف السكربتات
        }
      });
    }

    shell = { active: active, bound: false };
    bindShellEvents();
    restoreNavScroll();
  }

  function setActiveNav(active) {
    var title = TITLES[active] || [active, ""];
    var h1 = document.getElementById("page-h1");
    var sub = document.getElementById("page-sub");
    if (h1) h1.textContent = title[0];
    if (sub) sub.textContent = title[1] || "";
    document.querySelectorAll("#sidebar-nav a.nav").forEach(function (a) {
      var on = a.getAttribute("data-key") === active;
      if (on) a.classList.add("active"); else a.classList.remove("active");
    });
    // افتح مجموعة الصفحة الحالية
    var g = groupOfKey(active);
    if (g) {
      navOpen = g;
      try { sessionStorage.setItem(NAVOPEN_KEY, g); } catch (e) {}
      document.querySelectorAll("#sidebar-nav .nav-sec").forEach(function (sec) {
        var on = sec.getAttribute("data-grp") === g;
        sec.classList.toggle("open", on);
        var btn = sec.querySelector(".nav-group");
        if (btn) btn.setAttribute("aria-expanded", on ? "true" : "false");
      });
    }
    if (shell) shell.active = active;
  }

  function reconcileShell(active) {
    if (!document.getElementById("layout")) {
      // لا يوجد شيل بعد — ارسم من بيانات DB
      var company = {};
      try { company = DB.getCompany() || {}; } catch (e) {}
      var brand = company.name || "نظام المشاريع";
      var prof = (DB.getProfile && DB.getProfile()) || null;
      var sub = DB.demoMode ? "وضع تجريبي" : (prof ? (prof.name || prof.full_name || "") : "");
      var allowedKeys = null;
      try {
        allowedKeys = []; NAV.forEach(function (g) { g.items.forEach(function (it) { if (DB.allowed(it.key)) allowedKeys.push(it.key); }); });
      } catch (e) {}
      paintShell(active, {
        brand: brand,
        sub: sub,
        allowedKeys: allowedKeys,
        showLogout: !DB.demoMode
      });
      writeShellCache({
        brand: brand,
        sub: sub,
        allowedKeys: allowedKeys,
        showLogout: !DB.demoMode,
        demo: !!DB.demoMode
      });
      if (window.Notify) try { Notify.mount(); } catch (e) {}
      return;
    }

    // الشيل موجود: حدّث فقط ما تغيّر
    setActiveNav(active);
    var company = {};
    try { company = DB.getCompany() || {}; } catch (e) {}
    var brand = company.name || "نظام المشاريع";
    var prof = (DB.getProfile && DB.getProfile()) || null;
    var sub = DB.demoMode ? "وضع تجريبي" : (prof ? (prof.name || prof.full_name || "") : "");
    var bEl = document.getElementById("shell-brand");
    var sEl = document.getElementById("shell-sub");
    if (bEl) bEl.textContent = brand;
    if (sEl) sEl.textContent = sub;

    // حدّث عناصر القائمة إن تغيّرت الصلاحيات
    var allowedKeys = null;
    try {
      allowedKeys = []; NAV.forEach(function (g) { g.items.forEach(function (it) { if (DB.allowed(it.key)) allowedKeys.push(it.key); }); });
    } catch (e) {}
    var nav = document.getElementById("sidebar-nav");
    if (nav && allowedKeys) {
      var cur = Array.prototype.map.call(nav.querySelectorAll("a.nav"), function (a) { return a.getAttribute("data-key"); }).join(",");
      if (cur !== allowedKeys.join(",")) {
        nav.innerHTML = navHtml(active, allowedKeys);
        restoreNavScroll();
      }
    }

    // زر الخروج
    var end = document.querySelector(".topbar-end");
    if (end && !DB.demoMode && !document.getElementById("logout-btn")) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ghost";
      btn.id = "logout-btn";
      btn.title = "تسجيل الخروج";
      btn.setAttribute("aria-label", "تسجيل الخروج");
      btn.innerHTML = ICON.logout;
      end.appendChild(btn);
      btn.addEventListener("click", function () {
        clearShellCache();
        DB.signOut().then(function () { location.replace("login.html"); });
      });
    }

    writeShellCache({
      brand: brand,
      sub: sub,
      allowedKeys: allowedKeys,
      showLogout: !DB.demoMode,
      demo: !!DB.demoMode
    });
    if (window.Notify) try { Notify.mount(); } catch (e) {}
    restoreNavScroll();
  }

  /** رسم فوري من الكاش قبل اكتمال DB — يمنع الشاشة البيضاء واختفاء القائمة */
  function boot() {
    if (document.body.classList.contains("auth-body")) return;
    if (document.getElementById("layout")) return;
    var key = document.body.getAttribute("data-page") || "dashboard";
    var cache = readShellCache();
    if (cache) {
      paintShell(key, {
        brand: cache.brand || "نظام المشاريع",
        sub: cache.sub || "",
        allowedKeys: cache.allowedKeys || null,
        showLogout: !!cache.showLogout
      });
    } else {
      // هيكل عظمي بسيط حتى يصل DB
      paintShell(key, { brand: "نظام المشاريع", sub: "", allowedKeys: null, showLogout: false });
    }
  }

  function loadPageScript(pageKey) {
    // تجنّب تحميل مزدوج
    if (window.__pageScriptLoaded === pageKey) return;
    window.__pageScriptLoaded = pageKey;
    var s = document.createElement("script");
    s.src = "js/pages/" + pageKey + ".js?v=" + ((window.APP_CONFIG && APP_CONFIG.APP_VERSION) || "4");
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
      reconcileShell(pageKey);
    },
    loadPageScript: loadPageScript,
    clearShellCache: clearShellCache
  };

  // رسم فوري قبل انتظار DB
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      boot();
      startApp();
    });
  } else {
    boot();
    startApp();
  }

  function startApp() {
    if (document.body.classList.contains("auth-body")) return;
    if (!window.DB) {
      var pg = document.getElementById("page");
      if (pg) pg.innerHTML = '<p style="padding:2rem">خطأ في تحميل النظام</p>';
      return;
    }
    DB.init().then(function () {
      var pageKey = document.body.getAttribute("data-page") || "dashboard";
      UI.mountShell();
      if (!DB.allowed(pageKey)) {
        var pg = document.getElementById("page");
        if (pg) pg.innerHTML = '<div class="card empty" style="padding:48px 20px"><h3 style="margin:0 0 8px">غير مصرّح لك بهذه الصفحة</h3></div>';
        return;
      }
      loadPageScript(pageKey);
    }).catch(function (e) {
      console.error(e);
      var pg = document.getElementById("page");
      if (pg) {
        pg.innerHTML = '<div class="card error" style="padding:2rem">تعذّر تهيئة النظام' +
          (e && e.message ? " — " + esc(e.message) : "") + "</div>";
      }
    });
  }
})();
