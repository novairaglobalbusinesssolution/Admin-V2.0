@echo off
title Android Emulator Launcher
color 0B

echo ================================================================================
echo       PLAY STORE REVIEW AGENT - ANDROID EMULATOR LAUNCHER
echo ================================================================================
echo.

set "ANDROID_SDK=%LOCALAPPDATA%\Android\Sdk"
set "EMULATOR=%ANDROID_SDK%\emulator\emulator.exe"
set "ADB=%ANDROID_SDK%\platform-tools\adb.exe"

if not exist "%EMULATOR%" (
    echo [ERROR] Android emulator not found at %EMULATOR%
    pause
    exit /b 1
)

echo Available Virtual Devices (AVDs):
echo   [1] Google Pixel 10a (Recommended - Google Play Store Enabled)
echo   [2] Nothing Phone (2a)
echo   [3] Medium Phone (API 36.1)
echo.

set /p CHOICE="Select virtual device to launch [1, 2, or 3] (Default is 1): "
if "%CHOICE%"=="" set CHOICE=1

if "%CHOICE%"=="1" (
    set "AVD_NAME=Google_Pixel_10a"
) else if "%CHOICE%"=="2" (
    set "AVD_NAME=Nothing_Phone_2a"
) else if "%CHOICE%"=="3" (
    set "AVD_NAME=Medium_Phone_API_36.1"
) else (
    set "AVD_NAME=Google_Pixel_10a"
)

echo.
echo [INFO] Launching %AVD_NAME%...
echo [INFO] Emulator window will open. Please wait 30-45 seconds for Android to boot.
echo [INFO] Once booted, the web agent will automatically detect it!
echo.

start "" "%EMULATOR%" -avd "%AVD_NAME%" -accel on

exit /b 0
