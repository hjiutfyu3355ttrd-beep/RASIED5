Crud.mount({
  table: "storages", prefix: "STO", title: "التشوين", single: "عملية تشوين", newLabel: "تشوين جديد", date: "date", autoEngineer: true,
  columns: [
    { key: "code", label: "الكود" }, { key: "date", label: "التاريخ", type: "date" }, { key: "project_id", label: "المشروع", type: "ref", ref: "projects" },
    { key: "place", label: "المكان" }, { key: "duration", label: "المدة", type: "num" }, { key: "duration_unit", label: "الوحدة" },
    { key: "total", label: "الإجمالي", type: "money", sum: true }, { key: "paid", label: "المدفوع", type: "money", sum: true }
  ],
  fields: [
    { key: "code", label: "كود التشوين", type: "text" }, { key: "date", label: "تاريخ التشوين", type: "date", required: true },
    { key: "project_id", label: "المشروع", type: "select", ref: "projects", required: true }, { key: "place", label: "المكان", type: "text" },
    { key: "duration", label: "المدة", type: "number" }, { key: "duration_unit", label: "وحدة المدة", type: "select", options: ["يوم", "أسبوع", "شهر"] },
    { key: "unit_price", label: "سعر الوحدة", type: "number" },
    { key: "total", label: "إجمالي التكلفة", type: "calc", calc: function (v) { return v.duration * v.unit_price; } },
    { key: "paid", label: "المبلغ المدفوع", type: "number" }, { key: "cashbox_id", label: "الخزينة (عند الدفع)", type: "select", ref: "cashboxes" },
    { key: "notes", label: "ملاحظات", type: "textarea", full: true }
  ],
  defaults: function () { return { date: DB.today(), duration: 1, duration_unit: "يوم", unit_price: 0, paid: 0 }; },
  validate: function (v) { var t = v.duration * v.unit_price; if (!(t > 0)) return "أدخل المدة وسعر الوحدة"; if (v.paid > t + 0.001) return "المدفوع أكبر من الإجمالي"; if (v.paid > 0 && !v.cashbox_id) return "اختر الخزينة المدفوع منها"; },
  prepare: function (r) { r.total = App.round2(r.duration * r.unit_price); return r; },
  filters: [{ key: "project_id", label: "المشروع", ref: "projects" }],
  stats: function (l) { return [{ label: "إجمالي التشوين", value: UI.moneyC(l.reduce(function (a, r) { return a + Number(r.total || 0); }, 0)) }]; }
});
