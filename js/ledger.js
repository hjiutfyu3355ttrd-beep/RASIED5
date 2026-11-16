// كشوف الحسابات وتفاصيل المشروع (نوافذ منبثقة مشتركة)
(function () {
  "use strict";
  var esc = UI.esc, M = UI.money;

  function table(head, rows, opt) {
    opt = opt || {};
    return '<div class="table-wrap"><table class="table"><thead><tr>' + head.map(function (h) { return "<th" + (h.num ? ' class="num"' : "") + ">" + esc(h.t) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      (rows.length ? rows.join("") : '<tr><td colspan="' + head.length + '" class="muted" style="text-align:center;padding:16px">لا توجد بيانات</td></tr>') + "</tbody></table></div>";
  }
  function tr(cells, cls) { return "<tr" + (cls ? ' class="' + cls + '"' : "") + ">" + cells.map(function (c) { return c; }).join("") + "</tr>"; }
  function td(v, num) { return "<td" + (num ? ' class="num"' : "") + ">" + v + "</td>"; }

  function supplierEntries(id) {
    var sup = DB.get("suppliers", id), list = [];
    (DB.list("purchase_invoices")).forEach(function (i) {
      if (i.supplier_id !== id) return;
      list.push({ date: i.date, text: "فاتورة مشتريات " + (i.code || i.id), debit: Number(i.total || 0), credit: 0 });
      if (Number(i.paid_at_purchase) > 0) list.push({ date: i.date, text: "مدفوع عند الشراء " + (i.code || i.id), debit: 0, credit: Number(i.paid_at_purchase) });
    });
    DB.list("supplier_payments").forEach(function (p) { if (p.supplier_id === id) list.push({ date: p.date, text: "سند دفع " + (p.code || p.id), debit: 0, credit: Number(p.amount || 0) }); });
    DB.rebuildInventory();
    DB.list("stock_movements").forEach(function (m) { if (m.type === "return_to_supplier" && m.supplier_id === id) list.push({ date: m.date, text: "مرتجع للمورد " + m.id, debit: 0, credit: Number(m.value || 0) }); });
    list.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var bal = Number(sup ? sup.opening_balance : 0);
    var out = [{ date: "", text: "رصيد افتتاحي", debit: 0, credit: 0, balance: bal }];
    list.forEach(function (e) { bal = Math.round((bal + e.debit - e.credit) * 100) / 100; e.balance = bal; out.push(e); });
    return out;
  }

  function showSupplierStatement(id) {
    var sup = DB.get("suppliers", id); if (!sup) return;
    var e = supplierEntries(id), last = e[e.length - 1].balance;
    var rows = e.map(function (x) { return tr([td(x.date ? UI.fmtDate(x.date) : "—"), td(esc(x.text)), td(x.debit ? M(x.debit) : "—", 1), td(x.credit ? M(x.credit) : "—", 1), td("<b>" + M(x.balance) + "</b>", 1)]); });
    var m = UI.modal({
      title: "كشف حساب المورد — " + esc(sup.name),
      body: '<div class="stats" style="margin-bottom:14px"><div class="card stat ' + (last > 0 ? "amber" : "green") + '"><div class="label">المستحق للمورد</div><div class="value">' + UI.moneyC(last) + "</div></div></div>" +
        table([{ t: "التاريخ" }, { t: "البيان" }, { t: "مشتريات (عليه)", num: 1 }, { t: "مدفوع/مرتجع (له)", num: 1 }, { t: "الرصيد", num: 1 }], rows),
      actions: [
        { label: "تصدير Excel", onClick: function () { App.exportXlsx("كشف حساب " + sup.name, "كشف حساب " + sup.name, ["التاريخ", "البيان", "مشتريات", "مدفوع/مرتجع", "الرصيد"], e.map(function (x) { return [x.date, x.text, x.debit, x.credit, x.balance]; }), [14, 36, 16, 16, 16]); } },
        { label: "إغلاق", cls: "primary", onClick: function (c) { c(); } }
      ]
    });
    m.el.querySelector(".modal").classList.add("wide");
  }

  function showProjectDetails(id) {
    var p = DB.get("projects", id); if (!p) return;
    var c = DB.calcProjectProfit(id);
    var by = function (t) { return DB.list(t).filter(function (x) { return x.project_id === id; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }); };
    var mv = DB.list("stock_movements").filter(function (x) { return x.project_id === id; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var kp = function (l, v, cls) { return '<div class="card stat ' + (cls || "") + '"><div class="label">' + l + '</div><div class="value">' + v + "</div></div>"; };
    var body = '<div class="stats" style="margin-bottom:14px">' + kp("الإيراد", UI.moneyC(c.revenue), "green") + kp("إجمالي التكلفة", UI.moneyC(c.total_cost), "amber") +
      kp("صافي الربح", UI.moneyC(c.net), c.net < 0 ? "red" : "green") + kp("هامش الربح", UI.pct(c.margin)) + kp("المحصّل", UI.moneyC(c.received)) + kp("المتبقي على العميل", UI.moneyC(c.receivable), c.receivable > 0 ? "amber" : "green") + "</div>" +
      '<div class="grid-2" style="margin:0 0 14px"><div class="card chart-card"><h3>توزيع التكلفة</h3><div id="pd-donut"></div></div><div class="card chart-card"><h3>بيانات المشروع</h3>' +
      "<p style=\"margin:4px 0\">المهندس: <b>" + esc(App.name("engineers", p.engineer_id)) + "</b></p><p style=\"margin:4px 0\">الحالة: <b>" + esc(App.STATUS_AR[p.status] || p.status) + "</b></p>" +
      "<p style=\"margin:4px 0\">البداية: <b>" + UI.fmtDate(p.start_date) + "</b> · التسليم المتوقع: <b>" + UI.fmtDate(p.expected_end) + "</b></p><p style=\"margin:4px 0\">العنوان: " + esc(p.address || "—") + " — " + esc(p.area || "") + "</p></div></div>" +
      "<h4>المواد (صرف/مرتجع/شراء مباشر)</h4>" + table([{ t: "التاريخ" }, { t: "النوع" }, { t: "الصنف" }, { t: "الكمية", num: 1 }, { t: "القيمة", num: 1 }],
        mv.map(function (x) { return tr([td(UI.fmtDate(x.date)), td(esc(App.STOCK_TYPES[x.type] || x.type)), td(esc(App.name("items", x.item_id))), td(UI.num(x.qty), 1), td(M(x.value), 1)]); })) +
      "<h4>فواتير المشروع والمقبوضات</h4>" + table([{ t: "التاريخ" }, { t: "النوع" }, { t: "المرجع" }, { t: "المبلغ", num: 1 }],
        by("project_invoices").map(function (x) { return tr([td(UI.fmtDate(x.date)), td("فاتورة"), td(esc(x.code || x.id)), td(M(x.amount), 1)]); })
          .concat(by("customer_receipts").map(function (x) { return tr([td(UI.fmtDate(x.date)), td("مقبوض"), td(esc(x.code || x.id)), td(M(x.amount), 1)]); }))) +
      "<h4>العمالة والنقل والتشوين والمصروفات</h4>" + table([{ t: "التاريخ" }, { t: "النوع" }, { t: "البيان" }, { t: "المبلغ", num: 1 }],
        by("labor").map(function (x) { return tr([td(UI.fmtDate(x.date)), td("عمالة"), td(esc(x.worker_name || "")), td(M(x.total), 1)]); })
          .concat(by("transports").map(function (x) { return tr([td(UI.fmtDate(x.date)), td("نقل"), td(esc(x.carrier || "")), td(M(x.amount), 1)]); }))
          .concat(by("storages").map(function (x) { return tr([td(UI.fmtDate(x.date)), td("تشوين"), td(esc(x.place || "")), td(M(x.total), 1)]); }))
          .concat(by("project_expenses").map(function (x) { return tr([td(UI.fmtDate(x.date)), td("مصروف"), td(esc(x.description || "")), td(M(x.amount), 1)]); })));
    var m = UI.modal({ title: "تفاصيل المشروع — " + esc(p.name), body: body, actions: [{ label: "إغلاق", cls: "primary", onClick: function (cl) { cl(); } }] });
    m.el.querySelector(".modal").classList.add("wide");
    Charts.donut(m.el.querySelector("#pd-donut"), [
      { label: "خامات", value: c.materials }, { label: "عمالة", value: c.labor }, { label: "نقل", value: c.transport }, { label: "تشوين", value: c.storage }, { label: "مصروفات أخرى", value: c.other }
    ], { top: M(c.total_cost), sub: "التكلفة" });
  }

  App.showSupplierStatement = showSupplierStatement;
  App.showProjectDetails = showProjectDetails;
  App.supplierEntries = supplierEntries;
})();
