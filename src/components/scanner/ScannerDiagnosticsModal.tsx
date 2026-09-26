import React, { useState, useEffect } from "react";
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Download,
  Copy,
  Check,
  Shield,
  Layers,
  Printer,
  FileText,
  AlertTriangle,
  Play,
  HelpCircle,
  Clock,
} from "lucide-react";
import { Modal } from "../common/Modal";
import { useLanguage } from "../../context/LanguageContext";
import {
  scannerService,
  BridgeHealthStatus,
  DiagnosticStepResult,
  DiagnosticReport,
} from "../../services/scannerService";
import {
  downloadHPBridgeBatchLauncher,
  getPowerShellOneLiner,
} from "../../services/hpScannerBridgeGenerator";

interface ScannerDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScannerDiagnosticsModal: React.FC<ScannerDiagnosticsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [bridgeStatus, setBridgeStatus] = useState<BridgeHealthStatus>({
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

  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [diagnosticSteps, setDiagnosticSteps] = useState<DiagnosticStepResult[]>([]);
  const [lastReport, setLastReport] = useState<DiagnosticReport | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [testScanPreview, setTestScanPreview] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      refreshStatus();
    }
  }, [isOpen]);

  const refreshStatus = async () => {
    const status = await scannerService.checkBridgeStatus(true);
    setBridgeStatus(status);
  };

  const handleRunFullDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    setTestScanPreview(null);

    try {
      const report = await scannerService.runDiagnosticSequence((updatedStep) => {
        setDiagnosticSteps((prev) => {
          const next = [...prev];
          const idx = next.findIndex((s) => s.id === updatedStep.id);
          if (idx >= 0) {
            next[idx] = updatedStep;
          } else {
            next.push(updatedStep);
          }
          return next;
        });
      });

      setLastReport(report);
      setBridgeStatus(report.bridgeStatus);
    } catch (err) {
      console.error("Diagnostic sequence error:", err);
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(getPowerShellOneLiner());
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  const renderStatusBadge = () => {
    switch (bridgeStatus.statusCode) {
      case "SCANNER_READY":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {isAr ? "الماسح الضوئي جاهز (Scanner Ready)" : "Scanner Ready"}
          </span>
        );
      case "SCANNER_BUSY":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-spin" />
            {isAr ? "الماسح مشغول بعملية أخرى (Scanner Busy)" : "Scanner Busy"}
          </span>
        );
      case "NO_SCANNER_DETECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            {isAr ? "الجسر متصل – بانتظار توصيل الماسح" : "Bridge Online – Scanner Not Detected"}
          </span>
        );
      case "WIA_UNAVAILABLE":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3.5 h-3.5" />
            {isAr ? "خطأ في خدمة WIA بنظام ويندوز" : "Windows WIA Service Unavailable"}
          </span>
        );
      case "BRIDGE_OFFLINE":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            {isAr ? "الجسر المحلي غير متصل (Bridge Offline)" : "Local Bridge Offline"}
          </span>
        );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isAr ? "مركز تشخيص جسر الماسح الضوئي (Scanner Diagnostics)" : "Scanner Bridge Diagnostics"}
    >
      <div className="space-y-5 text-slate-800" dir={isAr ? "rtl" : "ltr"}>
        {/* Header Summary Card */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Printer className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-base text-slate-900">
                {isAr ? "حالة اتصال أجهزة المسح الضوئي WIA" : "WIA Scanner Hardware Status"}
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              {isAr
                ? `طابعة HP Color LaserJet Pro MFP M282nw عبر المنفذ المحلي ${scannerService.getPort()}`
                : `Target Device: HP Color LaserJet Pro MFP M282nw on Port ${scannerService.getPort()}`}
            </p>
          </div>
          <div>{renderStatusBadge()}</div>
        </div>

        {/* Technical Specs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <span className="text-[11px] font-medium text-slate-400 block">
              {isAr ? "منفذ الجسر" : "Bridge Port"}
            </span>
            <span className="text-sm font-bold text-slate-800">
              127.0.0.1:{bridgeStatus.port}
            </span>
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <span className="text-[11px] font-medium text-slate-400 block">
              {isAr ? "إصدار الجسر" : "Bridge Version"}
            </span>
            <span className="text-sm font-bold text-slate-800">
              v{bridgeStatus.bridgeVersion}
            </span>
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <span className="text-[11px] font-medium text-slate-400 block">
              {isAr ? "دعم وحدة التغذية (ADF)" : "ADF Feeder Support"}
            </span>
            <span className={`text-sm font-bold ${bridgeStatus.adfAvailable ? "text-emerald-600" : "text-slate-500"}`}>
              {bridgeStatus.adfAvailable ? (isAr ? "جاهز ومفعل" : "Ready") : (isAr ? "غير مفعل" : "Not Detected")}
            </span>
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <span className="text-[11px] font-medium text-slate-400 block">
              {isAr ? "الجهاز المكتشف" : "Detected Scanner"}
            </span>
            <span className="text-xs font-bold text-slate-800 truncate block" title={bridgeStatus.scannerName || "None"}>
              {bridgeStatus.scannerName || (isAr ? "لا يوجد" : "None")}
            </span>
          </div>
        </div>

        {/* 5-Step Diagnostic Sequence */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              {isAr ? "تسلسل الاختبارات التشخيصية (5 خطوات)" : "Diagnostic Test Sequence (5 Steps)"}
            </h4>
            <button
              onClick={handleRunFullDiagnostics}
              disabled={isRunningDiagnostics}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${isRunningDiagnostics ? "animate-spin" : ""}`} />
              {isRunningDiagnostics
                ? (isAr ? "جاري الفحص..." : "Running Tests...")
                : (isAr ? "تشغيل الفحص الشامل" : "Run Diagnostics")}
            </button>
          </div>

          {diagnosticSteps.length === 0 && !isRunningDiagnostics && (
            <p className="text-xs text-slate-500 py-3 text-center">
              {isAr
                ? "اضغط على 'تشغيل الفحص الشامل' لاختبار الجسر وخدمة WIA والماسح الضوئي ووحدة التغذية التلقائية."
                : "Click 'Run Diagnostics' to test local bridge, WIA subsystem, scanner hardware, and feeder readiness."}
            </p>
          )}

          {diagnosticSteps.length > 0 && (
            <div className="space-y-2 pt-1">
              {diagnosticSteps.map((st) => (
                <div
                  key={st.id}
                  className={`p-2.5 rounded-lg border text-xs flex items-start justify-between gap-3 transition-colors ${
                    st.status === "PASS"
                      ? "bg-emerald-50/60 border-emerald-200 text-emerald-950"
                      : st.status === "FAIL"
                      ? "bg-rose-50/60 border-rose-200 text-rose-950"
                      : st.status === "RUNNING"
                      ? "bg-amber-50/60 border-amber-200 text-amber-950"
                      : "bg-white border-slate-200 text-slate-600"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-slate-400 mt-0.5">#{st.step}</span>
                    <div>
                      <div className="font-semibold text-slate-900">
                        {isAr ? st.titleAr : st.titleEn}
                      </div>
                      {st.details && <div className="text-[11px] text-slate-600 mt-0.5">{st.details}</div>}
                      {st.error && <div className="text-[11px] text-rose-700 font-medium mt-0.5">{st.error}</div>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {st.durationMs !== undefined && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        {st.durationMs}ms
                      </span>
                    )}
                    {st.status === "PASS" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    {st.status === "FAIL" && <XCircle className="w-4 h-4 text-rose-600" />}
                    {st.status === "RUNNING" && <RefreshCw className="w-4 h-4 text-amber-600 animate-spin" />}
                    {st.status === "SKIP" && <span className="text-[10px] text-slate-400 font-medium">{isAr ? "تخطي" : "Skip"}</span>}
                    {st.status === "PENDING" && <Clock className="w-4 h-4 text-slate-300" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Launcher & Manual Assistance Box */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              {isAr ? "أدوات التشغيل وتثبيت الجسر" : "Bridge Startup & Launcher Utilities"}
            </span>
            <button
              onClick={refreshStatus}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              {isAr ? "إعادة فحص الاتصال" : "Recheck Connection"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => downloadHPBridgeBatchLauncher()}
              className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              {isAr ? "تحميل أداة التشغيل (Start-HP-Scanner.bat)" : "Download Start-HP-Scanner.bat"}
            </button>

            <button
              onClick={handleCopyCmd}
              className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-sm transition-colors"
            >
              {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCmd ? (isAr ? "تم نسخ الأمر!" : "Copied!") : (isAr ? "نسخ أمر PowerShell المباشر" : "Copy PowerShell Command")}
            </button>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            {isAr
              ? "ملاحظة: جسر الماسح الضوئي يعمل مباشرة داخل نظام التشغيل ويندوز في بيئة المستخدم النشطة للوصول إلى أجهزة WIA. لا يتطلب أي تكوين شبكي معقد."
              : "Note: The scanner bridge runs in the active Windows user session to communicate with WIA hardware. No complex network configuration is required."}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            {isAr ? "إغلاق" : "Close"}
          </button>
        </div>
      </div>
    </Modal>
  );
};
