@echo off
chcp 65001 >nul 2>&1
title Emirates Falcon ERP - Scanner Cloud & Local Bridge v2.3.0
color 0A
cls

echo ==============================================================================
echo   صقر الإمارات للعقارات - جسر الماسح الضوئي الذكي (محلي وسحابي)
echo   EMIRATES FALCON ERP - SCANNER CLOUD ^& LOCAL BRIDGE v2.3.0
echo   Target Device: HP Color LaserJet Pro MFP M282nw ^& Universal WIA
echo ==============================================================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [خطأ] لم يتم العثور على Node.js على هذا الجهاز.
    echo يرجى تثبيت Node.js من: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo [1/2] جارٍ تشغيل خدمة الجسر للاتصال بالسحابة والماسح المحلي...
echo.

node cloud-bridge.js

if %errorlevel% neq 0 (
    echo.
    echo ==============================================================================
    echo [تنبيه] توقفت خدمة الجسر. اضغط أي مفتاح لإعادة المحاولة...
    echo ==============================================================================
    pause >nul
)
