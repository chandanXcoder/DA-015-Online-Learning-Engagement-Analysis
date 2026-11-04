/* Executive Overview - KPIs, module comparison, status, scatter, funnel, at-risk list.
   Everything is computed from the learner rows that pass the global filters. */
DA.ready(function (D) {
  const M = D.meta;
  const ALL = DA.summarise(D.learners);
  let rows = DA.filters.rows();

  DA.$("#metaDate").textContent = `Data built ${M.generated}`;
  DA.$("#metaRows").textContent = `${DA.int(M.raw_rows)} raw → ${DA.int(M.clean_rows)} clean rows`;
  DA.filters.mount(DA.$("#filterbar"));

  function renderKpis() {
    const s = DA.summarise(rows);
    DA.renderKpis(DA.$("#kpis"), [
      { label: "Learners", icon: "users", color: "var(--c1)", value: s.learners, foot: DA.filters.active() ? `${DA.fmt((s.learners / ALL.learners) * 100)}% of cohort` : "5 modules · 4 devices",
        help: "Unique learners after cleaning (duplicates removed).", meter: (s.learners / ALL.learners) * 100 },
      { label: "Completion rate", icon: "circle-check-big", color: "var(--c3)", value: s.completion, decimals: 1, suffix: "%", meter: s.completion,
        foot: DA.filters.active() ? "vs all learners" : `${DA.int(s.completed)} completed`, delta: { value: DA.vsAll(s.completion, ALL.completion), unit: " pts", higherIsBetter: true },
        help: "Learners with status Completed ÷ learners." },
      { label: "Dropout rate", icon: "user-x", color: "var(--c2)", value: s.dropout, decimals: 1, suffix: "%", meter: s.dropout,
        foot: DA.filters.active() ? "vs all learners" : `${DA.fmt(s.inProgress)}% still in progress`, delta: { value: DA.vsAll(s.dropout, ALL.dropout), unit: " pts", higherIsBetter: false },
        help: "Learners with status Dropped ÷ learners." },
      { label: "Avg quiz score", icon: "target", color: "var(--c1)", value: s.quiz, decimals: 1, meter: s.quiz,
        foot: DA.filters.active() ? "vs all learners" : "out of 100", delta: { value: DA.vsAll(s.quiz, ALL.quiz), higherIsBetter: true }, help: "Mean quiz score (0–100)." },
      { label: "Avg learning hours", icon: "clock", color: "var(--c4)", value: s.hours, decimals: 1, suffix: " h",
        foot: DA.filters.active() ? "vs all learners" : `${DA.int(s.totalHours)} h in total`, delta: { value: DA.vsAll(s.hours, ALL.hours), unit: " h", higherIsBetter: true },
        help: "Mean total time spent on the platform." },
      { label: "Engagement score", icon: "gauge", color: "var(--c5)", value: s.engagement, decimals: 1, meter: s.engagement,
        foot: DA.filters.active() ? "vs all learners" : "0–100 composite", delta: { value: DA.vsAll(s.engagement, ALL.engagement), higherIsBetter: true },
        help: "Weighted score of activity (35%), learning time (35%) and lesson progress (30%)." },
    ]);
  }

  /* ---- charts (build functions read the current `rows`) ---- */
  DA.chart("moduleCompletion", (c) => {
    const g = DA.groupBy(rows, "course_module", M.modules).filter((x) => x.learners).sort((a, b) => b.completion - a.completion);
    return {
      type: "bar",
      data: { labels: g.map((x) => x.name), datasets: [
        DA.barDataset("Completion rate", g.map((x) => +x.completion.toFixed(1)), c.series[0]),
        { type: "line", label: "Cohort average", data: g.map(() => +ALL.completion.toFixed(1)), borderColor: c.text3, borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0 },
      ] },
      options: DA.barOptions({ suffix: "%", legend: true, tooltipExtra: (items) => { const x = g[items[0].dataIndex]; return x ? `\n ${x.completed} of ${x.learners} learners` : ""; } }),
    };
  });

  DA.chart("statusDonut", (c) => {
    const counts = M.statuses.map((s) => rows.filter((r) => r.completion_status === s).length);
    const n = rows.length || 1;
    return {
      type: "doughnut",
      data: { labels: M.statuses, datasets: [{ data: counts, backgroundColor: M.statuses.map((s) => c.status[s]), borderColor: c.surface, borderWidth: 3, hoverOffset: 6 }] },
      options: DA.doughnutOptions(`${DA.fmt((counts[0] / n) * 100)}%`, "completed", (ctx) => ` ${ctx.label}: ${DA.int(ctx.parsed)} (${DA.fmt((ctx.parsed / n) * 100)}%)`),
    };
  });

  DA.chart("hoursScatter", (c) => {
    const xs = rows.map((r) => r.time_spent_hours), ys = rows.map((r) => r.quiz_score);
    const fit = DA.linreg(xs, ys), maxX = Math.max(1, ...xs), r = DA.pearson(xs, ys);
    DA.$("#scatterSub").textContent = `Each point is one learner · Pearson r = ${isFinite(r) ? r.toFixed(2) : "–"} · n = ${DA.int(rows.length)}`;
    return {
      type: "scatter",
      data: { datasets: M.statuses.map((s) => ({
        label: s, data: rows.filter((l) => l.completion_status === s).map((l) => ({ x: l.time_spent_hours, y: l.quiz_score, id: l.learner_id })),
        backgroundColor: DA.alpha(c.status[s], 0.55), borderColor: DA.alpha(c.status[s], 0.9), borderWidth: 0.5, pointRadius: 3.5, pointHoverRadius: 7,
      })).concat([{ type: "line", label: "Trend", data: [{ x: 0, y: fit.a }, { x: maxX, y: fit.a + fit.b * maxX }],
        borderColor: c.text2, borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0 }]) },
      options: {
        onClick: (e, els, chart) => { const el = els[0]; if (!el) return; const p = chart.data.datasets[el.datasetIndex].data[el.index]; if (p.id) DA.openLearner(p.id); },
        plugins: { legend: { position: "bottom", align: "start" },
          tooltip: { callbacks: { label: (ctx) => ctx.raw.id ? ` ${ctx.raw.id} · ${ctx.dataset.label}` : " Linear trend",
            afterLabel: (ctx) => ctx.raw.id ? ` ${ctx.raw.x} h · quiz ${ctx.raw.y} · click for profile` : "" } } },
        scales: { x: { beginAtZero: true, title: { display: true, text: "Time spent (hours)", color: c.text3 } },
                  y: { min: 0, max: 100, title: { display: true, text: "Quiz score", color: c.text3 } } },
      },
    };
  });

  function renderFunnel() {
    const n = rows.length;
    const steps = [
      { name: "Enrolled", icon: "user-plus", v: n },
      { name: "Started (≥ 1 lesson)", icon: "play", v: rows.filter((r) => r.lessons_completed > 0).length },
      { name: "≥ 25% of lessons", icon: "chart-no-axes-column", v: rows.filter((r) => r.lesson_progress_pct >= 25).length },
      { name: "≥ 50% of lessons", icon: "chart-no-axes-column-increasing", v: rows.filter((r) => r.lesson_progress_pct >= 50).length },
      { name: "≥ 75% of lessons", icon: "trending-up", v: rows.filter((r) => r.lesson_progress_pct >= 75).length },
      { name: "Completed", icon: "trophy", v: rows.filter((r) => r.completion_status === "Completed").length },
    ];
    const cols = ["var(--eng-low)", "var(--eng-low)", "var(--eng-med)", "var(--eng-med)", "var(--eng-high)", "var(--c3)"];
    DA.$("#funnel").innerHTML = steps.map((s, i) => `
      <div class="f-row"><span class="f-name">${DA.icon(s.icon)}${s.name}</span>
        <div class="f-bar"><i data-w="${n ? ((s.v / n) * 100).toFixed(1) : 0}" style="background:${cols[i]}"></i></div>
        <span class="f-val" title="${i && steps[i - 1].v ? DA.fmt((s.v / steps[i - 1].v) * 100) + "% of previous step" : ""}"><b>${DA.int(s.v)}</b><small>${n ? DA.fmt((s.v / n) * 100) : "–"}%</small></span></div>`).join("");
    DA.paintIcons();
    DA.fillBars(DA.$("#funnel"));
  }

  DA.chart("moduleQuiz", (c) => {
    const g = DA.groupBy(rows, "course_module", M.modules).filter((x) => x.learners).sort((a, b) => b.quiz - a.quiz);
    return { type: "bar", data: { labels: g.map((x) => x.name), datasets: [DA.barDataset("Avg quiz score", g.map((x) => +x.quiz.toFixed(1)), c.series[0])] },
      options: DA.barOptions({ horizontal: true, max: 100 }) };
  });

  DA.chart("engagementBars", (c) => {
    const g = DA.groupBy(rows, "engagement_category", M.engagement_labels);
    return {
      type: "bar",
      data: { labels: g.map((x) => x.name), datasets: [DA.barDataset("Learners", g.map((x) => x.learners), g.map((x) => c.eng[x.name]))] },
      options: DA.barOptions({ decimals: 0, tooltipExtra: (items) => { const x = g[items[0].dataIndex]; return x.learners ? `\n Completion: ${DA.fmt(x.completion)}%\n Avg quiz: ${DA.fmt(x.quiz)}` : ""; } }),
    };
  });

  function renderAtRisk() {
    // Transparent rule: still In Progress, Low engagement, and no activity for 14+ days.
    const list = rows.filter(DA.isAtRisk).sort((a, b) => a.engagement_score - b.engagement_score);
    DA.$("#atRisk").innerHTML = list.length ? list.slice(0, 5).map((r) => `
      <div class="li clickable" data-id="${r.learner_id}"><span class="avatar">${r.learner_id.slice(-3)}</span>
        <div class="txt"><b>${r.learner_id} · ${DA.esc(r.course_module)}</b><span>${r.lessons_completed}/${r.lessons_available} lessons · inactive ${r.last_active_days} days</span></div>
        <div class="end"><b>${DA.fmt(r.engagement_score)}</b>engagement</div></div>`).join("") +
      `<a class="btn sm" style="margin-top:10px;align-self:flex-start" href="learners.html#risk=1">${DA.icon("arrow-right")}View all ${DA.int(list.length)} at-risk learners</a>`
      : `<div class="empty">${DA.icon("shield-check")}No at-risk learners in this selection</div>`;
    DA.$$("#atRisk .li").forEach((li) => li.addEventListener("click", () => DA.openLearner(li.dataset.id)));
    DA.paintIcons();
  }

  function renderAll() {
    renderKpis();
    renderFunnel();
    renderAtRisk();
    DA.refreshCharts(["moduleCompletion", "statusDonut", "hoursScatter", "moduleQuiz", "engagementBars"]);
  }
  DA.filters.onChange((r) => { rows = r; renderAll(); });
  renderKpis(); renderFunnel(); renderAtRisk();
});
