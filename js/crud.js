// محرك الشاشات العامة (جدول + بحث + فلاتر + نموذج إضافة/تعديل + حذف + تصدير Excel)
(function () {
  "use strict";
  var esc = UI.esc;

  var STATUS_AR = { new: "جديد", in_progress: "جاري التنفيذ", paused: "متوقف", completed: "مكتمل", delivered: "تم التسليم", closed: "مغلق" };
  var STATUS_CLS = { new: "", in_progress: "ok", paused: "warn", completed: "ok", delivered: "ok", closed: "" };
  var STOCK_TYPES = {
    purchase_in: "شراء للمخزن", issue_to_project: "صرف للمشروع", return_from_project: "مرتجع من المشروع",
    purchase_direct: "شراء مباشر للمشروع", transfer_in: "تحويل وارد", transfer_out: "تحويل صادر",
    return_to_supplier: "مرتجع للمورد", adjust_plus: "تسوية زيادة", adjust_minus: "تسوية عجز"
  };

  function name(table, id) {
    if (!id) return "—";
    var r = DB.get(table, id);
    return r ? (r.name || r.code || r.id) : id;
  }
  function opts(table, filterFn) {
    return DB.list(table).filter(filterFn || function () { return true; })
      .sort(function (a, b) { return String(a.name || a.id).localeCompare(String(b.name || b.id), "ar"); })
      .map(function (r) { return [r.id, (r.code && r.code !== r.name ? r.code + " — " : "") + (r.name || r.id)]; });
  }
  function setting(key, fallback) {
    var s = (DB.get("settings") || {})[key];
    return Array.isArray(s) && s.length ? s : fallback;
  }
  function optionsHtml(list, sel, blank) {
    return (blank === false ? "" : '<option value="">— اختر —</option>') + list.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o;
      return '<option value="' + esc(v) + '"' + (String(v) === String(sel == null ? "" : sel) ? " selected" : "") + ">" + esc(l) + "</option>";
    }).join("");
  }
  function num(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
  function round2(n) { return Math.round((num(n) + Number.EPSILON) * 100) / 100; }
  function cell(row, c) {
    if (c.get) return c.get(row);
    if (c.type === "ref") return name(c.ref, row[c.key]);
    return row[c.key];
  }
  function display(row, c) {
    if (c.html) return c.html(row);
    var v = cell(row, c);
    if (c.type === "money") return '<span class="num">' + UI.money(v) + "</span>";
    if (c.type === "num") return '<span class="num">' + UI.num(v) + "</span>";
    if (c.type === "pct") return '<span class="num">' + UI.pct(v) + "</span>";
    if (c.type === "date") return UI.fmtDate(v);
    if (c.type === "badge") return '<span class="badge ' + ((c.cls && c.cls(row)) || "") + '">' + esc(v) + "</span>";
    return esc(v == null || v === "" ? "—" : v);
  }
  function exportXlsx(file, title, headers, rows, widths) {
    var data = [[title], [], headers].concat(rows);
    XlsxLite.download(file + ".xlsx", [{ name: title.slice(0, 28), rows: data, widths: widths || headers.map(function () { return 18; }), styles: { 0: "title", 2: "header" } }]);
  }
  function today() { return DB.today(); }

  // ——— نموذج عام ———
  function fieldHtml(f, v) {
    var id = "f_" + f.key, cls = "field" + (f.span2 ? " span2" : "") + (f.full ? " span-all" : "");
    var label = '<label for="' + id + '">' + esc(f.label) + (f.required ? " <small>*</small>" : "") + "</label>";
    var ro = f.readonly ? " readonly" : "";
    var input;
    if (f.type === "select") {
      var list = f.options ? (typeof f.options === "function" ? f.options() : f.options) : opts(f.ref, f.refFilter);
      input = '<select id="' + id + '"' + (f.readonly ? " disabled" : "") + ">" + optionsHtml(list, v, f.required && f.noBlank ? false : undefined) + "</select>";
    } else if (f.type === "textarea") {
      input = '<textarea id="' + id + '" rows="2">' + esc(v == null ? "" : v) + "</textarea>";
    } else if (f.type === "number" || f.type === "calc") {
      input = '<input id="' + id + '" type="number" step="any" inputmode="decimal" value="' + esc(v == null ? "" : v) + '"' + (f.type === "calc" ? " readonly tabindex=\"-1\"" : ro) + " />";
    } else if (f.type === "date") {
      input = '<input id="' + id + '" type="date" value="' + esc(v || "") + '"' + ro + " />";
    } else {
      input = '<input id="' + id + '" type="text" value="' + esc(v == null ? "" : v) + '"' + ro + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : "") + " />";
    }
    return '<div class="' + cls + '">' + label + input + (f.hint ? '<span class="help-note">' + esc(f.hint) + "</span>" : "") + "</div>";
  }
  function readForm(root, fields) {
    var vals = {};
    fields.forEach(function (f) {
      var el = root.querySelector("#f_" + f.key);
      if (!el) return;
      var v = el.value;
      if (f.type === "number" || f.type === "calc") vals[f.key] = v === "" ? 0 : num(v);
      else if (f.type === "select" || f.type === "date") vals[f.key] = v === "" ? null : v;
      else vals[f.key] = String(v).trim();
    });
    return vals;
  }

  function openForm(cfg, row, done) {
    var isNew = !row;
    var data = Object.assign({}, cfg.defaults ? cfg.defaults() : {}, row || {});
    if (isNew && cfg.prefix) { data.code = DB.nextCode(cfg.table, cfg.prefix); }
    var fields = cfg.fields.slice();
    var body = '<div class="form-grid">' + fields.map(function (f) {
      return fieldHtml(f.key === "code" ? Object.assign({}, f, { readonly: true }) : f, data[f.key]);
    }).join("") + '</div><p class="auth-err" id="f_err" style="color:var(--error);margin:10px 0 0" hidden></p>';
    var m = UI.modal({
      title: (isNew ? "إضافة — " : "تعديل — ") + (cfg.single || cfg.title),
      body: body,
      actions: [
        { label: "إلغاء", cls: "ghost", onClick: function (close) { close(); } },
        { label: "حفظ", cls: "primary", onClick: function () { save(); } }
      ]
    });
    if (cfg.wide) m.el.querySelector(".modal").classList.add("wide");
    var root = m.el;
    function recalc() {
      var vals = readForm(root, fields);
      fields.forEach(function (f) {
        if (f.type === "calc" && f.calc) { var el = root.querySelector("#f_" + f.key); if (el) el.value = round2(f.calc(vals)); }
      });
    }
    root.addEventListener("input", recalc);
    root.addEventListener("change", function (e) {
      recalc();
      var f = fields.filter(function (x) { return "f_" + x.key === e.target.id; })[0];
      if (f && f.onChange) { f.onChange(readForm(root, fields), function (k, v) { var el = root.querySelector("#f_" + k); if (el) { el.value = v == null ? "" : v; recalc(); } }); }
    });
    recalc();
    var busy = false;
    function save() {
      if (busy) return;
      var vals = readForm(root, fields);
      var err = "";
      fields.forEach(function (f) { if (!err && f.required && (vals[f.key] == null || vals[f.key] === "")) err = "الحقل «" + f.label + "» مطلوب"; });
      if (!err && cfg.validate) err = cfg.validate(vals, row) || "";
      var errEl = root.querySelector("#f_err");
      if (err) { errEl.textContent = err; errEl.hidden = false; return; }
      errEl.hidden = true;
      var out = Object.assign({}, row || {}, data.code && isNew ? { code: data.code } : {}, vals);
      if (isNew) { out.id = out.code || DB.nextCode(cfg.table, cfg.prefix || "ROW"); if (cfg.prefix && !out.code) out.code = out.id; }
      if (cfg.autoEngineer && out.project_id) { var p = DB.get("projects", out.project_id); out.engineer_id = p ? p.engineer_id : null; }
      if (cfg.prepare) out = cfg.prepare(out, isNew) || out;
      busy = true;
      DB.save(cfg.table, out).then(function (saved) {
        var after = cfg.afterSave ? cfg.afterSave(saved, isNew) : null;
        return Promise.resolve(after);
      }).then(function () {
        m.close(); UI.toast("تم الحفظ"); if (done) done();
      }).catch(function (e) { busy = false; errEl.textContent = e.message || "تعذّر الحفظ"; errEl.hidden = false; });
    }
    var first = root.querySelector("input:not([readonly]), select");
    if (first) first.focus();
    return m;
  }

  // ——— الشاشة ———
  function mount(cfg) {
    var page = document.getElementById("page");
    if (!page) return;
    var state = { q: "", from: "", to: "", sel: {}, all: false };
    var LIMIT = 300;

    function rows() {
      var list = DB.list(cfg.table);
      var q = state.q.trim().toLowerCase();
      list = list.filter(function (r) {
        if (cfg.date && state.from && (r[cfg.date] || "") < state.from) return false;
        if (cfg.date && state.to && (r[cfg.date] || "") > state.to) return false;
        for (var k in state.sel) { if (state.sel[k] && r[k] !== state.sel[k]) return false; }
        if (q) {
          var hay = cfg.columns.map(function (c) { var v = cell(r, c); return v == null ? "" : String(v); }).join(" ").toLowerCase();
          if (hay.indexOf(q) < 0) return false;
        }
        return true;
      });
      list.sort(cfg.sort || function (a, b) {
        var da = cfg.date ? (a[cfg.date] || "") : "", db = cfg.date ? (b[cfg.date] || "") : "";
        if (da !== db) return da < db ? 1 : -1;
        return String(b.id).localeCompare(String(a.id));
      });
      return list;
    }

    function render() {
      var list = rows(), shown = state.all ? list : list.slice(0, LIMIT);
      var canW = DB.canWrite(), canE = DB.canEdit(), canD = DB.canDelete();
      var stats = cfg.stats ? cfg.stats(list) : [];
      var th = cfg.columns.map(function (c) { return "<th" + (c.num || c.type === "money" || c.type === "num" ? ' class="num"' : "") + ">" + esc(c.label) + "</th>"; }).join("") + "<th></th>";
      var body = shown.map(function (r) {
        var tds = cfg.columns.map(function (c) { return "<td" + (c.num || c.type === "money" || c.type === "num" ? ' class="num"' : "") + ">" + display(r, c) + "</td>"; }).join("");
        var acts = (cfg.rowActions || []).map(function (a, i) { return '<button type="button" class="ghost small" data-act="x' + i + '" data-id="' + esc(r.id) + '">' + esc(a.label) + "</button>"; }).join("");
        if (canE && !cfg.noEdit) acts += '<button type="button" class="ghost small" data-act="edit" data-id="' + esc(r.id) + '">تعديل</button>';
        if (canD && !cfg.noDelete) acts += '<button type="button" class="danger small" data-act="del" data-id="' + esc(r.id) + '">حذف</button>';
        return "<tr>" + tds + '<td class="actions-cell" style="white-space:nowrap">' + acts + "</td></tr>";
      }).join("");
      var foot = "";
      var sums = cfg.columns.filter(function (c) { return c.sum; });
      if (sums.length && list.length) {
        foot = '<tr class="tfoot-row">' + cfg.columns.map(function (c, i) {
          if (c.sum) return '<td class="num">' + UI.money(list.reduce(function (a, r) { return a + num(r[c.key]); }, 0)) + "</td>";
          return "<td>" + (i === 0 ? "الإجمالي (" + list.length + ")" : "") + "</td>";
        }).join("") + "<td></td></tr>";
      }
      var filtersHtml = '<div class="filter-bar">' +
        '<div class="field" style="max-width:260px"><label>بحث</label><input type="search" id="q" placeholder="ابحث…" value="' + esc(state.q) + '" /></div>' +
        (cfg.date ? '<div class="field"><label>من تاريخ</label><input type="date" id="from" value="' + esc(state.from) + '" /></div><div class="field"><label>إلى تاريخ</label><input type="date" id="to" value="' + esc(state.to) + '" /></div>' : "") +
        (cfg.filters || []).map(function (f) {
          var list = f.options || opts(f.ref);
          return '<div class="field"><label>' + esc(f.label) + '</label><select data-sel="' + f.key + '">' + optionsHtml(list, state.sel[f.key]).replace("— اختر —", "الكل") + "</select></div>";
        }).join("") +
        '<div style="display:flex;gap:8px;margin-inline-start:auto">' +
          '<button type="button" id="xl" title="تصدير Excel">' + UI.icon.download + "<span>تصدير</span></button>" +
          (canW && !cfg.noAdd ? '<button type="button" class="primary" id="add">+ ' + esc(cfg.newLabel || ("إضافة " + (cfg.single || ""))) + "</button>" : "") +
        "</div></div>";

      page.innerHTML = filtersHtml +
        (stats.length ? '<div class="stats" style="margin-bottom:16px">' + stats.map(function (s) {
          return '<div class="card stat ' + (s.cls || "") + '"><div class="label">' + esc(s.label) + '</div><div class="value">' + s.value + "</div></div>";
        }).join("") + "</div>" : "") +
        (cfg.note ? '<p class="help-note" style="margin:0 0 10px">' + cfg.note + "</p>" : "") +
        '<div class="card table-card"><div class="table-wrap"><table class="table"><thead><tr>' + th + "</tr></thead><tbody>" +
        (body || '<tr><td colspan="' + (cfg.columns.length + 1) + '" class="muted" style="text-align:center;padding:28px">' + esc(cfg.empty || "لا توجد بيانات بعد") + "</td></tr>") +
        foot + "</tbody></table></div>" +
        (list.length > shown.length ? '<div style="padding:12px;text-align:center"><button type="button" id="more">عرض الكل (' + list.length + ")</button></div>" : "") + "</div>";
      bind(list);
    }

    function bind(list) {
      var q = page.querySelector("#q");
      q.addEventListener("input", function () { state.q = q.value; var pos = q.selectionStart; render(); var n = page.querySelector("#q"); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} });
      ["from", "to"].forEach(function (k) { var el = page.querySelector("#" + k); if (el) el.addEventListener("change", function () { state[k] = el.value; render(); }); });
      page.querySelectorAll("select[data-sel]").forEach(function (el) { el.addEventListener("change", function () { state.sel[el.getAttribute("data-sel")] = el.value; render(); }); });
      var add = page.querySelector("#add");
      if (add) add.addEventListener("click", function () { openForm(cfg, null, render); });
      var more = page.querySelector("#more");
      if (more) more.addEventListener("click", function () { state.all = true; render(); });
      page.querySelector("#xl").addEventListener("click", function () {
        exportXlsx(cfg.title, cfg.title, cfg.columns.map(function (c) { return c.label; }), list.map(function (r) {
          return cfg.columns.map(function (c) { var v = cell(r, c); return v == null ? "" : (c.type === "date" ? String(v) : v); });
        }));
      });
      page.querySelectorAll("button[data-act]").forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-id"), act = b.getAttribute("data-act"), row = DB.get(cfg.table, id);
          if (!row) return;
          if (act === "edit") openForm(cfg, row, render);
          else if (act === "del") {
            var msg = cfg.canDelete ? cfg.canDelete(row) : "";
            if (msg) return UI.toast(msg, true);
            if (!confirm("حذف هذا السجل نهائياً؟")) return;
            DB.remove(cfg.table, id).then(function () { return cfg.afterDelete ? cfg.afterDelete(row) : null; }).then(function () { UI.toast("تم الحذف"); render(); }).catch(function (e) { UI.toast(e.message, true); });
          } else if (act.charAt(0) === "x") cfg.rowActions[Number(act.slice(1))].fn(row, render);
        });
      });
    }
    render();
    return { render: render };
  }

  window.App = { STATUS_AR: STATUS_AR, STATUS_CLS: STATUS_CLS, STOCK_TYPES: STOCK_TYPES, name: name, opts: opts, setting: setting, optionsHtml: optionsHtml, num: num, round2: round2, exportXlsx: exportXlsx, today: today, fieldHtml: fieldHtml, readForm: readForm };
  window.Crud = { mount: mount, openForm: openForm };
})();
