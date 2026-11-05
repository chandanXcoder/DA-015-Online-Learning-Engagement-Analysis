/* ==========================================================================
   charts.js - Chart.js integration shared by all pages.
   * Charts are drawn when they scroll into view (with a skeleton before).
   * Each chart card gets actions: info, table view, PNG download, fullscreen.
   * Colours come from CSS tokens, so charts follow the light / dark theme.
   ========================================================================== */
(function () {
  "use strict";
  const DA = window.DA;
  const registry = {};

  DA.colors = function () {
    const c = (n) => DA.css(n);
    const series = [c("--c1"), c("--c2"), c("--c3"), c("--c4"), c("--c5")];
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    return {
      dark, text: c("--text"), text2: c("--text-2"), text3: c("--text-3"), grid: c("--grid"), surface: c("--surface"),
      border: c("--border"), accent: c("--accent"), series,
      status: { Completed: series[0], "In Progress": series[1], Dropped: series[3] },
      eng: { Low: c("--eng-low"), Medium: c("--eng-med"), High: c("--eng-high") },
      muted: dark ? "#2a4249" : "#d3e6e8",
    };
  };

  DA.alpha = function (hex, a) {
    const h = String(hex).replace("#", "");
    if (h.length < 6) return hex;
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };

  function applyDefaults() {
    const k = DA.colors(), d = Chart.defaults;
    d.color = k.text2;
    d.borderColor = k.grid;
    d.font.family = getComputedStyle(document.body).fontFamily;
    d.font.size = 12;
    d.responsive = true;
    d.maintainAspectRatio = false;
    d.animation.duration = 1100;
    d.animation.easing = "easeOutCubic";
    d.transitions.active.animation.duration = 250;
    Object.assign(d.plugins.legend.labels, { usePointStyle: true, pointStyle: "circle", boxWidth: 7, boxHeight: 7, padding: 16, color: k.text2 });
    Object.assign(d.plugins.tooltip, {
      backgroundColor: k.surface, titleColor: k.text, bodyColor: k.text2, footerColor: k.text3, padding: 12,
      cornerRadius: 12, boxPadding: 5, usePointStyle: true, titleFont: { weight: "700", size: 12.5 }, bodyFont: { size: 12 },
      borderColor: k.border, borderWidth: 1, caretSize: 6, displayColors: true,
    });
    d.scale.grid.color = k.grid;
    d.scale.grid.tickColor = "transparent";
    if (d.scale.border) d.scale.border.display = false;
    d.scale.ticks.color = k.text3;
    d.scale.ticks.padding = 6;
    d.elements.bar.borderRadius = 8;
    d.elements.line.tension = 0.42;
    d.elements.line.borderWidth = 2.5;
    d.elements.line.borderCapStyle = "round";
    d.elements.point.radius = 0;
    d.elements.point.hoverRadius = 5;
    d.elements.point.hoverBorderWidth = 2;
    d.elements.point.hoverBorderColor = k.surface;
    d.elements.arc.borderColor = k.surface;
    d.elements.arc.borderWidth = 3;
    d.elements.arc.borderRadius = 6;
    d.interaction = { mode: "nearest", intersect: true };
  }

  /* Plugin: big number in the middle of a doughnut (options.plugins.centerText). */
  const centerText = {
    id: "centerText",
    afterDraw(chart, args, opts) {
      if (!opts || !opts.text || chart.config.type !== "doughnut") return;
      const meta = chart.getDatasetMeta(0);
      if (!meta.data.length) return;
      const { x, y } = meta.data[0], k = DA.colors(), ctx = chart.ctx;
      const size = Math.max(16, Math.min(28, meta.data[0].innerRadius / 2.4));
      ctx.save();
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = k.text; ctx.font = `700 ${size}px ${Chart.defaults.font.family}`;
      ctx.fillText(opts.text, x, y - 7);
      ctx.fillStyle = k.text3; ctx.font = `500 11.5px ${Chart.defaults.font.family}`;
      ctx.fillText(opts.sub || "", x, y + size / 2 + 6);
      ctx.restore();
    },
  };

  function create(entry, canvas = entry.canvas) {
    applyDefaults();
    const cfg = entry.build(DA.colors());
    cfg.plugins = (cfg.plugins || []).concat(centerText);
    return new Chart(canvas, cfg);
  }
  function draw(entry) {
    if (!window.Chart) { entry.box.innerHTML = `<div class="empty">${DA.icon("triangle-alert")}Chart library missing (assets/vendor/chart.umd.min.js)</div>`; DA.paintIcons(); return; }
    if (entry.chart) entry.chart.destroy();
    entry.chart = create(entry);
    entry.box.classList.add("drawn");
  }

  /* ---------- card actions ---------- */
  function tableFromChart(chart) {
    const { labels = [], datasets = [] } = chart.data;
    const isXY = datasets.some((ds) => ds.data.length && typeof ds.data[0] === "object" && ds.data[0] !== null);
    if (isXY) {
      const rows = datasets.flatMap((ds) => ds.data.filter((p) => p && p.id).map((p) => ({ s: ds.label, ...p })));
      return `<table class="data compact"><thead><tr><th>Series</th><th>Learner</th><th class="num">X</th><th class="num">Y</th></tr></thead>
        <tbody>${rows.slice(0, 300).map((r) => `<tr><td>${DA.esc(r.s)}</td><td>${DA.esc(r.id)}</td><td class="num">${DA.fmt(r.x)}</td><td class="num">${DA.fmt(r.y)}</td></tr>`).join("")}</tbody></table>
        ${rows.length > 300 ? `<div class="card-note">Showing first 300 of ${DA.int(rows.length)} points.</div>` : ""}`;
    }
    const sets = datasets.filter((ds) => ds.type !== "line" || ds.label);
    return `<table class="data compact"><thead><tr><th>Category</th>${sets.map((ds) => `<th class="num">${DA.esc(ds.label || "Value")}</th>`).join("")}</tr></thead>
      <tbody>${labels.map((l, i) => `<tr><td>${DA.esc(l)}</td>${sets.map((ds) => `<td class="num">${DA.fmt(ds.data[i], Number.isInteger(ds.data[i]) ? 0 : 1)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }

  function addActions(entry) {
    const card = entry.canvas.closest(".card");
    if (!card || card.dataset.actions) return;
    card.dataset.actions = "1";
    const head = DA.$(".card-head", card);
    if (!head) return;
    const info = card.dataset.info;
    const wrap = document.createElement("div");
    wrap.className = "card-actions";
    wrap.innerHTML = `
      ${info ? `<span class="icon-btn" data-tip="${DA.esc(info)}" aria-label="About this chart">${DA.icon("info")}</span>` : ""}
      <button class="icon-btn" data-act="table" data-tip="Show data table" aria-label="Show data table">${DA.icon("table")}</button>
      <button class="icon-btn" data-act="png" data-tip="Download PNG" aria-label="Download PNG">${DA.icon("image-down")}</button>
      <button class="icon-btn" data-act="expand" data-tip="Full screen" aria-label="Full screen">${DA.icon("maximize-2")}</button>`;
    head.appendChild(wrap);
    const view = document.createElement("div");
    view.className = "data-view";
    entry.box.after(view);
    entry.view = view;

    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn || !entry.chart) return;
      const title = (DA.$(".card-title", card) || {}).textContent || "chart";
      if (btn.dataset.act === "table") {
        const on = card.classList.toggle("show-table");
        btn.classList.toggle("on", on);
        if (on) view.innerHTML = `<div class="table-wrap">${tableFromChart(entry.chart)}</div>`;
      } else if (btn.dataset.act === "png") {
        const a = document.createElement("a");
        a.href = entry.chart.toBase64Image("image/png", 1);
        a.download = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_") + ".png";
        a.click();
        DA.toast(`Downloaded “${title.trim()}”`, "image-down");
      } else if (btn.dataset.act === "expand") {
        const body = DA.openModal(title.trim(), `<div style="position:absolute;inset:18px"><canvas id="modalCanvas"></canvas></div>`);
        DA._modalChart = create(entry, DA.$("#modalCanvas", body));
      }
    });
    DA.paintIcons();
  }

  /**
   * Register a chart: build(colors) returns a Chart.js config.
   * The canvas should sit inside .chart-box within a .card (optional data-info).
   */
  DA.chart = function (id, build) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const entry = (registry[id] = { canvas, build, chart: null, box: canvas.closest(".chart-box") || canvas.parentElement });
    addActions(entry);
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((items) => { if (items.some((i) => i.isIntersecting)) { io.disconnect(); draw(entry); } }, { threshold: 0.15 });
      io.observe(entry.box);
    } else draw(entry);
  };

  /** Rebuild a chart's data after filters change, with a smooth transition. */
  DA.refreshChart = function (id) {
    const e = registry[id];
    if (!e || !e.chart) return;
    const cfg = e.build(DA.colors());
    e.chart.data.labels = cfg.data.labels;
    cfg.data.datasets.forEach((ds, i) => {
      const cur = e.chart.data.datasets[i];
      if (cur && cur.type === ds.type) Object.assign(cur, ds); else e.chart.data.datasets[i] = ds;
    });
    e.chart.data.datasets.length = cfg.data.datasets.length;
    if (cfg.options) e.chart.options = cfg.options;
    e.chart.update();
    const card = e.canvas.closest(".card");
    if (card && card.classList.contains("show-table") && e.view) e.view.innerHTML = `<div class="table-wrap">${tableFromChart(e.chart)}</div>`;
  };
  DA.refreshCharts = (ids) => ids.forEach(DA.refreshChart);

  document.addEventListener("themechange", () => Object.values(registry).forEach((e) => e.chart && draw(e)));

  /* ---------- option builders ---------- */
  DA.barOptions = function ({ horizontal = false, suffix = "", max = null, legend = false, stacked = false, decimals = 1, xTitle = "", yTitle = "", tooltipExtra = null } = {}) {
    const valueAxis = { beginAtZero: true, max: max ?? undefined, stacked, ticks: { callback: (v) => v + suffix }, title: { display: false } };
    const catAxis = { grid: { display: false }, stacked, ticks: { autoSkip: false, maxRotation: 40, minRotation: 0 } };
    const opts = {
      indexAxis: horizontal ? "y" : "x",
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: legend, position: "bottom", align: "start" },
        tooltip: { callbacks: {
          label: (ctx) => ` ${ctx.dataset.label ? ctx.dataset.label + ": " : ""}${DA.fmt(horizontal ? ctx.parsed.x : ctx.parsed.y, decimals)}${suffix}`,
          ...(tooltipExtra ? { afterBody: tooltipExtra } : {}),
        } },
      },
      scales: horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis },
    };
    const vKey = horizontal ? "x" : "y", cKey = horizontal ? "y" : "x";
    if (yTitle) opts.scales[vKey].title = { display: true, text: yTitle, color: DA.colors().text3 };
    if (xTitle) opts.scales[cKey].title = { display: true, text: xTitle, color: DA.colors().text3 };
    return opts;
  };

  DA.barDataset = (label, data, color, extra = {}) => Object.assign({
    label, data, backgroundColor: color, hoverBackgroundColor: color, borderRadius: 8, borderSkipped: "start",
    maxBarThickness: 36, borderWidth: 0, categoryPercentage: 0.72, barPercentage: 0.88,
  }, extra);

  DA.doughnutOptions = (center, sub, tooltipLabel) => ({
    cutout: "76%",
    layout: { padding: 4 },
    animation: { animateRotate: true, duration: 1000 },
    plugins: { legend: { position: "bottom" }, centerText: { text: center, sub }, tooltip: { callbacks: { label: tooltipLabel } } },
  });

  DA.histogram = function (values, min, max, step) {
    const bins = Math.ceil((max - min) / step);
    const counts = new Array(bins).fill(0);
    values.forEach((v) => { counts[Math.min(bins - 1, Math.max(0, Math.floor((v - min) / step)))] += 1; });
    return { labels: counts.map((_, i) => `${min + i * step}–${min + (i + 1) * step}`), counts };
  };
})();
