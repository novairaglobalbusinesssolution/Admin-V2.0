import socket
import time
import os
import json
import logging
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Callable, Optional
import pandas as pd

# Ensure IPv4 is used on Windows to prevent IPv6 connection stalls
_orig_getaddrinfo = socket.getaddrinfo
def _ipv4_getaddrinfo(*args, **kwargs):
    responses = _orig_getaddrinfo(*args, **kwargs)
    ipv4 = [r for r in responses if r[0] == socket.AF_INET]
    return ipv4 if ipv4 else responses
socket.getaddrinfo = _ipv4_getaddrinfo
socket.setdefaulttimeout(15)

from google_play_scraper import reviews, Sort

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("review_engine")

# Indian languages supported by Google Play Store India
INDIAN_LANGUAGES = ['en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa']

class ReviewExtractionJob:
    def __init__(
        self,
        job_id: str,
        package_id: str,
        start_date: str,
        end_date: str,
        country: str = 'in',
        languages: Optional[List[str]] = None,
        max_reviews: int = 1000000,
        batch_size: int = 200,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ):
        self.job_id = job_id
        self.package_id = package_id
        self.country = country
        self.languages = languages if languages else INDIAN_LANGUAGES
        self.max_reviews = max_reviews if max_reviews and max_reviews > 0 else 1000000
        self.batch_size = batch_size
        self.progress_callback = progress_callback
        
        # Parse dates
        self.start_date = self._parse_date(start_date, is_start=True)
        self.end_date = self._parse_date(end_date, is_start=False)

        # State tracking
        self.status = "idle" # idle, running, completed, stopped, error
        self.error_message = ""
        self.reviews_list: List[Dict[str, Any]] = []
        self.buffer_next_list: List[Dict[str, Any]] = [] # 1-2 reviews of D+1 (next day buffer)
        self.buffer_prev_list: List[Dict[str, Any]] = [] # 1-2 reviews of D-1 (previous day buffer)
        self.newer_samples: List[Dict[str, Any]] = []    # Latest reviews (today/recent) for fast scroll
        self.seen_review_ids = set()
        self.scraped_total = 0
        self.duplicates_total = 0
        self.start_time = None
        self.end_time = None
        self.logs: List[str] = []

    def _parse_date(self, dt_str: str, is_start: bool = True) -> datetime:
        if not dt_str:
            return datetime.min if is_start else datetime.max
        dt_str = str(dt_str).strip()
        for fmt in ["%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d/%m/%Y"]:
            try:
                dt = datetime.strptime(dt_str, fmt)
                if not is_start:
                    dt = dt.replace(hour=23, minute=59, second=59)
                return dt
            except ValueError:
                pass
        try:
            dt = datetime.fromisoformat(dt_str)
            if not is_start and dt.hour == 0 and dt.minute == 0:
                dt = dt.replace(hour=23, minute=59, second=59)
            return dt
        except Exception:
            return datetime.min if is_start else datetime.max

    def log(self, message: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_entry = f"[{timestamp}] {message}"
        self.logs.append(log_entry)
        if len(self.logs) > 200:
            self.logs.pop(0)
        logger.info(message)
        self._notify_progress()

    def _notify_progress(self):
        if self.progress_callback:
            elapsed = (time.time() - self.start_time) if self.start_time else 0
            rate = round(len(self.reviews_list) / elapsed, 1) if elapsed > 0 else 0
            payload = {
                "job_id": self.job_id,
                "package_id": self.package_id,
                "status": self.status,
                "scraped_total": self.scraped_total,
                "unique_reviews": len(self.reviews_list),
                "duplicates": self.duplicates_total,
                "max_reviews": self.max_reviews,
                "start_date": self.start_date.strftime("%Y-%m-%d"),
                "end_date": self.end_date.strftime("%Y-%m-%d"),
                "country": self.country,
                "elapsed_seconds": round(elapsed, 1),
                "speed_per_sec": rate,
                "error": self.error_message,
                "logs": self.logs[-15:]
            }
            try:
                self.progress_callback(payload)
            except Exception as e:
                logger.error(f"Callback error: {e}")

    def stop(self):
        self.status = "stopped"
        self.log("Job cancellation requested by user.")

    def run(self) -> List[Dict[str, Any]]:
        self.status = "running"
        self.start_time = time.time()
        self.log(f"Starting review extraction for '{self.package_id}' (Country: {self.country.upper()})")
        self.log(f"Target Date Range: {self.start_date.strftime('%Y-%m-%d 00:00:00')} to {self.end_date.strftime('%Y-%m-%d 23:59:59')}")

        # Use NEWEST sort only for strict chronological progression and fast termination
        sort_modes = [Sort.NEWEST]

        try:
            for sort_mode in sort_modes:
                sort_name = "NEWEST"
                
                for lang in self.languages:
                    if self.status in ["stopped", "completed"]:
                        break
                    if len(self.reviews_list) >= self.max_reviews:
                        self.log(f"Reached target review count ({self.max_reviews}). Wrapping up.")
                        self.status = "completed"
                        break

                    self.log(f"Scraping stream: Language='{lang}', Sort='{sort_name}', Country='{self.country}'...")
                    
                    continuation_token = None
                    stop_language_stream = False
                    consecutive_older = 0
                    CONSECUTIVE_OLDER_LIMIT = 20

                    while True:
                        if self.status in ["stopped", "completed"] or stop_language_stream:
                            break
                        if len(self.reviews_list) >= self.max_reviews:
                            break

                        try:
                            result, continuation_token = reviews(
                                self.package_id,
                                lang=lang,
                                country=self.country,
                                sort=sort_mode,
                                count=self.batch_size,
                                continuation_token=continuation_token
                            )
                        except Exception as req_err:
                            self.log(f"Stream request warning ({lang}/{sort_name}): {req_err}")
                            time.sleep(1.0)
                            break

                        if not result:
                            self.log(f"End of stream reached for {lang}/{sort_name}.")
                            break

                        self.scraped_total += len(result)

                        for rev in result:
                            rev_id = rev.get("reviewId")
                            rev_at = rev.get("at") # datetime object from library

                            if not rev_at:
                                continue

                            # Helper to format clean dict
                            def _format_rev(r_dict, r_at):
                                s = r_dict.get("score", 0)
                                sent = "Positive" if s >= 4 else ("Neutral" if s == 3 else "Negative")
                                return {
                                    "reviewId": r_dict.get("reviewId"),
                                    "userName": r_dict.get("userName", "Anonymous"),
                                    "userImage": r_dict.get("userImage", ""),
                                    "rating": s,
                                    "sentiment": sent,
                                    "content": r_dict.get("content", ""),
                                    "thumbsUpCount": r_dict.get("thumbsUpCount", 0),
                                    "reviewCreatedVersion": r_dict.get("reviewCreatedVersion") or "N/A",
                                    "at": r_at.strftime("%Y-%m-%d %H:%M:%S"),
                                    "date": r_at.strftime("%Y-%m-%d"),
                                    "replyContent": r_dict.get("replyContent") or "",
                                    "repliedAt": r_dict.get("repliedAt").strftime("%Y-%m-%d %H:%M:%S") if r_dict.get("repliedAt") else "",
                                    "country": self.country.upper(),
                                    "language": lang
                                }

                            # If review is newer than target date end, capture buffer / recent and continue
                            if rev_at > self.end_date:
                                consecutive_older = 0
                                if len(self.newer_samples) < 3 and rev_id not in [x.get("reviewId") for x in self.newer_samples]:
                                    self.newer_samples.append(_format_rev(rev, rev_at))
                                # Keep 1-2 reviews right adjacent to target (D+1)
                                target_next_day = (self.end_date + timedelta(days=1)).date()
                                if rev_at.date() == target_next_day or len(self.buffer_next_list) < 2:
                                    if rev_id not in [x.get("reviewId") for x in self.buffer_next_list]:
                                        self.buffer_next_list.append(_format_rev(rev, rev_at))
                                        if len(self.buffer_next_list) > 2:
                                            self.buffer_next_list.pop(0) # keep closest to target
                                continue

                            # If review is older than target date start, capture buffer (D-1) and check limit
                            if rev_at < self.start_date:
                                consecutive_older += 1
                                target_prev_day = (self.start_date - timedelta(days=1)).date()
                                if (rev_at.date() == target_prev_day or len(self.buffer_prev_list) < 2):
                                    if rev_id not in [x.get("reviewId") for x in self.buffer_prev_list]:
                                        if len(self.buffer_prev_list) < 2:
                                            self.buffer_prev_list.append(_format_rev(rev, rev_at))
                                if consecutive_older >= CONSECUTIVE_OLDER_LIMIT:
                                    self.log(f"Language '{lang}' completed target date window (reached {rev_at.strftime('%Y-%m-%d')}).")
                                    stop_language_stream = True
                                    break
                                continue

                            # Reset older counter since this review is within the target date window
                            consecutive_older = 0

                            if rev_id in self.seen_review_ids:
                                self.duplicates_total += 1
                            else:
                                self.seen_review_ids.add(rev_id)

                            cleaned_item = _format_rev(rev, rev_at)
                            self.reviews_list.append(cleaned_item)

                            if len(self.reviews_list) >= self.max_reviews:
                                break

                        self._notify_progress()

                        if stop_language_stream or not continuation_token:
                            break

                        # Gentle sleep to respect rate limits
                        time.sleep(0.15)

            if self.status != "stopped":
                self.status = "completed"
                self.log(f"Extraction completed successfully! Total reviews extracted for target date: {len(self.reviews_list):,}")

        except Exception as global_err:
            self.status = "error"
            self.error_message = str(global_err)
            self.log(f"Extraction error encountered: {global_err}")

        self.end_time = time.time()
        self._notify_progress()
        return self.reviews_list

    EXPORT_COLUMNS = ["userName", "rating", "content", "thumbsUpCount", "at", "country"]

    def get_recording_zone_feed(self) -> Dict[str, Any]:
        """Return structured feed for Android Screen Recorder matching exact user workflow:
        - newer_reviews: reviews from latest date down to target for fast scroll
        - buffer_next: 1-2 reviews of D+1 (pre-target buffer)
        - target_reviews: 100% of target date reviews (D)
        - buffer_prev: 1-2 reviews of D-1 (post-target buffer)
        """
        return {
            "newer_reviews": self.newer_samples,
            "buffer_next": self.buffer_next_list,
            "target_reviews": self.reviews_list,
            "buffer_prev": self.buffer_prev_list
        }

    def to_dataframe(self) -> pd.DataFrame:
        if not self.reviews_list:
            return pd.DataFrame(columns=self.EXPORT_COLUMNS)
        df = pd.DataFrame(self.reviews_list)
        valid_cols = [c for c in self.EXPORT_COLUMNS if c in df.columns]
        return df[valid_cols]

    def export_csv(self, file_path: str) -> str:
        df = self.to_dataframe()
        dir_name = os.path.dirname(file_path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
        df.to_csv(file_path, index=False, encoding='utf-8-sig')
        return file_path

    def export_json(self, file_path: str) -> str:
        dir_name = os.path.dirname(file_path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
        filtered_list = [
            {
                "userName": r.get("userName"),
                "rating": r.get("rating"),
                "content": r.get("content"),
                "thumbsUpCount": r.get("thumbsUpCount"),
                "at": r.get("at"),
                "country": r.get("country")
            }
            for r in self.reviews_list
        ]
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(filtered_list, f, ensure_ascii=False, indent=2)
        return file_path

    def export_excel(self, file_path: str) -> str:
        df = self.to_dataframe()
        dir_name = os.path.dirname(file_path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
        df.to_excel(file_path, index=False, engine='openpyxl')
        return file_path
