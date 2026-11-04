"""
data_cleaning.py
----------------
Cleans the raw learner dataset step by step and records every action in
reports/cleaning_log.txt so the process is fully transparent.

Steps
 1. Standardise text categories (trim spaces, fix case / spelling variants)
 2. Remove exact duplicate rows and duplicate learner IDs
 3. Convert numeric columns to numbers
 4. Mark invalid quiz scores (outside 0-100) as missing
 5. Fix impossible values (completed > available, negative numbers)
 6. Impute missing numeric values with the median of the learner's module
 7. Save the cleaned CSV
"""

import numpy as np
import pandas as pd

import config

# Spelling variants -> official category names
CATEGORY_ALIASES = {
    "course_module": {
        "python": "Python", "java": "Java", "sql": "SQL",
        "web development": "Web Development", "web dev": "Web Development", "webdev": "Web Development",
        "data analytics": "Data Analytics", "data analysis": "Data Analytics",
    },
    "device_type": {"laptop": "Laptop", "mobile": "Mobile", "desktop": "Desktop", "tablet": "Tablet"},
    "completion_status": {
        "completed": "Completed", "in progress": "In Progress", "inprogress": "In Progress",
        "dropped": "Dropped",
    },
    "age_group": {"18-24": "18-24", "25-34": "25-34", "35-44": "35-44", "45+": "45+"},
}

REQUIRED_COLUMNS = [
    "learner_id", "age_group", "course_module", "device_type", "time_spent_hours",
    "videos_watched", "videos_available", "lessons_completed", "lessons_available",
    "quiz_score", "completion_status", "activity_count", "last_active_days",
]


class CleaningLog:
    """Collects human-readable messages about each cleaning action."""

    def __init__(self):
        self.lines = []

    def add(self, message: str) -> None:
        self.lines.append(message)
        print(f"[clean] {message}")

    def save(self, path) -> None:
        path.write_text("DA-015 Data Cleaning Log\n" + "=" * 40 + "\n" + "\n".join(self.lines) + "\n",
                        encoding="utf-8")


def validate_columns(df: pd.DataFrame) -> None:
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Dataset is missing required columns: {missing}")


def standardise_categories(df: pd.DataFrame, log: CleaningLog) -> pd.DataFrame:
    for col, aliases in CATEGORY_ALIASES.items():
        original = df[col].astype(str)
        cleaned = original.str.strip().str.lower().map(aliases)
        changed = int((cleaned.notna() & (cleaned != original)).sum())
        invalid = int(cleaned.isna().sum())
        df[col] = cleaned
        log.add(f"{col}: standardised {changed} inconsistent label(s); {invalid} unrecognised value(s)")
    before = len(df)
    df = df.dropna(subset=list(CATEGORY_ALIASES))
    if before - len(df):
        log.add(f"Dropped {before - len(df)} row(s) with unrecognised categories")
    return df


def remove_duplicates(df: pd.DataFrame, log: CleaningLog) -> pd.DataFrame:
    before = len(df)
    df = df.drop_duplicates()
    log.add(f"Removed {before - len(df)} exact duplicate row(s)")
    before = len(df)
    df = df.drop_duplicates(subset="learner_id", keep="first")
    log.add(f"Removed {before - len(df)} additional duplicate learner_id row(s)")
    return df


def fix_numeric_values(df: pd.DataFrame, log: CleaningLog) -> pd.DataFrame:
    for col in config.NUMERIC_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    invalid_scores = (df["quiz_score"] < 0) | (df["quiz_score"] > 100)
    log.add(f"quiz_score: {int(invalid_scores.sum())} invalid value(s) outside 0-100 set to missing "
            f"(values: {sorted(df.loc[invalid_scores, 'quiz_score'].tolist())})")
    df.loc[invalid_scores, "quiz_score"] = np.nan

    for done, avail in [("lessons_completed", "lessons_available"), ("videos_watched", "videos_available")]:
        too_high = df[done] > df[avail]
        log.add(f"{done}: {int(too_high.sum())} value(s) greater than {avail} capped")
        df.loc[too_high, done] = df.loc[too_high, avail]

    for col in config.NUMERIC_COLUMNS:
        negative = df[col] < 0
        if negative.any():
            log.add(f"{col}: {int(negative.sum())} negative value(s) set to missing")
            df.loc[negative, col] = np.nan
    return df


def impute_missing(df: pd.DataFrame, log: CleaningLog) -> pd.DataFrame:
    missing = df[config.NUMERIC_COLUMNS].isna().sum()
    for col, count in missing[missing > 0].items():
        module_median = df.groupby("course_module")[col].transform("median")
        df[col] = df[col].fillna(module_median).fillna(df[col].median())
        log.add(f"{col}: imputed {int(count)} missing value(s) with module-level median")
    # Count columns should be whole numbers
    for col in ["videos_watched", "videos_available", "lessons_completed",
                "lessons_available", "activity_count", "last_active_days"]:
        df[col] = df[col].round().astype(int)
    df["time_spent_hours"] = df["time_spent_hours"].round(1)
    df["quiz_score"] = df["quiz_score"].round(1)
    return df


def clean_data(raw: pd.DataFrame, save: bool = True) -> pd.DataFrame:
    """Run the full cleaning pipeline and return the cleaned DataFrame."""
    log = CleaningLog()
    validate_columns(raw)
    df = raw.copy()
    log.add(f"Raw dataset: {len(df)} rows x {df.shape[1]} columns")
    missing_raw = df.isna().sum()
    log.add("Missing values in raw data: " +
            (", ".join(f"{c}={int(v)}" for c, v in missing_raw[missing_raw > 0].items()) or "none"))

    df = standardise_categories(df, log)
    df = remove_duplicates(df, log)
    df = fix_numeric_values(df, log)
    df = impute_missing(df, log)
    df = df.sort_values("learner_id").reset_index(drop=True)

    log.add(f"Cleaned dataset: {len(df)} rows; remaining missing values = {int(df.isna().sum().sum())}")
    if save:
        config.ensure_directories()
        df.to_csv(config.CLEAN_DATA_FILE, index=False)
        log.add(f"Saved cleaned data -> {config.CLEAN_DATA_FILE.relative_to(config.PROJECT_ROOT)}")
        log.save(config.CLEANING_LOG_FILE)
    return df


def build_data_dictionary() -> pd.DataFrame:
    """Describe every column (raw + derived) and save it as CSV."""
    rows = [
        ("learner_id", "Raw", "Text", "Artificial unique learner identifier (no personal data)", "L0001 - L1000"),
        ("age_group", "Raw", "Category", "Learner age band", ", ".join(config.AGE_GROUPS)),
        ("course_module", "Raw", "Category", "Course module enrolled in", ", ".join(config.MODULES)),
        ("device_type", "Raw", "Category", "Main device used for learning", ", ".join(config.DEVICES)),
        ("time_spent_hours", "Raw", "Decimal", "Total learning time on the platform (hours)", ">= 0"),
        ("videos_watched", "Raw", "Integer", "Number of course videos watched", "0 - videos_available"),
        ("videos_available", "Raw", "Integer", "Number of videos in the module", "> 0"),
        ("lessons_completed", "Raw", "Integer", "Number of lessons completed", "0 - lessons_available"),
        ("lessons_available", "Raw", "Integer", "Number of lessons in the module", "> 0"),
        ("quiz_score", "Raw", "Decimal", "Average quiz score (%)", "0 - 100"),
        ("completion_status", "Raw", "Category", "Course status", ", ".join(config.COMPLETION_STATUSES)),
        ("activity_count", "Raw", "Integer", "Platform interactions (logins, posts, submissions)", ">= 0"),
        ("last_active_days", "Raw", "Integer", "Days since the learner was last active", ">= 0"),
        ("video_completion_pct", "Derived", "Decimal", "videos_watched / videos_available x 100", "0 - 100"),
        ("lesson_progress_pct", "Derived", "Decimal", "lessons_completed / lessons_available x 100", "0 - 100"),
        ("is_completed", "Derived", "0/1", "1 if completion_status == Completed", "0, 1"),
        ("is_inactive", "Derived", "0/1", f"1 if last_active_days > {config.INACTIVE_THRESHOLD_DAYS}", "0, 1"),
        ("engagement_score", "Derived", "Decimal",
         "Weighted score of normalised activity, time and lesson progress", "0 - 100"),
        ("engagement_category", "Derived", "Category", "Low (<40), Medium (40-69.9), High (>=70)",
         ", ".join(config.ENGAGEMENT_LABELS)),
    ]
    dictionary = pd.DataFrame(rows, columns=["column", "source", "data_type", "description", "valid_values"])
    config.ensure_directories()
    dictionary.to_csv(config.DATA_DICTIONARY_FILE, index=False)
    return dictionary


if __name__ == "__main__":
    from generate_data import get_raw_dataset
    cleaned = clean_data(get_raw_dataset())
    build_data_dictionary()
    print(cleaned.describe().T)
