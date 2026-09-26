import { scannerService } from "./scannerService";

/**
 * Emirates Falcon ERP - HP Scanner & Local WIA Bridge Generator
 * Version: 2.2.0 (Hardened WIA & ADF Batch Edition)
 * Generates ready-to-run, 100% self-contained Windows Batch & PowerShell bridge scripts for
 * HP Color LaserJet Pro MFP M282nw series and all WIA/TWAIN compatible hardware scanners.
 */

export const HP_SCANNER_BRIDGE_POWERSHELL_CORE = `
# ==============================================================================
# Emirates Falcon ERP - HP Color LaserJet Pro MFP M282nw Local Scanner Bridge
# Version: 2.2.0 | Port: 18622 | Protocols: WIA, TWAIN, ADF Batch & HP LaserJet
# ==============================================================================

try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

try {
    $Host.UI.RawUI.WindowTitle = "Emirates Falcon ERP - HP Scanner Bridge v2.2.0 (Port 18622)"
} catch {}

Clear-Host
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  EMIRATES FALCON ERP - SCANNER LOCAL BRIDGE SERVICE v2.2.0        " -ForegroundColor Yellow
Write-Host "  Target: HP Color LaserJet Pro MFP M282nw Series & WIA Scanners    " -ForegroundColor White
Write-Host "  Features: Single Scan + ADF Multi-Cheque Batch + Mutex Lock       " -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

# Ensure Windows Image Acquisition (WIA) Service is running
try {
    $wiaService = Get-Service -Name "stisvc" -ErrorAction SilentlyContinue
    if ($wiaService -and $wiaService.Status -ne "Running") {
        Write-Host "Starting Windows Image Acquisition (WIA) Service..." -ForegroundColor Cyan
        Start-Service -Name "stisvc" -ErrorAction SilentlyContinue
    }
} catch {}

# Load Required .NET Assemblies
try {
    Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue
    Add-Type -AssemblyName System.Web -ErrorAction SilentlyContinue
} catch {}

# Global Scanner Busy Lock
$global:isScannerBusy = $false
$global:activeScanSession = $null
$global:startTime = [DateTime]::UtcNow

# Function to get WIA Scanner Devices with ADF detection
function Get-WiaScanners {
    $scanners = @()
    try {
        $deviceManager = New-Object -ComObject WIA.DeviceManager
        foreach ($devInfo in $deviceManager.DeviceInfos) {
            # Type 1 = ScannerDeviceType
            if ($devInfo.Type -eq 1) {
                $name = $devInfo.Properties.Item("Name").Value
                $id = $devInfo.DeviceId
                $isHP = ($name -match "HP" -or $name -match "LaserJet" -or $name -match "M282" -or $name -match "M283" -or $name -match "M280")
                
                $adfSupported = $true
                try {
                    $caps = $devInfo.Properties.Item("3087").Value
                    $adfSupported = (($caps -band 1) -eq 1)
                } catch {
                    $adfSupported = $isHP
                }

                $scanners += @{
                    id = $id
                    name = $name
                    protocol = "WIA"
                    isHP = $isHP
                    adfSupported = $adfSupported
                }
            }
        }
    } catch {
        Write-Warning "WIA Service query notice: $_"
    }
    return $scanners
}

# Function to Perform Single WIA Scan
function Invoke-WiaScan {
    param(
        [string]$ScannerId,
        [int]$Dpi = 300,
        [string]$ColorMode = "COLOR",
        [string]$Source = "auto"
    )

    $tempFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "ef_scan_$(Get-Date -Format 'yyyyMMddHHmmssfff')_$([System.Guid]::NewGuid().ToString().Substring(0,8)).jpg")
    try {
        $deviceManager = New-Object -ComObject WIA.DeviceManager
        $selectedDevice = $null

        if ($ScannerId) {
            foreach ($devInfo in $deviceManager.DeviceInfos) {
                if ($devInfo.DeviceId -eq $ScannerId -or $devInfo.Properties.Item("Name").Value -match $ScannerId) {
                    $selectedDevice = $devInfo.Connect()
                    break
                }
            }
        }

        if (-not $selectedDevice -and $deviceManager.DeviceInfos.Count -gt 0) {
            foreach ($devInfo in $deviceManager.DeviceInfos) {
                if ($devInfo.Type -eq 1) {
                    $selectedDevice = $devInfo.Connect()
                    break
                }
            }
        }

        if (-not $selectedDevice) {
            throw "لم يتم العثور على ماسح ضوئي متصل بجهاز الكمبيوتر. يرجى التأكد من تشغيل طابعة HP M282nw وتوصيلها."
        }

        $item = $selectedDevice.Items(1)

        # Configure DPI (WIA_IPS_XRES = 6147, WIA_IPS_YRES = 6148)
        try {
            $item.Properties.Item("6147").Value = $Dpi
            $item.Properties.Item("6148").Value = $Dpi
        } catch {}

        # Configure Color Intent (WIA_IPS_CUR_INTENT = 6146)
        try {
            if ($ColorMode -eq "MONO" -or $ColorMode -eq "BW") {
                $item.Properties.Item("6146").Value = 4
            } elseif ($ColorMode -eq "GRAYSCALE") {
                $item.Properties.Item("6146").Value = 2
            } else {
                $item.Properties.Item("6146").Value = 1
            }
        } catch {}

        # Source select (3088): 1=Flatbed, 2=Feeder
        if ($Source -ne "auto") {
            try {
                if ($Source -eq "feeder") {
                    $selectedDevice.Properties.Item("3088").Value = 2
                } elseif ($Source -eq "flatbed") {
                    $selectedDevice.Properties.Item("3088").Value = 1
                }
            } catch {}
        }

        # Transfer Image format JPEG: {B96B3CAE-0728-11D3-9D7B-0000F81EF32E}
        $wiaFormatJPEG = "{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}"
        $imageFile = $item.Transfer($wiaFormatJPEG)
        
        if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
        $imageFile.SaveFile($tempFile)

        $bytes = [System.IO.File]::ReadAllBytes($tempFile)
        $base64 = [Convert]::ToBase64String($bytes)
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue

        return @{
            success = $true
            imageBase64 = "data:image/jpeg;base64,$base64"
            mimeType = "image/jpeg"
            deviceUsed = $selectedDevice.Properties.Item("Name").Value
        }
    } catch {
        if (Test-Path $tempFile) { Remove-Item $tempFile -Force -ErrorAction SilentlyContinue }
        return @{
            success = $false
            error = $_.Exception.Message
        }
    }
}

# Function to Perform Multi-Page ADF Batch Scan
function Invoke-WiaBatchScan {
    param(
        [string]$ScannerId,
        [int]$Dpi = 300,
        [string]$ColorMode = "COLOR",
        [int]$MaxPages = 25
    )

    $deviceManager = New-Object -ComObject WIA.DeviceManager
    $selectedDevice = $null

    if ($ScannerId) {
        foreach ($devInfo in $deviceManager.DeviceInfos) {
            if ($devInfo.DeviceId -eq $ScannerId -or $devInfo.Properties.Item("Name").Value -match $ScannerId) {
                $selectedDevice = $devInfo.Connect()
                break
            }
        }
    }

    if (-not $selectedDevice -and $deviceManager.DeviceInfos.Count -gt 0) {
        foreach ($devInfo in $deviceManager.DeviceInfos) {
            if ($devInfo.Type -eq 1) {
                $selectedDevice = $devInfo.Connect()
                break
            }
        }
    }

    if (-not $selectedDevice) {
        return @{
            success = $false
            error = "لم يتم العثور على أي ماسح ضوئي متصل."
            code = "NO_SCANNER_DETECTED"
        }
    }

    $item = $selectedDevice.Items(1)

    # Force Feeder source: 3088 = 2
    try { $selectedDevice.Properties.Item("3088").Value = 2 } catch {}

    # Configure DPI & Intent
    try {
        $item.Properties.Item("6147").Value = $Dpi
        $item.Properties.Item("6148").Value = $Dpi
    } catch {}

    try {
        if ($ColorMode -eq "MONO" -or $ColorMode -eq "BW") {
            $item.Properties.Item("6146").Value = 4
        } elseif ($ColorMode -eq "GRAYSCALE") {
            $item.Properties.Item("6146").Value = 2
        } else {
            $item.Properties.Item("6146").Value = 1
        }
    } catch {}

    $wiaFormatJPEG = "{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}"
    $pages = @()
    $completedReason = "FEEDER_EMPTY"
    $limit = [Math]::Min($MaxPages, 100)

    for ($i = 1; $i -le $limit; $i++) {
        $tempFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "ef_batch_$(Get-Date -Format 'yyyyMMddHHmmssfff')_$i.jpg")
        try {
            $imageFile = $item.Transfer($wiaFormatJPEG)
            if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
            $imageFile.SaveFile($tempFile)

            $bytes = [System.IO.File]::ReadAllBytes($tempFile)
            $b64 = [Convert]::ToBase64String($bytes)
            Remove-Item $tempFile -Force -ErrorAction SilentlyContinue

            $pages += @{
                sequence = $i
                pageNumber = $i
                mimeType = "image/jpeg"
                imageBase64 = "data:image/jpeg;base64,$b64"
                fileSize = $bytes.Length
            }
        } catch {
            if (Test-Path $tempFile) { Remove-Item $tempFile -Force -ErrorAction SilentlyContinue }
            $msg = $_.Exception.Message
            $hres = ("0x{0:X8}" -f ($_.Exception.HResult -band 0xFFFFFFFF))
            if ($hres -eq "0x80210003" -or $msg -match "0x80210003" -or $msg -match "paper.*empty" -or $msg -match "feeder.*empty") {
                if ($pages.Count -eq 0) {
                    return @{
                        success = $false
                        code = "ADF_EMPTY"
                        error = "وحدة التغذية التلقائية (ADF) فارغة. يرجى وضع الأوراق في درج التغذية للماسح."
                    }
                }
                $completedReason = "FEEDER_EMPTY"
                break
            } else {
                if ($pages.Count -gt 0) {
                    $completedReason = "INTERRUPTED"
                    break
                }
                return @{
                    success = $false
                    code = "ADF_ERROR"
                    error = $msg
                }
            }
        }
    }

    if ($pages.Count -eq $limit) {
        $completedReason = "MAX_PAGES_REACHED"
    }

    return @{
        success = $true
        sessionId = "batch_$(Get-Date -Format 'yyyyMMddHHmmss')"
        source = "feeder"
        totalPages = $pages.Count
        completedReason = $completedReason
        pages = $pages
        deviceUsed = $selectedDevice.Properties.Item("Name").Value
    }
}

# Start HTTP Listener on Port 18622
$Port = 18622
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")

try {
    $listener.Start()
} catch {
    Write-Host "====================================================================" -ForegroundColor Red
    Write-Host "⚠️ NOTICE: Port $Port is currently already running or busy." -ForegroundColor Yellow
    Write-Host "====================================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Checking if HP Scanner Bridge is already responding..." -ForegroundColor Cyan
    try {
        $test = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/diagnostics" -TimeoutSec 2
        if ($test.bridge.running) {
            Write-Host "✅ HP Scanner Bridge is ALREADY ACTIVE and running in the background!" -ForegroundColor Green
            Write-Host "   You do NOT need to run this again. You can go to the browser now." -ForegroundColor White
            Write-Host ""
        }
    } catch {
        Write-Host "Error details: $_" -ForegroundColor Gray
    }
    Write-Host "Press any key to keep this window open..." -ForegroundColor White
    try { $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") } catch { Start-Sleep -Seconds 30 }
    exit
}

Write-Host "====================================================================" -ForegroundColor Green
Write-Host "  ✅ HP SCANNER BRIDGE v2.2.0 IS RUNNING AND READY!                " -ForegroundColor Green
Write-Host "  Listening on: http://127.0.0.1:$Port                             " -ForegroundColor White
Write-Host "  Target Device: HP Color LaserJet Pro MFP M282nw Series           " -ForegroundColor White
Write-Host "====================================================================" -ForegroundColor Green
Write-Host ""
Write-Host ">>> YOU CAN NOW CLICK [START SCAN / بدء المسح] IN YOUR BROWSER <<<" -ForegroundColor Yellow
Write-Host "Keep this window open or minimized while using the scanner." -ForegroundColor Gray
Write-Host ""

$scanners = Get-WiaScanners
if ($scanners.Count -eq 0) {
    Write-Host "⚠️ Notice: No WIA hardware scanner detected yet." -ForegroundColor Yellow
    Write-Host "   Please ensure your HP M282nw is ON and connected via USB or Wi-Fi." -ForegroundColor Gray
} else {
    Write-Host "Connected Scanners detected:" -ForegroundColor Green
    foreach ($s in $scanners) {
        $badge = if ($s.isHP) { "⭐ [HP M282nw]" } else { "" }
        $adf = if ($s.adfSupported) { "[ADF Ready]" } else { "" }
        Write-Host "  • $($s.name) $badge $adf" -ForegroundColor Cyan
    }
}
Write-Host ""

# Main Request Handling Loop
while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # Enable CORS
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        $rawUrl = $request.RawUrl
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $($request.HttpMethod) $rawUrl" -ForegroundColor Gray

        # Send JSON response helper
        function Send-JsonResponse($obj, [int]$status = 200) {
            $json = $obj | ConvertTo-Json -Depth 5
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.StatusCode = $status
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
        }

        if ($rawUrl -match "/health") {
            $currentScanners = Get-WiaScanners
            $hpScanner = $currentScanners | Where-Object { $_.isHP -or $_.name -match "HP" } | Select-Object -First 1
            $primary = if ($hpScanner) { $hpScanner } else { $currentScanners | Select-Object -First 1 }
            
            $statusStr = "NO_SCANNER_DETECTED"
            if ($global:isScannerBusy) {
                $statusStr = "SCANNER_BUSY"
            } elseif ($primary) {
                $statusStr = "SCANNER_READY"
            }

            Send-JsonResponse @{
                ok = $true
                bridgeRunning = $true
                bridgeVersion = "2.2.0"
                port = $Port
                uptimeSeconds = [Math]::Floor(((Get-Date) - $global:startTime).TotalSeconds)
                isScannerBusy = $global:isScannerBusy
                scannerDetected = ($currentScanners.Count -gt 0)
                scannerCount = $currentScanners.Count
                scannerName = if ($primary) { $primary.name } else { $null }
                scannerId = if ($primary) { $primary.id } else { $null }
                adfAvailable = if ($primary) { [bool]$primary.adfSupported } else { $false }
                status = $statusStr
                statusCode = $statusStr
                hpDetected = [bool]$hpScanner
            }
        }
        elseif ($rawUrl -match "/scanners") {
            $currentScanners = Get-WiaScanners
            Send-JsonResponse @{
                success = $true
                scanners = $currentScanners
                isScannerBusy = $global:isScannerBusy
                count = $currentScanners.Count
            }
        }
        elseif ($rawUrl -match "/diagnostics") {
            $currentScanners = Get-WiaScanners
            $hpScanner = $currentScanners | Where-Object { $_.isHP -or $_.name -match "HP" } | Select-Object -First 1
            $primary = if ($hpScanner) { $hpScanner } else { $currentScanners | Select-Object -First 1 }

            $compStatus = "NO_SCANNER_DETECTED"
            if ($global:isScannerBusy) {
                $compStatus = "SCANNER_BUSY"
            } elseif ($primary) {
                $compStatus = "SCANNER_READY"
            }

            Send-JsonResponse @{
                bridge = @{
                    running = $true
                    version = "2.2.0"
                    port = $Port
                    uptimeSeconds = [Math]::Floor(((Get-Date) - $global:startTime).TotalSeconds)
                }
                wia = @{ available = $true }
                scanner = @{
                    detected = ($currentScanners.Count -gt 0)
                    primaryName = if ($primary) { $primary.name } else { $null }
                    primaryId = if ($primary) { $primary.id } else { $null }
                    isHP = [bool]$hpScanner
                    adfAvailable = if ($primary) { [bool]$primary.adfSupported } else { $false }
                    isBusy = $global:isScannerBusy
                    status = $compStatus
                    statusCode = $compStatus
                }
                scanners = $currentScanners
                hpModel = "HP Color LaserJet Pro MFP M282nw Series"
                timestamp = (Get-Date).ToString("o")
            }
        }
        elseif ($rawUrl -match "/scan/batch") {
            if ($global:isScannerBusy) {
                Send-JsonResponse @{
                    success = $false
                    code = "SCANNER_BUSY"
                    error = "الماسح الضوئي مشغول حالياً بعملية أخرى."
                } 423
                continue
            }

            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $bodyText = $reader.ReadToEnd()
            $body = @{}
            if ($bodyText) { try { $body = $bodyText | ConvertFrom-Json } catch {} }

            $dpi = if ($body.dpi) { [int]$body.dpi } else { 300 }
            $colorMode = if ($body.colorMode) { [string]$body.colorMode } else { "COLOR" }
            $scannerId = if ($body.scannerId) { [string]$body.scannerId } else { "" }
            $maxPages = if ($body.maxPages) { [int]$body.maxPages } else { 25 }

            $global:isScannerBusy = $true
            try {
                Write-Host "  -> Starting ADF Batch scan on HP Scanner (DPI: $dpi, Max: $maxPages)..." -ForegroundColor Yellow
                $batchResult = Invoke-WiaBatchScan -ScannerId $scannerId -Dpi $dpi -ColorMode $colorMode -MaxPages $maxPages
                $statusHttp = if ($batchResult.success) { 200 } else { 400 }
                Send-JsonResponse $batchResult $statusHttp
            } finally {
                $global:isScannerBusy = $false
            }
        }
        elseif ($rawUrl -match "/scan") {
            if ($global:isScannerBusy) {
                Send-JsonResponse @{
                    success = $false
                    code = "SCANNER_BUSY"
                    error = "الماسح الضوئي مشغول حالياً بعملية أخرى."
                } 423
                continue
            }

            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $bodyText = $reader.ReadToEnd()
            $body = @{}
            if ($bodyText) { try { $body = $bodyText | ConvertFrom-Json } catch {} }

            $dpi = if ($body.dpi) { [int]$body.dpi } else { 300 }
            $colorMode = if ($body.colorMode) { [string]$body.colorMode } else { "COLOR" }
            $scannerId = if ($body.scannerId) { [string]$body.scannerId } else { "" }
            $source = if ($body.source) { [string]$body.source } else { "auto" }

            $global:isScannerBusy = $true
            try {
                Write-Host "  -> Starting single scan on HP Scanner (DPI: $dpi, Color: $colorMode)..." -ForegroundColor Yellow
                $scanResult = Invoke-WiaScan -ScannerId $scannerId -Dpi $dpi -ColorMode $colorMode -Source $source

                if ($scanResult.success) {
                    Write-Host "  -> Scan completed successfully! ($($scanResult.deviceUsed))" -ForegroundColor Green
                    Send-JsonResponse $scanResult 200
                } else {
                    Write-Host "  -> Scan error: $($scanResult.error)" -ForegroundColor Red
                    Send-JsonResponse $scanResult 500
                }
            } finally {
                $global:isScannerBusy = $false
            }
        }
        else {
            Send-JsonResponse @{ error = "Endpoint not found" } 404
        }
    } catch {
        Write-Host "Request error: $_" -ForegroundColor Red
    }
}
`;

/**
 * Helper to encode string into certutil multi-line base64
 */
function toCertutilBase64(content: string): string {
  const utf8Bytes = new TextEncoder().encode(content);
  let binary = "";
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  const b64 = btoa(binary);
  const chunks: string[] = [];
  for (let i = 0; i < b64.length; i += 64) {
    chunks.push(b64.substring(i, i + 64));
  }
  return chunks.join("\r\n");
}

export function getBridgeScriptForPort(port?: number): string {
  const activePort = port || scannerService.getPort() || 18622;
  return HP_SCANNER_BRIDGE_POWERSHELL_CORE
    .replace(/\$Port = 18622/g, `$Port = ${activePort}`)
    .replace(/Port: 18622/g, `Port: ${activePort}`)
    .replace(/Port 18622/g, `Port ${activePort}`)
    .replace(/127\.0\.0\.1:18622/g, `127.0.0.1:${activePort}`);
}

/**
 * Self-contained Hybrid Batch + PowerShell Script
 * Uses Windows Certutil to decode the embedded payload into %TEMP% safely without path, quoting, or argument length issues.
 * Will NEVER close on error because it includes an unconditional pause at the end.
 */
export function generateSelfContainedBatScript(port?: number): string {
  const activePort = port || scannerService.getPort() || 18622;
  const scriptContent = getBridgeScriptForPort(activePort);
  const base64Certificate = toCertutilBase64(scriptContent);

  return `@echo off
setlocal
chcp 65001 >nul 2>&1
title Emirates Falcon ERP - HP Color LaserJet Pro MFP M282nw Scanner Bridge v2.2.0 (Port ${activePort})
color 0B
cls

echo ==============================================================================
echo   EMIRATES FALCON ERP - HP SCANNER BRIDGE LAUNCHER v2.2.0
echo   Target Device: HP Color LaserJet Pro MFP M282nw Series ^& Universal WIA
echo   Configured Port: ${activePort}
echo ==============================================================================
echo.
echo [1/2] Preparing HP Scanner Daemon...

set "TEMP_B64=%TEMP%\\hp_scanner_bridge_%RANDOM%.b64"
set "TEMP_PS1=%TEMP%\\hp_scanner_bridge_%RANDOM%.ps1"

(
echo -----BEGIN CERTIFICATE-----
${base64Certificate}
echo -----END CERTIFICATE-----
) > "%TEMP_B64%"

certutil -decode -f "%TEMP_B64%" "%TEMP_PS1%" >nul 2>&1
del "%TEMP_B64%" >nul 2>&1

echo [2/2] Starting Scanner Bridge on Port ${activePort}...
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%TEMP_PS1%"

del "%TEMP_PS1%" >nul 2>&1

echo.
echo ==============================================================================
echo   [NOTICE] HP Scanner Bridge session has ended.
echo ==============================================================================
echo.
echo Press any key to close this window...
pause >nul
`;
}

/**
 * Download the generated .bat launcher file in the browser
 */
export function downloadHPBridgeBatchLauncher(port?: number) {
  const activePort = port || scannerService.getPort() || 18622;
  const content = generateSelfContainedBatScript(activePort);
  const blob = new Blob([content], { type: "application/x-bat;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Start-HP-Scanner-Port-${activePort}.bat`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download raw PowerShell script
 */
export function downloadHPBridgePs1Script(port?: number) {
  const activePort = port || scannerService.getPort() || 18622;
  const scriptContent = getBridgeScriptForPort(activePort);
  const blob = new Blob([scriptContent], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hp-scanner-bridge-port-${activePort}.ps1`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Get direct PowerShell one-liner to copy/paste in terminal
 */
export function getPowerShellOneLiner(port?: number): string {
  const activePort = port || scannerService.getPort() || 18622;
  return `powershell -ExecutionPolicy Bypass -Command "[System.Net.ServicePointManager]::SecurityProtocol = 3072; iex ((New-Object System.Net.WebClient).DownloadString('http://127.0.0.1:${activePort}/health'))"`;
}
