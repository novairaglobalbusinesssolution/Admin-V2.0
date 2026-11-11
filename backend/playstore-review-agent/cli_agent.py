import os
import sys
import argparse
import time
from datetime import datetime, timedelta
from review_engine import ReviewExtractionJob, INDIAN_LANGUAGES
from app_info import get_app_details

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

def print_banner():
    print("""
================================================================================
          PLAY STORE LIVE REVIEW EXTRACTOR AGENT (INDIA SERVER)
================================================================================
    """)

def render_progress_bar(current: int, total: int, width: int = 30) -> str:
    percent = min(1.0, current / total) if total > 0 else 0
    filled = int(width * percent)
    bar = '█' * filled + '-' * (width - filled)
    return f"[{bar}] {percent*100:.1f}% ({current:,}/{total:,})"

def cli_progress_callback(data: dict):
    scraped = data.get("scraped_total", 0)
    unique = data.get("unique_reviews", 0)
    duplicates = data.get("duplicates", 0)
    max_rev = data.get("max_reviews", 1)
    speed = data.get("speed_per_sec", 0)
    status = data.get("status", "")
    
    bar_str = render_progress_bar(unique, max_rev)
    try:
        sys.stdout.write(f"\rStatus: {status:<10} | {bar_str} | Speed: {speed} rev/s | Dups: {duplicates}   ")
        sys.stdout.flush()
    except Exception:
        pass

def main():
    parser = argparse.ArgumentParser(description="Extract live Play Store reviews by package ID and date range.")
    parser.add_argument("-p", "--package", type=str, help="Play Store App Package ID (e.g. com.whatsapp, com.spotify.music)")
    parser.add_argument("-s", "--start-date", type=str, help="Start Date (YYYY-MM-DD)")
    parser.add_argument("-e", "--end-date", type=str, help="End Date (YYYY-MM-DD)")
    parser.add_argument("-c", "--country", type=str, default="in", help="Target country code (default: 'in' for India)")
    parser.add_argument("-m", "--max-reviews", type=int, default=20000, help="Maximum target review count (default: 20000)")
    parser.add_argument("-o", "--output", type=str, default="output_reviews.csv", help="Output file path (CSV/JSON/XLSX)")
    parser.add_argument("-f", "--format", type=str, choices=["csv", "json", "xlsx"], default="csv", help="Export format")
    parser.add_argument("-i", "--interactive", action="store_true", help="Launch interactive CLI wizard")

    args = parser.parse_args()
    print_banner()

    # If no package ID provided or interactive flag set, launch interactive wizard
    if not args.package or args.interactive:
        print(">>> Interactive Configuration Wizard <<<\n")
        pkg = input("Enter App Package ID (e.g., com.whatsapp, com.spotify.music, com.flipkart.android): ").strip()
        if not pkg:
            print("Package ID is required! Exiting.")
            sys.exit(1)
        args.package = pkg

        # App Info lookup preview
        print(f"\n[+] Fetching app details for '{pkg}'...")
        info = get_app_details(pkg, country=args.country)
        if info.get("success"):
            print(f"    App Name : {info['title']}")
            print(f"    Developer: {info['developer']}")
            print(f"    Rating   : ★ {info['score']} ({info['ratings']:,} ratings)")
            print(f"    Installs : {info['installs']}")
        else:
            print(f"    Warning: Could not fetch app preview: {info.get('error')}")

        print("\n--- Date Range Setup ---")
        today_str = datetime.now().strftime("%Y-%m-%d")
        thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

        s_date = input(f"Enter Start Date (YYYY-MM-DD) [default: {thirty_days_ago}]: ").strip()
        args.start_date = s_date if s_date else thirty_days_ago

        e_date = input(f"Enter End Date (YYYY-MM-DD) [default: {today_str}]: ").strip()
        args.end_date = e_date if e_date else today_str

        max_r = input(f"Enter Target Review Count (e.g. 20000) [default: 20000]: ").strip()
        if max_r and max_r.isdigit():
            args.max_reviews = int(max_r)

        out_f = input("Select Output Format (csv/json/xlsx) [default: csv]: ").strip().lower()
        if out_f in ["csv", "json", "xlsx"]:
            args.format = out_f
            args.output = f"{pkg}_reviews_{args.start_date}_to_{args.end_date}.{out_f}"
        else:
            args.output = f"{pkg}_reviews_{args.start_date}_to_{args.end_date}.csv"

    if not args.start_date:
        args.start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not args.end_date:
        args.end_date = datetime.now().strftime("%Y-%m-%d")

    print("\n--------------------------------------------------------------------------------")
    print(f" Starting Review Extraction Agent")
    print(f" Package ID   : {args.package}")
    print(f" Country      : {args.country.upper()} (India)")
    print(f" Date Bounds  : {args.start_date} -> {args.end_date}")
    print(f" Max Target   : {args.max_reviews:,} reviews")
    print(f" Output File  : {args.output}")
    print("--------------------------------------------------------------------------------\n")

    job = ReviewExtractionJob(
        job_id=f"cli_{int(time.time())}",
        package_id=args.package,
        start_date=args.start_date,
        end_date=args.end_date,
        country=args.country,
        languages=INDIAN_LANGUAGES,
        max_reviews=args.max_reviews,
        progress_callback=cli_progress_callback
    )

    t_start = time.time()
    results = job.run()
    t_end = time.time()

    print("\n\n================================================================================")
    print(" EXTRACTION COMPLETED SUMMARY")
    print("================================================================================")
    print(f" Total Unique Reviews Scraped : {len(results):,}")
    print(f" Duplicate Reviews Ignored   : {job.duplicates_total:,}")
    print(f" Total Elapsed Time          : {round(t_end - t_start, 2)} seconds")

    if results:
        # Exporting file
        out_path = args.output
        if args.format == "csv" or out_path.endswith(".csv"):
            job.export_csv(out_path)
        elif args.format == "json" or out_path.endswith(".json"):
            job.export_json(out_path)
        elif args.format == "xlsx" or out_path.endswith(".xlsx"):
            job.export_excel(out_path)
        
        abs_path = os.path.abspath(out_path)
        print(f"\n[✓] Review dataset saved successfully to:\n    {abs_path}")

        # Quick rating stats summary
        df = job.to_dataframe()
        print("\n--- Rating Distribution ---")
        rating_counts = df['rating'].value_counts().sort_index(ascending=False)
        for rating, cnt in rating_counts.items():
            pct = (cnt / len(df)) * 100
            stars = "★" * rating
            print(f"  {stars:<5} ({rating} star): {cnt:>6,} ({pct:.1f}%)")

        print("\n--- Sentiment Distribution ---")
        sent_counts = df['sentiment'].value_counts()
        for sent, cnt in sent_counts.items():
            pct = (cnt / len(df)) * 100
            print(f"  {sent:<10}: {cnt:>6,} ({pct:.1f}%)")
    else:
        print("\n[!] No reviews were found within the specified date range.")

if __name__ == "__main__":
    main()
