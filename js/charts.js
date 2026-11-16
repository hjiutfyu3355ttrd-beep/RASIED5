// مكتبة الرسوم — تصميم مطابق لنظام رصيد (Ledger)
(function () {
  "use strict";
  function cssVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) { return fallback; }
  }
  function palette() {
    return [
      cssVar("--chart-1", "#2a49d6"),
      cssVar("--chart-4", "#f2a516"),
      cssVar("--chart-3", "#6189fb"),
      cssVar("--chart-sup", "#ef4444"),
      cssVar("--chart-5", "#12b886"),
      cssVar("--chart-6", "#8b5cf6"),
      cssVar("--chart-7", "#e0559b"),
      cssVar("--chart-8", "#64748b")
    ];
  }
  var PAL = palette();

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function short(n) {
    n = Number(n) || 0;
    var a = Math.abs(n), s = n < 0 ? "-" : "";
    if (a >= 1e6) return s + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "م";
    if (a >= 1e3) return s + (a / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "أ";
    return s + Math.round(a).toLocaleString("en-US");
  }
  function full(n) {
    return (Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  function empty(el, msg) {
    if (el) el.innerHTML = '<div class="empty compact">' + (msg || "لا بيانات") + "</div>";
  }

  // مسار منحنٍ ناعم (Monotone cubic) — نفس خوارزمية رصيد
  function smooth(pts) {
    if (!pts || pts.length < 2) return "";
    var n = pts.length, dx = [], dy = [], m = [], t = [], i;
    for (i = 0; i < n - 1; i++) {
      dx[i] = pts[i + 1][0] - pts[i][0];
      dy[i] = pts[i + 1][1] - pts[i][1];
      m[i] = dy[i] / (dx[i] || 1);
    }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      var a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b;
      if (h > 9) { var k = 3 / Math.sqrt(h); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    var d = "M" + pts[0][0].toFixed(2) + "," + pts[0][1].toFixed(2);
    for (i = 0; i < n - 1; i++) {
      var c1x = pts[i][0] + dx[i] / 3, c1y = pts[i][1] + t[i] * dx[i] / 3;
      var c2x = pts[i + 1][0] - dx[i] / 3, c2y = pts[i + 1][1] - t[i + 1] * dx[i] / 3;
      d += " C" + c1x.toFixed(2) + "," + c1y.toFixed(2) + " " + c2x.toFixed(2) + "," + c2y.toFixed(2) + " " + pts[i + 1][0].toFixed(2) + "," + pts[i + 1][1].toFixed(2);
    }
    return d;
  }
  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  /**
   * مخطط مساحة مزدوج (مثل رصيد: مبيعات vs مشتريات)
   * seriesA / seriesB: [{label, value, t?}]
   */
  function area(el, seriesA, seriesB, opt) {
    opt = opt || {};
    if (!el) return;
    seriesA = seriesA || [];
    seriesB = seriesB || [];
    if (!seriesA.length) return empty(el);
    var W = 760, H = 300, pl = 6, pr = 54, pt = 14, pb = 32;
    var iw = W - pl - pr, ih = H - pt - pb, n = seriesA.length;
    var maxV = 0;
    seriesA.forEach(function (b) { if (b.value > maxV) maxV = b.value; });
    seriesB.forEach(function (b) { if (b.value > maxV) maxV = b.value; });
    maxV = niceMax(maxV);
    function X(i) { return W - pr - (i * iw / Math.max(n - 1, 1)); }
    function Y(v) { return pt + ih - (ih * v / maxV); }
    var g = "";
    for (var k = 0; k <= 4; k++) {
      var y = pt + ih - (ih * k / 4);
      g += '<line class="gridline" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y + '" y2="' + y + '"/>' +
        '<text x="' + (W - pr + 10) + '" y="' + (y + 4) + '">' + short(maxV * k / 4) + "</text>";
    }
    var step = n > 20 ? 4 : n > 10 ? 2 : 1;
    seriesA.forEach(function (b, i) {
      if (i % step === 0) {
        var lab = b.label || (b.t ? (UI && UI.fmtDate ? UI.fmtDate(b.t) : b.t) : "");
        g += '<text text-anchor="middle" x="' + X(i) + '" y="' + (H - 8) + '">' + esc(lab) + "</text>";
      }
    });
    var sp = seriesA.map(function (b, i) { return [X(i), Y(b.value || 0)]; }).reverse();
    var pp = seriesB.map(function (b, i) { return [X(i), Y(b.value || 0)]; }).reverse();
    var sl = smooth(sp), pl2 = seriesB.length ? smooth(pp) : "";
    var areaPath = sl + " L" + sp[sp.length - 1][0] + "," + (pt + ih) + " L" + sp[0][0] + "," + (pt + ih) + " Z";
    var gid = "gArea" + Math.random().toString(36).slice(2, 7);
    var colorA = opt.colorA || "var(--chart-1)";
    var colorB = opt.colorB || "var(--chart-2)";
    var html =
      '<div class="chart-box" id="' + (opt.id || "area-chart") + '">' +
      '<svg viewBox="0 0 ' + W + " " + H + '" role="img">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + (opt.fill || cssVar("--chart-1", "#3d63f0")) + '" stop-opacity=".32"/>' +
      '<stop offset="1" stop-color="' + (opt.fill || cssVar("--chart-1", "#3d63f0")) + '" stop-opacity="0"/></linearGradient></defs>' +
      g +
      '<path class="area-s" style="fill:url(#' + gid + ')" d="' + areaPath + '"/>' +
      (pl2 ? '<path class="line-p" d="' + pl2 + '"/>' : "") +
      '<path class="line-s" d="' + sl + '"/>' +
      "</svg></div>";
    el.innerHTML = html;
  }

  // أعمدة عمودية بسيطة (احتياطي)
  function bars(el, cfg) {
    cfg = cfg || {};
    var labels = cfg.labels || [], series = cfg.series || [];
    if (!labels.length || !series.length) return empty(el);
    var n = labels.length, max = 0;
    series.forEach(function (s) { s.values.forEach(function (v) { if (v > max) max = v; }); });
    max = niceMax(max) || 1;
    var W = 640, H = 260, pl = 8, pr = 16, pt = 16, pb = 36;
    var iw = W - pl - pr, ih = H - pt - pb;
    var groupW = iw / n, barW = Math.min(18, (groupW * 0.7) / series.length);
    var g = "";
    for (var k = 0; k <= 4; k++) {
      var y = pt + ih - (ih * k / 4);
      g += '<line class="gridline" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y + '" y2="' + y + '"/>';
      g += '<text x="' + (W - pr + 4) + '" y="' + (y + 3) + '" font-size="10" fill="var(--faint)">' + short(max * k / 4) + "</text>";
    }
    labels.forEach(function (lab, i) {
      var cx = pl + groupW * i + groupW / 2;
      g += '<text text-anchor="middle" x="' + cx + '" y="' + (H - 10) + '" font-size="10.5" fill="var(--faint)">' + esc(lab) + "</text>";
      series.forEach(function (s, si) {
        var v = s.values[i] || 0;
        var h = (v / max) * ih;
        var x = cx - (series.length * barW) / 2 + si * barW;
        var y = pt + ih - h;
        g += '<rect x="' + x + '" y="' + y + '" width="' + (barW - 2) + '" height="' + Math.max(0, h) + '" rx="4" fill="' + (s.color || palette()[si % 8]) + '"><title>' + esc(s.name) + ": " + full(v) + "</title></rect>";
      });
    });
    el.innerHTML = '<div class="chart-box"><svg viewBox="0 0 ' + W + " " + H + '">' + g + "</svg></div>";
  }

  function line(el, cfg) {
    cfg = cfg || {};
    var labels = cfg.labels || [], series = cfg.series || [];
    if (!labels.length) return empty(el);
    var A = labels.map(function (l, i) { return { label: l, value: (series[0] && series[0].values[i]) || 0 }; });
    var B = series[1] ? labels.map(function (l, i) { return { label: l, value: series[1].values[i] || 0 }; }) : [];
    area(el, A, B, { colorA: series[0] && series[0].color, colorB: series[1] && series[1].color });
  }

  function donut(el, items, cen) {
    if (!el) return;
    items = (items || []).filter(function (i) { return i.value > 0; });
    if (!items.length) return empty(el);
    cen = cen || {};
    var total = items.reduce(function (a, i) { return a + i.value; }, 0) || 1;
    var cx = 86, cy = 86, r = 58, c = 2 * Math.PI * r, off = 0;
    var palette = items.map(function (it, i) { return it.color || palette()[i % 8]; });
    var arcs = items.map(function (it, i) {
      var len = (it.value / total) * c;
      var path = '<circle class="seg" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + palette[i] +
        '" stroke-width="20" stroke-dasharray="' + Math.max(0, len - 3) + " " + (c - len + 3) +
        '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 ' + cx + " " + cy + ')"><title>' +
        esc(it.label) + ": " + full(it.value) + "</title></circle>";
      off += len;
      return path;
    }).join("");
    var legend = items.map(function (it, i) {
      return '<div class="li"><span><i style="background:' + palette[i] + '"></i><em>' + esc(it.label) +
        "</em></span><b>" + Math.round((it.value / total) * 100) + "%</b></div>";
    }).join("");
    el.innerHTML =
      '<div class="donut-wrap">' +
      '<svg viewBox="0 0 172 172" role="img">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--surface-3)" stroke-width="20"/>' +
      arcs +
      '<text class="donut-center" x="' + cx + '" y="' + (cy + 2) + '" text-anchor="middle">' + esc(cen.top || short(total)) + "</text>" +
      '<text class="donut-sub" x="' + cx + '" y="' + (cy + 20) + '" text-anchor="middle">' + esc(cen.sub || "") + "</text>" +
      "</svg>" +
      '<div class="legend-list">' + legend + "</div></div>";
  }

  function hbars(el, items, opt) {
    opt = opt || {};
    items = (items || []).filter(function (i) { return i.value || opt.keepZero; });
    if (!items.length) return empty(el);
    var max = Math.max.apply(null, items.map(function (i) { return Math.abs(i.value); })) || 1;
    el.innerHTML = '<div class="cv-hbars">' + items.map(function (it, k) {
      var w = Math.max(2, (Math.abs(it.value) / max) * 100);
      var c = it.value < 0 ? "var(--error)" : (it.color || palette()[0]);
      return '<div class="cv-hb"><div class="cv-hb-top"><span>' + esc(it.label) + '</span><b class="num">' +
        (opt.fmt ? opt.fmt(it.value) : full(it.value)) + "</b></div>" +
        '<div class="cv-track"><i style="width:' + w + "%;background:" + c + '"></i></div>' +
        (it.sub ? '<small class="muted">' + esc(it.sub) + "</small>" : "") + "</div>";
    }).join("") + "</div>";
  }

  // sparkline داخل KPI — بنفس أسلوب رصيد (smooth + gradient)
  var sid = 0;
  function spark(values) {
    values = values || [];
    if (values.length < 2) {
      return '<svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path class="line" d="M0,34 L100,34" opacity=".35"/></svg>';
    }
    var max = Math.max.apply(null, values), min = Math.min.apply(null, values.concat([0]));
    if (max === min) max = min + 1;
    var pts = values.map(function (v, i) {
      return [(i * 100) / (values.length - 1), 34 - ((v - min) / (max - min)) * 28];
    });
    var line = smooth(pts);
    var id = "sg" + (++sid);
    return '<svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" style="stop-color:var(--kc);stop-opacity:.28"/>' +
      '<stop offset="1" style="stop-color:var(--kc);stop-opacity:0"/></linearGradient></defs>' +
      '<path d="' + line + ' L100,40 L0,40 Z" style="fill:url(#' + id + ')"/>' +
      '<path class="line" d="' + line + '"/></svg>';
  }

  function refreshPalette() { PAL = palette(); return PAL; }

  window.Charts = {
    area: area, bars: bars, line: line, donut: donut, hbars: hbars, spark: spark,
    PAL: PAL, palette: palette, refreshPalette: refreshPalette,
    short: short, smooth: smooth, niceMax: niceMax, cssVar: cssVar
  };
})();
