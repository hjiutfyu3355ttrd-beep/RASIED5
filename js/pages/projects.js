// المشاريع
(function () {
  "use strict";
  var page = document.getElementById("page");
  if (!page) return;

  var projects = DB.list("projects");
  var statusMap = {
    new: "جديد",
    in_progress: "جاري التنفيذ",
    paused: "متوقف",
    completed: "مكتمل",
    delivered: "تم التسليم",
    closed: "مغلق"
  };

  page.innerHTML = UI.html`
    <div class="card">
      <div class="card-head">
        <h3>قائمة المشاريع</h3>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>الكود</th>
              <th>اسم المشروع</th>
              <th>المهندس</th>
              <th>المنطقة</th>
              <th>تاريخ البداية</th>
              <th>التسليم المتوقع</th>
              <th class="num">إجمالي الفواتير</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${projects.map(function (p) {
              var eng = DB.get("engineers", p.engineer_id);
              var prof = DB.calcProjectProfit(p.id);
              return UI.html`<tr>
                <td>${UI.esc(p.code)}</td>
                <td>${UI.esc(p.name)}</td>
                <td>${UI.esc(eng ? eng.name : "—")}</td>
                <td>${UI.esc(p.area || "—")}</td>
                <td>${UI.fmtDate(p.start_date)}</td>
                <td>${UI.fmtDate(p.expected_end)}</td>
                <td class="num">${UI.money(prof.revenue)}</td>
                <td>${UI.esc(statusMap[p.status] || p.status)}</td>
              </tr>`;
            }).join("") || '<tr><td colspan="8" class="muted">لا توجد مشاريع</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
})();
