// حركات المخزون + الأرصدة (صرف، مرتجع، تحويل، تسوية، مرتجع للمورد)
(function () {
  "use strict";
  var page = document.getElementById("page"), esc = UI.esc, O = App.optionsHtml, T = App.STOCK_TYPES;
  var st = { tab: "balances", q: "", from: "", to: "", type: "", item: "", wh: "", project: "" };
  var AUTO = { purchase_in: 1, purchase_direct: 1 };
  var MANUAL = ["issue_to_project", "return_from_project", "return_to_supplier", "transfer", "adjust_plus", "adjust_minus"];
  var LABELS = { transfer: "تحويل بين مخزنين" };

  function render() {
    var canW = DB.canWrite();
    var bal = DB.listStockBalances();
    var value = bal.reduce(function (a, b) { return a + b.value; }, 0), low = bal.filter(function (b) { return b.low; }).length;
    page.innerHTML = '<div class="stats" style="margin-bottom:16px"><div class="card stat"><div class="label">قيمة المخزون</div><div class="value">' + UI.moneyC(value) + '</div></div><div class="card stat green"><div class="label">أصناف بأرصدة</div><div class="value">' + bal.length +
      '</div></div><div class="card stat ' + (low ? "red" : "green") + '"><div class="label">تنبيهات انخفاض</div><div class="value">' + low + "</div></div></div>" +
      '<div class="filter-bar"><div class="seg"><button data-tab="balances" class="' + (st.tab === "balances" ? "on" : "") + '">الأرصدة</button><button data-tab="moves" class="' + (st.tab === "moves" ? "on" : "") + '">سجل الحركات</button></div>' +
      '<div style="margin-inline-start:auto;display:flex;gap:8px"><button id="xl">' + UI.icon.download + "<span>تصدير</span></button>" + (canW ? '<button class="primary" id="add">+ حركة مخزون</button>' : "") + "</div></div>" +
      '<div id="body"></div>';
    page.querySelectorAll("[data-tab]").forEach(function (b) { b.addEventListener("click", function () { st.tab = b.getAttribute("data-tab"); render(); }); });
    var add = page.querySelector("#add"); if (add) add.addEventListener("click", function () { openMove(null); });
    var xl;
    if (st.tab === "balances") xl = drawBalances(bal); else xl = drawMoves();
    page.querySelector("#xl").addEventListener("click", xl);
  }

  function drawBalances(bal) {
    var q = st.q.toLowerCase();
    var rows = bal.filter(function (b) { return !q || (b.item_name + b.warehouse_name).toLowerCase().indexOf(q) >= 0; })
      .sort(function (a, b) { return a.item_name.localeCompare(b.item_name, "ar"); });
    page.querySelector("#body").innerHTML = '<div class="filter-bar"><div class="field" style="max-width:260px"><label>بحث</label><input id="q" type="search" value="' + esc(st.q) + '" placeholder="صنف أو مخزن"/></div></div>' +
      '<div class="card table-card"><div class="table-wrap"><table class="table"><thead><tr><th>الصنف</th><th>المخزن</th><th class="num">الكمية</th><th class="num">متوسط التكلفة</th><th class="num">قيمة المخزون</th><th class="num">حد الطلب</th><th>الحالة</th></tr></thead><tbody>' +
      (rows.map(function (r) { return '<tr class="' + (r.low ? "row-warn" : "") + '"><td>' + esc(r.item_name) + "</td><td>" + esc(r.warehouse_name || "—") + '</td><td class="num">' + UI.num(r.qty) + '</td><td class="num">' + UI.money(r.avg_cost) + '</td><td class="num">' + UI.money(r.value) + '</td><td class="num">' + UI.num(r.reorder_level) + "</td><td>" + (r.low ? '<span class="badge warn">منخفض</span>' : '<span class="badge ok">سليم</span>') + "</td></tr>"; }).join("") || '<tr><td colspan="7" class="muted" style="text-align:center;padding:28px">لا يوجد رصيد بعد — سجّل فاتورة مشتريات</td></tr>') + "</tbody></table></div></div>";
    var q2 = page.querySelector("#q"); q2.addEventListener("input", function () { st.q = q2.value; var p = q2.selectionStart; render(); var n = page.querySelector("#q"); n.focus(); try { n.setSelectionRange(p, p); } catch (e) {} });
    return function () { App.exportXlsx("أرصدة المخزون", "أرصدة المخزون", ["الصنف", "المخزن", "الكمية", "متوسط التكلفة", "القيمة", "حد الطلب"], rows.map(function (r) { return [r.item_name, r.warehouse_name, r.qty, r.avg_cost, r.value, r.reorder_level]; })); };
  }

  function movesFiltered() {
    DB.rebuildInventory();
    return DB.list("stock_movements").filter(function (m) {
      if (st.from && m.date < st.from) return false; if (st.to && m.date > st.to) return false;
      if (st.type && m.type !== st.type) return false; if (st.item && m.item_id !== st.item) return false;
      if (st.wh && m.warehouse_id !== st.wh) return false; if (st.project && m.project_id !== st.project) return false;
      return true;
    }).sort(function (a, b) { return a.date === b.date ? ((b.created_at || "") + b.id > (a.created_at || "") + a.id ? 1 : -1) : (a.date < b.date ? 1 : -1); });
  }

  function drawMoves() {
    var list = movesFiltered(), canE = DB.canDelete();
    var sel = function (id, label, opts, v) { return '<div class="field"><label>' + label + '</label><select id="' + id + '">' + O(opts, v).replace("— اختر —", "الكل") + "</select></div>"; };
    page.querySelector("#body").innerHTML = '<div class="filter-bar"><div class="field"><label>من</label><input type="date" id="from" value="' + st.from + '"/></div><div class="field"><label>إلى</label><input type="date" id="to" value="' + st.to + '"/></div>' +
      sel("ftype", "نوع الحركة", Object.keys(T).map(function (k) { return [k, T[k]]; }), st.type) + sel("fitem", "الصنف", App.opts("items"), st.item) + sel("fwh", "المخزن", App.opts("warehouses"), st.wh) + sel("fprj", "المشروع", App.opts("projects"), st.project) + "</div>" +
      '<div class="card table-card"><div class="table-wrap"><table class="table"><thead><tr><th>الكود</th><th>التاريخ</th><th>النوع</th><th>الصنف</th><th>المخزن</th><th>المشروع / المورد</th><th class="num">الكمية</th><th class="num">تكلفة الوحدة</th><th class="num">القيمة</th><th></th></tr></thead><tbody>' +
      (list.slice(0, 400).map(function (m) {
        var who = m.project_id ? App.name("projects", m.project_id) : (m.supplier_id ? App.name("suppliers", m.supplier_id) : "—");
        var out = { issue_to_project: 1, transfer_out: 1, return_to_supplier: 1, adjust_minus: 1 }[m.type];
        return "<tr><td>" + esc(m.id) + "</td><td>" + UI.fmtDate(m.date) + "</td><td>" + esc(T[m.type] || m.type) + "</td><td>" + esc(App.name("items", m.item_id)) + "</td><td>" + esc(App.name("warehouses", m.warehouse_id)) + "</td><td>" + esc(who) +
          '</td><td class="num ' + (out ? "neg-t" : "pos-t") + '">' + (out ? "-" : "+") + UI.num(m.qty) + '</td><td class="num">' + UI.money(m.unit_cost) + '</td><td class="num">' + UI.money(m.value) + '</td><td class="actions-cell">' +
          (canE && !AUTO[m.type] ? '<button class="danger small" data-del="' + esc(m.id) + '">حذف</button>' : "") + "</td></tr>";
      }).join("") || '<tr><td colspan="10" class="muted" style="text-align:center;padding:28px">لا توجد حركات</td></tr>') + "</tbody></table></div></div>" +
      '<p class="help-note" style="margin-top:8px">حركات «شراء للمخزن» و«شراء مباشر» تُنشأ تلقائياً من فواتير المشتريات (عدّل الفاتورة لتغييرها).</p>';
    [["from", "from"], ["to", "to"], ["ftype", "type"], ["fitem", "item"], ["fwh", "wh"], ["fprj", "project"]].forEach(function (p) {
      page.querySelector("#" + p[0]).addEventListener("change", function (e) { st[p[1]] = e.target.value; render(); });
    });
    page.querySelectorAll("[data-del]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-del"), m = DB.get("stock_movements", id);
        if (!confirm("حذف الحركة؟ ستُعاد حسابات المخزون.")) return;
        var ids = [id]; DB.list("stock_movements").forEach(function (x) { if (m.type === "transfer_out" && x.type === "transfer_in" && x.ref === id) ids.push(x.id); if (m.type === "transfer_in" && m.ref && x.id === m.ref) ids.push(x.id); });
        ids.reduce(function (p, i) { return p.then(function () { return DB.remove("stock_movements", i); }); }, Promise.resolve()).then(function () { return DB.stockChanged(); }).then(function () { UI.toast("تم الحذف"); render(); }).catch(function (e) { UI.toast(e.message, true); });
      });
    });
    return function () { App.exportXlsx("حركات المخزون", "حركات المخزون", ["الكود", "التاريخ", "النوع", "الصنف", "المخزن", "المشروع", "الكمية", "تكلفة الوحدة", "القيمة"], list.map(function (m) { return [m.id, m.date, T[m.type] || m.type, App.name("items", m.item_id), App.name("warehouses", m.warehouse_id), m.project_id ? App.name("projects", m.project_id) : "", Number(m.qty), Number(m.unit_cost), Number(m.value)]; })); };
  }

  function openMove() {
    var body = '<div class="form-grid">' +
      '<div class="field"><label>نوع الحركة <small>*</small></label><select id="m_type">' + O(MANUAL.map(function (k) { return [k, LABELS[k] || T[k]]; }), "issue_to_project", false) + "</select></div>" +
      '<div class="field"><label>التاريخ <small>*</small></label><input id="m_date" type="date" value="' + DB.today() + '"/></div>' +
      '<div class="field"><label>الصنف <small>*</small></label><select id="m_item">' + O(App.opts("items"), "") + "</select></div>" +
      '<div class="field" id="w_wh"><label id="l_wh">المخزن <small>*</small></label><select id="m_wh">' + O(App.opts("warehouses"), (DB.list("warehouses")[0] || {}).id) + "</select></div>" +
      '<div class="field" id="w_wh2" hidden><label>إلى مخزن <small>*</small></label><select id="m_wh2">' + O(App.opts("warehouses"), "") + "</select></div>" +
      '<div class="field" id="w_prj"><label>المشروع <small>*</small></label><select id="m_prj">' + O(App.opts("projects", function (p) { return ["closed"].indexOf(p.status) < 0; }), "") + "</select></div>" +
      '<div class="field" id="w_sup" hidden><label>المورد <small>*</small></label><select id="m_sup">' + O(App.opts("suppliers"), "") + "</select></div>" +
      '<div class="field" id="w_orig" hidden><label>حركة الصرف الأصلية (اختياري)</label><select id="m_orig"></select></div>' +
      '<div class="field"><label>الكمية <small>*</small></label><input id="m_qty" type="number" step="any" value="1"/><span class="help-note" id="m_avail"></span></div>' +
      '<div class="field" id="w_cost" hidden><label>تكلفة الوحدة <small>*</small></label><input id="m_cost" type="number" step="any" value="0"/></div>' +
      '<div class="field span-all"><label>ملاحظات</label><input id="m_notes"/></div></div><p class="auth-err" id="m_err" style="color:var(--error);margin:10px 0 0" hidden></p>' +
      '<p class="help-note">تكلفة الصرف تُحسب تلقائياً بالمتوسط المرجح المتحرك للصنف في المخزن.</p>';
    var m = UI.modal({ title: "حركة مخزون جديدة", body: body, actions: [{ label: "إلغاء", cls: "ghost", onClick: function (c) { c(); } }, { label: "حفظ", cls: "primary", onClick: function () { save(); } }] });
    var root = m.el, $ = function (s) { return root.querySelector(s); }, show = function (id, on) { $(id).hidden = !on; };
    function sync() {
      var t = $("#m_type").value;
      show("#w_prj", t === "issue_to_project" || t === "return_from_project"); show("#w_sup", t === "return_to_supplier");
      show("#w_wh2", t === "transfer"); show("#w_orig", t === "return_from_project"); show("#w_cost", t === "adjust_plus");
      $("#l_wh").innerHTML = (t === "transfer" ? "من مخزن" : "المخزن") + " <small>*</small>";
      if (t === "return_from_project") {
        var opts = DB.list("stock_movements").filter(function (x) { return x.type === "issue_to_project" && (!$("#m_prj").value || x.project_id === $("#m_prj").value); })
          .map(function (x) { return [x.id, x.id + " — " + App.name("items", x.item_id) + " (" + x.qty + ")"]; });
        $("#m_orig").innerHTML = O(opts, "");
      }
      var out = ["issue_to_project", "transfer", "return_to_supplier", "adjust_minus"].indexOf(t) >= 0, it = $("#m_item").value, wh = $("#m_wh").value;
      $("#m_avail").textContent = out && it ? "المتاح: " + UI.num(DB.getStock(it, wh).qty) + " — متوسط التكلفة: " + UI.money(DB.getStock(it, wh).avg_cost) : "";
    }
    root.addEventListener("change", sync); sync();
    $("#m_orig").addEventListener("change", function () { var o = DB.get("stock_movements", $("#m_orig").value); if (o) { $("#m_item").value = o.item_id; $("#m_wh").value = o.warehouse_id || ""; $("#m_prj").value = o.project_id || ""; sync(); } });
    var busy = false;
    function save() {
      if (busy) return;
      var t = $("#m_type").value, v = { date: $("#m_date").value, item: $("#m_item").value, wh: $("#m_wh").value, wh2: $("#m_wh2").value, prj: $("#m_prj").value, sup: $("#m_sup").value, qty: Number($("#m_qty").value) || 0, cost: Number($("#m_cost").value) || 0, orig: $("#m_orig").value, notes: $("#m_notes").value.trim() };
      var err = "", out = ["issue_to_project", "transfer", "return_to_supplier", "adjust_minus"].indexOf(t) >= 0;
      if (!v.date) err = "أدخل التاريخ"; else if (!v.item) err = "اختر الصنف"; else if (!v.wh) err = "اختر المخزن"; else if (!(v.qty > 0)) err = "الكمية يجب أن تكون أكبر من صفر";
      else if ((t === "issue_to_project" || t === "return_from_project") && !v.prj) err = "اختر المشروع";
      else if (t === "return_to_supplier" && !v.sup) err = "اختر المورد";
      else if (t === "transfer" && (!v.wh2 || v.wh2 === v.wh)) err = "اختر مخزناً مختلفاً للتحويل";
      else if (t === "adjust_plus" && !(v.cost > 0)) err = "أدخل تكلفة الوحدة";
      else if (out && DB.getStock(v.item, v.wh).qty < v.qty - 0.0001) err = "الكمية المتاحة في المخزن (" + UI.num(DB.getStock(v.item, v.wh).qty) + ") لا تكفي";
      var eEl = $("#m_err"); if (err) { eEl.textContent = err; eEl.hidden = false; return; } eEl.hidden = true; busy = true;
      var prj = v.prj ? DB.get("projects", v.prj) : null, avg = DB.getStock(v.item, v.wh).avg_cost;
      var base = { date: v.date, item_id: v.item, qty: v.qty, notes: v.notes };
      var rows = [];
      function nid() { return DB.nextCode("stock_movements", "STK"); }
      if (t === "issue_to_project") rows.push(Object.assign({}, base, { type: t, warehouse_id: v.wh, project_id: v.prj, engineer_id: prj ? prj.engineer_id : null, unit_cost: avg, value: App.round2(avg * v.qty) }));
      else if (t === "return_from_project") { var o = v.orig ? DB.get("stock_movements", v.orig) : null, c = o ? o.unit_cost : avg; rows.push(Object.assign({}, base, { type: t, warehouse_id: v.wh, project_id: v.prj, engineer_id: prj ? prj.engineer_id : null, original_issue_id: v.orig || null, unit_cost: c, value: App.round2(c * v.qty) })); }
      else if (t === "return_to_supplier") rows.push(Object.assign({}, base, { type: t, warehouse_id: v.wh, supplier_id: v.sup, unit_cost: avg, value: App.round2(avg * v.qty) }));
      else if (t === "adjust_plus") rows.push(Object.assign({}, base, { type: t, warehouse_id: v.wh, unit_cost: v.cost, value: App.round2(v.cost * v.qty) }));
      else if (t === "adjust_minus") rows.push(Object.assign({}, base, { type: t, warehouse_id: v.wh, unit_cost: avg, value: App.round2(avg * v.qty) }));
      else if (t === "transfer") rows.push(Object.assign({}, base, { type: "transfer_out", warehouse_id: v.wh, unit_cost: avg, value: App.round2(avg * v.qty) }));
      var p = Promise.resolve();
      rows.forEach(function (r) { p = p.then(function () { r.id = nid(); return DB.save("stock_movements", r); }); });
      if (t === "transfer") p = p.then(function (saved) { return DB.save("stock_movements", Object.assign({}, base, { id: nid(), type: "transfer_in", warehouse_id: v.wh2, ref: saved.id, unit_cost: avg, value: App.round2(avg * v.qty) })); });
      p.then(function () { return DB.stockChanged(); }).then(function () { m.close(); UI.toast("تم تسجيل الحركة"); render(); })
        .catch(function (e) { busy = false; eEl.textContent = e.message || "تعذّر الحفظ"; eEl.hidden = false; });
    }
  }
  render();
})();
