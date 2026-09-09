@echo off
setlocal enabledelayedexpansion
title Emirates Falcon Scanner Bridge - Interactive Console

echo =====================================================================
echo    Emirates Falcon Scanner Bridge - Interactive Runner v2.2.0
echo =====================================================================
echo.

cd /d "%~dp0"

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in your system PATH.
    echo Please run install.bat or install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: Check if port 18622 is already in use
for /f "tokens=5" %%a in ('netstat -aon ^| find ":18622" ^| find "LISTENING"') do (
    echo Port 18622 is currently occupied by PID %%a.
    set /p KILL_OLD="Do you want to terminate the existing bridge process? (Y/N): "
    if /i "!KILL_OLD!"=="Y" (
        taskkill /F /PID %%a
    ) else (
        echo Keeping existing process. Exiting.
        pause
        exit /b 0
    )
)

echo Starting Scanner Bridge server...
node server.js
pause
