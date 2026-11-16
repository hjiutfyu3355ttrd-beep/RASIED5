// لوحة التحكم — أنماط Procore / CoConstruct / SAP Fiori
// أولوية: صحة المشاريع → استثناءات → اتجاه مالي → تشغيل
(function () {
  "use strict";
  var page = document.getElementById("page"), esc = UI.esc, M = UI.money, O = App.optionsHtml;
  var PERIODS = [["month", "هذا الشهر", 1], ["q", "3 شهور", 3], ["h", "6 شهور", 6], ["y", "12 شهر", 12], ["all", "الكل", 0]];
  var PERSIST_KEY = "project_dash_prefs";
  var st = { period: "y", project: "", eng: "" };
  try {
    var saved = JSON.parse(localStorage.getItem(PERSIST_KEY) || "{}");
    if (saved.period) st.period = saved.period;
  } catch (e) {}

  function persist() {
    try { localStorage.setItem(PERSIST_KEY, JSON.stringify({ period: st.period })); } catch (e) {}
  }
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
  function statusPill(kind, text) {
    return '<span class="status-pill ' + kind + '">' + esc(text) + "</span>";
  }
  function kpi(cfg) {
    var href = cfg.href ? ' data-href="' + cfg.href + '" role="link" tabindex="0"' : "";
    return '<div class="kpi-card ' + (cfg.cls || "") + (cfg.spark ? "" : " no-spark") + (cfg.href ? " kpi-click" : "") + '"' + href + ">" +
      '<div class="kpi-top"><div class="kl"><span class="kpi-ic">' + (UI.icon[cfg.icon] || "") + "</span>" + esc(cfg.label) + "</div>" +
      (cfg.pill || cfg.delta || "") + "</div>" +
      '<div class="kv"><span class="num">' + cfg.value + "</span><small>" + esc(cfg.unit || "ج.م") + "</small></div>" +
      '<div class="kmeta">' + (cfg.meta || "") + "</div>" +
      (cfg.spark ? Charts.spark(cfg.spark) : "") + "</div>";
  }
  function progressRow(cfg) {
    var pct = Math.max(0, Math.min(100, cfg.pct || 0));
    var barCls = pct >= 80 ? "ok" : pct >= 40 ? "mid" : "low";
    return '<a class="prog-row" href="' + (cfg.href || "projects.html") + '">' +
      '<div class="prog-top"><span class="prog-name">' + esc(cfg.name) + "</span>" +
      '<span class="prog-val num">' + (cfg.value || Math.round(pct) + "%") + "</span></div>" +
      '<div class="prog-track"><i class="' + barCls + '" style="width:' + pct + '%"></i></div>' +
      (cfg.sub ? '<div class="prog-sub">' + cfg.sub + "</div>" : "") +
    "</a>";
  }
  function deadlineRow(cfg) {
    return '<a class="deadline-row ' + (cfg.cls || "") + '" href="' + (cfg.href || "projects.html") + '">' +
      '<div><b>' + esc(cfg.title) + "</b><small>" + esc(cfg.sub || "") + "</small></div>" +
      '<span class="deadline-tag">' + esc(cfg.tag) + "</span></a>";
  }
  function greet() {
    var h = new Date().getHours();
    return h < 12 ? "صباح الخير" : h < 18 ? "مساء الخير" : "مساء النور";
  }
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    return Math.round((new Date(dateStr) - new Date(DB.today())) / 86400000);
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
    var lateRows = allRows.filter(function (r) {
      return ["new", "in_progress", "paused"].indexOf(r.status) >= 0 && r.expected_end && r.expected_end < DB.today();
    });
    var activeRows = allRows.filter(function (r) { return r.status === "in_progress"; });
    var doneRows = allRows.filter(function (r) { return r.status === "completed" || r.status === "delivered" || r.status === "closed"; });
    var late = lateRows.length, active = activeRows.length, done = doneRows.length;
    var company = (DB.getCompany && DB.getCompany()) || {};
    var todayStr = new Date().toLocaleDateString("ar-EG-u-nu-latn", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });

    var serRev = series.map(function (s) { return { label: s.label, value: s.revenue || 0, t: s.key }; });
    var serCost = series.map(function (s) { return { label: s.label, value: s.cost || 0, t: s.key }; });
    var best = serRev.slice().sort(function (a, b) { return b.value - a.value; })[0] || { value: 0, label: "—" };
    var netPeriod = cur.revenue - cur.cost;
    var collectPct = cur.revenue > 0 ? (cur.received / cur.revenue) * 100 : 0;
    var healthKind = late > 0 ? "risk" : (cur.margin < 0.1 && cur.revenue > 0 ? "warn" : "ok");
    var healthText = late > 0 ? late + " متأخر" : (cur.margin < 0.1 && cur.revenue > 0 ? "هامش منخفض" : "على المسار");

    // مواعيد قادمة (14 يوم) + متأخر
    var upcoming = allRows.filter(function (r) {
      if (["completed", "delivered", "closed"].indexOf(r.status) >= 0) return false;
      var d = daysUntil(r.expected_end);
      return d != null && d >= 0 && d <= 14;
    }).sort(function (a, b) { return (a.expected_end || "").localeCompare(b.expected_end || ""); }).slice(0, 6);

    // أداء المشاريع: نسبة التحصيل
    var perf = allRows.filter(function (r) { return r.revenue > 0; })
      .map(function (r) {
        var pct = r.revenue > 0 ? (r.received / r.revenue) * 100 : 0;
        return {
          name: r.project_name,
          pct: pct,
          value: Math.round(pct) + "%",
          sub: "محصّل " + M(r.received) + " من " + M(r.revenue) + (r.receivable > 0.5 ? " · متبقي " + M(r.receivable) : ""),
          href: "projects.html"
        };
      })
      .sort(function (a, b) { return a.pct - b.pct; })
      .slice(0, 6);

    // —— رأس (Procore-style greeting + live)
    var head =
      '<div class="dash-head">' +
        "<div>" +
          '<h2><span class="live-dot"></span>' + greet() + "، " + esc(company.name || "مرحباً") + "</h2>" +
          "<p>" + todayStr +
            " · " + statusPill(healthKind, healthText) +
            (active ? " · " + active + " قيد التنفيذ" : "") +
            (done ? " · " + done + " مكتمل" : "") +
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
      '<div class="filter-bar">' +
        '<div class="field"><label>المشروع</label><select id="fp">' +
          O(App.opts("projects"), st.project).replace("— اختر —", "كل المشاريع") +
        "</select></div>" +
        '<div class="field"><label>المهندس</label><select id="fe">' +
          O(App.opts("engineers"), st.eng).replace("— اختر —", "كل المهندسين") +
        "</select></div>" +
      "</div>";

    // شريط صحة المحفظة (Portfolio health — Procore executive strip)
    var health =
      '<div class="health-strip">' +
        '<div class="health-item"><span class="hi-label">نشط</span><span class="hi-val">' + active + '</span></div>' +
        '<div class="health-item"><span class="hi-label">مكتمل</span><span class="hi-val ok">' + done + '</span></div>' +
        '<div class="health-item"><span class="hi-label">متأخر</span><span class="hi-val ' + (late ? "err" : "") + '">' + late + '</span></div>' +
        '<div class="health-item"><span class="hi-label">تحصيل الفترة</span><span class="hi-val">' + collectPct.toFixed(0) + '%</span>' +
          '<div class="prog-track mini-track"><i class="' + (collectPct >= 80 ? "ok" : collectPct >= 40 ? "mid" : "low") + '" style="width:' + Math.min(100, collectPct) + '%"></i></div></div>' +
        '<div class="health-item"><span class="hi-label">مستحقات عملاء</span><span class="hi-val ' + (recvTotal > 0 ? "warn" : "") + '">' + M(recvTotal) + '</span></div>' +
        '<div class="health-item"><span class="hi-label">مستحقات موردين</span><span class="hi-val ' + (supDue > 0 ? "err" : "") + '">' + M(supDue) + '</span></div>' +
      "</div>";

    // KPI مالية مع حالة (On Track / Risk) مثل ConstructOS
    var marginPill = cur.revenue <= 0 ? "" :
      (cur.margin >= 0.15 ? statusPill("ok", "ممتاز") :
       cur.margin >= 0.1 ? statusPill("ok", "على المسار") :
       cur.margin >= 0 ? statusPill("warn", "ضعيف") : statusPill("risk", "خسارة"));

    var kpis = '<div class="stats">' +
      kpi({
        label: "صافي الربح", icon: "profits", value: M(cur.net),
        cls: cur.net < 0 ? "c-red" : "c-green",
        delta: deltaBadge(cur.net, prev && prev.net, true),
        pill: marginPill,
        meta: prev ? "مقارنة بالفترة السابقة" : "كل الفترات",
        spark: series.map(function (s) { return s.net; }),
        href: "profits.html"
      }) +
      kpi({
        label: "الإيرادات", icon: "invoices", value: M(cur.revenue),
        delta: deltaBadge(cur.revenue, prev && prev.revenue, true),
        meta: rowsCur.length + " مشروع في الفترة",
        spark: series.map(function (s) { return s.revenue; }),
        href: "project-invoices.html"
      }) +
      kpi({
        label: "إجمالي التكلفة", icon: "expenses", value: M(cur.cost),
        cls: "c-amber",
        delta: deltaBadge(cur.cost, prev && prev.cost, false),
        meta: "خامات + عمالة + نقل + تشوين + أخرى",
        spark: series.map(function (s) { return s.cost; }),
        href: "project-expenses.html"
      }) +
      kpi({
        label: "هامش الربح", icon: "profits",
        value: (cur.margin * 100).toFixed(1) + "%", unit: "",
        cls: cur.margin < 0.1 ? "c-red" : "c-green",
        delta: prev ? deltaBadge(cur.margin, prev.margin, true) : "",
        meta: "صافي ÷ إيراد · عتبة صحية 10٪+",
        spark: series.map(function (s) { return s.revenue > 0 ? (s.net / s.revenue) * 100 : 0; }),
        href: "profits.html"
      }) +
    "</div>";

    // المخطط الرئيسي + الدونات
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
            "<div><span>متوسط الإيراد الشهري</span><b>" + M(series.length ? Math.round(cur.revenue / Math.max(series.length, 1)) : 0) + "</b><small>خلال " + series.length + " شهراً</small></div>" +
            "<div><span>هامش الفترة</span><b>" + (cur.margin * 100).toFixed(1) + "%</b><small>صافي " + M(cur.net) + "</small></div>" +
          "</div>" +
        "</div>" +
        '<div class="card">' +
          '<div class="panel-title"><div><h3>توزيع التكلفة</h3><div class="panel-sub">خامات · عمالة · نقل · تشوين · أخرى</div></div></div>' +
          '<div id="c-cost"></div>' +
        "</div>" +
      "</div>";

    // تشغيل: أداء مشاريع + مواعيد + تنبيهات (CoConstruct operations)
    var ops =
      '<div class="dash-grid ops-grid" style="margin-top:16px">' +
        '<div class="card">' +
          '<div class="panel-title"><div><h3>أداء التحصيل حسب المشروع</h3><div class="panel-sub">الأضعف أولاً — اضغط للفتح</div></div>' +
          '<a href="projects.html" class="tag">كل المشاريع</a></div>' +
          '<div class="prog-list">' +
            (perf.length ? perf.map(progressRow).join("") : '<div class="empty compact">لا بيانات تحصيل بعد</div>') +
          "</div>" +
        "</div>" +
        '<div class="card">' +
          '<div class="panel-title"><div><h3>المواعيد الحرجة</h3><div class="panel-sub">خلال 14 يوماً + المتأخر</div></div></div>' +
          '<div class="deadline-list">' +
            lateRows.slice(0, 4).map(function (r) {
              var d = daysUntil(r.expected_end);
              return deadlineRow({
                title: r.project_name,
                sub: "كان متوقعاً " + UI.fmtDate(r.expected_end),
                tag: "متأخر " + Math.abs(d || 0) + "ي",
                cls: "overdue",
                href: "projects.html"
              });
            }).join("") +
            upcoming.map(function (r) {
              var d = daysUntil(r.expected_end);
              return deadlineRow({
                title: r.project_name,
                sub: UI.fmtDate(r.expected_end),
                tag: d === 0 ? "اليوم" : "بعد " + d + "ي",
                cls: d <= 3 ? "soon" : "",
                href: "projects.html"
              });
            }).join("") +
            (!lateRows.length && !upcoming.length ? '<div class="empty compact">لا مواعيد حرجة — الجدول مستقر ✓</div>' : "") +
          "</div>" +
        "</div>" +
      "</div>";

    var secondary =
      '<div class="dash-grid even" style="margin-top:16px">' +
        '<div class="card chart-card"><h3>حالات المشاريع</h3><div id="c-status"></div></div>' +
        '<div class="card chart-card"><h3>أرصدة الخزائن</h3><div id="c-cash"></div></div>' +
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

    page.innerHTML = '<div class="stack">' + head + filters + health + kpis + mainCharts + ops + secondary + quickHtml + "</div>";

    var $ = function (s) { return page.querySelector(s); };

    Charts.area($("#c-area"), serRev, serCost, {
      nameA: "الإيراد", nameB: "التكلفة", fmt: M, id: "dash-area"
    });

    Charts.donut($("#c-cost"), [
      { label: "خامات", value: cur.materials, color: "var(--chart-materials)" },
      { label: "عمالة", value: cur.labor, color: "var(--chart-labor)" },
      { label: "نقل", value: cur.transport, color: "var(--chart-transport)" },
      { label: "تشوين", value: cur.storage, color: "var(--chart-storage)" },
      { label: "أخرى", value: cur.other, color: "var(--chart-other)" }
    ], { top: Charts.short(cur.cost), sub: "التكلفة" });

    var STC = {
      new: "var(--chart-8)", in_progress: "var(--chart-1)", paused: "var(--chart-4)",
      completed: "var(--chart-5)", delivered: "var(--chart-3)", closed: "var(--chart-2)"
    };
    var statusCount = {};
    allRows.forEach(function (r) { statusCount[r.status] = (statusCount[r.status] || 0) + 1; });
    Charts.donut($("#c-status"),
      Object.keys(statusCount).map(function (k) {
        return { label: (App.STATUS_AR && App.STATUS_AR[k]) || k, value: statusCount[k], color: STC[k] || "var(--chart-8)" };
      }),
      { top: String(allRows.length), sub: "مشروع" }
    );

    var boxes = DB.list("cashboxes").map(function (c) {
      return { label: c.name, value: DB.calcCashboxBalance(c.id), color: "var(--chart-cash)" };
    });
    Charts.hbars($("#c-cash"), boxes, { fmt: M, keepZero: true });

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

    // KPI click-through
    page.querySelectorAll(".kpi-click").forEach(function (el) {
      el.addEventListener("click", function () {
        var h = el.getAttribute("data-href");
        if (h) location.href = h;
      });
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          var h = el.getAttribute("data-href");
          if (h) location.href = h;
        }
      });
    });

    page.querySelectorAll("[data-p]").forEach(function (b) {
      b.addEventListener("click", function () {
        st.period = b.getAttribute("data-p");
        persist();
        render();
      });
    });
    $("#fp").addEventListener("change", function (e) { st.project = e.target.value; render(); });
    $("#fe").addEventListener("change", function (e) { st.eng = e.target.value; render(); });
  }

  render();
})();
