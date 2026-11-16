// لوحة التحكم — نظام المشاريع والتشطيبات
(function () {
  "use strict";
  var page = document.getElementById("page");
  if (!page) return;

  var s = DB.dashboardSummary();
  var profits = DB.listProjectProfits();
  var stock = DB.listStockBalances();
  var low = stock.filter(function (r) { return r.low; });

  var statusRows = Object.keys(s.by_status || {}).map(function (k) {
    return UI.html`<tr><td>${UI.esc(k)}</td><td class="num">${s.by_status[k]}</td></tr>`;
  }).join("");

  page.innerHTML = UI.html`
    <div class="stats">
      <div class="card stat">
        <div class="label">مشاريع قيد التنفيذ</div>
        <div class="value">${s.active_projects}</div>
      </div>
      <div class="card stat">
        <div class="label">إجمالي الإيرادات</div>
        <div class="value">${UI.moneyC(s.total_revenue)}</div>
      </div>
      <div class="card stat">
        <div class="label">صافي الربح</div>
        <div class="value">${UI.moneyC(s.net_profit)}</div>
      </div>
      <div class="card stat">
        <div class="label">مستحقات العملاء</div>
        <div class="value">${UI.moneyC(s.receivable)}</div>
      </div>
      <div class="card stat">
        <div class="label">الرصيد النقدي الحالي</div>
        <div class="value">${UI.moneyC(s.cash)}</div>
      </div>
      <div class="card stat">
        <div class="label">قيمة المخزون</div>
        <div class="value">${UI.moneyC(s.stock_value)}</div>
      </div>
      <div class="card stat">
        <div class="label">المهندسون النشطون</div>
        <div class="value">${s.active_engineers}</div>
      </div>
      <div class="card stat">
        <div class="label">تنبيهات انخفاض المخزون</div>
        <div class="value">${s.low_stock_alerts}</div>
      </div>
    </div>

    <div class="dash-grid" style="margin-top:1.25rem">
      <div class="card">
        <div class="card-head"><h3>توزيع المشاريع حسب الحالة</h3></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>حالة المشروع</th><th class="num">العدد</th></tr></thead>
            <tbody>${statusRows || '<tr><td colspan="2" class="muted">لا توجد مشاريع</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3>مقارنة المؤشرات المالية</h3></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>المؤشر</th><th class="num">القيمة</th></tr></thead>
            <tbody>
              <tr><td>الإيرادات</td><td class="num">${UI.moneyC(s.total_revenue)}</td></tr>
              <tr><td>إجمالي التكلفة</td><td class="num">${UI.moneyC(s.total_revenue - s.net_profit)}</td></tr>
              <tr><td>صافي الربح</td><td class="num">${UI.moneyC(s.net_profit)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:1.25rem">
      <div class="card-head"><h3>ربحية المشاريع</h3></div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>المشروع</th>
              <th>المهندس</th>
              <th class="num">الإيراد</th>
              <th class="num">التكلفة</th>
              <th class="num">صافي الربح</th>
              <th class="num">الهامش</th>
              <th class="num">المتبقي</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${profits.map(function (p) {
              return UI.html`<tr>
                <td>${UI.esc(p.project_name)}</td>
                <td>${UI.esc(p.engineer_name)}</td>
                <td class="num">${UI.money(p.revenue)}</td>
                <td class="num">${UI.money(p.total_cost)}</td>
                <td class="num">${UI.money(p.net)}</td>
                <td class="num">${UI.pct(p.margin)}</td>
                <td class="num">${UI.money(p.receivable)}</td>
                <td>${UI.esc(p.status)}</td>
              </tr>`;
            }).join("") || '<tr><td colspan="8" class="muted">لا توجد بيانات</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    ${low.length ? UI.html`
      <div class="card" style="margin-top:1.25rem">
        <div class="card-head"><h3>تنبيهات انخفاض المخزون</h3></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>الصنف</th><th>المخزن</th><th class="num">الرصيد</th><th class="num">حد إعادة الطلب</th></tr></thead>
            <tbody>
              ${low.map(function (r) {
                return UI.html`<tr>
                  <td>${UI.esc(r.item_name)}</td>
                  <td>${UI.esc(r.warehouse_name)}</td>
                  <td class="num">${UI.num(r.qty)}</td>
                  <td class="num">${UI.num(r.reorder_level)}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    ` : ""}
  `;
})();
