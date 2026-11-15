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
  var demoMode = !live;
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
        description: "مشروع افتراضي لأغراض العرض",
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
        notes: "بيانات افتراضية",
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
        notes: "بيانات افتراضية"
      }
    ],
    warehouses: [
      { id: "WH-0001", code: "WH-0001", name: "المخزن الرئيسي", location: "القاهرة", notes: "" }
    ],
    cashboxes: [
      { id: "CB-0001", code: "CB-0001", name: "الخزينة الرئيسية", opening_balance: 10000, notes: "رصيد افتتاحي افتراضي" }
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
        notes: "افتراضي؛ تاريخ الشراء = تاريخ استلام المخزون"
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
      { id: "PAY-0001", code: "PAY-0001", date: "2026-10-03", supplier_id: "SUP-0001", amount: 400, method: "نقدي", cashbox_id: "CB-0001", notes: "سداد افتراضي" },
      { id: "PAY-0002", code: "PAY-0002", date: "2026-10-03", supplier_id: "SUP-0001", amount: 330, method: "نقدي", cashbox_id: "CB-0001", notes: "سداد افتراضي" },
      { id: "PAY-0003", code: "PAY-0003", date: "2026-10-03", supplier_id: "SUP-0001", amount: 330, method: "نقدي", cashbox_id: "CB-0001", notes: "سداد افتراضي" }
    ],
    // فواتير مشاريع (إيراد)
    project_invoices: [
      { id: "INV-0001", code: "INV-0001", date: "2026-10-03", project_id: "PRJ-0001", engineer_id: "ENG-0001", amount: 20000, notes: "قيمة المشروع للاختبار" }
    ],
    // مقبوضات عملاء
    customer_receipts: [
      { id: "REC-0001", code: "REC-0001", date: "2026-10-03", project_id: "PRJ-0001", engineer_id: "ENG-0001", amount: 10000, method: "نقدي", cashbox_id: "CB-0001", notes: "تحصيل افتراضي" }
    ],
    // مصروفات مشاريع
    project_expenses: [
      { id: "EXP-0001", code: "EXP-0001", date: "2026-10-03", project_id: "PRJ-0001", engineer_id: "ENG-0001", expense_type_id: "EXT-001", description: "مصروفات أخرى اختبارية", amount: 500, paid: 500, method: "نقدي", cashbox_id: "CB-0001", notes: "مصروف افتراضي" }
    ],
    // عمالة
    labor: [
      {
        id: "LAB-0001",
        date: "2026-10-03",
        project_id: "PRJ-0001",
        engineer_id: "ENG-0001",
        worker_name: "عامل افتراضي",
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
        carrier: "ناقل افتراضي",
        type: "نقل مواد",
        amount: 1000,
        paid: 1000,
        cashbox_id: "CB-0001",
        notes: "بيانات افتراضية"
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
        notes: "بيانات افتراضية"
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

  // أعمدة مسموح إرسالها (للـ Live لاحقاً)
  var COLS = {};

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
      return new Promise(function (resolve) {
        if (demoMode) {
          cache = loadDemo();
          DB.ready = true;
          profile = { id: "u-admin", role: "admin", name: "المدير" };
          resolve(profile);
          return;
        }
        // Live لاحقاً
        resolve(null);
      });
    },

    role: function () { return profile ? profile.role : null; },
    isAdmin: function () { return profile && profile.role === "admin"; },
    canWrite: function () { return profile && (profile.role === "admin" || profile.role === "staff"); },

    // قوائم بسيطة
    list: function (table) {
      if (!cache) return [];
      if (table === "company") return cache.company ? [cache.company] : [];
      return (cache[table] || []).slice();
    },
    get: function (table, id) {
      if (table === "company") return cache.company;
      return (cache[table] || []).find(function (r) { return r.id === id; }) || null;
    },
    getCompany: function () { return cache ? cache.company : null; },

    // حفظ عام (Demo)
    save: function (table, row) {
      if (!cache) return Promise.reject(new Error("not ready"));
      if (table === "company") {
        cache.company = Object.assign({}, cache.company, row);
        saveDemo();
        return Promise.resolve(cache.company);
      }
      var arr = cache[table] || (cache[table] = []);
      var idx = arr.findIndex(function (r) { return r.id === row.id; });
      if (!row.id) row.id = uid();
      if (idx >= 0) arr[idx] = Object.assign({}, arr[idx], row);
      else arr.push(row);
      saveDemo();
      return Promise.resolve(row);
    },
    remove: function (table, id) {
      if (!cache) return Promise.reject(new Error("not ready"));
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
      cache = data;
      saveDemo();
      return Promise.resolve();
    },
    resetDemo: function () {
      cache = deepClone(SEED);
      saveDemo();
      return Promise.resolve();
    }
  };

  window.DB = DB;
})();
