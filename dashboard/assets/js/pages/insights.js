/* Insights - insight and recommendation cards from the Python-generated text (full cohort). */
DA.ready(function (D) {
  const pick = (text, map, fallback) => {
    const key = Object.keys(map).find((k) => text.toLowerCase().includes(k));
    return key ? map[key] : fallback;
  };
  const INSIGHT_ICONS = {
    "overall": ["chart-pie", "var(--c1)", "Overview"], "module": ["book-open", "var(--c2)", "Modules"], "learning time": ["clock", "var(--c4)", "Learning time"],
    "activity": ["mouse-pointer-click", "var(--c3)", "Engagement"], "device": ["monitor-smartphone", "var(--c5)", "Devices"], "age": ["users", "var(--c1)", "Demographics"],
    "inactivity": ["circle-pause", "var(--c2)", "Retention"], "engagement distribution": ["gauge", "var(--c3)", "Engagement"],
  };
  const REC_ICONS = {
    "re-engagement": "mail", "review": "book-open-check", "experience": "smartphone", "early-warning": "bell-ring",
    "quiz support": "graduation-cap", "regular activity": "flame", "assessment": "clipboard-check",
  };

  DA.$("#scope").textContent = `Full cohort · ${DA.int(D.kpis.total_learners)} learners`;
  DA.$("#insights").innerHTML = D.insights.map((text, i) => {
    const [ic, col, tag] = pick(text, INSIGHT_ICONS, ["lightbulb", "var(--c1)", "Insight"]);
    return `<div class="insight" style="--ic:${col}"><span class="ii">${DA.icon(ic)}</span>
      <div><div class="tag">${String(i + 1).padStart(2, "0")} · ${tag}</div><p>${DA.md(text)}</p></div></div>`;
  }).join("");
  DA.$("#recs").innerHTML = D.recommendations.map((text, i) => `
    <div class="insight" style="--ic:var(--c3)"><span class="ii">${DA.icon(pick(text, REC_ICONS, "circle-check"))}</span>
      <div><div class="tag">Action ${i + 1}</div><p>${DA.md(text)}</p></div></div>`).join("");
  DA.$("#printBtn2").addEventListener("click", () => window.print());
});
