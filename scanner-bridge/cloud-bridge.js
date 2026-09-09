/**
 * Emirates Falcon Real Estate ERP - Scanner Cloud & Local Bridge
 * Version: 2.3.1 (Zero External Dependencies Edition)
 * 
 * Bridges physical WIA document scanners (HP Color LaserJet Pro MFP M282nw Series)
 * to BOTH:
 * 1. Local ERP (http://127.0.0.1:18622 and http://localhost:3000)
 * 2. Online Cloud ERP (Google AI Studio / Cloud Run)
 * 
 * Runs purely on Node.js built-in modules (http, fs, path, os, child_process).
 * ZERO npm install or external dependencies required!
 */

const http = require('http');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = 18622;
const BRIDGE_VERSION = '2.3.1-standalone';

process.on('uncaughtException', (err) => {
  console.warn('[Process] Caught uncaughtException:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.warn('[Process] Caught unhandledRejection:', reason && reason.message ? reason.message : reason);
});

// Config loader
let config = {
  cloudServerUrl: "https://ais-dev-kurx4d4uvxuhdqsvv4veh2-405724254259.europe-west3.run.app",
  pollingIntervalMs: 2500,
  heartbeatIntervalMs: 5000,
};

const configPath = path.join(__dirname, 'config.json');
if (fs.existsSync(configPath)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config = { ...config, ...loaded };
  } catch (e) {
    console.warn('[Config] Failed to parse config.json, using defaults.');
  }
}

// Clean cloudServerUrl without trailing slash
config.cloudServerUrl = (config.cloudServerUrl || '').replace(/\/+$/, '');

let isScannerBusy = false;
let detectedScanners = [];
let lastScannersCheck = 0;

function runPowerShell(args, timeoutMs = 70000) {
  return new Promise((resolve, reject) => {
    const psScript = path.join(__dirname, 'wia-scanner.ps1');
    const fullArgs = [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', psScript,
      ...args
    ];

    execFile('powershell.exe', fullArgs, { maxBuffer: 1024 * 1024 * 35, timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error && !stdout) {
        return reject(new Error(stderr || error.message));
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (e) {
        if (stdout && stdout.trim()) {
          resolve({ rawOutput: stdout.trim() });
        } else {
          reject(new Error(stderr || 'فشل قراءة استجابة وحدة المسح من ويندوز.'));
        }
      }
    });
  });
}

async function refreshScanners(force = false) {
  if (!force && Date.now() - lastScannersCheck < 4000 && detectedScanners.length > 0) {
    return detectedScanners;
  }
  try {
    const result = await runPowerShell(['-Action', 'list']);
    let list = [];
    if (Array.isArray(result)) {
      list = result;
    } else if (result && (result.name || result.id)) {
      list = [result];
    }
    detectedScanners = list;
    lastScannersCheck = Date.now();
    return list;
  } catch (err) {
    console.error('[ScannerBridge] Error detecting scanners:', err.message);
    detectedScanners = [];
    return [];
  }
}

async function performScanJob(params) {
  const { dpi = 300, colorMode = 'COLOR', source = 'auto' } = params || {};
  const tmpFile = path.join(os.tmpdir(), `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`);
  let result = await runPowerShell([
    '-Action', 'scan',
    '-Dpi', String(dpi),
    '-ColorMode', colorMode,
    '-Source', source,
    '-OutFile', tmpFile
  ]);

  // Automatic Flatbed fallback if ADF is empty
  if (!result.success && (result.code === 'ADF_EMPTY' || (result.error && (result.error.includes('ADF') || result.error.includes('فارغة'))))) {
    console.log('[ScannerBridge] ℹ️ وحدة التغذية (ADF) فارغة. جارٍ التحويل التلقائي للمسح من اللوح الزجاجي (Flatbed)...');
    result = await runPowerShell([
      '-Action', 'scan',
      '-Dpi', String(dpi),
      '-ColorMode', colorMode,
      '-Source', 'flatbed',
      '-OutFile', tmpFile
    ]);
  }

  if (!result.success || !fs.existsSync(tmpFile)) {
    throw new Error(result.error || 'فشلت عملية المسح من وحدة WIA');
  }

  const buf = fs.readFileSync(tmpFile);
  const base64 = `data:image/jpeg;base64,${buf.toString('base64')}`;
  try { fs.unlinkSync(tmpFile); } catch {}

  return {
    imageBase64: base64,
    mimeType: 'image/jpeg',
    fileSizeBytes: buf.length,
  };
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 100 * 1024 * 1024) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Access-Control-Request-Private-Network',
    'Access-Control-Allow-Private-Network': 'true',
  });
  res.end(payload);
}

// ----------------------------------------------------
// LOCAL HTTP SERVER (Built-in http module)
// ----------------------------------------------------
const server = http.createServer(async (req, res) => {
  // CORS & PNA Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Access-Control-Request-Private-Network',
      'Access-Control-Allow-Private-Network': 'true',
    });
    res.end();
    return;
  }

  const url = req.url ? req.url.split('?')[0] : '/';

  // 1. Health check
  if ((req.method === 'GET' || req.method === 'HEAD') && (url === '/health' || url === '/api/health' || url === '/')) {
    await refreshScanners();
    const available = detectedScanners.length > 0;
    const primary = detectedScanners[0] || null;
    return sendJson(res, 200, {
      ok: true,
      bridgeRunning: true,
      bridgeVersion: BRIDGE_VERSION,
      port: PORT,
      scannerAvailable: available,
      scannerDetected: available,
      scannerName: primary ? primary.name : null,
      scannerId: primary ? primary.id : null,
      protocol: 'WIA',
      status: available ? 'SCANNER_READY' : 'NO_SCANNER_DETECTED',
      statusCode: available ? 'SCANNER_READY' : 'NO_SCANNER_DETECTED',
      hpDetected: available && primary && /hp|laserjet/i.test(primary.name),
      devices: detectedScanners,
      scanners: detectedScanners,
    });
  }

  // 2. Scanner enumeration
  if ((req.method === 'GET' || req.method === 'HEAD') && (url === '/scanners' || url === '/api/scanners')) {
    await refreshScanners();
    return sendJson(res, 200, {
      success: true,
      count: detectedScanners.length,
      scanners: detectedScanners,
    });
  }

  // 3. Scan request
  if (req.method === 'POST' && (url === '/scan' || url === '/api/scan' || url === '/scan/batch')) {
    if (isScannerBusy) {
      return sendJson(res, 409, {
        success: false,
        error: 'الماسح الضوئي مشغول حالياً بعملية أخرى.',
      });
    }
    isScannerBusy = true;
    try {
      const body = await parseBody(req);
      const scanResult = await performScanJob(body);
      isScannerBusy = false;
      return sendJson(res, 200, {
        success: true,
        imageBase64: scanResult.imageBase64,
        mimeType: scanResult.mimeType,
        fileSizeBytes: scanResult.fileSizeBytes,
      });
    } catch (err) {
      isScannerBusy = false;
      return sendJson(res, 500, {
        success: false,
        error: err.message || 'فشلت عملية المسح الضوئي',
      });
    }
  }

  // Fallback 404
  sendJson(res, 404, { error: 'Not Found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Emirates Falcon Bridge] Local listener running on http://127.0.0.1:${PORT}`);
});

// ----------------------------------------------------
// CLOUD & LOCAL RELAY HEARTBEAT & JOB POLLING
// ----------------------------------------------------
let cloudConnected = false;

async function sendTargetHeartbeat(baseUrl) {
  if (!baseUrl) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const primary = detectedScanners[0] || null;
    const res = await fetch(`${baseUrl}/api/scanner-relay/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        scannerName: primary ? primary.name : 'HP LJ M282M285 (USB)',
        scannerId: primary ? primary.id : undefined,
        status: detectedScanners.length > 0 ? 'SCANNER_READY' : 'NO_SCANNER_DETECTED',
        devices: detectedScanners,
        isBusy: isScannerBusy,
      }),
    });
    clearTimeout(timer);
    if (res.ok && baseUrl === config.cloudServerUrl) {
      if (!cloudConnected) {
        console.log(`[Cloud Relay] ✅ متصل بنجاح مع سحابة صقر الإمارات: ${baseUrl}`);
        cloudConnected = true;
      }
    }
  } catch (err) {
    if (cloudConnected && baseUrl === config.cloudServerUrl) {
      console.warn(`[Cloud Relay] ⚠️ مؤقتاً غير متاح (${baseUrl}): ${err.message}`);
      cloudConnected = false;
    }
  }
}

async function pollTargetJobs(baseUrl) {
  if (!baseUrl || isScannerBusy) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${baseUrl}/api/scanner-relay/poll`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.hasJob && data.jobId) {
      console.log(`[Relay] 📥 استلام أمر مسح جديد من ${baseUrl} (Job ID: ${data.jobId})...`);
      isScannerBusy = true;
      try {
        const scanResult = await performScanJob(data.params);
        console.log(`[Relay] ✅ تم المسح بنجاح! جارٍ إرسال الصورة إلى المتصفح...`);
        const postController = new AbortController();
        const postTimer = setTimeout(() => postController.abort(), 35000);
        await fetch(`${baseUrl}/api/scanner-relay/result`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: postController.signal,
          body: JSON.stringify({
            jobId: data.jobId,
            success: true,
            imageBase64: scanResult.imageBase64,
            mimeType: scanResult.mimeType,
          }),
        });
        clearTimeout(postTimer);
        console.log(`[Relay] 🚀 اكتمل تسليم المستند الممسوح ضوئياً.`);
      } catch (scanErr) {
        console.error(`[Relay] ❌ خطأ في المسح:`, scanErr.message);
        try {
          const errController = new AbortController();
          const errTimer = setTimeout(() => errController.abort(), 10000);
          await fetch(`${baseUrl}/api/scanner-relay/result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: errController.signal,
            body: JSON.stringify({
              jobId: data.jobId,
              success: false,
              error: scanErr.message,
            }),
          });
          clearTimeout(errTimer);
        } catch (postErr) {
          console.warn(`[Relay] تعذر إرسال رسالة الخطأ إلى السحابة:`, postErr.message);
        }
      } finally {
        isScannerBusy = false;
      }
    }
  } catch (e) {
    // Silent polling error
  }
}

function dispatchHeartbeats() {
  if (config.cloudServerUrl) {
    sendTargetHeartbeat(config.cloudServerUrl);
  }
  // Also send heartbeat to local server on port 3000
  sendTargetHeartbeat('http://127.0.0.1:3000');
}

function dispatchPolls() {
  if (config.cloudServerUrl) {
    pollTargetJobs(config.cloudServerUrl);
  }
  // Also poll local server on port 3000
  pollTargetJobs('http://127.0.0.1:3000');
}

// ----------------------------------------------------
// START DAEMON
// ----------------------------------------------------
async function startDaemon() {
  console.log('==============================================================================');
  console.log('  صقر الإمارات للعقارات — جسر الماسح الضوئي العالمي (Universal Scanner Bridge)');
  console.log('  الإصدار: ' + BRIDGE_VERSION);
  console.log('  الهدف: طابعات وماسحات HP Color LaserJet Pro MFP M282nw وكافة أجهزة WIA');
  console.log('==============================================================================\n');

  console.log('[1/3] جارٍ فحص الماسحات المتصلة بجهاز الويندوز عبر WIA...');
  await refreshScanners();
  if (detectedScanners.length > 0) {
    console.log(`[1/3] ✅ تم اكتشاف الماسح بنجاح: ${detectedScanners[0].name}`);
  } else {
    console.warn('[1/3] ⚠️ لم يتم العثور على ماسح WIA متصل حالياً. يرجى تشغيل الطابعة وتوصيلها بالـ USB أو الشبكة.');
  }

  console.log(`[2/3] تم تشغيل المنفذ المحلي: http://127.0.0.1:${PORT}`);
  console.log(`[3/3] عنوان السحابة المرتبط: ${config.cloudServerUrl}`);
  console.log('\n>>> الجسر يعمل الآن وجاهز لاستقبال أوامر المسح من المتصفح أونلاين ومحلياً <<<\n');

  setInterval(dispatchHeartbeats, config.heartbeatIntervalMs);
  setInterval(dispatchPolls, config.pollingIntervalMs);
  dispatchHeartbeats();
}

startDaemon();
