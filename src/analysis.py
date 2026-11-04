"""
analysis.py
-----------
Exploratory Data Analysis (EDA): KPIs, group summaries and correlations.
Every table is also saved to reports/ as CSV so results can be checked.
"""

import pandas as pd

import config

CORRELATION_COLUMNS = [
    "time_spent_hours", "activity_count", "lesson_progress_pct", "video_completion_pct",
    "quiz_score", "last_active_days", "engagement_score", "is_completed",
]


def compute_kpis(df: pd.DataFrame) -> dict:
    """Headline numbers for the whole learner population."""
    return {
        "total_learners": int(len(df)),
        "completed_learners": int(df["is_completed"].sum()),
        "completion_rate_pct": round(df["is_completed"].mean() * 100, 1),
        "dropout_rate_pct": round((df["completion_status"] == "Dropped").mean() * 100, 1),
        "in_progress_pct": round((df["completion_status"] == "In Progress").mean() * 100, 1),
        "avg_quiz_score": round(df["quiz_score"].mean(), 1),
        "median_quiz_score": round(df["quiz_score"].median(), 1),
        "total_learning_hours": round(df["time_spent_hours"].sum(), 1),
        "avg_learning_hours": round(df["time_spent_hours"].mean(), 1),
        "avg_lesson_progress_pct": round(df["lesson_progress_pct"].mean(), 1),
        "avg_video_completion_pct": round(df["video_completion_pct"].mean(), 1),
        "avg_activity_count": round(df["activity_count"].mean(), 1),
        "avg_engagement_score": round(df["engagement_score"].mean(), 1),
        "inactive_learners": int(df["is_inactive"].sum()),
        "inactive_pct": round(df["is_inactive"].mean() * 100, 1),
    }


def group_summary(df: pd.DataFrame, by: str) -> pd.DataFrame:
    """Performance summary for any categorical column (module, device, age group ...)."""
    summary = df.groupby(by, observed=True).agg(
        learners=("learner_id", "count"),
        completion_rate_pct=("is_completed", "mean"),
        avg_quiz_score=("quiz_score", "mean"),
        avg_hours=("time_spent_hours", "mean"),
        avg_lesson_progress_pct=("lesson_progress_pct", "mean"),
        avg_activity=("activity_count", "mean"),
        avg_engagement_score=("engagement_score", "mean"),
        dropout_rate_pct=("completion_status", lambda s: (s == "Dropped").mean()),
    )
    summary["completion_rate_pct"] *= 100
    summary["dropout_rate_pct"] *= 100
    return summary.round(1).sort_values("completion_rate_pct", ascending=False)


def status_distribution(df: pd.DataFrame) -> pd.DataFrame:
    counts = df["completion_status"].value_counts().reindex(config.COMPLETION_STATUSES, fill_value=0)
    return pd.DataFrame({"learners": counts, "percent": (counts / counts.sum() * 100).round(1)})


def engagement_by_module(df: pd.DataFrame) -> pd.DataFrame:
    """Percentage of learners in each engagement category, per module."""
    table = pd.crosstab(df["course_module"], df["engagement_category"], normalize="index") * 100
    return table.reindex(columns=config.ENGAGEMENT_LABELS, fill_value=0).round(1)


def engagement_outcomes(df: pd.DataFrame) -> pd.DataFrame:
    """How completion and quiz score differ across engagement categories."""
    return df.groupby("engagement_category", observed=True).agg(
        learners=("learner_id", "count"),
        avg_engagement_score=("engagement_score", "mean"),
        completion_rate_pct=("is_completed", lambda s: s.mean() * 100),
        avg_quiz_score=("quiz_score", "mean"),
        avg_hours=("time_spent_hours", "mean"),
        inactive_pct=("is_inactive", lambda s: s.mean() * 100),
    ).round(1)


def correlation_matrix(df: pd.DataFrame) -> pd.DataFrame:
    return df[CORRELATION_COLUMNS].corr(method="pearson").round(2)


def run_eda(df: pd.DataFrame, save: bool = True) -> dict:
    """Run every analysis and return the results in one dictionary."""
    results = {
        "kpis": compute_kpis(df),
        "module": group_summary(df, "course_module"),
        "device": group_summary(df, "device_type"),
        "age": group_summary(df, "age_group").sort_index(),
        "status": status_distribution(df),
        "engagement_module": engagement_by_module(df),
        "engagement_outcomes": engagement_outcomes(df),
        "correlation": correlation_matrix(df),
    }
    if save:
        config.ensure_directories()
        pd.Series(results["kpis"], name="value").to_csv(config.REPORTS_DIR / "kpi_summary.csv",
                                                       index_label="metric")
        for key in ["module", "device", "age", "status", "engagement_module",
                    "engagement_outcomes", "correlation"]:
            results[key].to_csv(config.REPORTS_DIR / f"{key}_summary.csv")
    return results


if __name__ == "__main__":
    from engagement import add_engagement_score
    data = add_engagement_score(pd.read_csv(config.CLEAN_DATA_FILE))
    out = run_eda(data)
    for k, v in out["kpis"].items():
        print(f"{k:28s} {v}")
    print(out["module"])
