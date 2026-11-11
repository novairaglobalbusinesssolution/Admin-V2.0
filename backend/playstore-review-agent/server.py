import socket
import os
import sys
import time
import uuid
import threading
from datetime import datetime

# Force UTF-8 encoding for Windows stdout/stderr to prevent charmap UnicodeEncodeError
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Ensure IPv4 is used on Windows to prevent IPv6 connection stalls
_orig_getaddrinfo = socket.getaddrinfo
def _ipv4_getaddrinfo(*args, **kwargs):
    responses = _orig_getaddrinfo(*args, **kwargs)
    ipv4 = [r for r in responses if r[0] == socket.AF_INET]
    return ipv4 if ipv4 else responses
socket.getaddrinfo = _ipv4_getaddrinfo
socket.setdefaulttimeout(15)

from flask import Flask, render_template, request, jsonify, send_file, Response
from review_engine import ReviewExtractionJob, INDIAN_LANGUAGES
from app_info import get_app_details
import pandas as pd

import subprocess
from werkzeug.utils import secure_filename

try:
    from review_recorder import ReviewRecorder, get_system_devices, launch_avd, adb, adb_shell
    RECORDER_AVAILABLE = True
except ImportError:
    RECORDER_AVAILABLE = False

app = Flask(__name__, template_folder='templates', static_folder='static')
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# In-memory job repository
JOBS = {}
JOBS_LOCK = threading.Lock()

# In-memory recording sessions
RECORDING_SESSIONS = {}
RECORDING_LOCK = threading.Lock()

# Directory for storing exports
EXPORT_DIR = os.path.join(os.path.dirname(__file__), "exports")
os.makedirs(EXPORT_DIR, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/app-info', methods=['GET'])
def api_app_info():
    package_id = request.args.get('package_id', '').strip()
    country = request.args.get('country', 'in').strip()
    if not package_id:
        return jsonify({"success": False, "error": "package_id query parameter is required"}), 400
    
    info = get_app_details(package_id, country=country)
    return jsonify(info)

@app.route('/api/extract/start', methods=['POST'])
def api_start_extract():
    data = request.json or {}
    package_id = data.get('package_id', '').strip()
    start_date = data.get('start_date', '').strip()
    end_date = data.get('end_date', '').strip()
    country = data.get('country', 'in').strip()
    max_reviews_raw = data.get('max_reviews')
    max_reviews = int(max_reviews_raw) if max_reviews_raw and str(max_reviews_raw).isdigit() else 1000000
    languages = data.get('languages', INDIAN_LANGUAGES)

    if not package_id:
        return jsonify({"success": False, "error": "package_id is required"}), 400

    job_id = f"job_{uuid.uuid4().hex[:8]}"

    job = ReviewExtractionJob(
        job_id=job_id,
        package_id=package_id,
        start_date=start_date,
        end_date=end_date,
        country=country,
        languages=languages,
        max_reviews=max_reviews
    )

    with JOBS_LOCK:
        JOBS[job_id] = job

    # Start background extraction thread
    thread = threading.Thread(target=job.run, daemon=True)
    thread.start()

    return jsonify({
        "success": True,
        "job_id": job_id,
        "message": f"Extraction job '{job_id}' started for {package_id}."
    })

@app.route('/api/extract/status/<job_id>', methods=['GET'])
def api_extract_status(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)

    if not job:
        return jsonify({"success": False, "error": "Job not found"}), 404

    elapsed = (time.time() - job.start_time) if job.start_time else 0
    speed = round(len(job.reviews_list) / elapsed, 1) if elapsed > 0 else 0

    return jsonify({
        "success": True,
        "job_id": job.job_id,
        "package_id": job.package_id,
        "status": job.status,
        "scraped_total": job.scraped_total,
        "unique_reviews": len(job.reviews_list),
        "duplicates": job.duplicates_total,
        "max_reviews": job.max_reviews,
        "speed_per_sec": speed,
        "elapsed_seconds": round(elapsed, 1),
        "error_message": job.error_message,
        "logs": job.logs[-20:]
    })

@app.route('/api/extract/stop/<job_id>', methods=['POST'])
def api_stop_extract(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job:
        return jsonify({"success": False, "error": "Job not found"}), 404

    job.stop()
    return jsonify({"success": True, "message": f"Stop signal sent to job {job_id}."})

@app.route('/api/extract/results/<job_id>', methods=['GET'])
def api_extract_results(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job:
        return jsonify({"success": False, "error": "Job not found"}), 404

    # Pagination and filtering
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 50))
    search = request.args.get('search', '').lower().strip()
    rating_filter = request.args.get('rating', '')
    sentiment_filter = request.args.get('sentiment', '')

    all_reviews = job.reviews_list

    # Filter by search term
    if search:
        all_reviews = [r for r in all_reviews if search in (r.get('content') or '').lower() or search in (r.get('userName') or '').lower()]

    # Filter by star rating
    if rating_filter and rating_filter.isdigit():
        r_num = int(rating_filter)
        all_reviews = [r for r in all_reviews if r.get('rating') == r_num]

    # Filter by sentiment (derived from rating since we keep it in memory)
    if sentiment_filter:
        def get_sentiment(r):
            score = r.get('rating', 0)
            if score >= 4: return 'Positive'
            if score == 3: return 'Neutral'
            return 'Negative'
        all_reviews = [r for r in all_reviews if get_sentiment(r).lower() == sentiment_filter.lower()]

    total_filtered = len(all_reviews)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    page_items = all_reviews[start_idx:end_idx]

    # Compute Analytics breakdown for current job
    analytics = {}
    if job.reviews_list:
        try:
            df_full = pd.DataFrame(job.reviews_list)
            ratings_dist = df_full['rating'].value_counts().to_dict() if 'rating' in df_full.columns else {}
            # Derive sentiments from rating
            def rate_to_sent(x):
                if x >= 4: return 'Positive'
                if x == 3: return 'Neutral'
                return 'Negative'
            sent_dist = df_full['rating'].apply(rate_to_sent).value_counts().to_dict() if 'rating' in df_full.columns else {}
            date_counts = df_full['date'].value_counts().sort_index().to_dict() if 'date' in df_full.columns else {}
            avg_rating = round(float(df_full['rating'].mean()), 2) if 'rating' in df_full.columns and not df_full.empty else 0
            analytics = {
                "ratings": {str(k): int(v) for k, v in ratings_dist.items()},
                "sentiments": {str(k): int(v) for k, v in sent_dist.items()},
                "dates": date_counts,
                "avg_rating": avg_rating
            }
        except Exception as ae:
            analytics = {"error": str(ae)}

    return jsonify({
        "success": True,
        "job_id": job.job_id,
        "status": job.status,
        "total_unique": len(job.reviews_list),
        "total_filtered": total_filtered,
        "page": page,
        "limit": limit,
        "total_pages": (total_filtered + limit - 1) // limit if limit > 0 else 1,
        "reviews": page_items,
        "analytics": analytics
    })

@app.route('/api/extract/export/<job_id>/<fmt>', methods=['GET'])
def api_export_reviews(job_id, fmt):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job:
        return jsonify({"success": False, "error": "Job not found"}), 404

    if not job.reviews_list:
        return jsonify({"success": False, "error": "No reviews available to export"}), 400

    fmt = fmt.lower()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_name = f"{job.package_id}_reviews_{timestamp}.{fmt}"
    file_path = os.path.join(EXPORT_DIR, file_name)

    if fmt == 'csv':
        job.export_csv(file_path)
        mimetype = 'text/csv'
    elif fmt == 'json':
        job.export_json(file_path)
        mimetype = 'application/json'
    elif fmt == 'xlsx':
        job.export_excel(file_path)
        mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    else:
        return jsonify({"success": False, "error": "Unsupported export format"}), 400

    return send_file(file_path, as_attachment=True, download_name=file_name, mimetype=mimetype)


# ─────────────────────────────────────────────────────────────────────────────
# Android Recorder API
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/api/record/start', methods=['POST'])
def api_record_start():
    if not RECORDER_AVAILABLE:
        return jsonify({"success": False, "error": "review_recorder.py not found"}), 500

    data = request.json or {}
    job_id = data.get('job_id', '').strip()

    with JOBS_LOCK:
        job = JOBS.get(job_id)

    if not job:
        return jsonify({"success": False, "error": "Extraction job not found"}), 404

    if not job.reviews_list:
        return jsonify({"success": False, "error": "No reviews available to record"}), 400

    rec_id = f"rec_{uuid.uuid4().hex[:8]}"
    target_date = data.get('target_date') or (job.start_date.strftime('%Y-%m-%d') if hasattr(job, 'start_date') and job.start_date else '')
    app_name = data.get('app_name', job.package_id)

    recorder = ReviewRecorder(
        reviews=job.reviews_list,
        app_name=app_name,
        package_id=job.package_id,
        target_date=target_date,
        buffer_next=getattr(job, 'buffer_next_list', []),
        buffer_prev=getattr(job, 'buffer_prev_list', []),
        newer_reviews=getattr(job, 'newer_samples', []),
        device_serial=data.get('device_serial', ''),
        output_dir=EXPORT_DIR,
    )

    with RECORDING_LOCK:
        RECORDING_SESSIONS[rec_id] = recorder

    def _run():
        try:
            recorder.start()
        except Exception:
            pass

    threading.Thread(target=_run, daemon=True).start()

    return jsonify({"success": True, "rec_id": rec_id,
                    "message": f"Recording started. {len(job.reviews_list):,} reviews to scroll through."})


@app.route('/api/record/status/<rec_id>', methods=['GET'])
def api_record_status(rec_id):
    with RECORDING_LOCK:
        recorder = RECORDING_SESSIONS.get(rec_id)
    if not recorder:
        return jsonify({"success": False, "error": "Recording session not found"}), 404

    return jsonify({
        "success": True,
        "rec_id": rec_id,
        "status": recorder.status,
        "progress": recorder.progress,
        "output_file": os.path.basename(recorder.output_file) if recorder.output_file else "",
        "error": recorder.error_message,
        "logs": recorder.logs[-15:]
    })


@app.route('/api/record/download/<rec_id>', methods=['GET'])
def api_record_download(rec_id):
    with RECORDING_LOCK:
        recorder = RECORDING_SESSIONS.get(rec_id)
    if not recorder or not recorder.output_file:
        return jsonify({"success": False, "error": "Recording not ready"}), 404
    if not os.path.exists(recorder.output_file):
        return jsonify({"success": False, "error": "Video file not found on disk"}), 404

    filename = os.path.basename(recorder.output_file)
    return send_file(recorder.output_file, as_attachment=True, download_name=filename, mimetype='video/mp4')


@app.route('/api/record/stop/<rec_id>', methods=['POST'])
def api_record_stop(rec_id):
    with RECORDING_LOCK:
        recorder = RECORDING_SESSIONS.get(rec_id)
    if not recorder:
        return jsonify({"success": False, "error": "Recording session not found"}), 404
    recorder.stop()
    return jsonify({"success": True, "message": "Stop signal sent."})


@app.route('/api/devices', methods=['GET'])
def api_devices():
    if not RECORDER_AVAILABLE:
        return jsonify({"success": False, "error": "review_recorder not available"}), 500
    info = get_system_devices()
    return jsonify({"success": True, **info})


@app.route('/api/devices/launch-emulator', methods=['POST'])
def api_launch_emulator():
    if not RECORDER_AVAILABLE:
        return jsonify({"success": False, "error": "review_recorder not available"}), 500
    data = request.json or {}
    avd_name = data.get('avd_name', 'Google_Pixel_10a')
    ok = launch_avd(avd_name)
    if ok:
        return jsonify({"success": True, "message": f"Virtual Device '{avd_name}' is launching..."})
    else:
        return jsonify({"success": False, "error": f"Failed to launch emulator for '{avd_name}'"}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Live Interactive Device Screen Capture & Workflow Recording
# ─────────────────────────────────────────────────────────────────────────────
LIVE_DEVICE_SESSION = {
    "active": False,
    "proc": None,
    "device_id": None,
    "start_time": 0,
    "remote_path": "/sdcard/interactive_live_record.mp4"
}
LIVE_DEVICE_LOCK = threading.Lock()

@app.route('/api/device/live-record/start', methods=['POST'])
def api_device_live_record_start():
    if not RECORDER_AVAILABLE:
        return jsonify({"success": False, "error": "Recorder not available"}), 500
    
    data = request.json or {}
    package_id = data.get('package_id', '').strip()
    
    info = get_system_devices()
    devs = info.get("connected_devices", [])
    if not devs:
        return jsonify({"success": False, "error": "No Android device or emulator connected. Please launch Pixel 10a or connect phone via USB."}), 400
    
    device_id = devs[0]["serial"]
    
    with LIVE_DEVICE_LOCK:
        if LIVE_DEVICE_SESSION["active"]:
            return jsonify({"success": True, "message": "Live recording already in progress.", "device_id": LIVE_DEVICE_SESSION["device_id"]})
        
        # If user specified an app (e.g. Novaira or package), launch it
        if package_id:
            try:
                adb("-s", device_id, "shell", "monkey", "-p", package_id, "-c", "android.intent.category.LAUNCHER", "1", check=False)
            except Exception:
                try:
                    adb("-s", device_id, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", f"market://details?id={package_id}", check=False)
                except Exception:
                    pass
        
        # Start adb screenrecord
        from review_recorder import _find_adb
        adb_bin = _find_adb()
        remote_path = f"/sdcard/live_rec_{int(time.time())}.mp4"
        cmd = [adb_bin, "-s", device_id, "shell", "screenrecord", "--bit-rate", "8000000", "--time-limit", "0", remote_path]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        LIVE_DEVICE_SESSION["active"] = True
        LIVE_DEVICE_SESSION["proc"] = proc
        LIVE_DEVICE_SESSION["device_id"] = device_id
        LIVE_DEVICE_SESSION["remote_path"] = remote_path
        LIVE_DEVICE_SESSION["start_time"] = time.time()
        
    return jsonify({
        "success": True,
        "message": f"Live screen recording started on {devs[0]['type']}: {devs[0]['model']}.",
        "device": devs[0]
    })


@app.route('/api/device/live-record/stop', methods=['POST'])
def api_device_live_record_stop():
    with LIVE_DEVICE_LOCK:
        if not LIVE_DEVICE_SESSION["active"]:
            return jsonify({"success": False, "error": "No live recording in progress"}), 400
        
        device_id = LIVE_DEVICE_SESSION["device_id"]
        remote_path = LIVE_DEVICE_SESSION["remote_path"]
        proc = LIVE_DEVICE_SESSION["proc"]
        
        try:
            adb("-s", device_id, "shell", "pkill", "-l", "SIGINT", "-f", "screenrecord", check=False)
            time.sleep(1.2)
            if proc:
                proc.terminate()
                proc.wait(timeout=5)
        except Exception:
            pass
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"live_device_interaction_{timestamp}.mp4"
        local_path = os.path.join(EXPORT_DIR, filename)
        
        try:
            adb("-s", device_id, "pull", remote_path, local_path, check=False)
            adb("-s", device_id, "shell", "rm", "-f", remote_path, check=False)
        except Exception as e:
            print(f"[ERROR] Pulling video: {e}")
        
        LIVE_DEVICE_SESSION["active"] = False
        LIVE_DEVICE_SESSION["proc"] = None
        
    if not os.path.exists(local_path):
        return jsonify({"success": False, "error": "Video file not found on disk"}), 500
        
    return jsonify({
        "success": True,
        "filename": filename,
        "download_url": f"/api/exports/file/{filename}",
        "message": "Screen recording captured successfully!"
    })


@app.route('/api/device/screencap', methods=['POST'])
def api_device_screencap():
    if not RECORDER_AVAILABLE:
        return jsonify({"success": False, "error": "Recorder not available"}), 500
    
    info = get_system_devices()
    devs = info.get("connected_devices", [])
    if not devs:
        return jsonify({"success": False, "error": "No connected device or emulator found"}), 400
    
    device_id = devs[0]["serial"]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"screencap_{timestamp}.png"
    local_path = os.path.join(EXPORT_DIR, filename)
    remote_path = f"/sdcard/cap_{timestamp}.png"
    
    try:
        adb("-s", device_id, "shell", "screencap", "-p", remote_path, check=False)
        adb("-s", device_id, "pull", remote_path, local_path, check=False)
        adb("-s", device_id, "shell", "rm", "-f", remote_path, check=False)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
        
    return jsonify({
        "success": True,
        "filename": filename,
        "url": f"/api/exports/file/{filename}",
        "device": devs[0]
    })


@app.route('/api/device/launch-app', methods=['POST'])
def api_device_launch_app():
    if not RECORDER_AVAILABLE:
        return jsonify({"success": False, "error": "Recorder not available"}), 500
    
    data = request.json or {}
    package_id = data.get('package_id', '').strip()
    if not package_id:
        return jsonify({"success": False, "error": "package_id is required"}), 400
        
    info = get_system_devices()
    devs = info.get("connected_devices", [])
    if not devs:
        return jsonify({"success": False, "error": "No connected device found"}), 400
        
    device_id = devs[0]["serial"]
    
    try:
        adb("-s", device_id, "shell", "monkey", "-p", package_id, "-c", "android.intent.category.LAUNCHER", "1", check=False)
        return jsonify({"success": True, "message": f"App '{package_id}' launched on {devs[0]['model']}"})
    except Exception:
        try:
            adb("-s", device_id, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", f"market://details?id={package_id}", check=False)
            return jsonify({"success": True, "message": f"Play Store page for '{package_id}' opened on {devs[0]['model']}"})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/exports/file/<filename>', methods=['GET'])
def api_serve_export_file(filename):
    file_path = os.path.join(EXPORT_DIR, secure_filename(filename))
    if not os.path.exists(file_path):
        return jsonify({"success": False, "error": "File not found"}), 404
    return send_file(file_path, as_attachment=False)


# Auto-start emulator in background on server launch if no device is active
def _auto_start_emulator_on_launch():
    time.sleep(2)
    try:
        if RECORDER_AVAILABLE:
            info = get_system_devices()
            if not info.get("connected_devices"):
                print("[AUTO-START] No active Android device detected. Auto-launching Google Pixel 10a Virtual Device...")
                launch_avd("Google_Pixel_10a")
            else:
                dev = info["connected_devices"][0]
                print(f"[AUTO-START] Android device already active: {dev['type']} - {dev['model']} ({dev['serial']})")
    except Exception as e:
        print(f"[AUTO-START] Emulator check warning: {e}")

threading.Thread(target=_auto_start_emulator_on_launch, daemon=True).start()




if __name__ == '__main__':
    print("================================================================================")
    print(" Starting Play Store Review Extractor Web Agent Server on http://127.0.0.1:5000")
    print("================================================================================")
    app.run(host='0.0.0.0', port=5000, debug=False)

