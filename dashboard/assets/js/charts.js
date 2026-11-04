/* ==========================================================================
   charts.js - Chart.js helpers shared by all pages.
   * Charts are created when they scroll into view, so their animation plays
     when the reader actually sees them.
   * Colours are read from CSS tokens, so charts redraw correctly when the
     light / dark theme changes.
   ========================================================================== */
(function () {
  "use strict";
  const DA = window.DA;
  const registry = {};

  /** Current theme colours, read from CSS custom properties. */
  DA.colors = function () {
    const c = (n) => DA.css(n);
    const series = [c("--c1"), c("--c2"), c("--c3"), c("--c4"), c("--c5")];
    return {
      text: c("--text"), text2: c("--text-2"), text3: c("--text-3"), grid: c("--grid"), surface: c("--surface"),
      border: c("--border"), accent: c("--accent"), series,
      status: { Completed: series[0], "In Progress": series[1], Dropped: series[2] },
      eng: { Low: c("--eng-low"), Medium: c("--eng-med"), High: c("--eng-high") },
      muted: document.documentElement.getAttribute("data-theme") === "dark" ? "#39404b" : "#d5dae2",
    };
  };

  /** Hex colour -> rgba string with the given alpha. */
  DA.alpha = function (hex, a) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };

  function applyDefaults() {
    if (!window.Chart) return;
    const k = DA.colors();
    const d = Chart.defaults;
    d.color = k.text2;
    d.borderColor = k.grid;
    d.font.family = getComputedStyle(document.body).fontFamily;
    d.font.size = 12;
    d.responsive = true;
    d.maintainAspectRatio = false;
    d.animation.duration = 1200;
    d.animation.easing = "easeOutQuart";
    d.plugins.legend.labels.usePointStyle = true;
    d.plugins.legend.labels.boxWidth = 8;
    d.plugins.legend.labels.boxHeight = 8;
    d.plugins.legend.labels.padding = 14;
    Object.assign(d.plugins.tooltip, {
      backgroundColor: "rgba(15, 27, 45, 0.94)", titleColor: "#fff", bodyColor: "#dbe4f0", padding: 12,
      cornerRadius: 10, boxPadding: 5, usePointStyle: true, titleFont: { weight: "600" }, displayColors: true,
    });
    d.scale.grid.color = k.grid;
    if (d.scale.border) d.scale.border.display = false;
    d.scale.ticks.color = k.text3;
  }

  /** Plugin: text in the middle of a doughnut chart (options.plugins.centerText). */
  const centerText = {
    id: "centerText",
    afterDraw(chart, args, opts) {
      if (!opts || !opts.text) return;
      const { ctx, chartArea } = chart;
      const meta = chart.getDatasetMeta(0);
      if (!meta.data.length) return;
      const x = meta.data[0].x, y = meta.data[0].y;
      const k = DA.colors();
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = k.text;
      ctx.font = `700 ${Math.max(18, Math.min(30, (chartArea.right - chartArea.left) / 9))}px ${Chart.defaults.font.family}`;
      ctx.fillText(opts.text, x, y - 8);
      ctx.fillStyle = k.text3;
      ctx.font = `500 12px ${Chart.defaults.font.family}`;
      ctx.fillText(opts.sub || "", x, y + 16);
      ctx.restore();
    },
  };

  function create(entry) {
    if (!window.Chart) {
      entry.canvas.parentElement.innerHTML = '<div class="empty">Chart library not found (assets/vendor/chart.umd.min.js).</div>';
      return;
    }
    applyDefaults();
    if (entry.chart) entry.chart.destroy();
    const cfg = entry.build(DA.colors());
    cfg.plugins = (cfg.plugins || []).concat(centerText);
    entry.chart = new Chart(entry.canvas, cfg);
  }

  /**
   * Register a chart. `build(colors)` must return a Chart.js config object.
   * The chart is created the first time its canvas becomes visible.
   */
  DA.chart = function (id, build) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const entry = (registry[id] = { canvas, build, chart: null });
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((items) => {
        if (items.some((i) => i.isIntersecting)) { io.disconnect(); create(entry); }
      }, { threshold: 0.2 });
      io.observe(canvas);
    } else {
      create(entry);
    }
  };

  /** Re-run a chart's builder (e.g. after a filter changes) with a smooth transition. */
  DA.refreshChart = function (id) {
    const entry = registry[id];
    if (!entry || !entry.chart) return;
    const cfg = entry.build(DA.colors());
    entry.chart.data.labels = cfg.data.labels;
    cfg.data.datasets.forEach((ds, i) => {
      const cur = entry.chart.data.datasets[i];
      if (cur) Object.assign(cur, ds); else entry.chart.data.datasets.push(ds);
    });
    entry.chart.data.datasets.length = cfg.data.datasets.length;
    if (cfg.options) entry.chart.options = cfg.options;
    entry.chart.update();
  };

  document.addEventListener("themechange", () => {
    Object.values(registry).forEach((e) => e.chart && create(e));
  });

  /* ---------------- common option builders ---------------- */
  DA.barOptions = function ({ horizontal = false, suffix = "", max = null, legend = false, stacked = false, decimals = 1, title = "" } = {}) {
    const valueAxis = {
      beginAtZero: true, max: max ?? undefined, stacked,
      ticks: { callback: (v) => v + suffix },
      title: { display: !!title, text: title },
    };
    const catAxis = { grid: { display: false }, stacked };
    return {
      indexAxis: horizontal ? "y" : "x",
      plugins: {
        legend: { display: legend, position: "bottom" },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label ? ctx.dataset.label + ": " : ""}${DA.fmt(horizontal ? ctx.parsed.x : ctx.parsed.y, decimals)}${suffix}` } },
      },
      scales: horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis },
    };
  };

  /** Standard bar dataset styling (rounded data end, 2px surface gap). */
  DA.barDataset = (label, data, color, extra = {}) => Object.assign({
    label, data, backgroundColor: color, hoverBackgroundColor: color, borderRadius: 6, borderSkipped: "start",
    maxBarThickness: 46, borderWidth: 0, categoryPercentage: 0.7, barPercentage: 0.9,
  }, extra);

  /** Histogram counts for numeric values. Returns {labels, counts}. */
  DA.histogram = function (values, min, max, step) {
    const bins = Math.ceil((max - min) / step);
    const counts = new Array(bins).fill(0);
    values.forEach((v) => {
      const i = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / step)));
      counts[i] += 1;
    });
    const labels = counts.map((_, i) => `${min + i * step}–${min + (i + 1) * step}`);
    return { labels, counts };
  };
})();
