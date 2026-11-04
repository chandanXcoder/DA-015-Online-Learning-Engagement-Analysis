/* Learner Explorer - global filters + search + quick views, sortable/paginated table, CSV export, profile drawer. */
DA.ready(function (D) {
  const M = D.meta;
  const QUICK = {
    all: { label: "All learners", fn: () => true },
    risk: { label: "At risk (In Progress · Low engagement · inactive ≥ 14 d)", fn: DA.isAtRisk },
    inactive: { label: `Inactive > ${M.inactive_threshold_days} days`, fn: (r) => r.last_active_days > M.inactive_threshold_days },
    top: { label: "Top performers (Completed · quiz ≥ 80)", fn: (r) => r.completion_status === "Completed" && r.quiz_score >= 80 },
  };
  const state = { q: "", quick: "all", sort: { col: "learner_id", dir: 1 }, page: 0, size: 25 };
  const h = DA.hashParams();
  if (h.get("risk") === "1") state.quick = "risk";

  DA.filters.mount(DA.$("#filterbar"));

  const COLUMNS = [
    { key: "learner_id", label: "Learner" }, { key: "course_module", label: "Module" }, { key: "age_group", label: "Age" },
    { key: "device_type", label: "Device" }, { key: "time_spent_hours", label: "Hours", num: true }, { key: "lesson_progress_pct", label: "Lessons", num: true },
    { key: "quiz_score", label: "Quiz", num: true }, { key: "activity_count", label: "Activity", num: true }, { key: "engagement_score", label: "Engagement" },
    { key: "completion_status", label: "Status" }, { key: "last_active_days", label: "Last active", num: true },
  ];
  const DEVICE_ICON = { Laptop: "laptop", Mobile: "smartphone", Desktop: "monitor", Tablet: "tablet" };

  function filtered() {
    const q = state.q.trim().toUpperCase();
    const { col, dir } = state.sort;
    return DA.filters.rows()
      .filter((r) => QUICK[state.quick].fn(r) && (!q || r.learner_id.toUpperCase().includes(q)))
      .sort((a, b) => (a[col] > b[col] ? dir : a[col] < b[col] ? -dir : 0));
  }

  function renderStats(rows) {
    const s = DA.summarise(rows);
    const tiles = [
      ["users", "Matching learners", DA.int(s.learners), `${DA.fmt((s.learners / D.learners.length) * 100)}% of all learners`],
      ["circle-check-big", "Completion rate", rows.length ? DA.fmt(s.completion) + "%" : "–", `${DA.int(s.completed)} completed`],
      ["user-x", "Dropout rate", rows.length ? DA.fmt(s.dropout) + "%" : "–", "of matching learners"],
      ["target", "Avg quiz score", DA.fmt(s.quiz), "out of 100"],
      ["clock", "Avg hours", DA.fmt(s.hours), "per learner"],
      ["gauge", "Avg engagement", DA.fmt(s.engagement), "0–100"],
    ];
    DA.$("#filterStats").innerHTML = tiles.map(([ic, k, v, sub]) => `<div class="mini"><div class="k" style="display:flex;gap:6px;align-items:center">${DA.icon(ic, 'style="width:14px;height:14px"')}${k}</div><div class="v">${v}</div><div class="s">${sub}</div></div>`).join("");
  }

  function cell(r, c) {
    switch (c.key) {
      case "learner_id": return `<span style="display:inline-flex;align-items:center;gap:8px"><span class="avatar" style="width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:10px;font-weight:700;background:var(--accent-soft);color:var(--accent)">${r.learner_id.slice(-3)}</span><b>${r.learner_id}</b></span>`;
      case "device_type": return `<span style="display:inline-flex;align-items:center;gap:6px">${DA.icon(DEVICE_ICON[r.device_type], 'style="width:15px;height:15px;color:var(--text-3)"')}${DA.esc(r.device_type)}</span>`;
      case "lesson_progress_pct": return `${r.lessons_completed}/${r.lessons_available}`;
      case "engagement_score": return `<span style="display:inline-flex;align-items:center;gap:8px">${DA.engBadge(r.engagement_category)}<span>${DA.fmt(r.engagement_score)}</span></span>`;
      case "completion_status": return DA.statusBadge(r.completion_status);
      case "last_active_days": return r.last_active_days > M.inactive_threshold_days ? `<span style="color:var(--bad);font-weight:600">${r.last_active_days} d</span>` : `${r.last_active_days} d`;
      case "time_spent_hours": case "quiz_score": return DA.fmt(r[c.key]);
      default: return DA.esc(r[c.key]);
    }
  }

  function render() {
    const rows = filtered();
    renderStats(rows);
    const pages = Math.max(1, Math.ceil(rows.length / state.size));
    state.page = Math.min(state.page, pages - 1);
    const start = state.page * state.size, pageRows = rows.slice(start, start + state.size);
    DA.$("#learnerTable").innerHTML = `
      <thead><tr>${COLUMNS.map((c) => `<th class="sortable ${c.num ? "num" : ""} ${state.sort.col === c.key ? "sorted" : ""}" data-col="${c.key}">${c.label}<span class="arrow">${state.sort.col === c.key ? (state.sort.dir === 1 ? "▲" : "▼") : "↕"}</span></th>`).join("")}</tr></thead>
      <tbody>${pageRows.length ? pageRows.map((r) => `<tr class="clickable" data-id="${r.learner_id}">${COLUMNS.map((c) => `<td class="${c.num ? "num" : ""}">${cell(r, c)}</td>`).join("")}</tr>`).join("")
        : `<tr><td colspan="${COLUMNS.length}"><div class="empty">${DA.icon("search-x")}No learners match these filters</div></td></tr>`}</tbody>`;
    DA.paintIcons();
    DA.$("#pageInfo").textContent = rows.length ? `Showing ${DA.int(start + 1)}–${DA.int(Math.min(start + state.size, rows.length))} of ${DA.int(rows.length)} · page ${state.page + 1} of ${pages}` : "0 learners";
    DA.$("#prevBtn").disabled = state.page === 0;
    DA.$("#nextBtn").disabled = state.page >= pages - 1;
    DA.$("#exportBtn").disabled = !rows.length;
    DA.$("#resultNote").textContent = `${QUICK[state.quick].label} · ${DA.filters.summaryText()}`;
  }

  let timer;
  DA.$("#q").addEventListener("input", (e) => { clearTimeout(timer); timer = setTimeout(() => { state.q = e.target.value; state.page = 0; render(); }, 120); });
  DA.$("#quick").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.quick = b.dataset.q; state.page = 0;
    DA.$$("#quick button").forEach((x) => x.classList.toggle("active", x === b));
    render();
  });
  DA.$$("#quick button").forEach((x) => x.classList.toggle("active", x.dataset.q === state.quick));
  DA.$("#learnerTable").addEventListener("click", (e) => {
    const th = e.target.closest("th[data-col]");
    if (th) { const col = th.dataset.col; state.sort = { col, dir: state.sort.col === col ? -state.sort.dir : 1 }; render(); return; }
    const tr = e.target.closest("tr[data-id]");
    if (tr) DA.openLearner(tr.dataset.id);
  });
  DA.$("#prevBtn").addEventListener("click", () => { state.page -= 1; render(); });
  DA.$("#nextBtn").addEventListener("click", () => { state.page += 1; render(); });
  DA.$("#pageSize").addEventListener("change", (e) => { state.size = +e.target.value; state.page = 0; render(); });
  DA.$("#exportBtn").addEventListener("click", () => {
    const rows = filtered();
    DA.downloadCSV(rows, Object.keys(D.learners[0]), `learners_${state.quick}_${rows.length}.csv`);
  });
  DA.filters.onChange(() => { state.page = 0; render(); });

  render();
  const openId = () => { const id = DA.hashParams().get("id"); if (id) { state.q = id; DA.$("#q").value = id; render(); DA.openLearner(id); } };
  openId();
  window.addEventListener("hashchange", openId);
});
