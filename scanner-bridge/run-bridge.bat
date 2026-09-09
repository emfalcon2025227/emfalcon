@echo off
setlocal enabledelayedexpansion
title Emirates Falcon ERP - Local Scanner Bridge Supervisor

set SCRIPT_DIR=%~dp0
set LOG_FILE=%TEMP%\emirates_falcon_scanner_bridge.log

echo [%date% %time%] Supervisor starting Emirates Falcon Scanner Bridge v2.2.0 >> "%LOG_FILE%"

:loop
echo [%date% %time%] Launching Scanner Bridge on http://127.0.0.1:18622... >> "%LOG_FILE%"
cd /d "%SCRIPT_DIR%"
node server.js >> "%LOG_FILE%" 2>&1

set EXIT_CODE=%ERRORLEVEL%
echo [%date% %time%] Scanner Bridge terminated with exit code %EXIT_CODE%. >> "%LOG_FILE%"

:: If cleanly stopped (exit 0), do not loop
if "%EXIT_CODE%"=="0" (
    echo [%date% %time%] Clean shutdown requested. Exiting supervisor. >> "%LOG_FILE%"
    exit /b 0
)

:: Backoff pause before restarting to prevent rapid crash looping
echo [%date% %time%] Unexpected exit. Restarting in 3 seconds... >> "%LOG_FILE%"
timeout /t 3 /nobreak >nul
goto loop
