"""
report.py
---------
Builds the academic report (reports/analysis_report.md) from the real
calculated results, cleaning log, insights and charts.
"""

from datetime import date

import pandas as pd

import config


def df_to_markdown(df: pd.DataFrame, index: bool = True) -> str:
    """Convert a DataFrame to a Markdown table (no extra library needed)."""
    table = df.reset_index() if index else df
    header = "| " + " | ".join(str(c) for c in table.columns) + " |"
    divider = "| " + " | ".join("---" for _ in table.columns) + " |"
    rows = ["| " + " | ".join(str(v) for v in row) + " |" for row in table.itertuples(index=False)]
    return "\n".join([header, divider, *rows])


def build_report(raw_rows: int, df: pd.DataFrame, results: dict, insight_dict: dict, dictionary: pd.DataFrame) -> str:
    k = results["kpis"]
    w = config.ENGAGEMENT_WEIGHTS
    cleaning_log = config.CLEANING_LOG_FILE.read_text(encoding="utf-8").splitlines()[2:] \
        if config.CLEANING_LOG_FILE.exists() else []
    kpi_table = pd.DataFrame({
        "Metric": ["Total learners", "Completed learners", "Completion rate", "Dropout rate",
                   "Average quiz score", "Total learning hours", "Average learning hours",
                   "Average lesson progress", "Average activity count", "Average engagement score",
                   f"Inactive > {config.INACTIVE_THRESHOLD_DAYS} days"],
        "Value": [k["total_learners"], k["completed_learners"], f"{k['completion_rate_pct']}%",
                  f"{k['dropout_rate_pct']}%", k["avg_quiz_score"], f"{k['total_learning_hours']:,}",
                  k["avg_learning_hours"], f"{k['avg_lesson_progress_pct']}%", k["avg_activity_count"],
                  k["avg_engagement_score"], f"{k['inactive_learners']} ({k['inactive_pct']}%)"],
    })
    f = insight_dict["facts"]
    chart = lambda name, caption: f"![{caption}](../charts/{name})\n\n*Figure: {caption}*\n"  # noqa: E731

    sections = [
        "# DA-015: Online Learning Engagement Analysis",
        f"**Project type:** Data Analytics (Python, Pandas, NumPy, Matplotlib, Seaborn)  \n"
        f"**Dataset:** Synthetic dataset of {k['total_learners']} learners (no real personal data)  \n"
        f"**Report generated:** {date.today().isoformat()}",

        "## Abstract",
        f"This project analyses the engagement and performance of {k['total_learners']} online learners across five "
        f"course modules (Python, Java, SQL, Web Development and Data Analytics). After cleaning a raw dataset of "
        f"{raw_rows} records, exploratory data analysis showed an overall completion rate of "
        f"{k['completion_rate_pct']}% and an average quiz score of {k['avg_quiz_score']}. A transparent engagement "
        f"score combining activity, learning time and lesson progress was defined. {f['best_mod']} had the highest and "
        f"{f['worst_mod']} the lowest completion rate, and higher engagement was clearly associated with higher "
        f"completion and quiz performance. Evidence-based recommendations are proposed to reduce dropout.",

        "## 1. Introduction",
        "Online learning platforms collect detailed activity data, but high enrolment does not guarantee that "
        "learners stay engaged or finish their courses. Understanding which behaviours relate to completion and "
        "performance helps course designers and instructors intervene early.",
        "### 1.1 Objectives\n"
        "1. Prepare a clean, reliable learner-activity dataset.\n"
        "2. Measure overall completion, quiz performance and learning time.\n"
        "3. Compare performance across modules, devices and age groups.\n"
        "4. Define a transparent engagement score and category.\n"
        "5. Identify relationships between engagement and outcomes.\n"
        "6. Provide data-driven recommendations.",

        "## 2. Dataset Description",
        f"The dataset is **synthetic** (generated with NumPy using a fixed random seed of {config.RANDOM_SEED}) and "
        "contains no real student information. Behaviours were simulated so that they relate to each other "
        "realistically, and data-quality problems (missing activity records, duplicates, invalid scores, "
        "inconsistent labels) were deliberately included to demonstrate data cleaning.",
        "### 2.1 Data Dictionary",
        df_to_markdown(dictionary, index=False),

        "## 3. Methodology",
        "1. **Data collection / generation** - `src/generate_data.py` (reuses `dataset/online_learning.csv` if present).\n"
        "2. **Data cleaning** - `src/data_cleaning.py`: category standardisation, duplicate removal, validation of "
        "score ranges, capping impossible values and module-median imputation.\n"
        "3. **Feature engineering** - `src/engagement.py`: lesson progress %, video completion %, inactivity flag, "
        "engagement score and category.\n"
        "4. **Exploratory data analysis** - `src/analysis.py`: KPIs, group summaries and Pearson correlations.\n"
        "5. **Visualisation** - `src/visualization.py`: eight PNG charts.\n"
        "6. **Insight generation** - `src/insights.py`: findings and recommendations built from computed values.",

        "## 4. Data Cleaning Results",
        "\n".join(f"- {line}" for line in cleaning_log if line.strip()),

        "## 5. Exploratory Data Analysis",
        "### 5.1 Key Performance Indicators",
        df_to_markdown(kpi_table, index=False),
        "### 5.2 Completion Status",
        df_to_markdown(results["status"].rename_axis("completion_status")),
        chart("04_completion_status_distribution.png", "Distribution of completion status"),
        "### 5.3 Module-wise Performance",
        df_to_markdown(results["module"]),
        chart("01_module_completion_rate.png", "Completion rate by course module"),
        chart("02_module_avg_quiz_score.png", "Average quiz score by course module"),
        "### 5.4 Device Analysis",
        df_to_markdown(results["device"]),
        chart("07_device_completion_rate.png", "Completion rate by device type"),
        "### 5.5 Age-group Analysis",
        df_to_markdown(results["age"]),
        chart("08_age_group_quiz_score.png", "Quiz score distribution by age group"),
        "### 5.6 Learning Time vs Performance",
        chart("03_learning_hours_vs_quiz_score.png", "Learning hours vs quiz score"),
        "### 5.7 Correlation Analysis",
        df_to_markdown(results["correlation"]),
        chart("06_correlation_heatmap.png", "Correlation heatmap"),

        "## 6. Engagement Score Model",
        "The engagement score is a weighted sum of three robust min-max normalised (0-1) behaviours:\n\n"
        "```\n"
        f"engagement_score = 100 x ({w['activity_count']} x activity_count_norm\n"
        f"                        + {w['time_spent_hours']} x time_spent_hours_norm\n"
        f"                        + {w['lesson_progress_pct']} x lesson_progress_pct_norm)\n"
        "```\n\n"
        "Normalisation: each value is clipped to its 5th-95th percentile range, then `x_norm = (x - P5) / (P95 - P5)`, so a few extreme learners do not compress everyone else. Categories: **Low** < 40, **Medium** 40-69.9, "
        "**High** >= 70. Activity and time are weighted equally as measures of effort; lesson progress measures "
        "results of that effort. Quiz score and completion are deliberately **excluded** so the score can be "
        "tested against those outcomes without circular reasoning.",
        "### 6.1 Outcomes by Engagement Category",
        df_to_markdown(results["engagement_outcomes"]),
        "### 6.2 Engagement Mix by Module (% of learners)",
        df_to_markdown(results["engagement_module"]),
        chart("05_engagement_by_module.png", "Engagement category mix by module"),

        "## 7. Key Insights",
        "\n".join(f"{i}. {t}" for i, t in enumerate(insight_dict["insights"], 1)),

        "## 8. Recommendations",
        "\n".join(f"{i}. {t}" for i, t in enumerate(insight_dict["recommendations"], 1)),

        "## 9. Limitations",
        "- The data is synthetic; patterns reflect the simulation assumptions and should be validated on real "
        "platform data before making decisions.\n"
        "- Correlation does not imply causation - e.g. motivated learners may both study longer and score higher.\n"
        "- Missing values were imputed with module medians, which slightly reduces variance.\n"
        "- Lesson progress is both part of the engagement score and closely tied to completion, so part of the "
        "completion gap between engagement categories is structural; the quiz-score gap is the cleaner test.\n"
        "- The engagement weights are a transparent, reasoned choice rather than statistically optimised.",

        "## 10. Conclusion",
        f"The analysis shows that engagement behaviours - activity, learning time and lesson progress - are closely "
        f"linked to course completion and quiz performance. With a completion rate of {k['completion_rate_pct']}% and "
        f"{k['inactive_pct']}% of learners inactive for over {config.INACTIVE_THRESHOLD_DAYS} days, the platform should "
        f"focus on early identification of low-engagement learners, improving the {f['worst_mod']} module and the "
        f"{f['worst_dev']} learning experience. The modular Python pipeline makes the analysis fully reproducible.",
    ]
    report = "\n\n".join(sections) + "\n"
    config.REPORT_FILE.write_text(report, encoding="utf-8")
    print(f"[report] Saved {config.REPORT_FILE.relative_to(config.PROJECT_ROOT)}")
    return report
