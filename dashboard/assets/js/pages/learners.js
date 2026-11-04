/* Learner Explorer - filter, search, sort, paginate and export the cleaned learner records. */
DA.ready(function (D) {
  const state = { q: "", filters: {}, inactive: "All", sort: { col: "learner_id", dir: 1 }, page: 0, size: 25 };
  const inactiveDays = D.meta.inactive_threshold_days;

  const COLUMNS = [
    { key: "learner_id", label: "Learner" },
    { key: "course_module", label: "Module" },
    { key: "age_group", label: "Age" },
    { key: "device_type", label: "Device" },
    { key: "time_spent_hours", label: "Hours", num: true },
    { key: "lesson_progress_pct", label: "Lessons", num: true },
    { key: "quiz_score", label: "Quiz", num: true },
    { key: "activity_count", label: "Activity", num: true },
    { key: "engagement_score", label: "Engagement" },
    { key: "engagement_category", label: "Level" },
    { key: "completion_status", label: "Status" },
    { key: "last_active_days", label: "Last active", num: true },
  ];

  /* filter dropdowns */
  const options = { fModule: D.meta.modules, fDevice: D.meta.devices, fAge: D.meta.age_groups, fStatus: D.meta.statuses, fEng: D.meta.engagement_labels };
  Object.entries(options).forEach(([id, values]) => {
    DA.$("#" + id).innerHTML = `<option value="All">All</option>` + values.map((v) => `<option>${DA.esc(v)}</option>`).join("");
  });
  DA.$("#resetBtn").innerHTML = `${DA.icons.reset} Reset`;
  DA.$("#exportBtn").innerHTML = `${DA.icons.download} Export CSV`;

  function filtered() {
    const q = state.q.trim().toUpperCase();
    let rows = D.learners.filter((r) =>
      (!q || r.learner_id.toUpperCase().includes(q)) &&
      Object.entries(state.filters).every(([col, val]) => val === "All" || r[col] === val) &&
      (state.inactive === "All" || (state.inactive === "inactive" ? r.last_active_days > inactiveDays : r.last_active_days <= inactiveDays)));
    const { col, dir } = state.sort;
    rows = rows.slice().sort((a, b) => (a[col] > b[col] ? dir : a[col] < b[col] ? -dir : 0));
    return rows;
  }

  function renderStats(rows) {
    const s = DA.summarise(rows);
    DA.$("#filterStats").innerHTML = [
      ["Matching learners", DA.int(s.learners), `${DA.fmt((s.learners / D.learners.length) * 100)}% of all`],
      ["Completion rate", rows.length ? DA.fmt(s.completion) + "%" : "–", "of matching learners"],
      ["Dropout rate", rows.length ? DA.fmt(s.dropout) + "%" : "–", "of matching learners"],
      ["Avg quiz score", DA.fmt(s.quiz), "0–100"],
      ["Avg hours", DA.fmt(s.hours), "per learner"],
      ["Avg engagement", DA.fmt(s.engagement), "0–100"],
    ].map(([k, v, sub]) => `<div class="mini" style="opacity:1;transform:none"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${sub}</div></div>`).join("");
  }

  function cell(r, c) {
    switch (c.key) {
      case "learner_id": return `<b>${r.learner_id}</b>`;
      case "lesson_progress_pct": return `${r.lessons_completed}/${r.lessons_available}`;
      case "engagement_score": return DA.barCell(r.engagement_score, 100, "var(--accent)");
      case "engagement_category": return DA.engBadge(r.engagement_category);
      case "completion_status": return DA.statusBadge(r.completion_status);
      case "last_active_days": return `${r.last_active_days} d`;
      case "time_spent_hours": case "quiz_score": return DA.fmt(r[c.key]);
      default: return DA.esc(r[c.key]);
    }
  }

  function render() {
    const rows = filtered();
    renderStats(rows);
    const pages = Math.max(1, Math.ceil(rows.length / state.size));
    state.page = Math.min(state.page, pages - 1);
    const start = state.page * state.size;
    const pageRows = rows.slice(start, start + state.size);

    DA.$("#learnerTable").innerHTML = `
      <thead><tr>${COLUMNS.map((c) => `<th class="sortable ${c.num ? "num" : ""} ${state.sort.col === c.key ? "sorted" : ""}" data-col="${c.key}">
        ${c.label}<span class="arrow">${state.sort.col === c.key ? (state.sort.dir === 1 ? "▲" : "▼") : "↕"}</span></th>`).join("")}</tr></thead>
      <tbody>${pageRows.length ? pageRows.map((r) => `<tr>${COLUMNS.map((c) => `<td class="${c.num ? "num" : ""}">${cell(r, c)}</td>`).join("")}</tr>`).join("")
        : `<tr><td colspan="${COLUMNS.length}"><div class="empty">No learners match these filters.</div></td></tr>`}</tbody>`;
    DA.fillBars(DA.$("#learnerTable"));

    DA.$("#pageInfo").textContent = rows.length
      ? `Showing ${DA.int(start + 1)}–${DA.int(Math.min(start + state.size, rows.length))} of ${DA.int(rows.length)} learners · page ${state.page + 1} of ${pages}`
      : "0 learners";
    DA.$("#prevBtn").disabled = state.page === 0;
    DA.$("#nextBtn").disabled = state.page >= pages - 1;
    DA.$("#exportBtn").disabled = !rows.length;
    DA.$("#resultNote").textContent = `${DA.int(rows.length)} matching records · click a column header to sort`;
  }

  /* events */
  let timer;
  DA.$("#q").addEventListener("input", (e) => { clearTimeout(timer); timer = setTimeout(() => { state.q = e.target.value; state.page = 0; render(); }, 150); });
  DA.$$("#filters select[data-col]").forEach((sel) => sel.addEventListener("change", () => { state.filters[sel.dataset.col] = sel.value; state.page = 0; render(); }));
  DA.$("#fInactive").addEventListener("change", (e) => { state.inactive = e.target.value; state.page = 0; render(); });
  DA.$("#learnerTable").addEventListener("click", (e) => {
    const th = e.target.closest("th[data-col]");
    if (!th) return;
    const col = th.dataset.col;
    state.sort = { col, dir: state.sort.col === col ? -state.sort.dir : 1 };
    render();
  });
  DA.$("#prevBtn").addEventListener("click", () => { state.page -= 1; render(); });
  DA.$("#nextBtn").addEventListener("click", () => { state.page += 1; render(); });
  DA.$("#pageSize").addEventListener("change", (e) => { state.size = +e.target.value; state.page = 0; render(); });
  DA.$("#resetBtn").addEventListener("click", () => {
    state.q = ""; state.filters = {}; state.inactive = "All"; state.page = 0; state.sort = { col: "learner_id", dir: 1 };
    DA.$("#q").value = "";
    DA.$$("#filters select").forEach((s) => (s.value = "All"));
    render();
  });
  DA.$("#exportBtn").addEventListener("click", () => {
    const cols = Object.keys(D.learners[0]);
    DA.downloadCSV(filtered(), cols, `learners_filtered_${filtered().length}.csv`);
  });

  /* allow links like learners.html#module=Java */
  const hash = new URLSearchParams(location.hash.slice(1));
  const map = { module: ["fModule", "course_module"], device: ["fDevice", "device_type"], status: ["fStatus", "completion_status"], engagement: ["fEng", "engagement_category"] };
  hash.forEach((val, key) => { if (map[key]) { DA.$("#" + map[key][0]).value = val; state.filters[map[key][1]] = val; } });

  render();
});
