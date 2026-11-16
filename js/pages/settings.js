// الإعدادات: بيانات الشركة + القوائم + النسخ الاحتياطي
(function () {
  "use strict";
  var page = document.getElementById("page"), esc = UI.esc;
  var LISTS = [["project_statuses", "حالات المشروع (للعرض)"], ["payment_methods", "طرق الدفع"], ["payment_terms", "شروط الدفع"], ["item_categories", "تصنيفات الأصناف"], ["units", "الوحدات"]];
  var co = DB.getCompany() || {}, set = DB.get("settings") || {};
  var canE = DB.canEdit();
  var dis = canE ? "" : " disabled";

  page.innerHTML = '<div class="card chart-card"><h3>بيانات الشركة</h3><div class="form-grid">' +
    '<div class="field"><label>اسم الشركة</label><input id="c_name" value="' + esc(co.name || "") + '"' + dis + '/></div><div class="field"><label>الهاتف</label><input id="c_phone" value="' + esc(co.phone || "") + '"' + dis + '/></div>' +
    '<div class="field"><label>رمز العملة</label><input id="c_cur" value="' + esc(co.currency || "ج.م") + '"' + dis + '/></div><div class="field"><label>العنوان</label><input id="c_addr" value="' + esc(co.address || "") + '"' + dis + '/></div>' +
    '<div class="field"><label>طريقة تقييم المخزون</label><input value="متوسط مرجح متحرك" disabled/></div></div>' +
    (canE ? '<div style="margin-top:14px"><button class="primary" id="save-co">حفظ بيانات الشركة</button></div>' : "") + "</div>" +
    '<div class="card chart-card" style="margin-top:16px"><h3>القوائم</h3><p class="help-note">اكتب كل عنصر في سطر.</p><div class="form-grid">' +
    LISTS.map(function (l) { return '<div class="field"><label>' + l[1] + '</label><textarea id="l_' + l[0] + '" rows="6"' + dis + ">" + esc((set[l[0]] || []).join("\n")) + "</textarea></div>"; }).join("") + "</div>" +
    (canE ? '<div style="margin-top:14px"><button class="primary" id="save-ls">حفظ القوائم</button></div>' : "") + "</div>" +
    '<div class="card chart-card" style="margin-top:16px"><h3>النسخ الاحتياطي والتصدير</h3><p class="help-note">تصدير كل بيانات الشركة في ملف Excel واحد (ورقة لكل جدول) أو نسخة JSON.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button id="exp-x">' + UI.icon.download + '<span>تصدير Excel شامل</span></button><button id="exp-j">' + UI.icon.download + "<span>نسخة JSON</span></button></div></div>";

  var $ = function (s) { return page.querySelector(s); };
  if ($("#save-co")) $("#save-co").addEventListener("click", function () {
    DB.save("company", { name: $("#c_name").value.trim() || co.name, phone: $("#c_phone").value.trim(), currency: $("#c_cur").value.trim() || "ج.م", address: $("#c_addr").value.trim() })
      .then(function () { UI.toast("تم حفظ بيانات الشركة"); }).catch(function (e) { UI.toast(e.message, true); });
  });
  if ($("#save-ls")) $("#save-ls").addEventListener("click", function () {
    var out = {};
    LISTS.forEach(function (l) { out[l[0]] = $("#l_" + l[0]).value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean); });
    DB.save("settings", out).then(function () { UI.toast("تم حفظ القوائم"); }).catch(function (e) { UI.toast(e.message, true); });
  });
  var TABLES = [["engineers", "المهندسون"], ["projects", "المشاريع"], ["suppliers", "الموردون"], ["items", "الأصناف"], ["warehouses", "المخازن"], ["cashboxes", "الخزائن"], ["expense_types", "أنواع المصروفات"], ["purchase_invoices", "فواتير المشتريات"], ["purchase_details", "تفاصيل المشتريات"], ["stock_movements", "حركات المخزون"], ["supplier_payments", "مدفوعات الموردين"], ["project_invoices", "فواتير المشاريع"], ["customer_receipts", "مقبوضات العملاء"], ["project_expenses", "مصروفات المشاريع"], ["labor", "العمالة"], ["transports", "النقل"], ["storages", "التشوين"], ["cash_movements", "حركات الخزينة"]];
  $("#exp-x").addEventListener("click", function () {
    var sheets = TABLES.map(function (t) {
      var rows = DB.list(t[0]); var keys = rows.length ? Object.keys(rows[0]).filter(function (k) { return ["company_id", "created_at", "updated_at"].indexOf(k) < 0; }) : [];
      return { name: t[1], rows: [keys].concat(rows.map(function (r) { return keys.map(function (k) { return r[k] == null ? "" : r[k]; }); })), widths: keys.map(function () { return 16; }), styles: { 0: "header" } };
    });
    XlsxLite.download("نسخة-بيانات-" + DB.today() + ".xlsx", sheets);
  });
  $("#exp-j").addEventListener("click", function () {
    var data = {}; TABLES.forEach(function (t) { data[t[0]] = DB.list(t[0]); });
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" })); a.download = "backup-" + DB.today() + ".json"; a.click();
  });
})();
