import os
import sys
import json
import re
import argparse
from datetime import datetime

# Force UTF-8 encoding
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Add current directory to path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from review_engine import ReviewExtractionJob, INDIAN_LANGUAGES

def clean_package_id(raw_str: str) -> str:
    """Extract clean android package ID from URL or package string."""
    if not raw_str:
        return ""
    raw_str = raw_str.strip()
    # Match id query parameter if URL
    match = re.search(r'[?&]id=([a-zA-Z0-9._]+)', raw_str)
    if match:
        return match.group(1)
    # If starts with market://details?id=
    match2 = re.search(r'id=([a-zA-Z0-9._]+)', raw_str)
    if match2:
        return match2.group(1)
    # Check if string itself looks like a package (e.g. com.app.pepperfry)
    clean = re.sub(r'[^a-zA-Z0-9._]', '', raw_str)
    return clean

def run_extraction(package_id: str, start_date: str, end_date: str, country: str = 'in', max_reviews: int = 5000):
    clean_pkg = clean_package_id(package_id)
    if not clean_pkg:
        return {
            "success": False,
            "error": f"Invalid package ID: {package_id}",
            "package_id": package_id,
            "reviews": []
        }

    job_id = f"cli_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    job = ReviewExtractionJob(
        job_id=job_id,
        package_id=clean_pkg,
        start_date=start_date,
        end_date=end_date,
        country=country,
        languages=INDIAN_LANGUAGES,
        max_reviews=max_reviews
    )

    try:
        job.run()
        reviews = job.reviews_list
        return {
            "success": True,
            "job_id": job_id,
            "package_id": clean_pkg,
            "start_date": start_date,
            "end_date": end_date,
            "country": country,
            "total_reviews": len(reviews),
            "status": job.status,
            "reviews": reviews
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "package_id": clean_pkg,
            "reviews": []
        }

def save_structured_excel(reviews_list, base_dir, task_id, app_name, target_date_str):
    """Saves excel file in REVIEW_EXCELS/{YEAR}/{MONTH}/{DAY}/ format."""
    try:
        dt = datetime.strptime(target_date_str, "%Y-%m-%d")
    except Exception:
        dt = datetime.now()

    year = dt.strftime("%Y")
    month = dt.strftime("%m")
    day = dt.strftime("%d")

    folder_path = os.path.join(base_dir, "REVIEW_EXCELS", year, month, day)
    os.makedirs(folder_path, exist_ok=True)

    safe_app_name = re.sub(r'[^a-zA-Z0-9_\- ]', '', str(app_name or 'App')).strip()
    safe_task_id = str(task_id or '0').replace('#', '')
    filename = f"[Task #{safe_task_id}] {safe_app_name} - Reviews ({year}-{month}-{day}).xlsx"
    file_path = os.path.join(folder_path, filename)

    try:
        import pandas as pd
        export_cols = ["userName", "rating", "content", "thumbsUpCount", "at", "country"]
        if reviews_list:
            df = pd.DataFrame(reviews_list)
            valid_cols = [c for c in export_cols if c in df.columns]
            df = df[valid_cols]
            # Rename for display
            rename_map = {
                "userName": "Reviewer Name",
                "rating": "Rating (Stars)",
                "content": "Review Content",
                "thumbsUpCount": "Helpful Votes",
                "at": "Review Date & Time",
                "country": "Country"
            }
            df.rename(columns=rename_map, inplace=True)
        else:
            df = pd.DataFrame(columns=["Reviewer Name", "Rating (Stars)", "Review Content", "Helpful Votes", "Review Date & Time", "Country"])

        df.to_excel(file_path, index=False, engine='openpyxl')
        return file_path
    except Exception as e:
        print(f"Error writing excel: {e}", file=sys.stderr)
        return None

def main():
    parser = argparse.ArgumentParser(description="Extract Google Play Store reviews for Live Checking Apps")
    parser.add_argument("--package_id", required=True, help="Google Play package ID or full Play Store URL")
    parser.add_argument("--start_date", required=True, help="Start date (Release Date) YYYY-MM-DD")
    parser.add_argument("--end_date", required=True, help="End date (Live Date) YYYY-MM-DD")
    parser.add_argument("--task_id", default="0", help="Novaira Task ID")
    parser.add_argument("--app_name", default="App", help="Application Name")
    parser.add_argument("--country", default="in", help="Country code (default: in)")
    parser.add_argument("--max_reviews", type=int, default=5000, help="Max reviews to scrape")
    parser.add_argument("--output_excel_dir", default="", help="Base directory to save structured REVIEW_EXCELS")
    parser.add_argument("--output_json_path", default="", help="Path to write output JSON")

    args = parser.parse_args()

    result = run_extraction(
        package_id=args.package_id,
        start_date=args.start_date,
        end_date=args.end_date,
        country=args.country,
        max_reviews=args.max_reviews
    )

    if result.get("success") and args.output_excel_dir:
        excel_path = save_structured_excel(
            reviews_list=result.get("reviews", []),
            base_dir=args.output_excel_dir,
            task_id=args.task_id,
            app_name=args.app_name,
            target_date_str=args.end_date
        )
        result["excel_file_path"] = excel_path

    output_str = json.dumps(result, ensure_ascii=False)
    if args.output_json_path:
        with open(args.output_json_path, 'w', encoding='utf-8') as f:
            f.write(output_str)

    print(output_str)

if __name__ == '__main__':
    main()
