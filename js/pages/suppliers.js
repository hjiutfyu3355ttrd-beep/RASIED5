Crud.mount({
  table: "suppliers", prefix: "SUP", title: "الموردون", single: "مورد", newLabel: "مورد جديد",
  columns: [
    { key: "code", label: "الكود" }, { key: "name", label: "اسم المورد" }, { key: "phone", label: "الهاتف" }, { key: "activity", label: "النشاط" },
    { key: "opening_balance", label: "رصيد افتتاحي", type: "money" },
    { key: "due", label: "المستحق للمورد", type: "money", get: function (r) { return DB.calcSupplierBalance(r.id).due; } },
    { key: "status", label: "الحالة", type: "badge", get: function (r) { return r.status === "active" ? "نشط" : "غير نشط"; }, cls: function (r) { return r.status === "active" ? "ok" : ""; } }
  ],
  fields: [
    { key: "code", label: "كود المورد", type: "text" }, { key: "name", label: "اسم المورد", type: "text", required: true },
    { key: "phone", label: "الهاتف", type: "text" }, { key: "address", label: "العنوان", type: "text" },
    { key: "activity", label: "نوع النشاط", type: "text" }, { key: "opening_balance", label: "الرصيد الافتتاحي (مستحق له)", type: "number" },
    { key: "status", label: "الحالة", type: "select", options: [["active", "نشط"], ["inactive", "غير نشط"]], required: true, noBlank: true },
    { key: "notes", label: "ملاحظات", type: "textarea", full: true }
  ],
  defaults: function () { return { status: "active", opening_balance: 0 }; },
  rowActions: [{ label: "كشف حساب", fn: function (r) { App.showSupplierStatement(r.id); } }],
  canDelete: function (r) {
    var used = DB.list("purchase_invoices").some(function (x) { return x.supplier_id === r.id; }) || DB.list("supplier_payments").some(function (x) { return x.supplier_id === r.id; });
    return used ? "المورد عليه حركات — اجعله غير نشط بدلاً من الحذف" : "";
  },
  stats: function (l) {
    var due = l.reduce(function (a, r) { return a + DB.calcSupplierBalance(r.id).due; }, 0);
    return [{ label: "عدد الموردين", value: l.length }, { label: "إجمالي المستحق للموردين", value: UI.moneyC(due), cls: due > 0 ? "amber" : "green" }];
  }
});
