@echo off
chcp 65001 >nul 2>&1
title Emirates Falcon ERP - Add Scanner Bridge to Windows Startup
color 0B
cls

echo ==============================================================================
echo   تثبيت جسر الماسح ليعمل تلقائياً عند تشغيل الويندوز
echo   Install Emirates Falcon Scanner Bridge at Windows Startup
echo ==============================================================================
echo.

set "BRIDGE_DIR=%~dp0"
set "VBS_SCRIPT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\falcon_scanner_bridge.vbs"

echo Set WshShell = CreateObject("WScript.Shell") > "%VBS_SCRIPT%"
echo WshShell.CurrentDirectory = "%BRIDGE_DIR%" >> "%VBS_SCRIPT%"
echo WshShell.Run "node cloud-bridge.js", 0, False >> "%VBS_SCRIPT%"

echo ✅ تم التثبيت بنجاح في مجلد بدء التشغيل (Windows Startup):
echo "%VBS_SCRIPT%"
echo.
echo سيعمل جسر الماسح في الخلفية تلقائياً كلما قمت بتشغيل الكمبيوتر!
echo.
pause
