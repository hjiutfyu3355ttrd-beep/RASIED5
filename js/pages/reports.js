// التقارير: حسابات الموردين · حسابات العملاء · المخزون · الخزينة · حركة الأصناف
(function () {
  "use strict";
  var page = document.getElementById("page"), esc = UI.esc, M = UI.money, O = App.optionsHtml;
  var TABS = [["suppliers", "حسابات الموردين"], ["customers", "حسابات العملاء"], ["inventory", "تقرير المخزون"], ["cash", "تقرير الخزينة"], ["flow", "حركة الأصناف"]];
  var hash = (location.hash || "").slice(1);
  var st = { tab: TABS.some(function (t) { return t[0] === hash; }) ? hash : "suppliers", from: "", to: "", cb: "", dir: "" };
  var kp = function (l, v, c) { return '<div class="card stat ' + (c || "") + '"><div class="label">' + l + '</div><div class="value">' + v + "</div></div>"; };
  function tbl(head, rows, foot) {
    return '<div class="card table-card"><div class="table-wrap"><table class="table"><thead><tr>' + head.map(function (h) { return "<th" + (h.n ? ' class="num"' : "") + ">" + h.t + "</th>"; }).join("") + "</tr></thead><tbody>" +
      (rows.join("") || '<tr><td colspan="' + head.length + '" class="muted" style="text-align:center;padding:28px">لا توجد بيانات</td></tr>') + (foot || "") + "</tbody></table></div></div>";
  }
  var td = function (v, n) { return "<td" + (n ? ' class="num"' : "") + ">" + v + "</td>"; };
  var dateFilters = function () { return '<div class="field"><label>من تاريخ</label><input type="date" id="from" value="' + st.from + '"/></div><div class="field"><label>إلى تاريخ</label><input type="date" id="to" value="' + st.to + '"/></div>'; };

  function render() {
    var html = '<div class="tabs"><div class="seg" style="flex-wrap:wrap">' + TABS.map(function (t) { return '<button data-tab="' + t[0] + '" class="' + (st.tab === t[0] ? "on" : "") + '">' + t[1] + "</button>"; }).join("") + "</div></div>";
    var exp, bindExtra = function () {};

    if (st.tab === "suppliers") {
      var rows = DB.listSupplierAccounts(), s = function (k) { return rows.reduce(function (a, r) { return a + r[k]; }, 0); };
      html += '<div class="stats" style="margin-bottom:16px">' + kp("إجمالي المشتريات", UI.moneyC(s("purchases"))) + kp("إجمالي المدفوعات", UI.moneyC(s("payments") + s("paid_at_purchase")), "green") + kp("صافي المستحق للموردين", UI.moneyC(s("due")), s("due") > 0 ? "amber" : "green") + "</div>" +
        '<div class="filter-bar"><div style="margin-inline-start:auto"><button id="xl">' + UI.icon.download + "<span>تصدير</span></button></div></div>" +
        tbl([{ t: "الكود" }, { t: "المورد" }, { t: "افتتاحي", n: 1 }, { t: "المشتريات", n: 1 }, { t: "مدفوع عند الشراء", n: 1 }, { t: "المدفوعات", n: 1 }, { t: "المرتجعات", n: 1 }, { t: "المستحق", n: 1 }, { t: "" }],
          rows.map(function (r) { return "<tr>" + td(esc(r.supplier_code || r.supplier_id)) + td(esc(r.supplier_name)) + td(M(r.opening), 1) + td(M(r.purchases), 1) + td(M(r.paid_at_purchase), 1) + td(M(r.payments), 1) + td(M(r.returns), 1) + td("<b>" + M(r.due) + "</b>", 1) + '<td><button class="ghost small" data-st="' + esc(r.supplier_id) + '">كشف حساب</button></td></tr>'; }));
      exp = function () { App.exportXlsx("حسابات الموردين", "حسابات الموردين", ["الكود", "المورد", "افتتاحي", "المشتريات", "مدفوع عند الشراء", "المدفوعات", "المرتجعات", "المستحق"], rows.map(function (r) { return [r.supplier_code, r.supplier_name, r.opening, r.purchases, r.paid_at_purchase, r.payments, r.returns, r.due]; })); };
      bindExtra = function () { page.querySelectorAll("[data-st]").forEach(function (b) { b.addEventListener("click", function () { App.showSupplierStatement(b.getAttribute("data-st")); }); }); };
    }

    else if (st.tab === "customers") {
      var pr = DB.listProjectProfits(), t = function (k) { return pr.reduce(function (a, r) { return a + r[k]; }, 0); };
      html += '<div class="stats" style="margin-bottom:16px">' + kp("قيمة المشاريع", UI.moneyC(t("revenue"))) + kp("المقبوضات", UI.moneyC(t("received")), "green") + kp("إجمالي المستحقات", UI.moneyC(t("receivable")), t("receivable") > 0 ? "amber" : "green") + "</div>" +
        '<div class="filter-bar"><div style="margin-inline-start:auto"><button id="xl">' + UI.icon.download + "<span>تصدير</span></button></div></div>" +
        tbl([{ t: "الكود" }, { t: "المشروع" }, { t: "المهندس" }, { t: "قيمة المشروع", n: 1 }, { t: "المقبوضات", n: 1 }, { t: "المستحق من العميل", n: 1 }, { t: "نسبة التحصيل", n: 1 }, { t: "الحالة" }],
          pr.map(function (r) { return "<tr>" + td(esc(r.project_code)) + td(esc(r.project_name)) + td(esc(r.engineer_name)) + td(M(r.revenue), 1) + td(M(r.received), 1) + td("<b>" + M(r.receivable) + "</b>", 1) + td(r.revenue ? Math.round((r.received / r.revenue) * 100) + "%" : "—", 1) + td(esc(App.STATUS_AR[r.status] || r.status)) + "</tr>"; }));
      exp = function () { App.exportXlsx("حسابات العملاء", "حسابات العملاء", ["الكود", "المشروع", "المهندس", "قيمة المشروع", "المقبوضات", "المستحق"], pr.map(function (r) { return [r.project_code, r.project_name, r.engineer_name, r.revenue, r.received, r.receivable]; })); };
    }

    else if (st.tab === "inventory") {
      var bal = DB.listStockBalances().sort(function (a, b) { return a.item_name.localeCompare(b.item_name, "ar"); }), v = bal.reduce(function (a, b) { return a + b.value; }, 0);
      html += '<div class="stats" style="margin-bottom:16px">' + kp("قيمة المخزون", UI.moneyC(v)) + kp("عدد الأرصدة", bal.length) + kp("تنبيهات انخفاض", bal.filter(function (b) { return b.low; }).length, "red") + "</div>" +
        '<div class="filter-bar"><div style="margin-inline-start:auto"><button id="xl">' + UI.icon.download + "<span>تصدير</span></button></div></div>" +
        tbl([{ t: "الصنف" }, { t: "المخزن" }, { t: "الكمية", n: 1 }, { t: "القيمة", n: 1 }, { t: "متوسط التكلفة المرجح", n: 1 }, { t: "حد الطلب", n: 1 }, { t: "الحالة" }],
          bal.map(function (b) { return "<tr>" + td(esc(b.item_name)) + td(esc(b.warehouse_name)) + td(UI.num(b.qty), 1) + td(M(b.value), 1) + td(M(b.avg_cost), 1) + td(UI.num(b.reorder_level), 1) + td(b.low ? '<span class="badge warn">منخفض</span>' : '<span class="badge ok">سليم</span>') + "</tr>"; }),
          '<tr class="tfoot-row"><td colspan="3">الإجمالي</td><td class="num">' + M(v) + "</td><td colspan=\"3\"></td></tr>");
      exp = function () { App.exportXlsx("تقرير المخزون", "تقرير المخزون", ["الصنف", "المخزن", "الكمية", "القيمة", "متوسط التكلفة", "حد الطلب"], bal.map(function (b) { return [b.item_name, b.warehouse_name, b.qty, b.value, b.avg_cost, b.reorder_level]; })); };
    }

    else if (st.tab === "cash") {
      var L = DB.cashLedger({ from: st.from, to: st.to, cashbox_id: st.cb, direction: st.dir });
      html += '<div class="filter-bar">' + dateFilters() + '<div class="field"><label>الخزينة</label><select id="cb">' + O(App.opts("cashboxes"), st.cb).replace("— اختر —", "الكل") + '</select></div><div class="field"><label>الاتجاه</label><select id="dir">' + O([["in", "مقبوضات"], ["out", "مدفوعات"]], st.dir).replace("— اختر —", "الكل") + '</select></div><div style="margin-inline-start:auto"><button id="xl">' + UI.icon.download + "<span>تصدير</span></button></div></div>" +
        '<div class="stats" style="margin-bottom:16px">' + kp("رصيد أول الفترة", UI.moneyC(L.opening)) + kp("المقبوضات", UI.moneyC(L.total_in), "green") + kp("المدفوعات", UI.moneyC(L.total_out), "amber") + kp("الرصيد الختامي", UI.moneyC(L.closing), L.closing < 0 ? "red" : "green") + "</div>" +
        tbl([{ t: "التاريخ" }, { t: "الخزينة" }, { t: "النوع" }, { t: "المرجع" }, { t: "البيان" }, { t: "مقبوضات", n: 1 }, { t: "مدفوعات", n: 1 }, { t: "الرصيد", n: 1 }],
          L.rows.map(function (m) { return "<tr>" + td(UI.fmtDate(m.date)) + td(esc(App.name("cashboxes", m.cashbox_id))) + td(esc(m.type)) + td(esc(m.ref)) + td(esc(m.notes)) + td(m.direction === "in" ? '<span class="pos-t">' + M(m.amount) + "</span>" : "—", 1) + td(m.direction === "out" ? '<span class="neg-t">' + M(m.amount) + "</span>" : "—", 1) + td("<b>" + M(m.balance) + "</b>", 1) + "</tr>"; }));
      exp = function () { App.exportXlsx("تقرير الخزينة", "تقرير الخزينة", ["التاريخ", "الخزينة", "النوع", "المرجع", "البيان", "مقبوضات", "مدفوعات", "الرصيد"], L.rows.map(function (m) { return [m.date, App.name("cashboxes", m.cashbox_id), m.type, m.ref, m.notes, m.direction === "in" ? m.amount : 0, m.direction === "out" ? m.amount : 0, m.balance]; })); };
      bindExtra = function () { ["from", "to", "cb", "dir"].forEach(function (k) { page.querySelector("#" + k).addEventListener("change", function (e) { st[k] = e.target.value; render(); }); }); };
    }

    else {
      DB.rebuildInventory();
      var IN = { purchase_in: 1, return_from_project: 1, transfer_in: 1, adjust_plus: 1 }, agg = {};
      DB.list("stock_movements").forEach(function (m) {
        if (m.type === "purchase_direct") return;
        if (st.from && m.date < st.from) return; if (st.to && m.date > st.to) return;
        var k = m.item_id + "|" + (m.warehouse_id || ""), a = agg[k] || (agg[k] = { item: m.item_id, wh: m.warehouse_id, inq: 0, outq: 0, inv: 0, outv: 0 });
        if (IN[m.type]) { a.inq += Number(m.qty); a.inv += Number(m.value); } else { a.outq += Number(m.qty); a.outv += Number(m.value); }
      });
      var fl = Object.keys(agg).map(function (k) { return agg[k]; });
      html += '<div class="filter-bar">' + dateFilters() + '<div style="margin-inline-start:auto"><button id="xl">' + UI.icon.download + "<span>تصدير</span></button></div></div>" +
        tbl([{ t: "الصنف" }, { t: "المخزن" }, { t: "وارد (كمية)", n: 1 }, { t: "وارد (قيمة)", n: 1 }, { t: "منصرف (كمية)", n: 1 }, { t: "منصرف (قيمة)", n: 1 }, { t: "صافي الكمية", n: 1 }],
          fl.map(function (a) { return "<tr>" + td(esc(App.name("items", a.item))) + td(esc(App.name("warehouses", a.wh))) + td(UI.num(a.inq), 1) + td(M(a.inv), 1) + td(UI.num(a.outq), 1) + td(M(a.outv), 1) + td("<b>" + UI.num(a.inq - a.outq) + "</b>", 1) + "</tr>"; }));
      exp = function () { App.exportXlsx("حركة الأصناف", "حركة الأصناف", ["الصنف", "المخزن", "وارد كمية", "وارد قيمة", "منصرف كمية", "منصرف قيمة"], fl.map(function (a) { return [App.name("items", a.item), App.name("warehouses", a.wh), a.inq, a.inv, a.outq, a.outv]; })); };
      bindExtra = function () { ["from", "to"].forEach(function (k) { page.querySelector("#" + k).addEventListener("change", function (e) { st[k] = e.target.value; render(); }); }); };
    }

    page.innerHTML = html;
    page.querySelectorAll("[data-tab]").forEach(function (b) { b.addEventListener("click", function () { st.tab = b.getAttribute("data-tab"); try { history.replaceState(null, "", "#" + st.tab); } catch (e) {} render(); }); });
    page.querySelector("#xl").addEventListener("click", exp);
    bindExtra();
  }
  render();
})();
