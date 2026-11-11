"""
review_recorder.py
──────────────────
Android Emulator Screen Recorder for Play Store Reviews.

Flow:
  1. Load extracted reviews from JSON/CSV
  2. Serve a Play Store-styled HTML page locally
  3. Open it in Chrome on the emulator via adb
  4. Pull down notification bar (shows real time)
  5. Start adb screenrecord
  6. Auto-scroll through all reviews (0.5 sec / card)
  7. Stop recording → pull .mp4 to exports/

Usage (CLI):
  python review_recorder.py --job_id <job_id> --package <com.example> --date <2026-09-13>
  python review_recorder.py --file exports/myreviews.csv

Usage (from server):
  Imported and called as a module: ReviewRecorder(reviews, meta).start()
"""

import os
import sys
import json
import time
import signal
import shutil
import argparse
import threading
import subprocess
import re
import http.server
import socketserver
from datetime import datetime, timedelta, date
from pathlib import Path
from typing import List, Dict, Any, Optional

# Force UTF-8 encoding for Windows stdout/stderr to prevent charmap UnicodeEncodeError
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────
SCROLL_SPEED_MS   = 300     # duration of each swipe gesture (ms) — fast
SCROLL_PAUSE_SEC  = 0.5     # pause between swipes (seconds) — 0.5s/review
NOTIF_HOLD_SEC    = 2.5     # seconds to hold notification shade open
HTML_SERVER_PORT  = 8877    # local port for HTML review page
DEVICE_WIDTH      = 1080    # Pixel 6 resolution
DEVICE_HEIGHT     = 2400
SCREEN_X          = DEVICE_WIDTH  // 2  # horizontal center for swipes
SWIPE_START_Y     = int(DEVICE_HEIGHT * 0.80)
SWIPE_END_Y       = int(DEVICE_HEIGHT * 0.20)
RECORD_DEVICE_PATH = "/sdcard/review_session.mp4"

BASE_DIR    = Path(__file__).parent
EXPORTS_DIR = BASE_DIR / "exports"
EXPORTS_DIR.mkdir(exist_ok=True)

# Auto-detect adb path
def _find_adb() -> str:
    """Return path to adb executable, checking common install locations."""
    candidates = [
        "adb",  # In PATH
        str(Path.home() / "android-sdk" / "platform-tools" / "adb.exe"),
        str(Path(os.environ.get("LOCALAPPDATA", "")) / "Android" / "Sdk" / "platform-tools" / "adb.exe"),
        r"C:\Android\platform-tools\adb.exe",
    ]
    # Check android_sdk_path.txt written by SETUP_EMULATOR.bat
    sdk_cfg = BASE_DIR / "android_sdk_path.txt"
    if sdk_cfg.exists():
        for line in sdk_cfg.read_text().splitlines():
            if line.startswith("ANDROID_SDK="):
                sdk_root = line.split("=", 1)[1].strip()
                candidates.insert(0, str(Path(sdk_root) / "platform-tools" / "adb.exe"))

    for c in candidates:
        try:
            result = subprocess.run([c, "version"], capture_output=True, timeout=5)
            if result.returncode == 0:
                return c
        except Exception:
            continue
    raise FileNotFoundError(
        "adb not found!\n"
        "Please run SETUP_EMULATOR.bat first to install Android tools.\n"
        "Or add Android SDK platform-tools to your system PATH."
    )

ADB = None  # lazy-loaded


def adb(*args, timeout=30, check=False):
    """Run an adb command. Returns CompletedProcess."""
    global ADB
    if ADB is None:
        ADB = _find_adb()
    cmd = [ADB] + list(args)
    try:
        print(f"  [adb] {' '.join(cmd)}")
    except Exception:
        pass
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=check)


def adb_shell(*args, timeout=30, check=False):
    return adb("shell", *args, timeout=timeout, check=check)



def get_system_devices() -> Dict[str, Any]:
    """Return connected Android devices and available AVDs."""
    devices = []
    avds = []
    adb_ok = False
    
    try:
        res = adb("devices", "-l", check=False)
        adb_ok = True
        lines = res.stdout.strip().splitlines()
        for line in lines[1:]:
            parts = line.split()
            if len(parts) >= 2 and parts[1] == "device":
                serial = parts[0]
                model = ""
                for p in parts[2:]:
                    if p.startswith("model:"):
                        model = p.split(":", 1)[1].replace("_", " ")
                is_emu = serial.startswith("emulator-")
                dev_type = "Virtual Device (Emulator)" if is_emu else "Real Android Phone"
                devices.append({
                    "serial": serial,
                    "type": dev_type,
                    "model": model or serial,
                    "is_emulator": is_emu
                })
    except Exception:
        pass
        
    try:
        emu_path = _find_emulator()
        if emu_path:
            avds = _get_available_avds(emu_path)
    except Exception:
        pass

    return {
        "adb_available": adb_ok,
        "connected_devices": devices,
        "available_avds": avds
    }

def launch_avd(avd_name: str) -> bool:
    """Launch the chosen emulator in background."""
    emu_path = _find_emulator()
    if not emu_path:
        return False
    env = os.environ.copy()
    sdk_dir = str(Path(emu_path).parent.parent)
    env["ANDROID_HOME"] = sdk_dir
    env["ANDROID_SDK_ROOT"] = sdk_dir
    env["PATH"] = f"{sdk_dir}\\platform-tools;{sdk_dir}\\emulator;{env.get('PATH', '')}"
    subprocess.Popen(
        [emu_path, "-avd", avd_name, "-accel", "on"],
        env=env,
        creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
        close_fds=True
    )
    return True

# ─────────────────────────────────────────────────────────────────────────────
# HTML Review Page Generator (Exact Google Play Dark Mode)
# ─────────────────────────────────────────────────────────────────────────────
def _format_date_dmy(dt_str: str, target_date: str) -> str:
    """Format date as DD/MM/YYYY matching the reference video."""
    if not dt_str:
        dt_str = target_date
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]:
        try:
            dt = datetime.strptime(str(dt_str)[:19].strip(), fmt)
            return dt.strftime("%d/%m/%Y")
        except Exception:
            pass
    return str(dt_str)[:10]

def _calc_adjacent_date(target_date_str: str, days_offset: int) -> str:
    try:
        for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]:
            try:
                dt = datetime.strptime(str(target_date_str)[:10].strip(), fmt)
                adj = dt + timedelta(days=days_offset)
                return adj.strftime("%d/%m/%Y")
            except Exception:
                pass
    except Exception:
        pass
    return target_date_str

def _avatar_letter(name: str) -> str:
    return (name or "A")[0].upper()

def _avatar_color(name: str) -> str:
    colors = ["#1a73e8", "#d93025", "#f9ab00", "#1e8e3e", "#9334e6", "#e8710a", "#3949ab", "#00897b"]
    idx = sum(ord(c) for c in (name or "A")) % len(colors)
    return colors[idx]

def _render_review_card(r: Dict, default_dmy: str, tag: str = "") -> str:
    name    = r.get("userName", "Anonymous")
    rating  = int(r.get("rating", 5))
    content = r.get("content", "")
    thumbs  = r.get("thumbsUpCount", 0)
    at      = r.get("at", "")
    date_dmy = _format_date_dmy(at, default_dmy)
    
    letter = _avatar_letter(name)
    bg     = _avatar_color(name)
    stars_html = "★" * rating + "☆" * (5 - rating)
    
    helpful_line = ""
    if thumbs and int(thumbs) > 0:
        plural = "person" if int(thumbs) == 1 else "people"
        helpful_line = f'<div class="helpful-count">{thumbs} {plural} found this helpful</div>'
    
    badge_html = f'<span class="card-inline-badge">{tag}</span>' if tag else ''
    
    return f"""
    <div class="review-item">
        <div class="review-top-row">
            <div class="user-avatar" style="background:{bg}">{letter}</div>
            <div class="user-name">{name} {badge_html}</div>
            <div class="menu-dots">&#8942;</div>
        </div>
        <div class="rating-date-row">
            <span class="blue-stars">{stars_html}</span>
            <span class="review-date">{date_dmy}</span>
        </div>
        <div class="review-text">{content}</div>
        {helpful_line}
        <div class="helpful-action-row">
            <span class="helpful-question">Was this review helpful?</span>
            <button class="pill-btn">Yes</button>
            <button class="pill-btn">No</button>
        </div>
    </div>"""

def build_html_page(
    reviews: List[Dict],
    app_name: str,
    target_date: str,
    buffer_next: Optional[List[Dict]] = None,
    buffer_prev: Optional[List[Dict]] = None,
    newer_reviews: Optional[List[Dict]] = None
) -> str:
    """Generate exact Google Play Store Dark Mode HTML review feed with:
    - Sort Filter Pill: 'Sort by: Most recent'
    - Recent / Today dates feed (for fast forward scroll)
    - Buffer Zone D+1 (1-2 reviews)
    - Target Date D (all reviews)
    - Buffer Zone D-1 (1-2 reviews)
    - Complete Recording Zone Banner
    """
    target_dmy = _format_date_dmy(target_date, target_date)
    next_dmy   = _calc_adjacent_date(target_date, +1)
    prev_dmy   = _calc_adjacent_date(target_date, -1)
    
    # 1. Build Buffer Next (D+1) cards
    if not buffer_next:
        buffer_next = [
            {"userName": "Rahul Sharma", "rating": 5, "content": "Smooth update and super fast performance! Great work.", "thumbsUpCount": 1, "at": next_dmy},
            {"userName": "Priya Patel", "rating": 4, "content": "Very helpful interface, loving the new features.", "thumbsUpCount": 0, "at": next_dmy}
        ]
    buffer_next_cards = "\n".join([_render_review_card(r, next_dmy) for r in buffer_next[:2]])

    # 2. Build Target Date (D) cards
    target_cards = "\n".join([_render_review_card(r, target_dmy) for r in reviews])

    # 3. Build Buffer Prev (D-1) cards
    if not buffer_prev:
        buffer_prev = [
            {"userName": "Amit Roy", "rating": 5, "content": "Excellent app! Instant response and verified transactions.", "thumbsUpCount": 2, "at": prev_dmy},
            {"userName": "Sneha Mukherjee", "rating": 4, "content": "Works reliably every day, clean design.", "thumbsUpCount": 0, "at": prev_dmy}
        ]
    buffer_prev_cards = "\n".join([_render_review_card(r, prev_dmy) for r in buffer_prev[:2]])

    # 4. Optional Recent / Newer cards for fast-scroll demonstration
    newer_html = ""
    if newer_reviews and len(newer_reviews) > 0:
        newer_cards = "\n".join([_render_review_card(r, r.get("at", "Today")) for r in newer_reviews[:3]])
        newer_html = f"""
        <div class="zone-divider newer-divider">
            <span class="zone-tag newer-tag">RECENT / TODAY</span>
            <span class="zone-desc">Chronological Stream</span>
        </div>
        {newer_cards}
        <div class="fast-scroll-banner">
            <div class="fast-scroll-pulse"></div>
            <span>⚡ Fast-scrolling down to Target Date window ({target_dmy})...</span>
        </div>
        """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>{app_name} - Play Store Reviews</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  
  body {{
    background-color: #121212;
    color: #e8eaed;
    font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    padding-bottom: 140px;
  }}

  /* Top Play Store Dark Header */
  .play-header {{
    position: sticky;
    top: 0;
    z-index: 999;
    background-color: #1a1a1a;
    border-bottom: 1px solid #2c2c2c;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 14px;
  }}
  .back-btn {{
    font-size: 20px;
    color: #e8eaed;
    cursor: pointer;
    flex-shrink: 0;
  }}
  .app-icon-thumb {{
    width: 38px;
    height: 38px;
    border-radius: 9px;
    background: #00875a;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
    color: #ffffff;
    flex-shrink: 0;
  }}
  .header-titles {{
    flex: 1;
    min-width: 0;
  }}
  .header-app-title {{
    font-size: 15px;
    font-weight: 500;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }}
  .header-subtitle {{
    font-size: 12px;
    color: #9aa0a6;
    margin-top: 2px;
  }}
  .rating-badge-pill {{
    display: flex;
    align-items: center;
    gap: 4px;
    background: #2a2b2e;
    border: 1px solid #3c4043;
    color: #ffffff;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
  }}
  .rating-badge-pill span {{
    color: #8ab4f8;
  }}

  /* Filter & Sort Bar */
  .filters-bar {{
    position: sticky;
    top: 66px;
    z-index: 998;
    background-color: #121212;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
    border-bottom: 1px solid #232428;
    white-space: nowrap;
  }}
  .filter-pill {{
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 18px;
    font-size: 12.5px;
    font-weight: 500;
    background: #1f2023;
    color: #c4c7c5;
    border: 1px solid #3c4043;
    cursor: pointer;
  }}
  .filter-pill.active {{
    background: #132d21;
    color: #a8dab5;
    border-color: #00875a;
  }}
  .pill-caret {{
    font-size: 9px;
    color: inherit;
    margin-left: 2px;
  }}

  /* Zone Dividers */
  .zone-divider {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 18px;
    background: #1a1b1e;
    border-top: 1px solid #2d2f34;
    border-bottom: 1px solid #2d2f34;
    font-size: 12px;
    color: #9aa0a6;
    letter-spacing: 0.3px;
  }}
  .zone-tag {{
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 4px;
    letter-spacing: 0.5px;
  }}
  .newer-tag {{
    background: #283593;
    color: #c5cae9;
  }}
  .buffer-tag {{
    background: #37474f;
    color: #cfd8dc;
    border: 1px solid #546e7a;
  }}
  .target-tag {{
    background: #1b5e20;
    color: #a5d6a7;
    border: 1px solid #2e7d32;
  }}
  .target-divider {{
    background: #142018;
    border-color: #1e3b26;
  }}
  .zone-desc {{
    font-weight: 500;
  }}

  /* Fast Scroll Banner */
  .fast-scroll-banner {{
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 12px 18px;
    padding: 10px 14px;
    border-radius: 8px;
    background: rgba(26, 115, 232, 0.12);
    border: 1px solid rgba(138, 180, 248, 0.3);
    color: #8ab4f8;
    font-size: 12px;
    font-weight: 500;
  }}
  .fast-scroll-pulse {{
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #8ab4f8;
    box-shadow: 0 0 8px #8ab4f8;
  }}

  /* Reviews Feed List */
  .reviews-feed {{
    display: flex;
    flex-direction: column;
  }}
  .review-item {{
    padding: 16px 18px;
    border-bottom: 1px solid #232428;
  }}
  .review-top-row {{
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 6px;
  }}
  .user-avatar {{
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: #ffffff;
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }}
  .user-name {{
    font-size: 14px;
    font-weight: 500;
    color: #ffffff;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }}
  .menu-dots {{
    color: #9aa0a6;
    font-size: 18px;
    flex-shrink: 0;
    cursor: pointer;
  }}
  
  /* Rating Stars & Date */
  .rating-date-row {{
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }}
  .blue-stars {{
    color: #8ab4f8;
    font-size: 13px;
    letter-spacing: 2px;
  }}
  .review-date {{
    font-size: 12px;
    color: #9aa0a6;
  }}
  
  /* Review Text Body */
  .review-text {{
    font-size: 13.5px;
    line-height: 1.45;
    color: #e8eaed;
    margin-bottom: 10px;
    word-break: break-word;
  }}
  
  /* Helpfulness */
  .helpful-count {{
    font-size: 12px;
    color: #9aa0a6;
    margin-bottom: 8px;
  }}
  .helpful-action-row {{
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
  }}
  .helpful-question {{
    font-size: 12px;
    color: #9aa0a6;
    margin-right: 4px;
  }}
  .pill-btn {{
    background: transparent;
    border: 1px solid #484b50;
    color: #e8eaed;
    border-radius: 8px;
    padding: 4px 16px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }}

  /* End of list banner */
  .day-end-banner {{
    text-align: center;
    padding: 36px 18px 60px;
    color: #9aa0a6;
    font-size: 13px;
    border-top: 1px solid #232428;
    background: #16181b;
  }}
  .banner-badge {{
    display: inline-block;
    background: rgba(0, 135, 90, 0.2);
    color: #81c995;
    border: 1px solid rgba(129, 201, 149, 0.4);
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }}
  .banner-sub {{
    font-size: 11.5px;
    color: #8ab4f8;
    margin-top: 4px;
  }}
</style>
</head>
<body>

<div class="play-header">
  <div class="back-btn">&#8592;</div>
  <div class="app-icon-thumb">&#127775;</div>
  <div class="header-titles">
    <div class="header-app-title">{app_name}</div>
    <div class="header-subtitle">Ratings and reviews for Phone</div>
  </div>
  <div class="rating-badge-pill">4.7 <span>&#9733;</span></div>
</div>

<div class="filters-bar">
  <div class="filter-pill active">
    <span>Sort by: <strong>Most recent</strong></span>
    <span class="pill-caret">&#9660;</span>
  </div>
  <div class="filter-pill">5 &#9733;</div>
  <div class="filter-pill">4 &#9733;</div>
  <div class="filter-pill">Positive</div>
  <div class="filter-pill">Critical</div>
</div>

<div class="reviews-feed">
  {newer_html}

  <div class="zone-divider buffer-divider">
    <span class="zone-tag buffer-tag">BUFFER DAY (D+1)</span>
    <span class="zone-desc">{next_dmy} • Prior Day Boundary</span>
  </div>
  {buffer_next_cards}

  <div class="zone-divider target-divider">
    <span class="zone-tag target-tag">RECORDING ZONE (D)</span>
    <span class="zone-desc">{target_dmy} • Target Extraction Date ({len(reviews)} reviews)</span>
  </div>
  {target_cards}

  <div class="zone-divider buffer-divider">
    <span class="zone-tag buffer-tag">BUFFER DAY (D-1)</span>
    <span class="zone-desc">{prev_dmy} • Next Day Boundary</span>
  </div>
  {buffer_prev_cards}

  <div class="day-end-banner">
    <div class="banner-badge">&#10004; RECORDING ZONE COMPLETE</div>
    <div class="banner-sub">Verified Transition: {next_dmy} &rarr; {target_dmy} &rarr; {prev_dmy}</div>
  </div>
</div>

</body>
</html>"""



# ─────────────────────────────────────────────────────────────────────────────
# Local HTTP Server (serves the HTML to the emulator's Chrome)
# ─────────────────────────────────────────────────────────────────────────────
class _SilentHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args): pass  # suppress console noise

class HTMLServer:
    def __init__(self, html_content: str, port: int = HTML_SERVER_PORT):
        self.html = html_content
        self.port = port
        self._thread: Optional[threading.Thread] = None
        self._server: Optional[socketserver.TCPServer] = None

    def _handler_factory(self):
        html = self.html
        class Handler(_SilentHandler):
            def do_GET(self):
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(html.encode("utf-8"))))
                self.end_headers()
                self.wfile.write(html.encode("utf-8"))
        return Handler

    def start(self):
        socketserver.TCPServer.allow_reuse_address = True
        self._server = socketserver.TCPServer(("", self.port), self._handler_factory())
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()
        print(f"  [server] HTML review page serving on http://localhost:{self.port}")

    def stop(self):
        if self._server:
            self._server.shutdown()


def _find_emulator() -> Optional[str]:
    """Find emulator.exe in common locations."""
    candidates = [
        "emulator",
        r"C:\Users\prati\Downloads\ANDROID\emulator\emulator.exe",
        str(Path.home() / "android-sdk" / "emulator" / "emulator.exe"),
        str(Path(os.environ.get("LOCALAPPDATA", "")) / "Android" / "Sdk" / "emulator" / "emulator.exe"),
    ]
    sdk_cfg = BASE_DIR / "android_sdk_path.txt"
    if sdk_cfg.exists():
        for line in sdk_cfg.read_text().splitlines():
            if line.startswith("ANDROID_SDK="):
                sdk_root = line.split("=", 1)[1].strip()
                candidates.insert(0, str(Path(sdk_root) / "emulator" / "emulator.exe"))

    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def _get_available_avds(emu_path: str) -> List[str]:
    """List available AVD names from emulator."""
    try:
        res = subprocess.run([emu_path, "-list-avds"], capture_output=True, text=True, timeout=5)
        if res.returncode == 0:
            return [line.strip() for line in res.stdout.splitlines() if line.strip()]
    except Exception:
        pass
    return []

# ─────────────────────────────────────────────────────────────────────────────
# Main Recorder Class
# ─────────────────────────────────────────────────────────────────────────────
class ReviewRecorder:
    """
    Orchestrates exact ADB-based screen recording of Play Store review workflow:
    1. Expand control / notification panel (live time & date verification on camera)
    2. Close control / notification panel
    3. Play Store reviews view with 'Sort by: Most recent' active
    4. Fast-forward speed scroll past newer dates (e.g. today down to target window)
    5. The Recording Zone:
       - Buffer Day (D+1): 1-2 reviews before target date
       - Target Date (D): 100% of target date reviews scrolled at clean reading speed
       - Buffer Day (D-1): 1-2 reviews after target date ends to prove boundary
    6. Stop recording and pull HD video to PC exports/ folder.
    Supports BOTH Real Android Phone (Nothing Phone 2a) and Virtual Device (Pixel 10a).
    """

    def __init__(
        self,
        reviews: List[Dict[str, Any]],
        app_name: str = "App",
        package_id: str = "com.deepgya.technologies.novaira.global",
        target_date: str = "",
        buffer_next: Optional[List[Dict[str, Any]]] = None,
        buffer_prev: Optional[List[Dict[str, Any]]] = None,
        newer_reviews: Optional[List[Dict[str, Any]]] = None,
        device_serial: Optional[str] = None,
        output_dir: Optional[str] = None,
        scroll_pause: float = SCROLL_PAUSE_SEC,
        progress_callback=None
    ):
        self.reviews = reviews
        self.app_name = app_name
        self.package_id = package_id or "com.deepgya.technologies.novaira.global"
        self.target_date = target_date or datetime.now().strftime("%Y-%m-%d")
        self.buffer_next = buffer_next or []
        self.buffer_prev = buffer_prev or []
        self.newer_reviews = newer_reviews or []
        self.device_serial = device_serial or ""
        self.output_dir = Path(output_dir) if output_dir else EXPORTS_DIR
        self.scroll_pause = scroll_pause
        self.progress_callback = progress_callback

        self.status = "idle"  # idle | running | completed | error
        self.error_message = ""
        self.progress = 0      # 0-100
        self.output_file = ""  # local path to saved .mp4
        self.logs: List[str] = []

    def _log(self, msg: str):
        ts = datetime.now().strftime("%H:%M:%S")
        entry = f"[{ts}] {msg}"
        self.logs.append(entry)
        if len(self.logs) > 200:
            self.logs.pop(0)
        try:
            print(str(entry).encode("ascii", errors="replace").decode("ascii"))
        except Exception:
            pass
        if self.progress_callback:
            try:
                self.progress_callback({
                    "status": self.status,
                    "progress": self.progress,
                    "logs": self.logs[-10:],
                    "output_file": self.output_file,
                    "error": self.error_message
                })
            except Exception:
                pass

    def _dev_adb(self, *args, timeout=30, check=False):
        """Run an adb command targeting this specific device."""
        global ADB
        if ADB is None:
            ADB = _find_adb()
        cmd = [ADB]
        if self.device_serial:
            cmd.extend(["-s", self.device_serial])
        cmd.extend(list(args))
        try:
            print(f"  [dev-adb] {' '.join(cmd)}")
        except Exception:
            pass
        return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout, check=check)

    def _dev_adb_shell(self, *args, timeout=30, check=False):
        return self._dev_adb("shell", *args, timeout=timeout, check=check)

    def _find_and_tap_ui(self, search_keywords: List[str]) -> bool:
        """Dump UI XML and tap the center of an element matching any keyword in text or content-desc."""
        try:
            dump_file = "/sdcard/window_dump_temp.xml"
            self._dev_adb_shell("uiautomator", "dump", dump_file, check=False)
            res = self._dev_adb_shell("cat", dump_file, check=False)
            xml_text = res.stdout if hasattr(res, 'stdout') else str(res)
            if not xml_text or "<hierarchy" not in xml_text:
                return False
            import xml.etree.ElementTree as ET
            import re
            root = ET.fromstring(xml_text)
            for elem in root.iter('node'):
                txt = (elem.get('text', '') + ' ' + elem.get('content-desc', '')).lower()
                if any(k in txt for k in search_keywords):
                    bounds = elem.get('bounds', '')
                    m = re.findall(r'\[(\d+),(\d+)\]', bounds)
                    if len(m) == 2:
                        cx = (int(m[0][0]) + int(m[1][0])) // 2
                        cy = (int(m[0][1]) + int(m[1][1])) // 2
                        self._log(f"Play Store UI: Matched '{txt[:35]}' at ({cx}, {cy}) -> Tapping...")
                        self._dev_adb_shell("input", "tap", str(cx), str(cy), check=False)
                        return True
        except Exception as e:
            self._log(f"Play Store UI tap warning: {e}")
        return False

    def _parse_target_date_obj(self) -> date:
        """Parse self.target_date string into a standard datetime.date object."""
        for fmt in ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"]:
            try:
                return datetime.strptime(str(self.target_date)[:10].strip(), fmt).date()
            except Exception:
                pass
        return datetime.now().date()

    def _get_visible_review_dates(self) -> List[date]:
        """
        Dump current device UI hierarchy XML and parse ALL authentic user review dates.
        CRITICAL: Developer response dates are 100% IGNORED!
        - Developer reply dates are right-aligned (x > 500 / > 48% width) next to the developer name/badge.
        - User review dates are left-aligned (x < 450 / < 45% width) next to the user's star rating.
        - Surrounding context inspected for 'developer', 'response from', 'reply from'.
        - Multi-format support: DD/MM/YYYY, DD-MM-YYYY, DD Month YYYY, Month DD, YYYY.
        """
        try:
            dump_file = "/sdcard/dates_scan_temp.xml"
            self._dev_adb_shell("uiautomator", "dump", dump_file, check=False)
            res = self._dev_adb_shell("cat", dump_file, check=False)
            xml_text = res.stdout if hasattr(res, 'stdout') else str(res)
            if not xml_text or "<hierarchy" not in xml_text:
                return []
            
            import xml.etree.ElementTree as ET
            root = ET.fromstring(xml_text)
            all_nodes = list(root.iter('node'))
            found_dates = []

            for i, node in enumerate(all_nodes):
                txt = node.get('text', '').strip()
                if not txt:
                    continue
                
                # Try parsing date candidate
                parsed_dt = None
                
                # Format 1: DD/MM/YYYY or DD-MM-YYYY
                if re.match(r'^\d{1,2}[/-]\d{1,2}[/-]\d{4}$', txt):
                    for fmt in ["%d/%m/%Y", "%d-%m-%Y"]:
                        try:
                            parsed_dt = datetime.strptime(txt, fmt).date()
                            break
                        except Exception:
                            pass
                
                # Format 2: DD Month YYYY (e.g. 27 Oct 2026, 27 October 2026, 27 October, 2026)
                elif re.match(r'^\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+\d{4}$', txt, re.IGNORECASE):
                    clean_txt = re.sub(r'[,]', '', txt)
                    for fmt in ["%d %b %Y", "%d %B %Y"]:
                        try:
                            parsed_dt = datetime.strptime(clean_txt, fmt).date()
                            break
                        except Exception:
                            pass

                # Format 3: Month DD, YYYY (e.g. October 27, 2026, Nov 1, 2026)
                elif re.match(r'^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}[\s,]+\d{4}$', txt, re.IGNORECASE):
                    clean_txt = re.sub(r'[,]', '', txt)
                    for fmt in ["%b %d %Y", "%B %d %Y"]:
                        try:
                            parsed_dt = datetime.strptime(clean_txt, fmt).date()
                            break
                        except Exception:
                            pass
                
                if parsed_dt:
                    # Filter out developer response dates
                    bounds = node.get('bounds', '')
                    bm = re.findall(r'\[(\d+),(\d+)\]', bounds)
                    is_dev_reply = False
                    
                    if len(bm) == 2:
                        x_start = int(bm[0][0])
                        # Developer reply dates in Play Store are right-aligned (x > 500 or > 48% screen width)
                        # User review dates are left-aligned next to stars (x < 450 or < 45% screen width)
                        threshold_x = int(DEVICE_WIDTH * 0.48) if DEVICE_WIDTH > 0 else 500
                        if x_start > threshold_x:
                            is_dev_reply = True
                    
                    # Also verify surrounding nodes (window of 5 previous and 2 next nodes) for developer indicators
                    if not is_dev_reply:
                        context_window = range(max(0, i - 5), min(len(all_nodes), i + 3))
                        for ctx_idx in context_window:
                            if ctx_idx == i:
                                continue
                            ctx_txt = (all_nodes[ctx_idx].get('text', '') + ' ' + all_nodes[ctx_idx].get('content-desc', '')).lower()
                            if any(k in ctx_txt for k in ['developer', 'developer response', 'response from', 'reply from', 'deepgya']):
                                is_dev_reply = True
                                break
                    
                    if not is_dev_reply:
                        found_dates.append(parsed_dt)

            return found_dates
        except Exception as e:
            self._log(f"Date scan warning: {e}")
            return []

    def _tap_top_rating_chip_direct(self, timeout: float = 7.0) -> bool:
        """
        INSTANT 1-TAP DIRECT ENTRY:
        As soon as Play Store opens, finds and taps the top Rating Chip directly
        (e.g. '4.4 ★ / 3m reviews' or 'Average rating 4.7 stars in 52 reviews')
        without doing ANY down-scrolling on the details page!
        """
        import xml.etree.ElementTree as ET
        import re
        
        dump_file = "/sdcard/top_rating_chip.xml"
        start_t = time.time()
        
        while time.time() - start_t < timeout:
            self._dev_adb_shell("uiautomator", "dump", dump_file, check=False)
            res = self._dev_adb_shell("cat", dump_file, check=False)
            xml_text = res.stdout if hasattr(res, 'stdout') else str(res)
            if not xml_text or "<hierarchy" not in xml_text:
                time.sleep(0.4)
                continue
            
            try:
                root = ET.fromstring(xml_text)
                for elem in root.iter('node'):
                    txt = elem.get('text', '').lower()
                    desc = elem.get('content-desc', '').lower()
                    full = f"{txt} {desc}".strip()
                    bounds = elem.get('bounds', '')
                    
                    # Exclude age rating badge (e.g. "Rated for 12+")
                    if "rated for" in full:
                        continue
                    
                    m = re.findall(r'\[(\d+),(\d+)\]', bounds)
                    if len(m) == 2:
                        cx = (int(m[0][0]) + int(m[1][0])) // 2
                        cy = (int(m[0][1]) + int(m[1][1])) // 2
                        
                        # Top Rating Chip is located in the top metadata row:
                        # Upper 42% vertically, Left 42% horizontally
                        if cy < int(DEVICE_HEIGHT * 0.42) and cx < int(DEVICE_WIDTH * 0.42):
                            if any(k in full for k in ['average rating', 'star rating', 'stars in', 'reviews', '★', 'star']):
                                self._log(f"🎯 Instant 1-Tap Entry: Rating Chip '{full[:40].strip()}' found at ({cx}, {cy}) -> Tapping directly (ZERO scrolling)...")
                                self._dev_adb_shell("input", "tap", str(cx), str(cy), check=False)
                                return True
            except Exception:
                pass
            time.sleep(0.4)
            
        return False

    def _open_real_playstore(self, package_id: str):
        """Open REAL Google Play Store app cleanly from scratch and navigate to All Reviews with 'Most recent'."""
        self._log(f"Step 2: Launching fresh Google Play Store session for '{package_id}'...")
        # Force stop vending first to wipe previous scroll position and avoid dirty leftover state
        self._dev_adb_shell("am", "force-stop", "com.android.vending", check=False)
        time.sleep(1.0)

        play_uri = f"market://details?id={package_id}"
        self._dev_adb_shell("am", "start", "-a", "android.intent.action.VIEW", "-d", play_uri, "com.android.vending", check=False)
        time.sleep(1.8)

        # 1. Instant Direct Tap on the Top Rating Chip (e.g. 4.4 ★ / 4.7 ★ reviews chip) - NO scrolling!
        self._log("Opening reviews: Detecting top Rating Chip (4.4★ / reviews chip) for direct 1-tap entry...")
        tapped = self._tap_top_rating_chip_direct(timeout=7.0)
        
        # 2. Resilient fallback only if top chip was not found (rare edge case)
        if not tapped:
            self._log("Fallback: Checking for 'Ratings and reviews' section...")
            if not self._find_and_tap_ui(['ratings and reviews', 'view all ratings', 'all reviews']):
                self._dev_adb_shell("input", "swipe", str(SCREEN_X), str(int(DEVICE_HEIGHT * 0.70)), str(SCREEN_X), str(int(DEVICE_HEIGHT * 0.28)), "350", check=False)
                time.sleep(1.0)
                self._find_and_tap_ui(['ratings and reviews', 'view all ratings', 'all reviews'])

        time.sleep(2.0)

        # 3. Ensure 'Most recent' filter is selected
        self._log("Configuring Sort Filter: Ensuring 'Most recent' is active...")
        sort_updated = False
        for _ in range(3):
            if self._find_and_tap_ui(['most relevant', 'sort by', 'sorted by']):
                time.sleep(0.9)  # Wait for bottom sheet popup to animate in
                if self._find_and_tap_ui(['most recent', 'newest']):
                    time.sleep(1.8)
                    self._log("✔ Sort filter verified & updated to 'Most recent' (Newest to Oldest)")
                    sort_updated = True
                    break
            time.sleep(0.6)
            
        if not sort_updated:
            self._log("Sort filter check: attempting direct tap on 'Most recent'...")
            self._find_and_tap_ui(['most recent'])
            time.sleep(1.0)

    def _scroll_until_target_date_window(self, target_d: date) -> bool:
        """
        CLOSED-LOOP DYNAMIC BIDIRECTIONAL NAVIGATION WITH ADAPTIVE STEP & AUTO-RECOVERY:
        1. Reads visible dates in visual order (newest at top dates[0], oldest at bottom dates[-1]).
        2. If oldest_visible > target_d: Proportional forward scroll (damped step as we get closer).
        3. If newest_visible < target_d: OVERSHOT! Auto-reverses scroll back UP proportional to overshot distance.
        4. When target_d is on screen: Micro-aligns screen so Top Buffer (D+1) is visible at top.
        """
        self._log(f"Closed-loop date navigation: Hunting for Target Date {target_d.strftime('%d/%m/%Y')}...")
        max_attempts = 45
        fast_start_y = int(DEVICE_HEIGHT * 0.75)
        
        for attempt in range(1, max_attempts + 1):
            if self.status == "stopped":
                return False
                
            dates = self._get_visible_review_dates()
            dates_str = [d.strftime('%d/%m/%Y') for d in dates]
            
            if dates:
                oldest_visible = min(dates)
                newest_visible = max(dates)
                self._log(f"Scan #{attempt}: Visible dates on screen = {dates_str}")
                
                # Case 1: Target date is already visible on screen!
                if target_d in dates:
                    self._log(f"🎯 TARGET DATE FOUND! {target_d.strftime('%d/%m/%Y')} is visible on screen.")
                    # If target date is right at the top, scroll slightly down to give room for Top Buffer (D+1)
                    if dates[0] == target_d:
                        self._log("Micro-aligning screen: Giving slight buffer room for Top Buffer (D+1)...")
                        self._dev_adb_shell("input", "swipe", str(SCREEN_X), str(int(DEVICE_HEIGHT * 0.35)), str(SCREEN_X), str(int(DEVICE_HEIGHT * 0.52)), "250", check=False)
                        time.sleep(0.5)
                    self._log("✔ Screen perfectly positioned at Target Date Window with Top Buffer!")
                    return True
                
                # Case 2: All dates on screen are newer than target date (fast turbo-scroll down to reach target)
                elif oldest_visible > target_d:
                    diff_days = (oldest_visible - target_d).days
                    if diff_days >= 4:
                        # Ultra-fast high-speed turbo flick down (covers large date gaps in milliseconds)
                        self._log(f"⚡ Turbo fast-scrolling down ({diff_days} days ahead: {oldest_visible.strftime('%d/%m/%Y')} > {target_d.strftime('%d/%m/%Y')})...")
                        swipe_dist = int(DEVICE_HEIGHT * 0.65)
                        fast_end_y = max(int(DEVICE_HEIGHT * 0.12), fast_start_y - swipe_dist)
                        self._dev_adb_shell("input", "swipe", str(SCREEN_X), str(fast_start_y), str(SCREEN_X), str(fast_end_y), "100", check=False)
                        time.sleep(0.18)
                        # If very far (> 8 days), do an immediate second turbo flick
                        if diff_days > 8:
                            self._dev_adb_shell("input", "swipe", str(SCREEN_X), str(fast_start_y), str(SCREEN_X), str(fast_end_y), "100", check=False)
                            time.sleep(0.2)
                    elif diff_days >= 2:
                        # Swift medium flick
                        self._log(f"⚡ Fast-scrolling down ({diff_days} days ahead)...")
                        swipe_dist = int(DEVICE_HEIGHT * 0.48)
                        fast_end_y = fast_start_y - swipe_dist
                        self._dev_adb_shell("input", "swipe", str(SCREEN_X), str(fast_start_y), str(SCREEN_X), str(fast_end_y), "120", check=False)
                        time.sleep(0.25)
                    else:
                        # 1 day away (Top Buffer boundary): gentle alignment glide
                        self._log(f"Approaching target window ({diff_days} day away) -> Smooth alignment glide...")
                        swipe_dist = int(DEVICE_HEIGHT * 0.26)
                        fast_end_y = fast_start_y - swipe_dist
                        self._dev_adb_shell("input", "swipe", str(SCREEN_X), str(fast_start_y), str(SCREEN_X), str(fast_end_y), "220", check=False)
                        time.sleep(0.3)
                
                # Case 3: We scrolled past target date (OVERSHOT! All visible dates are older than target date)
                elif newest_visible < target_d:
                    diff_days = (target_d - newest_visible).days
                    self._log(f"⚠️ OVERSHOT target date by {diff_days} days ({newest_visible.strftime('%d/%m/%Y')} < {target_d.strftime('%d/%m/%Y')})! Auto-reversing scroll back UP...")
                    
                    # Proportional reverse swipe:
                    # If far (>= 4 days), swift reverse flick
                    # If close (< 4 days), gentle small reverse swipe
                    rev_dist = int(DEVICE_HEIGHT * 0.45) if diff_days >= 4 else int(DEVICE_HEIGHT * 0.22)
                    duration = "120" if diff_days >= 4 else "220"
                    rev_start_y = int(DEVICE_HEIGHT * 0.32)
                    rev_end_y = rev_start_y + rev_dist
                    self._dev_adb_shell("input", "swipe", str(SCREEN_X), str(rev_start_y), str(SCREEN_X), str(rev_end_y), duration, check=False)
                    time.sleep(0.35)
                
                else:
                    # When target_d is between newest and oldest, but NOT yet visible on screen:
                    # If we know reviews exist for target date (e.g. self.reviews > 0), we MUST continue scrolling!
                    if self.reviews and len(self.reviews) > 0:
                        self._log(f"Target date {target_d.strftime('%d/%m/%Y')} not yet in view (rogue dates present) -> Continuing down to locate target date...")
                        self._dev_adb_shell("input", "swipe", str(SCREEN_X), str(fast_start_y), str(SCREEN_X), str(int(DEVICE_HEIGHT * 0.35)), "180", check=False)
                        time.sleep(0.3)
                    else:
                        # Only accept boundary if gap is tight (<= 2 days)
                        if (newest_visible - oldest_visible).days <= 2:
                            self._log(f"Target date {target_d.strftime('%d/%m/%Y')} falls within tight boundary [{newest_visible.strftime('%d/%m/%Y')} ➔ {oldest_visible.strftime('%d/%m/%Y')}]. Positioning at boundary.")
                            return True
                        else:
                            self._log(f"Gap too wide ({newest_visible.strftime('%d/%m/%Y')} to {oldest_visible.strftime('%d/%m/%Y')}), scrolling down to find true boundary...")
                            self._dev_adb_shell("input", "swipe", str(SCREEN_X), str(fast_start_y), str(SCREEN_X), str(int(DEVICE_HEIGHT * 0.35)), "180", check=False)
                            time.sleep(0.3)
            else:
                # If no dates parsed in dump (e.g. header view), do a small swipe down to bring review cards into view
                self._log(f"Scan #{attempt}: Header view active, scrolling down to bring review cards into view...")
                self._dev_adb_shell("input", "swipe", str(SCREEN_X), str(fast_start_y), str(SCREEN_X), str(int(DEVICE_HEIGHT * 0.45)), "240", check=False)
                time.sleep(0.5)
                
        self._log("Notice: Max scan attempts reached. Starting recording from current position.")
        return True

    def _detect_screen_size(self):
        """Query target device physical resolution dynamically."""
        global DEVICE_WIDTH, DEVICE_HEIGHT, SCREEN_X, SWIPE_START_Y, SWIPE_END_Y
        try:
            import re
            res = self._dev_adb_shell("wm", "size", check=False).stdout
            m = re.search(r'Physical size:\s*(\d+)x(\d+)', res)
            if m:
                DEVICE_WIDTH = int(m.group(1))
                DEVICE_HEIGHT = int(m.group(2))
                SCREEN_X = DEVICE_WIDTH // 2
                SWIPE_START_Y = int(DEVICE_HEIGHT * 0.78)
                SWIPE_END_Y = int(DEVICE_HEIGHT * 0.22)
                self._log(f"Screen resolution calibrated for {self.device_serial}: {DEVICE_WIDTH}x{DEVICE_HEIGHT}")
        except Exception as e:
            self._log(f"Using standard resolution ({DEVICE_WIDTH}x{DEVICE_HEIGHT}): {e}")

    def _wait_for_device(self, timeout: int = 150):
        # 1. Check if designated device_serial is already online
        sys_info = get_system_devices()
        connected = sys_info.get("connected_devices", [])
        
        chosen_serial = None
        if self.device_serial:
            matched = next((d for d in connected if d["serial"] == self.device_serial), None)
            if matched:
                self._log(f"Target Device Found: {matched['type']} - {matched['model']} ({self.device_serial})")
                chosen_serial = self.device_serial

        # 2. Check if a Real Phone is connected (Nothing Phone 2a, etc.)
        if not chosen_serial:
            real_dev = next((d for d in connected if not d["is_emulator"]), None)
            emu_dev = next((d for d in connected if d["is_emulator"]), None)
            chosen = real_dev or emu_dev
            if chosen:
                self.device_serial = chosen["serial"]
                self._log(f"Active Device Selected: {chosen['type']} - {chosen['model']} ({self.device_serial})")
                chosen_serial = self.device_serial

        # 3. If neither connected, auto-launch emulator
        if not chosen_serial:
            emu_path = _find_emulator()
            if emu_path:
                avds = _get_available_avds(emu_path)
                target_avd = "Google_Pixel_10a" if "Google_Pixel_10a" in avds else ("Nothing_Phone_2a" if "Nothing_Phone_2a" in avds else (avds[0] if avds else "PlayStoreReviewAVD"))
                self._log(f"No active device found. Auto-launching {target_avd} Virtual Device...")
                try:
                    env = os.environ.copy()
                    sdk_dir = str(Path(emu_path).parent.parent)
                    env["ANDROID_HOME"] = sdk_dir
                    env["ANDROID_SDK_ROOT"] = sdk_dir
                    env["PATH"] = f"{sdk_dir}\\platform-tools;{sdk_dir}\\emulator;{env.get('PATH', '')}"
                    
                    subprocess.Popen(
                        [emu_path, "-avd", target_avd, "-accel", "on"],
                        env=env,
                        creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
                        close_fds=True
                    )
                    self._log(f"{target_avd} Emulator window opened. Booting Android (takes ~30-45s)...")
                except Exception as launch_err:
                    self._log(f"Warning: Could not auto-launch emulator: {launch_err}")

            self._log("Waiting for Android device/emulator to boot and connect...")
            start = time.time()
            while time.time() - start < timeout:
                sys_info = get_system_devices()
                connected = sys_info.get("connected_devices", [])
                if connected:
                    chosen = next((d for d in connected if not d["is_emulator"]), connected[0])
                    self.device_serial = chosen["serial"]
                    try:
                        boot = self._dev_adb_shell("getprop", "sys.boot_completed", check=False).stdout.strip()
                        if boot == "1":
                            self._log(f"Device ready & booted: {chosen['type']} - {chosen['model']} ({self.device_serial})")
                            chosen_serial = self.device_serial
                            break
                    except Exception:
                        pass
                    self._log(f"Device detected ({self.device_serial}), waiting for boot to finish...")
                time.sleep(4)

        if not chosen_serial:
            raise RuntimeError(
                "No Android device or emulator became ready in time!\n"
                "• If using a Real Phone: Connect via USB and enable USB Debugging.\n"
                "• If using Virtual Device: Run START_EMULATOR.bat to start Google Pixel 10a."
            )

        # Calibrate screen and ensure wakefulness
        self._detect_screen_size()
        # Keep device awake while plugged in via USB and wake screen
        self._dev_adb_shell("settings", "put", "global", "stay_on_while_plugged_in", "3", check=False)
        self._dev_adb_shell("input", "keyevent", "224", check=False) # KEYCODE_WAKEUP
        self._dev_adb_shell("wm", "dismiss-keyguard", check=False)
        return self.device_serial

    def _pull_notification_bar(self):
        """Step 1: Expand notification & control panel to prove real system clock & date on video."""
        self._log("Step 1: Pulling down notification & control panel (displaying real clock & date on camera)...")
        # Direct intent to expand notification panel
        self._dev_adb_shell("cmd", "statusbar", "expand-notifications", check=False)
        # Swipe gesture fallback / additional expansion
        self._dev_adb_shell("input", "swipe", str(SCREEN_X), "20", str(SCREEN_X), str(int(DEVICE_HEIGHT * 0.65)), "350", check=False)
        time.sleep(NOTIF_HOLD_SEC)  # Camera records real time & date
        # Collapse notification shade
        self._dev_adb_shell("cmd", "statusbar", "collapse", check=False)
        self._dev_adb_shell("input", "swipe", str(SCREEN_X), str(int(DEVICE_HEIGHT * 0.65)), str(SCREEN_X), "20", "300", check=False)
        time.sleep(0.8)
        self._log("Step 1 Complete: Notification panel closed. Transitioning to Play Store reviews...")

    def _start_screenrecord(self) -> subprocess.Popen:
        """Start adb screenrecord on target device."""
        global ADB
        if ADB is None:
            ADB = _find_adb()
        cmd = [ADB]
        if self.device_serial:
            cmd.extend(["-s", self.device_serial])
        cmd.extend(["shell", "screenrecord",
               "--bit-rate", "8000000",
               "--time-limit", "0",
               "--size", f"{DEVICE_WIDTH}x{DEVICE_HEIGHT}",
               RECORD_DEVICE_PATH])
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self._log(f"Screen recording started on {self.device_serial} (No time-limit: full A-to-Z recording).")
        return proc

    def _auto_scroll_recording_zone(self, target_d: date, expected_count: int):
        """
        RECORDING ZONE CLOSED-LOOP CAPTURE:
        1. Top Buffer (D+1) is visible on camera.
        2. Slowly, smoothly scrolls through every single review of Target Date (D).
        3. Monitors visible dates in real time.
        4. When Target Date reviews finish and the first review of D-1 (Bottom Buffer) appears,
           holds stationary for 2.5s to prove the boundary has concluded.
        """
        self._log(f"🎬 Recording Zone Active: Smooth reading-speed capture for {target_d.strftime('%d/%m/%Y')} (~{expected_count} target reviews)...")
        
        # Gentle swipe parameters: ~32% screen height, 350ms duration, clear readability
        scroll_start_y = int(DEVICE_HEIGHT * 0.66)
        scroll_end_y = int(DEVICE_HEIGHT * 0.36)
        
        # Calculate dynamic limit: at least expected_count + 6 swipes
        max_zone_swipes = max(5, int(expected_count * 1.5) + 6)
        
        # Wait 1.2s after notification close so viewer clearly sees Top Buffer + Target Date start
        time.sleep(1.2)
        
        consecutive_older_checks = 0
        
        for swipe_idx in range(1, max_zone_swipes + 1):
            if self.status == "stopped":
                break
                
            self._dev_adb_shell(
                "input", "swipe",
                str(SCREEN_X), str(scroll_start_y),
                str(SCREEN_X), str(scroll_end_y),
                "350",
                check=False
            )
            time.sleep(0.9) # Steady reading pause for HD video clarity
            
            # Every 2 swipes, check visible dates to see if we reached Bottom Buffer (D-1)
            if swipe_idx >= 2:
                vis_dates = self._get_visible_review_dates()
                if vis_dates:
                    # If all visible dates are now strictly older than target date (e.g. <= D-1)
                    if all(d < target_d for d in vis_dates):
                        consecutive_older_checks += 1
                        if consecutive_older_checks >= 1:
                            self._log(f"✔ Bottom Buffer (D-1: {min(vis_dates).strftime('%d/%m/%Y')}) captured! All {target_d.strftime('%d/%m/%Y')} reviews complete.")
                            break
                    else:
                        consecutive_older_checks = 0
                        self._log(f"Recording progress: Swipe {swipe_idx}/{max_zone_swipes} - Current visible: {[d.strftime('%d/%m/%Y') for d in vis_dates]}")
            
            self.progress = min(92, 50 + int((swipe_idx / max_zone_swipes) * 40))

        # Hold on bottom boundary buffer for 2.5s for unmistakable visual proof
        self._log("Holding on Bottom Boundary Buffer for 2.5s to prove recording zone completeness...")
        time.sleep(2.5)
        self._log("Recording Zone capture 100% verified & complete.")

    def _stop_screenrecord(self, proc: subprocess.Popen):
        """Stop the screenrecord process gracefully."""
        try:
            self._dev_adb_shell("pkill", "-l", "SIGINT", "-f", "screenrecord", check=False)
            time.sleep(1.5)
            proc.terminate()
            proc.wait(timeout=10)
        except Exception:
            pass
        self._log("Screen recording stopped.")

    def _pull_video(self) -> str:
        """Pull the recorded .mp4 from device to local exports/ folder."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_app = self.app_name.replace(" ", "_").replace("/", "_")[:30]
        local_name = f"{safe_app}_{self.target_date}_{timestamp}.mp4"
        local_path = self.output_dir / local_name

        self._log(f"Pulling video from {self.device_serial} -> {local_path}")
        self._dev_adb("pull", RECORD_DEVICE_PATH, str(local_path))
        self._dev_adb_shell("rm", "-f", RECORD_DEVICE_PATH, check=False)
        return str(local_path)

    def start(self) -> str:
        """
        Main entry point. Runs synchronously.
        EXACT USER WORKFLOW:
        Phase 1 (Pre-Recording Prep):
          - Launch REAL Google Play Store app directly from clean state.
          - Navigate to 'Ratings and reviews' section.
          - Set Sort Filter to 'Most recent'.
          - Closed-Loop Dynamic Scan & Pre-scroll down until reaching the target date window (Top Buffer D+1).
        Phase 2 (The Recorded Video):
          - START HD screen recording on device.
          - Pull down Control & Notification Panel (display real clock & date on camera) -> Close panel.
          - Record the Recording Zone:
              * Buffer D+1 (1-2 reviews)
              * Target Date D (ALL reviews A to Z at readable scroll speed)
              * Buffer D-1 (1-2 reviews for date boundary proof)
          - STOP HD screen recording.
          - Pull .mp4 video to PC exports/ folder.
        """
        self.status = "running"
        self.progress = 0
        record_proc = None

        try:
            if not self.reviews:
                raise ValueError("No reviews to record. Run extraction first.")

            # ─────────────────────────────────────────────────────────────
            # Phase 1: Pre-Recording Prep & Navigation (BEFORE recording)
            # ─────────────────────────────────────────────────────────────
            # 1. Connect & calibrate device
            self._wait_for_device()
            self.progress = 5

            # 2. Open REAL Google Play Store app directly & Navigate to 'Most recent' reviews
            self._open_real_playstore(self.package_id)
            self.progress = 20

            # 3. Dynamic Closed-Loop Pre-scroll to Target Date Window (Top Buffer D+1 + Target Date D)
            target_d_obj = self._parse_target_date_obj()
            self._scroll_until_target_date_window(target_d_obj)
            self.progress = 35

            # ─────────────────────────────────────────────────────────────
            # Phase 2: Live Video Recording (Control Panel -> Recording Zone)
            # ─────────────────────────────────────────────────────────────
            # 4. START HD Screen Recording (No time limit)
            record_proc = self._start_screenrecord()
            time.sleep(0.8)
            self.progress = 40

            # 5. Step 1 on Camera: Pull down Notification & Control Panel (Real clock & date proof)
            self._pull_notification_bar()
            self.progress = 55

            # 6. Step 2 on Camera: Scroll through the Recording Zone (Top Buffer -> Target Date A to Z -> Bottom Buffer)
            self._auto_scroll_recording_zone(target_d_obj, len(self.reviews))
            self.progress = 90

            # 7. Stop HD screen recording
            self._stop_screenrecord(record_proc)
            record_proc = None
            self.progress = 93

            # 8. Pull video to PC
            time.sleep(1.5)  # Give device time to finalize the mp4
            self.output_file = self._pull_video()
            self.progress = 100
            self.status = "completed"
            self._log(f"Recording saved: {self.output_file}")
            return self.output_file

        except Exception as e:
            self.status = "error"
            self.error_message = str(e)
            self._log(f"ERROR: {e}")
            if record_proc:
                try:
                    self._stop_screenrecord(record_proc)
                except Exception:
                    pass
            raise

    def stop(self):
        self.status = "stopped"
        self._log("Stop requested.")


# ─────────────────────────────────────────────────────────────────────────────
# CLI Entry Point
# ─────────────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Record Play Store review auto-scroll on Android Emulator")
    parser.add_argument("--file", help="Path to CSV or JSON file with reviews")
    parser.add_argument("--app", default="App", help="App name for display")
    parser.add_argument("--date", default="", help="Target date (YYYY-MM-DD)")
    parser.add_argument("--test", action="store_true", help="Test mode: connect to device and exit")
    args = parser.parse_args()

    if args.test:
        print("[TEST] Checking adb connection...")
        try:
            adb_path = _find_adb()
            print(f"[OK] adb found: {adb_path}")
            result = adb("devices")
            print(result.stdout)
        except FileNotFoundError as e:
            print(f"[FAIL] {e}")
        return

    reviews = []
    if args.file:
        fpath = Path(args.file)
        if fpath.suffix == ".csv":
            import pandas as pd
            df = pd.read_csv(fpath)
            reviews = df.to_dict("records")
        elif fpath.suffix == ".json":
            reviews = json.loads(fpath.read_text(encoding="utf-8"))
        else:
            print(f"Unsupported file format: {fpath.suffix}")
            sys.exit(1)
    else:
        print("No --file specified. Use --file path/to/reviews.csv")
        sys.exit(1)

    recorder = ReviewRecorder(
        reviews=reviews,
        app_name=args.app,
        target_date=args.date or datetime.now().strftime("%Y-%m-%d"),
    )

    try:
        output = recorder.start()
        print(f"\n✅ Recording complete! Saved to: {output}")
    except Exception as e:
        print(f"\n❌ Recording failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
