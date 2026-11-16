Crud.mount({
  table: "supplier_payments", prefix: "PAY", title: "مدفوعات الموردين", single: "سند دفع", newLabel: "سند دفع جديد", date: "date",
  columns: [
    { key: "code", label: "السند" }, { key: "date", label: "التاريخ", type: "date" }, { key: "supplier_id", label: "المورد", type: "ref", ref: "suppliers" },
    { key: "amount", label: "المبلغ", type: "money", sum: true }, { key: "method", label: "الطريقة" }, { key: "cashbox_id", label: "الخزينة", type: "ref", ref: "cashboxes" }, { key: "notes", label: "ملاحظات" }
  ],
  fields: [
    { key: "code", label: "كود السند", type: "text" }, { key: "date", label: "تاريخ الدفع", type: "date", required: true },
    { key: "supplier_id", label: "المورد", type: "select", ref: "suppliers", required: true},
    { key: "amount", label: "المبلغ", type: "number", required: true },
    { key: "method", label: "طريقة الدفع", type: "select", options: function () { return App.setting("payment_methods", ["نقدي"]); } },
    { key: "cashbox_id", label: "الخزينة", type: "select", ref: "cashboxes", required: true },
    { key: "notes", label: "ملاحظات", type: "textarea", full: true }
  ],
  defaults: function () { return { date: DB.today(), method: "نقدي" }; },
  validate: function (v) { if (!(v.amount > 0)) return "المبلغ يجب أن يكون أكبر من صفر"; },
  stats: function (l) { return [{ label: "إجمالي المدفوعات", value: UI.moneyC(l.reduce(function (a, r) { return a + Number(r.amount || 0); }, 0)) }]; },
  filters: [{ key: "supplier_id", label: "المورد", ref: "suppliers" }, { key: "cashbox_id", label: "الخزينة", ref: "cashboxes" }]
});
