// إدارة المنصة (مدير المنصة فقط): كل الحسابات والشركات، الإيقاف/التفعيل، وحجم بيانات كل شركة
(function () {
  "use strict";
  var html = UI.html, esc = UI.esc;
  var page = document.getElementById("page");
  var rows = [], q = "";

  if (DB.demoMode) { page.innerHTML = '<div class="card empty" style="padding:40px">غير متاح في الوضع التجريبي.</div>'; return; }

  var ROLE = { owner: "مالك", staff: "موظف", viewer: "قراءة فقط" };
  var TBL = { engineers: "المهندسون", projects: "المشاريع", suppliers: "الموردون", items: "الأصناف", warehouses: "المخازن", cashboxes: "الخزائن", expense_types: "أنواع المصروفات", purchase_invoices: "فواتير المشتريات", purchase_details: "بنود المشتريات", stock_movements: "حركات المخزون", supplier_payments: "مدفوعات الموردين", project_invoices: "فواتير المشاريع", customer_receipts: "مقبوضات العملاء", project_expenses: "مصروفات المشاريع", labor: "العمالة", transports: "النقل", storages: "التشوين", cash_movements: "حركات الخزينة" };
  var d = function (v) { return v ? String(v).slice(0, 10) : "—"; };

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <h2 style="margin:0">إدارة المنصة</h2>
        <input id="q" type="search" placeholder="بحث بالاسم أو الهاتف أو الشركة" style="max-width:320px" />
      </div>
      <div class="users-stat" id="stat"></div>
      <div class="card table-wrap" id="tbl"><div class="empty">جارٍ التحميل…</div></div>
    </div>`;

  function draw() {
    var me = DB.getProfile(), k = q.trim().toLowerCase();
    var list = rows.filter(function (r) { return !k || [r.full_name, r.phone, r.company_name].join(" ").toLowerCase().indexOf(k) !== -1; });
    document.getElementById("stat").innerHTML =
      '<span class="badge">الشركات: ' + rows.filter(function (r) { return r.role === "owner"; }).length + '</span>' +
      '<span class="badge">المستخدمون: ' + rows.length + '</span>' +
      '<span class="badge err">موقوف: ' + rows.filter(function (r) { return !r.active; }).length + '</span>';
    document.getElementById("tbl").innerHTML = '<table><thead><tr><th>المستخدم</th><th>الهاتف</th><th>الشركة</th><th>الدور</th><th>الحالة</th><th>التسجيل</th><th>الأيام</th><th>الدخول</th><th>آخر ظهور</th><th>السجلات</th><th></th></tr></thead><tbody>' +
      (list.map(function (r) {
        var self = r.id === me.id;
        return '<tr><td><b>' + esc(r.full_name) + '</b>' + (r.platform_role === "admin" ? ' <span class="badge ok">مدير المنصة</span>' : "") + '</td>' +
          '<td dir="ltr">' + esc(r.phone) + '</td><td>' + esc(r.company_name) + '</td><td>' + ROLE[r.role] + '</td>' +
          '<td><span class="badge ' + (r.active ? "ok" : "err") + '">' + (r.active ? "نشط" : "موقوف") + '</span></td>' +
          '<td dir="ltr" class="muted">' + d(r.created_at) + '</td><td>' + r.days_used + '</td><td>' + r.login_count + '</td>' +
          '<td dir="ltr" class="muted">' + d(r.last_seen_at) + '</td><td>' + r.records_count + '</td>' +
          '<td><div class="row gap"><button class="small ghost" data-co="' + esc(r.company_id) + '" data-name="' + esc(r.company_name) + '">البيانات</button>' +
          (self ? "" : '<button class="small ' + (r.active ? "danger" : "primary") + '" data-st="' + esc(r.id) + '" data-to="' + (r.active ? "suspended" : "active") + '">' + (r.active ? "إيقاف" : "تفعيل") + '</button>') +
          '</div></td></tr>';
      }).join("") || '<tr><td colspan="11" class="empty">لا نتائج</td></tr>') + '</tbody></table>';
  }

  function load() {
    return DB.client().rpc("admin_users").then(function (r) {
      if (r.error) throw r.error;
      rows = r.data || []; draw();
    }).catch(function (e) { document.getElementById("tbl").innerHTML = '<div class="empty">' + esc(e.message || "تعذّر التحميل") + '</div>'; });
  }

  document.getElementById("q").oninput = function (e) { q = e.target.value; draw(); };
  document.getElementById("tbl").onclick = function (e) {
    var st = e.target.closest("[data-st]"), co = e.target.closest("[data-co]");
    if (st) {
      var to = st.getAttribute("data-to"), note = "";
      if (to === "suspended") { note = prompt("سبب الإيقاف (يظهر للمستخدم):", "") || ""; }
      else if (!confirm("تفعيل الحساب؟")) return;
      DB.client().rpc("admin_set_status", { p_user: st.getAttribute("data-st"), p_status: to, p_note: note }).then(function (r) {
        if (r.error) return UI.toast(r.error.message, true);
        UI.toast(to === "active" ? "تم التفعيل" : "تم الإيقاف"); load();
      });
    } else if (co) {
      DB.client().rpc("admin_company_tables", { p_company: co.getAttribute("data-co") }).then(function (r) {
        if (r.error) return UI.toast(r.error.message, true);
        var t = r.data || [];
        UI.modal({ title: "بيانات: " + esc(co.getAttribute("data-name")),
          body: t.length ? '<table><thead><tr><th>الجدول</th><th>السجلات</th><th>آخر إضافة</th></tr></thead><tbody>' +
            t.map(function (x) { return '<tr><td>' + esc(TBL[x.tbl] || x.tbl) + '</td><td>' + x.n + '</td><td dir="ltr" class="muted">' + d(x.last_at) + '</td></tr>'; }).join("") + '</tbody></table>' : '<div class="empty">لا توجد بيانات</div>',
          actions: [{ label: "إغلاق", cls: "ghost" }] });
      });
    }
  };
  load();
})();
