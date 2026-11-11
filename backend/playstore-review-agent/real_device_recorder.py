import os
import sys
import time
import subprocess
import argparse

def run_cmd(cmd, check=True):
    print(f"[CMD] {cmd}")
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and res.returncode != 0:
        print(f"[ERROR] Command failed: {res.stderr}")
    return res.stdout.strip()

def check_adb():
    """Check if ADB is available and list connected devices."""
    res = run_cmd("adb devices", check=False)
    if "List of devices" not in res:
        print("\n[!] ADB (Android Debug Bridge) is not installed or not in PATH.")
        print("    Please install Android Platform Tools or Android Studio.")
        return None
    
    lines = [line for line in res.splitlines() if line.strip() and "List of devices" not in line]
    devices = [line.split()[0] for line in lines if "device" in line]
    return devices

def record_real_android_device(package_id: str, duration_sec: int = 60, output_mp4: str = "android_screen_record.mp4"):
    print("================================================================================")
    print("      REAL ANDROID DEVICE LIVE PLAY STORE SCREEN RECORDER")
    print("================================================================================")
    
    devices = check_adb()
    if not devices:
        print("\n[!] No connected Android devices or emulators found.")
        print("\nSteps to connect your real Android phone:")
        print("  1. Enable 'Developer Options' on your Android phone (Settings -> About -> Tap Build Number 7 times).")
        print("  2. Enable 'USB Debugging' in Developer Options.")
        print("  3. Connect phone to PC via USB cable and allow 'Trust this computer'.")
        print("  4. Re-run this script!")
        return False

    device_id = devices[0]
    print(f"[✓] Connected Android Device Found: {device_id}")
    print(f"[+] Opening Play Store app page for: {package_id}")

    # Launch Play Store directly to app details page
    playstore_uri = f"market://details?id={package_id}"
    run_cmd(f"adb -s {device_id} shell am start -a android.intent.action.VIEW -d \"{playstore_uri}\"")
    time.sleep(3)

    # Start screen recording on Android device in background
    remote_video_path = f"/sdcard/playstore_record_{int(time.time())}.mp4"
    print(f"[+] Starting high-definition video recording on device: {remote_video_path}")
    
    # Launch screenrecord command on android
    rec_proc = subprocess.Popen(
        f"adb -s {device_id} shell screenrecord --time-limit {duration_sec} {remote_video_path}",
        shell=True
    )

    print(f"[+] Auto-scrolling reviews on real device screen for {duration_sec} seconds...")
    start_time = time.time()

    # Auto-scroll loop simulating touch swipe gesture on real screen
    try:
        while time.time() - start_time < duration_sec:
            # Swipe up (scroll down) from Y=1400 to Y=500
            run_cmd(f"adb -s {device_id} shell input swipe 500 1400 500 500 400", check=False)
            time.sleep(2.0)
    except KeyboardInterrupt:
        print("\n[!] Recording interrupted by user.")

    # Stop recording process if still active
    rec_proc.terminate()
    time.sleep(2)

    # Pull recorded video file to PC
    print(f"[+] Transferring recorded video from Android device to PC...")
    run_cmd(f"adb -s {device_id} pull {remote_video_path} \"{output_mp4}\"")
    
    # Clean up device storage
    run_cmd(f"adb -s {device_id} shell rm {remote_video_path}", check=False)

    abs_output = os.path.abspath(output_mp4)
    print("\n================================================================================")
    print(f"[✓] SUCCESS! Real Android device video saved to:\n    {abs_output}")
    print("================================================================================")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Record real Android device Play Store live reviews screen.")
    parser.add_argument("-p", "--package", type=str, default="com.whatsapp", help="Play Store App Package ID")
    parser.add_argument("-d", "--duration", type=int, default=60, help="Recording duration in seconds (default: 60)")
    parser.add_argument("-o", "--output", type=str, default="real_android_reviews.mp4", help="Output MP4 file path")

    args = parser.parse_args()
    record_real_android_device(args.package, args.duration, args.output)
