@echo off
setlocal EnableDelayedExpansion
title Android Emulator Setup for PlayStore Review Recorder
color 0B

echo.
echo ================================================================================
echo   Android Emulator One-Time Setup
echo   This will download Android SDK tools and create a Pixel 6 emulator
echo   Estimated time: 10-20 minutes (downloads ~600 MB)
echo ================================================================================
echo.

set "ANDROID_SDK=%USERPROFILE%\android-sdk"
set "CMDLINE_TOOLS=%ANDROID_SDK%\cmdline-tools\latest"
set "ADB=%ANDROID_SDK%\platform-tools\adb.exe"
set "EMULATOR=%ANDROID_SDK%\emulator\emulator.exe"
set "AVD_NAME=PlayStoreReviewAVD"

:: Check if already setup
if exist "%ADB%" (
    echo [OK] Android SDK already installed at %ANDROID_SDK%
    if exist "%EMULATOR%" (
        echo [OK] Emulator already installed.
        goto :check_avd
    )
)

echo [STEP 1] Downloading Android Command-Line Tools...
echo.

:: Create SDK directory
if not exist "%ANDROID_SDK%" mkdir "%ANDROID_SDK%"
if not exist "%ANDROID_SDK%\cmdline-tools" mkdir "%ANDROID_SDK%\cmdline-tools"

:: Download cmdline-tools using PowerShell
powershell -Command ^
  "Write-Host '[INFO] Downloading Android SDK tools (~150 MB)...'; ^
   $url = 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip'; ^
   $out = '%ANDROID_SDK%\cmdline-tools.zip'; ^
   $wc = New-Object System.Net.WebClient; ^
   $wc.DownloadFile($url, $out); ^
   Write-Host '[INFO] Extracting...'; ^
   Expand-Archive -Path $out -DestinationPath '%ANDROID_SDK%\cmdline-tools\' -Force; ^
   if (Test-Path '%ANDROID_SDK%\cmdline-tools\cmdline-tools') { ^
     Rename-Item '%ANDROID_SDK%\cmdline-tools\cmdline-tools' 'latest' -Force ^
   }; ^
   Remove-Item $out -Force; ^
   Write-Host '[OK] Android SDK tools downloaded and extracted.'"

if not exist "%CMDLINE_TOOLS%\bin\sdkmanager.bat" (
    echo [ERROR] Failed to download or extract Android SDK tools.
    echo         Please check your internet connection and try again.
    pause
    exit /b 1
)

echo.
echo [STEP 2] Installing Android Platform Tools (adb) and Emulator...
echo          (You will be prompted to accept licenses - type 'y' and press Enter for each)
echo.

echo y | "%CMDLINE_TOOLS%\bin\sdkmanager.bat" --sdk_root="%ANDROID_SDK%" "platform-tools" "emulator" "system-images;android-33;google_apis;x86_64" "platforms;android-33"

if not exist "%ADB%" (
    echo [ERROR] Failed to install platform-tools.
    pause
    exit /b 1
)

echo.
echo [OK] Platform tools installed!

:check_avd
echo.
echo [STEP 3] Checking for existing Android Virtual Device...

"%CMDLINE_TOOLS%\bin\avdmanager.bat" --sdk_root="%ANDROID_SDK%" list avd 2>nul | findstr "%AVD_NAME%" >nul
if %ERRORLEVEL% == 0 (
    echo [OK] AVD '%AVD_NAME%' already exists. Skipping creation.
    goto :launch_emulator
)

echo [STEP 3] Creating Pixel 6 Android Emulator (API 33 - Android 13)...
echo.

echo no | "%CMDLINE_TOOLS%\bin\avdmanager.bat" --sdk_root="%ANDROID_SDK%" create avd ^
    --name "%AVD_NAME%" ^
    --device "pixel_6" ^
    --package "system-images;android-33;google_apis;x86_64" ^
    --force

if errorlevel 1 (
    echo [ERROR] Failed to create AVD. Check that system image was downloaded.
    pause
    exit /b 1
)

echo [OK] Pixel 6 AVD created successfully!

:launch_emulator
echo.
echo [STEP 4] Launching Emulator...
echo          (First boot takes ~60 seconds. Wait for Android home screen.)
echo.

:: Add platform-tools to PATH for this session
set "PATH=%ANDROID_SDK%\platform-tools;%ANDROID_SDK%\emulator;%PATH%"

:: Save SDK path to a config file for other scripts
echo ANDROID_SDK=%ANDROID_SDK% > "%~dp0android_sdk_path.txt"

:: Launch emulator in background
start "" "%EMULATOR%" -avd %AVD_NAME% -no-snapshot-load -wipe-data

echo [INFO] Emulator is booting in background...
echo [INFO] Waiting 60 seconds for boot to complete...
timeout /t 60 /nobreak

:: Wait for adb to detect device
"%ADB%" wait-for-device

echo.
echo ================================================================================
echo   [SUCCESS] Android Emulator is running!
echo.
echo   You can now:
echo   1. Run START_SERVER.bat to start the web dashboard
echo   2. Extract reviews for a date
echo   3. Click "Record on Android" to start the auto-scroll recording
echo ================================================================================
echo.
pause
