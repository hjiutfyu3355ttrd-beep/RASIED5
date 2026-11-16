Crud.mount({
  table: "engineers", prefix: "ENG", title: "المهندسون", single: "مهندس", newLabel: "مهندس جديد",
  columns: [
    { key: "code", label: "الكود" }, { key: "name", label: "اسم المهندس" }, { key: "phone", label: "الهاتف" }, { key: "address", label: "العنوان" },
    { key: "p", label: "المشاريع", type: "num", get: function (r) { return DB.list("projects").filter(function (p) { return p.engineer_id === r.id; }).length; } },
    { key: "status", label: "الحالة", type: "badge", get: function (r) { return r.status === "active" ? "نشط" : "غير نشط"; }, cls: function (r) { return r.status === "active" ? "ok" : ""; } }
  ],
  fields: [
    { key: "code", label: "كود المهندس", type: "text" }, { key: "name", label: "اسم المهندس", type: "text", required: true },
    { key: "phone", label: "الهاتف", type: "text" }, { key: "address", label: "العنوان", type: "text" },
    { key: "status", label: "حالة الحساب", type: "select", options: [["active", "نشط"], ["inactive", "غير نشط"]], required: true, noBlank: true },
    { key: "notes", label: "ملاحظات", type: "textarea", full: true }
  ],
  defaults: function () { return { status: "active" }; },
  canDelete: function (r) { return DB.list("projects").some(function (p) { return p.engineer_id === r.id; }) ? "لا يمكن حذف مهندس لديه مشاريع — اجعله غير نشط بدلاً من ذلك" : ""; },
  stats: function (l) { return [{ label: "إجمالي المهندسين", value: l.length }, { label: "النشطون", value: l.filter(function (r) { return r.status === "active"; }).length, cls: "green" }]; }
});
