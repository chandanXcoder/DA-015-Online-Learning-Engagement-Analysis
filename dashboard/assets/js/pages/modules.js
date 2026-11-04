/* Course Modules - scorecard, comparison charts and a module deep-dive.
   The module slicer is hidden here (modules are compared side by side);
   all other global filters still apply. */
DA.ready(function (D) {
  const M = D.meta;
  let rows = DA.filters.rows("course_module");
  let selected = M.modules.includes(DA.hashParams().get("module")) ? DA.hashParams().get("module") : M.modules[0];
  let sort = { key: "completion", dir: -1 };

  DA.filters.mount(DA.$("#filterbar"), { hide: ["course_module"] });

  const groups = () => DA.groupBy(rows, "course_module", M.modules).map((g) => ({
    ...g, atRisk: rows.filter((r) => r.course_module === g.name && DA.isAtRisk(r)).length,
  }));
  const byCompletion = () => groups().filter((g) => g.learners).sort((a, b) => b.completion - a.completion);

  /* ---------- scorecard ---------- */
  const COLS = [
    { key: "name", label: "Module" }, { key: "learners", label: "Learners", num: true }, { key: "completion", label: "Completion" },
    { key: "dropout", label: "Dropout" }, { key: "quiz", label: "Avg quiz" }, { key: "hours", label: "Avg hours", num: true },
    { key: "progress", label: "Lesson progress" }, { key: "engagement", label: "Engagement", num: true }, { key: "atRisk", label: "At risk", num: true },
  ];
  function renderScorecard() {
    const g = groups().filter((x) => x.learners);
    const ranks = Object.fromEntries([...g].sort((a, b) => b.completion - a.completion).map((x, i) => [x.name, i + 1]));
    g.sort((a, b) => (a[sort.key] > b[sort.key] ? sort.dir : a[sort.key] < b[sort.key] ? -sort.dir : 0));
    const qMin = Math.min(...g.map((x) => x.quiz)), qMax = Math.max(...g.map((x) => x.quiz));
    const heat = (v) => { const t = qMax > qMin ? (v - qMin) / (qMax - qMin) : 0.5; return `background:color-mix(in srgb, var(--c3) ${Math.round(10 + t * 35)}%, transparent)`; };
    DA.$("#scorecard").innerHTML = `
      <thead><tr>${COLS.map((c) => `<th class="sortable ${c.num ? "num" : ""} ${sort.key === c.key ? "sorted" : ""}" data-key="${c.key}">${c.label}<span class="arrow">${sort.key === c.key ? (sort.dir > 0 ? "▲" : "▼") : "↕"}</span></th>`).join("")}</tr></thead>
      <tbody>${g.map((x) => `<tr class="clickable" data-m="${DA.esc(x.name)}">
        <td><span class="rank ${ranks[x.name] === 1 ? "r1" : ""}">${ranks[x.name]}</span><b>${DA.esc(x.name)}</b></td>
        <td class="num">${DA.int(x.learners)}</td>
        <td>${DA.barCell(x.completion, 100, "var(--c1)", 1, "%")}</td>
        <td>${DA.barCell(x.dropout, 100, "var(--c2)", 1, "%")}</td>
        <td><span class="badge b-neutral" style="${heat(x.quiz)};color:var(--text)">${DA.fmt(x.quiz)}</span></td>
        <td class="num">${DA.fmt(x.hours)}</td>
        <td>${DA.barCell(x.progress, 100, "var(--c4)", 1, "%")}</td>
        <td class="num">${DA.fmt(x.engagement)}</td>
        <td class="num">${x.atRisk ? `<span class="badge b-dropped">${x.atRisk}</span>` : `<span class="muted">0</span>`}</td></tr>`).join("")}</tbody>`;
    DA.fillBars(DA.$("#scorecard"));
  }
  DA.$("#scorecard").addEventListener("click", (e) => {
    const th = e.target.closest("th[data-key]");
    if (th) { const k = th.dataset.key; sort = { key: k, dir: sort.key === k ? -sort.dir : k === "name" ? 1 : -1 }; renderScorecard(); return; }
    const tr = e.target.closest("tr[data-m]");
    if (tr) { select(tr.dataset.m); DA.$("#deep").scrollIntoView({ behavior: "smooth", block: "start" }); }
  });
  DA.$("#exportModules").addEventListener("click", () => {
    const g = groups().map((x) => ({ module: x.name, learners: x.learners, completion_rate_pct: x.completion.toFixed(1), dropout_rate_pct: x.dropout.toFixed(1),
      avg_quiz_score: x.quiz.toFixed(1), avg_hours: x.hours.toFixed(1), avg_lesson_progress_pct: x.progress.toFixed(1), avg_engagement: x.engagement.toFixed(1), at_risk: x.atRisk }));
    DA.downloadCSV(g, Object.keys(g[0]), "module_scorecard.csv");
  });

  /* ---------- comparison charts (selected module highlighted) ---------- */
  const tint = (names, base, c) => names.map((n) => (n === selected ? base : DA.alpha(base, c.dark ? 0.45 : 0.4)));
  DA.chart("compDrop", (c) => {
    const g = byCompletion(), n = g.map((x) => x.name);
    return { type: "bar", data: { labels: n, datasets: [
      DA.barDataset("Completion rate", g.map((x) => +x.completion.toFixed(1)), tint(n, c.series[0], c)),
      DA.barDataset("Dropout rate", g.map((x) => +x.dropout.toFixed(1)), tint(n, c.series[1], c)),
    ] }, options: DA.barOptions({ suffix: "%", legend: true }) };
  });
  DA.chart("statusMix", (c) => {
    const g = byCompletion();
    const share = (m, s) => { const r = rows.filter((x) => x.course_module === m); return r.length ? +((r.filter((x) => x.completion_status === s).length / r.length) * 100).toFixed(1) : 0; };
    return { type: "bar", data: { labels: g.map((x) => x.name), datasets: M.statuses.map((s) =>
      DA.barDataset(s, g.map((x) => share(x.name, s)), c.status[s], { borderRadius: 0, borderWidth: { right: 2 }, borderColor: c.surface, borderSkipped: false })) },
      options: DA.barOptions({ horizontal: true, stacked: true, suffix: "%", legend: true, max: 100 }) };
  });
  const single = (id, field, label, opts) => DA.chart(id, (c) => {
    const g = byCompletion(), n = g.map((x) => x.name);
    return { type: "bar", data: { labels: n, datasets: [DA.barDataset(label, g.map((x) => +x[field].toFixed(1)), tint(n, c.series[0], c))] }, options: DA.barOptions(opts) };
  });
  single("quizBar", "quiz", "Avg quiz score", { max: 100, horizontal: true });
  single("hoursBar", "hours", "Avg hours", { suffix: " h", horizontal: true });
  single("progressBar", "progress", "Lesson progress", { suffix: "%", max: 100, horizontal: true });

  /* ---------- deep-dive ---------- */
  DA.$("#moduleSeg").innerHTML = M.modules.map((m) => `<button data-m="${DA.esc(m)}">${DA.esc(m)}</button>`).join("");
  const modRows = () => rows.filter((r) => r.course_module === selected);
  const otherRows = () => rows.filter((r) => r.course_module !== selected);

  function renderDeepStats() {
    const s = DA.summarise(modRows()), o = DA.summarise(otherRows());
    const d = (v, base, dec, unit, higher) => {
      if (!isFinite(v) || !isFinite(base)) return "";
      const diff = v - base, flat = Math.abs(diff) < 0.05, good = (diff > 0) === higher;
      return `<span class="delta ${flat ? "flat" : good ? "up" : "down"}">${DA.icon(flat ? "minus" : diff > 0 ? "arrow-up-right" : "arrow-down-right")}${DA.fmt(Math.abs(diff), dec)}${unit}</span>`;
    };
    DA.$("#deepStats").innerHTML = [
      ["Learners", DA.int(s.learners), `${rows.length ? DA.fmt((s.learners / rows.length) * 100) : "–"}% of selection`],
      ["Completion", DA.fmt(s.completion) + "%", `${d(s.completion, o.completion, 1, " pts", true)} vs other modules`],
      ["Dropout", DA.fmt(s.dropout) + "%", `${d(s.dropout, o.dropout, 1, " pts", false)} vs other modules`],
      ["Avg quiz", DA.fmt(s.quiz), `${d(s.quiz, o.quiz, 1, "", true)} vs other modules`],
      ["Avg hours", DA.fmt(s.hours) + " h", `${d(s.hours, o.hours, 1, " h", true)} vs other modules`],
      ["At-risk learners", DA.int(modRows().filter(DA.isAtRisk).length), "in progress · low · ≥14 d"],
    ].map(([k, v, sub]) => `<div class="mini"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${sub}</div></div>`).join("");
    DA.paintIcons();
    DA.$("#histSub").textContent = `${selected} vs other modules · % of learners per band`;
  }

  DA.chart("deepStatus", (c) => {
    const r = modRows(), counts = M.statuses.map((s) => r.filter((x) => x.completion_status === s).length), n = r.length || 1;
    return { type: "doughnut", data: { labels: M.statuses, datasets: [{ data: counts, backgroundColor: M.statuses.map((s) => c.status[s]), borderColor: c.surface, borderWidth: 3, hoverOffset: 6 }] },
      options: DA.doughnutOptions(`${DA.fmt((counts[0] / n) * 100)}%`, "completed", (ctx) => ` ${ctx.label}: ${ctx.parsed} (${DA.fmt((ctx.parsed / n) * 100)}%)`) };
  });
  DA.chart("deepEng", (c) => {
    const r = modRows(), L = M.engagement_labels, counts = L.map((e) => r.filter((x) => x.engagement_category === e).length), n = r.length || 1;
    return { type: "doughnut", data: { labels: L, datasets: [{ data: counts, backgroundColor: L.map((e) => c.eng[e]), borderColor: c.surface, borderWidth: 3, hoverOffset: 6 }] },
      options: DA.doughnutOptions(DA.fmt(DA.mean(r.map((x) => x.engagement_score))), "avg score", (ctx) => ` ${ctx.label}: ${ctx.parsed} (${DA.fmt((ctx.parsed / n) * 100)}%)`) };
  });
  DA.chart("deepHist", (c) => {
    const a = modRows(), b = otherRows();
    const ha = DA.histogram(a.map((x) => x.quiz_score), 0, 100, 10), hb = DA.histogram(b.map((x) => x.quiz_score), 0, 100, 10);
    const pct = (arr, n) => arr.map((v) => (n ? +((v / n) * 100).toFixed(1) : 0));
    const o = DA.barOptions({ suffix: "%", legend: true });
    o.scales.x.ticks = { maxRotation: 0, autoSkip: true, autoSkipPadding: 8 };
    return { type: "bar", data: { labels: ha.labels, datasets: [
      DA.barDataset(selected, pct(ha.counts, a.length), c.series[0], { categoryPercentage: 0.92, barPercentage: 1, borderRadius: 3 }),
      { type: "line", label: "Other modules", data: pct(hb.counts, b.length), borderColor: c.series[1], backgroundColor: c.series[1], borderWidth: 2, pointRadius: 2.5, tension: 0.35 },
    ] }, options: o };
  });

  function select(m) {
    selected = m;
    DA.$$("#moduleSeg button").forEach((b) => b.classList.toggle("active", b.dataset.m === m));
    renderDeepStats();
    DA.refreshCharts(["deepStatus", "deepEng", "deepHist", "compDrop", "quizBar", "hoursBar", "progressBar"]);
  }
  DA.$("#moduleSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) select(b.dataset.m); });
  window.addEventListener("hashchange", () => { const m = DA.hashParams().get("module"); if (M.modules.includes(m)) select(m); });

  DA.filters.onChange(() => {
    rows = DA.filters.rows("course_module");
    renderScorecard(); renderDeepStats();
    DA.refreshCharts(["compDrop", "statusMix", "quizBar", "hoursBar", "progressBar", "deepStatus", "deepEng", "deepHist"]);
  });
  renderScorecard();
  select(selected);
});
