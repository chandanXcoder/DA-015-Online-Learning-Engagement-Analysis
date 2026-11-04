/* Methodology - pipeline, objectives, cleaning log, limitations and data dictionary. */
DA.ready(function (D) {
  const steps = [
    ["database", "Generate / reuse data", "src/generate_data.py: reuses dataset/online_learning.csv if present, otherwise creates 1,000 synthetic learners."],
    ["sparkles", "Clean", "src/data_cleaning.py: standardise labels, remove duplicates, fix invalid scores, impute missing values with module medians."],
    ["wand-sparkles", "Engineer features", "src/engagement.py: lesson and video progress, inactivity flag, engagement score and category."],
    ["sigma", "Analyse", "src/analysis.py: KPIs, module / device / age summaries and Pearson correlations."],
    ["chart-column", "Visualise", "src/visualization.py: 8 PNG charts for the report and the notebook."],
    ["file-text", "Explain", "src/insights.py + src/report.py: insights, recommendations and the academic report."],
    ["layout-dashboard", "Publish", "src/build_website.py: exports the results that power this dashboard."],
  ];
  DA.$("#timeline").innerHTML = steps.map(([ic, t, s]) => `<li><span class="step">${DA.icon(ic)}</span><b>${DA.esc(t)}</b><span>${DA.esc(s)}</span></li>`).join("");

  const objectives = [
    ["database", "Prepare a clean, reliable learner-activity dataset"], ["target", "Measure completion, quiz performance and learning time"],
    ["git-compare", "Compare modules, devices and age groups"], ["gauge", "Define a transparent engagement score and category"],
    ["link", "Identify relationships between engagement and outcomes"], ["lightbulb", "Provide evidence-based recommendations"],
  ];
  DA.$("#objectives").innerHTML = objectives.map(([ic, t], i) => `<div class="li"><span class="avatar">${DA.icon(ic, 'style="width:15px;height:15px"')}</span><div class="txt"><b>${t}</b><span>Objective ${i + 1}</span></div></div>`).join("");
  DA.$("#tech").innerHTML = [["code", "Python 3"], ["table", "Pandas"], ["sigma", "NumPy"], ["chart-line", "Matplotlib"], ["chart-scatter", "Seaborn"],
    ["notebook-pen", "Jupyter"], ["file-spreadsheet", "CSV"], ["chart-pie", "Chart.js"], ["shapes", "Lucide icons"]]
    .map(([ic, t]) => `<span>${DA.icon(ic)}${t}</span>`).join("");

  DA.$("#cleanStats").innerHTML = [["Raw rows", D.meta.raw_rows], ["Clean rows", D.meta.clean_rows], ["Rows removed", D.meta.raw_rows - D.meta.clean_rows]]
    .map(([k, v]) => `<div class="mini"><div class="k">${k}</div><div class="v">${DA.int(v)}</div></div>`).join("");
  DA.$("#log").innerHTML = D.cleaning_log.map((l) => `<div>${DA.icon("check")}<span>${DA.esc(l)}</span></div>`).join("") || "<div>No cleaning log found.</div>";

  const limits = [
    ["flask-conical", "Synthetic data", "Patterns reflect the simulation assumptions and must be validated on real platform data."],
    ["git-branch", "Correlation ≠ causation", "Motivated learners may both study longer and score higher."],
    ["sigma", "Median imputation", "Missing values were filled with module medians, which slightly reduces variance."],
    ["repeat", "Structural link", "Lesson progress feeds both the engagement score and completion; the quiz-score gap is the cleaner test."],
    ["scale", "Chosen weights", "Engagement weights are a documented, reasoned choice, not statistically optimised."],
    ["shield-check", "Privacy", "Learner IDs are artificial (L0001–L1000). No names, emails or other personal data exist."],
  ];
  DA.$("#limits").innerHTML = limits.map(([ic, t, s]) => `<div class="li"><span class="avatar">${DA.icon(ic, 'style="width:15px;height:15px"')}</span><div class="txt"><b>${t}</b><span style="white-space:normal">${s}</span></div></div>`).join("");

  DA.$("#dict").innerHTML = `<thead><tr><th>Column</th><th>Source</th><th>Type</th><th>Description</th><th>Valid values</th></tr></thead>
    <tbody>${D.dictionary.map((r) => `<tr><td><code>${DA.esc(r.column)}</code></td>
      <td><span class="badge ${r.source === "Raw" ? "b-completed" : "b-high"}">${DA.esc(r.source)}</span></td><td>${DA.esc(r.data_type)}</td>
      <td style="white-space:normal;min-width:260px">${DA.esc(r.description)}</td><td style="white-space:normal">${DA.esc(r.valid_values)}</td></tr>`).join("")}</tbody>`;
});
