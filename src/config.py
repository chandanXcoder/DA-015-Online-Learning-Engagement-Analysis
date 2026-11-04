"""
config.py
---------
Central configuration for the DA-015 Online Learning Engagement Analysis project.

All paths are RELATIVE to the project root, so the project works on any
computer (Windows / macOS / Linux) without editing file locations.
"""

from pathlib import Path

# ---------------------------------------------------------------------------
# Paths (built relative to this file -> project root is one level above src/)
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent

DATASET_DIR = PROJECT_ROOT / "dataset"
CHARTS_DIR = PROJECT_ROOT / "charts"
REPORTS_DIR = PROJECT_ROOT / "reports"
NOTEBOOKS_DIR = PROJECT_ROOT / "notebooks"

RAW_DATA_FILE = DATASET_DIR / "online_learning.csv"
CLEAN_DATA_FILE = DATASET_DIR / "online_learning_cleaned.csv"
DATA_DICTIONARY_FILE = DATASET_DIR / "data_dictionary.csv"

CLEANING_LOG_FILE = REPORTS_DIR / "cleaning_log.txt"
INSIGHTS_FILE = REPORTS_DIR / "insights.md"
REPORT_FILE = REPORTS_DIR / "analysis_report.md"

# ---------------------------------------------------------------------------
# Synthetic data settings
# ---------------------------------------------------------------------------
RANDOM_SEED = 42
N_LEARNERS = 1000

# ---------------------------------------------------------------------------
# Valid categories (used by both the generator and the cleaning step)
# ---------------------------------------------------------------------------
MODULES = ["Python", "Java", "SQL", "Web Development", "Data Analytics"]
AGE_GROUPS = ["18-24", "25-34", "35-44", "45+"]
DEVICES = ["Laptop", "Mobile", "Desktop", "Tablet"]
COMPLETION_STATUSES = ["Completed", "In Progress", "Dropped"]

# Columns that must be numeric after cleaning
NUMERIC_COLUMNS = [
    "time_spent_hours", "videos_watched", "videos_available",
    "lessons_completed", "lessons_available", "quiz_score",
    "activity_count", "last_active_days",
]

# ---------------------------------------------------------------------------
# Engagement score definition (transparent and easy to change)
#
#   engagement_score = 100 * ( W_ACTIVITY * activity_norm
#                            + W_TIME     * time_norm
#                            + W_PROGRESS * lesson_progress_norm )
#
# Each component is clipped at its 5th/95th percentile, then min-max
# normalised to the 0-1 range.
# ---------------------------------------------------------------------------
ENGAGEMENT_WEIGHTS = {
    "activity_count": 0.35,
    "time_spent_hours": 0.35,
    "lesson_progress_pct": 0.30,
}
# Percentiles used to clip each component before min-max scaling (outlier-robust)
NORMALISE_CLIP = (0.05, 0.95)
# score < 40 -> Low,  40 <= score < 70 -> Medium,  score >= 70 -> High
ENGAGEMENT_BINS = [0, 40, 70, 100.0001]
ENGAGEMENT_LABELS = ["Low", "Medium", "High"]

# Learners not active for more than this many days are flagged "inactive"
INACTIVE_THRESHOLD_DAYS = 30

# ---------------------------------------------------------------------------
# Chart style (validated categorical palette - colour-blind friendly order)
# ---------------------------------------------------------------------------
PRIMARY_COLOR = "#2a78d6"            # single-series bars
STATUS_COLORS = {                    # completion status (3 categories)
    "Completed": "#2a78d6",
    "In Progress": "#eb6834",
    "Dropped": "#1baf7a",
}
ENGAGEMENT_COLORS = {                # ordinal -> one hue, light to dark
    "Low": "#a9c9f0",
    "Medium": "#5b9be3",
    "High": "#1c5aa6",
}
CHART_DPI = 150


def ensure_directories() -> None:
    """Create output folders if they do not exist yet."""
    for folder in (DATASET_DIR, CHARTS_DIR, REPORTS_DIR, NOTEBOOKS_DIR):
        folder.mkdir(parents=True, exist_ok=True)
