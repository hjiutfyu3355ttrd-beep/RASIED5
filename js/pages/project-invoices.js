Crud.mount({
  table: "project_invoices", prefix: "INV", title: "فواتير المشاريع", single: "فاتورة مشروع", newLabel: "فاتورة جديدة", date: "date", autoEngineer: true,
  columns: [
    { key: "code", label: "الفاتورة" }, { key: "date", label: "التاريخ", type: "date" }, { key: "project_id", label: "المشروع", type: "ref", ref: "projects" },
    { key: "engineer_id", label: "المهندس", type: "ref", ref: "engineers" }, { key: "amount", label: "صافي القيمة", type: "money", sum: true }, { key: "notes", label: "ملاحظات" }
  ],
  fields: [
    { key: "code", label: "كود الفاتورة", type: "text" }, { key: "date", label: "تاريخ الفاتورة", type: "date", required: true },
    { key: "project_id", label: "المشروع", type: "select", ref: "projects", required: true },
    { key: "amount", label: "صافي القيمة", type: "number", required: true }, { key: "notes", label: "ملاحظات", type: "textarea", full: true }
  ],
  defaults: function () { return { date: DB.today() }; },
  validate: function (v) { if (!(v.amount > 0)) return "القيمة يجب أن تكون أكبر من صفر"; },
  filters: [{ key: "project_id", label: "المشروع", ref: "projects" }, { key: "engineer_id", label: "المهندس", ref: "engineers" }],
  stats: function (l) { return [{ label: "إجمالي الفواتير", value: UI.moneyC(l.reduce(function (a, r) { return a + Number(r.amount || 0); }, 0)), cls: "green" }]; }
});
