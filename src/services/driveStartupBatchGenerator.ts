/**
 * Generates EmiratesFalcon-GDrive-Startup.bat for Windows workstations & servers.
 * Automatically verifies Google Drive connectivity, checks ERP server status,
 * and maintains the persistent archive link.
 */

export const generateDriveStartupBatContent = (originUrl?: string): string => {
  const targetUrl = originUrl || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

  return `@echo off
chcp 65001 >nul
title Emirates Falcon ERP - Google Drive & System Startup Diagnostic
color 0B
cls

echo ==============================================================================
echo             EMIRATES FALCON REAL ESTATE ERP - SYSTEM STARTUP
echo        Google Drive Central Archive & Diagnostic Automation Service
echo ==============================================================================
echo.
echo [1/4] Checking Network Connectivity to Google API...
ping -n 2 www.google.com >nul 2>&1
if %errorlevel% equ 0 (
    echo       [PASS] Google Internet Backbone: Reachable.
) else (
    echo       [WARN] Google Internet unreachable. Check your network or DNS.
)
echo.

echo [2/4] Verifying ERP Application Endpoint (%targetUrl%)...
powershell -Command "try { $res = Invoke-WebRequest -Uri '%targetUrl%/api/health' -UseBasicParsing -TimeoutSec 5; if ($res.StatusCode -eq 200) { Write-Host '      [PASS] ERP Server is ACTIVE and responding.' -ForegroundColor Green } else { Write-Host '      [WARN] ERP Server returned status ' $res.StatusCode -ForegroundColor Yellow } } catch { Write-Host '      [WARN] Could not connect directly to %targetUrl%. Server may be starting...' -ForegroundColor Yellow }"

echo.
echo [3/4] Testing Central Google Drive Integration Status...
powershell -Command "try { $json = (Invoke-WebRequest -Uri '%targetUrl%/api/integrations/google-drive/status' -UseBasicParsing -TimeoutSec 7).Content | ConvertFrom-Json; if ($json.connected -eq $true) { Write-Host '      [PASS] Google Drive Central Connection: ACTIVE' -ForegroundColor Green; Write-Host ('      Account: ' + $json.email) -ForegroundColor Cyan; Write-Host ('      Root Archive: ' + $json.rootFolderName) -ForegroundColor Cyan; } else { Write-Host '      [INFO] Central Google Drive not connected yet. Status: ' $json.status -ForegroundColor Yellow; Write-Host '      Log into ERP as Admin -> Settings -> Integrations to authorize.' -ForegroundColor Gray; } } catch { Write-Host '      [NOTICE] Drive diagnostic endpoint skipped or needs ERP authentication.' -ForegroundColor Gray }"

echo.
echo [4/4] Launching Emirates Falcon Real Estate ERP...
start "" "%targetUrl%"

echo.
echo ==============================================================================
echo All startup diagnostic checks executed. Window will close automatically.
echo ==============================================================================
timeout /t 5 >nul
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
