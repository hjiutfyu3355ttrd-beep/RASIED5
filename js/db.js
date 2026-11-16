// طبقة البيانات — نظام إدارة المشاريع والتشطيبات
// Demo (localStorage) أو Supabase لاحقاً
(function () {
  "use strict";
  var cfg = window.APP_CONFIG || {};
  var configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  var fatal = "";
  var client = null;
  var LS_KEY = cfg.LS_KEY || "project_demo_v1";

  if (configured) {
    if (window.supabase && window.supabase.createClient) {
      client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    } else {
      fatal = "تعذّر تحميل مكتبة Supabase. تأكد من الاتصال بالإنترنت ثم أعد تحميل الصفحة.";
    }
  }
  var live = !!client;
  var demoMode = !configured; // مهم: لو الإعدادات موجودة لكن المكتبة فشلت → لا نرجع لـ Demo بصمت
  var profile = null;
  var cache = null;
  var commitQueue = Promise.resolve();

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function today() {
    return new Date().toISOString().slice(0, 10);
  }
  function nowISO() {
    return new Date().toISOString();
  }
  function num(v) {
    var n = Number(v);
    return isNaN(n) ? 0 : n;
  }
  function round2(n) {
    return Math.round((num(n) + Number.EPSILON) * 100) / 100;
  }

  // ——— بذرة البيانات (مطابقة لبيانات الشيت التجريبية) ———
  var SEED = {
    company: {
      id: "comp-1",
      name: "شركة التشطيبات",
      phone: "01000000000",
      currency: "ج.م",
      address: "القاهرة",
      inventory_method: "moving_weighted_avg" // متوسط مرجح متحرك
    },
    engineers: [
      { id: "ENG-0001", code: "ENG-0001", name: "أحمد محمد", phone: "01000000001", address: "القاهرة", status: "active" }
    ],
    projects: [
      {
        id: "PRJ-0001",
        code: "PRJ-0001",
        name: "شقة سكنية - مدينة نصر",
        engineer_id: "ENG-0001",
        address: "مدينة نصر",
        area: "القاهرة",
        description: "",
        start_date: "2026-10-03",
        expected_end: "2027-01-01",
        actual_end: null,
        status: "in_progress", // new | in_progress | paused | completed | delivered | closed
        notes: ""
      }
    ],
    suppliers: [
      {
        id: "SUP-0001",
        code: "SUP-0001",
        name: "شركة توريد مواد البناء",
        phone: "01000000002",
        address: "القاهرة",
        activity: "خامات تشطيبات",
        opening_balance: 0,
        notes: "",
        status: "active"
      }
    ],
    items: [
      {
        id: "ITM-0001",
        code: "ITM-0001",
        name: "سيراميك أرضيات 60×60",
        category: "تشطيبات",
        unit: "متر مربع",
        default_purchase_price: 53,
        reorder_level: 10,
        preferred_supplier_id: "SUP-0001",
        notes: ""
      }
    ],
    warehouses: [
      { id: "WH-0001", code: "WH-0001", name: "المخزن الرئيسي", location: "القاهرة", notes: "" }
    ],
    cashboxes: [
      { id: "CB-0001", code: "CB-0001", name: "الخزينة الرئيسية", opening_balance: 10000, notes: "" }
    ],
    expense_types: [
      { id: "EXT-001", code: "EXT-001", name: "مصروفات أخرى", category: "تشغيل" },
      { id: "EXT-002", code: "EXT-002", name: "تركيب", category: "تنفيذ" },
      { id: "EXT-003", code: "EXT-003", name: "صيانة", category: "تشغيل" },
      { id: "EXT-004", code: "EXT-004", name: "أدوات", category: "مواد" },
      { id: "EXT-005", code: "EXT-005", name: "نقل مخلفات", category: "تشغيل" },
      { id: "EXT-006", code: "EXT-006", name: "تحميل وتنزيل", category: "تشغيل" },
      { id: "EXT-007", code: "EXT-007", name: "إيجار معدات", category: "تشغيل" }
    ],
    // فواتير مشتريات
    purchase_invoices: [
      {
        id: "PUR-0001",
        code: "PUR-0001",
        date: "2026-10-03",
        supplier_id: "SUP-0001",
        payment_terms: "آجل",
        paid_at_purchase: 0,
        cashbox_id: null,
        total: 530,
        balance: 530,
        notes: ""
      },
      {
        id: "PUR-0002",
        code: "PUR-0002",
        date: "2026-10-03",
        supplier_id: "SUP-0001",
        payment_terms: "آجل",
        paid_at_purchase: 0,
        cashbox_id: null,
        total: 530,
        balance: 530,
        notes: ""
      }
    ],
    purchase_details: [
      {
        id: "PD-0001",
        invoice_id: "PUR-0001",
        item_id: "ITM-0001",
        warehouse_id: "WH-0001",
        project_id: null,
        qty: 10,
        unit_price: 53,
        discount: 0,
        tax: 0,
        net: 530,
        destination: "warehouse" // warehouse | project
      },
      {
        id: "PD-0002",
        invoice_id: "PUR-0002",
        item_id: "ITM-0001",
        warehouse_id: "WH-0001",
        project_id: null,
        qty: 10,
        unit_price: 53,
        discount: 0,
        tax: 0,
        net: 530,
        destination: "warehouse"
      }
    ],
    // حركات المخزون (سيتم إعادة حساب المتوسط منها)
    stock_movements: [
      {
        id: "STK-0001",
        date: "2026-10-03",
        type: "purchase_in", // purchase_in | issue_to_project | return_from_project | purchase_direct | transfer_in | transfer_out | return_to_supplier | adjust_plus | adjust_minus
        ref: "PD-0001",
        item_id: "ITM-0001",
        warehouse_id: "WH-0001",
        project_id: null,
        engineer_id: null,
        qty: 10,
        unit_cost: 53,
        value: 530,
        original_issue_id: null,
        notes: ""
      },
      {
        id: "STK-0002",
        date: "2026-10-03",
        type: "purchase_in",
        ref: "PD-0002",
        item_id: "ITM-0001",
        warehouse_id: "WH-0001",
        project_id: null,
        engineer_id: null,
        qty: 10,
        unit_cost: 53,
        value: 530,
        original_issue_id: null,
        notes: ""
      },
      {
        id: "STK-0003",
        date: "2026-10-03",
        type: "issue_to_project",
        ref: null,
        item_id: "ITM-0001",
        warehouse_id: "WH-0001",
        project_id: "PRJ-0001",
        engineer_id: "ENG-0001",
        qty: 4,
        unit_cost: 53,
        value: 212,
        original_issue_id: null,
        notes: ""
      },
      {
        id: "STK-0004",
        date: "2026-10-03",
        type: "return_from_project",
        ref: null,
        item_id: "ITM-0001",
        warehouse_id: "WH-0001",
        project_id: "PRJ-0001",
        engineer_id: "ENG-0001",
        qty: 1,
        unit_cost: 53,
        value: 53,
        original_issue_id: "STK-0003",
        notes: ""
      }
    ],
    // مدفوعات موردين
    supplier_payments: [
      { id: "PAY-0001", code: "PAY-0001", date: "2026-10-03", supplier_id: "SUP-0001", amount: 400, method: "نقدي", cashbox_id: "CB-0001", notes: "" },
      { id: "PAY-0002", code: "PAY-0002", date: "2026-10-03", supplier_id: "SUP-0001", amount: 330, method: "نقدي", cashbox_id: "CB-0001", notes: "" },
      { id: "PAY-0003", code: "PAY-0003", date: "2026-10-03", supplier_id: "SUP-0001", amount: 330, method: "نقدي", cashbox_id: "CB-0001", notes: "" }
    ],
    // فواتير مشاريع (إيراد)
    project_invoices: [
      { id: "INV-0001", code: "INV-0001", date: "2026-10-03", project_id: "PRJ-0001", engineer_id: "ENG-0001", amount: 20000, notes: "" }
    ],
    // مقبوضات عملاء
    customer_receipts: [
      { id: "REC-0001", code: "REC-0001", date: "2026-10-03", project_id: "PRJ-0001", engineer_id: "ENG-0001", amount: 10000, method: "نقدي", cashbox_id: "CB-0001", notes: "" }
    ],
    // مصروفات مشاريع
    project_expenses: [
      { id: "EXP-0001", code: "EXP-0001", date: "2026-10-03", project_id: "PRJ-0001", engineer_id: "ENG-0001", expense_type_id: "EXT-001", description: "مصروفات", amount: 500, paid: 500, method: "نقدي", cashbox_id: "CB-0001", notes: "" }
    ],
    // عمالة
    labor: [
      {
        id: "LAB-0001",
        date: "2026-10-03",
        project_id: "PRJ-0001",
        engineer_id: "ENG-0001",
        worker_name: "عامل",
        work_type: "تشطيبات",
        days: 5,
        hours: 0,
        day_rate: 1000,
        hour_rate: 0,
        total: 5000,
        paid: 5000,
        cashbox_id: "CB-0001",
        payment_status: "paid",
        notes: ""
      }
    ],
    // نقل
    transports: [
      {
        id: "TRN-0001",
        code: "TRN-0001",
        date: "2026-10-03",
        project_id: "PRJ-0001",
        engineer_id: "ENG-0001",
        carrier: "ناقل",
        type: "نقل مواد",
        amount: 1000,
        paid: 1000,
        cashbox_id: "CB-0001",
        notes: ""
      }
    ],
    // تشوين
    storages: [
      {
        id: "STO-0001",
        code: "STO-0001",
        date: "2026-10-03",
        project_id: "PRJ-0001",
        engineer_id: "ENG-0001",
        place: "موقع المشروع",
        duration: 5,
        duration_unit: "يوم",
        unit_price: 100,
        total: 500,
        paid: 500,
        cashbox_id: "CB-0001",
        notes: ""
      }
    ],
    // حركات خزينة يدوية
    cash_movements: [],
    // إعدادات القوائم
    settings: {
      project_statuses: ["جديد", "جاري التنفيذ", "متوقف", "مكتمل", "تم التسليم", "مغلق"],
      payment_methods: ["نقدي", "تحويل", "شيك", "آجل", "أخرى"],
      payment_terms: ["نقدي", "آجل", "تحويل", "أخرى"],
      item_categories: ["خامات", "أدوات", "مستلزمات", "كهرباء", "سباكة", "تشطيبات", "دهانات", "أخشاب", "أخرى"],
      units: ["قطعة", "كجم", "متر", "متر مربع", "متر مكعب", "لتر", "طن", "ساعة", "يوم", "عبوة"],
      stock_types: [
        { key: "purchase_in", label: "شراء للمخزن" },
        { key: "issue_to_project", label: "صرف للمشروع" },
        { key: "return_from_project", label: "مرتجع من المشروع" },
        { key: "purchase_direct", label: "شراء مباشر للمشروع" },
        { key: "transfer_in", label: "تحويل وارد" },
        { key: "transfer_out", label: "تحويل صادر" },
        { key: "return_to_supplier", label: "مرتجع للمورد" },
        { key: "adjust_plus", label: "تسوية زيادة" },
        { key: "adjust_minus", label: "تسوية عجز" }
      ]
    },
    app_users: [
      { id: "u-admin", phone: "01000000000", name: "المدير", role: "admin", active: true }
    ]
  };

  // ترتيب الجداول للنسخ الاحتياطي
  var TABLES = [
    "company", "engineers", "projects", "suppliers", "items", "warehouses", "cashboxes",
    "expense_types", "purchase_invoices", "purchase_details", "stock_movements",
    "supplier_payments", "project_invoices", "customer_receipts", "project_expenses",
    "labor", "transports", "storages", "cash_movements", "settings", "app_users"
  ];

  // أعمدة مسموح إرسالها إلى Supabase (أي حقل آخر في الصف يُتجاهل)
  var COLS = {
    company: ["id", "name", "phone", "currency", "address", "inventory_method"],
    engineers: ["id", "code", "name", "phone", "address", "status", "notes"],
    projects: ["id", "code", "name", "engineer_id", "address", "area", "description", "start_date", "expected_end", "actual_end", "status", "notes"],
    suppliers: ["id", "code", "name", "phone", "address", "activity", "opening_balance", "notes", "status"],
    items: ["id", "code", "name", "category", "unit", "default_purchase_price", "reorder_level", "preferred_supplier_id", "notes"],
    warehouses: ["id", "code", "name", "location", "notes"],
    cashboxes: ["id", "code", "name", "opening_balance", "notes"],
    expense_types: ["id", "code", "name", "category"],
    purchase_invoices: ["id", "code", "date", "supplier_id", "payment_terms", "paid_at_purchase", "cashbox_id", "total", "balance", "notes"],
    purchase_details: ["id", "invoice_id", "item_id", "warehouse_id", "project_id", "qty", "unit_price", "discount", "tax", "net", "destination"],
    stock_movements: ["id", "date", "type", "ref", "item_id", "warehouse_id", "project_id", "engineer_id", "qty", "unit_cost", "value", "original_issue_id", "notes"],
    supplier_payments: ["id", "code", "date", "supplier_id", "amount", "method", "cashbox_id", "notes"],
    project_invoices: ["id", "code", "date", "project_id", "engineer_id", "amount", "notes"],
    customer_receipts: ["id", "code", "date", "project_id", "engineer_id", "amount", "method", "cashbox_id", "notes"],
    project_expenses: ["id", "code", "date", "project_id", "engineer_id", "expense_type_id", "description", "amount", "paid", "method", "cashbox_id", "notes"],
    labor: ["id", "date", "project_id", "engineer_id", "worker_name", "work_type", "days", "hours", "day_rate", "hour_rate", "total", "paid", "cashbox_id", "payment_status", "notes"],
    transports: ["id", "code", "date", "project_id", "engineer_id", "carrier", "type", "amount", "paid", "cashbox_id", "notes"],
    storages: ["id", "code", "date", "project_id", "engineer_id", "place", "duration", "duration_unit", "unit_price", "total", "paid", "cashbox_id", "notes"],
    cash_movements: ["id", "date", "cashbox_id", "direction", "amount", "description", "notes"],
    app_users: ["id", "name", "phone", "role", "active"]
  };
  var DATE_COLS = { date: 1, start_date: 1, expected_end: 1, actual_end: 1 };

  /** يجهّز صفاً للإرسال: أعمدة معروفة فقط، والنص الفارغ في التواريخ والمفاتيح الأجنبية → null */
  function toPayload(table, row) {
    var out = {};
    (COLS[table] || []).forEach(function (c) {
      if (row[c] === undefined) return;
      var v = row[c];
      if (v === "" && (DATE_COLS[c] || /_id$/.test(c))) v = null;
      out[c] = v;
    });
    return out;
  }

  /** رسالة خطأ عربية مفهومة */
  function friendlyError(err) {
    var code = err && err.code;
    if (code === "23505") return "هذا الكود/المعرّف مستخدم من قبل";
    if (code === "23503") return "السجل مرتبط ببيانات أخرى (لا يمكن الحفظ/الحذف)";
    if (code === "23502") return "حقل مطلوب فارغ";
    if (code === "23514") return "قيمة غير مسموحة في أحد الحقول";
    if (code === "42501" || /row-level security/i.test((err && err.message) || "")) return "لا تملك صلاحية تنفيذ هذه العملية";
    if (err && /Failed to fetch|NetworkError/i.test(err.message || "")) return "تعذّر الاتصال بالخادم، تحقق من الإنترنت";
    return (err && err.message) || "خطأ غير متوقع";
  }
  function fail(err) {
    var e = new Error(friendlyError(err));
    e.original = err;
    if (typeof DB !== "undefined" && DB.onError) { try { DB.onError(e); } catch (x) {} }
    return Promise.reject(e);
  }

  /** يجلب كل صفوف جدول (صفحات من 1000 لأن Supabase يقطع عند 1000) */
  function fetchAll(table) {
    var size = 1000;
    function page(from, acc) {
      return client.from(table).select("*").order("id").range(from, from + size - 1).then(function (r) {
        if (r.error) throw r.error;
        var rows = r.data || [];
        acc = acc.concat(rows);
        return rows.length < size ? acc : page(from + size, acc);
      });
    }
    return page(0, []);
  }

  function never() { return new Promise(function () {}); }

  // ——— الدخول بالهاتف: يُحوَّل لبريد داخلي (أو يُقبل البريد الحقيقي كما هو) ———
  function normPhone(v) {
    var d = String(v || "").replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 0x660); }).replace(/\D/g, "");
    if (d.indexOf("00") === 0) d = d.slice(2);
    return d;
  }
  function loginEmail(identifier) {
    var v = String(identifier || "").trim();
    if (v.indexOf("@") > 0) return v;
    return "p" + normPhone(v) + "@" + (cfg.PHONE_EMAIL_DOMAIN || "phone.projectserp.app");
  }

  function showBlocked(title, msg, note) {
    document.body.innerHTML =
      '<div class="login-wrap"><div class="card suspended-card">' +
      '<div class="susp-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10.3 3.9-8.5 14.7A2 2 0 0 0 3.5 21.6h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg></div>' +
      '<h2></h2><p class="muted"></p><div class="susp-note" hidden></div>' +
      '<button type="button" class="primary" id="blocked-out">تسجيل الخروج</button></div></div>';
    var box = document.body.querySelector(".card");
    box.querySelector("h2").textContent = title;
    box.querySelector("p").textContent = msg;
    if (note) { var n = box.querySelector(".susp-note"); n.textContent = note; n.hidden = false; }
    document.getElementById("blocked-out").onclick = function () {
      client.auth.signOut().then(function () { location.replace("login.html"); });
    };
  }

  function loadAllLive(userId) {
    var plain = TABLES.filter(function (t) { return t !== "company" && t !== "settings"; });
    return Promise.all([
      Promise.all(plain.map(fetchAll)),
      fetchAll("company"),
      fetchAll("settings")
    ]).then(function (res) {
      var data = {};
      plain.forEach(function (t, i) { data[t] = res[0][i]; });
      data.company = res[1][0] || null;
      var main = res[2].filter(function (r) { return r.id === "main"; })[0];
      data.settings = Object.assign({}, deepClone(SEED.settings), (main && main.data) || {});
      return data;
    });
  }

  function initLive() {
    var authPage = document.body.classList.contains("auth-body");
    return client.auth.getSession().then(function (r) {
      var session = r.data && r.data.session;
      if (!session) {
        if (authPage) return null;
        location.replace("login.html");
        return never();
      }
      if (authPage) { location.replace("dashboard.html"); return never(); }

      client.auth.onAuthStateChange(function (ev) {
        if (ev === "SIGNED_OUT") location.replace("login.html");
      });

      return client.from("app_users").select("*").eq("id", session.user.id).maybeSingle().then(function (pr) {
        if (pr.error) throw pr.error;
        var p = pr.data;
        if (!p || !p.active) {
          showBlocked("الحساب موقوف", "تواصل مع مدير النظام.", p && p.status_note);
          return never();
        }
        profile = {
          id: p.id, role: p.role, name: p.name || session.user.email, email: session.user.email,
          phone: p.phone || "", permissions: Array.isArray(p.permissions) ? p.permissions : []
        };
        return loadAllLive(p.id).then(function (data) {
          cache = data;
          DB.ready = true;
          // آخر ظهور + أيام الاستخدام (لا يعطّل الصفحة لو فشل)
          try { client.rpc("heartbeat").then(function () {}, function () {}); } catch (e) {}
          return profile;
        });
      });
    });
  }

  function liveSave(table, row) {
    if (table === "settings") {
      var merged = Object.assign({}, cache.settings, row);
      return client.from("settings").upsert({ id: "main", data: merged }, { onConflict: "id" }).select().single()
        .then(function (r) {
          if (r.error) return fail(r.error);
          cache.settings = merged;
          return merged;
        });
    }
    if (!COLS[table]) return fail(new Error("جدول غير معروف: " + table));

    var existing = table === "company" ? cache.company : null;
    if (table === "company") {
      row = Object.assign({ id: "comp-1" }, existing || {}, row);
    } else {
      if (!row.id) row.id = uid();
      var old = (cache[table] || []).find(function (x) { return x.id === row.id; });
      if (old) row = Object.assign({}, old, row);
    }
    return client.from(table).upsert(toPayload(table, row), { onConflict: "id" }).select().single()
      .then(function (r) {
        if (r.error) return fail(r.error);
        var saved = r.data;
        if (table === "company") { cache.company = saved; return saved; }
        var arr = cache[table] || (cache[table] = []);
        var idx = arr.findIndex(function (x) { return x.id === saved.id; });
        if (idx >= 0) arr[idx] = saved; else arr.push(saved);
        return saved;
      });
  }

  function liveRemove(table, id) {
    if (!COLS[table] || table === "company") return fail(new Error("لا يمكن الحذف من: " + table));
    return client.from(table).delete().eq("id", id).select("id").then(function (r) {
      if (r.error) return fail(r.error);
      if (!r.data || !r.data.length) return fail(new Error("لم يتم الحذف (لا تملك الصلاحية أو السجل غير موجود)"));
      cache[table] = (cache[table] || []).filter(function (x) { return x.id !== id; });
    });
  }

  function deepClone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function loadDemo() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        // تأكد من وجود كل الجداول
        TABLES.forEach(function (t) {
          if (t === "company" || t === "settings") {
            if (!data[t]) data[t] = deepClone(SEED[t]);
          } else if (!Array.isArray(data[t])) {
            data[t] = deepClone(SEED[t] || []);
          }
        });
        return data;
      }
    } catch (e) {}
    return deepClone(SEED);
  }

  function saveDemo() {
    if (!demoMode || !cache) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(cache));
    } catch (e) {
      console.error("saveDemo", e);
    }
  }

  // ——— محرك متوسط التكلفة المرجح المتحرك ———
  /**
   * يعيد حساب رصيد المخزون ومتوسط التكلفة لكل صنف/مخزن
   * بناءً على ترتيب الحركات الزمني.
   * يرجع خريطة: key = item_id|warehouse_id → { qty, value, avg_cost }
   */
  function rebuildInventory() {
    var map = {};
    var moves = (cache.stock_movements || []).slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.id || "").localeCompare(b.id || "");
    });

    moves.forEach(function (m) {
      var key = m.item_id + "|" + (m.warehouse_id || "");
      if (!map[key]) map[key] = { qty: 0, value: 0, avg_cost: 0 };

      var s = map[key];
      var qty = num(m.qty);
      var unitCost = num(m.unit_cost);
      var value = num(m.value) || round2(qty * unitCost);

      if (m.type === "purchase_in" || m.type === "return_from_project" || m.type === "transfer_in" || m.type === "adjust_plus") {
        // وارد → يحدّث المتوسط
        var newQty = s.qty + qty;
        var newValue = s.value + value;
        s.qty = newQty;
        s.value = round2(newValue);
        s.avg_cost = newQty > 0 ? round2(newValue / newQty) : 0;
      } else if (m.type === "issue_to_project" || m.type === "transfer_out" || m.type === "return_to_supplier" || m.type === "adjust_minus") {
        // صادر → يستخدم المتوسط الحالي (لا يغيّر المتوسط إلا لو الكمية صفر)
        var cost = s.avg_cost || unitCost;
        var outValue = round2(qty * cost);
        // حدّث الحركة نفسها لو محتاجة
        m.unit_cost = cost;
        m.value = outValue;
        s.qty = round2(s.qty - qty);
        s.value = round2(s.value - outValue);
        if (s.qty <= 0.0001) {
          s.qty = 0;
          s.value = 0;
          s.avg_cost = 0;
        } else {
          s.avg_cost = round2(s.value / s.qty);
        }
      } else if (m.type === "purchase_direct") {
        // شراء مباشر للمشروع: لا يدخل المخزن، لكن نسجله كتكلفة على المشروع
        // لا يؤثر على رصيد المخزن
      }
    });
    return map;
  }

  /** رصيد صنف في مخزن */
  function getStock(itemId, warehouseId) {
    var inv = rebuildInventory();
    var key = itemId + "|" + (warehouseId || "");
    return inv[key] || { qty: 0, value: 0, avg_cost: 0 };
  }

  /** كل أرصدة المخزون */
  function listStockBalances() {
    var inv = rebuildInventory();
    var rows = [];
    Object.keys(inv).forEach(function (key) {
      var parts = key.split("|");
      var itemId = parts[0];
      var whId = parts[1] || null;
      var s = inv[key];
      if (s.qty === 0 && s.value === 0) return;
      var item = (cache.items || []).find(function (i) { return i.id === itemId; });
      var wh = (cache.warehouses || []).find(function (w) { return w.id === whId; });
      rows.push({
        item_id: itemId,
        item_code: item ? item.code : "",
        item_name: item ? item.name : "",
        warehouse_id: whId,
        warehouse_name: wh ? wh.name : "",
        qty: s.qty,
        value: s.value,
        avg_cost: s.avg_cost,
        reorder_level: item ? num(item.reorder_level) : 0,
        low: item && s.qty <= num(item.reorder_level)
      });
    });
    return rows;
  }

  // ——— حساب ربحية مشروع ———
  function calcProjectProfit(projectId) {
    var inv = rebuildInventory();
    var materials = 0;
    (cache.stock_movements || []).forEach(function (m) {
      if (m.project_id !== projectId) return;
      if (m.type === "issue_to_project" || m.type === "purchase_direct") {
        materials += num(m.value);
      } else if (m.type === "return_from_project") {
        materials -= num(m.value);
      }
    });

    var laborCost = 0;
    (cache.labor || []).forEach(function (l) {
      if (l.project_id === projectId) laborCost += num(l.total);
    });

    var transportCost = 0;
    (cache.transports || []).forEach(function (t) {
      if (t.project_id === projectId) transportCost += num(t.amount);
    });

    var storageCost = 0;
    (cache.storages || []).forEach(function (s) {
      if (s.project_id === projectId) storageCost += num(s.total);
    });

    var otherExp = 0;
    (cache.project_expenses || []).forEach(function (e) {
      if (e.project_id === projectId) otherExp += num(e.amount);
    });

    var revenue = 0;
    (cache.project_invoices || []).forEach(function (inv) {
      if (inv.project_id === projectId) revenue += num(inv.amount);
    });

    var received = 0;
    (cache.customer_receipts || []).forEach(function (r) {
      if (r.project_id === projectId) received += num(r.amount);
    });

    var totalCost = round2(materials + laborCost + transportCost + storageCost + otherExp);
    var net = round2(revenue - totalCost);
    var margin = revenue > 0 ? round2(net / revenue) : 0;

    return {
      project_id: projectId,
      revenue: revenue,
      materials: round2(materials),
      labor: round2(laborCost),
      transport: round2(transportCost),
      storage: round2(storageCost),
      other: round2(otherExp),
      total_cost: totalCost,
      net: net,
      margin: margin,
      received: received,
      receivable: round2(revenue - received)
    };
  }

  function listProjectProfits() {
    return (cache.projects || []).map(function (p) {
      var c = calcProjectProfit(p.id);
      var eng = (cache.engineers || []).find(function (e) { return e.id === p.engineer_id; });
      return Object.assign({
        project_code: p.code,
        project_name: p.name,
        engineer_id: p.engineer_id,
        engineer_name: eng ? eng.name : "",
        status: p.status
      }, c);
    });
  }

  // ——— حسابات الموردين ———
  function calcSupplierBalance(supplierId) {
    var opening = 0;
    var sup = (cache.suppliers || []).find(function (s) { return s.id === supplierId; });
    if (sup) opening = num(sup.opening_balance);

    var purchases = 0;
    var paidAtPurchase = 0;
    (cache.purchase_invoices || []).forEach(function (inv) {
      if (inv.supplier_id === supplierId) {
        purchases += num(inv.total);
        paidAtPurchase += num(inv.paid_at_purchase);
      }
    });

    var payments = 0;
    (cache.supplier_payments || []).forEach(function (p) {
      if (p.supplier_id === supplierId) payments += num(p.amount);
    });

    // TODO: مرتجعات المورد لاحقاً
    var due = round2(opening + purchases - paidAtPurchase - payments);
    return {
      supplier_id: supplierId,
      opening: opening,
      purchases: purchases,
      paid_at_purchase: paidAtPurchase,
      payments: payments,
      returns: 0,
      due: due
    };
  }

  // ——— أرصدة الخزائن ———
  function calcCashboxBalance(cashboxId) {
    var cb = (cache.cashboxes || []).find(function (c) { return c.id === cashboxId; });
    var bal = cb ? num(cb.opening_balance) : 0;

    // مقبوضات عملاء
    (cache.customer_receipts || []).forEach(function (r) {
      if (r.cashbox_id === cashboxId) bal += num(r.amount);
    });
    // مدفوعات موردين
    (cache.supplier_payments || []).forEach(function (p) {
      if (p.cashbox_id === cashboxId) bal -= num(p.amount);
    });
    // مصروفات مشاريع
    (cache.project_expenses || []).forEach(function (e) {
      if (e.cashbox_id === cashboxId) bal -= num(e.paid);
    });
    // عمالة
    (cache.labor || []).forEach(function (l) {
      if (l.cashbox_id === cashboxId) bal -= num(l.paid);
    });
    // نقل
    (cache.transports || []).forEach(function (t) {
      if (t.cashbox_id === cashboxId) bal -= num(t.paid);
    });
    // تشوين
    (cache.storages || []).forEach(function (s) {
      if (s.cashbox_id === cashboxId) bal -= num(s.paid);
    });
    // مدفوع عند الشراء
    (cache.purchase_invoices || []).forEach(function (inv) {
      if (inv.cashbox_id === cashboxId) bal -= num(inv.paid_at_purchase);
    });
    // حركات يدوية
    (cache.cash_movements || []).forEach(function (m) {
      if (m.cashbox_id === cashboxId) {
        if (m.direction === "in") bal += num(m.amount);
        else bal -= num(m.amount);
      }
    });

    return round2(bal);
  }

  // ——— واجهة عامة ———
  var DB = {
    ready: false,
    demoMode: demoMode,
    fatal: fatal,
    onError: null,

    init: function () {
      return new Promise(function (resolve, reject) {
        if (demoMode) {
          cache = loadDemo();
          DB.ready = true;
          profile = { id: "u-admin", role: "admin", name: "المدير" };
          resolve(profile);
          return;
        }
        if (!client) { reject(new Error(fatal || "تعذّر تهيئة Supabase")); return; }
        initLive().then(resolve, reject);
      });
    },

    // ——— المصادقة (Live) ———
    /** identifier: رقم هاتف أو بريد إلكتروني */
    signIn: function (identifier, password) {
      if (!client) return Promise.reject(new Error(fatal || "Supabase غير مهيأ"));
      return client.auth.signInWithPassword({ email: loginEmail(identifier), password: password }).then(function (r) {
        if (r.error) {
          var m = /Invalid login credentials/i.test(r.error.message) ? "رقم الهاتف أو كلمة المرور غير صحيحة" : friendlyError(r.error);
          return Promise.reject(new Error(m));
        }
        return client.rpc("record_login", { p_ua: navigator.userAgent }).then(function () { return r.data; }, function () { return r.data; });
      });
    },
    normPhone: normPhone,
    client: function () { return client; },
    /** استدعاء Edge Function وإرجاع رسالة الخطأ العربية القادمة منها */
    fn: function (name, body) {
      if (!client) return Promise.reject(new Error(fatal || "Supabase غير مهيأ"));
      return client.functions.invoke(name, { body: body }).then(function (r) {
        if (!r.error) return r.data;
        var msg = "تعذّر تنفيذ العملية";
        var ctx = r.error.context;
        if (ctx && ctx.json) {
          return ctx.json().then(function (j) { throw new Error((j && j.message) || msg); }, function () { throw new Error(msg); });
        }
        throw new Error(msg);
      });
    },
    /** هل المستخدم الحالي مسموح له بصفحة؟ (الرئيسية متاحة للجميع، المدير كل شيء) */
    allowed: function (pageKey) {
      if (demoMode) return true;
      if (!profile) return false;
      if (pageKey === "dashboard" || pageKey === "login") return true;
      if (profile.role === "admin") return true;
      if (pageKey === "users") return false;
      return profile.permissions.indexOf(pageKey) !== -1;
    },
    hasFlag: function (flag) { return !!profile && profile.permissions.indexOf(flag) !== -1; },
    signOut: function () {
      if (!client) return Promise.resolve();
      return client.auth.signOut();
    },
    getProfile: function () { return profile; },
    /** إعادة تحميل كل البيانات من السيرفر (Live فقط) */
    reload: function () {
      if (demoMode || !profile) return Promise.resolve();
      return loadAllLive(profile.id).then(function (data) { cache = data; });
    },

    role: function () { return profile ? profile.role : null; },
    isAdmin: function () { return profile && profile.role === "admin"; },
    canWrite: function () { return !!profile && (profile.role === "admin" || profile.role === "staff"); },
    canEdit: function () { return !!profile && (profile.role === "admin" || (profile.role === "staff" && profile.permissions.indexOf("deny:edit") === -1)); },
    canDelete: function () { return !!profile && (profile.role === "admin" || (profile.role === "staff" && profile.permissions.indexOf("deny:delete") === -1)); },

    // قوائم بسيطة
    list: function (table) {
      if (!cache) return [];
      if (table === "company") return cache.company ? [cache.company] : [];
      if (table === "settings") return cache.settings ? [cache.settings] : [];
      return (cache[table] || []).slice();
    },
    get: function (table, id) {
      if (table === "company") return cache.company;
      if (table === "settings") return cache.settings;
      return (cache[table] || []).find(function (r) { return r.id === id; }) || null;
    },
    getCompany: function () { return cache ? cache.company : null; },

    // حفظ عام — Demo: localStorage / Live: Supabase (الكاش يتحدّث بعد نجاح الحفظ)
    save: function (table, row) {
      if (!cache) return Promise.reject(new Error("not ready"));
      if (!demoMode) {
        if (!DB.canWrite()) return fail({ code: "42501" });
        var isUpdate = table === "company" || table === "settings" ||
          (row && row.id && (cache[table] || []).some(function (x) { return x.id === row.id; }));
        if (isUpdate && !DB.canEdit()) return fail({ code: "42501" });
        return liveSave(table, row);
      }
      if (table === "company") {
        cache.company = Object.assign({}, cache.company, row);
        saveDemo();
        return Promise.resolve(cache.company);
      }
      if (table === "settings") {
        cache.settings = Object.assign({}, cache.settings, row);
        saveDemo();
        return Promise.resolve(cache.settings);
      }
      var arr = cache[table] || (cache[table] = []);
      if (!row.id) row.id = uid();
      var idx = arr.findIndex(function (r) { return r.id === row.id; });
      if (idx >= 0) arr[idx] = Object.assign({}, arr[idx], row);
      else arr.push(row);
      saveDemo();
      return Promise.resolve(row);
    },
    remove: function (table, id) {
      if (!cache) return Promise.reject(new Error("not ready"));
      if (!demoMode) {
        if (!DB.canDelete()) return fail({ code: "42501" });
        return liveRemove(table, id);
      }
      var arr = cache[table] || [];
      cache[table] = arr.filter(function (r) { return r.id !== id; });
      saveDemo();
      return Promise.resolve();
    },

    // مخزون
    rebuildInventory: rebuildInventory,
    getStock: getStock,
    listStockBalances: listStockBalances,

    // ربحية
    calcProjectProfit: calcProjectProfit,
    listProjectProfits: listProjectProfits,

    // موردين وخزينة
    calcSupplierBalance: calcSupplierBalance,
    calcCashboxBalance: calcCashboxBalance,

    // لوحة التحكم ملخص
    dashboardSummary: function () {
      var projects = cache.projects || [];
      var activeProjects = projects.filter(function (p) { return p.status === "in_progress"; }).length;
      var profits = listProjectProfits();
      var totalRevenue = profits.reduce(function (s, p) { return s + p.revenue; }, 0);
      var totalNet = profits.reduce(function (s, p) { return s + p.net; }, 0);
      var totalReceivable = profits.reduce(function (s, p) { return s + p.receivable; }, 0);
      var cash = (cache.cashboxes || []).reduce(function (s, c) {
        return s + calcCashboxBalance(c.id);
      }, 0);
      var stockVal = listStockBalances().reduce(function (s, r) { return s + r.value; }, 0);
      var lowStock = listStockBalances().filter(function (r) { return r.low; }).length;
      var engineersActive = (cache.engineers || []).filter(function (e) { return e.status === "active"; }).length;

      var byStatus = {};
      (cache.settings.project_statuses || []).forEach(function (st) { byStatus[st] = 0; });
      projects.forEach(function (p) {
        var label = {
          new: "جديد",
          in_progress: "جاري التنفيذ",
          paused: "متوقف",
          completed: "مكتمل",
          delivered: "تم التسليم",
          closed: "مغلق"
        }[p.status] || p.status;
        byStatus[label] = (byStatus[label] || 0) + 1;
      });

      return {
        active_projects: activeProjects,
        total_revenue: round2(totalRevenue),
        net_profit: round2(totalNet),
        receivable: round2(totalReceivable),
        cash: round2(cash),
        stock_value: round2(stockVal),
        active_engineers: engineersActive,
        low_stock_alerts: lowStock,
        by_status: byStatus
      };
    },

    // مساعدات
    uid: uid,
    today: today,
    exportAll: function () {
      return deepClone(cache);
    },
    restoreAll: function (data) {
      if (!demoMode) return Promise.reject(new Error("الاستعادة الكاملة متاحة في الوضع التجريبي فقط"));
      cache = data;
      saveDemo();
      return Promise.resolve();
    },
    resetDemo: function () {
      if (!demoMode) return Promise.reject(new Error("إعادة الضبط متاحة في الوضع التجريبي فقط"));
      cache = deepClone(SEED);
      saveDemo();
      return Promise.resolve();
    }
  };

  window.DB = DB;
})();
