// ربحية المشاريع والمهندسين
(function () {
  "use strict";
  var page = document.getElementById("page"), esc = UI.esc, M = UI.money, O = App.optionsHtml;
  var st = { tab: "projects", from: "", to: "", eng: "", status: "" };

  function render() {
    var range = { from: st.from, to: st.to };
    var rows = DB.listProjectProfits(range, { engineer_id: st.eng }).filter(function (r) { return !st.status || r.status === st.status; });
    var sum = function (k) { return rows.reduce(function (a, r) { return a + r[k]; }, 0); };
    var rev = sum("revenue"), cost = sum("total_cost"), net = rev - cost;
    var statuses = Object.keys(App.STATUS_AR).map(function (k) { return [k, App.STATUS_AR[k]]; });
    var kp = function (l, v, c) { return '<div class="card stat ' + (c || "") + '"><div class="label">' + l + '</div><div class="value">' + v + "</div></div>"; };

    var html = '<div class="filter-bar"><div class="field"><label>من تاريخ</label><input type="date" id="from" value="' + st.from + '"/></div><div class="field"><label>إلى تاريخ</label><input type="date" id="to" value="' + st.to + '"/></div>' +
      '<div class="field"><label>المهندس</label><select id="eng">' + O(App.opts("engineers"), st.eng).replace("— اختر —", "الكل") + '</select></div><div class="field"><label>حالة المشروع</label><select id="status">' + O(statuses, st.status).replace("— اختر —", "الكل") + "</select></div>" +
      '<div style="margin-inline-start:auto"><button id="xl">' + UI.icon.download + "<span>تصدير</span></button></div></div>" +
      '<div class="stats" style="margin-bottom:16px">' + kp("إجمالي الإيرادات", UI.moneyC(rev), "green") + kp("إجمالي التكلفة", UI.moneyC(cost), "amber") + kp("صافي الربح", UI.moneyC(net), net < 0 ? "red" : "green") +
      kp("هامش الربح", UI.pct(rev > 0 ? net / rev : 0)) + kp("المقبوضات", UI.moneyC(sum("received"))) + kp("المتبقي على العملاء", UI.moneyC(sum("receivable")), sum("receivable") > 0 ? "amber" : "green") + "</div>" +
      '<div class="tabs"><div class="seg"><button data-tab="projects" class="' + (st.tab === "projects" ? "on" : "") + '">ربحية المشاريع</button><button data-tab="engineers" class="' + (st.tab === "engineers" ? "on" : "") + '">ربحية المهندسين</button></div></div>';

    var exportFn;
    if (st.tab === "projects") {
      html += '<div class="card table-card"><div class="table-wrap"><table class="table"><thead><tr><th>الكود</th><th>المشروع</th><th>المهندس</th><th class="num">الإيراد</th><th class="num">خامات</th><th class="num">عمالة</th><th class="num">نقل</th><th class="num">تشوين</th><th class="num">أخرى</th><th class="num">التكلفة</th><th class="num">صافي الربح</th><th class="num">الهامش</th><th class="num">المحصّل</th><th class="num">المتبقي</th><th>الحالة</th><th></th></tr></thead><tbody>' +
        (rows.map(function (r) {
          return "<tr><td>" + esc(r.project_code) + "</td><td>" + esc(r.project_name) + "</td><td>" + esc(r.engineer_name) + '</td><td class="num">' + M(r.revenue) + '</td><td class="num">' + M(r.materials) + '</td><td class="num">' + M(r.labor) + '</td><td class="num">' + M(r.transport) + '</td><td class="num">' + M(r.storage) + '</td><td class="num">' + M(r.other) +
            '</td><td class="num">' + M(r.total_cost) + '</td><td class="num"><b class="' + (r.net < 0 ? "neg-t" : "pos-t") + '">' + M(r.net) + '</b></td><td class="num">' + UI.pct(r.margin) + '</td><td class="num">' + M(r.received) + '</td><td class="num">' + M(r.receivable) + '</td><td><span class="badge ' + (App.STATUS_CLS[r.status] || "") + '">' + esc(App.STATUS_AR[r.status] || r.status) + '</span></td><td><button class="ghost small" data-pd="' + esc(r.project_id) + '">تفاصيل</button></td></tr>';
        }).join("") || '<tr><td colspan="16" class="muted" style="text-align:center;padding:28px">لا توجد مشاريع</td></tr>') +
        (rows.length ? '<tr class="tfoot-row"><td colspan="3">الإجمالي</td>' + ["revenue", "materials", "labor", "transport", "storage", "other", "total_cost", "net"].map(function (k) { return '<td class="num">' + M(sum(k)) + "</td>"; }).join("") + '<td class="num">' + UI.pct(rev > 0 ? net / rev : 0) + '</td><td class="num">' + M(sum("received")) + '</td><td class="num">' + M(sum("receivable")) + "</td><td></td><td></td></tr>" : "") + "</tbody></table></div></div>";
      exportFn = function () { App.exportXlsx("ربحية المشاريع", "ربحية المشاريع", ["الكود", "المشروع", "المهندس", "الإيراد", "الخامات", "العمالة", "النقل", "التشوين", "أخرى", "التكلفة", "صافي الربح", "الهامش", "المحصّل", "المتبقي", "الحالة"], rows.map(function (r) { return [r.project_code, r.project_name, r.engineer_name, r.revenue, r.materials, r.labor, r.transport, r.storage, r.other, r.total_cost, r.net, Number((r.margin * 100).toFixed(1)), r.received, r.receivable, App.STATUS_AR[r.status] || r.status]; })); };
    } else {
      var eng = DB.listEngineerProfits(range).filter(function (e) { return !st.eng || e.engineer_id === st.eng; });
      html += '<div class="card table-card"><div class="table-wrap"><table class="table"><thead><tr><th>الكود</th><th>المهندس</th><th class="num">المشاريع</th><th class="num">الإيراد</th><th class="num">التكلفة</th><th class="num">صافي الربح</th><th class="num">الهامش</th><th class="num">المحصّل</th><th class="num">المتبقي</th></tr></thead><tbody>' +
        (eng.map(function (e) { return "<tr><td>" + esc(e.engineer_id) + "</td><td>" + esc(e.engineer_name) + '</td><td class="num">' + e.projects + '</td><td class="num">' + M(e.revenue) + '</td><td class="num">' + M(e.total_cost) + '</td><td class="num"><b class="' + (e.net < 0 ? "neg-t" : "pos-t") + '">' + M(e.net) + '</b></td><td class="num">' + UI.pct(e.margin) + '</td><td class="num">' + M(e.received) + '</td><td class="num">' + M(e.receivable) + "</td></tr>"; }).join("") || '<tr><td colspan="9" class="muted" style="text-align:center;padding:28px">لا يوجد مهندسون</td></tr>') + "</tbody></table></div></div>";
      exportFn = function () { App.exportXlsx("ربحية المهندسين", "ربحية المهندسين", ["الكود", "المهندس", "المشاريع", "الإيراد", "التكلفة", "صافي الربح", "الهامش", "المحصّل", "المتبقي"], eng.map(function (e) { return [e.engineer_id, e.engineer_name, e.projects, e.revenue, e.total_cost, e.net, Number((e.margin * 100).toFixed(1)), e.received, e.receivable]; })); };
    }
    page.innerHTML = html;
    var $ = function (s) { return page.querySelector(s); };
    [["from", "from"], ["to", "to"], ["eng", "eng"], ["status", "status"]].forEach(function (p) { $("#" + p[0]).addEventListener("change", function (e) { st[p[1]] = e.target.value; render(); }); });
    page.querySelectorAll("[data-tab]").forEach(function (b) { b.addEventListener("click", function () { st.tab = b.getAttribute("data-tab"); render(); }); });
    page.querySelectorAll("[data-pd]").forEach(function (b) { b.addEventListener("click", function () { App.showProjectDetails(b.getAttribute("data-pd")); }); });
    $("#xl").addEventListener("click", exportFn);
  }
  render();
})();
