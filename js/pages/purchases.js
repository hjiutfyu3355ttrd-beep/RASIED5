// فواتير المشتريات (فاتورة + أصناف + حركات المخزون تلقائياً)
(function () {
  "use strict";
  var page = document.getElementById("page"), esc = UI.esc, O = App.optionsHtml;
  var st = { q: "", from: "", to: "", supplier: "" };

  function linesOf(id) { return DB.list("purchase_details").filter(function (d) { return d.invoice_id === id; }); }

  function render() {
    var canW = DB.canWrite(), canE = DB.canEdit(), canD = DB.canDelete();
    var q = st.q.toLowerCase();
    var list = DB.list("purchase_invoices").filter(function (i) {
      if (st.from && i.date < st.from) return false;
      if (st.to && i.date > st.to) return false;
      if (st.supplier && i.supplier_id !== st.supplier) return false;
      if (q && (i.code + " " + App.name("suppliers", i.supplier_id) + " " + (i.notes || "")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return a.date === b.date ? (a.id < b.id ? 1 : -1) : (a.date < b.date ? 1 : -1); });
    var total = list.reduce(function (a, i) { return a + Number(i.total || 0); }, 0), paid = list.reduce(function (a, i) { return a + Number(i.paid_at_purchase || 0); }, 0);
    page.innerHTML = '<div class="filter-bar"><div class="field" style="max-width:240px"><label>بحث</label><input id="q" type="search" value="' + esc(st.q) + '" placeholder="رقم الفاتورة أو المورد"/></div>' +
      '<div class="field"><label>من تاريخ</label><input type="date" id="from" value="' + st.from + '"/></div><div class="field"><label>إلى تاريخ</label><input type="date" id="to" value="' + st.to + '"/></div>' +
      '<div class="field"><label>المورد</label><select id="sup">' + O(App.opts("suppliers"), st.supplier).replace("— اختر —", "الكل") + "</select></div>" +
      '<div style="margin-inline-start:auto;display:flex;gap:8px"><button id="xl">' + UI.icon.download + "<span>تصدير</span></button>" + (canW ? '<button class="primary" id="add">+ فاتورة مشتريات</button>' : "") + "</div></div>" +
      '<div class="stats" style="margin-bottom:16px"><div class="card stat"><div class="label">عدد الفواتير</div><div class="value">' + list.length + '</div></div><div class="card stat amber"><div class="label">إجمالي المشتريات</div><div class="value">' + UI.moneyC(total) +
      '</div></div><div class="card stat green"><div class="label">المدفوع عند الشراء</div><div class="value">' + UI.moneyC(paid) + "</div></div></div>" +
      '<div class="card table-card"><div class="table-wrap"><table class="table"><thead><tr><th>الفاتورة</th><th>التاريخ</th><th>المورد</th><th>الشروط</th><th class="num">الأصناف</th><th class="num">الإجمالي</th><th class="num">المدفوع</th><th class="num">الرصيد</th><th></th></tr></thead><tbody>' +
      (list.map(function (i) {
        return "<tr><td>" + esc(i.code || i.id) + "</td><td>" + UI.fmtDate(i.date) + "</td><td>" + esc(App.name("suppliers", i.supplier_id)) + "</td><td>" + esc(i.payment_terms || "—") + '</td><td class="num">' + linesOf(i.id).length +
          '</td><td class="num">' + UI.money(i.total) + '</td><td class="num">' + UI.money(i.paid_at_purchase) + '</td><td class="num">' + UI.money(i.balance) + '</td><td class="actions-cell" style="white-space:nowrap">' +
          '<button class="ghost small" data-a="view" data-id="' + esc(i.id) + '">' + (canE ? "تعديل" : "عرض") + "</button>" + (canD ? '<button class="danger small" data-a="del" data-id="' + esc(i.id) + '">حذف</button>' : "") + "</td></tr>";
      }).join("") || '<tr><td colspan="9" class="muted" style="text-align:center;padding:28px">لا توجد فواتير مشتريات بعد</td></tr>') + "</tbody></table></div></div>";
    var $ = function (s) { return page.querySelector(s); };
    $("#q").addEventListener("input", function (e) { st.q = e.target.value; var p = e.target.selectionStart; render(); var n = $("#q"); n.focus(); try { n.setSelectionRange(p, p); } catch (x) {} });
    $("#from").addEventListener("change", function (e) { st.from = e.target.value; render(); });
    $("#to").addEventListener("change", function (e) { st.to = e.target.value; render(); });
    $("#sup").addEventListener("change", function (e) { st.supplier = e.target.value; render(); });
    if ($("#add")) $("#add").addEventListener("click", function () { editor(null); });
    $("#xl").addEventListener("click", function () {
      App.exportXlsx("فواتير المشتريات", "فواتير المشتريات", ["الفاتورة", "التاريخ", "المورد", "الشروط", "الإجمالي", "المدفوع", "الرصيد"],
        list.map(function (i) { return [i.code || i.id, i.date, App.name("suppliers", i.supplier_id), i.payment_terms || "", Number(i.total), Number(i.paid_at_purchase), Number(i.balance)]; }));
    });
    page.querySelectorAll("button[data-a]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-id"), inv = DB.get("purchase_invoices", id);
        if (b.getAttribute("data-a") === "view") editor(inv);
        else if (confirm("حذف الفاتورة بالكامل مع حركات المخزون المرتبطة بها؟")) DB.deletePurchaseInvoice(id).then(function () { UI.toast("تم الحذف"); render(); }).catch(function (e) { UI.toast(e.message, true); });
      });
    });
  }

  function editor(inv) {
    var isNew = !inv, readOnly = !DB.canWrite() || (!isNew && !(DB.canEdit() && DB.canDelete()));
    var head = Object.assign({ date: DB.today(), payment_terms: "آجل", paid_at_purchase: 0 }, inv || {});
    if (isNew) head.code = DB.nextCode("purchase_invoices", "PUR");
    var lines = isNew ? [] : linesOf(inv.id).map(function (d) { return Object.assign({}, d); });
    var blank = function () { return { item_id: "", destination: "warehouse", warehouse_id: (DB.list("warehouses")[0] || {}).id || "", project_id: "", qty: 1, unit_price: 0, discount: 0, tax: 0 }; };
    if (!lines.length) lines.push(blank());

    var body = '<div class="form-grid">' +
      '<div class="field"><label>كود الفاتورة</label><input id="h_code" value="' + esc(head.code || "") + '" readonly/></div>' +
      '<div class="field"><label>تاريخ الشراء <small>*</small></label><input id="h_date" type="date" value="' + esc(head.date) + '"/></div>' +
      '<div class="field"><label>المورد <small>*</small></label><select id="h_sup">' + O(App.opts("suppliers", function (s) { return s.status === "active" || s.id === head.supplier_id; }), head.supplier_id) + "</select></div>" +
      '<div class="field"><label>شروط الدفع</label><select id="h_terms">' + O(App.setting("payment_terms", ["نقدي", "آجل"]), head.payment_terms, false) + "</select></div>" +
      '<div class="field"><label>المدفوع عند الشراء</label><input id="h_paid" type="number" step="any" value="' + (head.paid_at_purchase || 0) + '"/></div>' +
      '<div class="field"><label>الخزينة</label><select id="h_cb">' + O(App.opts("cashboxes"), head.cashbox_id) + "</select></div>" +
      '<div class="field span-all"><label>ملاحظات</label><input id="h_notes" value="' + esc(head.notes || "") + '"/></div></div>' +
      '<h4 style="margin:16px 0 6px">أصناف الفاتورة</h4><div class="table-wrap"><table class="form-lines"><thead><tr><th>الصنف</th><th>الوجهة</th><th>المخزن / المشروع</th><th>الكمية</th><th>السعر</th><th>الخصم</th><th>الضريبة</th><th>الصافي</th><th></th></tr></thead><tbody id="ln"></tbody></table></div>' +
      '<button type="button" id="addln" style="margin-top:8px">+ إضافة صنف</button>' +
      '<div class="stats" style="margin-top:14px"><div class="card stat"><div class="label">إجمالي الفاتورة</div><div class="value" id="t_total">0</div></div><div class="card stat green"><div class="label">المدفوع</div><div class="value" id="t_paid">0</div></div><div class="card stat amber"><div class="label">رصيد الفاتورة (على المورد)</div><div class="value" id="t_bal">0</div></div></div>' +
      '<p class="auth-err" id="h_err" style="color:var(--error);margin:10px 0 0" hidden></p>' +
      '<p class="help-note">الصنف الموجّه «للمخزن» يدخل رصيد المخزن بالمتوسط المرجح، والموجّه «لمشروع» يُحمَّل مباشرة على تكلفة المشروع.</p>';
    var acts = [{ label: readOnly ? "إغلاق" : "إلغاء", cls: "ghost", onClick: function (c) { c(); } }];
    if (!readOnly) acts.push({ label: "حفظ الفاتورة", cls: "primary", onClick: function () { save(); } });
    var m = UI.modal({ title: isNew ? "فاتورة مشتريات جديدة" : "فاتورة مشتريات — " + esc(head.code || head.id), body: body, actions: acts });
    m.el.querySelector(".modal").classList.add("wide");
    var root = m.el, $ = function (s) { return root.querySelector(s); };
    if (readOnly) root.querySelectorAll("input,select,button#addln").forEach(function (e) { e.disabled = true; });

    function lineNet(l) { return DB.calcLine(l); }
    function totals() {
      var t = lines.reduce(function (a, l) { return a + lineNet(l); }, 0), p = Number($("#h_paid").value) || 0;
      $("#t_total").textContent = UI.money(t); $("#t_paid").textContent = UI.money(p); $("#t_bal").textContent = UI.money(t - p);
    }
    function drawLines() {
      $("#ln").innerHTML = lines.map(function (l, i) {
        var loc = l.destination === "project"
          ? '<select data-k="project_id">' + O(App.opts("projects"), l.project_id) + "</select>"
          : '<select data-k="warehouse_id">' + O(App.opts("warehouses"), l.warehouse_id) + "</select>";
        return '<tr data-i="' + i + '"><td style="min-width:190px"><select data-k="item_id">' + O(App.opts("items"), l.item_id) + "</select></td>" +
          '<td><select data-k="destination">' + O([["warehouse", "مخزن"], ["project", "مشروع مباشر"]], l.destination, false) + "</select></td><td style=\"min-width:160px\">" + loc + "</td>" +
          ["qty", "unit_price", "discount", "tax"].map(function (k) { return '<td><input type="number" step="any" data-k="' + k + '" value="' + (l[k] == null ? 0 : l[k]) + '"/></td>'; }).join("") +
          '<td class="num" data-net style="padding-top:12px;font-weight:700">' + UI.money(lineNet(l)) + '</td><td><button type="button" class="ghost small" data-rm="' + i + '" title="حذف">✕</button></td></tr>';
      }).join("");
      if (readOnly) root.querySelectorAll("#ln input,#ln select,#ln button").forEach(function (e) { e.disabled = true; });
      totals();
    }
    drawLines();
    $("#ln").addEventListener("input", function (e) {
      var k = e.target.getAttribute("data-k"), row = e.target.closest("tr"); if (!k || !row) return;
      var l = lines[Number(row.getAttribute("data-i"))];
      if (e.target.tagName === "INPUT") { l[k] = Number(e.target.value) || 0; row.querySelector("[data-net]").textContent = UI.money(lineNet(l)); totals(); }
    });
    $("#ln").addEventListener("change", function (e) {
      var k = e.target.getAttribute("data-k"), row = e.target.closest("tr"); if (!k || !row) return;
      var l = lines[Number(row.getAttribute("data-i"))];
      if (e.target.tagName === "SELECT") {
        l[k] = e.target.value;
        if (k === "item_id") { var it = DB.get("items", l.item_id); if (it && !Number(l.unit_price)) l.unit_price = Number(it.default_purchase_price) || 0; }
        drawLines();
      }
    });
    $("#ln").addEventListener("click", function (e) { var r = e.target.getAttribute("data-rm"); if (r != null) { lines.splice(Number(r), 1); if (!lines.length) lines.push(blank()); drawLines(); } });
    $("#addln").addEventListener("click", function () { lines.push(blank()); drawLines(); });
    $("#h_paid").addEventListener("input", totals);

    var busy = false;
    function save() {
      if (busy) return;
      var err = "", paid = Number($("#h_paid").value) || 0, total = lines.reduce(function (a, l) { return a + lineNet(l); }, 0);
      if (!$("#h_sup").value) err = "اختر المورد";
      else if (!$("#h_date").value) err = "أدخل تاريخ الشراء";
      lines.forEach(function (l, i) {
        if (err) return;
        if (!l.item_id) err = "السطر " + (i + 1) + ": اختر الصنف";
        else if (!(Number(l.qty) > 0)) err = "السطر " + (i + 1) + ": الكمية يجب أن تكون أكبر من صفر";
        else if (l.destination === "project" && !l.project_id) err = "السطر " + (i + 1) + ": اختر المشروع";
        else if (l.destination !== "project" && !l.warehouse_id) err = "السطر " + (i + 1) + ": اختر المخزن";
      });
      if (!err && paid > total + 0.001) err = "المدفوع عند الشراء أكبر من إجمالي الفاتورة";
      if (!err && paid > 0 && !$("#h_cb").value) err = "اختر الخزينة المدفوع منها";
      var eEl = $("#h_err");
      if (err) { eEl.textContent = err; eEl.hidden = false; return; }
      eEl.hidden = true; busy = true;
      var invoice = { id: head.id || head.code, code: head.code, date: $("#h_date").value, supplier_id: $("#h_sup").value, payment_terms: $("#h_terms").value, paid_at_purchase: paid, cashbox_id: $("#h_cb").value || null, notes: $("#h_notes").value.trim() };
      var payload = lines.map(function (l, i) { return { id: l.id || "", item_id: l.item_id, warehouse_id: l.warehouse_id || null, project_id: l.project_id || null, qty: Number(l.qty), unit_price: Number(l.unit_price), discount: Number(l.discount) || 0, tax: Number(l.tax) || 0, destination: l.destination }; });
      DB.savePurchaseInvoice(invoice, payload).then(function () { m.close(); UI.toast("تم حفظ الفاتورة وتحديث المخزون"); render(); })
        .catch(function (e) { busy = false; eEl.textContent = e.message || "تعذّر الحفظ"; eEl.hidden = false; });
    }
  }
  render();
})();
