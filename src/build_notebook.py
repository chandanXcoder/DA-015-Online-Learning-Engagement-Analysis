"""
build_notebook.py
-----------------
Creates notebooks/online_learning_analysis.ipynb (Markdown + code cells).

    python src/build_notebook.py
    jupyter nbconvert --to notebook --execute --inplace notebooks/online_learning_analysis.ipynb

The notebook re-uses the functions in src/ so the notebook and the scripts
always produce identical results.
"""

import nbformat as nbf

import config

md, code = nbf.v4.new_markdown_cell, nbf.v4.new_code_cell

cells = [
    md("""# DA-015: Online Learning Engagement Analysis

**Domain:** EdTech / Learning Analytics  **Tools:** Python, Pandas, NumPy, Matplotlib, Seaborn

### Objectives
1. Prepare a clean learner-activity dataset (1000 synthetic learners, 5 course modules).
2. Measure completion rate, quiz performance and learning time.
3. Compare performance by **module**, **device** and **age group**.
4. Build a transparent **engagement score** and category.
5. Explore relationships between engagement and outcomes.
6. Produce evidence-based insights and recommendations.

> **Note:** The dataset is synthetic. It contains no real student personal information."""),

    md("## 1. Setup\nImport the libraries and the project's own modules from the `src/` folder."),
    code("""import sys
from pathlib import Path

# Make the src/ folder importable whether the notebook runs from notebooks/ or the project root
PROJECT_ROOT = Path.cwd().parent if Path.cwd().name == "notebooks" else Path.cwd()
sys.path.insert(0, str(PROJECT_ROOT / "src"))

import pandas as pd
import numpy as np
from IPython.display import Image, Markdown, display

import config
from generate_data import get_raw_dataset
from data_cleaning import clean_data, build_data_dictionary
from engagement import add_engagement_score
from analysis import run_eda
import visualization as viz
from insights import generate_insights, save_insights

pd.set_option("display.max_columns", 30)
pd.set_option("display.width", 140)
print("Project root:", PROJECT_ROOT)"""),

    md("""## 2. Load the Dataset
If `dataset/online_learning.csv` already exists it is **reused**; otherwise a synthetic dataset is generated."""),
    code("""raw = get_raw_dataset()
print("Raw shape:", raw.shape)
raw.head()"""),
    code("raw.info()"),

    md("### 2.1 Initial Data-Quality Check\nBefore cleaning: missing values, duplicates, invalid scores and inconsistent labels."),
    code("""quality = pd.DataFrame({
    "missing_values": raw.isna().sum(),
    "missing_pct": (raw.isna().mean() * 100).round(2),
})
print("Exact duplicate rows:", raw.duplicated().sum())
print("Quiz scores outside 0-100:", ((raw["quiz_score"] < 0) | (raw["quiz_score"] > 100)).sum())
quality[quality["missing_values"] > 0]"""),
    code("""for col in ["course_module", "device_type", "completion_status", "age_group"]:
    print(f"{col}: {sorted(raw[col].astype(str).unique())}")"""),

    md("""## 3. Data Cleaning
The `clean_data()` function standardises categories, removes duplicates, sets invalid quiz scores to missing,
caps impossible values and imputes missing numbers with the **module-level median**. Every action is logged."""),
    code("""clean = clean_data(raw)
print("\\nCleaned shape:", clean.shape)
print("Remaining missing values:", clean.isna().sum().sum())
print("Duplicate learner IDs:", clean["learner_id"].duplicated().sum())
print("Quiz score range:", clean["quiz_score"].min(), "-", clean["quiz_score"].max())"""),

    md("### 3.1 Data Dictionary"),
    code("""dictionary = build_data_dictionary()
dictionary"""),

    md("""## 4. Engagement Score
A transparent, weighted score built from three behaviours. Each one is clipped to its 5th–95th percentile and
then min-max scaled to 0–1:

$$\\text{engagement} = 100 \\times (0.35\\cdot\\text{activity} + 0.35\\cdot\\text{time} + 0.30\\cdot\\text{lesson progress})$$

| Category | Score range |
|---|---|
| Low | < 40 |
| Medium | 40 – 69.9 |
| High | ≥ 70 |

Quiz score and completion are **not** part of the score, so we can test whether engagement predicts them."""),
    code("""data = add_engagement_score(clean)
data[["learner_id", "activity_count", "time_spent_hours", "lesson_progress_pct",
      "engagement_score", "engagement_category"]].head(10)"""),
    code("""data["engagement_category"].value_counts().reindex(config.ENGAGEMENT_LABELS).to_frame("learners")"""),

    md("## 5. Exploratory Data Analysis\n### 5.1 Key Performance Indicators"),
    code("""results = run_eda(data)
pd.Series(results["kpis"], name="value").to_frame()"""),
    code("data.describe().T.round(2)"),

    md("### 5.2 Completion Status Distribution"),
    code("""display(results["status"])
display(Image(filename=str(viz.plot_completion_distribution(results["status"]))))"""),

    md("### 5.3 Module-wise Performance"),
    code("""display(results["module"])
display(Image(filename=str(viz.plot_module_completion(results["module"]))))
display(Image(filename=str(viz.plot_module_quiz_score(results["module"]))))"""),

    md("### 5.4 Learning Hours vs Quiz Score"),
    code("""display(Image(filename=str(viz.plot_hours_vs_score(data))))
print("Pearson r (hours vs quiz score):", round(data["time_spent_hours"].corr(data["quiz_score"]), 3))"""),

    md("### 5.5 Device Analysis"),
    code("""display(results["device"])
display(Image(filename=str(viz.plot_device_completion(results["device"]))))"""),

    md("### 5.6 Age-group Analysis"),
    code("""display(results["age"])
display(Image(filename=str(viz.plot_age_quiz_score(data))))"""),

    md("### 5.7 Engagement Analysis\nHow do completion and quiz scores change across engagement categories?"),
    code("""display(results["engagement_outcomes"])
display(results["engagement_module"])
display(Image(filename=str(viz.plot_engagement_by_module(results["engagement_module"]))))"""),

    md("### 5.8 Correlation Analysis"),
    code("""display(results["correlation"])
display(Image(filename=str(viz.plot_correlation_heatmap(results["correlation"]))))"""),

    md("## 6. Insights and Recommendations\nAll statements below are generated from the calculated values above."),
    code("""insight_dict = generate_insights(data, results)
save_insights(insight_dict)
display(Markdown("### Key Insights\\n" + "\\n".join(f"{i}. {t}" for i, t in enumerate(insight_dict["insights"], 1))))
display(Markdown("### Recommendations\\n" + "\\n".join(f"{i}. {t}" for i, t in enumerate(insight_dict["recommendations"], 1))))"""),

    md("""## 7. Conclusion
Engagement behaviours (activity, learning time and lesson progress) are strongly associated with course completion
and quiz performance. Learners with low engagement or long inactivity are the main dropout risk, so early-warning
monitoring and targeted support give the largest expected benefit. Module- and device-level gaps show where course
design should improve.

**Limitations:** the data is synthetic, correlation is not causation, and median imputation slightly reduces variance.

The full academic report is in `reports/analysis_report.md`."""),
]

nb = nbf.v4.new_notebook()
nb["cells"] = cells
nb["metadata"]["kernelspec"] = {"display_name": "Python 3", "language": "python", "name": "python3"}

if __name__ == "__main__":
    config.ensure_directories()
    out = config.NOTEBOOKS_DIR / "online_learning_analysis.ipynb"
    nbf.write(nb, out)
    print(f"[notebook] Saved {out.relative_to(config.PROJECT_ROOT)}")
