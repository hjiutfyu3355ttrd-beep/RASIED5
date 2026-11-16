Crud.mount({
  table: "customer_receipts", prefix: "REC", title: "مقبوضات العملاء", single: "سند قبض", newLabel: "سند قبض جديد", date: "date", autoEngineer: true,
  columns: [
    { key: "code", label: "السند" }, { key: "date", label: "التاريخ", type: "date" }, { key: "project_id", label: "المشروع", type: "ref", ref: "projects" },
    { key: "engineer_id", label: "المهندس", type: "ref", ref: "engineers" }, { key: "amount", label: "المبلغ", type: "money", sum: true },
    { key: "method", label: "الطريقة" }, { key: "cashbox_id", label: "الخزينة", type: "ref", ref: "cashboxes" }, { key: "notes", label: "ملاحظات" }
  ],
  fields: [
    { key: "code", label: "كود السند", type: "text" }, { key: "date", label: "تاريخ القبض", type: "date", required: true },
    { key: "project_id", label: "المشروع", type: "select", ref: "projects", required: true },
    { key: "amount", label: "المبلغ", type: "number", required: true },
    { key: "method", label: "طريقة الدفع", type: "select", options: function () { return App.setting("payment_methods", ["نقدي"]); } },
    { key: "cashbox_id", label: "الخزينة", type: "select", ref: "cashboxes", required: true },
    { key: "notes", label: "ملاحظات", type: "textarea", full: true }
  ],
  defaults: function () { return { date: DB.today(), method: "نقدي" }; },
  validate: function (v) { if (!(v.amount > 0)) return "المبلغ يجب أن يكون أكبر من صفر"; },
  filters: [{ key: "project_id", label: "المشروع", ref: "projects" }, { key: "cashbox_id", label: "الخزينة", ref: "cashboxes" }],
  stats: function (l) { return [{ label: "إجمالي المقبوضات", value: UI.moneyC(l.reduce(function (a, r) { return a + Number(r.amount || 0); }, 0)), cls: "green" }]; }
});
