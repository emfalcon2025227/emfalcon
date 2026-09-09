@echo off
setlocal enabledelayedexpansion
title Emirates Falcon Scanner Bridge - Uninstaller

echo =====================================================================
echo    Emirates Falcon Scanner Bridge - Uninstaller
echo =====================================================================
echo.

set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set VBS_FILE=%STARTUP_DIR%\EmiratesFalconScanner.vbs

if exist "%VBS_FILE%" (
    echo Removing Windows Startup auto-run script...
    del /f /q "%VBS_FILE%"
    echo   - Startup script removed [OK]
) else (
    echo   - No startup script found.
)

echo.
echo Stopping any running Scanner Bridge processes on port 18622...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":18622" ^| find "LISTENING"') do (
    echo Terminating PID %%a...
    taskkill /F /PID %%a >nul 2>nul
)

echo.
echo =====================================================================
echo [SUCCESS] Emirates Falcon Scanner Bridge has been uninstalled.
echo =====================================================================
pause
