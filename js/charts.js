// رسوم بيانية SVG خفيفة بدون مكتبات (تعمل أوفلاين وتدعم الوضع الداكن)
(function () {
  "use strict";
  var PAL = ["#2a49d6", "#f2a516", "#6189fb", "#d92d3f", "#12b886", "#8a5cf6", "#e0559b", "#7b88a8"];
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function short(n) {
    n = Number(n) || 0; var a = Math.abs(n), s = n < 0 ? "-" : "";
    if (a >= 1e6) return s + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
    if (a >= 1e3) return s + (a / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "k";
    return s + Math.round(a);
  }
  function full(n) { return Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 }); }
  function niceMax(v) {
    if (v <= 0) return 10;
    var p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }
  function empty(el, msg) { el.innerHTML = '<div class="empty compact">' + esc(msg || "لا توجد بيانات") + "</div>"; }

  // أعمدة مجمّعة: {labels, series:[{name,color,values}]}
  function bars(el, cfg) {
    var labels = cfg.labels || [], series = cfg.series || [];
    var all = [].concat.apply([], series.map(function (s) { return s.values; }));
    if (!labels.length || !all.some(function (v) { return v; })) return empty(el);
    var W = 560, H = 230, L = 44, R = 8, T = 12, B = 28, iw = W - L - R, ih = H - T - B;
    var max = niceMax(Math.max.apply(null, all.concat([0]))), min = Math.min.apply(null, all.concat([0]));
    if (min < 0) min = -niceMax(-min); else min = 0;
    var span = max - min, y = function (v) { return T + ih - ((v - min) / span) * ih; };
    var g = "", ticks = 4;
    for (var i = 0; i <= ticks; i++) {
      var v = min + (span * i) / ticks, yy = y(v);
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--border)" stroke-dasharray="3 4"/>' +
        '<text x="' + (L - 6) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="10" fill="var(--muted)">' + short(v) + "</text>";
    }
    var gw = iw / labels.length, bw = Math.min(26, (gw * 0.7) / series.length);
    labels.forEach(function (lb, i) {
      var x0 = L + gw * i + (gw - bw * series.length) / 2;
      series.forEach(function (s, k) {
        var v = s.values[i] || 0, yy = y(Math.max(v, 0)), h = Math.abs(y(v) - y(0));
        g += '<rect x="' + (x0 + bw * k) + '" y="' + (v >= 0 ? yy : y(0)) + '" width="' + (bw - 2) + '" height="' + Math.max(h, v ? 1.5 : 0) + '" rx="4" fill="' + (s.color || PAL[k]) + '"><title>' + esc(s.name + " — " + lb + ": " + full(v)) + "</title></rect>";
      });
      g += '<text x="' + (L + gw * i + gw / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="var(--muted)">' + esc(lb) + "</text>";
    });
    var legend = series.map(function (s, k) { return '<span><i style="background:' + (s.color || PAL[k]) + '"></i>' + esc(s.name) + "</span>"; }).join("");
    el.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" class="cv" style="direction:ltr;width:100%;height:auto" role="img">' + g + '</svg><div class="cv-legend">' + legend + "</div>";
  }

  // خطوط: {labels, series:[{name,color,values}]}
  function line(el, cfg) {
    var labels = cfg.labels || [], series = cfg.series || [];
    var all = [].concat.apply([], series.map(function (s) { return s.values; }));
    if (labels.length < 2 || !all.some(function (v) { return v; })) return empty(el);
    var W = 560, H = 230, L = 44, R = 12, T = 12, B = 28, iw = W - L - R, ih = H - T - B;
    var max = niceMax(Math.max.apply(null, all.concat([0]))), span = max;
    var x = function (i) { return L + (iw * i) / (labels.length - 1); }, y = function (v) { return T + ih - (v / span) * ih; };
    var g = "";
    for (var i = 0; i <= 4; i++) {
      var yy = y((span * i) / 4);
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--border)" stroke-dasharray="3 4"/><text x="' + (L - 6) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="10" fill="var(--muted)">' + short((span * i) / 4) + "</text>";
    }
    labels.forEach(function (lb, i) { g += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="var(--muted)">' + esc(lb) + "</text>"; });
    series.forEach(function (s, k) {
      var c = s.color || PAL[k], d = s.values.map(function (v, i) { return (i ? "L" : "M") + x(i) + " " + y(Math.max(v, 0)); }).join(" ");
      if (k === 0) g += '<path d="' + d + " L" + x(labels.length - 1) + " " + y(0) + " L" + x(0) + " " + y(0) + 'Z" fill="' + c + '" opacity=".10"/>';
      g += '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
      s.values.forEach(function (v, i) { g += '<circle cx="' + x(i) + '" cy="' + y(Math.max(v, 0)) + '" r="3.4" fill="var(--surface)" stroke="' + c + '" stroke-width="2"><title>' + esc(s.name + " — " + labels[i] + ": " + full(v)) + "</title></circle>"; });
    });
    var legend = series.map(function (s, k) { return '<span><i style="background:' + (s.color || PAL[k]) + '"></i>' + esc(s.name) + "</span>"; }).join("");
    el.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" style="direction:ltr;width:100%;height:auto" role="img">' + g + '</svg><div class="cv-legend">' + legend + "</div>";
  }

  // دونات: items [{label,value,color}]
  function donut(el, items, center) {
    items = (items || []).filter(function (i) { return i.value > 0; });
    var total = items.reduce(function (a, i) { return a + i.value; }, 0);
    if (!total) return empty(el);
    var R = 70, r = 46, cx = 90, cy = 90, a0 = -Math.PI / 2, g = "";
    items.forEach(function (it, k) {
      var frac = it.value / total, a1 = a0 + frac * Math.PI * 2, c = it.color || PAL[k % PAL.length];
      if (frac > 0.9999) { g += '<circle cx="' + cx + '" cy="' + cy + '" r="' + ((R + r) / 2) + '" fill="none" stroke="' + c + '" stroke-width="' + (R - r) + '"/>'; }
      else {
        var lg = frac > 0.5 ? 1 : 0, p = function (rr, a) { return (cx + rr * Math.cos(a)) + " " + (cy + rr * Math.sin(a)); };
        g += '<path d="M' + p(R, a0) + " A" + R + " " + R + " 0 " + lg + " 1 " + p(R, a1) + " L" + p(r, a1) + " A" + r + " " + r + " 0 " + lg + " 0 " + p(r, a0) + 'Z" fill="' + c + '"><title>' + esc(it.label + ": " + full(it.value)) + "</title></path>";
      }
      a0 = a1;
    });
    var cen = center || { top: full(total), sub: "الإجمالي" };
    g += '<text x="' + cx + '" y="' + (cy + 2) + '" text-anchor="middle" font-size="17" font-weight="700" fill="var(--text)">' + esc(cen.top) + '</text><text x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle" font-size="10.5" fill="var(--muted)">' + esc(cen.sub) + "</text>";
    var legend = items.map(function (it, k) {
      return '<li><i style="background:' + (it.color || PAL[k % PAL.length]) + '"></i><span>' + esc(it.label) + '</span><b class="num">' + full(it.value) + '</b><em>' + Math.round((it.value / total) * 100) + "%</em></li>";
    }).join("");
    el.innerHTML = '<div class="cv-donut"><svg viewBox="0 0 180 180" style="width:180px;height:180px;flex:none">' + g + '</svg><ul class="cv-list">' + legend + "</ul></div>";
  }

  // أعمدة أفقية: items [{label,value,sub,color}]
  function hbars(el, items, opt) {
    opt = opt || {};
    items = (items || []).filter(function (i) { return i.value || opt.keepZero; });
    if (!items.length) return empty(el);
    var max = Math.max.apply(null, items.map(function (i) { return Math.abs(i.value); })) || 1;
    el.innerHTML = '<div class="cv-hbars">' + items.map(function (it, k) {
      var w = Math.max(2, (Math.abs(it.value) / max) * 100), c = it.value < 0 ? "var(--error)" : (it.color || PAL[0]);
      return '<div class="cv-hb"><div class="cv-hb-top"><span>' + esc(it.label) + '</span><b class="num">' + (opt.fmt ? opt.fmt(it.value) : full(it.value)) + "</b></div>" +
        '<div class="cv-track"><i style="width:' + w + "%;background:" + c + '"></i></div>' + (it.sub ? '<small class="muted">' + esc(it.sub) + "</small>" : "") + "</div>";
    }).join("") + "</div>";
  }

  // خط مصغّر
  function spark(values, color) {
    values = values || [];
    if (values.length < 2) return "";
    var W = 100, H = 40, mn = Math.min.apply(null, values), mx = Math.max.apply(null, values), sp = mx - mn || 1;
    var pts = values.map(function (v, i) { return [(W * i) / (values.length - 1), H - 4 - ((v - mn) / sp) * (H - 10)]; });
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
    return '<svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none"><defs><linearGradient id="sg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".25"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs><path class="fill" d="' + d + " L100 40 L0 40Z" + '"/><path class="line" d="' + d + '"/></svg>';
  }

  window.Charts = { bars: bars, line: line, donut: donut, hbars: hbars, spark: spark, PAL: PAL, short: short };
})();
