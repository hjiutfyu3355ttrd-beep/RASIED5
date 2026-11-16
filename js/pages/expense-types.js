Crud.mount({
  table: "expense_types", prefix: "EXT", title: "أنواع المصروفات", single: "نوع مصروف", newLabel: "نوع جديد",
  columns: [{ key: "code", label: "الكود" }, { key: "name", label: "نوع المصروف" }, { key: "category", label: "التصنيف" }],
  fields: [{ key: "code", label: "الكود", type: "text" }, { key: "name", label: "نوع المصروف", type: "text", required: true }, { key: "category", label: "التصنيف", type: "text" }],
  sort: function (a, b) { return String(a.id).localeCompare(String(b.id)); },
  canDelete: function (r) { return DB.list("project_expenses").some(function (x) { return x.expense_type_id === r.id; }) ? "النوع مستخدم في مصروفات" : ""; }
});
