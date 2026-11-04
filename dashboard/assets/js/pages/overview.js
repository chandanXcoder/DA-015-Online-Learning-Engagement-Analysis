/* Overview page - headline KPIs, module comparison, status split, highlights. */
DA.ready(function (D) {
  const k = D.kpis;
  const sortedModules = [...D.module].sort((a, b) => b.completion_rate_pct - a.completion_rate_pct);
  const best = sortedModules[0], worst = sortedModules[sortedModules.length - 1];
  const devices = [...D.device].sort((a, b) => b.completion_rate_pct - a.completion_rate_pct);
  const high = DA.byName(D.engagement_outcomes, "High"), low = DA.byName(D.engagement_outcomes, "Low");

  /* hero */
  DA.$("#heroText").innerHTML =
    `Analysis of <b>${DA.int(k.total_learners)}</b> learners across <b>5 course modules</b>. ` +
    `The overall completion rate is <b>${k.completion_rate_pct}%</b>, and engagement (activity, learning time and lesson progress) ` +
    `turns out to be the strongest signal of who finishes.`;
  DA.$("#heroTags").innerHTML = D.meta.modules.map((m) => `<span>${DA.esc(m)}</span>`).join("") +
    `<span>${DA.int(D.meta.raw_rows)} raw → ${DA.int(D.meta.clean_rows)} clean records</span>`;

  /* KPI cards */
  DA.$("#kpis").innerHTML = [
    { label: "Total learners", value: k.total_learners, icon: "users", color: "var(--c1)", note: "synthetic cohort, 5 modules" },
    { label: "Completion rate", value: k.completion_rate_pct, decimals: 1, suffix: "%", icon: "award", color: "var(--c3)", note: `${DA.int(k.completed_learners)} learners completed` },
    { label: "Dropout rate", value: k.dropout_rate_pct, decimals: 1, suffix: "%", icon: "trendDown", color: "var(--c2)", note: `${k.in_progress_pct}% still in progress` },
    { label: "Avg quiz score", value: k.avg_quiz_score, decimals: 1, icon: "target", color: "var(--c1)", note: `median ${k.median_quiz_score}` },
    { label: "Avg learning hours", value: k.avg_learning_hours, decimals: 1, icon: "clock", color: "var(--c4)", note: `${DA.int(k.total_learning_hours)} hours in total` },
    { label: "Avg engagement score", value: k.avg_engagement_score, decimals: 1, icon: "activity", color: "var(--c5)", note: "0–100 composite score" },
    { label: "Avg lesson progress", value: k.avg_lesson_progress_pct, decimals: 1, suffix: "%", icon: "layers", color: "var(--c3)", note: `videos watched ${k.avg_video_completion_pct}%` },
    { label: `Inactive > ${D.meta.inactive_threshold_days} days`, value: k.inactive_pct, decimals: 1, suffix: "%", icon: "pause", color: "var(--c2)", note: `${DA.int(k.inactive_learners)} learners` },
  ].map(DA.kpiCard).join("");

  /* module completion */
  DA.chart("moduleCompletion", (c) => ({
    type: "bar",
    data: { labels: sortedModules.map((m) => m.name), datasets: [DA.barDataset("Completion rate", sortedModules.map((m) => m.completion_rate_pct), c.series[0])] },
    options: DA.barOptions({ suffix: "%" }),
  }));

  /* status doughnut */
  DA.chart("statusDonut", (c) => ({
    type: "doughnut",
    data: {
      labels: D.status.map((s) => s.name),
      datasets: [{ data: D.status.map((s) => s.learners), backgroundColor: D.status.map((s) => c.status[s.name]),
        borderColor: c.surface, borderWidth: 3, hoverOffset: 8 }],
    },
    options: {
      cutout: "68%",
      animation: { animateRotate: true, duration: 1400 },
      plugins: {
        legend: { position: "bottom" },
        centerText: { text: `${k.completion_rate_pct}%`, sub: "completed" },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${DA.int(ctx.parsed)} learners (${D.status[ctx.dataIndex].percent}%)` } },
      },
    },
  }));

  /* hours vs quiz scatter, coloured by status */
  const reg = D.regression;
  DA.$("#scatterSub").textContent = `Each dot is one learner · dashed line = linear trend (Pearson r = ${reg.r.toFixed(2)})`;
  const maxHours = Math.max(...D.learners.map((l) => l.time_spent_hours));
  DA.chart("hoursScatter", (c) => ({
    type: "scatter",
    data: {
      datasets: D.meta.statuses.map((s) => ({
        label: s,
        data: D.learners.filter((l) => l.completion_status === s).map((l) => ({ x: l.time_spent_hours, y: l.quiz_score, id: l.learner_id })),
        backgroundColor: DA.alpha(c.status[s], 0.6), borderColor: c.surface, borderWidth: 0.5, pointRadius: 4, pointHoverRadius: 7,
      })).concat([{
        type: "line", label: "Trend", data: [{ x: 0, y: reg.intercept }, { x: maxHours, y: reg.intercept + reg.slope * maxHours }],
        borderColor: c.text2, borderDash: [6, 5], borderWidth: 2, pointRadius: 0, pointHoverRadius: 0,
      }]),
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: (ctx) => ctx.raw.id ? ` ${ctx.raw.id} · ${ctx.dataset.label}: ${ctx.raw.x} h, score ${ctx.raw.y}` : " Linear trend" } },
      },
      scales: {
        x: { title: { display: true, text: "Time spent (hours)" }, beginAtZero: true },
        y: { title: { display: true, text: "Quiz score" }, min: 0, max: 100 },
      },
    },
  }));

  /* highlights */
  const items = [
    { icon: "award", color: "var(--c3)", title: `${best.name} leads on completion`, text: `${best.completion_rate_pct}% completion vs ${worst.completion_rate_pct}% for ${worst.name} (lowest).` },
    { icon: "zap", color: "var(--c1)", title: "Engagement separates outcomes", text: high && low ? `High-engagement learners score ${high.avg_quiz_score} on quizzes vs ${low.avg_quiz_score} for low engagement.` : "" },
    { icon: "monitor", color: "var(--c2)", title: `${devices[devices.length - 1].name} learners finish least`, text: `${devices[devices.length - 1].completion_rate_pct}% completion vs ${devices[0].completion_rate_pct}% on ${devices[0].name}.` },
    { icon: "clock", color: "var(--c4)", title: "More time, better scores", text: `Learning hours and quiz score correlate at r = ${reg.r.toFixed(2)} (moderate, positive).` },
    { icon: "pause", color: "var(--c5)", title: "Inactivity is widespread", text: `${DA.int(k.inactive_learners)} learners (${k.inactive_pct}%) have been inactive for more than ${D.meta.inactive_threshold_days} days.` },
  ];
  DA.$("#highlights").innerHTML = items.map((h) => `
    <div class="hl"><div class="hl-icon" style="background:${h.color}">${DA.icons[h.icon]}</div>
    <div><b>${DA.esc(h.title)}</b><span>${DA.esc(h.text)}</span></div></div>`).join("") +
    `<a class="btn" href="insights.html" style="align-self:flex-start">${DA.icons.bulb} See all insights</a>`;

  /* module quiz */
  const byQuiz = [...D.module].sort((a, b) => b.avg_quiz_score - a.avg_quiz_score);
  DA.chart("moduleQuiz", (c) => ({
    type: "bar",
    data: { labels: byQuiz.map((m) => m.name), datasets: [DA.barDataset("Avg quiz score", byQuiz.map((m) => m.avg_quiz_score), c.series[0])] },
    options: DA.barOptions({ max: 100 }),
  }));

  /* engagement categories: learner count per level (ordinal colours) */
  DA.chart("engagementBars", (c) => ({
    type: "bar",
    data: {
      labels: D.engagement_outcomes.map((e) => e.name),
      datasets: [DA.barDataset("Learners", D.engagement_outcomes.map((e) => e.learners), D.engagement_outcomes.map((e) => c.eng[e.name]))],
    },
    options: (() => {
      const o = DA.barOptions({ decimals: 0 });
      o.plugins.tooltip.callbacks.afterLabel = (ctx) => {
        const e = D.engagement_outcomes[ctx.dataIndex];
        return ` Completion rate: ${e.completion_rate_pct}%\n Avg quiz score: ${e.avg_quiz_score}`;
      };
      o.scales.y.title = { display: true, text: "Learners" };
      return o;
    })(),
  }));
});
