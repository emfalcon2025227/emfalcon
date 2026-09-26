import React, { useState, useEffect, useRef } from "react";
import {
  RefreshCw,
  Check,
  AlertCircle,
  Maximize2,
  RotateCw,
  Upload,
  Download,
  Printer,
  Copy,
  CheckCircle2,
  HelpCircle,
  Zap,
  Activity,
  Layers,
  ChevronLeft,
  ChevronRight,
  Grid,
  FileText,
  Scissors,
  Shield,
} from "lucide-react";
import { Modal } from "../common/Modal";
import {
  scannerService,
  ScannerDevice,
  BridgeHealthStatus,
  BatchScanPage,
} from "../../services/scannerService";
import {
  downloadHPBridgeBatchLauncher,
  downloadHPBridgePs1Script,
  getPowerShellOneLiner,
} from "../../services/hpScannerBridgeGenerator";
import { ScannerDiagnosticsModal } from "../scanner/ScannerDiagnosticsModal";
import { useLanguage } from "../../context/LanguageContext";
import { MultiChequeSegmenter, ChequeRegion } from "../../services/ocr/multiChequeSegmenter";

export interface MultiChequeScanPayload {
  originalSourceDataUrl: string;
  cheques: ChequeRegion[];
}

export interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (imageBase64: string, mimeType: string) => void;
  onBatchScanComplete?: (pages: { imageBase64: string; mimeType: string }[]) => void;
  onMultiChequeScanComplete?: (payload: MultiChequeScanPayload) => void;
  documentType?: string;
  initialMode?: "SINGLE" | "FLATBED_MULTI_CHEQUE" | "ADF_BATCH";
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onScanComplete,
  onBatchScanComplete,
  onMultiChequeScanComplete,
  documentType,
  initialMode,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [devices, setDevices] = useState<ScannerDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  // Workflow Mode: SINGLE | FLATBED_MULTI_CHEQUE | ADF_BATCH
  const [workflowMode, setWorkflowMode] = useState<"SINGLE" | "FLATBED_MULTI_CHEQUE" | "ADF_BATCH">(
    initialMode || (documentType === "BATCH_CHEQUES" ? "FLATBED_MULTI_CHEQUE" : "SINGLE")
  );

  // Settings
  const [resolutionDpi, setResolutionDpi] = useState<number>(300);
  const [colorMode, setColorMode] = useState<"COLOR" | "GRAYSCALE" | "MONO">("COLOR");
  const [paperSource, setPaperSource] = useState<"auto" | "flatbed" | "feeder">(
    workflowMode === "ADF_BATCH" ? "feeder" : "flatbed"
  );
  const [autoCrop, setAutoCrop] = useState<boolean>(true);
  const [paperSize, setPaperSize] = useState<string>(
    workflowMode === "FLATBED_MULTI_CHEQUE" ? "A4" : documentType === "CHEQUE" ? "CHEQUE" : "A4"
  );
  const [isBatchMode, setIsBatchMode] = useState<boolean>(workflowMode !== "SINGLE");

  // State
  const [isScanning, setIsScanning] = useState(false);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [scanStatusMsg, setScanStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showBridgeHelp, setShowBridgeHelp] = useState(false);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  // Webcam fallback for visual feedback
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Results
  const [scanResult, setScanResult] = useState<{ imageBase64: string; mimeType: string } | null>(null);
  const [batchPages, setBatchPages] = useState<BatchScanPage[]>([]);
  const [selectedBatchPageIndex, setSelectedBatchPageIndex] = useState<number>(0);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Flatbed Multi-Cheque Segmentation Results
  const [segmentedCheques, setSegmentedCheques] = useState<ChequeRegion[]>([]);
  const [selectedSegmentedIndex, setSelectedSegmentedIndex] = useState<number>(0);
  const [originalFlatbedSource, setOriginalFlatbedSource] = useState<string | null>(null);

  // Live Bridge Health Status
  const [bridgeHealth, setBridgeHealth] = useState<BridgeHealthStatus>({
    running: false,
    bridgeRunning: false,
    bridgeVersion: "2.2.0",
    port: scannerService.getPort(),
    wiaAvailable: false,
    scannerDetected: false,
    adfAvailable: false,
    status: "BRIDGE_OFFLINE",
    statusCode: "BRIDGE_OFFLINE",
    hpDetected: false,
    scanners: [],
  });

  useEffect(() => {
    if (isOpen) {
      loadDevices();
      startCamera();
      setScanResult(null);
      setBatchPages([]);
      setSelectedBatchPageIndex(0);
      setSegmentedCheques([]);
      setOriginalFlatbedSource(null);
      setSelectedSegmentedIndex(0);
      setRotation(0);
      setIsFullscreen(false);
      setShowBridgeHelp(false);

      const mode = initialMode || (documentType === "BATCH_CHEQUES" ? "FLATBED_MULTI_CHEQUE" : "SINGLE");
      setWorkflowMode(mode);
      if (mode === "FLATBED_MULTI_CHEQUE") {
        setPaperSource("flatbed");
        setPaperSize("A4");
        setResolutionDpi(300);
        setColorMode("COLOR");
        setAutoCrop(false);
        setIsBatchMode(true);
      } else if (mode === "ADF_BATCH") {
        setPaperSource("feeder");
        setPaperSize("CHEQUE");
        setIsBatchMode(true);
      } else {
        setPaperSource("auto");
        setIsBatchMode(false);
      }

      // Subscribe to bridge status updates
      const unsub = scannerService.subscribeStatus((status) => {
        setBridgeHealth(status);
      });
      return () => {
        unsub();
        stopCamera();
      };
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, documentType, initialMode]);

  const loadDevices = async () => {
    const list = await scannerService.getAvailableScanners(true);
    setDevices(list);
    if (list.length > 0) {
      const activeDev = list.find((d) => d.status === "ONLINE" && d.type === "TWAIN_WIA_BRIDGE");
      setSelectedDeviceId(activeDev ? activeDev.id : list[0].id);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch {
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const handleSegmentImage = async (dataUrl: string) => {
    setIsSegmenting(true);
    try {
      const res = await MultiChequeSegmenter.segmentMultiChequeImage(dataUrl, {
        minChequesExpected: 1,
        maxChequesExpected: 4,
      });

      if (res.cheques && res.cheques.length > 0) {
        setSegmentedCheques(res.cheques);
        setSelectedSegmentedIndex(0);
        setOriginalFlatbedSource(dataUrl);
      } else {
        // Fallback to single cheque
        setSegmentedCheques([{
          id: `seg_1_${Date.now()}`,
          index: 0,
          croppedDataUrl: dataUrl,
          bounds: { x: 0, y: 0, width: 1, height: 1 },
          relativeBounds: { xPercent: 0, yPercent: 0, widthPercent: 1, heightPercent: 1 },
          confidence: 0.8,
          rotationDegrees: 0,
          width: 1200,
          height: 600,
          aspectRatio: 2,
        }]);
        setOriginalFlatbedSource(dataUrl);
      }
    } catch (segErr) {
      console.error("Multi-cheque segmentation error:", segErr);
      setSegmentedCheques([{
        id: `seg_1_${Date.now()}`,
        index: 0,
        croppedDataUrl: dataUrl,
        bounds: { x: 0, y: 0, width: 1, height: 1 },
        relativeBounds: { xPercent: 0, yPercent: 0, widthPercent: 1, heightPercent: 1 },
        confidence: 0.7,
        rotationDegrees: 0,
        width: 1200,
        height: 600,
        aspectRatio: 2,
      }]);
      setOriginalFlatbedSource(dataUrl);
    } finally {
      setIsSegmenting(false);
    }
  };

  const handleExecuteScan = async () => {
    setIsScanning(true);
    setErrorMsg(null);
    setScanResult(null);
    setBatchPages([]);
    setSegmentedCheques([]);
    setOriginalFlatbedSource(null);
    setRotation(0);

    setScanStatusMsg(
      workflowMode === "FLATBED_MULTI_CHEQUE"
        ? (isAr ? "جاري مسح السطح الزجاجي (Flatbed) واكتشاف الشيكات المتعددة..." : "Scanning Flatbed glass & segmenting cheques...")
        : workflowMode === "ADF_BATCH"
        ? (isAr ? "جاري سحب دفعة المستندات من وحدة التغذية (ADF)..." : "Scanning document batch from ADF feeder...")
        : (isAr ? "جاري إرسال أمر السحب إلى طابعة HP M282nw..." : "Sending scan command to HP M282nw Scanner...")
    );

    try {
      if (workflowMode === "ADF_BATCH") {
        // Multi-page ADF Batch Scan
        const batchRes = await scannerService.acquireBatchScan({
          deviceId: selectedDeviceId,
          resolutionDpi,
          colorMode,
          paperSource: "feeder",
          maxPages: 30,
        });

        if (batchRes.success && batchRes.pages.length > 0) {
          setBatchPages(batchRes.pages);
          setSelectedBatchPageIndex(0);
          setScanResult({
            imageBase64: batchRes.pages[0].imageBase64,
            mimeType: batchRes.pages[0].mimeType,
          });
        } else {
          throw new Error(
            batchRes.error ||
              (isAr
                ? "تعذر سحب الأوراق من وحدة التغذية (ADF). تأكد من وضع المستندات وتشغيل الجسر."
                : "Could not scan from feeder. Ensure documents are placed and bridge is running.")
          );
        }
      } else if (workflowMode === "FLATBED_MULTI_CHEQUE") {
        // Flatbed Multi-Cheque Full Scan
        const scanRes = await scannerService.acquireScan({
          deviceId: selectedDeviceId,
          resolutionDpi: 300,
          colorMode,
          autoCrop: false, // keep entire bed for segmentation
          paperSource: "flatbed",
        });

        if (scanRes.success && scanRes.imageBase64) {
          setScanResult({ imageBase64: scanRes.imageBase64, mimeType: scanRes.mimeType });
          await handleSegmentImage(scanRes.imageBase64);
        } else {
          throw new Error(
            scanRes.error ||
              (isAr
                ? "تعذر إجراء المسح من السطح الزجاجي. يرجى تشغيل أداة Start-HP-Scanner.bat."
                : "Could not scan from Flatbed glass. Please ensure bridge is active.")
          );
        }
      } else {
        // Single Scan
        const scanRes = await scannerService.acquireScan({
          deviceId: selectedDeviceId,
          resolutionDpi,
          colorMode,
          autoCrop,
          paperSource,
        });

        if (scanRes.success && scanRes.imageBase64) {
          setScanResult({ imageBase64: scanRes.imageBase64, mimeType: scanRes.mimeType });
        } else {
          throw new Error(
            scanRes.error ||
              (isAr
                ? "تعذر الاتصال بالماسح الضوئي. يرجى تشغيل أداة Start-HP-Scanner.bat."
                : "Could not connect to scanner. Please launch Start-HP-Scanner.bat.")
          );
        }
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          (isAr
            ? "تعذر الاتصال بالماسح الضوئي."
            : "Could not connect to scanner.")
      );
      if (!bridgeHealth.bridgeRunning) {
        setShowBridgeHelp(true);
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirm = () => {
    if (workflowMode === "FLATBED_MULTI_CHEQUE" && segmentedCheques.length > 0) {
      if (onMultiChequeScanComplete && originalFlatbedSource) {
        onMultiChequeScanComplete({
          originalSourceDataUrl: originalFlatbedSource,
          cheques: segmentedCheques,
        });
      } else if (onBatchScanComplete) {
        onBatchScanComplete(
          segmentedCheques.map((c) => ({
            imageBase64: c.croppedDataUrl,
            mimeType: "image/jpeg",
          }))
        );
      } else if (scanResult) {
        onScanComplete(scanResult.imageBase64, scanResult.mimeType);
      }
      onClose();
    } else if (batchPages.length > 1 && onBatchScanComplete) {
      onBatchScanComplete(batchPages.map((p) => ({ imageBase64: p.imageBase64, mimeType: p.mimeType })));
      onClose();
    } else if (scanResult) {
      onScanComplete(scanResult.imageBase64, scanResult.mimeType);
      onClose();
    }
  };

  const handleRescan = () => {
    setScanResult(null);
    setBatchPages([]);
    setSegmentedCheques([]);
    setOriginalFlatbedSource(null);
    setSelectedBatchPageIndex(0);
    setSelectedSegmentedIndex(0);
    setRotation(0);
    setErrorMsg(null);
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(getPowerShellOneLiner());
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 3000);
  };

  const renderStatusBadge = () => {
    switch (bridgeHealth.statusCode) {
      case "SCANNER_READY":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs font-mono font-bold border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {isAr ? "الماسح متصل وجاهز" : "HP Scanner Connected"}
          </span>
        );
      case "SCANNER_BUSY":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 rounded-lg text-xs font-mono font-bold border border-amber-500/30">
            <RefreshCw className="w-3 h-3 animate-spin" />
            {isAr ? "الماسح قيد الاستخدام" : "Scanner Busy"}
          </span>
        );
      case "NO_SCANNER_DETECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-300 rounded-lg text-xs font-bold border border-amber-500/30">
            <AlertCircle className="w-3.5 h-3.5" />
            {isAr ? "الجسر متصل – بانتظار الماسح" : "Bridge Online – Scanner Not Found"}
          </span>
        );
      case "WIA_UNAVAILABLE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/20 text-rose-300 rounded-lg text-xs font-bold border border-rose-500/30">
            <AlertCircle className="w-3.5 h-3.5" />
            {isAr ? "خطأ في خدمة WIA" : "WIA Unavailable"}
          </span>
        );
      case "BRIDGE_OFFLINE":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/20 text-rose-300 rounded-lg text-xs font-bold border border-rose-500/30">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            {isAr ? "الجسر المحلي غير متصل" : "Local Bridge Offline"}
          </span>
        );
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isAr ? "ماسح المستندات المباشر (HP LaserJet MFP Scanner)" : "Direct Document Scanner (HP LaserJet MFP)"}
      >
        <div
          className={`flex flex-col text-slate-800 ${
            isFullscreen
              ? "fixed inset-4 z-50 bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-4 overflow-auto"
              : "space-y-4"
          }`}
        >
          {isFullscreen && (
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold dark:text-white">
                {isAr ? "ماسح المستندات" : "Document Scanner"}
              </h2>
              <button
                onClick={() => setIsFullscreen(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm"
              >
                {isAr ? "إغلاق وضع ملء الشاشة" : "Close Fullscreen"}
              </button>
            </div>
          )}

          {/* Header & Status Bar */}
          {!isFullscreen && (
            <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between text-xs border border-slate-700/60 shadow-md gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <Printer className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-100">
                      {isAr ? "ماسح HP Color LaserJet Pro MFP M282nw" : "HP Color LaserJet Pro MFP M282nw"}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px] font-mono font-semibold">
                      WIA / ADF / Flatbed / USB / Network
                    </span>
                  </div>
                  <span className="text-slate-400 text-[11px] mt-0.5">
                    {isAr
                      ? "مسح الشيكات المتعددة من السطح الزجاجي، أو السحب الفردي، أو التغذية الآلية (ADF)"
                      : "Multi-cheque Flatbed scan, Single scan, or ADF batch feeder"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {renderStatusBadge()}

                <button
                  type="button"
                  onClick={() => setShowDiagnosticsModal(true)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5 font-semibold text-xs border border-slate-700 transition-colors"
                  title={isAr ? "فتح مركز تشخيص الاتصال" : "Open Diagnostics"}
                >
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{isAr ? "التشخيص" : "Diagnostics"}</span>
                </button>

                {!bridgeHealth.bridgeRunning && (
                  <button
                    onClick={() => setShowBridgeHelp(!showBridgeHelp)}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg flex items-center gap-1.5 font-bold text-xs border border-amber-500/30 transition-all"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    {isAr ? "تشغيل الجسر" : "Start Bridge"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Workflow Mode Tabs */}
          {!scanResult && (
            <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setWorkflowMode("FLATBED_MULTI_CHEQUE");
                  setPaperSource("flatbed");
                  setPaperSize("A4");
                  setAutoCrop(false);
                  setIsBatchMode(true);
                }}
                className={`flex-1 min-w-[180px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  workflowMode === "FLATBED_MULTI_CHEQUE"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <Grid className="w-4 h-4" />
                <span>{isAr ? "مسح متعدد (سطح زجاجي 1-4 شيكات)" : "Flatbed Multi-Cheque (1-4)"}</span>
                <span className="px-1.5 py-0.5 bg-emerald-500/30 text-emerald-200 rounded text-[10px] font-mono">
                  Auto-Crop
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setWorkflowMode("SINGLE");
                  setPaperSource("auto");
                  setPaperSize("CHEQUE");
                  setAutoCrop(true);
                  setIsBatchMode(false);
                }}
                className={`flex-1 min-w-[140px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  workflowMode === "SINGLE"
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>{isAr ? "مسح فردي (Single)" : "Single Scan"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setWorkflowMode("ADF_BATCH");
                  setPaperSource("feeder");
                  setIsBatchMode(true);
                }}
                className={`flex-1 min-w-[140px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  workflowMode === "ADF_BATCH"
                    ? "bg-purple-600 text-white shadow-md"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>{isAr ? "تغذية مستمرة (ADF Feeder)" : "Continuous ADF"}</span>
              </button>
            </div>
          )}

          {/* Bridge Helper & Download Drawer */}
          {showBridgeHelp && !scanResult && (
            <div className="bg-slate-900 border border-blue-500/40 rounded-xl p-4 text-xs text-slate-200 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <span className="font-bold text-sm text-white">
                    {isAr ? "دليل تشغيل جسر الماسح الضوئي بنقرة واحدة" : "Scanner Bridge 1-Click Launcher"}
                  </span>
                </div>
                <button
                  onClick={() => setShowBridgeHelp(false)}
                  className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded bg-slate-800"
                >
                  {isAr ? "إخفاء" : "Hide"}
                </button>
              </div>

              <p className="text-slate-300 text-xs leading-relaxed">
                {isAr
                  ? "لإرسال أوامر المسح الضوئي المباشرة من المتصفح إلى طابعتك HP Color LaserJet Pro MFP M282nw عبر WIA، قمنا بتجهيز ملف تشغيل مدمج:"
                  : "To send direct hardware scan commands from the browser to your HP M282nw scanner via WIA, run the bridge launcher:"}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                      <Download className="w-4 h-4" />
                      {isAr ? "الخيار 1: ملف التشغيل المحدث (.bat)" : "Option 1: Self-Contained Launcher (.bat)"}
                    </div>
                    <p className="text-slate-400 text-[11px] mb-2">
                      {isAr
                        ? "ملف تنفيذي مدمج لا يغلق تلقائياً ويدعم المسح الفردي ودفعة ADF والسطح الزجاجي."
                        : "All-in-one launcher supporting single scan, ADF batch, and flatbed."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadHPBridgeBatchLauncher()}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 text-xs shadow transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isAr ? "تنزيل Start-HP-Scanner.bat" : "Download Start-HP-Scanner.bat"}</span>
                  </button>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-blue-400 mb-1 flex items-center gap-1.5">
                      <Download className="w-4 h-4" />
                      {isAr ? "الخيار 2: سكريبت PowerShell (.ps1)" : "Option 2: PowerShell Script (.ps1)"}
                    </div>
                    <p className="text-slate-400 text-[11px] mb-2">
                      {isAr
                        ? "ملف سكريبت نقي: انقر عليه بزر الفأرة الأيمن واختر (Run with PowerShell)."
                        : "Run directly in PowerShell without intermediate wrapper."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadHPBridgePs1Script()}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-bold flex items-center justify-center gap-2 text-xs shadow transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isAr ? "تنزيل hp-scanner-bridge.ps1" : "Download .ps1"}</span>
                  </button>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-amber-400 mb-1 flex items-center gap-1.5">
                      <Activity className="w-4 h-4" />
                      {isAr ? "الخيار 3: مركز التشخيص المتقدم" : "Option 3: Diagnostics Center"}
                    </div>
                    <p className="text-slate-400 text-[11px] mb-2 font-mono">
                      127.0.0.1:{scannerService.getPort()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDiagnosticsModal(true)}
                      className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold flex items-center justify-center gap-1.5 text-xs transition-all cursor-pointer"
                    >
                      <Activity className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{isAr ? "بدء الفحص" : "Test"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyCommand}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold flex items-center justify-center gap-1 text-xs cursor-pointer"
                      title={isAr ? "نسخ أمر الفحص" : "Copy Command"}
                    >
                      {copiedCommand ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Settings Controls */}
          {!scanResult && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <div className="col-span-2 md:col-span-2">
                <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">
                  {isAr ? "الماسح / الطابعة المحددة" : "Selected Scanner"}
                </label>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  disabled={isScanning}
                  className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 font-medium dark:text-white text-xs"
                >
                  {devices.map((dev) => (
                    <option key={dev.id} value={dev.id}>
                      {dev.name} {dev.status === "OFFLINE" ? `(${isAr ? "غير متصل" : "Offline"})` : `(${isAr ? "متصل" : "Online"})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">
                  {isAr ? "مسار السحب" : "Paper Source"}
                </label>
                <select
                  value={paperSource}
                  onChange={(e) => {
                    const src = e.target.value as any;
                    setPaperSource(src);
                    if (src === "feeder") setWorkflowMode("ADF_BATCH");
                    else if (src === "flatbed") setWorkflowMode("FLATBED_MULTI_CHEQUE");
                  }}
                  disabled={isScanning}
                  className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 font-medium dark:text-white"
                >
                  <option value="auto">{isAr ? "تلقائي (Auto)" : "Auto"}</option>
                  <option value="flatbed">{isAr ? "السطح الزجاجي (Flatbed)" : "Flatbed"}</option>
                  <option value="feeder">{isAr ? "درج السحب (ADF)" : "ADF Feeder"}</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">
                  {isAr ? "حجم المستند" : "Doc Size"}
                </label>
                <select
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value)}
                  disabled={isScanning}
                  className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 font-medium dark:text-white"
                >
                  <option value="A4">A4 (سطح زجاجي / مستند)</option>
                  <option value="CHEQUE">{isAr ? "شيك بنكي (Cheque)" : "Cheque"}</option>
                  <option value="ID">{isAr ? "بطاقة هوية (ID)" : "ID Card"}</option>
                  <option value="AUTO">{isAr ? "تلقائي (Auto)" : "Auto"}</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">
                  {isAr ? "دقة المسح" : "DPI"}
                </label>
                <select
                  value={resolutionDpi}
                  onChange={(e) => setResolutionDpi(Number(e.target.value))}
                  disabled={isScanning}
                  className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 font-medium dark:text-white"
                >
                  <option value={300}>300 DPI (مثالي للـ OCR)</option>
                  <option value={200}>200 DPI (سريع)</option>
                  <option value={600}>600 DPI (فائق الدقة)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">
                  {isAr ? "نمط الألوان" : "Color"}
                </label>
                <select
                  value={colorMode}
                  onChange={(e) => setColorMode(e.target.value as any)}
                  disabled={isScanning}
                  className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 font-medium dark:text-white"
                >
                  <option value="COLOR">{isAr ? "ألوان (Color)" : "Color"}</option>
                  <option value="GRAYSCALE">{isAr ? "تدرج رمادي" : "Grayscale"}</option>
                  <option value="MONO">{isAr ? "أبيض وأسود" : "B&W"}</option>
                </select>
              </div>
            </div>
          )}

          {/* Live Framing & Scanning Viewport */}
          <div
            className={`relative w-full ${
              isFullscreen ? "flex-1 min-h-[60vh]" : "h-[56vh] max-h-[460px] min-h-[280px]"
            } bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 flex items-center justify-center transition-all shadow-inner`}
          >
            {/* Controls Overlay */}
            {scanResult && (
              <div className="absolute top-4 right-4 flex gap-2 z-30">
                <button
                  onClick={() => setRotation((r) => r - 90)}
                  className="bg-black/60 p-2 rounded-lg text-white hover:bg-black/80 backdrop-blur"
                  title={isAr ? "تدوير يسار" : "Rotate Left"}
                >
                  <RotateCw className="w-5 h-5 -scale-x-100" />
                </button>
                <button
                  onClick={() => setRotation((r) => r + 90)}
                  className="bg-black/60 p-2 rounded-lg text-white hover:bg-black/80 backdrop-blur"
                  title={isAr ? "تدوير يمين" : "Rotate Right"}
                >
                  <RotateCw className="w-5 h-5" />
                </button>
                {!isFullscreen && (
                  <button
                    onClick={() => setIsFullscreen(true)}
                    className="bg-black/60 p-2 rounded-lg text-white hover:bg-black/80 backdrop-blur"
                    title={isAr ? "ملء الشاشة" : "Fullscreen"}
                  >
                    <Maximize2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {!scanResult ? (
              cameraActive ? (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover opacity-60"
                />
              ) : (
                <div className="text-center p-6 text-slate-400 space-y-3">
                  <Printer className="w-14 h-14 mx-auto text-blue-500 animate-pulse" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-200">
                      {isAr
                        ? workflowMode === "FLATBED_MULTI_CHEQUE"
                          ? "جاهز للمسح المتعدد: ضع حتى 4 شيكات على السطح الزجاجي"
                          : "الماسح الضوئي HP Color LaserJet Pro جاهز للاستخدام"
                        : "HP Color LaserJet Pro MFP Scanner Ready"}
                    </p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      {isAr
                        ? workflowMode === "FLATBED_MULTI_CHEQUE"
                          ? "قم بصف الشيكات على السطح الزجاجي بشكل منظم، وسيتم قص كل شيك ومعالجته بشكل منفصل تلقائياً."
                          : "ضع الشيك أو المستند واضغط على زر بدء المسح المباشر."
                        : "Place documents on glass or feeder and click start scan."}
                    </p>
                  </div>
                </div>
              )
            ) : workflowMode === "FLATBED_MULTI_CHEQUE" && segmentedCheques.length > 0 ? (
              <div className="relative w-full h-full flex items-center justify-center p-2">
                <img
                  src={segmentedCheques[selectedSegmentedIndex]?.croppedDataUrl || scanResult.imageBase64}
                  alt="Cropped Cheque"
                  className="max-w-full max-h-full object-contain transition-transform duration-300 rounded-lg shadow-lg"
                  style={{ transform: `rotate(${rotation}deg)` }}
                />
                <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur px-3 py-1.5 rounded-lg text-white text-xs font-mono flex items-center gap-2 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    {isAr
                      ? `الشيك المقتطع ${selectedSegmentedIndex + 1} من ${segmentedCheques.length}`
                      : `Cropped Cheque ${selectedSegmentedIndex + 1} of ${segmentedCheques.length}`}
                  </span>
                  <span className="text-emerald-300 text-[10px]">
                    ({Math.round((segmentedCheques[selectedSegmentedIndex]?.confidence || 0.9) * 100)}% Match)
                  </span>
                </div>
              </div>
            ) : (
              <img
                src={
                  batchPages.length > 0
                    ? batchPages[selectedBatchPageIndex]?.imageBase64 || scanResult.imageBase64
                    : scanResult.imageBase64
                }
                alt="Scanned Document"
                className="w-full h-full object-contain transition-transform duration-300"
                style={{ transform: `rotate(${rotation}deg)` }}
              />
            )}

            {/* Dynamic Framing Guide Box based on Paper Size */}
            {!scanResult && !isScanning && (
              <div
                className={`absolute ${
                  paperSize === "A4"
                    ? "inset-y-4 inset-x-12"
                    : paperSize === "ID"
                    ? "inset-y-24 inset-x-20"
                    : "inset-y-16 inset-x-8"
                } border-2 border-dashed border-blue-400/70 rounded-xl pointer-events-none flex flex-col justify-between p-3 transition-all duration-500`}
              >
                <div className="flex justify-between items-center text-[10px] text-blue-300 font-mono bg-slate-950/70 px-2 py-0.5 rounded backdrop-blur">
                  <span>HP M282nw • {paperSize} BOUNDARY</span>
                  <span>
                    {resolutionDpi} DPI • {paperSource.toUpperCase()}
                  </span>
                </div>
                <div className="text-center text-[11px] text-blue-200 font-bold bg-slate-950/70 px-3 py-1 rounded backdrop-blur self-center">
                  {isAr
                    ? workflowMode === "FLATBED_MULTI_CHEQUE"
                      ? "نطاق السطح الزجاجي A4 (اكتشاف حتى 4 شيكات)"
                      : "منطقة المسح الضوئي المباشر"
                    : "Direct Hardware Scan Framing"}
                </div>
                <div className="text-right text-[10px] text-blue-300 font-mono bg-slate-950/70 px-2 py-0.5 rounded backdrop-blur self-end">
                  HP LASERJET ENGINE
                </div>
              </div>
            )}

            {/* Scanning Overlay State */}
            {(isScanning || isSegmenting) && (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20 space-y-4">
                <div className="relative">
                  <Printer className="w-12 h-12 text-blue-400 animate-bounce" />
                  <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin absolute -bottom-1 -right-1" />
                </div>
                <p className="font-bold text-sm text-blue-300">
                  {isSegmenting ? (isAr ? "جاري قص الشيكات هندسياً وعزل كل شيك..." : "Auto-cropping cheques from flatbed scan...") : scanStatusMsg}
                </p>
                <div className="w-56 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 animate-pulse w-full"></div>
                </div>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          {/* Flatbed Multi-Cheque Thumbnails Bar */}
          {workflowMode === "FLATBED_MULTI_CHEQUE" && segmentedCheques.length > 0 && (
            <div className="p-3 bg-slate-900 rounded-xl border border-indigo-500/40 text-white space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-100">
                    {isAr
                      ? `تم اكتشاف وقص ${segmentedCheques.length} شيكات من المسح الزجاجي:`
                      : `Detected & Segmented ${segmentedCheques.length} Cheques:`}
                  </span>
                </div>
                <span className="text-[11px] text-indigo-300 font-mono">
                  {isAr ? "انقر على الشيك لمعاينته" : "Click to inspect"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {segmentedCheques.map((chq, idx) => (
                  <div
                    key={chq.id || idx}
                    onClick={() => setSelectedSegmentedIndex(idx)}
                    className={`relative p-1.5 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedSegmentedIndex === idx
                        ? "border-emerald-400 bg-emerald-950/40 shadow-md"
                        : "border-slate-800 bg-slate-950 hover:border-slate-600"
                    }`}
                  >
                    <img
                      src={chq.croppedDataUrl}
                      alt={`Cheque ${idx + 1}`}
                      className="w-full h-16 object-cover rounded bg-black"
                    />
                    <div className="flex items-center justify-between mt-1 px-1">
                      <span className="text-[10px] font-bold text-slate-200">
                        #{idx + 1}
                      </span>
                      <span className="text-[9px] font-mono text-emerald-400">
                        {Math.round(chq.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Multi-page ADF Batch Carousel / Selector */}
          {batchPages.length > 1 && workflowMode !== "FLATBED_MULTI_CHEQUE" && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800 dark:text-white">
                  {isAr
                    ? `دفعة مسح ADF: تم سحب ${batchPages.length} صفحات / شيكات`
                    : `ADF Batch: ${batchPages.length} pages scanned`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={selectedBatchPageIndex === 0}
                  onClick={() => setSelectedBatchPageIndex((p) => Math.max(0, p - 1))}
                  className="p-1 rounded bg-white dark:bg-slate-700 border border-slate-300 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  {selectedBatchPageIndex + 1} / {batchPages.length}
                </span>
                <button
                  type="button"
                  disabled={selectedBatchPageIndex === batchPages.length - 1}
                  onClick={() => setSelectedBatchPageIndex((p) => Math.min(batchPages.length - 1, p + 1))}
                  className="p-1 rounded bg-white dark:bg-slate-700 border border-slate-300 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Quality indicator / Info */}
          {scanResult && !errorMsg && (
            <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 p-2.5 rounded-xl text-xs flex justify-between items-center px-4 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="font-bold">
                  {isAr
                    ? workflowMode === "FLATBED_MULTI_CHEQUE"
                      ? `تم مسح السطح الزجاجي واقتصاص ${segmentedCheques.length} شيكات بنجاح`
                      : `تم مسح المستند بنجاح بدقة عالية (${batchPages.length > 0 ? `${batchPages.length} صفحات` : "صفحة واحدة"})`
                    : `Document scanned successfully in high quality (${batchPages.length > 0 ? `${batchPages.length} pages` : "1 page"})`}
                </span>
              </div>
              <span className="font-mono text-[10px] opacity-80">
                HP M282nw • {resolutionDpi} DPI • {colorMode}
              </span>
            </div>
          )}

          {/* Error Notification */}
          {errorMsg && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 rounded-xl text-xs flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold mb-0.5">
                    {isAr ? "تنبيه اتصال الماسح الضوئي" : "Scanner Connection Notice"}
                  </p>
                  <p>{errorMsg}</p>
                </div>
              </div>
              {!showBridgeHelp && (
                <button
                  type="button"
                  onClick={() => setShowBridgeHelp(true)}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shrink-0"
                >
                  {isAr ? "طريقة الحل" : "Troubleshoot"}
                </button>
              )}
            </div>
          )}

          {/* Action Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isScanning || isSegmenting}
                className="px-4 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-all"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>

              <button
                type="button"
                onClick={() => setShowBridgeHelp(!showBridgeHelp)}
                className="px-3 py-2.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <HelpCircle className="w-4 h-4" />
                <span>{isAr ? "أداة HP Bridge" : "HP Bridge Tool"}</span>
              </button>
            </div>

            <div className="flex gap-2">
              {!scanResult ? (
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    id="scanner-upload-fallback"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                          const dataUrl = event.target?.result as string;
                          setScanResult({
                            imageBase64: dataUrl,
                            mimeType: file.type,
                          });
                          setErrorMsg(null);
                          if (workflowMode === "FLATBED_MULTI_CHEQUE") {
                            await handleSegmentImage(dataUrl);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <label
                    htmlFor="scanner-upload-fallback"
                    className="px-4 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{isAr ? "رفع ملف يدوي" : "Upload File"}</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleExecuteScan}
                    disabled={isScanning || isSegmenting}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isScanning || isSegmenting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{isSegmenting ? (isAr ? "جاري القص والتجزئة..." : "Segmenting...") : (isAr ? "جاري سحب المستند..." : "Scanning HP Hardware...")}</span>
                      </>
                    ) : (
                      <>
                        <Printer className="w-4 h-4" />
                        <span>
                          {workflowMode === "FLATBED_MULTI_CHEQUE"
                            ? isAr
                              ? "بدء مسح السطح الزجاجي (Multi-Cheque)"
                              : "Scan Flatbed (Multi-Cheque)"
                            : workflowMode === "ADF_BATCH"
                            ? isAr
                              ? "بدء سحب الدفعة (ADF Batch)"
                              : "Start ADF Batch Scan"
                            : isAr
                            ? "بدء المسح المباشر من HP"
                            : "Start Direct HP Scan"}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleRescan}
                    className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>{isAr ? "إعادة المسح" : "Rescan"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {workflowMode === "FLATBED_MULTI_CHEQUE" && segmentedCheques.length > 0
                        ? isAr
                          ? `اعتماد الشيكات المقتطعة (${segmentedCheques.length})`
                          : `Confirm Cropped Cheques (${segmentedCheques.length})`
                        : batchPages.length > 1
                        ? isAr
                          ? `اعتماد دفعة الشيكات (${batchPages.length})`
                          : `Confirm Batch (${batchPages.length})`
                        : isAr
                        ? "اعتماد المستند الممسوح"
                        : "Confirm Document"}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Embedded Scanner Diagnostics Modal */}
      <ScannerDiagnosticsModal
        isOpen={showDiagnosticsModal}
        onClose={() => {
          setShowDiagnosticsModal(false);
          loadDevices();
        }}
      />
    </>
  );
};

export const DocumentScannerModal = ScannerModal;
