/**
 * Emirates Falcon Real Estate ERP - Scanner Bridge Service
 * Version: 2.2.0 (Hardened WIA & ADF Batch Edition)
 *
 * Provides a local HTTP bridge (localhost:18622) allowing the web ERP to communicate
 * with physical document scanners (HP Color LaserJet Pro MFP M282nw and any WIA/TWAIN scanner)
 * via Windows Image Acquisition (WIA) COM subsystem.
 */

const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const app = express();
const PORT = 18622;
const HOST = '127.0.0.1';
const BRIDGE_VERSION = '2.2.0';
const START_TIME = Date.now();

// Scanner Busy Mutex Lock
let isScannerBusy = false;
let activeScanSession = null;

// Scanner enumeration cache (5 seconds TTL) to prevent expensive PowerShell processes on rapid polling
let cachedScanners = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5000;

// Last scan telemetry
let lastScanTelemetry = {
  timestamp: null,
  success: false,
  source: null,
  pages: 0,
  scannerName: null,
  lastError: null,
};

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Permissive CORS for localhost, 127.0.0.1, and Cloud Run / AI Studio preview origins
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like curl or local scripts)
    if (!origin) return callback(null, true);
    if (
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1') ||
      origin.includes('run.app') ||
      origin.includes('googleusercontent.com') ||
      origin.includes('aistudio')
    ) {
      return callback(null, true);
    }
    // Allow for user local ERP access
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

/**
 * Execute PowerShell script with standard parameters and timeout enforcement
 */
function runPowerShell(args, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const psScript = path.join(__dirname, 'wia-scanner.ps1');
    const fullArgs = [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', psScript,
      ...args
    ];

    execFile('powershell.exe', fullArgs, { maxBuffer: 1024 * 1024 * 25, timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error && !stdout) {
        if (error.killed) {
          return reject(new Error('انتهت مهلة استجابة الماسح الضوئي (Timeout). يرجى التحقق من اتصال الماسح وتغذيته بالطاقة.'));
        }
        return reject(new Error(stderr || error.message));
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (parseErr) {
        if (stdout && stdout.trim()) {
          resolve({ rawOutput: stdout.trim() });
        } else {
          reject(new Error(stderr || 'فشل قراءة استجابة وحدة المسح من ويندوز.'));
        }
      }
    });
  });
}

/**
 * Get available scanners with caching
 */
async function getScannerList(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedScanners && (now - cacheTimestamp < CACHE_TTL_MS)) {
    return cachedScanners;
  }

  try {
    const result = await runPowerShell(['-Action', 'list']);
    if (Array.isArray(result)) {
      cachedScanners = result;
      cacheTimestamp = now;
      return result;
    } else if (result && result.error) {
      cachedScanners = [];
      cacheTimestamp = now;
      return [];
    }
    cachedScanners = [];
    return [];
  } catch (err) {
    console.error('[ScannerBridge] Error listing scanners:', err.message);
    cachedScanners = [];
    return [];
  }
}

/**
 * Clean up temporary files safely
 */
function cleanupFile(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(`[ScannerBridge] Could not delete temp file ${filePath}:`, err.message);
  }
}

// ----------------------------------------------------
// ROUTES
// ----------------------------------------------------

/**
 * Basic Ping / Status
 */
app.get('/', (req, res) => {
  res.json({
    service: 'Emirates Falcon Scanner Bridge',
    version: BRIDGE_VERSION,
    status: isScannerBusy ? 'BUSY' : 'READY',
    uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
    isScannerBusy,
    activeScanSession,
  });
});

/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  const forceRefresh = req.query.refresh === 'true';
  const scanners = await getScannerList(forceRefresh);
  const hpScanner = scanners.find(s => s.isHP || (s.name && s.name.toLowerCase().includes('hp')));
  const primaryScanner = hpScanner || scanners[0] || null;

  let statusCode = 'NO_SCANNER_DETECTED';
  if (isScannerBusy) {
    statusCode = 'SCANNER_BUSY';
  } else if (primaryScanner) {
    statusCode = 'SCANNER_READY';
  }

  res.json({
    ok: true,
    bridgeRunning: true,
    bridgeVersion: BRIDGE_VERSION,
    port: PORT,
    uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
    isScannerBusy,
    activeScanSession,
    scannerDetected: scanners.length > 0,
    scannerCount: scanners.length,
    scannerName: primaryScanner ? primaryScanner.name : null,
    scannerId: primaryScanner ? primaryScanner.id : null,
    adfAvailable: primaryScanner ? (primaryScanner.adfSupported !== false) : false,
    status: statusCode,
    statusCode,
    hpDetected: !!hpScanner,
  });
});

/**
 * List available scanners
 */
app.get('/scanners', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const scanners = await getScannerList(forceRefresh);
    res.json({
      success: true,
      scanners,
      isScannerBusy,
      count: scanners.length,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      scanners: [],
    });
  }
});

/**
 * Deep diagnostics endpoint
 */
app.get('/diagnostics', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const scanners = await getScannerList(forceRefresh);

    let wiaStatus = { success: true, wiaAvailable: true };
    try {
      wiaStatus = await runPowerShell(['-Action', 'test-wia']);
    } catch (wErr) {
      wiaStatus = { success: false, wiaAvailable: false, error: wErr.message };
    }

    const hpScanner = scanners.find(s => s.isHP || (s.name && s.name.toLowerCase().includes('hp')));
    const primary = hpScanner || scanners[0] || null;

    let computedStatus = 'NO_SCANNER_DETECTED';
    if (!wiaStatus.wiaAvailable) {
      computedStatus = 'WIA_UNAVAILABLE';
    } else if (isScannerBusy) {
      computedStatus = 'SCANNER_BUSY';
    } else if (primary) {
      computedStatus = 'SCANNER_READY';
    }

    res.json({
      bridge: {
        running: true,
        version: BRIDGE_VERSION,
        port: PORT,
        uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
        startTime: new Date(START_TIME).toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      wia: {
        available: wiaStatus.wiaAvailable !== false,
        error: wiaStatus.error || null,
      },
      scanner: {
        detected: scanners.length > 0,
        primaryName: primary ? primary.name : null,
        primaryId: primary ? primary.id : null,
        isHP: !!hpScanner,
        adfAvailable: primary ? (primary.adfSupported !== false) : false,
        isBusy: isScannerBusy,
        status: computedStatus,
        statusCode: computedStatus,
      },
      scanners,
      telemetry: lastScanTelemetry,
    });
  } catch (err) {
    res.status(500).json({
      bridge: { running: true, version: BRIDGE_VERSION, error: err.message },
      scanners: [],
      error: err.message,
    });
  }
});

/**
 * Acquire Single Scan
 * POST /scan
 */
app.post('/scan', async (req, res) => {
  if (isScannerBusy) {
    return res.status(423).json({
      success: false,
      code: 'SCANNER_BUSY',
      error: 'الماسح الضوئي مشغول حالياً بعملية أخرى. يرجى الانتظار لحين اكتمال المسح.',
      activeScanSession,
    });
  }

  const {
    scannerId = '',
    dpi = 300,
    colorMode = 'COLOR',
    source = 'auto',
    format = 'jpeg',
  } = req.body;

  const sessionId = `scan_single_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const tempFileName = `${sessionId}.jpg`;
  const tempFilePath = path.join(os.tmpdir(), tempFileName);

  isScannerBusy = true;
  activeScanSession = {
    sessionId,
    type: 'SINGLE_SCAN',
    source,
    startedAt: Date.now(),
  };

  try {
    const psArgs = [
      '-Action', 'scan',
      '-ScannerId', scannerId,
      '-Dpi', String(dpi),
      '-ColorMode', colorMode,
      '-Source', source,
      '-OutFile', tempFilePath,
    ];

    const result = await runPowerShell(psArgs);

    if (!result.success) {
      lastScanTelemetry = {
        timestamp: new Date().toISOString(),
        success: false,
        source,
        pages: 0,
        scannerName: scannerId,
        lastError: result.error || 'WIA Scan Failed',
      };

      const statusCode = result.code === 'ADF_EMPTY' ? 400 : 500;
      return res.status(statusCode).json({
        success: false,
        code: result.code || 'WIA_SCAN_FAILED',
        error: result.error || 'فشلت عملية المسح الضوئي عبر برنامج التشغيل.',
        warnings: result.warnings || [],
      });
    }

    if (!fs.existsSync(tempFilePath)) {
      throw new Error('لم يتم العثور على ملف الصورة الناتج من الماسح الضوئي.');
    }

    const imageBuffer = fs.readFileSync(tempFilePath);
    const base64Data = imageBuffer.toString('base64');
    const mimeType = 'image/jpeg';
    const imageBase64 = `data:${mimeType};base64,${base64Data}`;

    lastScanTelemetry = {
      timestamp: new Date().toISOString(),
      success: true,
      source,
      pages: 1,
      scannerName: result.deviceUsed || scannerId,
      lastError: null,
    };

    res.json({
      success: true,
      sessionId,
      imageBase64,
      mimeType,
      fileSize: imageBuffer.length,
      warnings: result.warnings || [],
      deviceUsed: result.deviceUsed,
    });
  } catch (err) {
    lastScanTelemetry = {
      timestamp: new Date().toISOString(),
      success: false,
      source,
      pages: 0,
      scannerName: scannerId,
      lastError: err.message,
    };

    res.status(500).json({
      success: false,
      code: 'SCAN_EXECUTION_ERROR',
      error: err.message || 'حدث خطأ أثناء الاتصال بالماسح الضوئي.',
    });
  } finally {
    isScannerBusy = false;
    activeScanSession = null;
    cleanupFile(tempFilePath);
  }
});

/**
 * Acquire Batch Scan from ADF (Automatic Document Feeder)
 * POST /scan/batch
 */
app.post('/scan/batch', async (req, res) => {
  if (isScannerBusy) {
    return res.status(423).json({
      success: false,
      code: 'SCANNER_BUSY',
      error: 'الماسح الضوئي مشغول حالياً بعملية مسح أخرى. يرجى الانتظار لحين اكتمال المسح.',
      activeScanSession,
    });
  }

  const {
    scannerId = '',
    dpi = 300,
    colorMode = 'COLOR',
    source = 'feeder',
    maxPages = 25,
  } = req.body;

  const batchSessionId = `scan_batch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const tempFilePattern = path.join(os.tmpdir(), `${batchSessionId}_p{INDEX}.jpg`);

  isScannerBusy = true;
  activeScanSession = {
    sessionId: batchSessionId,
    type: 'BATCH_ADF_SCAN',
    source: 'feeder',
    maxPages,
    startedAt: Date.now(),
  };

  const createdFiles = [];

  try {
    const psArgs = [
      '-Action', 'scan-batch',
      '-ScannerId', scannerId,
      '-Dpi', String(dpi),
      '-ColorMode', colorMode,
      '-Source', 'feeder',
      '-OutPattern', tempFilePattern,
      '-MaxPages', String(maxPages),
    ];

    const result = await runPowerShell(psArgs, 180000);

    if (!result.success) {
      lastScanTelemetry = {
        timestamp: new Date().toISOString(),
        success: false,
        source: 'feeder',
        pages: 0,
        scannerName: scannerId,
        lastError: result.error || 'Batch scan failed',
      };

      return res.status(400).json({
        success: false,
        code: result.code || 'ADF_BATCH_ERROR',
        error: result.error || 'فشلت عملية المسح الضوئي لوحدة التغذية التلقائية.',
        warnings: result.warnings || [],
      });
    }

    const files = result.files || [];
    createdFiles.push(...files);

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        code: 'ADF_EMPTY',
        error: 'لم يتم سحب أي أوراق. يرجى التأكد من وضع المستندات في درج التغذية (ADF).',
      });
    }

    const pages = [];
    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        pages.push({
          sequence: i + 1,
          pageNumber: i + 1,
          mimeType: 'image/jpeg',
          imageBase64: `data:image/jpeg;base64,${buf.toString('base64')}`,
          fileSize: buf.length,
        });
      }
    }

    lastScanTelemetry = {
      timestamp: new Date().toISOString(),
      success: true,
      source: 'feeder',
      pages: pages.length,
      scannerName: result.deviceUsed || scannerId,
      lastError: null,
    };

    res.json({
      success: true,
      sessionId: batchSessionId,
      source: 'feeder',
      totalPages: pages.length,
      completedReason: result.completedReason || 'FEEDER_EMPTY',
      pages,
      warnings: result.warnings || [],
      deviceUsed: result.deviceUsed,
    });
  } catch (err) {
    lastScanTelemetry = {
      timestamp: new Date().toISOString(),
      success: false,
      source: 'feeder',
      pages: 0,
      scannerName: scannerId,
      lastError: err.message,
    };

    res.status(500).json({
      success: false,
      code: 'BATCH_EXECUTION_ERROR',
      error: err.message || 'حدث خطأ أثناء تنفيذ المسح التلقائي لدفعة الأوراق.',
    });
  } finally {
    isScannerBusy = false;
    activeScanSession = null;
    // Clean up all temporary files immediately
    for (const f of createdFiles) {
      cleanupFile(f);
    }
  }
});

// Bind exclusively to loopback 127.0.0.1
const server = app.listen(PORT, HOST, () => {
  console.log('===========================================================');
  console.log(`[Emirates Falcon Scanner Bridge v${BRIDGE_VERSION}]`);
  console.log(`Listening on http://${HOST}:${PORT}`);
  console.log(`Ready for Single & ADF Batch Scans from HP M282nw and WIA devices`);
  console.log('===========================================================');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[ScannerBridge] Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('[ScannerBridge] SIGTERM received. Terminating...');
  server.close(() => {
    process.exit(0);
  });
});
