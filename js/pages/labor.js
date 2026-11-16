Crud.mount({
  table: "labor", prefix: "LAB", title: "العمالة", single: "يومية عمالة", newLabel: "عمالة جديدة", date: "date", autoEngineer: true,
  columns: [
    { key: "id", label: "م" }, { key: "date", label: "التاريخ", type: "date" }, { key: "project_id", label: "المشروع", type: "ref", ref: "projects" },
    { key: "worker_name", label: "العامل" }, { key: "work_type", label: "نوع العمل" },
    { key: "days", label: "أيام", type: "num" }, { key: "hours", label: "ساعات", type: "num" },
    { key: "total", label: "الإجمالي", type: "money", sum: true }, { key: "paid", label: "المدفوع", type: "money", sum: true },
    { key: "payment_status", label: "الدفع", type: "badge", get: function (r) { return { paid: "مدفوع", partial: "جزئي", unpaid: "غير مدفوع" }[r.payment_status] || "—"; }, cls: function (r) { return r.payment_status === "paid" ? "ok" : r.payment_status === "partial" ? "warn" : "err"; } }
  ],
  fields: [
    { key: "date", label: "تاريخ العمل", type: "date", required: true }, { key: "project_id", label: "المشروع", type: "select", ref: "projects", required: true },
    { key: "worker_name", label: "اسم العامل", type: "text", required: true }, { key: "work_type", label: "نوع العمل", type: "text" },
    { key: "days", label: "عدد الأيام", type: "number" }, { key: "day_rate", label: "أجر اليوم", type: "number" },
    { key: "hours", label: "عدد الساعات", type: "number" }, { key: "hour_rate", label: "أجر الساعة", type: "number" },
    { key: "total", label: "إجمالي التكلفة", type: "calc", calc: function (v) { return v.days * v.day_rate + v.hours * v.hour_rate; } },
    { key: "paid", label: "المبلغ المدفوع", type: "number" }, { key: "cashbox_id", label: "الخزينة (عند الدفع)", type: "select", ref: "cashboxes" },
    { key: "notes", label: "ملاحظات", type: "textarea", full: true }
  ],
  defaults: function () { return { date: DB.today(), days: 1, hours: 0, day_rate: 0, hour_rate: 0, paid: 0 }; },
  validate: function (v) {
    var t = v.days * v.day_rate + v.hours * v.hour_rate;
    if (!(t > 0)) return "أدخل الأيام × الأجر أو الساعات × الأجر";
    if (v.paid > t + 0.001) return "المدفوع أكبر من إجمالي التكلفة";
    if (v.paid > 0 && !v.cashbox_id) return "اختر الخزينة المدفوع منها";
  },
  prepare: function (r) { r.total = App.round2(r.days * r.day_rate + r.hours * r.hour_rate); r.payment_status = r.paid >= r.total ? "paid" : r.paid > 0 ? "partial" : "unpaid"; return r; },
  filters: [{ key: "project_id", label: "المشروع", ref: "projects" }],
  stats: function (l) {
    var t = l.reduce(function (a, r) { return a + Number(r.total || 0); }, 0), p = l.reduce(function (a, r) { return a + Number(r.paid || 0); }, 0);
    return [{ label: "إجمالي العمالة", value: UI.moneyC(t) }, { label: "المتبقي للعمال", value: UI.moneyC(t - p), cls: t - p > 0 ? "amber" : "green" }];
  }
});
