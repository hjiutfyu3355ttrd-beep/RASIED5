Crud.mount({
  table: "cashboxes", prefix: "CB", title: "الخزائن", single: "خزينة", newLabel: "خزينة جديدة",
  columns: [
    { key: "code", label: "الكود" }, { key: "name", label: "اسم الخزينة" },
    { key: "opening_balance", label: "الرصيد الافتتاحي", type: "money" },
    { key: "bal", label: "الرصيد الحالي", type: "money", get: function (r) { return DB.calcCashboxBalance(r.id); }, html: function (r) { var b = DB.calcCashboxBalance(r.id); return '<b class="num ' + (b < 0 ? "neg-t" : "") + '">' + UI.money(b) + "</b>"; } },
    { key: "notes", label: "ملاحظات" }
  ],
  fields: [
    { key: "code", label: "كود الخزينة", type: "text" }, { key: "name", label: "اسم الخزينة", type: "text", required: true },
    { key: "opening_balance", label: "الرصيد الافتتاحي", type: "number" }, { key: "notes", label: "ملاحظات", type: "textarea", full: true }
  ],
  defaults: function () { return { opening_balance: 0 }; },
  stats: function (l) { var t = l.reduce(function (a, r) { return a + DB.calcCashboxBalance(r.id); }, 0); return [{ label: "إجمالي الأرصدة", value: UI.moneyC(t), cls: t < 0 ? "red" : "green" }]; },
  canDelete: function (r) { return DB.cashLedger({ cashbox_id: r.id }).rows.length ? "الخزينة عليها حركات ولا يمكن حذفها" : ""; }
});
