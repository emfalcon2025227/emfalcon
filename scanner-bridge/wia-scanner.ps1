param(
    [string]$Action = "list",
    [string]$ScannerId = "",
    [int]$Dpi = 300,
    [string]$ColorMode = "COLOR",
    [string]$OutFile = "",
    [string]$OutPattern = "",
    [string]$Source = "auto",
    [int]$MaxPages = 20
)

$ErrorActionPreference = "Stop"

# Output JSON-friendly errors
trap {
    $errObj = @{
        success = $false
        error = $_.Exception.Message
        hresult = ("0x{0:X8}" -f ($_.Exception.HResult -band 0xFFFFFFFF))
        code = "WIA_ERROR"
    }

    $msg = $_.Exception.Message
    $hres = ("0x{0:X8}" -f ($_.Exception.HResult -band 0xFFFFFFFF))

    if ($hres -eq "0x80210003" -or $msg -match "0x80210003" -or $msg -match "paper.*empty" -or $msg -match "feeder.*empty") {
        $errObj.code = "ADF_EMPTY"
        $errObj.error = "وحدة التغذية الآلية (ADF) فارغة. يرجى وضع الأوراق في درج التغذية."
    } elseif ($hres -eq "0x80210002" -or $msg -match "0x80210002" -or $msg -match "paper.*jam") {
        $errObj.code = "PAPER_JAM"
        $errObj.error = "حدث انحشار للورق في وحدة التغذية الآلية (ADF)."
    } elseif ($hres -eq "0x80210006" -or $msg -match "0x80210006" -or $msg -match "busy") {
        $errObj.code = "SCANNER_BUSY"
        $errObj.error = "الماسح الضوئي مشغول حالياً بعملية أخرى."
    } elseif ($hres -eq "0x80210005" -or $msg -match "warming.*up") {
        $errObj.code = "WARMING_UP"
        $errObj.error = "الماسح الضوئي في مرحلة التهيئة والتسخين."
    }

    $errObj | ConvertTo-Json -Compress
    exit 0
}

# Test WIA Service and COM object readiness
if ($Action -eq "test-wia") {
    try {
        $wiaManager = New-Object -ComObject WIA.DeviceManager
        $count = $wiaManager.DeviceInfos.Count
        @{
            success = $true
            wiaAvailable = $true
            deviceCount = $count
        } | ConvertTo-Json -Compress
        exit 0
    } catch {
        @{
            success = $false
            wiaAvailable = $false
            error = $_.Exception.Message
            code = "WIA_UNAVAILABLE"
        } | ConvertTo-Json -Compress
        exit 0
    }
}

# Create WIA Device Manager COM Object
$wiaManager = New-Object -ComObject WIA.DeviceManager

if ($Action -eq "list") {
    $scanners = @()
    foreach ($deviceInfo in $wiaManager.DeviceInfos) {
        if ($deviceInfo.Type -eq 1) { # 1 = ScannerDeviceType
            $name = $deviceInfo.Properties.Item("Name").Value
            $isHP = ($name -match "HP" -or $name -match "LaserJet" -or $name -match "M282" -or $name -match "M283" -or $name -match "M280")
            
            # Inspect ADF capability if queryable
            $adfSupported = $true # Default assume true for MFP scanners like HP M282nw
            try {
                # Attempt to query Document Handling Capabilities (3087)
                $caps = $deviceInfo.Properties.Item("3087").Value
                # Bit 0x01 indicates Feeder/ADF
                $adfSupported = (($caps -band 1) -eq 1)
            } catch {
                # Some drivers only expose 3087 on connected device
                $adfSupported = $isHP
            }

            $scanners += @{
                id = $deviceInfo.DeviceID
                name = $name
                protocol = "WIA"
                isHP = $isHP
                adfSupported = $adfSupported
            }
        }
    }
    $scanners | ConvertTo-Json -Compress
    exit 0
}

# Helper to find and connect to target scanner
function Connect-TargetScanner([string]$targetId) {
    if ($wiaManager.DeviceInfos.Count -eq 0) {
        throw "لم يتم العثور على أي ماسح ضوئي WIA متصل بنظام ويندوز."
    }
    $device = $null
    foreach ($deviceInfo in $wiaManager.DeviceInfos) {
        if ($deviceInfo.Type -eq 1) {
            if ($targetId -eq "" -or $deviceInfo.DeviceID -eq $targetId -or $deviceInfo.Properties.Item("Name").Value -match $targetId) {
                $device = $deviceInfo.Connect()
                break
            }
        }
    }
    if ($null -eq $device) {
        throw "الماسح الضوئي المحدد غير متصل أو تم فصله."
    }
    return $device
}

# Helper to apply standard scan properties (DPI, Intent, Source)
function Apply-ScanProperties($device, $item, [int]$dpi, [string]$colorMode, [string]$source) {
    $warnings = @()
    # 6147 = Horizontal DPI, 6148 = Vertical DPI
    try {
        $item.Properties.Item("6147").Value = $dpi
        $item.Properties.Item("6148").Value = $dpi
    } catch {
        $warnings += "DPI $dpi not explicitly supported by driver. Using fallback."
    }

    # 6146 = Current Intent (1: Color, 2: Grayscale, 4: B&W)
    try {
        if ($colorMode -eq "GRAYSCALE") { $item.Properties.Item("6146").Value = 2 }
        elseif ($colorMode -eq "MONO" -or $colorMode -eq "BW") { $item.Properties.Item("6146").Value = 4 }
        else { $item.Properties.Item("6146").Value = 1 }
    } catch {
        $warnings += "ColorMode '$colorMode' not supported by driver."
    }

    # Document Handling Select: 3088 (1 = Flatbed, 2 = Feeder (ADF), 4 = Duplex)
    if ($source -ne "auto") {
        try {
            if ($source -eq "feeder") {
                $device.Properties.Item("3088").Value = 2
            } elseif ($source -eq "flatbed") {
                $device.Properties.Item("3088").Value = 1
            }
        } catch {
            $warnings += "Source '$source' (ADF/Flatbed) not supported by driver."
        }
    }

    return $warnings
}

if ($Action -eq "scan") {
    $device = Connect-TargetScanner -targetId $ScannerId
    $item = $device.Items.Item(1)
    $warnings = Apply-ScanProperties -device $device -item $item -dpi $Dpi -colorMode $ColorMode -source $Source

    # Execute transfer - Format: JPEG ({B96B3CAE-0728-11D3-9D7B-0000F81EF32E})
    $image = $item.Transfer("{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}")

    if (Test-Path $OutFile) {
        Remove-Item $OutFile -Force
    }

    $image.SaveFile($OutFile)

    @{
        success = $true
        file = $OutFile
        warnings = $warnings
        deviceUsed = $device.Properties.Item("Name").Value
    } | ConvertTo-Json -Compress
    exit 0
}

# True ADF Batch Scan
if ($Action -eq "scan-batch") {
    $device = Connect-TargetScanner -targetId $ScannerId
    
    # Check if separate Feeder item exists in device items collection
    $item = $device.Items.Item(1)
    if ($device.Items.Count -gt 1) {
        foreach ($subItem in $device.Items) {
            try {
                $flags = $subItem.Properties.Item("4120").Value
                if (($flags -band 2) -or ($flags -band 0x00000002)) {
                    $item = $subItem
                    break
                }
            } catch {}
        }
    }

    # Force Feeder source on device level: 3088 = 2
    $isFeederSupported = $false
    try {
        $device.Properties.Item("3088").Value = 2
        $isFeederSupported = $true
    } catch {
        # Fallback if driver uses flatbed default
    }

    $warnings = Apply-ScanProperties -device $device -item $item -dpi $Dpi -colorMode $ColorMode -source "feeder"

    $scannedFiles = @()
    $completedReason = "FEEDER_EMPTY"
    $maxLimit = if ($MaxPages -gt 0) { [Math]::Min($MaxPages, 100) } else { 25 }

    for ($pageIdx = 1; $pageIdx -le $maxLimit; $pageIdx++) {
        $pageOutFile = $OutPattern -replace "\{INDEX\}", $pageIdx.ToString("D3")
        try {
            # Execute single page transfer from feeder
            $image = $item.Transfer("{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}")
            if (Test-Path $pageOutFile) {
                Remove-Item $pageOutFile -Force
            }
            $image.SaveFile($pageOutFile)
            $scannedFiles += $pageOutFile

            # If device does not support ADF feeder and scanned flatbed, stop after 1 page
            if (-not $isFeederSupported -and $scannedFiles.Count -ge 1) {
                $completedReason = "SINGLE_PAGE_FLATBED"
                break
            }
        } catch {
            $msg = $_.Exception.Message
            $hres = ("0x{0:X8}" -f ($_.Exception.HResult -band 0xFFFFFFFF))
            
            # Check for WIA_ERROR_PAPER_EMPTY (0x80210003)
            if ($hres -eq "0x80210003" -or $msg -match "0x80210003" -or $msg -match "paper.*empty" -or $msg -match "feeder.*empty") {
                if ($scannedFiles.Count -eq 0) {
                    throw "ADF_EMPTY: وحدة التغذية التلقائية (ADF) فارغة. يرجى وضع الأوراق في درج التغذية للماسح."
                }
                # Normal end of feeder batch!
                $completedReason = "FEEDER_EMPTY"
                break
            } elseif ($hres -eq "0x80210002" -or $msg -match "0x80210002" -or $msg -match "paper.*jam") {
                if ($scannedFiles.Count -gt 0) {
                    $warnings += "انحشار ورق بعد مسح $($scannedFiles.Count) صفحة."
                    $completedReason = "PAPER_JAM_PARTIAL"
                    break
                }
                throw "حدث انحشار للورق في وحدة التغذية الآلية (ADF)."
            } else {
                # If we already acquired pages, preserve them
                if ($scannedFiles.Count -gt 0) {
                    $warnings += "توقف سحب وحدة التغذية: $msg"
                    $completedReason = "INTERRUPTED"
                    break
                }
                throw $_
            }
        }
    }

    if ($scannedFiles.Count -eq $maxLimit) {
        $completedReason = "MAX_PAGES_REACHED"
    }

    @{
        success = $true
        totalPages = $scannedFiles.Count
        completedReason = $completedReason
        files = $scannedFiles
        warnings = $warnings
        deviceUsed = $device.Properties.Item("Name").Value
    } | ConvertTo-Json -Compress
    exit 0
}

throw "الإجراء المطلوب غير معروف: $Action"
