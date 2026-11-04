/* Engagement page - score model, distribution, outcomes, module mix, correlation heatmap. */
DA.ready(function (D) {
  const w = D.meta.engagement_weights;
  const t = D.meta.engagement_thresholds;
  const labels = D.meta.engagement_labels;
  const out = labels.map((l) => DA.byName(D.engagement_outcomes, l) || { name: l, learners: 0 });

  /* formula + animated weight bars */
  DA.$("#formula").textContent =
    `score = 100 × (${w.activity_count}·activity + ${w.time_spent_hours}·time + ${w.lesson_progress_pct}·lesson progress)`;
  const nice = { activity_count: "Activity count", time_spent_hours: "Learning time", lesson_progress_pct: "Lesson progress" };
  DA.$("#weights").innerHTML = Object.entries(w).map(([key, val], i) => `
    <div class="weight-row"><span>${nice[key] || key}</span>
      <div class="bar-track"><div class="bar-fill" data-w="${val * 100}" style="background:var(--c${i + 1})"></div></div>
      <b>${Math.round(val * 100)}%</b></div>`).join("");
  DA.$("#thresholds").innerHTML =
    `<span class="badge b-low">Low &lt; ${t.medium}</span><span class="badge b-medium">Medium ${t.medium}–${t.high - 0.1}</span><span class="badge b-high">High ≥ ${t.high}</span>`;
  const clip = D.meta.normalise_clip;
  DA.$("#formulaNote").innerHTML = `Each input is clipped to its ${clip[0] * 100}th–${clip[1] * 100}th percentile and scaled to 0–1. ` +
    `Quiz score and completion are <b>not</b> in the formula, so the charts below test the score against independent outcomes.`;

  /* category KPI cards */
  const total = D.kpis.total_learners;
  const catColor = { Low: "var(--eng-low)", Medium: "var(--eng-med)", High: "var(--eng-high)" };
  DA.$("#engKpis").innerHTML = out.map((o) => DA.kpiCard({
    label: `${o.name} engagement`, value: o.learners, icon: o.name === "High" ? "zap" : o.name === "Medium" ? "activity" : "pause",
    color: catColor[o.name], note: `${DA.fmt((o.learners / total) * 100)}% of learners · avg score ${DA.fmt(o.avg_engagement_score)}`,
  })).join("");

  /* score histogram coloured by category */
  DA.chart("scoreHist", (c) => {
    const h = DA.histogram(D.learners.map((l) => l.engagement_score), 0, 100, 5);
    const colors = h.labels.map((_, i) => { const lo = i * 5; return lo >= t.high ? c.eng.High : lo >= t.medium ? c.eng.Medium : c.eng.Low; });
    const o = DA.barOptions({ decimals: 0 });
    o.scales.x.title = { display: true, text: "Engagement score" };
    o.scales.y.title = { display: true, text: "Learners" };
    o.scales.x.ticks = { maxRotation: 0, autoSkip: true, autoSkipPadding: 8 };
    return { type: "bar", data: { labels: h.labels, datasets: [DA.barDataset("Learners", h.counts, colors, { categoryPercentage: 0.95, barPercentage: 1, borderRadius: 4 })] }, options: o };
  });

  /* outcomes by category */
  const outcome = (id, field, label, suffix, max) => DA.chart(id, (c) => ({
    type: "bar",
    data: { labels, datasets: [DA.barDataset(label, out.map((o) => o[field]), labels.map((l) => c.eng[l]))] },
    options: DA.barOptions({ suffix, max }),
  }));
  outcome("outComp", "completion_rate_pct", "Completion rate", "%", 100);
  outcome("outQuiz", "avg_quiz_score", "Avg quiz score", "", 100);
  outcome("outInactive", "inactive_pct", "Inactive learners", "%", 100);

  /* engagement mix by module (stacked) */
  const em = [...D.engagement_module].sort((a, b) => b.High - a.High);
  DA.chart("engModule", (c) => ({
    type: "bar",
    data: { labels: em.map((r) => r.name), datasets: labels.map((l) =>
      DA.barDataset(l, em.map((r) => r[l]), c.eng[l], { borderRadius: 0, borderWidth: { right: 2 }, borderColor: c.surface })) },
    options: DA.barOptions({ horizontal: true, stacked: true, suffix: "%", legend: true, max: 100 }),
  }));

  /* engagement vs quiz scatter */
  DA.chart("engScatter", (c) => ({
    type: "scatter",
    data: { datasets: labels.map((l) => ({
      label: l, data: D.learners.filter((r) => r.engagement_category === l).map((r) => ({ x: r.engagement_score, y: r.quiz_score, id: r.learner_id })),
      backgroundColor: DA.alpha(c.eng[l].startsWith("#") ? c.eng[l] : "#5b9be3", 0.7), pointRadius: 3.5, pointHoverRadius: 7, borderWidth: 0,
    })) },
    options: {
      plugins: { legend: { position: "bottom" },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw.id} · engagement ${ctx.raw.x}, quiz ${ctx.raw.y}` } } },
      scales: { x: { min: 0, max: 100, title: { display: true, text: "Engagement score" } },
                y: { min: 0, max: 100, title: { display: true, text: "Quiz score" } } },
    },
  }));

  /* correlation heatmap (HTML grid so every cell is labelled) */
  const names = { time_spent_hours: "Learning hours", activity_count: "Activity count", lesson_progress_pct: "Lesson progress",
    video_completion_pct: "Video completion", quiz_score: "Quiz score", last_active_days: "Days since active",
    engagement_score: "Engagement score", is_completed: "Completed (0/1)" };
  const L = D.correlation.labels, M = D.correlation.matrix;
  function cellColor(v) {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    const neutral = dark ? [38, 42, 49] : [242, 241, 238];
    const pos = dark ? [217, 89, 38] : [196, 80, 31];
    const neg = dark ? [57, 135, 229] : [28, 90, 166];
    const target = v >= 0 ? pos : neg;
    const a = Math.min(1, Math.abs(v));
    const rgb = neutral.map((n, i) => Math.round(n + (target[i] - n) * a));
    const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
    return { bg: `rgb(${rgb.join(",")})`, fg: lum > 0.6 ? "#121417" : "#ffffff" };
  }
  function renderHeatmap() {
    const hm = DA.$("#heatmap");
    hm.style.gridTemplateColumns = `max-content repeat(${L.length}, minmax(52px, 1fr))`;
    let html = "";
    L.forEach((row, i) => {
      html += `<div class="hm-label">${names[row] || row}</div>`;
      L.forEach((col, j) => {
        const v = M[i][j];
        const { bg, fg } = cellColor(v);
        html += `<div class="hm-cell" style="background:${bg};color:${fg};transition-delay:${((i + j) * 0.025).toFixed(3)}s"
          title="${names[row] || row} × ${names[col] || col}: r = ${v.toFixed(2)}">${v.toFixed(2)}</div>`;
      });
    });
    html += `<div></div>` + L.map((col) => `<div class="hm-label hm-col">${names[col] || col}</div>`).join("");
    hm.innerHTML = html;
  }
  renderHeatmap();
  document.addEventListener("themechange", renderHeatmap);

  const r = (a, b) => M[L.indexOf(a)][L.indexOf(b)];
  DA.$("#corrNote").innerHTML =
    `Strongest link with quiz score: lesson progress (r = ${r("lesson_progress_pct", "quiz_score").toFixed(2)}). ` +
    `Activity vs completion r = ${r("activity_count", "is_completed").toFixed(2)}; days since last active vs completion r = ${r("last_active_days", "is_completed").toFixed(2)}. ` +
    `Correlation shows association, not causation.`;
});
