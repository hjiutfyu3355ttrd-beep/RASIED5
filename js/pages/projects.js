Crud.mount({
  table: "projects", prefix: "PRJ", title: "المشاريع", single: "مشروع", newLabel: "مشروع جديد", date: "start_date", wide: true,
  columns: [
    { key: "code", label: "الكود" }, { key: "name", label: "اسم المشروع" }, { key: "engineer_id", label: "المهندس", type: "ref", ref: "engineers" },
    { key: "area", label: "المنطقة" }, { key: "start_date", label: "البداية", type: "date" }, { key: "expected_end", label: "التسليم المتوقع", type: "date" },
    { key: "rev", label: "الفواتير", type: "money", get: function (r) { return DB.calcProjectProfit(r.id).revenue; } },
    { key: "net", label: "صافي الربح", type: "money", get: function (r) { return DB.calcProjectProfit(r.id).net; },
      html: function (r) { var n = DB.calcProjectProfit(r.id).net; return '<b class="num ' + (n < 0 ? "neg-t" : "pos-t") + '">' + UI.money(n) + "</b>"; } },
    { key: "status", label: "الحالة", type: "badge", get: function (r) { return App.STATUS_AR[r.status] || r.status; }, cls: function (r) { return App.STATUS_CLS[r.status]; } }
  ],
  fields: [
    { key: "code", label: "كود المشروع", type: "text" }, { key: "name", label: "اسم المشروع", type: "text", required: true, span2: true },
    { key: "engineer_id", label: "المهندس", type: "select", ref: "engineers", refFilter: function (e) { return e.status === "active"; } },
    { key: "address", label: "عنوان الشقة/الموقع", type: "text" }, { key: "area", label: "المنطقة", type: "text" },
    { key: "start_date", label: "تاريخ البداية", type: "date" }, { key: "expected_end", label: "التسليم المتوقع", type: "date" }, { key: "actual_end", label: "التسليم الفعلي", type: "date" },
    { key: "status", label: "حالة المشروع", type: "select", options: Object.keys(App.STATUS_AR).map(function (k) { return [k, App.STATUS_AR[k]]; }), required: true, noBlank: true },
    { key: "description", label: "وصف المشروع", type: "textarea", full: true }, { key: "notes", label: "ملاحظات", type: "textarea", full: true }
  ],
  defaults: function () { return { status: "new", start_date: DB.today() }; },
  validate: function (v) { if (v.start_date && v.expected_end && v.expected_end < v.start_date) return "تاريخ التسليم المتوقع قبل تاريخ البداية"; },
  prepare: function (r) { if (["delivered", "completed", "closed"].indexOf(r.status) >= 0 && !r.actual_end) r.actual_end = DB.today(); return r; },
  filters: [{ key: "status", label: "الحالة", options: Object.keys(App.STATUS_AR).map(function (k) { return [k, App.STATUS_AR[k]]; }) }, { key: "engineer_id", label: "المهندس", ref: "engineers" }],
  rowActions: [{ label: "تفاصيل", fn: function (r) { App.showProjectDetails(r.id); } }],
  canDelete: function (r) {
    var T = ["project_invoices", "customer_receipts", "project_expenses", "labor", "transports", "storages", "stock_movements", "purchase_details"];
    return T.some(function (t) { return DB.list(t).some(function (x) { return x.project_id === r.id; }); }) ? "المشروع عليه حركات — غيّر حالته إلى «مغلق» بدلاً من الحذف" : "";
  },
  stats: function (l) {
    return [{ label: "عدد المشاريع", value: l.length }, { label: "جاري التنفيذ", value: l.filter(function (r) { return r.status === "in_progress"; }).length, cls: "green" },
      { label: "متأخرة", value: l.filter(function (r) { return ["new", "in_progress", "paused"].indexOf(r.status) >= 0 && r.expected_end && r.expected_end < DB.today(); }).length, cls: "red" }];
  }
});
