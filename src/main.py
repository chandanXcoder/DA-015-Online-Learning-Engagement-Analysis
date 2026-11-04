"""
main.py
-------
Runs the complete DA-015 Online Learning Engagement Analysis pipeline:

    1. Load / generate dataset      -> dataset/online_learning.csv
    2. Clean data                   -> dataset/online_learning_cleaned.csv
    3. Data dictionary              -> dataset/data_dictionary.csv
    4. Engagement score
    5. EDA summary tables           -> reports/*.csv
    6. Charts                       -> charts/*.png
    7. Insights & academic report   -> reports/insights.md, reports/analysis_report.md
    8. Dashboards                   -> reports/dashboard.html, charts/00_dashboard_overview.png
    9. Dashboard website data       -> dashboard/assets/data/data.js (open dashboard/index.html)

Usage (from the project root):
    python src/main.py            # reuse the existing raw dataset if present
    python src/main.py --force    # regenerate the synthetic raw dataset
"""

import sys

try:
    import config
    from analysis import run_eda
    from build_website import build_website
    from dashboard import build_dashboards
    from data_cleaning import build_data_dictionary, clean_data
    from engagement import add_engagement_score
    from generate_data import get_raw_dataset
    from insights import generate_insights, save_insights
    from report import build_report
    from visualization import create_all_charts
except ImportError as err:  # most common beginner problem: libraries not installed
    print(f"ERROR: could not import a required library ({err}).")
    print("Install dependencies first:  pip install -r requirements.txt")
    sys.exit(1)


def main(force_regenerate: bool = False) -> None:
    print("=" * 60)
    print(" DA-015 Online Learning Engagement Analysis")
    print("=" * 60)
    config.ensure_directories()

    raw = get_raw_dataset(force=force_regenerate)
    cleaned = clean_data(raw)
    dictionary = build_data_dictionary()

    data = add_engagement_score(cleaned)
    results = run_eda(data)

    print("\nKey performance indicators:")
    for name, value in results["kpis"].items():
        print(f"  {name:28s} {value}")
    print()

    create_all_charts(data, results)
    insight_dict = generate_insights(data, results)
    save_insights(insight_dict)
    build_report(len(raw), data, results, insight_dict, dictionary)
    build_dashboards(results, insight_dict)
    build_website(data, results, insight_dict, len(raw))

    print("\nPipeline finished successfully. Outputs are in dataset/, charts/ and reports/.")
    print("Open dashboard/index.html in your browser to see the dashboard website.")


if __name__ == "__main__":
    try:
        main(force_regenerate="--force" in sys.argv)
    except FileNotFoundError as err:
        print(f"ERROR: file not found - {err}")
        sys.exit(1)
    except (ValueError, KeyError) as err:
        print(f"ERROR: problem with the data - {err}")
        sys.exit(1)
