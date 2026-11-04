"""
visualization.py
----------------
Creates all project charts as PNG files inside charts/.

Each function draws ONE chart, saves it, and returns the file path, so charts
can be produced individually from the notebook or all together from main.py.
"""

import matplotlib

matplotlib.use("Agg")  # works without a display (also fine inside Jupyter)
import matplotlib.pyplot as plt  # noqa: E402
import seaborn as sns  # noqa: E402
from matplotlib.colors import LinearSegmentedColormap  # noqa: E402

import config  # noqa: E402

sns.set_theme(style="whitegrid", context="notebook")
plt.rcParams.update({
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.titleweight": "bold", "axes.titlesize": 13, "grid.color": "#e6e6e3",
    "axes.edgecolor": "#8a8986", "axes.labelcolor": "#2b2b2a", "text.color": "#2b2b2a",
})

# Diverging map for correlations: blue (negative) - neutral grey - orange (positive)
DIVERGING = LinearSegmentedColormap.from_list("blue_grey_orange", ["#1c5aa6", "#f2f1ee", "#c4501f"])


def _save(fig, filename: str):
    config.ensure_directories()
    path = config.CHARTS_DIR / filename
    fig.tight_layout()
    fig.savefig(path, dpi=config.CHART_DPI, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return path


def _label_bars(ax, fmt="{:.1f}", suffix=""):
    for container in ax.containers:
        ax.bar_label(container, labels=[fmt.format(v) + suffix for v in container.datavalues],
                     padding=3, fontsize=9, color="#52514e")


def _single_bar(series, title, xlabel, ylabel, filename, suffix="", ylim=None):
    fig, ax = plt.subplots(figsize=(9, 5))
    ax.bar(series.index.astype(str), series.values, color=config.PRIMARY_COLOR, width=0.6,
           edgecolor="white", linewidth=2)
    _label_bars(ax, suffix=suffix)
    ax.set(title=title, xlabel=xlabel, ylabel=ylabel)
    if ylim:
        ax.set_ylim(*ylim)
    ax.grid(axis="x", visible=False)
    return _save(fig, filename)


def plot_module_completion(module_summary):
    s = module_summary["completion_rate_pct"].sort_values(ascending=False)
    return _single_bar(s, "Completion Rate by Course Module", "Course module", "Completion rate (%)",
                       "01_module_completion_rate.png", suffix="%", ylim=(0, max(s) * 1.2))


def plot_module_quiz_score(module_summary):
    s = module_summary["avg_quiz_score"].sort_values(ascending=False)
    return _single_bar(s, "Average Quiz Score by Course Module", "Course module", "Average quiz score (0-100)",
                       "02_module_avg_quiz_score.png", ylim=(0, 100))


def plot_hours_vs_score(df):
    fig, ax = plt.subplots(figsize=(9, 6))
    for status in config.COMPLETION_STATUSES:
        sub = df[df["completion_status"] == status]
        ax.scatter(sub["time_spent_hours"], sub["quiz_score"], s=22, alpha=0.6, label=status,
                   color=config.STATUS_COLORS[status], edgecolor="white", linewidth=0.5)
    sns.regplot(data=df, x="time_spent_hours", y="quiz_score", scatter=False, ax=ax,
                color="#2b2b2a", line_kws={"linewidth": 2, "linestyle": "--"})
    r = df["time_spent_hours"].corr(df["quiz_score"])
    ax.set(title=f"Learning Hours vs Quiz Score (Pearson r = {r:.2f})",
           xlabel="Time spent (hours)", ylabel="Quiz score (0-100)")
    ax.set_ylim(0, 105)
    ax.legend(title="Completion status", frameon=False)
    return _save(fig, "03_learning_hours_vs_quiz_score.png")


def plot_completion_distribution(status_table):
    fig, ax = plt.subplots(figsize=(8, 5))
    colors = [config.STATUS_COLORS[s] for s in status_table.index]
    bars = ax.bar(status_table.index, status_table["learners"], color=colors, width=0.55,
                  edgecolor="white", linewidth=2)
    ax.bar_label(bars, labels=[f"{n} ({p}%)" for n, p in zip(status_table["learners"], status_table["percent"])],
                 padding=3, fontsize=10, color="#52514e")
    ax.set(title="Distribution of Completion Status", xlabel="Completion status", ylabel="Number of learners")
    ax.set_ylim(0, status_table["learners"].max() * 1.18)
    ax.grid(axis="x", visible=False)
    return _save(fig, "04_completion_status_distribution.png")


def plot_engagement_by_module(engagement_table):
    fig, ax = plt.subplots(figsize=(10, 5.5))
    left = None
    table = engagement_table.sort_values("High")
    for level in config.ENGAGEMENT_LABELS:
        ax.barh(table.index, table[level], left=left, color=config.ENGAGEMENT_COLORS[level],
                label=level, edgecolor="white", linewidth=2, height=0.6)
        for y, (val, start) in enumerate(zip(table[level], (left if left is not None else [0] * len(table)))):
            if val >= 7:
                ax.text(start + val / 2, y, f"{val:.0f}%", ha="center", va="center", fontsize=9,
                        color="white" if level != "Low" else "#0b0b0b")
        left = table[level] if left is None else left + table[level]
    ax.set(title="Engagement Category Mix by Course Module", xlabel="Share of learners (%)", ylabel="")
    ax.set_xlim(0, 100)
    ax.legend(title="Engagement", ncol=3, frameon=False, loc="upper center", bbox_to_anchor=(0.5, -0.12))
    ax.grid(axis="y", visible=False)
    return _save(fig, "05_engagement_by_module.png")


def plot_correlation_heatmap(corr):
    fig, ax = plt.subplots(figsize=(10, 8))
    sns.heatmap(corr, annot=True, fmt=".2f", cmap=DIVERGING, vmin=-1, vmax=1, center=0, square=True,
                linewidths=1, linecolor="white", cbar_kws={"label": "Pearson correlation", "shrink": 0.8}, ax=ax)
    ax.set_title("Correlation Heatmap of Engagement and Performance Metrics")
    plt.setp(ax.get_xticklabels(), rotation=40, ha="right")
    return _save(fig, "06_correlation_heatmap.png")


def plot_device_completion(device_summary):
    s = device_summary["completion_rate_pct"].sort_values(ascending=False)
    return _single_bar(s, "Completion Rate by Device Type", "Device type", "Completion rate (%)",
                       "07_device_completion_rate.png", suffix="%", ylim=(0, max(s) * 1.2))


def plot_age_quiz_score(df):
    fig, ax = plt.subplots(figsize=(9, 5))
    sns.boxplot(data=df, x="age_group", y="quiz_score", order=config.AGE_GROUPS, color="#a9c9f0",
                width=0.55, linecolor="#1c5aa6", ax=ax)
    means = df.groupby("age_group")["quiz_score"].mean().reindex(config.AGE_GROUPS)
    ax.scatter(range(len(means)), means.values, color="#eb6834", s=60, zorder=3, label="Mean")
    ax.set(title="Quiz Score Distribution by Age Group", xlabel="Age group", ylabel="Quiz score (0-100)")
    ax.legend(frameon=False)
    return _save(fig, "08_age_group_quiz_score.png")


def create_all_charts(df, results) -> list:
    """Generate every chart and return the list of saved file paths."""
    paths = [
        plot_module_completion(results["module"]),
        plot_module_quiz_score(results["module"]),
        plot_hours_vs_score(df),
        plot_completion_distribution(results["status"]),
        plot_engagement_by_module(results["engagement_module"]),
        plot_correlation_heatmap(results["correlation"]),
        plot_device_completion(results["device"]),
        plot_age_quiz_score(df),
    ]
    for p in paths:
        print(f"[chart] Saved {p.relative_to(config.PROJECT_ROOT)}")
    return paths
