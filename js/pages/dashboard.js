// لوحة التحكم المتقدمة — مؤشرات + رسوم + تنبيهات + نشاط أخير + فلاتر
(function () {
  "use strict";
  var page = document.getElementById("page"), esc = UI.esc, M = UI.money, O = App.optionsHtml;
  var PERIODS = [["month", "هذا الشهر", 1], ["q", "3 شهور", 3], ["h", "6 شهور", 6], ["y", "12 شهر", 12], ["all", "الكل", 0]];
  var st = { period: "y", project: "", eng: "" };

  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function ranges() {
    var p = PERIODS.filter(function (x) { return x[0] === st.period; })[0], n = p[2], now = new Date();
    if (!n) return { cur: null, prev: null, months: 12 };
    var from = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1), prevFrom = new Date(from.getFullYear(), from.getMonth() - n, 1), prevTo = new Date(from.getFullYear(), from.getMonth(), 0);
    return { cur: { from: iso(from), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }, prev: { from: iso(prevFrom), to: iso(prevTo) }, months: Math.max(6, n) };
  }
  function totals(rows) {
    var s = function (k) { return rows.reduce(function (a, r) { return a + r[k]; }, 0); };
    var rev = s("revenue"), cost = s("total_cost");
    return { revenue: rev, cost: cost, net: rev - cost, margin: rev > 0 ? (rev - cost) / rev : 0, received: s("received"), materials: s("materials"), labor: s("labor"), transport: s("transport"), storage: s("storage"), other: s("other") };
  }
  function delta(cur, prev, goodUp) {
    if (prev == null || !isFinite(prev) || Math.abs(prev) < 0.01) return "";
    var d = ((cur - prev) / Math.abs(prev)) * 100, up = d >= 0, good = goodUp === false ? !up : up;
    return '<span class="delta ' + (good ? "pos" : "neg") + '" style="color:var(--' + (good ? "success" : "error") + ');font-weight:700">' + (up ? "▲" : "▼") + " " + Math.abs(d).toFixed(0) + "%</span>";
  }
  function kpi(cfg) {
    return '<div class="card kpi-card ' + (cfg.cls || "") + (cfg.spark ? "" : " no-spark") + '"><div class="kpi-top"><div class="kl"><span class="kpi-ic">' + (UI.icon[cfg.icon] || "") + "</span>" + esc(cfg.label) + '</div></div><div class="kv"><span class="num">' + cfg.value + "</span><small>" + esc(cfg.unit || "") + '</small></div><div class="kmeta">' + (cfg.meta || "") + "</div>" + (cfg.spark ? Charts.spark(cfg.spark) : "") + "</div>";
  }

  function render() {
    var R = ranges(), filter = { project_id: st.project, engineer_id: st.eng };
    var rowsCur = DB.listProjectProfits(R.cur, filter), cur = totals(rowsCur);
    var prev = R.prev ? totals(DB.listProjectProfits(R.prev, filter)) : null;
    var series = DB.monthlySeries(R.months, filter);
    var allRows = DB.listProjectProfits(null, filter);
    var recvTotal = allRows.reduce(function (a, r) { return a + r.receivable; }, 0);
    var summary = DB.dashboardSummary();
    var sup = DB.listSupplierAccounts(), supDue = sup.reduce(function (a, r) { return a + Math.max(r.due, 0); }, 0);
    var late = allRows.filter(function (r) { return ["new", "in_progress", "paused"].indexOf(r.status) >= 0 && r.expected_end && r.expected_end < DB.today(); }).length;
    var active = allRows.filter(function (r) { return r.status === "in_progress"; }).length;
    var cur$ = UI.icon;

    var filters = '<div class="filter-bar"><div class="seg">' + PERIODS.map(function (p) { return '<button data-p="' + p[0] + '" class="' + (st.period === p[0] ? "on" : "") + '">' + p[1] + "</button>"; }).join("") + "</div>" +
      '<div class="field"><label>المشروع</label><select id="fp">' + O(App.opts("projects"), st.project).replace("— اختر —", "كل المشاريع") + '</select></div>' +
      '<div class="field"><label>المهندس</label><select id="fe">' + O(App.opts("engineers"), st.eng).replace("— اختر —", "كل المهندسين") + "</select></div>" +
      '<div style="margin-inline-start:auto;color:var(--muted);font-size:12.5px">' + UI.fmtDate(DB.today(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + "</div></div>";

    var kpis = '<div class="cards-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px">' +
      kpi({ label: "صافي الربح", icon: "profits", value: M(cur.net), unit: "ج.م", cls: cur.net < 0 ? "c-red" : "c-green", meta: delta(cur.net, prev && prev.net) + (prev ? ' <span>عن الفترة السابقة</span>' : "<span>كل الفترات</span>"), spark: series.map(function (s) { return s.net; }) }) +
      kpi({ label: "الإيرادات", icon: "invoices", value: M(cur.revenue), unit: "ج.م", meta: delta(cur.revenue, prev && prev.revenue) + "<span>فواتير المشاريع</span>", spark: series.map(function (s) { return s.revenue; }) }) +
      kpi({ label: "إجمالي التكلفة", icon: "expenses", value: M(cur.cost), unit: "ج.م", cls: "c-amber", meta: delta(cur.cost, prev && prev.cost, false) + "<span>خامات + عمالة + نقل + تشوين + مصروفات</span>", spark: series.map(function (s) { return s.cost; }) }) +
      kpi({ label: "هامش الربح", icon: "profits", value: (cur.margin * 100).toFixed(1) + "%", cls: cur.margin < 0.1 ? "c-red" : "c-green", meta: prev ? delta(cur.margin, prev.margin) + "<span>مقارنة بالفترة السابقة</span>" : "" }) +
      kpi({ label: "المحصّل من العملاء", icon: "receipts", value: M(cur.received), unit: "ج.م", cls: "c-green", meta: delta(cur.received, prev && prev.received) + "<span>خلال الفترة</span>", spark: series.map(function (s) { return s.received; }) }) +
      kpi({ label: "مستحقات العملاء", icon: "payments", value: M(recvTotal), unit: "ج.م", cls: recvTotal > 0 ? "c-amber" : "c-green", meta: "<span>إجمالي المتبقي على المشاريع</span>" }) +
      kpi({ label: "الرصيد النقدي", icon: "cashboxes", value: M(summary.cash), unit: "ج.م", cls: summary.cash < 0 ? "c-red" : "c-green", meta: "<span>" + DB.list("cashboxes").length + " خزينة</span>" }) +
      kpi({ label: "قيمة المخزون", icon: "stock", value: M(summary.stock_value), unit: "ج.م", cls: "c-gray", meta: summary.low_stock_alerts ? '<span style="color:var(--error)">' + summary.low_stock_alerts + " صنف منخفض</span>" : "<span>كل الأرصدة سليمة</span>" }) +
      kpi({ label: "مستحق للموردين", icon: "suppliers", value: M(supDue), unit: "ج.م", cls: supDue > 0 ? "c-amber" : "c-green", meta: "<span>" + sup.filter(function (s) { return s.due > 0.5; }).length + " مورد</span>" }) +
      kpi({ label: "المشاريع", icon: "projects", value: active, unit: "جاري التنفيذ", cls: late ? "c-red" : "", meta: late ? '<span style="color:var(--error)">' + late + " متأخر عن التسليم</span>" : "<span>لا تأخير</span>" }) + "</div>";

    var statusCount = {}; DB.list("projects").forEach(function (p) { if ((!st.project || p.id === st.project) && (!st.eng || p.engineer_id === st.eng)) statusCount[p.status] = (statusCount[p.status] || 0) + 1; });
    var STC = { new: "#7b88a8", in_progress: "#2a49d6", paused: "#f2a516", completed: "#2b6cd9", delivered: "#12b886", closed: "#98a3bd" };

    var quick = [["purchases", "فاتورة مشتريات"], ["stock", "حركة مخزون"], ["receipts", "مقبوضات"], ["project-expenses", "مصروف"], ["labor", "عمالة"], ["projects", "مشاريع"]];
    page.innerHTML = filters + kpis +
      '<div class="grid-2"><div class="card chart-card"><h3>الإيرادات والتكلفة والربح شهرياً</h3><div id="c-bars"></div></div><div class="card chart-card"><h3>التدفق النقدي (داخل / خارج)</h3><div id="c-flow"></div></div></div>' +
      '<div class="grid-3"><div class="card chart-card"><h3>توزيع التكلفة</h3><div id="c-cost"></div></div><div class="card chart-card"><h3>حالات المشاريع</h3><div id="c-status"></div></div><div class="card chart-card"><h3>أرصدة الخزائن</h3><div id="c-cash"></div></div></div>' +
      '<div class="grid-3"><div class="card chart-card"><h3>أعلى المشاريع ربحاً</h3><div id="c-top"></div></div><div class="card chart-card"><h3>مستحقات العملاء حسب المشروع</h3><div id="c-recv"></div></div><div class="card chart-card"><h3>ترتيب المهندسين (صافي الربح)</h3><div id="c-eng"></div></div></div>' +
      '<div class="grid-3"><div class="card chart-card"><h3>أعلى مستحقات الموردين</h3><div id="c-sup"></div></div><div class="card chart-card"><h3>تنبيهات تحتاج انتباهك</h3><div id="c-alerts" class="alert-list"></div></div><div class="card chart-card"><h3>آخر العمليات</h3><div id="c-act" class="act-list"></div></div></div>' +
      '<div class="card chart-card" style="margin-top:16px"><h3>إجراءات سريعة</h3><div class="quick-grid">' + quick.map(function (q) { return '<a href="' + q[0] + '.html">' + (UI.icon[{ "purchases": "purchases", "stock": "stock", "receipts": "receipts", "project-expenses": "expenses", "labor": "labor", "projects": "projects" }[q[0]]] || "") + "<span>" + q[1] + "</span></a>"; }).join("") + "</div></div>";

    var $ = function (s) { return page.querySelector(s); };
    var labels = series.map(function (s) { return s.label; });
    Charts.bars($("#c-bars"), { labels: labels, series: [{ name: "الإيراد", color: "#2a49d6", values: series.map(function (s) { return s.revenue; }) }, { name: "التكلفة", color: "#f2a516", values: series.map(function (s) { return s.cost; }) }, { name: "الربح", color: "#2b6cd9", values: series.map(function (s) { return s.net; }) }] });
    Charts.line($("#c-flow"), { labels: labels, series: [{ name: "داخل", color: "#12b886", values: series.map(function (s) { return s.cash_in; }) }, { name: "خارج", color: "#d92d3f", values: series.map(function (s) { return s.cash_out; }) }] });
    Charts.donut($("#c-cost"), [{ label: "خامات", value: cur.materials, color: "#2a49d6" }, { label: "عمالة", value: cur.labor, color: "#f2a516" }, { label: "نقل", value: cur.transport, color: "#2b6cd9" }, { label: "تشوين", value: cur.storage, color: "#8a5cf6" }, { label: "أخرى", value: cur.other, color: "#e0559b" }], { top: Charts.short(cur.cost), sub: "التكلفة" });
    Charts.donut($("#c-status"), Object.keys(statusCount).map(function (k) { return { label: App.STATUS_AR[k] || k, value: statusCount[k], color: STC[k] }; }), { top: String(Object.keys(statusCount).reduce(function (a, k) { return a + statusCount[k]; }, 0)), sub: "مشروع" });
    var boxes = DB.list("cashboxes").map(function (c) { return { label: c.name, value: DB.calcCashboxBalance(c.id), color: "#2a49d6" }; });
    Charts.hbars($("#c-cash"), boxes, { fmt: M, keepZero: true });
    Charts.hbars($("#c-top"), rowsCur.slice().sort(function (a, b) { return b.net - a.net; }).slice(0, 6).map(function (r) { return { label: r.project_name, value: r.net, sub: "هامش " + UI.pct(r.margin) }; }), { fmt: M });
    Charts.hbars($("#c-recv"), allRows.filter(function (r) { return r.receivable > 0.5; }).sort(function (a, b) { return b.receivable - a.receivable; }).slice(0, 6).map(function (r) { return { label: r.project_name, value: r.receivable, color: "#f2a516", sub: "محصّل " + M(r.received) + " من " + M(r.revenue) }; }), { fmt: M });
    var engs = DB.listEngineerProfits(R.cur).filter(function (e) { return (!st.eng || e.engineer_id === st.eng) && e.projects; });
    Charts.hbars($("#c-eng"), engs.sort(function (a, b) { return b.net - a.net; }).slice(0, 6).map(function (e) { return { label: e.engineer_name, value: e.net, color: "#2b6cd9", sub: e.projects + " مشروع · هامش " + UI.pct(e.margin) }; }), { fmt: M });
    Charts.hbars($("#c-sup"), sup.filter(function (s) { return s.due > 0.5; }).sort(function (a, b) { return b.due - a.due; }).slice(0, 5).map(function (s) { return { label: s.supplier_name, value: s.due, color: "#d92d3f" }; }), { fmt: M });

    var alerts = DB.dashboardAlerts().slice(0, 12);
    $("#c-alerts").innerHTML = alerts.length ? alerts.map(function (a) { return '<a class="alert-i ' + a.level + '" href="' + a.link + '.html"><div><b>' + esc(a.title) + "</b><small>" + esc(a.text) + "</small></div></a>"; }).join("") : '<div class="empty compact">لا توجد تنبيهات — كل شيء على ما يرام ✓</div>';
    var act = DB.recentActivity(9);
    $("#c-act").innerHTML = act.length ? act.map(function (a) { return '<a class="act-row" href="' + a.link + '.html"><div class="a-l"><b>' + esc(a.label) + "</b><small>" + esc(a.text) + " · " + UI.fmtDate(a.date) + '</small></div><b class="num ' + (a.kind === "in" ? "pos-t" : "neg-t") + '">' + (a.kind === "in" ? "+" : "-") + M(a.amount) + "</b></a>"; }).join("") : '<div class="empty compact">لا توجد عمليات بعد</div>';

    page.querySelectorAll("[data-p]").forEach(function (b) { b.addEventListener("click", function () { st.period = b.getAttribute("data-p"); render(); }); });
    $("#fp").addEventListener("change", function (e) { st.project = e.target.value; render(); });
    $("#fe").addEventListener("change", function (e) { st.eng = e.target.value; render(); });
  }
  render();
})();
