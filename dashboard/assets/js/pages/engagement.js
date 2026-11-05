/* Engagement - score model, distribution, outcomes, module mix, scatter and live correlation matrix. */
DA.ready(function (D) {
  const M = D.meta, w = M.engagement_weights, t = M.engagement_thresholds, L = M.engagement_labels;
  let rows = DA.filters.rows();
  DA.filters.mount(DA.$("#filterbar"));

  /* ---- model card (static) ---- */
  DA.$("#formula").innerHTML = `score = 100 × (<b>${w.activity_count}</b>·activity + <b>${w.time_spent_hours}</b>·time + <b>${w.lesson_progress_pct}</b>·lesson progress)`;
  const META = { activity_count: ["Activity count", "mouse-pointer-click", "var(--c1)"], time_spent_hours: ["Learning time", "clock", "var(--c2)"], lesson_progress_pct: ["Lesson progress", "list-checks", "var(--c3)"] };
  DA.$("#weights").innerHTML = Object.entries(w).map(([k, v]) => `
    <div class="w-row" style="--wc:${META[k][2]}"><span class="wi">${DA.icon(META[k][1])}</span><span>${META[k][0]}</span>
      <div class="bar-track"><div class="bar-fill" data-w="${v * 100}" style="background:${META[k][2]}"></div></div><b>${Math.round(v * 100)}%</b></div>`).join("");
  DA.$("#thresholds").innerHTML = `<span class="badge b-low">Low &lt; ${t.medium}</span><span class="badge b-medium">Medium ${t.medium}–${(t.high - 0.1).toFixed(1)}</span><span class="badge b-high">High ≥ ${t.high}</span>`;
  DA.$("#formulaNote").textContent = `Each input is clipped to its ${M.normalise_clip[0] * 100}th–${M.normalise_clip[1] * 100}th percentile, then scaled to 0–1. Bars show each input's weight.`;

  function renderKpis() {
    const g = DA.groupBy(rows, "engagement_category", L), n = rows.length || 1;
    const icon = { Low: "battery-low", Medium: "battery-medium", High: "battery-full" };
    const col = { Low: "var(--eng-low)", Medium: "var(--eng-med)", High: "var(--eng-high)" };
    DA.renderKpis(DA.$("#engKpis"), g.map((x) => ({
      label: `${x.name} engagement`, icon: icon[x.name], color: col[x.name], value: x.learners, meter: (x.learners / n) * 100,
      foot: `${DA.fmt((x.learners / n) * 100)}% of learners · ${x.learners ? `completion ${DA.fmt(x.completion)}%` : "–"}`,
      help: x.name === "Low" ? `Score below ${t.medium}` : x.name === "Medium" ? `Score ${t.medium}–${t.high - 0.1}` : `Score ${t.high} or above`,
    })));
  }

  DA.chart("scoreHist", (c) => {
    const h = DA.histogram(rows.map((r) => r.engagement_score), 0, 100, 5);
    const colors = h.labels.map((_, i) => (i * 5 >= t.high ? c.eng.High : i * 5 >= t.medium ? c.eng.Medium : c.eng.Low));
    const o = DA.barOptions({ decimals: 0, xTitle: "Engagement score", yTitle: "Learners" });
    o.scales.x.ticks = { maxRotation: 0, autoSkip: true, autoSkipPadding: 10 };
    return { type: "bar", data: { labels: h.labels, datasets: [DA.barDataset("Learners", h.counts, colors, { categoryPercentage: 0.94, barPercentage: 1, borderRadius: 3 })] }, options: o };
  });

  const outcome = (id, field, label, suffix) => DA.chart(id, (c) => {
    const g = DA.groupBy(rows, "engagement_category", L);
    return { type: "bar", data: { labels: L, datasets: [DA.barDataset(label, g.map((x) => (x.learners ? +x[field].toFixed(1) : 0)), L.map((l) => c.eng[l]))] },
      options: DA.barOptions({ suffix, max: 100, tooltipExtra: (items) => `\n n = ${g[items[0].dataIndex].learners} learners` }) };
  });
  outcome("outComp", "completion", "Completion rate", "%");
  outcome("outQuiz", "quiz", "Avg quiz score", "");
  outcome("outInactive", "inactive", "Inactive learners", "%");

  DA.chart("engModule", (c) => {
    const mods = M.modules.filter((m) => rows.some((r) => r.course_module === m));
    const share = (m, l) => { const r = rows.filter((x) => x.course_module === m); return r.length ? +((r.filter((x) => x.engagement_category === l).length / r.length) * 100).toFixed(1) : 0; };
    mods.sort((a, b) => share(b, "High") - share(a, "High"));
    return { type: "bar", data: { labels: mods, datasets: L.map((l) => DA.barDataset(l, mods.map((m) => share(m, l)), c.eng[l], { borderRadius: 0, borderWidth: { right: 2 }, borderColor: c.surface, borderSkipped: false })) },
      options: DA.barOptions({ horizontal: true, stacked: true, suffix: "%", legend: true, max: 100 }) };
  });

  DA.chart("engScatter", (c) => {
    const r = DA.pearson(rows.map((x) => x.engagement_score), rows.map((x) => x.quiz_score));
    DA.$("#engScatterSub").textContent = `Each point is one learner · Pearson r = ${isFinite(r) ? r.toFixed(2) : "–"}`;
    return {
      type: "scatter",
      data: { datasets: L.map((l) => ({ label: l, data: rows.filter((x) => x.engagement_category === l).map((x) => ({ x: x.engagement_score, y: x.quiz_score, id: x.learner_id })),
        backgroundColor: DA.alpha(c.eng[l], 0.7), pointRadius: 3.2, pointHoverRadius: 7, borderWidth: 0 })) },
      options: {
        onClick: (e, els, chart) => { const el = els[0]; if (el) DA.openLearner(chart.data.datasets[el.datasetIndex].data[el.index].id); },
        plugins: { legend: { position: "bottom", align: "start" }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw.id} · engagement ${ctx.raw.x} · quiz ${ctx.raw.y}` } } },
        scales: { x: { min: 0, max: 100, title: { display: true, text: "Engagement score", color: c.text3 } }, y: { min: 0, max: 100, title: { display: true, text: "Quiz score", color: c.text3 } } },
      },
    };
  });

  /* ---- live correlation matrix ---- */
  const VARS = [["time_spent_hours", "Learning hours"], ["activity_count", "Activity"], ["lesson_progress_pct", "Lesson progress"], ["video_completion_pct", "Video completion"],
    ["quiz_score", "Quiz score"], ["last_active_days", "Days inactive"], ["engagement_score", "Engagement"], ["is_completed", "Completed (0/1)"]];
  const val = (r, k) => (k === "is_completed" ? (r.completion_status === "Completed" ? 1 : 0) : r[k]);
  function cellColor(v) {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    const neutral = dark ? [23, 44, 50] : [242, 248, 249], pos = dark ? [44, 202, 211] : [17, 146, 155], neg = dark ? [127, 131, 242] : [91, 95, 227];
    const a = isFinite(v) ? Math.min(1, Math.abs(v)) : 0, target = v >= 0 ? pos : neg;
    const rgb = neutral.map((n, i) => Math.round(n + (target[i] - n) * a));
    return { bg: `rgb(${rgb.join(",")})`, fg: (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 > 0.6 ? "#1d2b36" : "#ffffff", neutral, pos, neg };
  }
  function renderHeatmap() {
    const cols = VARS.map(([k]) => rows.map((r) => val(r, k)));
    const m = VARS.map((_, i) => VARS.map((__, j) => (i === j ? 1 : DA.pearson(cols[i], cols[j]))));
    const hm = DA.$("#heatmap");
    hm.style.gridTemplateColumns = `max-content repeat(${VARS.length}, minmax(56px, 1fr))`;
    hm.innerHTML = VARS.map(([, a], i) => `<div class="hm-label">${a}</div>` + VARS.map(([, b], j) => {
      const v = m[i][j], { bg, fg } = cellColor(v);
      return `<div class="hm-cell" style="background:${bg};color:${fg};transition-delay:${((i + j) * 0.02).toFixed(2)}s" title="${a} × ${b}: r = ${isFinite(v) ? v.toFixed(2) : "n/a"}">${isFinite(v) ? v.toFixed(2) : "–"}</div>`;
    }).join("")).join("") + `<div></div>` + VARS.map(([, b]) => `<div class="hm-label hm-col">${b}</div>`).join("");
    const k = cellColor(0);
    DA.$("#hmScale").style.background = `linear-gradient(90deg, rgb(${k.neg}), rgb(${k.neutral}), rgb(${k.pos}))`;
    const idx = (key) => VARS.findIndex(([x]) => x === key);
    DA.$("#corrNote").textContent = rows.length > 2
      ? `Quiz score correlates most with lesson progress (r = ${m[idx("lesson_progress_pct")][idx("quiz_score")].toFixed(2)}). Correlation ≠ causation. n = ${DA.int(rows.length)}.`
      : "Select more learners to compute correlations.";
  }

  function renderAll() {
    renderKpis(); renderHeatmap();
    DA.refreshCharts(["scoreHist", "outComp", "outQuiz", "outInactive", "engModule", "engScatter"]);
  }
  DA.filters.onChange((r) => { rows = r; renderAll(); });
  document.addEventListener("themechange", renderHeatmap);
  renderKpis(); renderHeatmap();
});
