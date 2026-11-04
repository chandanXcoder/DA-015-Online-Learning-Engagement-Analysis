"""
generate_data.py
----------------
Creates a SYNTHETIC dataset of 1000 online learners.

* No real student information is used - learner IDs are artificial (L0001...).
* If dataset/online_learning.csv already exists it is REUSED, not overwritten
  (pass --force on the command line to regenerate it on purpose).
* A few realistic data-quality problems are injected on purpose (missing
  activity records, duplicates, invalid scores, messy category spellings) so
  that the cleaning stage has real work to do.

Run on its own:   python src/generate_data.py          (reuse if present)
                  python src/generate_data.py --force  (regenerate)
"""

import sys

import numpy as np
import pandas as pd

import config


def _sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


def build_clean_learners(n: int = config.N_LEARNERS, seed: int = config.RANDOM_SEED) -> pd.DataFrame:
    """Simulate n learners whose behaviours are related in a realistic way.

    A hidden 'motivation' value drives time spent, activity, lesson progress,
    quiz score and completion, with small differences by module and device.
    """
    rng = np.random.default_rng(seed)

    learner_id = [f"L{i:04d}" for i in range(1, n + 1)]
    age_group = rng.choice(config.AGE_GROUPS, size=n, p=[0.38, 0.32, 0.18, 0.12])
    course_module = rng.choice(config.MODULES, size=n)
    device_type = rng.choice(config.DEVICES, size=n, p=[0.42, 0.33, 0.17, 0.08])

    # Course structure per module (number of lessons / videos available)
    lessons_per_module = {"Python": 40, "Java": 45, "SQL": 30, "Web Development": 50, "Data Analytics": 35}
    videos_per_module = {"Python": 60, "Java": 70, "SQL": 45, "Web Development": 75, "Data Analytics": 55}
    # Simulated module difficulty (positive = easier)
    module_effect = {"Python": 0.10, "Java": -0.30, "SQL": 0.30, "Web Development": -0.05, "Data Analytics": 0.0}
    device_effect = {"Laptop": 0.15, "Desktop": 0.10, "Tablet": -0.10, "Mobile": -0.30}
    age_effect = {"18-24": 0.0, "25-34": 0.10, "35-44": 0.05, "45+": -0.10}

    motivation = rng.normal(0, 1, n)
    m_eff = np.array([module_effect[m] for m in course_module])
    d_eff = np.array([device_effect[d] for d in device_type])
    a_eff = np.array([age_effect[a] for a in age_group])

    # Lesson progress share (0-1)
    progress = _sigmoid(0.2 + 1.3 * motivation + m_eff + d_eff + a_eff + rng.normal(0, 0.5, n))

    lessons_available = np.array([lessons_per_module[m] for m in course_module])
    videos_available = np.array([videos_per_module[m] for m in course_module])

    # Completion status
    completed = progress > 0.80
    drop_prob = _sigmoid(-1.1 - 1.4 * motivation - d_eff)
    dropped = (~completed) & (rng.random(n) < drop_prob)
    status = np.where(completed, "Completed", np.where(dropped, "Dropped", "In Progress"))

    lessons_completed = np.where(completed, lessons_available, np.round(progress * lessons_available)).astype(int)
    video_share = np.clip(progress + rng.normal(0, 0.08, n), 0, 1)
    videos_watched = np.round(video_share * videos_available).astype(int)

    hours_per_lesson = rng.gamma(shape=6, scale=0.13, size=n)       # ~0.8 h per lesson
    time_spent_hours = np.round(np.clip(lessons_completed * hours_per_lesson + rng.normal(0, 2, n), 0.5, None), 1)

    activity_lambda = 8 + 70 * progress * np.exp(0.25 * motivation)
    activity_count = rng.poisson(activity_lambda)

    quiz_score = 52 + 11 * motivation + 18 * (progress - 0.5) + 12 * m_eff + rng.normal(0, 8, n)
    quiz_score = np.round(np.clip(quiz_score, 0, 100), 1)

    last_active_days = np.where(
        status == "Dropped", rng.integers(31, 121, n),
        np.where(status == "Completed", rng.integers(0, 46, n),
                 np.clip(np.round(rng.exponential(8, n)), 0, 30)),
    ).astype(int)

    return pd.DataFrame({
        "learner_id": learner_id,
        "age_group": age_group,
        "course_module": course_module,
        "device_type": device_type,
        "time_spent_hours": time_spent_hours,
        "videos_watched": videos_watched,
        "videos_available": videos_available,
        "lessons_completed": lessons_completed,
        "lessons_available": lessons_available,
        "quiz_score": quiz_score,
        "completion_status": status,
        "activity_count": activity_count,
        "last_active_days": last_active_days,
    })


def inject_data_quality_issues(df: pd.DataFrame, seed: int = config.RANDOM_SEED) -> pd.DataFrame:
    """Add realistic problems so the cleaning step can be demonstrated."""
    rng = np.random.default_rng(seed + 1)
    df = df.copy()
    n = len(df)
    # numeric columns become float so they can hold NaN
    for col in ["activity_count", "time_spent_hours", "last_active_days", "quiz_score"]:
        df[col] = df[col].astype(float)

    # 1) Missing activity records
    df.loc[rng.choice(n, 50, replace=False), "activity_count"] = np.nan
    df.loc[rng.choice(n, 30, replace=False), "time_spent_hours"] = np.nan
    df.loc[rng.choice(n, 20, replace=False), "last_active_days"] = np.nan

    # 2) Invalid quiz scores (outside 0-100)
    df.loc[rng.choice(n, 6, replace=False), "quiz_score"] = [-5, 105, 120, -12, 101.5, 150]

    # 3) Inconsistent category spellings
    messy = {
        "course_module": ["python", "SQL ", "web dev", "data analytics", " java"],
        "device_type": ["mobile", " Laptop ", "DESKTOP", "tablet"],
        "completion_status": ["completed", "in progress", "DROPPED"],
    }
    for col, variants in messy.items():
        idx = rng.choice(n, 8, replace=False)
        df.loc[idx, col] = rng.choice(variants, size=len(idx))

    # 4) Impossible progress (more lessons completed than available)
    idx = rng.choice(n, 4, replace=False)
    df.loc[idx, "lessons_completed"] = df.loc[idx, "lessons_available"] + rng.integers(1, 6, len(idx))

    # 5) Duplicate rows (same learner recorded twice)
    dupes = df.sample(12, random_state=seed)
    df = pd.concat([df, dupes], ignore_index=True)
    return df.sample(frac=1, random_state=seed).reset_index(drop=True)


def get_raw_dataset(force: bool = False) -> pd.DataFrame:
    """Reuse dataset/online_learning.csv if present, otherwise generate it."""
    config.ensure_directories()
    if config.RAW_DATA_FILE.exists() and not force:
        print(f"[data] Reusing existing dataset: {config.RAW_DATA_FILE.relative_to(config.PROJECT_ROOT)}")
        return pd.read_csv(config.RAW_DATA_FILE)

    print("[data] Generating new synthetic dataset ...")
    df = inject_data_quality_issues(build_clean_learners())
    df.to_csv(config.RAW_DATA_FILE, index=False)
    print(f"[data] Saved {len(df)} rows -> {config.RAW_DATA_FILE.relative_to(config.PROJECT_ROOT)}")
    return df


if __name__ == "__main__":
    data = get_raw_dataset(force="--force" in sys.argv)
    print(data.head())
    print(f"Shape: {data.shape}")
