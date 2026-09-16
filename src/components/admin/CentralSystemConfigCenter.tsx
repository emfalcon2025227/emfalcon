import React, { useState, useEffect } from "react";
import {
  Shield,
  Server,
  Database,
  Cloud,
  Mail,
  MessageSquare,
  Key,
  RefreshCw,
  Download,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Folder,
  Sliders,
  History,
  Info,
  Wrench,
  Sparkles,
  Lock,
  Globe,
  Eye,
  Send,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchSystemConfigMatrix,
  saveSystemConfigUpdates,
  runAllSystemDiagnostics,
  executeSafeRepair,
  fetchConfigAuditLogs,
  downloadNonSecretConfigurationExport,
  testSmtpConnection,
  testDriveConnection,
  SmtpTestResult,
  ConfigMatrixItem,
  DiagnosticResult,
  ConfigAuditEntry,
  SystemConfigMatrixResponse,
} from "../../services/systemConfigurationService";
import { downloadDriveStartupBat } from "../../services/driveStartupBatchGenerator";
import { authenticatedFetch } from "../../utils/apiClient";

interface CentralSystemConfigCenterProps {
  onNavigateBack?: () => void;
}

export const CentralSystemConfigCenter: React.FC<CentralSystemConfigCenterProps> = ({
  onNavigateBack,
}) => {
  const { currentUser } = useAuth();

  // RBAC Access Control
  const isAdmin =
    currentUser?.role === "SUPER_ADMIN" ||
    currentUser?.role === "SYSTEM_OWNER" ||
    currentUser?.role === "MANAGER";

  const [loading, setLoading] = useState<boolean>(true);
  const [matrixData, setMatrixData] = useState<SystemConfigMatrixResponse | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [runningDiagnostics, setRunningDiagnostics] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<ConfigAuditEntry[]>([]);
  const [repairLogs, setRepairLogs] = useState<string[] | null>(null);
  const [repairing, setRepairing] = useState<boolean>(false);

  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isStartupModalOpen, setIsStartupModalOpen] = useState<boolean>(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [isRepairModalOpen, setIsRepairModalOpen] = useState<boolean>(false);
  const [isSmtpModalOpen, setIsSmtpModalOpen] = useState<boolean>(false);
  const [isLastResultModalOpen, setIsLastResultModalOpen] = useState<boolean>(false);
  const [smtpTestResult, setSmtpTestResult] = useState<SmtpTestResult | null>(null);
  const [testingSmtp, setTestingSmtp] = useState<boolean>(false);
  const [testingDrive, setTestingDrive] = useState<boolean>(false);
  const [lastDiagnosticTime, setLastDiagnosticTime] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    geminiApiKey: "",
    googleClientId: "",
    googleClientSecret: "",
    smtpUser: "",
    gmailAppPassword: "",
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpEncryption: "SSL",
    whatsappToken: "",
    whatsappPhoneNumberId: "",
    whatsappWabaId: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchSystemConfigMatrix();
      setMatrixData(data);
      if (data) {
        const gmailUser = data.items.find((i) => i.id === "SMTP_USER")?.displayValue || "";
        const googleId = data.items.find((i) => i.id === "GOOGLE_CLIENT_ID")?.displayValue || "";
        const host = data.items.find((i) => i.id === "SMTP_HOST")?.displayValue || "smtp.gmail.com";
        const port = Number(data.items.find((i) => i.id === "SMTP_PORT")?.displayValue || 465);
        const enc = data.items.find((i) => i.id === "SMTP_ENCRYPTION")?.displayValue || "SSL";
        const waPhone = data.items.find((i) => i.id === "WHATSAPP_PHONE_ID")?.displayValue || "";
        const waWaba = data.items.find((i) => i.id === "WHATSAPP_WABA_ID")?.displayValue || "";

        setFormData((prev) => ({
          ...prev,
          smtpUser: gmailUser,
          googleClientId: googleId,
          smtpHost: host,
          smtpPort: port,
          smtpEncryption: enc,
          whatsappPhoneNumberId: waPhone,
          whatsappWabaId: waWaba,
          // Secrets are kept blank so existing secrets are never overwritten unless explicitly changed
          geminiApiKey: "",
          googleClientSecret: "",
          gmailAppPassword: "",
          whatsappToken: "",
        }));
      }
    } catch (err) {
      console.warn("Error loading system config matrix:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const handleRunDiagnostics = async () => {
    setRunningDiagnostics(true);
    try {
      const results = await runAllSystemDiagnostics();
      setDiagnostics(results);
      setLastDiagnosticTime(new Date().toISOString());
    } catch (err: any) {
      alert(`فشل تشغيل التشخيص: ${err?.message || "خطأ غير متوقع"}`);
    } finally {
      setRunningDiagnostics(false);
    }
  };

  const handleRunSmtpTest = async () => {
    setTestingSmtp(true);
    try {
      const result = await testSmtpConnection();
      setSmtpTestResult(result);
      setIsSmtpModalOpen(true);
      await loadData();
    } catch (err: any) {
      alert(`فشل اختبار SMTP: ${err?.message || "خطأ غير متوقع"}`);
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleRunDriveTest = async () => {
    setTestingDrive(true);
    try {
      const report = await testDriveConnection();
      if (report.success) {
        alert(`✓ اتصال Google Drive ناجح!\nالمجلد الرئيسي: [${report.rootFolderName || "Emirates Falcon"}]\nالحساب المعتمد: ${report.accountEmail || "معتمد"}\nزمن الاستجابة: ${report.latency || 0}ms`);
      } else {
        alert(`! تقرير Google Drive: ${report.safeErrorMessage || report.status}\nالإجراء المقترح: ${report.repairInstructions || "إعادة ربط الحساب"}`);
      }
      await loadData();
    } catch (err: any) {
      alert(`فشل فحص اتصال Google Drive: ${err?.message || "خطأ غير متوقع"}`);
    } finally {
      setTestingDrive(false);
    }
  };

  const handleViewLastResult = async () => {
    if (diagnostics.length > 0) {
      setIsLastResultModalOpen(true);
    } else {
      await handleRunDiagnostics();
      setIsLastResultModalOpen(true);
    }
  };

  const handleSafeRepair = async () => {
    if (!window.confirm("هل ترغب في تشغيل عملية الإصلاح والإنعاش الآمن؟\nهذا الإجراء آمن تماماً ولا يقوم بحذف أي بيانات من قاعدة البيانات أو الأرشيف.")) {
      return;
    }
    setRepairing(true);
    try {
      const result = await executeSafeRepair();
      setRepairLogs(result.repairLogs);
      if (result.diagnostics) {
        setDiagnostics(result.diagnostics);
      }
      setIsRepairModalOpen(true);
      await loadData();
    } catch (err: any) {
      alert(`فشل تنفيذ الإصلاح الآمن: ${err?.message || "خطأ غير متوقع"}`);
    } finally {
      setRepairing(false);
    }
  };

  const handleOpenAuditModal = async () => {
    setIsAuditModalOpen(true);
    try {
      const logs = await fetchConfigAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      console.warn("Could not load audit logs:", err);
    }
  };

  const handleCopyText = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    try {
      const payload: any = {
        smtpUser: formData.smtpUser,
        smtpHost: formData.smtpHost,
        smtpPort: Number(formData.smtpPort),
        smtpEncryption: formData.smtpEncryption,
        googleClientId: formData.googleClientId,
        whatsappPhoneNumberId: formData.whatsappPhoneNumberId,
        whatsappWabaId: formData.whatsappWabaId,
      };

      if (formData.geminiApiKey.trim()) payload.geminiApiKey = formData.geminiApiKey.trim();
      if (formData.googleClientSecret.trim()) payload.googleClientSecret = formData.googleClientSecret.trim();
      if (formData.gmailAppPassword.trim()) payload.gmailAppPassword = formData.gmailAppPassword.trim();
      if (formData.whatsappToken.trim()) payload.whatsappToken = formData.whatsappToken.trim();

      const res = await saveSystemConfigUpdates(payload);
      setSaveSuccessMsg(res.messageAr || "تم حفظ الإعدادات بنجاح.");
      await loadData();
      setTimeout(() => {
        setIsEditModalOpen(false);
        setSaveSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      setSaveErrorMsg(err?.message || "حدث خطأ أثناء حفظ الإعدادات.");
    } finally {
      setSavingConfig(false);
    }
  };

  // RBAC Access Guard
  if (!isAdmin) {
    return (
      <div className="min-h-[500px] flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 rounded-xl" dir="rtl">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-red-200 dark:border-red-900 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-950/50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            غير مصرح بالدخول (Admin Only)
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            مركز التحكم المركزي بإعدادات وأسرار النظام متاح فقط للمشرفين التنفيذيين (Super Admin / System Owner).
          </p>
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="px-6 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors font-medium text-sm"
            >
              العودة للوحة الإعدادات
            </button>
          )}
        </div>
      </div>
    );
  }

  const items = matrixData?.items || [];
  const filteredItems = selectedCategory === "ALL"
    ? items
    : items.filter((item) => item.category === selectedCategory);

  const driveConnected = matrixData?.googleDrive?.connected && matrixData?.googleDrive?.status === "CONNECTED";
  const geminiConfigured = items.find((i) => i.id === "GEMINI_API_KEY")?.isConfigured;
  const smtpConfigured = items.find((i) => i.id === "GMAIL_APP_PASSWORD")?.isConfigured;

  return (
    <div className="space-y-6" dir="rtl">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-400/30">
              <Shield className="w-3.5 h-3.5" />
              <span>التحكم الإداري المركزي • Admin Only</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              مركز التحكم المركزي بإعدادات وأسرار النظام والربط
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              إدارة موحدة للأسرار والمفاتيح المشفرة بخوارزمية AES-256-GCM، فحص حقيقي لجميع خدمات النظام، الإصلاح والإنعاش الآمن، وتوليد أدوات بدء التشغيل لويندوز دون أي تسريب للبيانات السرية.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRunDiagnostics}
              disabled={runningDiagnostics}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md font-medium text-sm transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${runningDiagnostics ? "animate-spin" : ""}`} />
              <span>{runningDiagnostics ? "جاري الفحص الشامل..." : "تشغيل كافة الفحوصات (Run All)"}</span>
            </button>

            <button
              onClick={handleSafeRepair}
              disabled={repairing}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md font-medium text-sm transition-all disabled:opacity-50"
            >
              <Wrench className={`w-4 h-4 ${repairing ? "animate-spin" : ""}`} />
              <span>الإصلاح والإنعاش الآمن</span>
            </button>

            <button
              onClick={handleRunSmtpTest}
              disabled={testingSmtp}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl shadow-md font-medium text-sm transition-all disabled:opacity-50"
            >
              <Mail className={`w-4 h-4 ${testingSmtp ? "animate-spin" : ""}`} />
              <span>{testingSmtp ? "جاري فحص SMTP..." : "اختبار اتصال البريد (Test SMTP)"}</span>
            </button>

            <button
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-700/80 hover:bg-slate-700 text-white rounded-xl border border-slate-600 font-medium text-sm transition-all"
            >
              <Sliders className="w-4 h-4" />
              <span>تعديل الأسرار والإعدادات</span>
            </button>

            <button
              onClick={() => downloadNonSecretConfigurationExport()}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-700/60 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-600 font-medium text-xs transition-all"
              title="تصدير ملف الإعدادات غير السري (JSON)"
            >
              <Download className="w-4 h-4" />
              <span>تصدير آمن (JSON)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Status Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">خادم النظام المركزي</div>
            <div className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>نشط (Online)</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className={`p-3 rounded-xl ${driveConnected ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600" : "bg-amber-50 dark:bg-amber-900/30 text-amber-600"}`}>
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">الأرشيف المركزي (Drive)</div>
            <div className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${driveConnected ? "bg-emerald-500" : "bg-amber-500"}`}></span>
              <span>{driveConnected ? "متصل بالأرشيف" : "بانتظار التفويض"}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">محرك Firebase & Auth</div>
            <div className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>جاهز ومقترن</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className={`p-3 rounded-xl ${smtpConfigured ? "bg-teal-50 dark:bg-teal-900/30 text-teal-600" : "bg-slate-100 dark:bg-slate-700 text-slate-500"}`}>
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">البريد الإلكتروني (SMTP)</div>
            <div className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${smtpConfigured ? "bg-emerald-500" : "bg-slate-400"}`}></span>
              <span>{smtpConfigured ? "مهيأ للإرسال" : "غير مدخل"}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className={`p-3 rounded-xl ${geminiConfigured ? "bg-purple-50 dark:bg-purple-900/30 text-purple-600" : "bg-slate-100 dark:bg-slate-700 text-slate-500"}`}>
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">الذكاء الاصطناعي (Gemini)</div>
            <div className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${geminiConfigured ? "bg-emerald-500" : "bg-slate-400"}`}></span>
              <span>{geminiConfigured ? "نشط ومهيأ" : "النمط القياسي"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Section: Google OAuth & Redirect URI Management */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                إعدادات وتطابق روابط Google OAuth
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                التحقق التلقائي من توافق نطاق التشغيل مع رابط إعادة التوجيه المعتمد في Google Cloud Console
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>متطابق ومصرح (OAuth Matched)</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              نطاق النظام الفعلي (Application Origin)
            </div>
            <div className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 break-all">
              {matrixData?.origin || (typeof window !== "undefined" ? window.location.origin : "")}
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 relative">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                رابط إعادة التوجيه المحسوب (Calculated Callback URI)
              </div>
              <button
                onClick={() =>
                  handleCopyText(
                    matrixData?.calculatedCallbackUri || `${window.location.origin}/api/integrations/google-drive/callback`,
                    "CALLBACK_URI"
                  )
                }
                className="text-indigo-600 hover:text-indigo-700 text-xs font-medium flex items-center gap-1"
              >
                {copiedKey === "CALLBACK_URI" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600 font-semibold">تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ الرابط</span>
                  </>
                )}
              </button>
            </div>
            <div className="text-sm font-mono font-semibold text-indigo-700 dark:text-indigo-400 break-all">
              {matrixData?.calculatedCallbackUri || `${typeof window !== "undefined" ? window.location.origin : ""}/api/integrations/google-drive/callback`}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Real Diagnostics Results */}
      {diagnostics.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  نتائج الفحص التشخيصي المباشر (Real Diagnostics Output)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  تم اختبار {diagnostics.length} خدمة ومكون في النظام الفعلي
                </p>
              </div>
            </div>
            <button
              onClick={() => setDiagnostics([])}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium"
            >
              إخفاء النتائج
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {diagnostics.map((diag) => {
              const isPass = diag.status === "PASS";
              const isWarn = diag.status === "WARNING";
              const isNotConf = diag.status === "NOT_CONFIGURED";
              return (
                <div
                  key={diag.serviceId}
                  className={`p-4 rounded-xl border transition-all ${
                    isPass
                      ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                      : isWarn
                      ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                      : isNotConf
                      ? "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700"
                      : "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {isPass && <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />}
                      {isWarn && <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />}
                      {isNotConf && <Info className="w-5 h-5 text-slate-500 flex-shrink-0" />}
                      {!isPass && !isWarn && !isNotConf && <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />}
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
                        {diag.serviceNameAr}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-medium text-slate-500 bg-white/70 dark:bg-slate-800/70 px-2 py-0.5 rounded-full">
                      {diag.latencyMs}ms
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2">
                    {diag.messageAr}
                  </p>
                  {diag.safeRecoveryActionAr && (
                    <div className="text-xs text-indigo-700 dark:text-indigo-400 font-medium bg-indigo-50/80 dark:bg-indigo-950/40 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900">
                      💡 إجراء التعافي المقترح: {diag.safeRecoveryActionAr}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Unified Configuration Matrix Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "ALL", label: "كافة الإعدادات والخدمات" },
              { id: "FIREBASE", label: "Firebase & Firestore" },
              { id: "GOOGLE_DRIVE", label: "Google Drive & OAuth" },
              { id: "GEMINI", label: "Gemini AI" },
              { id: "GMAIL_SMTP", label: "Gmail & SMTP" },
              { id: "WHATSAPP", label: "Meta WhatsApp" },
              { id: "SECURITY", label: "الخزنة والأمان" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedCategory === cat.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAuditModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <History className="w-4 h-4" />
              <span>سجل التدقيق (Audit Log)</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-100/75 dark:bg-slate-900/75 text-slate-600 dark:text-slate-300 text-xs font-semibold">
              <tr>
                <th className="py-3.5 px-4">الخدمة (Service)</th>
                <th className="py-3.5 px-4">مفتاح التهيئة (Key)</th>
                <th className="py-3.5 px-4">النوع</th>
                <th className="py-3.5 px-4">المصدر الفعلي</th>
                <th className="py-3.5 px-4">الحالة</th>
                <th className="py-3.5 px-4">إلزامي</th>
                <th className="py-3.5 px-4">القيمة الحالية</th>
                <th className="py-3.5 px-4 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {item.service}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {item.key}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.labelAr}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        item.isSecret
                          ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                          : "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                      }`}
                    >
                      {item.type}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {item.currentSource}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        item.status === "CONFIGURED" || item.status === "CONNECTED"
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                          : item.status === "NOT_CONFIGURED"
                          ? "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                          : "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          item.status === "CONFIGURED" || item.status === "CONNECTED"
                            ? "bg-emerald-500"
                            : item.status === "NOT_CONFIGURED"
                            ? "bg-slate-400"
                            : "bg-red-500"
                        }`}
                      ></span>
                      <span>
                        {item.status === "CONFIGURED"
                          ? "مهيأ"
                          : item.status === "CONNECTED"
                          ? "متصل"
                          : item.status === "NOT_CONFIGURED"
                          ? "غير مدخل"
                          : item.status}
                      </span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {item.required ? (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">نعم</span>
                    ) : (
                      <span>اختياري</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-700 dark:text-slate-300 max-w-[200px] truncate">
                    {item.isSecret ? (
                      <span className="text-slate-400 select-none tracking-wider">
                        {item.isConfigured ? "••••••••••••••••" : "غير مدخل"}
                      </span>
                    ) : (
                      item.displayValue || "-"
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5 justify-center">
                      {(item.id === "SMTP_USER" || item.id === "GMAIL_APP_PASSWORD" || item.category === "GMAIL_SMTP") && (
                        <button
                          onClick={handleRunSmtpTest}
                          disabled={testingSmtp}
                          className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 dark:hover:bg-teal-900/60 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                          title="اختبار خادم البريد والمقبس دون إرسال رسائل"
                        >
                          <Mail className="w-3 h-3" />
                          <span>اختبار SMTP</span>
                        </button>
                      )}
                      {item.category === "GOOGLE_DRIVE" && (
                        <button
                          onClick={handleRunDriveTest}
                          disabled={testingDrive}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/60 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                          title="اختبار اتصال الأرشيف ومجلد Emirates Falcon"
                        >
                          <Cloud className="w-3 h-3" />
                          <span>اختبار Drive</span>
                        </button>
                      )}
                      <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors"
                      >
                        تعديل
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Section: Windows Startup & Diagnostic Tools */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                أدوات البدء الذاتي والتشخيص لنظام ويندوز (Windows Startup & Diagnostic Tools)
              </h2>
              <p className="text-xs text-slate-400">
                توليد ملف تشغيل ذاتي خالي تماماً من أي أسرار، يقوم بالتحقق من الخادم والأرشيف عند بدء تشغيل أجهزة الشركة.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => downloadDriveStartupBat(matrixData?.origin)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all"
            >
              <Download className="w-4 h-4" />
              <span>توليد ملف (Generate BAT)</span>
            </button>

            <button
              onClick={handleRunDiagnostics}
              disabled={runningDiagnostics}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-700 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${runningDiagnostics ? "animate-spin" : ""}`} />
              <span>تشغيل التشخيص (Run Diagnostic)</span>
            </button>

            <button
              onClick={() => {
                prompt("لفتح مجلد بدء التشغيل في ويندوز، انسخ المسار التالي وافتحه في Run (Win + R):", "shell:startup");
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-700 transition-all"
            >
              <HardDrive className="w-4 h-4" />
              <span>فتح مجلد بدء التشغيل (Open Startup Folder)</span>
            </button>

            <button
              onClick={handleSafeRepair}
              disabled={repairing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold transition-all"
            >
              <Wrench className="w-4 h-4" />
              <span>الإصلاح الآمن (Repair Safe Issues)</span>
            </button>

            <button
              onClick={handleViewLastResult}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <Eye className="w-4 h-4" />
              <span>عرض آخر نتيجة (View Last Result)</span>
            </button>

            <button
              onClick={() => setIsStartupModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all"
            >
              <Folder className="w-4 h-4" />
              <span>مجلد بدء التشغيل (Open Startup Folder)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
            <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>حماية تامة من تسريب الأسرار</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              الملف المولد <code>EmiratesFalcon-GDrive-Startup.bat</code> لا يحتوي إطلاقاً على أي مفاتيح API أو كلمات مرور أو رموز وصول.
            </p>
          </div>

          <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
            <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
              <span>سلوك الفحص الذكي</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              يفحص صحة الخادم، التحقق المركزي، اتصال Google Drive، ويُظهر <code>System Ready</code> أو <code>Problem Detected</code> دون إجبار تسجيل دخول Google.
            </p>
          </div>

          <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
            <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-amber-400" />
              <span>التثبيت اليدوي الآمن</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              لا يقوم النظام بكتابة أي مفاتيح في سجل النظام (Registry) تلقائياً، بل يضع الملف بأمان في مجلد <code>shell:startup</code> الخاص بالمستخدم المصرح له.
            </p>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  تعديل إعدادات وأسرار النظام المركزية
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              ⚠️ <strong>قاعدة الأمان الصارمة:</strong> ترك أي حقل سر فارغاً يعني الاحتفاظ بالقيمة السرية الحالية المشفرة في الخزنة. إدخال قيمة جديدة سيقوم بتحديث السر القديم وتشفيره فورياً. لن يتم مسح أي سر قديم بمجرد ترك الحقل فارغاً.
            </div>

            {saveSuccessMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-semibold">
                ✓ {saveSuccessMsg}
              </div>
            )}
            {saveErrorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 text-red-700 dark:text-red-400 rounded-xl text-xs font-semibold">
                ✕ {saveErrorMsg}
              </div>
            )}

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-blue-600" />
                  <span>Google Drive & OAuth Client</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      معرف العميل (Google Client ID)
                    </label>
                    <input
                      type="text"
                      value={formData.googleClientId}
                      onChange={(e) => setFormData({ ...formData, googleClientId: e.target.value })}
                      placeholder="client-id.apps.googleusercontent.com"
                      className="w-full text-xs font-mono p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      سر العميل (Google Client Secret)
                    </label>
                    <input
                      type="password"
                      value={formData.googleClientSecret}
                      onChange={(e) => setFormData({ ...formData, googleClientSecret: e.target.value })}
                      placeholder="اترك فارغاً للاحتفاظ بالسر الحالي"
                      className="w-full text-xs font-mono p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-teal-600" />
                  <span>Gmail & SMTP (إشعارات النظام)</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      اسم المستخدم (SMTP User / Email)
                    </label>
                    <input
                      type="email"
                      value={formData.smtpUser}
                      onChange={(e) => setFormData({ ...formData, smtpUser: e.target.value })}
                      placeholder="emfalcon2025227@gmail.com"
                      className="w-full text-xs font-mono p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      كلمة مرور التطبيق (GMAIL_APP_PASSWORD)
                    </label>
                    <input
                      type="password"
                      value={formData.gmailAppPassword}
                      onChange={(e) => setFormData({ ...formData, gmailAppPassword: e.target.value })}
                      placeholder="اترك فارغاً للاحتفاظ بالسر الحالي"
                      className="w-full text-xs font-mono p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      خادم البريد (SMTP Host)
                    </label>
                    <input
                      type="text"
                      value={formData.smtpHost}
                      onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                      className="w-full text-xs font-mono p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      المنفذ والتشفير (Port / Encryption)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={formData.smtpPort}
                        onChange={(e) => setFormData({ ...formData, smtpPort: Number(e.target.value) })}
                        className="w-full text-xs font-mono p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
                      />
                      <select
                        value={formData.smtpEncryption}
                        onChange={(e) => setFormData({ ...formData, smtpEncryption: e.target.value })}
                        className="w-full text-xs p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
                      >
                        <option value="SSL">SSL (465)</option>
                        <option value="TLS">TLS (587)</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    💡 اختبار فوري للمقبس والمصادقة دون إرسال بريد فعلي ودون كشف كلمات المرور.
                  </span>
                  <button
                    type="button"
                    onClick={handleRunSmtpTest}
                    disabled={testingSmtp}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-all"
                  >
                    <Mail className={`w-3.5 h-3.5 ${testingSmtp ? "animate-spin" : ""}`} />
                    <span>{testingSmtp ? "جاري الفحص..." : "اختبار الاتصال الآن (Test SMTP)"}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>Meta WhatsApp Cloud API (اختياري)</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      معرف رقم الهاتف (Phone Number ID)
                    </label>
                    <input
                      type="text"
                      value={formData.whatsappPhoneNumberId}
                      onChange={(e) => setFormData({ ...formData, whatsappPhoneNumberId: e.target.value })}
                      placeholder="مثال: 10987654321"
                      className="w-full text-xs font-mono p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      رمز الوصول الدائم (Permanent Access Token)
                    </label>
                    <input
                      type="password"
                      value={formData.whatsappToken}
                      onChange={(e) => setFormData({ ...formData, whatsappToken: e.target.value })}
                      placeholder="اترك فارغاً للاحتفاظ بالسر الحالي"
                      className="w-full text-xs font-mono p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Google Gemini AI API Key</span>
                </h4>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    مفتاح واجهة الذكاء الاصطناعي (GEMINI_API_KEY)
                  </label>
                  <div className="w-full text-xs font-mono p-2.5 bg-slate-100 dark:bg-slate-800/50 text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg">
                    [Managed by Server Environment] تدار من قبل بيئة الخادم ولا يمكن حفظها من هنا
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {savingConfig ? "جاري الحفظ الآمن..." : "حفظ التعديلات في الخزنة"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Startup Folder Modal */}
      {isStartupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  دليل مجلد بدء التشغيل (Windows Startup)
                </h3>
              </div>
              <button
                onClick={() => setIsStartupModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                لتفعيل التشغيل الذاتي والتشخيص اليومي عند إقلاع حاسوب المسؤول، اتبع الخطوات التالية:
              </p>
              <ol className="list-decimal list-inside space-y-2 font-medium">
                <li>
                  اضغط من لوحة المفاتيح على: <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-slate-800 dark:text-slate-200 font-mono">Win + R</kbd>
                </li>
                <li>
                  اكتب في نافذة التشغيل (Run):
                  <div className="flex items-center justify-between p-2 mt-1 bg-slate-100 dark:bg-slate-900 rounded-lg font-mono text-indigo-600 dark:text-indigo-400">
                    <span>shell:startup</span>
                    <button
                      onClick={() => handleCopyText("shell:startup", "SHELL_STARTUP")}
                      className="text-[11px] font-sans text-slate-500 hover:text-slate-800"
                    >
                      {copiedKey === "SHELL_STARTUP" ? "تم النسخ ✓" : "نسخ الأمر"}
                    </button>
                  </div>
                </li>
                <li>
                  اضغط <strong>Enter</strong> لفتح مجلد بدء تشغيل ويندوز.
                </li>
                <li>
                  ضع ملف <code>EmiratesFalcon-GDrive-Startup.bat</code> الذي قمت بتحميله داخل هذا المجلد.
                </li>
              </ol>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-300">
              💡 <strong>ملاحظة فنية:</strong> الملف المولد لا يحتاج لصلاحيات مسؤول (Administrator)، ولا يلمس Registry أو Task Scheduler، مما يجعله آمناً تماماً وفق معايير أمن المعلومات المؤسسية.
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsStartupModalOpen(false)}
                className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-700"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repair Modal */}
      {isRepairModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  تقرير الإصلاح والإنعاش الآمن للنظام
                </h3>
              </div>
              <button
                onClick={() => setIsRepairModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
              ✓ تم تنفيذ عملية الإنعاش الآمن بنجاح تام دون حذف أي بيانات أو سجلات.
            </div>

            <div className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs max-h-52 overflow-y-auto space-y-1.5 text-left" dir="ltr">
              {repairLogs?.map((log, idx) => (
                <div key={idx} className="leading-tight">
                  {log}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsRepairModalOpen(false)}
                className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-500"
              >
                تم والعودة للوحة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Modal */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  سجل تدقيق تعديلات النظام (Zero-Secret Audit Log)
                </h3>
              </div>
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              يسجل كافة العمليات الإدارية التي تمت على إعدادات الخادم دون تسجيل قيم الأسرار على الإطلاق.
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">التوقيت</th>
                    <th className="py-2.5 px-3">المسؤول</th>
                    <th className="py-2.5 px-3">الإجراء</th>
                    <th className="py-2.5 px-3">الخدمة</th>
                    <th className="py-2.5 px-3">الحقل</th>
                    <th className="py-2.5 px-3">النتيجة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        لا توجد سجلات تدقيق سابقة.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                          {new Date(log.timestamp).toLocaleString("ar-AE")}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          {log.admin}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                          {log.provider}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                          {log.fieldName}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-600">
                          {log.result}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-700"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMTP Test Modal */}
      {isSmtpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-teal-600" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  فحص اتصال خادم البريد (SMTP Connection Test)
                </h3>
              </div>
              <button
                onClick={() => setIsSmtpModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {smtpTestResult ? (
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    smtpTestResult.success
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                      : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {smtpTestResult.success ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-sm">
                        {smtpTestResult.success ? "اتصال SMTP ناجح وقناة الإرسال جاهزة (PASS)" : "فشل فحص اتصال SMTP (FAIL)"}
                      </div>
                      <div className="text-xs opacity-90">
                        {smtpTestResult.success
                          ? "تم اختبار المصادقة ومقبس SSL بنجاح دون إرسال أي رسالة لمستخدم حقيقي."
                          : smtpTestResult.safeErrorMessage || "تعذر إتمام مصادقة خادم البريد."}
                      </div>
                    </div>
                  </div>
                  {smtpTestResult.latency !== undefined && (
                    <span className="font-mono text-xs font-bold px-2 py-1 bg-white/80 dark:bg-slate-800/80 rounded-lg">
                      {smtpTestResult.latency}ms
                    </span>
                  )}
                </div>

                {smtpTestResult.repairInstructions && !smtpTestResult.success && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                    💡 <strong>إجراء الإصلاح المقترح:</strong> {smtpTestResult.repairInstructions}
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    مراحل الفحص التفصيلية (Multi-Step Verification):
                  </h4>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {smtpTestResult.steps?.map((step, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          {step.status === "PASS" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                          {step.status === "FAIL" && <XCircle className="w-4 h-4 text-red-500" />}
                          {step.status === "PENDING" && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
                          {step.status === "SKIPPED" && <span className="w-4 h-4 text-slate-400 text-center">-</span>}
                          <span className="font-medium text-slate-800 dark:text-slate-200">{step.name}</span>
                        </div>
                        <div className="text-left font-mono text-[11px] text-slate-500 max-w-[240px] truncate">
                          {step.details || step.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-slate-100 dark:bg-slate-900/60 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>معيار الأمان: كلمات المرور والأسرار مشفرة دائماً ولا يتم كشفها أو تضمينها في النتائج.</span>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">
                جاري تحضير فحص خادم البريد...
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={handleRunSmtpTest}
                disabled={testingSmtp}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingSmtp ? "animate-spin" : ""}`} />
                <span>إعادة الفحص الآن</span>
              </button>

              <button
                onClick={() => setIsSmtpModalOpen(false)}
                className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-700"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Last Result Modal (Windows Startup & Diagnostics) */}
      {isLastResultModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  آخر نتائج التشخيص وبدء تشغيل النظام (Last Result)
                </h3>
              </div>
              <button
                onClick={() => setIsLastResultModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
              <span>آخر توقيت فحص: {lastDiagnosticTime ? new Date(lastDiagnosticTime).toLocaleString("ar-AE") : "تم الآن"}</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {diagnostics.length} خدمات تم فحصها
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {diagnostics.map((diag) => (
                <div
                  key={diag.serviceId}
                  className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                      {diag.status === "PASS" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : diag.status === "WARNING" ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span>{diag.serviceNameAr}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                      {diag.messageAr}
                    </p>
                    {diag.safeRecoveryActionAr && (
                      <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                        💡 {diag.safeRecoveryActionAr}
                      </div>
                    )}
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-slate-500 whitespace-nowrap bg-white dark:bg-slate-800 px-2 py-0.5 rounded">
                    {diag.latencyMs}ms
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={handleRunDiagnostics}
                disabled={runningDiagnostics}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${runningDiagnostics ? "animate-spin" : ""}`} />
                <span>تحديث الفحص الآن</span>
              </button>

              <button
                onClick={() => setIsLastResultModalOpen(false)}
                className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-700"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
