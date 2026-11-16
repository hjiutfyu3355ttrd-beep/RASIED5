Crud.mount({
  table: "cash_movements", prefix: "CM", title: "حركات الخزينة اليدوية", single: "حركة خزينة", newLabel: "حركة جديدة", date: "date",
  columns: [
    { key: "id", label: "الكود" }, { key: "date", label: "التاريخ", type: "date" }, { key: "cashbox_id", label: "الخزينة", type: "ref", ref: "cashboxes" },
    { key: "direction", label: "النوع", type: "badge", get: function (r) { return r.direction === "in" ? "إيداع" : "سحب"; }, cls: function (r) { return r.direction === "in" ? "ok" : "warn"; } },
    { key: "amount", label: "المبلغ", type: "money", sum: true }, { key: "description", label: "البيان" }
  ],
  fields: [
    { key: "date", label: "التاريخ", type: "date", required: true }, { key: "cashbox_id", label: "الخزينة", type: "select", ref: "cashboxes", required: true },
    { key: "direction", label: "النوع", type: "select", options: [["in", "إيداع (داخل)"], ["out", "سحب (خارج)"]], required: true, noBlank: true },
    { key: "amount", label: "المبلغ", type: "number", required: true }, { key: "description", label: "البيان", type: "text", span2: true },
    { key: "notes", label: "ملاحظات", type: "textarea", full: true }
  ],
  defaults: function () { return { date: DB.today(), direction: "in" }; },
  validate: function (v) { if (!(v.amount > 0)) return "المبلغ يجب أن يكون أكبر من صفر"; },
  filters: [{ key: "cashbox_id", label: "الخزينة", ref: "cashboxes" }]
});
