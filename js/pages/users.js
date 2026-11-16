// صفحة المستخدمون (للمدير فقط): إضافة/تعديل/إيقاف/حذف + صلاحيات الصفحات + تتبّع الدخول
(function () {
  "use strict";
  var html = UI.html, esc = UI.esc;
  var page = document.getElementById("page");
  var users = [];

  if (DB.demoMode) {
    page.innerHTML = '<div class="card empty" style="padding:40px">غير متاح في الوضع التجريبي.</div>';
    return;
  }

  var GROUPS = [
    ["الأساسية", [["projects", "المشاريع"], ["engineers", "المهندسون"], ["suppliers", "الموردون"], ["items", "الأصناف"], ["warehouses", "المخازن"], ["cashboxes", "الخزائن"]]],
    ["المشتريات والمخزون", [["purchases", "فواتير المشتريات"], ["stock", "حركات المخزون"], ["supplier-payments", "مدفوعات الموردين"]]],
    ["المالية", [["project-invoices", "فواتير المشاريع"], ["receipts", "مقبوضات العملاء"], ["project-expenses", "مصروفات المشاريع"], ["labor", "العمالة"], ["transports", "النقل"], ["storages", "التشوين"]]],
    ["التقارير", [["profits", "ربحية المشاريع"], ["reports", "التقارير"], ["settings", "الإعدادات"]]]
  ];
  var ALL = [].concat.apply([], GROUPS.map(function (g) { return g[1].map(function (p) { return p[0]; }); }));
  var PRESETS = {
    "مهندس موقع": ["projects", "stock", "project-expenses", "labor", "transports", "storages"],
    "أمين مخزن": ["items", "warehouses", "stock", "purchases", "suppliers"],
    "محاسب": ["suppliers", "cashboxes", "purchases", "supplier-payments", "project-invoices", "receipts", "project-expenses", "labor", "transports", "storages", "profits", "reports"]
  };
  var DENY = [["deny:delete", "منع الحذف"], ["deny:edit", "منع التعديل"]];
  var ROLE_LABEL = { owner: "مالك", staff: "موظف", viewer: "قراءة فقط" };
  var ASSIGNABLE = ["staff", "viewer"];

  var fmt = function (d) { return d ? String(d).slice(0, 10) : "—"; };

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">المستخدمون</h2>
        </div>
        <button type="button" class="primary" id="b-add">+ مستخدم جديد</button>
      </div>
      <div class="card table-wrap" id="tbl"><div class="empty">جارٍ التحميل…</div></div>
    </div>`;

  function draw() {
    var me = DB.getProfile();
    document.getElementById("tbl").innerHTML = '<table><thead><tr><th>المستخدم</th><th>الهاتف</th><th>الدور</th><th>الحالة</th><th>الصفحات</th><th>أيام الاستخدام</th><th>مرات الدخول</th><th>آخر دخول</th><th></th></tr></thead><tbody>' +
      (users.map(function (m) {
        var perms = m.permissions || [];
        var pages = m.role === "owner" ? "الكل" : perms.filter(function (x) { return x.indexOf("deny:") !== 0; }).length;
        var restricted = m.role === "staff" && perms.some(function (x) { return x.indexOf("deny:") === 0; });
        return '<tr><td><b>' + esc(m.name || "—") + '</b>' + (m.id === me.id ? ' <span class="badge">أنت</span>' : "") + '</td>' +
          '<td dir="ltr">' + esc(m.phone || m.email || "—") + '</td>' +
          '<td>' + ROLE_LABEL[m.role] + '</td>' +
          '<td><span class="badge ' + (m.active ? "ok" : "err") + '">' + (m.active ? "نشط" : "موقوف") + '</span></td>' +
          '<td>' + pages + (restricted ? ' <span class="badge warn">مقيَّد</span>' : "") + '</td>' +
          '<td>' + (m.days_used || 0) + '</td><td>' + (m.login_count || 0) + '</td>' +
          '<td dir="ltr" class="muted">' + fmt(m.last_login_at) + '</td>' +
          '<td>' + (m.role === "owner" ? "" : '<button class="small" data-id="' + esc(m.id) + '">إدارة</button>') + '</td></tr>';
      }).join("") || '<tr><td colspan="9" class="empty">لا يوجد مستخدمون</td></tr>') + '</tbody></table>';
  }

  function permBoxes(sel) {
    return '<div class="field full"><label>الصفحات المسموحة</label>' +
      '<div class="row gap" style="flex-wrap:wrap;margin-bottom:8px">' +
      Object.keys(PRESETS).map(function (k) { return '<button type="button" class="small ghost" data-preset="' + esc(k) + '">' + esc(k) + '</button>'; }).join("") +
      '<button type="button" class="small ghost" data-preset="__all">الكل</button><button type="button" class="small ghost" data-preset="__none">لا شيء</button></div>' +
      GROUPS.map(function (g) {
        return '<div class="perm-group"><div class="muted">' + g[0] + '</div><div class="perm-row">' +
          g[1].map(function (p) { return '<label><input type="checkbox" data-p="' + p[0] + '"' + (sel.indexOf(p[0]) !== -1 ? " checked" : "") + '>' + p[1] + '</label>'; }).join("") + '</div></div>';
      }).join("") + '</div>' +
      '<div class="field full"><label>قيود</label><div class="perm-row" style="flex-direction:column;gap:6px">' +
      DENY.map(function (d) { return '<label><input type="checkbox" data-d="' + d[0] + '"' + (sel.indexOf(d[0]) !== -1 ? " checked" : "") + '>' + d[1] + '</label>'; }).join("") + '</div></div>';
  }
  function bindPresets(el) {
    el.querySelectorAll("[data-preset]").forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute("data-preset");
        var list = k === "__all" ? ALL : k === "__none" ? [] : PRESETS[k];
        el.querySelectorAll("[data-p]").forEach(function (c) { c.checked = list.indexOf(c.getAttribute("data-p")) !== -1; });
      };
    });
  }
  function picked(el) {
    return [].map.call(el.querySelectorAll("[data-p]:checked,[data-d]:checked"), function (c) { return c.getAttribute("data-p") || c.getAttribute("data-d"); });
  }
  function val(el, id) { return el.querySelector("#" + id).value; }
  function roleOptions(cur) {
    return ASSIGNABLE.map(function (r) { return '<option value="' + r + '"' + (r === cur ? " selected" : "") + '>' + ROLE_LABEL[r] + '</option>'; }).join("");
  }
  function guard(btn, fn) {
    btn.disabled = true;
    return Promise.resolve().then(fn).catch(function (e) { UI.toast(e.message, true); }).then(function () { btn.disabled = false; });
  }

  function openAdd() {
    var m = UI.modal({
      title: "مستخدم جديد",
      body: '<div class="form-grid">' +
        '<div class="field"><label>الاسم</label><input id="n"></div>' +
        '<div class="field"><label>رقم الهاتف</label><input id="ph" dir="ltr" inputmode="tel"></div>' +
        '<div class="field"><label>كلمة المرور</label><input id="pw" dir="ltr" autocomplete="new-password"></div>' +
        '<div class="field"><label>الدور</label><select id="role">' + roleOptions("staff") + '</select></div>' +
        permBoxes(["projects"]) + '</div>',
      actions: [{ label: "إلغاء", cls: "ghost" }, { label: "إضافة", cls: "primary", onClick: function (close) {
        var el = m.el, b = el.querySelector(".modal-foot .primary");
        guard(b, function () {
          return DB.fn("staff", { action: "create", full_name: val(el, "n").trim(), phone: val(el, "ph"), password: val(el, "pw"), role: val(el, "role"), permissions: picked(el) })
            .then(function () { UI.toast("تمت إضافة المستخدم"); close(); return load(); });
        });
      } }]
    });
    bindPresets(m.el);
  }

  function openEdit(u) {
    var m = UI.modal({
      title: "إدارة: " + esc(u.name || ""),
      body: '<div class="form-grid">' +
        '<div class="field"><label>الاسم</label><input id="n" value="' + esc(u.name || "") + '"></div>' +
        '<div class="field"><label>الدور</label><select id="role">' + roleOptions(u.role) + '</select></div>' +
        '<div class="field"><label>الحالة</label><select id="st"><option value="1"' + (u.active ? " selected" : "") + '>نشط</option><option value="0"' + (!u.active ? " selected" : "") + '>موقوف</option></select></div>' +
        '<div class="field"><label>ملاحظة الإيقاف</label><input id="note" value="' + esc(u.status_note || "") + '"></div>' +
        permBoxes(u.permissions || []) +
        '<div class="field full"><div class="row gap"><button type="button" class="small" id="rp">تغيير كلمة المرور</button>' +
        '<button type="button" class="small danger" id="dl">حذف المستخدم</button>' + '</div></div></div>',
      actions: [{ label: "إلغاء", cls: "ghost" }, { label: "حفظ", cls: "primary", onClick: function (close) {
        var el = m.el, b = el.querySelector(".modal-foot .primary");
        guard(b, function () {
          return DB.fn("staff", { action: "update", user_id: u.id, full_name: val(el, "n").trim(), role: val(el, "role"), active: val(el, "st") === "1", status_note: val(el, "note"), permissions: picked(el) })
            .then(function () { UI.toast("تم الحفظ"); close(); return load(); });
        });
      } }]
    });
    bindPresets(m.el);
    m.el.querySelector("#rp").onclick = function () {
      var pw = prompt("كلمة المرور الجديدة:");
      if (!pw) return;
      DB.fn("staff", { action: "reset_password", user_id: u.id, password: pw }).then(function () { UI.toast("تم تغيير كلمة المرور"); }, function (e) { UI.toast(e.message, true); });
    };
    var dl = m.el.querySelector("#dl");
    if (dl) dl.onclick = function () {
      if (!confirm("حذف المستخدم نهائياً؟")) return;
      DB.fn("staff", { action: "delete", user_id: u.id }).then(function () { UI.toast("تم الحذف"); m.close(); return load(); }, function (e) { UI.toast(e.message, true); });
    };
  }

  function load() {
    return DB.fn("staff", { action: "list" }).then(function (r) { users = r.users || []; draw(); })
      .catch(function (e) { document.getElementById("tbl").innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
  }

  document.getElementById("b-add").onclick = openAdd;
  document.getElementById("tbl").onclick = function (e) {
    var b = e.target.closest("[data-id]"); if (!b) return;
    var u = users.filter(function (x) { return x.id === b.getAttribute("data-id"); })[0];
    if (u) openEdit(u);
  };
  load();
})();
