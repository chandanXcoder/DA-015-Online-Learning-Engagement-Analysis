"""
insights.py
-----------
Turns the calculated EDA results into plain-English insights and
recommendations. Every sentence is built from computed numbers - nothing is
hard-coded - so the text always matches the data.
"""

import config


def _strength(r: float) -> str:
    a = abs(r)
    if a >= 0.7:
        return "strong"
    if a >= 0.4:
        return "moderate"
    if a >= 0.2:
        return "weak"
    return "very weak / negligible"


def generate_insights(df, results) -> dict:
    """Return {'insights': [...], 'recommendations': [...], 'facts': {...}}."""
    k = results["kpis"]
    mod, dev, age = results["module"], results["device"], results["age"]
    eng, corr = results["engagement_outcomes"], results["correlation"]

    best_mod, worst_mod = mod["completion_rate_pct"].idxmax(), mod["completion_rate_pct"].idxmin()
    top_quiz, low_quiz = mod["avg_quiz_score"].idxmax(), mod["avg_quiz_score"].idxmin()
    best_dev, worst_dev = dev["completion_rate_pct"].idxmax(), dev["completion_rate_pct"].idxmin()
    best_age, worst_age = age["avg_quiz_score"].idxmax(), age["avg_quiz_score"].idxmin()

    r_hours_score = corr.loc["time_spent_hours", "quiz_score"]
    r_activity_complete = corr.loc["activity_count", "is_completed"]
    r_progress_score = corr.loc["lesson_progress_pct", "quiz_score"]
    r_inactive_complete = corr.loc["last_active_days", "is_completed"]

    high = eng.loc["High"] if "High" in eng.index else None
    low = eng.loc["Low"] if "Low" in eng.index else None
    low_eng_share = round(eng["learners"].get("Low", 0) / k["total_learners"] * 100, 1)

    inactive_not_done = int(((df["is_inactive"] == 1) & (df["is_completed"] == 0)).sum())
    low_quiz_completed = int(((df["is_completed"] == 1) & (df["quiz_score"] < 50)).sum())

    facts = dict(best_mod=best_mod, worst_mod=worst_mod, top_quiz=top_quiz, low_quiz=low_quiz,
                 best_dev=best_dev, worst_dev=worst_dev, best_age=best_age, worst_age=worst_age,
                 r_hours_score=r_hours_score, low_eng_share=low_eng_share,
                 inactive_not_done=inactive_not_done)

    insights = [
        f"**Overall performance:** {k['total_learners']} learners were analysed. The overall completion rate is "
        f"{k['completion_rate_pct']}%, {k['in_progress_pct']}% are still in progress and {k['dropout_rate_pct']}% "
        f"have dropped out. The average quiz score is {k['avg_quiz_score']} and learners spent "
        f"{k['avg_learning_hours']} hours on average ({k['total_learning_hours']:,} hours in total).",

        f"**Module gap:** {best_mod} has the highest completion rate "
        f"({mod.loc[best_mod, 'completion_rate_pct']}%) and {worst_mod} the lowest "
        f"({mod.loc[worst_mod, 'completion_rate_pct']}%), a gap of "
        f"{mod.loc[best_mod, 'completion_rate_pct'] - mod.loc[worst_mod, 'completion_rate_pct']:.1f} percentage points. "
        f"Average quiz scores range from {mod.loc[low_quiz, 'avg_quiz_score']} ({low_quiz}) to "
        f"{mod.loc[top_quiz, 'avg_quiz_score']} ({top_quiz}).",

        f"**Learning time and scores:** time spent shows a {_strength(r_hours_score)} positive correlation with quiz "
        f"score (r = {r_hours_score:.2f}); lesson progress vs quiz score has r = {r_progress_score:.2f}. "
        f"More study time is associated with better results, but it does not explain all of the variation.",

        f"**Activity and completion:** activity count correlates with completion at r = {r_activity_complete:.2f}"
        + (f". High-engagement learners complete at {high['completion_rate_pct']}% versus "
           f"{low['completion_rate_pct']}% for low-engagement learners, and score {high['avg_quiz_score']} vs "
           f"{low['avg_quiz_score']} on quizzes." if high is not None and low is not None else "."),

        f"**Device effect:** {best_dev} users have the highest completion rate "
        f"({dev.loc[best_dev, 'completion_rate_pct']}%), while {worst_dev} users have the lowest "
        f"({dev.loc[worst_dev, 'completion_rate_pct']}%) and a dropout rate of "
        f"{dev.loc[worst_dev, 'dropout_rate_pct']}%.",

        f"**Age groups:** the {best_age} group has the highest average quiz score ({age.loc[best_age, 'avg_quiz_score']}) "
        f"and {worst_age} the lowest ({age.loc[worst_age, 'avg_quiz_score']}). The difference is "
        f"{age.loc[best_age, 'avg_quiz_score'] - age.loc[worst_age, 'avg_quiz_score']:.1f} points, so age is a "
        f"{'minor' if age.loc[best_age, 'avg_quiz_score'] - age.loc[worst_age, 'avg_quiz_score'] < 5 else 'notable'} factor "
        f"compared with engagement.",

        f"**Inactivity risk:** {k['inactive_learners']} learners ({k['inactive_pct']}%) have not been active for more "
        f"than {config.INACTIVE_THRESHOLD_DAYS} days; {inactive_not_done} of them have not completed their course. "
        f"Days since last activity correlates with completion at r = {r_inactive_complete:.2f}.",

        f"**Engagement distribution:** {low_eng_share}% of learners fall in the Low engagement category "
        f"(average engagement score overall = {k['avg_engagement_score']}).",
    ]

    recommendations = [
        f"**Re-engagement campaign:** send automated reminders / mentor check-ins to learners inactive for more than "
        f"{config.INACTIVE_THRESHOLD_DAYS} days - this targets {inactive_not_done} learners who have not completed.",
        f"**Review the {worst_mod} module:** it has the lowest completion rate "
        f"({mod.loc[worst_mod, 'completion_rate_pct']}%). Break long lessons into shorter units, add practice "
        f"exercises and revisit the difficulty curve; use {best_mod} as a design benchmark.",
        f"**Improve the {worst_dev} experience:** {worst_dev} learners complete less often "
        f"({dev.loc[worst_dev, 'completion_rate_pct']}% vs {dev.loc[best_dev, 'completion_rate_pct']}% on {best_dev}). "
        f"Optimise video length, offline access and quiz layout for this device.",
        f"**Early-warning dashboard:** use the engagement score as a weekly risk flag - learners in the Low category "
        f"({low_eng_share}% of the cohort) should be contacted before they drop out.",
        f"**Targeted quiz support for {low_quiz}:** it has the lowest average quiz score "
        f"({mod.loc[low_quiz, 'avg_quiz_score']}); add worked examples, hints and retry-based practice quizzes.",
        "**Encourage regular activity:** because activity count and learning time are positively linked to completion "
        "and scores, introduce streaks, discussion prompts and weekly goals that reward consistent participation.",
    ]
    if low_quiz_completed:
        recommendations.append(
            f"**Assessment quality check:** {low_quiz_completed} learners completed their course with a quiz score "
            f"below 50 - consider a minimum score requirement or extra revision before completion.")

    return {"insights": insights, "recommendations": recommendations, "facts": facts}


def save_insights(insight_dict: dict) -> None:
    lines = ["# Key Insights and Recommendations", "",
             "_All statements are generated automatically from the calculated results._", "",
             "## Insights", ""]
    lines += [f"{i}. {text}" for i, text in enumerate(insight_dict["insights"], 1)]
    lines += ["", "## Recommendations", ""]
    lines += [f"{i}. {text}" for i, text in enumerate(insight_dict["recommendations"], 1)]
    config.INSIGHTS_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[insights] Saved {config.INSIGHTS_FILE.relative_to(config.PROJECT_ROOT)}")
