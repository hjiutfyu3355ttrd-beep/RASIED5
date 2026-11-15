// ربحية المشاريع
(function () {
  "use strict";
  var page = document.getElementById("page");
  if (!page) return;

  var rows = DB.listProjectProfits();
  var totalRev = rows.reduce(function (s, r) { return s + r.revenue; }, 0);
  var totalCost = rows.reduce(function (s, r) { return s + r.total_cost; }, 0);
  var totalNet = rows.reduce(function (s, r) { return s + r.net; }, 0);
  var totalRecv = rows.reduce(function (s, r) { return s + r.received; }, 0);
  var totalDue = rows.reduce(function (s, r) { return s + r.receivable; }, 0);

  page.innerHTML = UI.html`
    <div class="stats">
      <div class="card stat"><div class="label">إجمالي الإيرادات</div><div class="value">${UI.moneyC(totalRev)}</div></div>
      <div class="card stat"><div class="label">إجمالي التكلفة</div><div class="value">${UI.moneyC(totalCost)}</div></div>
      <div class="card stat"><div class="label">صافي الربح</div><div class="value">${UI.moneyC(totalNet)}</div></div>
      <div class="card stat"><div class="label">المتبقي على العملاء</div><div class="value">${UI.moneyC(totalDue)}</div></div>
    </div>

    <div class="card" style="margin-top:1.25rem">
      <div class="card-head"><h3>تفاصيل ربحية المشاريع</h3></div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>كود</th>
              <th>المشروع</th>
              <th>المهندس</th>
              <th class="num">الإيراد</th>
              <th class="num">خامات</th>
              <th class="num">عمالة</th>
              <th class="num">نقل</th>
              <th class="num">تشوين</th>
              <th class="num">أخرى</th>
              <th class="num">إجمالي التكلفة</th>
              <th class="num">صافي الربح</th>
              <th class="num">الهامش</th>
              <th class="num">محصّل</th>
              <th class="num">متبقي</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(function (p) {
              return UI.html`<tr>
                <td>${p.project_code}</td>
                <td>${p.project_name}</td>
                <td>${p.engineer_name}</td>
                <td class="num">${UI.money(p.revenue)}</td>
                <td class="num">${UI.money(p.materials)}</td>
                <td class="num">${UI.money(p.labor)}</td>
                <td class="num">${UI.money(p.transport)}</td>
                <td class="num">${UI.money(p.storage)}</td>
                <td class="num">${UI.money(p.other)}</td>
                <td class="num">${UI.money(p.total_cost)}</td>
                <td class="num">${UI.money(p.net)}</td>
                <td class="num">${UI.pct(p.margin)}</td>
                <td class="num">${UI.money(p.received)}</td>
                <td class="num">${UI.money(p.receivable)}</td>
              </tr>`;
            }).join("") || '<tr><td colspan="14" class="muted">لا توجد بيانات</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
})();
