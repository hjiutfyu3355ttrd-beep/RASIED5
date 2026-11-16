// صفحة تسجيل الدخول وإنشاء حساب جديد
(function () {
  "use strict";
  var cfg = window.APP_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  if (!$("form-login")) return;

  try { if (localStorage.getItem("pm_theme") === "dark") document.documentElement.classList.add("dark"); } catch (e) {}

  if (window.DB && DB.demoMode) { location.replace("dashboard.html"); return; }

  function showErr(id, msg) { var e = $(id); e.textContent = msg || ""; e.hidden = !msg; }
  function busy(btn, on, label) { btn.disabled = on; btn.textContent = on ? "جارٍ المعالجة…" : label; }

  function tab(reg) {
    $("form-login").hidden = reg; $("form-reg").hidden = !reg;
    $("tab-login").classList.toggle("on", !reg); $("tab-reg").classList.toggle("on", reg);
    showErr("err-login", ""); showErr("err-reg", "");
  }
  $("tab-login").onclick = function () { tab(false); };
  $("tab-reg").onclick = function () { tab(true); };
  document.querySelectorAll("[data-eye]").forEach(function (b) {
    b.onclick = function () { var i = $(b.getAttribute("data-eye")); i.type = i.type === "password" ? "text" : "password"; };
  });

  function callFn(name, body) {
    return fetch(cfg.SUPABASE_URL + "/functions/v1/" + name, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok) throw new Error(j.message || "تعذّر تنفيذ العملية");
        return j;
      });
    });
  }

  $("form-login").addEventListener("submit", function (e) {
    e.preventDefault();
    var id = $("l-id").value.trim(), pass = $("l-pass").value;
    if (!id) return showErr("err-login", "اكتب رقم الهاتف أو البريد");
    if (!pass) return showErr("err-login", "اكتب كلمة المرور");
    showErr("err-login", ""); busy($("btn-login"), true);
    DB.signIn(id, pass).then(function () { location.replace("dashboard.html"); })
      .catch(function (err) { showErr("err-login", err.message); busy($("btn-login"), false, "دخول"); });
  });

  $("form-reg").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("r-name").value.trim(), co = $("r-co").value.trim(), phone = DB.normPhone($("r-phone").value), pass = $("r-pass").value;
    if (name.length < 2) return showErr("err-reg", "اكتب اسمك");
    if (co.length < 2) return showErr("err-reg", "اكتب اسم الشركة");
    if (phone.length < 8 || phone.length > 15) return showErr("err-reg", "اكتب رقم هاتف صحيح مع كود الدولة");
    if (pass.length < 6) return showErr("err-reg", "كلمة المرور 6 أحرف على الأقل");
    showErr("err-reg", ""); busy($("btn-reg"), true);
    callFn("register", { full_name: name, company_name: co, phone: phone, password: pass })
      .then(function () { return DB.signIn(phone, pass); })
      .then(function () { location.replace("dashboard.html"); })
      .catch(function (err) { showErr("err-reg", err.message); busy($("btn-reg"), false, "إنشاء الحساب"); });
  });

  $("forgot").onclick = function () {
    var wa = String(cfg.SUPPORT_WHATSAPP || "").replace(/\D/g, "");
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = '<div class="modal card"><h3 style="margin-top:0">نسيت كلمة المرور؟</h3>' +
      '<p>الموظف: اطلب من مالك الشركة تغيير كلمة المرور.<br>مالك الشركة: تواصل مع إدارة المنصة.</p>' +
      (wa ? '<p><a class="button primary" target="_blank" rel="noopener" href="https://wa.me/' + wa + '">تواصل عبر واتساب</a></p>' : "") +
      '<div class="row gap" style="justify-content:flex-end"><button type="button" class="ghost" id="fg-close">إغلاق</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector("#fg-close").onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
  };
})();
