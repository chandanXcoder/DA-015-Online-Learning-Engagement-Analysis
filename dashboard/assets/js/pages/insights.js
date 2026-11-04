/* Insights page - insight and recommendation cards built from the generated text. */
DA.ready(function (D) {
  const palette = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)"];
  const k = D.kpis;

  DA.$("#heroTags").innerHTML = [
    `${D.insights.length} insights`, `${D.recommendations.length} recommendations`,
    `Completion ${k.completion_rate_pct}%`, `Avg quiz ${k.avg_quiz_score}`,
  ].map((t) => `<span>${DA.esc(t)}</span>`).join("");

  DA.$("#insights").innerHTML = D.insights.map((text, i) => `
    <div class="insight" style="--ic:${palette[i % palette.length]}">
      <div class="n">${String(i + 1).padStart(2, "0")}</div><p>${DA.md(text)}</p></div>`).join("");

  DA.$("#recs").innerHTML = D.recommendations.map((text) => `
    <div class="insight" style="--ic:var(--c3)">
      <div class="n">${DA.icons.check}</div><p>${DA.md(text)}</p></div>`).join("");
  DA.$$("#recs .n svg").forEach((s) => { s.style.width = "16px"; s.style.height = "16px"; });

  DA.$("#printBtn").innerHTML = `${DA.icons.printer} Print / save as PDF`;
  DA.$("#printBtn").addEventListener("click", () => window.print());
});
