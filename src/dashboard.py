"""
dashboard.py
------------
Builds two dashboards from the calculated results (no web server needed):

1. reports/dashboard.html  - a single self-contained HTML page (charts are
   embedded inside the file) that opens in any browser with a double-click,
   even offline. Contains KPI cards, all charts, summary tables and insights.
2. charts/00_dashboard_overview.png - a one-page summary image (KPIs + key
   charts) for printing or adding to a report / presentation.

Run on its own (after main.py has created the charts):
    python src/dashboard.py
"""

import base64
import html
import re
from datetime import date

import matplotlib

matplotlib.use("Agg")
import matplotlib.image as mpimg  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402

import config  # noqa: E402

DASHBOARD_HTML = config.REPORTS_DIR / "dashboard.html"
DASHBOARD_PNG = config.CHARTS_DIR / "00_dashboard_overview.png"

CHART_SECTIONS = [
    ("Course Modules", [
        ("01_module_completion_rate.png", "Completion rate by module"),
        ("02_module_avg_quiz_score.png", "Average quiz score by module"),
    ]),
    ("Completion & Learning Time", [
        ("04_completion_status_distribution.png", "Completion status distribution"),
        ("03_learning_hours_vs_quiz_score.png", "Learning hours vs quiz score"),
    ]),
    ("Engagement", [
        ("05_engagement_by_module.png", "Engagement category mix by module"),
        ("06_correlation_heatmap.png", "Correlation heatmap"),
    ]),
    ("Devices & Age Groups", [
        ("07_device_completion_rate.png", "Completion rate by device"),
        ("08_age_group_quiz_score.png", "Quiz score by age group"),
    ]),
]


def _kpi_cards(k: dict) -> list:
    """(label, value, note) for each KPI card."""
    return [
        ("Total learners", f"{k['total_learners']:,}", "synthetic cohort"),
        ("Completion rate", f"{k['completion_rate_pct']}%", f"{k['completed_learners']} completed"),
        ("Dropout rate", f"{k['dropout_rate_pct']}%", f"{k['in_progress_pct']}% still in progress"),
        ("Avg quiz score", f"{k['avg_quiz_score']}", f"median {k['median_quiz_score']}"),
        ("Avg learning hours", f"{k['avg_learning_hours']}", f"{k['total_learning_hours']:,.0f} h in total"),
        ("Avg engagement score", f"{k['avg_engagement_score']}", "0-100 scale"),
        ("Avg lesson progress", f"{k['avg_lesson_progress_pct']}%", f"videos {k['avg_video_completion_pct']}%"),
        (f"Inactive > {config.INACTIVE_THRESHOLD_DAYS} days", f"{k['inactive_pct']}%",
         f"{k['inactive_learners']} learners"),
    ]


def _img_base64(path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def _table_html(df, title: str) -> str:
    table = df.reset_index().to_html(index=False, border=0, classes="data")
    return f'<div class="table-card"><h3>{html.escape(title)}</h3><div class="scroll">{table}</div></div>'


def _md_to_html(text: str) -> str:
    """Tiny converter for the **bold** markup used in insight sentences."""
    return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", html.escape(text))


def build_html_dashboard(results: dict, insight_dict: dict) -> object:
    k = results["kpis"]
    cards = "".join(
        f'<div class="kpi"><div class="kpi-label">{html.escape(label)}</div>'
        f'<div class="kpi-value">{value}</div><div class="kpi-note">{html.escape(note)}</div></div>'
        for label, value, note in _kpi_cards(k)
    )

    chart_html = []
    for section, charts in CHART_SECTIONS:
        figures = []
        for filename, caption in charts:
            path = config.CHARTS_DIR / filename
            if not path.exists():
                print(f"[dashboard] Warning: {filename} not found - run python src/main.py first")
                continue
            figures.append(f'<figure><img src="data:image/png;base64,{_img_base64(path)}" alt="{caption}">'
                           f'<figcaption>{caption}</figcaption></figure>')
        chart_html.append(f'<section><h2>{section}</h2><div class="grid2">{"".join(figures)}</div></section>')

    tables = "".join([
        _table_html(results["module"], "Module-wise performance"),
        _table_html(results["device"], "Device-wise performance"),
        _table_html(results["age"], "Age-group performance"),
        _table_html(results["engagement_outcomes"], "Outcomes by engagement category"),
    ])
    insights = "".join(f"<li>{_md_to_html(t)}</li>" for t in insight_dict["insights"])
    recs = "".join(f"<li>{_md_to_html(t)}</li>" for t in insight_dict["recommendations"])
    w = config.ENGAGEMENT_WEIGHTS

    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Learning Engagement Dashboard</title>
<style>
  :root {{
    --bg: #f4f4f1; --surface: #ffffff; --text: #1d1d1b; --muted: #5f5e5a;
    --border: #e2e1dc; --accent: #2a78d6; --accent-soft: #e8f0fb;
  }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--bg); color: var(--text);
         font-family: "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif; line-height: 1.5; }}
  header {{ background: var(--surface); border-bottom: 1px solid var(--border); padding: 20px 16px; }}
  .wrap {{ max-width: 1200px; margin: 0 auto; padding: 0 16px; }}
  header .wrap {{ padding: 0; }}
  h1 {{ margin: 0; font-size: 1.5rem; }}
  .sub {{ color: var(--muted); font-size: .9rem; margin-top: 4px; }}
  nav {{ display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }}
  nav a {{ font-size: .85rem; color: var(--accent); text-decoration: none; background: var(--accent-soft);
          padding: 4px 10px; border-radius: 999px; }}
  h2 {{ font-size: 1.15rem; margin: 32px 0 12px; }}
  .kpis {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 20px; }}
  .kpi {{ background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }}
  .kpi-label {{ color: var(--muted); font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; }}
  .kpi-value {{ font-size: 1.9rem; font-weight: 700; margin: 2px 0; font-variant-numeric: tabular-nums; }}
  .kpi-note {{ color: var(--muted); font-size: .8rem; }}
  .grid2 {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 16px; }}
  figure {{ margin: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px; }}
  figure img {{ width: 100%; height: auto; display: block; }}
  figcaption {{ color: var(--muted); font-size: .8rem; margin-top: 6px; text-align: center; }}
  .tables {{ display: grid; grid-template-columns: 1fr; gap: 16px; }}
  .table-card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }}
  .table-card h3 {{ margin: 0 0 8px; font-size: 1rem; }}
  .scroll {{ overflow-x: auto; }}
  table.data {{ border-collapse: collapse; width: 100%; font-size: .85rem; font-variant-numeric: tabular-nums; }}
  table.data th {{ text-align: left; color: var(--muted); font-weight: 600; border-bottom: 2px solid var(--border);
                  padding: 6px 10px; white-space: nowrap; }}
  table.data td {{ border-bottom: 1px solid var(--border); padding: 6px 10px; white-space: nowrap; }}
  .panel {{ background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 8px 20px; }}
  .panel li {{ margin: 8px 0; }}
  .formula {{ background: var(--accent-soft); border-radius: 8px; padding: 12px 16px; font-family: Consolas, monospace;
             font-size: .85rem; overflow-x: auto; white-space: pre; }}
  footer {{ color: var(--muted); font-size: .8rem; text-align: center; padding: 32px 16px; }}
  @media (max-width: 520px) {{ .grid2 {{ grid-template-columns: 1fr; }} .kpi-value {{ font-size: 1.5rem; }} }}
</style>
</head>
<body>
<header><div class="wrap">
  <h1>DA-015 · Online Learning Engagement Dashboard</h1>
  <div class="sub">{k['total_learners']:,} synthetic learners · 5 course modules · generated {date.today().isoformat()}
    · all figures calculated from <code>dataset/online_learning_cleaned.csv</code></div>
  <nav><a href="#kpis">KPIs</a><a href="#charts">Charts</a><a href="#engagement-model">Engagement model</a>
    <a href="#tables">Tables</a><a href="#insights">Insights</a><a href="#recommendations">Recommendations</a></nav>
</div></header>

<main class="wrap">
  <h2 id="kpis">Key Performance Indicators</h2>
  <div class="kpis">{cards}</div>

  <div id="charts">{"".join(chart_html)}</div>

  <h2 id="engagement-model">Engagement Score Model</h2>
  <div class="panel">
    <div class="formula">engagement_score = 100 × ({w['activity_count']} × activity_norm + {w['time_spent_hours']} × time_norm + {w['lesson_progress_pct']} × lesson_progress_norm)</div>
    <p>Each component is clipped to its 5th–95th percentile and min-max scaled to 0–1.
       Categories: <strong>Low</strong> &lt; 40 · <strong>Medium</strong> 40–69.9 · <strong>High</strong> ≥ 70.</p>
  </div>

  <h2 id="tables">Summary Tables</h2>
  <div class="tables">{tables}</div>

  <h2 id="insights">Key Insights</h2>
  <div class="panel"><ol>{insights}</ol></div>

  <h2 id="recommendations">Recommendations</h2>
  <div class="panel"><ol>{recs}</ol></div>
</main>
<footer>DA-015 Online Learning Engagement Analysis · Synthetic data, no real student information ·
  Python, Pandas, NumPy, Matplotlib, Seaborn</footer>
</body>
</html>
"""
    DASHBOARD_HTML.write_text(page, encoding="utf-8")
    print(f"[dashboard] Saved {DASHBOARD_HTML.relative_to(config.PROJECT_ROOT)}")
    return DASHBOARD_HTML


def build_png_dashboard(results: dict) -> object:
    """One-page overview image: KPI tiles on top, six key charts below."""
    k = results["kpis"]
    cards = _kpi_cards(k)[:6]
    charts = ["01_module_completion_rate.png", "02_module_avg_quiz_score.png",
              "03_learning_hours_vs_quiz_score.png", "04_completion_status_distribution.png",
              "05_engagement_by_module.png", "07_device_completion_rate.png"]

    fig = plt.figure(figsize=(20, 22), facecolor="white")
    grid = fig.add_gridspec(4, 6, height_ratios=[0.45, 1, 1, 1], hspace=0.12, wspace=0.08, top=0.95)
    fig.suptitle("DA-015 Online Learning Engagement Dashboard", fontsize=26, fontweight="bold", y=0.975)

    for i, (label, value, note) in enumerate(cards):
        ax = fig.add_subplot(grid[0, i])
        ax.set_facecolor("#f4f4f1")
        ax.set_xticks([]), ax.set_yticks([])
        for spine in ax.spines.values():
            spine.set_color("#e2e1dc")
        ax.text(0.5, 0.75, label.upper(), ha="center", fontsize=12, color="#5f5e5a", transform=ax.transAxes)
        ax.text(0.5, 0.40, value, ha="center", fontsize=30, fontweight="bold", color="#1d1d1b", transform=ax.transAxes)
        ax.text(0.5, 0.14, note, ha="center", fontsize=11, color="#5f5e5a", transform=ax.transAxes)

    for i, name in enumerate(charts):
        path = config.CHARTS_DIR / name
        ax = fig.add_subplot(grid[1 + i // 2, (i % 2) * 3:(i % 2) * 3 + 3])
        ax.axis("off")
        if path.exists():
            ax.imshow(mpimg.imread(path))
        else:
            ax.text(0.5, 0.5, f"{name} missing", ha="center")

    fig.savefig(DASHBOARD_PNG, dpi=110, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"[dashboard] Saved {DASHBOARD_PNG.relative_to(config.PROJECT_ROOT)}")
    return DASHBOARD_PNG


def build_dashboards(results: dict, insight_dict: dict) -> None:
    build_html_dashboard(results, insight_dict)
    build_png_dashboard(results)


if __name__ == "__main__":
    import pandas as pd

    from analysis import run_eda
    from engagement import add_engagement_score
    from insights import generate_insights

    if not config.CLEAN_DATA_FILE.exists():
        raise SystemExit("Cleaned data not found - run  python src/main.py  first.")
    data = add_engagement_score(pd.read_csv(config.CLEAN_DATA_FILE))
    res = run_eda(data, save=False)
    build_dashboards(res, generate_insights(data, res))
