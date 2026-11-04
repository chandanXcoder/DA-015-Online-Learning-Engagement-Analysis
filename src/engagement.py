"""
engagement.py
-------------
Adds derived progress metrics and a TRANSPARENT engagement score.

Formula (weights live in config.py):

    engagement_score = 100 * (0.35 * activity_norm
                            + 0.35 * time_norm
                            + 0.30 * lesson_progress_norm)

where each *_norm value is robust min-max normalised:
    x is clipped to [P5, P95], then x_norm = (x - P5) / (P95 - P5)

Category:  Low  (< 40)   |   Medium (40 - 69.9)   |   High (>= 70)
"""

import pandas as pd

import config


def min_max(series: pd.Series, lower_q: float = config.NORMALISE_CLIP[0],
            upper_q: float = config.NORMALISE_CLIP[1]) -> pd.Series:
    """Robust min-max scaling to 0-1.

    Values are first clipped at the given percentiles (default 5th / 95th) so a
    handful of extreme learners do not squeeze everyone else into a narrow band.
    """
    low, high = series.quantile(lower_q), series.quantile(upper_q)
    if high == low:
        return pd.Series(0.0, index=series.index)
    return (series.clip(low, high) - low) / (high - low)


def add_progress_metrics(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["video_completion_pct"] = (df["videos_watched"] / df["videos_available"] * 100).round(1)
    df["lesson_progress_pct"] = (df["lessons_completed"] / df["lessons_available"] * 100).round(1)
    df["is_completed"] = (df["completion_status"] == "Completed").astype(int)
    df["is_inactive"] = (df["last_active_days"] > config.INACTIVE_THRESHOLD_DAYS).astype(int)
    return df


def add_engagement_score(df: pd.DataFrame) -> pd.DataFrame:
    """Return a copy of df with engagement_score and engagement_category columns."""
    if "lesson_progress_pct" not in df.columns:
        df = add_progress_metrics(df)
    df = df.copy()
    score = sum(weight * min_max(df[col]) for col, weight in config.ENGAGEMENT_WEIGHTS.items())
    df["engagement_score"] = (score * 100).round(1)
    df["engagement_category"] = pd.cut(
        df["engagement_score"], bins=config.ENGAGEMENT_BINS,
        labels=config.ENGAGEMENT_LABELS, right=False, include_lowest=True,
    )
    return df


if __name__ == "__main__":
    data = pd.read_csv(config.CLEAN_DATA_FILE)
    data = add_engagement_score(data)
    print(data["engagement_category"].value_counts())
    print(data.groupby("engagement_category", observed=True)["engagement_score"].describe())
