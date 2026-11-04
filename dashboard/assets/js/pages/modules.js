/* Course Modules page - comparison table/charts and an interactive module deep-dive. */
DA.ready(function (D) {
  const modules = [...D.module].sort((a, b) => b.completion_rate_pct - a.completion_rate_pct);
  const names = modules.map((m) => m.name);
  let selected = "All";

  /* comparison table */
  DA.$("#moduleTable").innerHTML = `
    <thead><tr><th>Module</th><th class="num">Learners</th><th>Completion</th><th>Dropout</th><th>Avg quiz</th>
      <th class="num">Avg hours</th><th>Lesson progress</th><th class="num">Avg activity</th><th class="num">Engagement</th></tr></thead>
    <tbody>${modules.map((m) => `<tr>
      <td><b>${DA.esc(m.name)}</b></td><td class="num">${DA.int(m.learners)}</td>
      <td>${DA.barCell(m.completion_rate_pct, 100, "var(--c1)", 1, "%")}</td>
      <td>${DA.barCell(m.dropout_rate_pct, 100, "var(--c2)", 1, "%")}</td>
      <td>${DA.barCell(m.avg_quiz_score, 100, "var(--c3)")}</td>
      <td class="num">${DA.fmt(m.avg_hours)}</td>
      <td>${DA.barCell(m.avg_lesson_progress_pct, 100, "var(--c4)", 1, "%")}</td>
      <td class="num">${DA.fmt(m.avg_activity)}</td><td class="num">${DA.fmt(m.avg_engagement_score)}</td></tr>`).join("")}</tbody>`;

  /* highlight the selected module in comparison charts, mute the others */
  const colorFor = (base, c) => names.map((n) => (selected === "All" || selected === n ? base : c.muted));

  DA.chart("compDrop", (c) => ({
    type: "bar",
    data: { labels: names, datasets: [
      DA.barDataset("Completion rate", modules.map((m) => m.completion_rate_pct), selected === "All" ? c.series[0] : colorFor(c.series[0], c)),
      DA.barDataset("Dropout rate", modules.map((m) => m.dropout_rate_pct), selected === "All" ? c.series[1] : colorFor(c.series[1], c)),
    ] },
    options: DA.barOptions({ suffix: "%", legend: true }),
  }));

  /* status mix from learner rows */
  const statusShare = (mod, status) => {
    const rows = D.learners.filter((l) => l.course_module === mod);
    return (rows.filter((l) => l.completion_status === status).length / rows.length) * 100;
  };
  DA.chart("statusMix", (c) => ({
    type: "bar",
    data: { labels: names, datasets: D.meta.statuses.map((s) =>
      DA.barDataset(s, names.map((n) => +statusShare(n, s).toFixed(1)), c.status[s], { borderRadius: 0, borderWidth: { right: 2 }, borderColor: c.surface })) },
    options: DA.barOptions({ horizontal: true, stacked: true, suffix: "%", legend: true, max: 100 }),
  }));

  const single = (id, key, color, opts) => DA.chart(id, (c) => ({
    type: "bar",
    data: { labels: names, datasets: [DA.barDataset(key.label, modules.map((m) => m[key.field]), colorFor(c.series[color], c))] },
    options: DA.barOptions(opts),
  }));
  single("quizBar", { field: "avg_quiz_score", label: "Avg quiz score" }, 0, { max: 100 });
  single("hoursBar", { field: "avg_hours", label: "Avg hours" }, 0, { suffix: " h" });
  single("progressBar", { field: "avg_lesson_progress_pct", label: "Lesson progress" }, 0, { suffix: "%", max: 100 });

  /* ---------- deep-dive ---------- */
  const seg = DA.$("#moduleSeg");
  seg.innerHTML = ["All", ...D.meta.modules].map((m) => `<button data-m="${DA.esc(m)}" class="${m === "All" ? "active" : ""}">${m === "All" ? "All modules" : DA.esc(m)}</button>`).join("");

  const rowsFor = () => (selected === "All" ? D.learners : D.learners.filter((l) => l.course_module === selected));

  function renderStats() {
    const s = DA.summarise(rowsFor());
    const all = DA.summarise(D.learners);
    const diff = (v, base, d = 1, unit = "") => {
      if (selected === "All") return "all learners";
      const delta = v - base;
      return `${delta >= 0 ? "▲" : "▼"} ${DA.fmt(Math.abs(delta), d)}${unit} vs overall`;
    };
    DA.$("#deepStats").innerHTML = [
      ["Learners", s.learners, 0, "", selected === "All" ? "all modules" : `${DA.fmt((s.learners / all.learners) * 100)}% of cohort`],
      ["Completion", s.completion, 1, "%", diff(s.completion, all.completion, 1, " pts")],
      ["Dropout", s.dropout, 1, "%", diff(s.dropout, all.dropout, 1, " pts")],
      ["Avg quiz", s.quiz, 1, "", diff(s.quiz, all.quiz)],
      ["Avg hours", s.hours, 1, "", diff(s.hours, all.hours, 1, " h")],
      ["Engagement", s.engagement, 1, "", diff(s.engagement, all.engagement)],
    ].map(([k, v, d, suf, sub]) => `<div class="mini visible"><div class="k">${k}</div>
      <div class="v" data-count="${v}" data-decimals="${d}" data-suffix="${suf}">0</div><div class="s">${sub}</div></div>`).join("");
    DA.$$("#deepStats [data-count]").forEach((n) => { n.dataset.counted = "1"; DA.countUp(n); });
    DA.$("#deepNote").textContent = selected === "All" ? "Pick a module to compare it with the whole cohort" : `Showing ${selected} vs all learners`;
  }

  DA.chart("deepStatus", (c) => {
    const rows = rowsFor();
    const counts = D.meta.statuses.map((s) => rows.filter((r) => r.completion_status === s).length);
    return {
      type: "doughnut",
      data: { labels: D.meta.statuses, datasets: [{ data: counts, backgroundColor: D.meta.statuses.map((s) => c.status[s]), borderColor: c.surface, borderWidth: 3, hoverOffset: 6 }] },
      options: { cutout: "66%", plugins: { legend: { position: "bottom" },
        centerText: { text: `${DA.fmt((counts[0] / rows.length) * 100)}%`, sub: "completed" },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} (${DA.fmt((ctx.parsed / rows.length) * 100)}%)` } } } },
    };
  });

  DA.chart("deepEng", (c) => {
    const rows = rowsFor();
    const labels = D.meta.engagement_labels;
    const counts = labels.map((e) => rows.filter((r) => r.engagement_category === e).length);
    return {
      type: "doughnut",
      data: { labels, datasets: [{ data: counts, backgroundColor: labels.map((e) => c.eng[e]), borderColor: c.surface, borderWidth: 3, hoverOffset: 6 }] },
      options: { cutout: "66%", plugins: { legend: { position: "bottom" },
        centerText: { text: DA.fmt(DA.mean(rows.map((r) => r.engagement_score))), sub: "avg score" },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} (${DA.fmt((ctx.parsed / rows.length) * 100)}%)` } } } },
    };
  });

  DA.chart("deepHist", (c) => {
    const rows = rowsFor();
    const sel = DA.histogram(rows.map((r) => r.quiz_score), 0, 100, 10);
    const all = DA.histogram(D.learners.map((r) => r.quiz_score), 0, 100, 10);
    const pct = (arr, n) => arr.map((v) => +((v / n) * 100).toFixed(1));
    const datasets = [DA.barDataset(selected === "All" ? "All learners" : selected, pct(sel.counts, rows.length), c.series[0], { categoryPercentage: 0.9, barPercentage: 1 })];
    if (selected !== "All") datasets.push({ type: "line", label: "All learners", data: pct(all.counts, D.learners.length),
      borderColor: c.series[1], backgroundColor: c.series[1], borderWidth: 2, pointRadius: 3, tension: 0.35 });
    const o = DA.barOptions({ suffix: "%", legend: selected !== "All" });
    o.scales.x.ticks = { maxRotation: 0, autoSkip: true, autoSkipPadding: 6 };
    o.scales.y.title = { display: true, text: "% of learners" };
    return { type: "bar", data: { labels: sel.labels, datasets }, options: o };
  });

  seg.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    selected = btn.dataset.m;
    DA.$$("button", seg).forEach((b) => b.classList.toggle("active", b === btn));
    renderStats();
    ["deepStatus", "deepEng", "deepHist", "compDrop", "quizBar", "hoursBar", "progressBar"].forEach(DA.refreshChart);
  });

  renderStats();
});
