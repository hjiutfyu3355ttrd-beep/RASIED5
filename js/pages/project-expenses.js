Crud.mount({
  table: "project_expenses", prefix: "EXP", title: "مصروفات المشاريع", single: "مصروف", newLabel: "مصروف جديد", date: "date", autoEngineer: true,
  columns: [
    { key: "code", label: "المسلسل" }, { key: "date", label: "التاريخ", type: "date" }, { key: "project_id", label: "المشروع", type: "ref", ref: "projects" },
    { key: "expense_type_id", label: "النوع", type: "ref", ref: "expense_types" }, { key: "description", label: "البيان" },
    { key: "amount", label: "المبلغ", type: "money", sum: true }, { key: "paid", label: "المدفوع", type: "money", sum: true },
    { key: "cashbox_id", label: "الخزينة", type: "ref", ref: "cashboxes" }
  ],
  fields: [
    { key: "code", label: "المسلسل", type: "text" }, { key: "date", label: "تاريخ المصروف", type: "date", required: true },
    { key: "project_id", label: "المشروع", type: "select", ref: "projects", required: true },
    { key: "expense_type_id", label: "نوع المصروف", type: "select", ref: "expense_types" },
    { key: "description", label: "البيان", type: "text", span2: true },
    { key: "amount", label: "المبلغ", type: "number", required: true }, { key: "paid", label: "المبلغ المدفوع", type: "number" },
    { key: "method", label: "طريقة الدفع", type: "select", options: function () { return App.setting("payment_methods", ["نقدي"]); } },
    { key: "cashbox_id", label: "الخزينة (عند الدفع)", type: "select", ref: "cashboxes" },
    { key: "notes", label: "ملاحظات", type: "textarea", full: true }
  ],
  defaults: function () { return { date: DB.today(), paid: 0, method: "نقدي" }; },
  validate: function (v) {
    if (!(v.amount > 0)) return "المبلغ يجب أن يكون أكبر من صفر";
    if (v.paid > v.amount) return "المدفوع أكبر من قيمة المصروف";
    if (v.paid > 0 && !v.cashbox_id) return "اختر الخزينة المدفوع منها";
  },
  filters: [{ key: "project_id", label: "المشروع", ref: "projects" }, { key: "expense_type_id", label: "النوع", ref: "expense_types" }],
  stats: function (l) { return [{ label: "إجمالي المصروفات", value: UI.moneyC(l.reduce(function (a, r) { return a + Number(r.amount || 0); }, 0)), cls: "amber" }]; }
});
