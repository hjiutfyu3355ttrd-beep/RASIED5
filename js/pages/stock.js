// حركات المخزون + الأرصدة
(function () {
  "use strict";
  var page = document.getElementById("page");
  if (!page) return;

  var balances = DB.listStockBalances();
  var moves = DB.list("stock_movements").slice().sort(function (a, b) {
    return (b.date || "").localeCompare(a.date || "") || (b.id || "").localeCompare(a.id || "");
  });

  var typeLabel = {
    purchase_in: "شراء للمخزن",
    issue_to_project: "صرف للمشروع",
    return_from_project: "مرتجع من المشروع",
    purchase_direct: "شراء مباشر للمشروع",
    transfer_in: "تحويل وارد",
    transfer_out: "تحويل صادر",
    return_to_supplier: "مرتجع للمورد",
    adjust_plus: "تسوية زيادة",
    adjust_minus: "تسوية عجز"
  };

  function itemName(id) {
    var i = DB.get("items", id);
    return i ? i.name : id;
  }
  function whName(id) {
    var w = DB.get("warehouses", id);
    return w ? w.name : (id || "—");
  }
  function prjName(id) {
    var p = DB.get("projects", id);
    return p ? p.name : (id || "—");
  }

  page.innerHTML = UI.html`
    <div class="card">
      <div class="card-head"><h3>أرصدة المخزون (متوسط مرجح متحرك)</h3></div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>الصنف</th>
              <th>المخزن</th>
              <th class="num">الكمية</th>
              <th class="num">قيمة المخزون</th>
              <th class="num">متوسط التكلفة</th>
              <th class="num">حد إعادة الطلب</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${balances.map(function (r) {
              return UI.html`<tr class="${r.low ? "row-warn" : ""}">
                <td>${r.item_name}</td>
                <td>${r.warehouse_name}</td>
                <td class="num">${UI.num(r.qty)}</td>
                <td class="num">${UI.money(r.value)}</td>
                <td class="num">${UI.money(r.avg_cost)}</td>
                <td class="num">${UI.num(r.reorder_level)}</td>
                <td>${r.low ? '<span class="badge warn">منخفض</span>' : '<span class="badge ok">سليم</span>'}</td>
              </tr>`;
            }).join("") || '<tr><td colspan="7" class="muted">لا يوجد رصيد</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:1.25rem">
      <div class="card-head"><h3>سجل حركات المخزون</h3></div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>الكود</th>
              <th>التاريخ</th>
              <th>النوع</th>
              <th>الصنف</th>
              <th>المخزن</th>
              <th>المشروع</th>
              <th class="num">الكمية</th>
              <th class="num">تكلفة الوحدة</th>
              <th class="num">القيمة</th>
            </tr>
          </thead>
          <tbody>
            ${moves.map(function (m) {
              return UI.html`<tr>
                <td>${m.id}</td>
                <td>${UI.fmtDate(m.date)}</td>
                <td>${typeLabel[m.type] || m.type}</td>
                <td>${itemName(m.item_id)}</td>
                <td>${whName(m.warehouse_id)}</td>
                <td>${prjName(m.project_id)}</td>
                <td class="num">${UI.num(m.qty)}</td>
                <td class="num">${UI.money(m.unit_cost)}</td>
                <td class="num">${UI.money(m.value)}</td>
              </tr>`;
            }).join("") || '<tr><td colspan="9" class="muted">لا توجد حركات</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
})();
