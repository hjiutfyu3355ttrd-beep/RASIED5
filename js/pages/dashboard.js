// لوحة التحكم — تصميم مطابق لنظام رصيد (Ledger) مع بيانات المشاريع
(function () {
  "use strict";
  var page = document.getElementById("page"), esc = UI.esc, M = UI.money, O = App.optionsHtml;
  var PERIODS = [["month", "هذا الشهر", 1], ["q", "3 شهور", 3], ["h", "6 شهور", 6], ["y", "12 شهر", 12], ["all", "الكل", 0]];
  var st = { period: "y", project: "", eng: "" };

  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function ranges() {
    var p = PERIODS.filter(function (x) { return x[0] === st.period; })[0], n = p[2], now = new Date();
    if (!n) return { cur: null, prev: null, months: 12 };
    var from = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1);
    var prevFrom = new Date(from.getFullYear(), from.getMonth() - n, 1);
    var prevTo = new Date(from.getFullYear(), from.getMonth(), 0);
    return {
      cur: { from: iso(from), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) },
      prev: { from: iso(prevFrom), to: iso(prevTo) },
      months: Math.max(6, n)
    };
  }
  function totals(rows) {
    var s = function (k) { return rows.reduce(function (a, r) { return a + (Number(r[k]) || 0); }, 0); };
    var rev = s("revenue"), cost = s("total_cost");
    return {
      revenue: rev, cost: cost, net: rev - cost,
      margin: rev > 0 ? (rev - cost) / rev : 0,
      received: s("received"), materials: s("materials"), labor: s("labor"),
      transport: s("transport"), storage: s("storage"), other: s("other")
    };
  }
  function deltaBadge(cur, prev, goodUp) {
    if (prev == null || !isFinite(prev) || Math.abs(prev) < 0.01) return '<span class="delta flat">—</span>';
    var d = Math.round(((cur - prev) / Math.abs(prev)) * 100);
    if (d === 0) return '<span class="delta flat">0%</span>';
    var up = d > 0, good = goodUp === false ? !up : up;
    return '<span class="delta ' + (good ? "up" : "down") + '">' + (up ? "▲" : "▼") + " " + Math.abs(d) + "%</span>";
  }
  function kpi(cfg) {
    return '<div class="kpi-card ' + (cfg.cls || "") + (cfg.spark ? "" : " no-spark") + '">' +
      '<div class="kpi-top"><div class="kl"><span class="kpi-ic">' + (UI.icon[cfg.icon] || "") + "</span>" + esc(cfg.label) + "</div>" +
      (cfg.delta || "") + "</div>" +
      '<div class="kv"><span class="num">' + cfg.value + "</span><small>" + esc(cfg.unit || "ج.م") + "</small></div>" +
      '<div class="kmeta">' + (cfg.meta || "") + "</div>" +
      (cfg.spark ? Charts.spark(cfg.spark) : "") + "</div>";
  }
  function mini(cfg) {
    return '<div class="mini ' + (cfg.cls || "") + '"><span class="kpi-ic">' + (UI.icon[cfg.icon] || "") +
      '</span><div><div class="ml">' + esc(cfg.label) + '</div><div class="mv num">' + cfg.value + "</div>" +
      (cfg.meta ? '<div class="kmeta" style="font-size:11.5px;color:var(--muted);margin-top:2px">' + cfg.meta + "</div>" : "") +
      "</div></div>";
  }
  function greet() {
    var h = new Date().getHours();
    return h < 12 ? "صباح الخير" : h < 18 ? "مساء الخير" : "مساء النور";
  }

  function render() {
    var R = ranges(), filter = { project_id: st.project, engineer_id: st.eng };
    var rowsCur = DB.listProjectProfits(R.cur, filter), cur = totals(rowsCur);
    var prev = R.prev ? totals(DB.listProjectProfits(R.prev, filter)) : null;
    var series = DB.monthlySeries(R.months, filter);
    var allRows = DB.listProjectProfits(null, filter);
    var recvTotal = allRows.reduce(function (a, r) { return a + (r.receivable || 0); }, 0);
    var sup = DB.listSupplierAccounts();
    var supDue = sup.reduce(function (a, r) { return a + Math.max(r.due || 0, 0); }, 0);
    var late = allRows.filter(function (r) {
      return ["new", "in_progress", "paused"].indexOf(r.status) >= 0 && r.expected_end && r.expected_end < DB.today();
    }).length;
    var active = allRows.filter(function (r) { return r.status === "in_progress"; }).length;
    var company = (DB.getCompany && DB.getCompany()) || {};
    var todayStr = new Date().toLocaleDateString("ar-EG-u-nu-latn", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });

    // بيانات المخطط الرئيسي (إيراد vs تكلفة) بنفس أسلوب رصيد
    var serRev = series.map(function (s) { return { label: s.label, value: s.revenue || 0, t: s.key }; });
    var serCost = series.map(function (s) { return { label: s.label, value: s.cost || 0, t: s.key }; });
    var best = serRev.slice().sort(function (a, b) { return b.value - a.value; })[0] || { value: 0, label: "—" };
    var netPeriod = cur.revenue - cur.cost;

    // —— رأس (مطابق لرصيد)
    var head =
      '<div class="dash-head">' +
        "<div>" +
          '<h2><span class="live-dot"></span>' + greet() + "، " + esc(company.name || "مرحباً") + "</h2>" +
          "<p>" + todayStr +
            (late ? ' · <b style="color:var(--error)">' + late + " مشروع متأخر</b>" : " · كل المشاريع ضمن الجدول") +
            (active ? " · " + active + " قيد التنفيذ" : "") +
          "</p>" +
        "</div>" +
        '<div class="row gap wrap" style="align-items:center">' +
          '<div class="seg" role="tablist" aria-label="الفترة">' +
            PERIODS.map(function (p) {
              return '<button type="button" role="tab" data-p="' + p[0] + '" class="' + (st.period === p[0] ? "on" : "") + '">' + p[1] + "</button>";
            }).join("") +
          "</div>" +
          '<a href="project-invoices.html"><button class="primary" type="button">+ فاتورة مشروع</button></a>' +
          '<a href="purchases.html"><button type="button">+ مشتريات</button></a>' +
        "</div>" +
      "</div>";

    var filters =
      '<div class="filter-bar" style="margin-top:2px">' +
        '<div class="field"><label>المشروع</label><select id="fp">' +
          O(App.opts("projects"), st.project).replace("— اختر —", "كل المشاريع") +
        "</select></div>" +
        '<div class="field"><label>المهندس</label><select id="fe">' +
          O(App.opts("engineers"), st.eng).replace("— اختر —", "كل المهندسين") +
        "</select></div>" +
      "</div>";

    // KPI
    var kpis = '<div class="stats">' +
      kpi({
        label: "صافي الربح", icon: "profits", value: M(cur.net),
        cls: cur.net < 0 ? "c-red" : "c-green",
        delta: deltaBadge(cur.net, prev && prev.net, true),
        meta: prev ? "مقارنة بالفترة السابقة" : "كل الفترات",
        spark: series.map(function (s) { return s.net; })
      }) +
      kpi({
        label: "الإيرادات", icon: "invoices", value: M(cur.revenue),
        delta: deltaBadge(cur.revenue, prev && prev.revenue, true),
        meta: rowsCur.length + " مشروع في الفترة",
        spark: series.map(function (s) { return s.revenue; })
      }) +
      kpi({
        label: "إجمالي التكلفة", icon: "expenses", value: M(cur.cost),
        cls: "c-amber",
        delta: deltaBadge(cur.cost, prev && prev.cost, false),
        meta: "خامات + عمالة + نقل + تشوين + أخرى",
        spark: series.map(function (s) { return s.cost; })
      }) +
      kpi({
        label: "هامش الربح", icon: "profits",
        value: (cur.margin * 100).toFixed(1) + "%", unit: "",
        cls: cur.margin < 0.1 ? "c-red" : "c-green",
        delta: prev ? deltaBadge(cur.margin, prev.margin, true) : "",
        meta: "صافي ÷ إيراد",
        spark: series.map(function (s) { return s.revenue > 0 ? (s.net / s.revenue) * 100 : 0; })
      }) +
    "</div>";

    var minis = '<div class="mini-stats">' +
      mini({ label: "مستحقات العملاء", icon: "receipts", value: M(recvTotal), cls: recvTotal > 0 ? "c-amber" : "" }) +
      mini({ label: "مستحقات الموردين", icon: "suppliers", value: M(supDue), cls: supDue > 0 ? "c-red" : "" }) +
      mini({ label: "مشاريع نشطة", icon: "projects", value: String(active), meta: late ? late + " متأخر" : "ضمن الجدول" }) +
      mini({ label: "المحصّل", icon: "receipts", value: M(cur.received), cls: "c-green" }) +
    "</div>";

    // —— المخطط الرئيسي + الدونات (تخطيط رصيد dash-grid)
    var mainCharts =
      '<div class="dash-grid">' +
        '<div class="card">' +
          '<div class="panel-title">' +
            "<div><h3>الإيرادات مقابل التكلفة</h3>" +
            '<div class="panel-sub">آخر ' + series.length + " شهراً · الفرق " +
            '<b dir="ltr" style="color:' + (netPeriod >= 0 ? "var(--success)" : "var(--error)") + '">' +
            (netPeriod >= 0 ? "+" : "−") + M(Math.abs(netPeriod)) + "</b></div></div>" +
            '<div class="chart-legend">' +
              '<span><i style="background:var(--chart-1)"></i>إيراد <b>' + M(cur.revenue) + "</b></span>" +
              '<span><i style="background:var(--chart-2)"></i>تكلفة <b>' + M(cur.cost) + "</b></span>" +
            "</div>" +
          "</div>" +
          '<div id="c-area"></div>' +
          '<div class="chart-foot">' +
            "<div><span>أعلى شهر إيراداً</span><b>" + M(best.value) + "</b><small>" + esc(best.label || "—") + "</small></div>" +
            "<div><span>متوسط الإيراد الشهري</span><b>" + M(series.length ? Math.round(cur.revenue / series.length) : 0) + "</b><small>خلال " + series.length + " شهراً</small></div>" +
            "<div><span>هامش الفترة</span><b>" + (cur.margin * 100).toFixed(1) + "%</b><small>صافي " + M(cur.net) + "</small></div>" +
          "</div>" +
        "</div>" +
        '<div class="card">' +
          '<div class="panel-title"><div><h3>توزيع التكلفة</h3><div class="panel-sub">خامات · عمالة · نقل · تشوين · أخرى</div></div></div>' +
          '<div id="c-cost"></div>' +
        "</div>" +
      "</div>";

    // شبكة ثانوية
    var secondary =
      '<div class="dash-grid even" style="margin-top:16px">' +
        '<div class="card chart-card"><h3>حالات المشاريع</h3><div id="c-status"></div></div>' +
        '<div class="card chart-card"><h3>أرصدة الخزائن</h3><div id="c-cash"></div></div>' +
      "</div>" +
      '<div class="dash-grid even" style="margin-top:16px">' +
        '<div class="card chart-card"><h3>أعلى المشاريع ربحاً</h3><div id="c-top"></div></div>' +
        '<div class="card chart-card"><h3>مستحقات العملاء</h3><div id="c-recv"></div></div>' +
      "</div>" +
      '<div class="dash-grid even" style="margin-top:16px">' +
        '<div class="card chart-card"><h3>ترتيب المهندسين</h3><div id="c-eng"></div></div>' +
        '<div class="card chart-card"><h3>مستحقات الموردين</h3><div id="c-sup"></div></div>' +
      "</div>" +
      '<div class="dash-grid even" style="margin-top:16px">' +
        '<div class="card chart-card"><h3>تنبيهات تحتاج انتباهك</h3><div id="c-alerts" class="alert-list"></div></div>' +
        '<div class="card chart-card"><h3>آخر العمليات</h3><div id="c-act" class="act-list"></div></div>' +
      "</div>";

    var quick = [
      ["purchases", "فاتورة مشتريات", "purchases"],
      ["stock", "حركة مخزون", "stock"],
      ["receipts", "مقبوضات", "receipts"],
      ["project-expenses", "مصروف مشروع", "expenses"],
      ["labor", "عمالة", "labor"],
      ["projects", "المشاريع", "projects"]
    ];
    var quickHtml =
      '<div class="card" style="margin-top:16px"><div class="panel-title"><h3>إجراءات سريعة</h3></div>' +
      '<div class="quick-grid">' +
      quick.map(function (q) {
        return '<a href="' + q[0] + '.html">' + (UI.icon[q[2]] || "") + "<span>" + q[1] + "</span></a>";
      }).join("") +
      "</div></div>";

    page.innerHTML = '<div class="stack">' + head + filters + kpis + minis + mainCharts + secondary + quickHtml + "</div>";

    var $ = function (s) { return page.querySelector(s); };

    // مخطط المساحة الرئيسي (رصيد)
    Charts.area($("#c-area"), serRev, serCost);

    // دونات التكلفة
    Charts.donut($("#c-cost"), [
      { label: "خامات", value: cur.materials, color: "var(--chart-materials)" },
      { label: "عمالة", value: cur.labor, color: "var(--chart-labor)" },
      { label: "نقل", value: cur.transport, color: "var(--chart-transport)" },
      { label: "تشوين", value: cur.storage, color: "var(--chart-storage)" },
      { label: "أخرى", value: cur.other, color: "var(--chart-other)" }
    ], { top: Charts.short(cur.cost), sub: "التكلفة" });

    var STC = { new: "var(--chart-8)", in_progress: "var(--chart-1)", paused: "var(--chart-4)", completed: "var(--chart-5)", delivered: "var(--chart-3)", closed: "var(--chart-2)" };
    var statusCount = {};
    allRows.forEach(function (r) { statusCount[r.status] = (statusCount[r.status] || 0) + 1; });
    Charts.donut($("#c-status"),
      Object.keys(statusCount).map(function (k) {
        return { label: (App.STATUS_AR && App.STATUS_AR[k]) || k, value: statusCount[k], color: STC[k] || "var(--chart-8)" };
      }),
      { top: String(Object.keys(statusCount).reduce(function (a, k) { return a + statusCount[k]; }, 0)), sub: "مشروع" }
    );

    var boxes = DB.list("cashboxes").map(function (c) {
      return { label: c.name, value: DB.calcCashboxBalance(c.id), color: "var(--chart-cash)" };
    });
    Charts.hbars($("#c-cash"), boxes, { fmt: M, keepZero: true });
    Charts.hbars($("#c-top"),
      rowsCur.slice().sort(function (a, b) { return b.net - a.net; }).slice(0, 6)
        .map(function (r) { return { label: r.project_name, value: r.net, sub: "هامش " + UI.pct(r.margin) }; }),
      { fmt: M }
    );
    Charts.hbars($("#c-recv"),
      allRows.filter(function (r) { return r.receivable > 0.5; })
        .sort(function (a, b) { return b.receivable - a.receivable; }).slice(0, 6)
        .map(function (r) {
          return { label: r.project_name, value: r.receivable, color: "var(--chart-recv)", sub: "محصّل " + M(r.received) + " من " + M(r.revenue) };
        }),
      { fmt: M }
    );
    var engs = DB.listEngineerProfits(R.cur).filter(function (e) {
      return (!st.eng || e.engineer_id === st.eng) && e.projects;
    });
    Charts.hbars($("#c-eng"),
      engs.sort(function (a, b) { return b.net - a.net; }).slice(0, 6)
        .map(function (e) {
          return { label: e.engineer_name, value: e.net, color: "var(--chart-3)", sub: e.projects + " مشروع · هامش " + UI.pct(e.margin) };
        }),
      { fmt: M }
    );
    Charts.hbars($("#c-sup"),
      sup.filter(function (s) { return s.due > 0.5; })
        .sort(function (a, b) { return b.due - a.due; }).slice(0, 5)
        .map(function (s) { return { label: s.supplier_name, value: s.due, color: "var(--chart-sup)" }; }),
      { fmt: M }
    );

    var alerts = DB.dashboardAlerts().slice(0, 12);
    $("#c-alerts").innerHTML = alerts.length
      ? alerts.map(function (a) {
          return '<a class="alert-i ' + a.level + '" href="' + a.link + '.html"><div><b>' + esc(a.title) + "</b><small>" + esc(a.text) + "</small></div></a>";
        }).join("")
      : '<div class="empty compact">لا توجد تنبيهات — كل شيء على ما يرام ✓</div>';

    var act = DB.recentActivity(9);
    $("#c-act").innerHTML = act.length
      ? act.map(function (a) {
          return '<a class="act-row" href="' + a.link + '.html"><div class="a-l"><b>' + esc(a.label) + "</b><small>" +
            esc(a.text) + " · " + UI.fmtDate(a.date) + '</small></div><b class="num ' +
            (a.kind === "in" ? "pos-t" : "neg-t") + '">' + (a.kind === "in" ? "+" : "-") + M(a.amount) + "</b></a>";
        }).join("")
      : '<div class="empty compact">لا توجد عمليات بعد</div>';

    page.querySelectorAll("[data-p]").forEach(function (b) {
      b.addEventListener("click", function () { st.period = b.getAttribute("data-p"); render(); });
    });
    $("#fp").addEventListener("change", function (e) { st.project = e.target.value; render(); });
    $("#fe").addEventListener("change", function (e) { st.eng = e.target.value; render(); });
  }

  render();
})();
