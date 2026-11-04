/* Methodology page - pipeline timeline, cleaning log, data dictionary. */
DA.ready(function (D) {
  const steps = [
    ["Generate / reuse data", "src/generate_data.py: reuses dataset/online_learning.csv if present, else creates 1000 synthetic learners."],
    ["Clean", "src/data_cleaning.py: standardise labels, remove duplicates, fix invalid scores, impute missing values."],
    ["Engineer features", "src/engagement.py: lesson & video progress, inactivity flag, engagement score and category."],
    ["Analyse", "src/analysis.py: KPIs, module / device / age summaries, Pearson correlations."],
    ["Visualise", "src/visualization.py: 8 PNG charts for the report and notebook."],
    ["Explain", "src/insights.py + src/report.py: insights, recommendations and the academic report."],
    ["Publish", "src/build_website.py: exports the results that power this dashboard."],
  ];
  DA.$("#timeline").innerHTML = steps.map(([t, s], i) => `
    <li class="reveal" style="--d:${i * 0.08}s"><span class="step">${i + 1}</span><b>${DA.esc(t)}</b><span>${DA.esc(s)}</span></li>`).join("");

  DA.$("#cleanStats").innerHTML = [
    ["Raw rows", D.meta.raw_rows], ["Clean rows", D.meta.clean_rows], ["Removed", D.meta.raw_rows - D.meta.clean_rows],
  ].map(([k, v]) => `<div class="mini"><div class="k">${k}</div><div class="v" data-count="${v}">0</div></div>`).join("");

  DA.$("#log").innerHTML = D.cleaning_log.map((l) => `<div>› ${DA.esc(l)}</div>`).join("") || "<div>No cleaning log found.</div>";

  DA.$("#dict").innerHTML = `
    <thead><tr><th>Column</th><th>Source</th><th>Type</th><th>Description</th><th>Valid values</th></tr></thead>
    <tbody>${D.dictionary.map((r) => `<tr><td><code>${DA.esc(r.column)}</code></td>
      <td><span class="badge ${r.source === "Raw" ? "b-completed" : "b-dropped"}">${DA.esc(r.source)}</span></td>
      <td>${DA.esc(r.data_type)}</td><td style="white-space:normal;min-width:260px">${DA.esc(r.description)}</td>
      <td style="white-space:normal">${DA.esc(r.valid_values)}</td></tr>`).join("")}</tbody>`;
});
