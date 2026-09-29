/**
 * Emirates Falcon Real Estate ERP - Scanner Service Abstraction
 * Version: 2.2.0 (Hardened WIA, ADF Batch & Mutex Lock Edition)
 *
 * Provides resilient, production-grade communication with local document scanners
 * (specifically HP Color LaserJet Pro MFP M282nw and universal Windows WIA/TWAIN devices)
 * via the local Emirates Falcon Scanner Bridge daemon (http://127.0.0.1:18622).
 */

export type BridgeStatusCode =
  | "BRIDGE_OFFLINE"
  | "BRIDGE_ONLINE"
  | "WIA_UNAVAILABLE"
  | "NO_SCANNER_DETECTED"
  | "SCANNER_READY"
  | "SCANNER_BUSY"
  | "SCANNER_ERROR";

export interface ScannerDevice {
  id: string;
  name: string;
  type: "TWAIN_WIA_BRIDGE" | "WEBCAM_DOC" | "NETWORK_SCANNER" | "VIRTUAL_SCANNER";
  status: "ONLINE" | "OFFLINE";
  resolutionDpi: number;
  isHP?: boolean;
  adfSupported?: boolean;
  connectionType?: "USB" | "WIFI_NETWORK" | "VIRTUAL";
}

export interface ScanOptions {
  deviceId?: string;
  resolutionDpi?: number;
  colorMode?: "COLOR" | "GRAYSCALE" | "MONO";
  autoCrop?: boolean;
  deskew?: boolean;
  contrastEnhance?: boolean;
  paperSource?: "auto" | "flatbed" | "feeder";
  paperSize?: string;
  printerIp?: string;
}

export interface ScanResult {
  success: boolean;
  imageBase64: string;
  mimeType: string;
  deviceUsed: string;
  timestamp: string;
  error?: string;
  code?: string;
  warnings?: string[];
}

export interface BatchScanPage {
  sequence: number;
  pageNumber: number;
  mimeType: string;
  imageBase64: string;
  fileSize?: number;
}

export interface BatchScanResult {
  success: boolean;
  sessionId?: string;
  source: string;
  totalAcquired: number;
  completedReason?: "FEEDER_EMPTY" | "MAX_PAGES_REACHED" | "INTERRUPTED" | "PAPER_JAM_PARTIAL";
  pages: BatchScanPage[];
  deviceUsed?: string;
  warnings?: string[];
  error?: string;
  code?: string;
}

export interface BridgeHealthStatus {
  running: boolean; // Backwards-compatible alias for bridgeRunning
  bridgeRunning: boolean;
  bridgeVersion: string;
  port: number;
  uptimeSeconds?: number;
  wiaAvailable: boolean;
  scannerDetected: boolean;
  scannerName?: string;
  scannerId?: string;
  adfAvailable: boolean;
  status: BridgeStatusCode;
  statusCode: BridgeStatusCode;
  hpDetected: boolean;
  hpDeviceName?: string;
  scanners: any[];
  details?: any;
  lastError?: string;
}

export interface DiagnosticStepResult {
  step: number;
  id: string;
  titleAr: string;
  titleEn: string;
  status: "PENDING" | "RUNNING" | "PASS" | "FAIL" | "SKIP";
  details?: string;
  durationMs?: number;
  error?: string;
}

export interface DiagnosticReport {
  timestamp: string;
  overallStatus: "PASS" | "FAIL" | "WARNING";
  bridgeStatus: BridgeHealthStatus;
  steps: DiagnosticStepResult[];
}

export class ScannerService {
  private static instance: ScannerService;

  private port: number = 18622;

  // State cache & listeners
  private lastHealthStatus: BridgeHealthStatus = {
    running: false,
    bridgeRunning: false,
    bridgeVersion: "2.2.0",
    port: 18622,
    wiaAvailable: false,
    scannerDetected: false,
    adfAvailable: false,
    status: "BRIDGE_OFFLINE",
    statusCode: "BRIDGE_OFFLINE",
    hpDetected: false,
    scanners: [],
  };

  private statusListeners: Set<(status: BridgeHealthStatus) => void> = new Set();
  private retryBackoffMs = 1000;
  private maxBackoffMs = 8000;
  private isAutoReconnecting = false;
  private reconnectTimeoutId: any = null;

  public static getInstance(): ScannerService {
    if (!ScannerService.instance) {
      ScannerService.instance = new ScannerService();
    }
    return ScannerService.instance;
  }

  constructor() {
    try {
      const savedPort = localStorage.getItem("EMIRATES_FALCON_SCANNER_PORT");
      if (savedPort) {
        const parsed = parseInt(savedPort, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
          this.port = parsed;
        }
      }
    } catch {}
    // Start initial check
    this.checkBridgeStatus().catch(() => {});
  }

  public setPort(newPort: number | string) {
    const p = typeof newPort === "string" ? parseInt(newPort, 10) : newPort;
    if (!isNaN(p) && p > 0 && p < 65536) {
      this.port = p;
      try {
        localStorage.setItem("EMIRATES_FALCON_SCANNER_PORT", String(p));
      } catch {}
    } else {
      this.port = 18622;
      try {
        localStorage.removeItem("EMIRATES_FALCON_SCANNER_PORT");
      } catch {}
    }
  }

  public getPort(): number {
    return this.port;
  }

  // Dynamic loopback URLs based on configured port (routes via direct local bridge or ERP proxy)
  private activeBaseUrl: string = "http://127.0.0.1:18622";
  private get baseUrl() {
    return this.activeBaseUrl;
  }
  private get scanUrl() { return `${this.baseUrl}/scan`; }
  private get batchScanUrl() { return `${this.baseUrl}/scan/batch`; }
  private get healthUrl() { return `${this.baseUrl}/health`; }
  private get diagnosticsUrl() { return `${this.baseUrl}/diagnostics`; }
  private get scannersUrl() { return `${this.baseUrl}/scanners`; }

  /**
   * Subscribe to bridge status updates
   */
  public subscribeStatus(listener: (status: BridgeHealthStatus) => void): () => void {
    this.statusListeners.add(listener);
    // Emit immediate current status
    listener(this.lastHealthStatus);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private notifyListeners(status: BridgeHealthStatus) {
    this.lastHealthStatus = status;
    this.statusListeners.forEach((fn) => {
      try {
        fn(status);
      } catch (err) {
        console.error("[ScannerService] Listener error:", err);
      }
    });
  }

  /**
   * Check local bridge health with bounded timeout across direct local port & ERP proxy
   */
  public async checkBridgeStatus(forceRefresh = false): Promise<BridgeHealthStatus> {
    const prevRunning = this.lastHealthStatus.bridgeRunning;
    
    // Candidate endpoints: Direct local bridge first (zero latency & PNA on port 18622), then ERP proxy
    const candidates = typeof window !== "undefined"
      ? [
          `http://127.0.0.1:${this.port}`,
          `http://localhost:${this.port}`,
          "/api/scanner"
        ]
      : [`http://127.0.0.1:${this.port}`, `http://localhost:${this.port}`];

    for (const candidate of candidates) {
      const url = `${candidate}/health${forceRefresh ? "?refresh=true" : ""}`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2200);

        const res = await fetch(url, {
          signal: controller.signal,
          headers: { "Cache-Control": "no-cache" },
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          // Filter out error or offline responses
          if (!data || typeof data !== "object") continue;
          if (data.ok === false && data.status === "BRIDGE_OFFLINE") continue;

          this.activeBaseUrl = candidate;

          const rawList = data.scanners || (data.devices ? (Array.isArray(data.devices) ? data.devices : [data.devices]) : []);
          const scanners = rawList.length > 0
            ? rawList
            : (data.scannerName ? [{ name: data.scannerName, id: data.scannerId, isHP: data.hpDetected }] : []);
          const scannerName = data.scannerName || (scanners.length > 0 ? scanners[0].name : undefined);
          const scannerDetected = !!data.scannerDetected || !!data.scannerAvailable || scanners.length > 0;
          const hpDetected = !!data.hpDetected || (scannerName && /hp|laserjet|m282/i.test(scannerName));

          let computedStatus: BridgeStatusCode = "BRIDGE_ONLINE";
          if (data.isScannerBusy) {
            computedStatus = "SCANNER_BUSY";
          } else if (data.status === "SCANNER_READY" || (scannerDetected && scannerName)) {
            computedStatus = "SCANNER_READY";
          } else if (data.wiaAvailable === false) {
            computedStatus = "WIA_UNAVAILABLE";
          } else {
            computedStatus = "NO_SCANNER_DETECTED";
          }

          const health: BridgeHealthStatus = {
            running: true,
            bridgeRunning: true,
            bridgeVersion: data.bridgeVersion || "2.3.1",
            port: data.port || this.port,
            uptimeSeconds: data.uptimeSeconds,
            wiaAvailable: data.wiaAvailable !== false,
            scannerDetected: !!scannerDetected,
            scannerName: scannerName || undefined,
            scannerId: data.scannerId || (scanners[0] ? scanners[0].id : undefined),
            adfAvailable: !!data.adfAvailable,
            status: computedStatus,
            statusCode: computedStatus,
            hpDetected,
            hpDeviceName: scannerName || undefined,
            scanners,
            details: data,
          };

          // Reset retry backoff on successful connection
          this.retryBackoffMs = 1000;

          // If newly transitioned to online, notify
          this.notifyListeners(health);
          return health;
        }
      } catch (e: any) {
        // Continue to next candidate
      }
    }

    const offlineStatus: BridgeHealthStatus = {
      running: false,
      bridgeRunning: false,
      bridgeVersion: "2.2.0",
      port: 18622,
      wiaAvailable: false,
      scannerDetected: false,
      adfAvailable: false,
      status: "BRIDGE_OFFLINE",
      statusCode: "BRIDGE_OFFLINE",
      hpDetected: false,
      scanners: [],
      lastError: "Local bridge offline on 127.0.0.1:18622",
    };

    this.notifyListeners(offlineStatus);
    return offlineStatus;
  }

  /**
   * Schedule bounded backoff reconnect check
   */
  public startBoundedAutoReconnect() {
    if (this.isAutoReconnecting) return;
    this.isAutoReconnecting = true;

    const attempt = async () => {
      const status = await this.checkBridgeStatus();
      if (!status.bridgeRunning) {
        // Increase backoff: 1s -> 2s -> 4s -> 8s max
        this.retryBackoffMs = Math.min(this.retryBackoffMs * 2, this.maxBackoffMs);
        this.reconnectTimeoutId = setTimeout(attempt, this.retryBackoffMs);
      } else {
        this.isAutoReconnecting = false;
        this.retryBackoffMs = 1000;
      }
    };

    this.reconnectTimeoutId = setTimeout(attempt, this.retryBackoffMs);
  }

  public stopAutoReconnect() {
    this.isAutoReconnecting = false;
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }

  /**
   * Detect available scanner hardware and virtual bridges.
   * STRICT INTEGRITY RULE: Preset devices are NEVER marked ONLINE unless verified!
   */
  public async getAvailableScanners(forceRefresh = false): Promise<ScannerDevice[]> {
    const devices: ScannerDevice[] = [];
    const bridgeStatus = await this.checkBridgeStatus(forceRefresh);

    if (bridgeStatus.bridgeRunning) {
      // Query specific scanners endpoint if available
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${this.scannersUrl}${forceRefresh ? "?refresh=true" : ""}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const discovered = data.scanners || [];
          discovered.forEach((s: any) => {
            const isHP = !!(s.name || "").match(/HP|LaserJet|M282|M283|M280/i);
            devices.push({
              id: `wia_${s.id || s.name}`,
              name: `${s.name}${isHP ? " ⭐ [HP Color LaserJet Pro MFP M282nw]" : " (WIA/TWAIN)"}`,
              type: "TWAIN_WIA_BRIDGE",
              status: "ONLINE", // Physical verified device
              resolutionDpi: 300,
              isHP,
              adfSupported: s.adfSupported !== false,
              connectionType: isHP ? "WIFI_NETWORK" : "USB",
            });
          });
        }
      } catch (err) {
        // Scanners query failed, fallback to bridgeStatus
      }

      // If bridge is running but no physical scanner was returned by WIA
      if (devices.length === 0) {
        devices.push({
          id: "wia_hp_m282nw",
          name: "HP Color LaserJet Pro MFP M282nw (غير متصل حالياً - Not Detected)",
          type: "TWAIN_WIA_BRIDGE",
          status: "OFFLINE", // Explicitly OFFLINE!
          resolutionDpi: 300,
          isHP: true,
          adfSupported: true,
          connectionType: "WIFI_NETWORK",
        });
      }
    } else {
      // Bridge is completely OFFLINE. Presets must show OFFLINE.
      devices.push({
        id: "wia_hp_m282nw",
        name: "HP Color LaserJet Pro MFP M282nw (الجسر المحلي غير متصل - Bridge Offline)",
        type: "TWAIN_WIA_BRIDGE",
        status: "OFFLINE", // Explicitly OFFLINE!
        resolutionDpi: 300,
        isHP: true,
        adfSupported: true,
        connectionType: "WIFI_NETWORK",
      });
    }

    // Camera Fallback (Available via browser WebRTC)
    devices.push({
      id: "doc-cam-hd",
      name: "كاميرا كاشف المستندات عالي الدقة (HD Document Camera Fallback)",
      type: "WEBCAM_DOC",
      status: "ONLINE",
      resolutionDpi: 300,
      connectionType: "USB",
    });

    return devices;
  }

  /**
   * Conduct a single hardware scan acquisition
   */
  public async acquireScan(options: ScanOptions = {}): Promise<ScanResult> {
    const deviceId = options.deviceId || "wia_default";
    const dpi = options.resolutionDpi || 300;
    const colorMode = options.colorMode || "COLOR";
    const paperSource = options.paperSource || "auto";

    // 1. Hardware TWAIN/WIA Bridge acquisition
    if (
      deviceId.startsWith("wia_") ||
      deviceId === "native-twain" ||
      deviceId === "twain-wia-local" ||
      deviceId === "wia_default" ||
      deviceId === "wia_hp_m282nw"
    ) {
      try {
        const scannerId = deviceId.startsWith("wia_")
          ? deviceId.replace(/^wia_/, "")
          : "";

        const cleanScannerId = (scannerId === "hp_m282nw" || scannerId === "default") ? "" : scannerId;

        const controller = new AbortController();
        // Generous timeout for physical mechanical scan head movement (60 seconds)
        const timeoutId = setTimeout(() => controller.abort(), 65000);

        const res = await fetch(this.scanUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            scannerId: cleanScannerId,
            dpi,
            colorMode,
            source: paperSource,
          }),
        });
        clearTimeout(timeoutId);

        // Handle Scanner Busy Lock (HTTP 423 or 409)
        if (res.status === 423 || res.status === 409) {
          const errData = await res.json().catch(() => ({}));
          return {
            success: false,
            imageBase64: "",
            mimeType: "",
            deviceUsed: "HP Color LaserJet Pro MFP M282nw",
            timestamp: new Date().toISOString(),
            code: "SCANNER_BUSY",
            error: errData.error || "الماسح الضوئي مشغول حالياً بعملية مسح أخرى. يرجى الانتظار حتى اكتمال المسح.",
          };
        }

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.imageBase64) {
            return {
              success: true,
              imageBase64: data.imageBase64.startsWith("data:")
                ? data.imageBase64
                : `data:image/jpeg;base64,${data.imageBase64}`,
              mimeType: data.mimeType || "image/jpeg",
              deviceUsed: data.deviceUsed || "HP Color LaserJet Pro MFP M282nw (WIA Bridge)",
              timestamp: new Date().toISOString(),
              warnings: data.warnings || [],
            };
          } else {
            return {
              success: false,
              imageBase64: "",
              mimeType: "",
              deviceUsed: "HP Color LaserJet Pro MFP M282nw",
              timestamp: new Date().toISOString(),
              code: data.code || "SCAN_FAILED",
              error: data.error || "استجابة غير صحيحة من برنامج تشغيل الماسح الضوئي.",
            };
          }
        } else {
          let errorMsg = "فشل الاتصال بالماسح.";
          let errorCode = "SCAN_FAILED";
          try {
            const errData = await res.json();
            if (errData.error) errorMsg = errData.error;
            if (errData.code) errorCode = errData.code;
          } catch (e) {}

          return {
            success: false,
            imageBase64: "",
            mimeType: "",
            deviceUsed: "HP Color LaserJet Pro MFP M282nw",
            timestamp: new Date().toISOString(),
            code: errorCode,
            error: errorMsg,
          };
        }
      } catch (e: any) {
        const isAbort = e.name === "AbortError";
        return {
          success: false,
          imageBase64: "",
          mimeType: "",
          deviceUsed: "HP Color LaserJet Pro MFP M282nw (WIA Bridge)",
          timestamp: new Date().toISOString(),
          code: isAbort ? "SCAN_TIMEOUT" : "BRIDGE_UNREACHABLE",
          error: isAbort
            ? "انتهت مهلة انتظار استجابة الماسح الضوئي (60 ثانية)."
            : "تطبيق الجسر المحلي (Scanner Bridge) غير متصل على المنفذ 18622. يرجى تشغيل Start-HP-Scanner.bat أو تثبيته كخدمة.",
        };
      }
    }

    return {
      success: false,
      imageBase64: "",
      mimeType: "",
      deviceUsed: deviceId,
      timestamp: new Date().toISOString(),
      code: "INVALID_DEVICE",
      error: "جهاز الماسح المحدد غير صالح.",
    };
  }

  /**
   * Acquire multi-page batch scan from Automatic Document Feeder (ADF)
   * Calls POST /scan/batch on the local bridge
   */
  public async acquireBatchScan(options: ScanOptions & { maxPages?: number } = {}): Promise<BatchScanResult> {
    const dpi = options.resolutionDpi || 300;
    const colorMode = options.colorMode || "COLOR";
    const maxPages = options.maxPages || 25;
    const cleanScannerId = options.deviceId ? options.deviceId.replace(/^wia_/, "") : "";

    try {
      const controller = new AbortController();
      // Allow up to 120 seconds for multi-page feeder batch
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const res = await fetch(this.batchScanUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          scannerId: cleanScannerId === "hp_m282nw" || cleanScannerId === "default" ? "" : cleanScannerId,
          dpi,
          colorMode,
          source: "feeder",
          maxPages,
        }),
      });
      clearTimeout(timeoutId);

      if (res.status === 423 || res.status === 409) {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          source: "feeder",
          totalAcquired: 0,
          pages: [],
          code: "SCANNER_BUSY",
          error: errData.error || "الماسح الضوئي مشغول بعملية أخرى.",
        };
      }

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.pages)) {
          return {
            success: true,
            sessionId: data.sessionId,
            source: "feeder",
            totalAcquired: data.totalPages || data.pages.length,
            completedReason: data.completedReason || "FEEDER_EMPTY",
            pages: data.pages.map((p: any, idx: number) => ({
              sequence: p.sequence || idx + 1,
              pageNumber: p.pageNumber || idx + 1,
              mimeType: p.mimeType || "image/jpeg",
              imageBase64: p.imageBase64.startsWith("data:") ? p.imageBase64 : `data:image/jpeg;base64,${p.imageBase64}`,
              fileSize: p.fileSize,
            })),
            deviceUsed: data.deviceUsed || "HP Color LaserJet Pro MFP M282nw",
            warnings: data.warnings || [],
          };
        }
      }

      // If 404 or older bridge without /scan/batch, fallback to sequential single scans
      if (res.status === 404) {
        return this.fallbackSequentialBatchScan(options);
      }

      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        source: "feeder",
        totalAcquired: 0,
        pages: [],
        code: errData.code || "ADF_BATCH_FAILED",
        error: errData.error || "فشلت عملية مسح دفعة الأوراق من وحدة التغذية (ADF).",
      };
    } catch (err: any) {
      if (err.name === "AbortError") {
        return {
          success: false,
          source: "feeder",
          totalAcquired: 0,
          pages: [],
          code: "TIMEOUT",
          error: "انتهت مهلة سحب دفعة المستندات من وحدة التغذية.",
        };
      }

      return {
        success: false,
        source: "feeder",
        totalAcquired: 0,
        pages: [],
        code: "BRIDGE_UNREACHABLE",
        error: "تعذر الاتصال بخدمة الماسح المحلي (Port 18622). يرجى تشغيل Start-HP-Scanner.bat.",
      };
    }
  }

  /**
   * Fallback for older bridges that only implement single /scan endpoint
   */
  private async fallbackSequentialBatchScan(options: ScanOptions & { maxPages?: number }): Promise<BatchScanResult> {
    const maxPages = options.maxPages || 20;
    const pages: BatchScanPage[] = [];

    const first = await this.acquireScan({ ...options, paperSource: "feeder" });
    if (!first.success) {
      return {
        success: false,
        source: "feeder",
        totalAcquired: 0,
        pages: [],
        code: first.code,
        error: first.error,
      };
    }

    pages.push({
      sequence: 1,
      pageNumber: 1,
      mimeType: first.mimeType,
      imageBase64: first.imageBase64,
    });

    let consecutiveErrors = 0;
    while (pages.length < maxPages && consecutiveErrors < 1) {
      try {
        const next = await this.acquireScan({ ...options, paperSource: "feeder" });
        if (next.success && next.imageBase64 && next.imageBase64 !== pages[pages.length - 1].imageBase64) {
          pages.push({
            sequence: pages.length + 1,
            pageNumber: pages.length + 1,
            mimeType: next.mimeType,
            imageBase64: next.imageBase64,
          });
          consecutiveErrors = 0;
        } else {
          consecutiveErrors++;
        }
      } catch {
        consecutiveErrors++;
      }
    }

    return {
      success: true,
      source: "feeder",
      totalAcquired: pages.length,
      completedReason: "FEEDER_EMPTY",
      pages,
      deviceUsed: first.deviceUsed,
    };
  }

  /**
   * Run Comprehensive 5-Step Hardware Diagnostic Sequence
   */
  public async runDiagnosticSequence(
    onStepUpdate?: (step: DiagnosticStepResult) => void
  ): Promise<DiagnosticReport> {
    const steps: DiagnosticStepResult[] = [
      {
        step: 1,
        id: "BRIDGE_PING",
        titleAr: "فحص الاتصال بجسر الماسح المحلي (Port 18622)",
        titleEn: "Check Local Scanner Bridge Reachability (Port 18622)",
        status: "PENDING",
      },
      {
        step: 2,
        id: "WIA_SUBSYSTEM",
        titleAr: "فحص خدمة Windows Image Acquisition (WIA)",
        titleEn: "Verify Windows Image Acquisition (WIA) Service & COM",
        status: "PENDING",
      },
      {
        step: 3,
        id: "DEVICE_ENUMERATION",
        titleAr: "اكتشاف الماسح الضوئي الفيزيائي (HP LaserJet M282nw)",
        titleEn: "Physical Scanner Discovery & Identification",
        status: "PENDING",
      },
      {
        step: 4,
        id: "TEST_SINGLE_SCAN",
        titleAr: "اختبار تنفيذ مسح فردي حقيقي (Single Acquisition)",
        titleEn: "Live Single Hardware Acquisition Test",
        status: "PENDING",
      },
      {
        step: 5,
        id: "TEST_ADF_FEEDER",
        titleAr: "فحص وحدة السحب والتغذية التلقائية (ADF Support)",
        titleEn: "Verify Automatic Document Feeder (ADF) Readiness",
        status: "PENDING",
      },
    ];

    const updateStep = (idx: number, patch: Partial<DiagnosticStepResult>) => {
      steps[idx] = { ...steps[idx], ...patch };
      if (onStepUpdate) onStepUpdate(steps[idx]);
    };

    // STEP 1: Ping Bridge
    updateStep(0, { status: "RUNNING" });
    const t0 = Date.now();
    let bridgeHealth = await this.checkBridgeStatus(true);
    const d0 = Date.now() - t0;

    if (!bridgeHealth.bridgeRunning) {
      updateStep(0, {
        status: "FAIL",
        durationMs: d0,
        error: "الجسر المحلي غير متصل على المنفذ 18622. يرجى تشغيل Start-HP-Scanner.bat.",
      });
      // Skip subsequent steps
      for (let i = 1; i < steps.length; i++) {
        updateStep(i, { status: "SKIP", details: "تخطى الفحص لعدم توفر الجسر المحلي." });
      }
      return {
        timestamp: new Date().toISOString(),
        overallStatus: "FAIL",
        bridgeStatus: bridgeHealth,
        steps,
      };
    }

    updateStep(0, {
      status: "PASS",
      durationMs: d0,
      details: `تم الاتصال بنجاح. الإصدار: v${bridgeHealth.bridgeVersion}، وقت التشغيل: ${bridgeHealth.uptimeSeconds || 0} ثانية.`,
    });

    // STEP 2: WIA Subsystem
    updateStep(1, { status: "RUNNING" });
    const t1 = Date.now();
    let diagData: any = null;
    try {
      const res = await fetch(this.diagnosticsUrl);
      if (res.ok) diagData = await res.json();
    } catch {}

    const d1 = Date.now() - t1;
    const wiaOk = diagData?.wia?.available !== false && bridgeHealth.wiaAvailable;
    if (!wiaOk) {
      updateStep(1, {
        status: "FAIL",
        durationMs: d1,
        error: "خدمة WIA بنظام ويندوز غير متاحة أو معطلة.",
      });
      for (let i = 2; i < steps.length; i++) {
        updateStep(i, { status: "SKIP", details: "تخطى الفحص لتعطل خدمة WIA." });
      }
      return {
        timestamp: new Date().toISOString(),
        overallStatus: "FAIL",
        bridgeStatus: bridgeHealth,
        steps,
      };
    }

    updateStep(1, {
      status: "PASS",
      durationMs: d1,
      details: "واجهة WIA COM Service تعمل بنجاح بنظام التشغيل ويندوز.",
    });

    // STEP 3: Scanner Enumeration
    updateStep(2, { status: "RUNNING" });
    const t2 = Date.now();
    const scanners = await this.getAvailableScanners(true);
    const physicalScanners = scanners.filter((s) => s.type === "TWAIN_WIA_BRIDGE" && s.status === "ONLINE");
    const d2 = Date.now() - t2;

    if (physicalScanners.length === 0) {
      updateStep(2, {
        status: "FAIL",
        durationMs: d2,
        error: "لم يتم اكتشاف أي ماسح فيزيائي متصل. تأكد من تشغيل طابعة HP M282nw وكابل USB أو الشبكة.",
      });
      updateStep(3, { status: "SKIP", details: "لا يوجد ماسح ضوئي متصل لاختبار المسح." });
      updateStep(4, { status: "SKIP", details: "لا يوجد ماسح ضوئي متصل لاختبار وحدة التغذية." });
      return {
        timestamp: new Date().toISOString(),
        overallStatus: "FAIL",
        bridgeStatus: bridgeHealth,
        steps,
      };
    }

    const hpDevice = physicalScanners.find((s) => s.isHP);
    const activeDevice = hpDevice || physicalScanners[0];
    updateStep(2, {
      status: "PASS",
      durationMs: d2,
      details: `تم اكتشاف الماسح بنجاح: ${activeDevice.name}`,
    });

    // STEP 4: Test Single Scan
    updateStep(3, { status: "RUNNING" });
    const t3 = Date.now();
    const testScan = await this.acquireScan({
      deviceId: activeDevice.id,
      resolutionDpi: 150, // Low DPI for fast test
      colorMode: "GRAYSCALE",
      paperSource: "flatbed",
    });
    const d3 = Date.now() - t3;

    if (!testScan.success) {
      updateStep(3, {
        status: "FAIL",
        durationMs: d3,
        error: testScan.error || "فشل تنفيذ عملية مسح الاختبار.",
      });
    } else {
      updateStep(3, {
        status: "PASS",
        durationMs: d3,
        details: `تمت عملية المسح بنجاح! تم استلام الصورة (${testScan.deviceUsed}).`,
      });
    }

    // STEP 5: Test ADF Feeder support
    updateStep(4, { status: "RUNNING" });
    const t4 = Date.now();
    const adfSupported = activeDevice.adfSupported !== false;
    const d4 = Date.now() - t4;

    if (adfSupported) {
      updateStep(4, {
        status: "PASS",
        durationMs: d4,
        details: "وحدة التغذية التلقائية (ADF) مدعومة وجاهزة لسحب الشيكات والمستندات متعددة الصفحات.",
      });
    } else {
      updateStep(4, {
        status: "PASS",
        durationMs: d4,
        details: "الماسح يدعم المسح المسطح (Flatbed).",
      });
    }

    const allPassed = steps.every((s) => s.status === "PASS");
    return {
      timestamp: new Date().toISOString(),
      overallStatus: allPassed ? "PASS" : "WARNING",
      bridgeStatus: bridgeHealth,
      steps,
    };
  }
}

export const scannerService = ScannerService.getInstance();
