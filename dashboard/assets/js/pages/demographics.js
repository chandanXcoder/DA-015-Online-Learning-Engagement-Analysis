/* Devices & Age - switchable metric, share doughnuts, summary tables and device x module heatmap. */
DA.ready(function (D) {
  const M = D.meta;
  const METRICS = {
    completion: { label: "Completion", unit: "%", max: null, higher: true },
    dropout: { label: "Dropout", unit: "%", max: null, higher: false },
    quiz: { label: "Avg quiz score", unit: "", max: 100, higher: true },
    hours: { label: "Avg learning hours", unit: " h", max: null, higher: true },
    engagement: { label: "Avg engagement", unit: "", max: 100, higher: true },
  };
  const DEVICE_ICON = { Laptop: "laptop", Mobile: "smartphone", Desktop: "monitor", Tablet: "tablet" };
  let metric = "completion";
  let rows = DA.filters.rows();
  DA.filters.mount(DA.$("#filterbar"));

  function renderKpis() {
    const g = DA.groupBy(rows, "device_type", M.devices), all = DA.summarise(rows), m = METRICS[metric];
    DA.renderKpis(DA.$("#devKpis"), g.map((x, i) => ({
      label: x.name, icon: DEVICE_ICON[x.name], color: `var(--c${i + 1})`, value: x.learners ? x[metric] : NaN, decimals: 1, suffix: m.unit,
      foot: `${m.label} · ${DA.int(x.learners)} learners`, meter: m.unit === "%" || m.max ? x[metric] : null,
      delta: { value: x.learners ? x[metric] - all[metric] : null, unit: m.unit === "%" ? " pts" : m.unit, higherIsBetter: m.higher },
      help: `${m.label} for ${x.name} learners; badge = difference from all selected learners.`,
    })));
  }

  const metricChart = (id, key, order) => DA.chart(id, (c) => {
    const m = METRICS[metric], g = DA.groupBy(rows, key, order).filter((x) => x.learners), all = DA.summarise(rows);
    return {
      type: "bar",
      data: { labels: g.map((x) => x.name), datasets: [
        DA.barDataset(m.label, g.map((x) => +x[metric].toFixed(1)), c.series[0]),
        { type: "line", label: "All selected", data: g.map(() => +all[metric].toFixed(1)), borderColor: c.text3, borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0 },
      ] },
      options: DA.barOptions({ suffix: m.unit, max: m.max, legend: true, tooltipExtra: (items) => `\n n = ${g[items[0].dataIndex].learners} learners` }),
    };
  });
  metricChart("deviceMetric", "device_type", M.devices);
  metricChart("ageMetric", "age_group", M.age_groups);

  const shareChart = (id, key, order) => DA.chart(id, (c) => {
    const g = DA.groupBy(rows, key, order), n = rows.length || 1;
    return { type: "doughnut", data: { labels: g.map((x) => x.name), datasets: [{ data: g.map((x) => x.learners), backgroundColor: g.map((_, i) => c.series[i]), borderColor: c.surface, borderWidth: 3, hoverOffset: 6 }] },
      options: DA.doughnutOptions(DA.int(rows.length), "learners", (ctx) => ` ${ctx.label}: ${ctx.parsed} (${DA.fmt((ctx.parsed / n) * 100)}%)`) };
  });
  shareChart("deviceShare", "device_type", M.devices);
  shareChart("ageShare", "age_group", M.age_groups);

  function table(id, key, order, title, icons) {
    const g = DA.groupBy(rows, key, order);
    DA.$(id).innerHTML = `<thead><tr><th>${title}</th><th class="num">Learners</th><th>Completion</th><th class="num">Dropout</th><th class="num">Quiz</th><th class="num">Hours</th><th class="num">Engagement</th></tr></thead>
      <tbody>${g.map((x) => `<tr><td><span style="display:inline-flex;align-items:center;gap:8px">${icons ? DA.icon(icons[x.name]) : ""}<b>${DA.esc(x.name)}</b></span></td>
        <td class="num">${DA.int(x.learners)}</td><td>${DA.barCell(x.completion, 100, "var(--c1)", 1, "%")}</td>
        <td class="num">${DA.fmt(x.dropout)}%</td><td class="num">${DA.fmt(x.quiz)}</td><td class="num">${DA.fmt(x.hours)}</td><td class="num">${DA.fmt(x.engagement)}</td></tr>`).join("")}</tbody>`;
    DA.fillBars(DA.$(id));
  }

  function renderCross() {
    const m = METRICS[metric];
    DA.$("#crossTitle").textContent = `${m.label} by device × module`;
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    const base = dark ? [23, 44, 50] : [236, 248, 249], top = dark ? [139, 228, 233] : [14, 138, 147];
    const cells = M.devices.map((d) => M.modules.map((mod) => {
      const r = rows.filter((l) => l.device_type === d && l.course_module === mod);
      return { n: r.length, v: r.length ? DA.summarise(r)[metric] : NaN };
    }));
    const vals = cells.flat().map((c) => c.v).filter(isFinite), lo = Math.min(...vals), hi = Math.max(...vals);
    const hm = DA.$("#crossHeat");
    hm.style.gridTemplateColumns = `max-content repeat(${M.modules.length}, minmax(96px, 1fr))`;
    hm.innerHTML = `<div></div>` + M.modules.map((x) => `<div class="hm-label" style="justify-content:center;font-weight:600">${DA.esc(x)}</div>`).join("") +
      M.devices.map((d, i) => `<div class="hm-label" style="font-weight:600;gap:8px">${DA.icon(DEVICE_ICON[d])}${DA.esc(d)}</div>` + cells[i].map((cell, j) => {
        if (!isFinite(cell.v)) return `<div class="hm-cell" style="background:var(--surface-2);color:var(--text-3)">–</div>`;
        const a = hi > lo ? (cell.v - lo) / (hi - lo) : 0.5, rgb = base.map((b, k) => Math.round(b + (top[k] - b) * a));
        const fg = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 > 0.55 ? "#1d2b36" : "#fff";
        return `<div class="hm-cell" style="background:rgb(${rgb.join(",")});color:${fg};min-height:54px;transition-delay:${((i + j) * 0.03).toFixed(2)}s"
          title="${d} · ${M.modules[j]}: ${DA.fmt(cell.v)}${m.unit} (n = ${cell.n})"><div style="text-align:center;line-height:1.25">${DA.fmt(cell.v)}${m.unit}<br>
          <span style="font-size:10.5px;font-weight:500;opacity:.8">n = ${cell.n}</span></div></div>`;
      }).join("")).join("");
    DA.paintIcons();
  }

  function renderAll() {
    renderKpis(); renderCross();
    table("#deviceTable", "device_type", M.devices, "Device", DEVICE_ICON);
    table("#ageTable", "age_group", M.age_groups, "Age group");
    DA.paintIcons();
    DA.refreshCharts(["deviceMetric", "ageMetric", "deviceShare", "ageShare"]);
  }

  DA.$("#metricSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    metric = b.dataset.metric;
    DA.$$("#metricSeg button").forEach((x) => x.classList.toggle("active", x === b));
    DA.$("#deviceTitle").textContent = `${METRICS[metric].label} by device`;
    DA.$("#ageTitle").textContent = `${METRICS[metric].label} by age group`;
    renderKpis(); renderCross();
    DA.refreshCharts(["deviceMetric", "ageMetric"]);
  });
  DA.filters.onChange((r) => { rows = r; renderAll(); });
  document.addEventListener("themechange", renderCross);
  renderAll();
});
