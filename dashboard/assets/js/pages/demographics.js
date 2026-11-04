/* Devices & Age page - switchable metric charts, share doughnuts, tables, device x module heatmap. */
DA.ready(function (D) {
  const METRICS = {
    completion_rate_pct: { label: "Completion rate", suffix: "%", max: 100 },
    dropout_rate_pct: { label: "Dropout rate", suffix: "%", max: 100 },
    avg_quiz_score: { label: "Avg quiz score", suffix: "", max: 100 },
    avg_hours: { label: "Avg learning hours", suffix: " h", max: null },
    avg_engagement_score: { label: "Avg engagement score", suffix: "", max: 100 },
  };
  let metric = "completion_rate_pct";

  const devices = [...D.device].sort((a, b) => b.learners - a.learners);
  const ages = D.meta.age_groups.map((a) => DA.byName(D.age, a)).filter(Boolean);

  const metricChart = (id, rows) => DA.chart(id, (c) => {
    const m = METRICS[metric];
    return {
      type: "bar",
      data: { labels: rows.map((r) => r.name), datasets: [DA.barDataset(m.label, rows.map((r) => r[metric]), c.series[0])] },
      options: DA.barOptions({ suffix: m.suffix, max: m.max }),
    };
  });
  metricChart("deviceMetric", devices);
  metricChart("ageMetric", ages);

  const shareChart = (id, rows) => DA.chart(id, (c) => ({
    type: "doughnut",
    data: { labels: rows.map((r) => r.name), datasets: [{ data: rows.map((r) => r.learners), backgroundColor: rows.map((_, i) => c.series[i]),
      borderColor: c.surface, borderWidth: 3, hoverOffset: 6 }] },
    options: { cutout: "62%", plugins: { legend: { position: "bottom" },
      centerText: { text: DA.int(rows.reduce((a, r) => a + r.learners, 0)), sub: "learners" },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} (${DA.fmt((ctx.parsed / D.kpis.total_learners) * 100)}%)` } } } },
  }));
  shareChart("deviceShare", devices);
  shareChart("ageShare", ages);

  const table = (id, rows, title) => {
    DA.$(id).innerHTML = `
      <thead><tr><th>${title}</th><th class="num">Learners</th><th>Completion</th><th>Dropout</th><th>Avg quiz</th>
        <th class="num">Avg hours</th><th class="num">Lesson progress</th><th class="num">Engagement</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td><b>${DA.esc(r.name)}</b></td><td class="num">${DA.int(r.learners)}</td>
        <td>${DA.barCell(r.completion_rate_pct, 100, "var(--c1)", 1, "%")}</td>
        <td>${DA.barCell(r.dropout_rate_pct, 100, "var(--c2)", 1, "%")}</td>
        <td>${DA.barCell(r.avg_quiz_score, 100, "var(--c3)")}</td>
        <td class="num">${DA.fmt(r.avg_hours)}</td><td class="num">${DA.fmt(r.avg_lesson_progress_pct)}%</td>
        <td class="num">${DA.fmt(r.avg_engagement_score)}</td></tr>`).join("")}</tbody>`;
  };
  table("#deviceTable", devices, "Device");
  table("#ageTable", ages, "Age group");

  /* metric switcher */
  DA.$("#metricSeg").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    metric = btn.dataset.metric;
    DA.$$("#metricSeg button").forEach((b) => b.classList.toggle("active", b === btn));
    DA.$("#deviceTitle").textContent = `${METRICS[metric].label} by device`;
    DA.$("#ageTitle").textContent = `${METRICS[metric].label} by age group`;
    DA.refreshChart("deviceMetric");
    DA.refreshChart("ageMetric");
  });

  /* device x module completion heatmap (computed from learner rows) */
  const mods = D.meta.modules;
  function renderCross() {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    const base = dark ? [30, 34, 40] : [238, 244, 252];
    const top = dark ? [140, 188, 245] : [28, 90, 166];
    const cells = devices.map((d) => mods.map((m) => {
      const rows = D.learners.filter((l) => l.device_type === d.name && l.course_module === m);
      return { n: rows.length, v: rows.length ? (rows.filter((l) => l.completion_status === "Completed").length / rows.length) * 100 : NaN };
    }));
    const vals = cells.flat().map((c) => c.v).filter((v) => !isNaN(v));
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const hm = DA.$("#crossHeat");
    hm.style.gridTemplateColumns = `max-content repeat(${mods.length}, minmax(90px, 1fr))`;
    let html = `<div></div>` + mods.map((m) => `<div class="hm-label" style="justify-content:center;font-weight:600">${DA.esc(m)}</div>`).join("");
    devices.forEach((d, i) => {
      html += `<div class="hm-label" style="font-weight:600">${DA.esc(d.name)}</div>`;
      cells[i].forEach((cell, j) => {
        const a = hi > lo ? (cell.v - lo) / (hi - lo) : 0.5;
        const rgb = base.map((b, k) => Math.round(b + (top[k] - b) * a));
        const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
        html += `<div class="hm-cell" style="background:rgb(${rgb.join(",")});color:${lum > 0.55 ? "#121417" : "#fff"};min-height:56px;
          transition-delay:${((i + j) * 0.04).toFixed(2)}s" title="${d.name} · ${mods[j]}: ${DA.fmt(cell.v)}% completion (n = ${cell.n})">
          <div style="text-align:center;line-height:1.2">${DA.fmt(cell.v)}%<br><span style="font-size:10.5px;font-weight:500;opacity:.8">n = ${cell.n}</span></div></div>`;
      });
    });
    hm.innerHTML = html;
  }
  renderCross();
  document.addEventListener("themechange", renderCross);
});
