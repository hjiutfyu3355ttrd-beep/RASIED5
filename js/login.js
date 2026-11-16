// صفحة تسجيل الدخول + إعداد أول مدير
(function () {
  "use strict";
  var cfg = window.APP_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  if (!$("form-login")) return;

  try { if (localStorage.getItem("pm_theme") === "dark") document.documentElement.classList.add("dark"); } catch (e) {}

  if (window.DB && DB.demoMode) { location.replace("dashboard.html"); return; }

  function showErr(id, msg) { var e = $(id); e.textContent = msg || ""; e.hidden = !msg; }
  function busy(btn, on, label) { btn.disabled = on; btn.textContent = on ? "جارٍ المعالجة…" : label; }

  function tab(setup) {
    $("form-login").hidden = setup; $("form-setup").hidden = !setup;
    $("tab-login").classList.toggle("on", !setup); $("tab-setup").classList.toggle("on", setup);
    showErr("err-login", ""); showErr("err-setup", "");
  }
  $("tab-login").onclick = function () { tab(false); };
  $("tab-setup").onclick = function () { tab(true); };
  document.querySelectorAll("[data-eye]").forEach(function (b) {
    b.onclick = function () { var i = $(b.getAttribute("data-eye")); i.type = i.type === "password" ? "text" : "password"; };
  });

  function callSetup(body) {
    return fetch(cfg.SUPABASE_URL + "/functions/v1/setup", {
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

  // لو لا يوجد أي مستخدم بعد: اعرض تبويب إعداد النظام
  callSetup({ action: "status" }).then(function (j) {
    if (j && j.needs_setup) { $("tabs").hidden = false; tab(true); }
  }).catch(function () { /* لا نعطّل الدخول لو تعذّر الفحص */ });

  $("form-login").addEventListener("submit", function (e) {
    e.preventDefault();
    var id = $("l-id").value.trim(), pass = $("l-pass").value;
    if (!id) return showErr("err-login", "اكتب رقم الهاتف أو البريد");
    if (!pass) return showErr("err-login", "اكتب كلمة المرور");
    showErr("err-login", ""); busy($("btn-login"), true);
    DB.signIn(id, pass).then(function () { location.replace("dashboard.html"); })
      .catch(function (err) { showErr("err-login", err.message); busy($("btn-login"), false, "دخول"); });
  });

  $("form-setup").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("s-name").value.trim(), phone = DB.normPhone($("s-phone").value), pass = $("s-pass").value;
    if (name.length < 2) return showErr("err-setup", "اكتب اسمك");
    if (phone.length < 8 || phone.length > 15) return showErr("err-setup", "اكتب رقم هاتف صحيح مع كود الدولة");
    if (pass.length < 6) return showErr("err-setup", "كلمة المرور 6 أحرف على الأقل");
    showErr("err-setup", ""); busy($("btn-setup"), true);
    callSetup({ action: "create", full_name: name, phone: phone, password: pass })
      .then(function () { return DB.signIn(phone, pass); })
      .then(function () { location.replace("dashboard.html"); })
      .catch(function (err) { showErr("err-setup", err.message); busy($("btn-setup"), false, "إنشاء حساب المدير"); });
  });

  $("forgot").onclick = function () {
    var wa = String(cfg.SUPPORT_WHATSAPP || "").replace(/\D/g, "");
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = '<div class="modal card"><h3 style="margin-top:0">نسيت كلمة المرور؟</h3>' +
      '<p>اطلب من <b>مدير النظام</b> تغيير كلمة مرورك من صفحة «المستخدمون» ← «تغيير كلمة المرور»، ثم ادخل بالكلمة الجديدة.</p>' +
      '<p class="muted">إن كنت أنت المدير الوحيد وفقدت كلمة المرور، يمكن إعادة تعيينها من لوحة Supabase ← Authentication ← Users.</p>' +
      (wa ? '<p><a class="button primary" target="_blank" rel="noopener" href="https://wa.me/' + wa + '">تواصل عبر واتساب</a></p>' : "") +
      '<div class="row gap" style="justify-content:flex-end"><button type="button" class="ghost" id="fg-close">إغلاق</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector("#fg-close").onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
  };
})();
