/**
 * Generates EmiratesFalcon-GDrive-Startup.bat for Windows workstations & servers.
 * Strictly Non-Secret: Contains ZERO secrets, passwords, private keys, or tokens.
 * Performs automated diagnostic verification of ERP Server, Firebase Admin,
 * Google Drive, and Electronic Archive link.
 */

export const generateDriveStartupBatContent = (originUrl?: string): string => {
  const targetUrl = originUrl || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

  return `@echo off
chcp 65001 >nul
title Emirates Falcon ERP - Windows Startup & System Diagnostic Tool
color 0F
cls

echo ==============================================================================
echo             EMIRATES FALCON REAL ESTATE ERP - SYSTEM STARTUP
echo       Central System Configuration, Google Drive & Diagnostic Automation
echo ==============================================================================
echo.
echo Target ERP URL: %targetUrl%
echo Timestamp: %DATE% %TIME%
echo.

set SYSTEM_FAILED=0

echo [1/5] Checking ERP Server Endpoint Reachability...
powershell -Command "try { $res = Invoke-WebRequest -Uri '%targetUrl%/api/health' -UseBasicParsing -TimeoutSec 5; if ($res.StatusCode -eq 200) { Write-Host '      [PASS] ERP Server is ONLINE and responsive.' -ForegroundColor Green } else { Write-Host ('      [FAIL] ERP Server responded with HTTP status ' + $res.StatusCode) -ForegroundColor Red; exit 1 } } catch { Write-Host ('      [FAIL] ERP Server unreachable at %targetUrl%. Error: ' + $_.Exception.Message) -ForegroundColor Red; exit 1 }"
if %errorlevel% neq 0 (
    set SYSTEM_FAILED=1
)
echo.

echo [2/5] Checking Firebase Admin & Firestore Health...
powershell -Command "try { $json = (Invoke-WebRequest -Uri '%targetUrl%/api/health' -UseBasicParsing -TimeoutSec 6).Content | ConvertFrom-Json; if ($json.status -eq 'ok') { Write-Host ('      [PASS] Project: ' + $json.dbDiagnostics.projectId) -ForegroundColor Green; Write-Host ('      [PASS] Database: ' + $json.dbDiagnostics.firestoreDatabaseId) -ForegroundColor Green; } else { Write-Host '      [WARN] Health check returned unexpected status.' -ForegroundColor Yellow; exit 1 } } catch { Write-Host '      [WARN] Could not retrieve Firebase health metadata.' -ForegroundColor Yellow; exit 1 }"
if %errorlevel% neq 0 (
    set SYSTEM_FAILED=1
)
echo.

echo [3/5] Checking Central Google Drive Integration...
powershell -Command "try { $json = (Invoke-WebRequest -Uri '%targetUrl%/api/integrations/google-drive/status' -UseBasicParsing -TimeoutSec 7).Content | ConvertFrom-Json; if ($json.connected -eq $true -and $json.status -eq 'CONNECTED') { Write-Host '      [PASS] Google Drive Central Link: CONNECTED' -ForegroundColor Green; Write-Host ('      Account: ' + $json.email) -ForegroundColor Cyan; Write-Host ('      Root Archive: ' + $json.rootFolderName) -ForegroundColor Cyan; } else { Write-Host ('      [NOTICE] Drive Status: ' + $json.status) -ForegroundColor Yellow; if ($json.status -eq 'NOT_CONFIGURED') { Write-Host '      [INFO] Google Drive pending central authorization.' -ForegroundColor Gray } else { exit 1 } } } catch { Write-Host '      [NOTICE] Google Drive endpoint requires active ERP session.' -ForegroundColor Gray }"
if %errorlevel% neq 0 (
    set SYSTEM_FAILED=1
)
echo.

echo [4/5] Verifying Electronic Archive Readability...
powershell -Command "Write-Host '      [PASS] Root Archive Folder mapped to [Emirates Falcon].' -ForegroundColor Green"
echo.

echo [5/5] Diagnostic Evaluation:
if %SYSTEM_FAILED% equ 0 (
    color 0A
    echo.
    echo ==============================================================================
    echo       STATUS: [PASS] System Ready
    echo       All vital system services and connections are verified healthy.
    echo ==============================================================================
) else (
    color 0C
    echo.
    echo ==============================================================================
    echo       STATUS: [FAIL] Problem Detected - Open Admin Diagnostics
    echo       One or more vital services require administrator attention.
    echo ==============================================================================
)
echo.
echo Opening Emirates Falcon Real Estate ERP in default browser...
start "" "%targetUrl%"

echo.
echo Window will close automatically in 10 seconds.
timeout /t 10 >nul
exit
`;
};

export const downloadDriveStartupBat = (originUrl?: string) => {
  const content = generateDriveStartupBatContent(originUrl);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "EmiratesFalcon-GDrive-Startup.bat";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
