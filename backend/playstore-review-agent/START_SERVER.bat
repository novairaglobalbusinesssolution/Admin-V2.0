@echo off
title PlayStore Review Extractor - Server & Virtual Device
color 0A

echo.
echo ================================================================================
echo   Play Store Review Extractor Agent  ^|  India Cloud Server  ^|  Port 5000
echo ================================================================================
echo.

:: Go to the correct directory
cd /d "%~dp0"

:: Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH!
    echo         Please install Python 3.8+ from https://python.org
    pause
    exit /b 1
)

:: Auto-install missing packages silently
echo [INFO] Checking required Python packages...
python -m pip install flask google-play-scraper pandas openpyxl --quiet --disable-pip-version-check

:: Check and auto-launch Google Pixel 10a Emulator if not already active
set "ANDROID_SDK=%LOCALAPPDATA%\Android\Sdk"
set "EMULATOR=%ANDROID_SDK%\emulator\emulator.exe"
set "ADB=%ANDROID_SDK%\platform-tools\adb.exe"

if exist "%ADB%" (
    echo [INFO] Checking for active Android devices or emulators...
    "%ADB%" devices | findstr /R "device$ emulator" >nul 2>&1
    if errorlevel 1 (
        if exist "%EMULATOR%" (
            echo [INFO] No active Android device detected.
            echo [INFO] Auto-launching Google Pixel 10a Virtual Device in background...
            start "" "%EMULATOR%" -avd "Google_Pixel_10a" -accel on
            echo [OK] Google Pixel 10a Virtual Device is booting up!
        )
    ) else (
        echo [OK] Android device or emulator already running!
    )
)

echo.
echo [INFO] Starting server on http://127.0.0.1:5000
echo [INFO] Open your browser and visit: http://127.0.0.1:5000
echo [INFO] Press CTRL+C to stop the server.
echo.

:: Kill any existing server on port 5000 first (avoids "port already in use")
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Launch server
python server.py

echo.
echo [INFO] Server stopped.
pause
