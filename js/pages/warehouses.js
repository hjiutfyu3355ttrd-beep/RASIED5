Crud.mount({
  table: "warehouses", prefix: "WH", title: "المخازن", single: "مخزن", newLabel: "مخزن جديد",
  columns: [
    { key: "code", label: "الكود" }, { key: "name", label: "اسم المخزن" }, { key: "location", label: "الموقع" },
    { key: "value", label: "قيمة المخزون", type: "money", get: function (r) { return DB.listStockBalances().filter(function (b) { return b.warehouse_id === r.id; }).reduce(function (a, b) { return a + b.value; }, 0); } },
    { key: "notes", label: "ملاحظات" }
  ],
  fields: [
    { key: "code", label: "كود المخزن", type: "text" }, { key: "name", label: "اسم المخزن", type: "text", required: true },
    { key: "location", label: "الموقع", type: "text" }, { key: "notes", label: "ملاحظات", type: "textarea", full: true }
  ],
  canDelete: function (r) { return DB.list("stock_movements").some(function (m) { return m.warehouse_id === r.id; }) ? "المخزن عليه حركات ولا يمكن حذفه" : ""; }
});
