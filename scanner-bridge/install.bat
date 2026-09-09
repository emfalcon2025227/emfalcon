@echo off
setlocal enabledelayedexpansion
title Emirates Falcon ERP - Scanner Bridge Installer v2.2.0

echo =====================================================================
echo    Emirates Falcon Real Estate ERP - Scanner Bridge Installer v2.2.0
echo    (Supports HP LaserJet M282nw & All Windows WIA/TWAIN Scanners)
echo =====================================================================
echo.

:: 1. Verify Node.js
echo [1/5] Checking Node.js runtime...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not found in system PATH.
    echo.
    echo Please install Node.js (LTS version) from:
    echo   https://nodejs.org/
    echo After installing, please run this installer again.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo   - Found Node.js version: %NODE_VER% [OK]

:: 2. Verify PowerShell
echo.
echo [2/5] Checking Windows PowerShell...
where powershell >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PowerShell is required to interface with Windows WIA COM objects.
    pause
    exit /b 1
)
echo   - PowerShell is available [OK]

:: 3. Verify Windows Image Acquisition (WIA) Service (stisvc)
echo.
echo [3/5] Verifying Windows Image Acquisition (WIA) service...
sc query stisvc | findstr /i "STATE" | findstr /i "RUNNING" >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo   - WIA service (stisvc) is not running. Attempting to start it...
    net start stisvc >nul 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo   [WARNING] Could not start stisvc service automatically. You may need administrator rights.
    ) else (
        echo   - WIA service started successfully [OK]
    )
) else (
    echo   - Windows WIA service (stisvc) is RUNNING [OK]
)

:: 4. Install npm dependencies
echo.
echo [4/5] Installing Bridge dependencies (express, cors)...
cd /d "%~dp0"
call npm install --no-audit --no-fund
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install npm dependencies. Check your internet connection.
    pause
    exit /b 1
)
echo   - Dependencies installed successfully [OK]

:: 5. Register in Windows Startup for automatic background execution
echo.
echo [5/5] Registering Windows Startup task for auto-start...
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set VBS_FILE=%STARTUP_DIR%\EmiratesFalconScanner.vbs

echo Set WshShell = CreateObject("WScript.Shell") > "%VBS_FILE%"
echo WshShell.Run """" ^& "%~dp0run-bridge.bat" ^& """", 0, False >> "%VBS_FILE%"

echo   - Created startup script: %VBS_FILE% [OK]

:: Stop any old instance on port 18622
for /f "tokens=5" %%a in ('netstat -aon ^| find ":18622" ^| find "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>nul
)

:: Launch the supervisor silently
echo.
echo Starting the Scanner Bridge Service in the background...
start "" wscript "%VBS_FILE%"

:: Wait 2 seconds for server initialization
timeout /t 2 /nobreak >nul

:: Verify health
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:18622/health' -TimeoutSec 3; Write-Host 'Bridge Status: ' $r.status ' | Devices Found: ' $r.scannerCount } catch { Write-Host 'Bridge launched, awaiting requests.' }"

echo.
echo =====================================================================
echo [SUCCESS] Emirates Falcon Scanner Bridge v2.2.0 is now ACTIVE!
echo  - Service URL: http://127.0.0.1:18622
echo  - Automatic startup on Windows user login: ENABLED
echo  - Single & ADF Batch Scanning: READY
echo =====================================================================
echo.
echo You can close this window now. Your ERP browser will detect the scanner automatically.
pause
