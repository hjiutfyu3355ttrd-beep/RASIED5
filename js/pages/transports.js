Crud.mount({
  table: "transports", prefix: "TRN", title: "النقل", single: "عملية نقل", newLabel: "نقل جديد", date: "date", autoEngineer: true,
  columns: [
    { key: "code", label: "المسلسل" }, { key: "date", label: "التاريخ", type: "date" }, { key: "project_id", label: "المشروع", type: "ref", ref: "projects" },
    { key: "carrier", label: "الناقل" }, { key: "type", label: "نوع النقل" }, { key: "amount", label: "المبلغ", type: "money", sum: true },
    { key: "paid", label: "المدفوع", type: "money", sum: true }, { key: "cashbox_id", label: "الخزينة", type: "ref", ref: "cashboxes" }
  ],
  fields: [
    { key: "code", label: "المسلسل", type: "text" }, { key: "date", label: "تاريخ النقل", type: "date", required: true },
    { key: "project_id", label: "المشروع", type: "select", ref: "projects", required: true },
    { key: "carrier", label: "الناقل", type: "text" }, { key: "type", label: "نوع النقل", type: "text" },
    { key: "amount", label: "المبلغ", type: "number", required: true }, { key: "paid", label: "المبلغ المدفوع", type: "number" },
    { key: "cashbox_id", label: "الخزينة (عند الدفع)", type: "select", ref: "cashboxes" }, { key: "notes", label: "ملاحظات", type: "textarea", full: true }
  ],
  defaults: function () { return { date: DB.today(), paid: 0 }; },
  validate: function (v) { if (!(v.amount > 0)) return "المبلغ يجب أن يكون أكبر من صفر"; if (v.paid > v.amount) return "المدفوع أكبر من المبلغ"; if (v.paid > 0 && !v.cashbox_id) return "اختر الخزينة المدفوع منها"; },
  filters: [{ key: "project_id", label: "المشروع", ref: "projects" }],
  stats: function (l) { return [{ label: "إجمالي النقل", value: UI.moneyC(l.reduce(function (a, r) { return a + Number(r.amount || 0); }, 0)) }]; }
});
