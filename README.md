# DA-015: Online Learning Engagement Analysis

A complete **Data Analytics** project that analyses how 1,000 online learners engage with five course modules
(Python, Java, SQL, Web Development, Data Analytics), and how that engagement relates to course completion and
quiz performance.

**Tech stack:** Python 3 · Pandas · NumPy · Matplotlib · Seaborn · Jupyter Notebook · CSV · (dashboard: HTML/CSS/JavaScript + Chart.js)

> The dataset is **synthetic**. It was generated with a fixed random seed and contains **no real student personal information**.

---

## 1. Project Objectives

1. Generate (or reuse) a learner-activity dataset and document it with a data dictionary.
2. Clean the data: duplicates, missing values, invalid scores, inconsistent categories.
3. Perform EDA: completion rate, quiz scores, learning hours, and module, device and age-group analysis, plus correlations.
4. Define a transparent **engagement score** and **engagement category**.
5. Visualise the results (8 PNG charts).
6. Produce evidence-based insights and recommendations, an academic report, and an executable notebook.

## 2. Project Structure

```
DA-015-Online-Learning-Engagement-Analysis/
├── dataset/
│   ├── online_learning.csv            # raw synthetic data (with injected quality issues)
│   ├── online_learning_cleaned.csv    # cleaned data (1000 learners)
│   └── data_dictionary.csv            # description of every column
├── notebooks/
│   └── online_learning_analysis.ipynb # executed notebook: Markdown + tables + charts
├── src/
│   ├── config.py           # paths, categories, engagement weights, colours
│   ├── generate_data.py    # creates / reuses the synthetic dataset
│   ├── data_cleaning.py    # cleaning pipeline + data dictionary
│   ├── engagement.py       # progress metrics + engagement score
│   ├── analysis.py         # KPIs, group summaries, correlations
│   ├── visualization.py    # all charts
│   ├── insights.py         # insights & recommendations from computed numbers
│   ├── report.py           # builds the academic report
│   ├── dashboard.py        # builds the simple HTML + PNG dashboards
│   ├── build_website.py    # exports data for the dashboard website
│   ├── build_notebook.py   # (re)creates the Jupyter notebook
│   └── main.py             # runs the whole pipeline
├── dashboard/              # multi-page dashboard website (open index.html)
│   ├── index.html, modules.html, engagement.html, demographics.html,
│   │   learners.html, insights.html, about.html
│   └── assets/             # css/, js/, data/data.js (generated), vendor/chart.umd.min.js
├── charts/                 # 8 PNG charts + 00_dashboard_overview.png
├── reports/
│   ├── dashboard.html      # one-page dashboard (open in browser)
│   ├── analysis_report.md  # full academic report
│   ├── insights.md         # key insights & recommendations
│   ├── cleaning_log.txt    # every cleaning action with counts
│   └── *_summary.csv       # KPI, module, device, age, engagement, correlation tables
├── requirements.txt
└── README.md
```

## 3. Dataset

| Column | Description |
|---|---|
| learner_id | Artificial ID (L0001–L1000) |
| age_group | 18-24, 25-34, 35-44, 45+ |
| course_module | Python, Java, SQL, Web Development, Data Analytics |
| device_type | Laptop, Mobile, Desktop, Tablet |
| time_spent_hours | Total learning hours |
| videos_watched / videos_available | Video progress |
| lessons_completed / lessons_available | Lesson progress |
| quiz_score | Average quiz score (0–100) |
| completion_status | Completed, In Progress, Dropped |
| activity_count | Platform interactions |
| last_active_days | Days since last activity |

The full dictionary, including the derived columns, is in `dataset/data_dictionary.csv`.

To demonstrate cleaning, the raw file intentionally contains:
- missing activity records (`activity_count`, `time_spent_hours`, `last_active_days`)
- 12 duplicate rows
- 6 quiz scores outside 0–100
- messy labels such as `"web dev"` and `" Laptop "`
- 4 rows where completed lessons exceed available lessons

**Reuse rule:** if `dataset/online_learning.csv` already exists, it is reused and never overwritten. Use `--force` to regenerate it.

## 4. Engagement Score (transparent definition)

```
engagement_score = 100 × (0.35 × activity_count_norm
                        + 0.35 × time_spent_hours_norm
                        + 0.30 × lesson_progress_pct_norm)
```

- Each component is clipped to its 5th–95th percentile, then min-max scaled to 0–1. This stops a few extreme learners from compressing everyone else.
- Categories: **Low** < 40 · **Medium** 40–69.9 · **High** ≥ 70
- Quiz score and completion are excluded on purpose, so the score can be tested against those outcomes.
- Weights and thresholds can be changed in `src/config.py`.

## 5. Setup

### Prerequisites
- Python 3.10+ (tested with 3.12)
- VS Code with the **Python** and **Jupyter** extensions (Microsoft)

### Create a virtual environment and install the libraries

**Windows (PowerShell)**
```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

**macOS / Linux**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

> On Ubuntu/Debian, if `python3 -m venv` fails with "ensurepip is not available", either run
> `sudo apt install python3-venv python3-pip`, or use [uv](https://docs.astral.sh/uv/):
> `uv venv .venv && uv pip install -r requirements.txt`.

## 6. How to Run

All commands are run from the **project root folder**.

### Option A: run the full pipeline (recommended)
```bash
python src/main.py            # reuses dataset/online_learning.csv if present
python src/main.py --force    # regenerates the synthetic dataset
```
This creates the cleaned CSV, the data dictionary, the summary tables, the 8 charts, `reports/insights.md` and `reports/analysis_report.md`.

### Option B: run individual steps
```bash
python src/generate_data.py   # dataset only
python src/data_cleaning.py   # cleaning + data dictionary
python src/engagement.py      # engagement category counts
python src/analysis.py        # KPIs + module table
```

### Option C: the Jupyter notebook
```bash
python src/build_notebook.py   # (re)create the notebook - optional, it already exists
jupyter notebook notebooks/online_learning_analysis.ipynb
# or execute it headlessly:
jupyter nbconvert --to notebook --execute --inplace notebooks/online_learning_analysis.ipynb
```

### Option D: the dashboard website ⭐
A professional, BI-style (Power BI / Tableau-like) multi-page dashboard. Its data is created by `python src/main.py`.

```bash
google-chrome dashboard/index.html   # Linux (or: firefox dashboard/index.html)
start dashboard\index.html           # Windows
open dashboard/index.html            # macOS
```
It needs **no server and no internet**: Chart.js and the Lucide icons are bundled in `dashboard/assets/vendor/`.

> Linux tip: if `xdg-open` opens the file in an editor instead of a browser, run
> `xdg-mime default google-chrome.desktop text/html` once, or open it with `google-chrome` as shown above.

| Page (route) | What it shows |
|---|---|
| `index.html` – Executive Overview | 6 KPI cards with deltas, module completion vs cohort average, status doughnut, hours-vs-score scatter, learning-progress funnel, at-risk learners |
| `modules.html` – Course Modules | Sortable module scorecard (CSV export), completion vs dropout, status mix, and a **module deep-dive** compared with the other modules |
| `engagement.html` – Engagement | Score model and weights, score distribution, outcomes by category, module mix, scatter, and a **live correlation matrix** |
| `demographics.html` – Devices & Age | Metric switcher (completion / dropout / quiz / hours / engagement), share doughnuts, summary tables, device × module heatmap |
| `learners.html` – Learner Explorer | Search, quick views (At risk, Inactive, Top performers), sortable table, pagination, **CSV export**, learner profile drawer |
| `insights.html` – Insights | Insight and recommendation cards generated by `src/insights.py`, print / save as PDF |
| `about.html` – Methodology | Pipeline, objectives, cleaning log, limitations, data dictionary |

**Dashboard features**
- **Global filters (slicers):** multi-select Module, Device, Age, Status and Engagement. Every KPI and chart updates instantly, and the selection is kept while you move between pages.
- **KPI deltas:** when a filter is active, each KPI shows its difference from the full cohort (green = better, red = worse).
- **Chart actions:** ⓘ explanation, data-table view, PNG download and full screen on every chart.
- **Learner profile drawer:** opens from table rows, scatter points or global search. It shows the learner vs their module average and their engagement-score breakdown.
- **Global search:** press `/`, then type a learner ID, module or page.
- **More:** collapsible sidebar, dark/light mode, page transitions, count-up numbers, skeleton loaders, toasts and a mobile layout.
- **At-risk rule:** In Progress + Low engagement + inactive ≥ 14 days. This is transparent and the same on every page.

All numbers are calculated from the cleaned learner records in `dashboard/assets/data/data.js`. They match the Python results (verified for overall and filtered views).

Simpler extras are also generated:
- `reports/dashboard.html`: a single-file static summary.
- `charts/00_dashboard_overview.png`: a one-page image for slides or the report.

### Running from VS Code
1. **File → Open Folder…** and choose the project folder.
2. Press `Ctrl+Shift+P` → **Python: Select Interpreter** → choose `.venv`.
3. Open a terminal (`` Ctrl+` ``), check that it shows `(.venv)`, and run `python src/main.py`.
   You can also open `src/main.py` and click the ▶ **Run Python File** button.
4. Open `notebooks/online_learning_analysis.ipynb`, click **Select Kernel** (top right) → `.venv`, then **Run All**.
5. View the results:
   - Open `reports/analysis_report.md` and press `Ctrl+Shift+V` for the rendered preview with charts.
   - The PNGs in `charts/` open directly in VS Code.

## 7. Charts

| # | File | Shows |
|---|---|---|
| 1 | `01_module_completion_rate.png` | Completion rate per module |
| 2 | `02_module_avg_quiz_score.png` | Average quiz score per module |
| 3 | `03_learning_hours_vs_quiz_score.png` | Scatter + regression line, coloured by status |
| 4 | `04_completion_status_distribution.png` | Completed / In Progress / Dropped |
| 5 | `05_engagement_by_module.png` | Low / Medium / High mix per module |
| 6 | `06_correlation_heatmap.png` | Pearson correlations between metrics |
| 7 | `07_device_completion_rate.png` | Completion rate per device |
| 8 | `08_age_group_quiz_score.png` | Quiz score distribution per age group |

## 8. Key Results (from the current dataset)

| Metric | Value |
|---|---|
| Learners | 1,000 |
| Completion rate | 21.0% |
| Dropout rate | 31.1% |
| Average quiz score | 53.3 |
| Average learning hours | 17.3 |
| Best / worst module (completion) | SQL 26.8% / Java 18.2% |
| Best / worst device (completion) | Desktop 24.4% / Mobile 17.0% |
| High vs Low engagement – avg quiz score | 73.0 vs 41.5 |
| Hours vs quiz score correlation | r = 0.55 |

The full insights and recommendations are in `reports/insights.md`. The complete write-up is in `reports/analysis_report.md`.
These values are recalculated each time the pipeline runs. If you regenerate or replace the dataset, update this table from `reports/kpi_summary.csv`.

## 9. Limitations
- The data is synthetic, so the patterns reflect the simulation assumptions.
- Correlation does not imply causation.
- Median imputation slightly reduces variance.
- Lesson progress feeds both the engagement score and completion, so part of that relationship is structural.

## 10. Author
DA-015 academic project: Online Learning Engagement Analysis.
