Crud.mount({
  table: "items", prefix: "ITM", title: "الأصناف", single: "صنف", newLabel: "صنف جديد",
  columns: [
    { key: "code", label: "الكود" }, { key: "name", label: "اسم الصنف" }, { key: "category", label: "التصنيف" }, { key: "unit", label: "الوحدة" },
    { key: "default_purchase_price", label: "سعر الشراء", type: "money" }, { key: "reorder_level", label: "حد الطلب", type: "num" },
    { key: "qty", label: "الرصيد الحالي", type: "num", get: function (r) { return DB.listStockBalances().filter(function (b) { return b.item_id === r.id; }).reduce(function (a, b) { return a + b.qty; }, 0); } },
    { key: "preferred_supplier_id", label: "المورد", type: "ref", ref: "suppliers" }
  ],
  fields: [
    { key: "code", label: "كود الصنف", type: "text" }, { key: "name", label: "اسم الصنف", type: "text", required: true },
    { key: "category", label: "التصنيف", type: "select", options: function () { return App.setting("item_categories", ["أخرى"]); } },
    { key: "unit", label: "الوحدة", type: "select", options: function () { return App.setting("units", ["قطعة"]); } },
    { key: "default_purchase_price", label: "سعر الشراء الافتراضي", type: "number" }, { key: "reorder_level", label: "حد إعادة الطلب", type: "number" },
    { key: "preferred_supplier_id", label: "المورد المفضل", type: "select", ref: "suppliers" },
    { key: "notes", label: "ملاحظات", type: "textarea", full: true }
  ],
  defaults: function () { return { default_purchase_price: 0, reorder_level: 0, unit: "قطعة" }; },
  filters: [{ key: "category", label: "التصنيف", options: App.setting("item_categories", ["أخرى"]) }],
  canDelete: function (r) { return DB.list("stock_movements").some(function (m) { return m.item_id === r.id; }) || DB.list("purchase_details").some(function (m) { return m.item_id === r.id; }) ? "الصنف عليه حركات ولا يمكن حذفه" : ""; }
});
