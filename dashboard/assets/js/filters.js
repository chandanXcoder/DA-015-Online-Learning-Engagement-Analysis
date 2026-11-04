/* ==========================================================================
   filters.js - global "slicer" filters (like Power BI / Tableau).
   * Selections are shared across pages for the browser session.
   * Every page calls DA.filters.mount(...) and re-renders on change.
   * Also contains small aggregation helpers used by the pages.
   ========================================================================== */
(function () {
  "use strict";
  const DA = window.DA;

  const DIMENSIONS = [
    { key: "course_module", label: "Module", icon: "book-open", order: () => DA.data.meta.modules },
    { key: "device_type", label: "Device", icon: "monitor-smartphone", order: () => DA.data.meta.devices },
    { key: "age_group", label: "Age", icon: "users", order: () => DA.data.meta.age_groups },
    { key: "completion_status", label: "Status", icon: "circle-check", order: () => DA.data.meta.statuses },
    { key: "engagement_category", label: "Engagement", icon: "activity", order: () => DA.data.meta.engagement_labels },
  ];
  const STORE_KEY = "da015-filters";
  const listeners = [];
  let state = {};

  function load() {
    try { state = JSON.parse(DA.store.get(STORE_KEY, true) || "{}") || {}; } catch (e) { state = {}; }
    DIMENSIONS.forEach((d) => { if (!Array.isArray(state[d.key])) state[d.key] = []; });
  }
  function save() { DA.store.set(STORE_KEY, JSON.stringify(state), true); }

  const F = (DA.filters = {
    dimensions: DIMENSIONS,
    get: () => state,
    /** True if a row passes every active filter (optionally ignoring one dimension). */
    match(row, ignore) {
      return DIMENSIONS.every((d) => d.key === ignore || !state[d.key].length || state[d.key].includes(row[d.key]));
    },
    rows(ignore) { return DA.data.learners.filter((r) => F.match(r, ignore)); },
    active() { return DIMENSIONS.some((d) => state[d.key].length); },
    set(key, values) { state[key] = values; save(); notify(); },
    clear() { DIMENSIONS.forEach((d) => (state[d.key] = [])); save(); notify(); },
    onChange(fn) { listeners.push(fn); },
    summaryText() {
      const parts = DIMENSIONS.filter((d) => state[d.key].length).map((d) => `${d.label}: ${state[d.key].join(", ")}`);
      return parts.length ? parts.join(" · ") : "All learners";
    },
  });

  function notify() { listeners.forEach((fn) => fn(F.rows())); renderBar(); }

  /* ---------------- slicer bar UI ---------------- */
  let barEl = null, hidden = [];
  F.mount = function (container, opts = {}) {
    barEl = container;
    hidden = opts.hide || [];
    renderBar();
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".slicer")) DA.$$(".slicer.open", barEl).forEach((s) => s.classList.remove("open"));
    });
  };

  function renderBar() {
    if (!barEl) return;
    const all = DA.data.learners;
    const shown = F.rows(hidden[0]).length; // hidden dimensions are ignored on this page
    barEl.className = "filterbar";
    barEl.innerHTML = `<span class="fb-title">${DA.icon("sliders-horizontal")}Filters</span>` +
      DIMENSIONS.filter((d) => !hidden.includes(d.key)).map((d) => {
        const sel = state[d.key];
        const base = F.rows(d.key); // counts reflect the other active filters
        const val = !sel.length ? "All" : sel.length === 1 ? sel[0] : `${sel.length} selected`;
        return `<div class="slicer ${sel.length ? "active" : ""}" data-key="${d.key}">
          <button class="slicer-btn" type="button" aria-haspopup="true">${DA.icon(d.icon)}<span class="lbl">${d.label}:</span><span class="val">${DA.esc(val)}</span>${DA.icon("chevron-down")}</button>
          <div class="slicer-menu" role="menu">
            ${d.order().map((v) => `<label><input type="checkbox" value="${DA.esc(v)}" ${sel.includes(v) ? "checked" : ""}>
              ${DA.esc(v)}<small>${DA.int(base.filter((r) => r[d.key] === v).length)}</small></label>`).join("")}
            <div class="sm-foot"><span class="muted" style="font-size:11.5px;align-self:center">None ticked = all</span><button class="btn ghost sm" data-act="clear" type="button">Clear</button></div>
          </div></div>`;
      }).join("") +
      `<span class="fb-sep"></span>
      <button class="btn ghost sm" id="fbReset" type="button" ${F.active() ? "" : "disabled"}>${DA.icon("rotate-ccw")}Reset</button>
      <span class="fb-count">${DA.icon("users")}<span><b>${DA.int(shown)}</b> of ${DA.int(all.length)} learners</span>
        <span class="fb-meter"><i style="width:${((shown / all.length) * 100).toFixed(1)}%"></i></span></span>`;
    DA.paintIcons();

    DA.$$(".slicer", barEl).forEach((sl) => {
      const key = sl.dataset.key;
      DA.$(".slicer-btn", sl).addEventListener("click", (e) => {
        e.stopPropagation();
        const wasOpen = sl.classList.contains("open");
        DA.$$(".slicer.open", barEl).forEach((s) => s.classList.remove("open"));
        if (!wasOpen) sl.classList.add("open");
      });
      DA.$$("input", sl).forEach((cb) => cb.addEventListener("change", () => {
        F.set(key, DA.$$("input:checked", sl).map((c) => c.value));
        const again = DA.$(`.slicer[data-key="${key}"]`, barEl);
        if (again) again.classList.add("open");
      }));
      DA.$$("[data-act]", sl).forEach((b) => b.addEventListener("click", (e) => {
        e.stopPropagation();
        F.set(key, []);
      }));
    });
    const reset = DA.$("#fbReset", barEl);
    if (reset) reset.addEventListener("click", () => { F.clear(); DA.toast("Filters cleared", "rotate-ccw"); });
  }

  /* ---------------- aggregation helpers ---------------- */
  /** Group rows by a column (in the given order) and summarise each group. */
  DA.groupBy = (rows, key, order) => (order || [...new Set(rows.map((r) => r[key]))])
    .map((name) => ({ name, ...DA.summarise(rows.filter((r) => r[key] === name)) }));

  /** Pearson correlation coefficient. */
  DA.pearson = function (xs, ys) {
    const n = xs.length;
    if (n < 3) return NaN;
    const mx = DA.mean(xs), my = DA.mean(ys);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
  };

  /** Least-squares line y = a + b x. */
  DA.linreg = function (xs, ys) {
    const mx = DA.mean(xs), my = DA.mean(ys);
    let num = 0, den = 0;
    xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
    const b = den ? num / den : 0;
    return { a: my - b * mx, b };
  };

  /** Difference vs full cohort, for KPI deltas (null when no filter is active). */
  DA.vsAll = (value, allValue) => (F.active() ? value - allValue : null);

  load();
  if (DA.data) {
    // Allow links such as modules.html#module=Java to pre-select a filter.
    const h = DA.hashParams();
    const map = { module: "course_module", device: "device_type", age: "age_group", status: "completion_status", engagement: "engagement_category" };
    let changed = false;
    const page = document.body && document.body.dataset.page;
    h.forEach((v, k) => {
      if (k === "module" && page === "modules") return; // the modules page uses #module= for its deep-dive
      if (map[k]) { state[map[k]] = v.split(","); changed = true; }
    });
    if (changed) save();
  }
})();
