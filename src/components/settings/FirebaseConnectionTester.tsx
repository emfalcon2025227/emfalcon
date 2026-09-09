import React, { useState, useEffect, useMemo } from "react";
import { 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Wifi, 
  WifiOff, 
  Server, 
  Activity, 
  ShieldCheck, 
  Zap,
  HardDrive,
  PieChart,
  Layers,
  ArrowUpRight,
  Sparkles,
  FileText,
  AlertTriangle,
  Folder,
  TrendingUp
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { db } from "../../lib/firebase";
import { doc, getDocFromServer, enableNetwork } from "firebase/firestore";
import firebaseConfig from "../../../firebase-applet-config.json";

// Total Spark Plan (Free/Enterprise Tier) Storage Capacity: 1 GiB = 1,024 MB
const TOTAL_PLAN_BYTES = 1024 * 1024 * 1024; // 1,073,741,824 bytes (1 GiB)
const DAILY_READ_QUOTA = 50000;
const DAILY_WRITE_QUOTA = 20000;
const DAILY_DELETE_QUOTA = 20000;
const MONTHLY_EGRESS_GB = 10;

export const FirebaseConnectionTester: React.FC = () => {
  const { language } = useLanguage();
  const [status, setStatus] = useState<"CONNECTED" | "DISCONNECTED" | "CHECKING">("CHECKING");
  const [latency, setLatency] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAutoReconnecting, setIsAutoReconnecting] = useState<boolean>(false);
  const [testLog, setTestLog] = useState<string[]>([]);
  const [isCalculatingStorage, setIsCalculatingStorage] = useState<boolean>(false);

  // Consume live database collections from DataContext
  const {
    owners,
    properties,
    units,
    tenants,
    leases,
    cheques,
    collections,
    cases,
    maintenanceRequests,
    technicians,
    archive,
    notifications,
    auditLogs,
    historicalRecords,
    commissions,
    paymentAllocations,
    financialReversals,
    financialAdjustments,
    ownerTransfers,
    propertyExpenses,
    collectionActions,
    paymentPromises,
    chartOfAccounts,
    dailyDeposits,
    isQuotaExceeded,
  } = useData();

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestLog(prev => [`[${timestamp}] ${msg}`, ...prev.slice(0, 24)]);
  };

  // Helper to format bytes cleanly into KB, MB, GB
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return language === "ar" ? "0 بايت" : "0 Bytes";
    const k = 1024;
    const sizes = language === "ar" 
      ? ["بايت", "كيلوبايت (KB)", "ميجابايت (MB)", "جيجابايت (GB)"] 
      : ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
    return `${val.toLocaleString()} ${sizes[i]}`;
  };

  // Helper to compute UTF-8 size of documents with Firestore indexing overhead (~48 bytes per doc)
  const computeSize = (items: any[]) => {
    if (!items || !items.length) return 0;
    try {
      const json = JSON.stringify(items);
      const utf8Bytes = new TextEncoder().encode(json).length;
      return utf8Bytes + items.length * 48;
    } catch {
      return items.length * 1024;
    }
  };

  // Detailed storage breakdown
  const storageBreakdown = useMemo(() => {
    // 1. Master records
    const masterItems = [...(owners || []), ...(properties || []), ...(units || []), ...(tenants || [])];
    const masterBytes = computeSize(masterItems);

    // 2. Contracts, Cheques & Financial collections
    const leasingFinancialItems = [
      ...(leases || []),
      ...(cheques || []),
      ...(collections || []),
      ...(paymentAllocations || []),
      ...(commissions || []),
      ...(financialReversals || []),
      ...(financialAdjustments || []),
      ...(ownerTransfers || []),
      ...(propertyExpenses || []),
      ...(collectionActions || []),
      ...(paymentPromises || [])
    ];
    const leasingFinancialBytes = computeSize(leasingFinancialItems);

    // 3. Accounting & Journals
    const accountingItems = [...(chartOfAccounts || []), ...(dailyDeposits || [])];
    const accountingBytes = computeSize(accountingItems);

    // 4. Maintenance & Operations
    const operationsItems = [...(maintenanceRequests || []), ...(technicians || []), ...(cases || [])];
    const operationsBytes = computeSize(operationsItems);

    // 5. System Logs & History
    const systemLogsItems = [...(auditLogs || []), ...(notifications || []), ...(historicalRecords || [])];
    const systemLogsBytes = computeSize(systemLogsItems);

    // 6. Electronic Archive & Uploaded Files
    let archiveFileBytes = 0;
    const archiveDocsBytes = computeSize(archive || []);
    if (archive && archive.length > 0) {
      archive.forEach(item => {
        if (typeof item.fileSize === "number" && item.fileSize > 0) {
          archiveFileBytes += item.fileSize;
        } else if ((item as any).dataUrl) {
          archiveFileBytes += Math.round(((item as any).dataUrl.length * 3) / 4);
        }
      });
    }
    const totalArchiveBytes = archiveDocsBytes + archiveFileBytes;

    // Total stored database bytes
    const totalUsedBytes = masterBytes + leasingFinancialBytes + accountingBytes + operationsBytes + systemLogsBytes + totalArchiveBytes;
    const remainingBytes = Math.max(0, TOTAL_PLAN_BYTES - totalUsedBytes);
    const usedPercentage = Math.min(100, (totalUsedBytes / TOTAL_PLAN_BYTES) * 100);
    const remainingPercentage = Math.max(0, 100 - usedPercentage);

    const totalDocsCount = 
      masterItems.length + 
      leasingFinancialItems.length + 
      accountingItems.length + 
      operationsItems.length + 
      systemLogsItems.length + 
      (archive?.length || 0);

    return {
      totalUsedBytes,
      remainingBytes,
      usedPercentage,
      remainingPercentage,
      totalDocsCount,
      categories: [
        {
          id: "master",
          name: language === "ar" ? "العقارات، الوحدات، الملاك والمستأجرين" : "Properties, Units, Owners & Tenants",
          count: masterItems.length,
          bytes: masterBytes,
          color: "bg-blue-500",
          textColor: "text-blue-700",
          bgColor: "bg-blue-50",
          borderColor: "border-blue-100"
        },
        {
          id: "leasing_financial",
          name: language === "ar" ? "العقود، الشيكات، وسندات التحصيل" : "Leases, Cheques & Collections",
          count: leasingFinancialItems.length,
          bytes: leasingFinancialBytes,
          color: "bg-emerald-500",
          textColor: "text-emerald-700",
          bgColor: "bg-emerald-50",
          borderColor: "border-emerald-100"
        },
        {
          id: "archive",
          name: language === "ar" ? "الأرشيف الإلكتروني والمستندات المرفقة" : "Electronic Archive & Attachments",
          count: archive?.length || 0,
          bytes: totalArchiveBytes,
          color: "bg-purple-500",
          textColor: "text-purple-700",
          bgColor: "bg-purple-50",
          borderColor: "border-purple-100"
        },
        {
          id: "accounting",
          name: language === "ar" ? "دليل الحسابات والإيداعات اليومية" : "Chart of Accounts & Daily Deposits",
          count: accountingItems.length,
          bytes: accountingBytes,
          color: "bg-amber-500",
          textColor: "text-amber-700",
          bgColor: "bg-amber-50",
          borderColor: "border-amber-100"
        },
        {
          id: "operations",
          name: language === "ar" ? "طلبات الصيانة، الفنيين، والقضايا" : "Maintenance, Techs & Legal Cases",
          count: operationsItems.length,
          bytes: operationsBytes,
          color: "bg-cyan-500",
          textColor: "text-cyan-700",
          bgColor: "bg-cyan-50",
          borderColor: "border-cyan-100"
        },
        {
          id: "system_logs",
          name: language === "ar" ? "سجلات التدقيق والأمان والإشعارات" : "Audit Logs, Security & Notifications",
          count: systemLogsItems.length,
          bytes: systemLogsBytes,
          color: "bg-slate-500",
          textColor: "text-slate-700",
          bgColor: "bg-slate-50",
          borderColor: "border-slate-100"
        }
      ]
    };
  }, [
    owners, properties, units, tenants, leases, cheques, collections,
    paymentAllocations, commissions, financialReversals, financialAdjustments,
    ownerTransfers, propertyExpenses, collectionActions, paymentPromises,
    chartOfAccounts, dailyDeposits, maintenanceRequests, technicians, cases,
    auditLogs, notifications, historicalRecords, archive, language
  ]);

  const testConnection = async (isAuto = false) => {
    setStatus("CHECKING");
    if (isAuto) {
      setIsAutoReconnecting(true);
      addLog(language === "ar" ? "محاولة إعادة الاتصال تلقائياً بخدمة Firebase..." : "Attempting automatic reconnection to Firebase...");
    } else {
      addLog(language === "ar" ? "بدء فحص اتصال قاعدة البيانات وحساب المساحة..." : "Starting database connection test and quota analysis...");
    }

    const startTime = performance.now();

    try {
      if (isAuto) {
        try {
          await enableNetwork(db);
          addLog(language === "ar" ? "تم إرسال أمر تفعيل الشبكة بنجاح." : "Network enabled successfully.");
        } catch (netErr) {
          console.warn("enableNetwork note:", netErr);
        }
      }

      // Perform a server fetch test to verify live connection
      const testRef = doc(db, "_system_health", "connection_probe");
      await getDocFromServer(testRef);

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      setLatency(duration);
      setStatus("CONNECTED");
      setErrorMessage(null);
      setLastChecked(new Date().toLocaleString());
      addLog(language === "ar" 
        ? `✅ نجح الاتصال بقاعدة البيانات بنجاح (${duration}ms) - المستندات النشطة: ${storageBreakdown.totalDocsCount}` 
        : `✅ Database connection successful (${duration}ms) - Active documents: ${storageBreakdown.totalDocsCount}`);
    } catch (err: any) {
      const errText = err?.message || String(err);
      setLatency(null);
      setStatus("DISCONNECTED");
      setErrorMessage(errText);
      setLastChecked(new Date().toLocaleString());
      addLog(language === "ar" ? `❌ فشل الاتصال: ${errText}` : `❌ Connection failed: ${errText}`);
    } finally {
      setIsAutoReconnecting(false);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  const handleRecalculateStorage = () => {
    setIsCalculatingStorage(true);
    addLog(language === "ar" ? "إعادة احتساب وتدقيق حجم البيانات المستخدمة والمتبقية..." : "Recalculating used and remaining storage footprint...");
    setTimeout(() => {
      setIsCalculatingStorage(false);
      addLog(language === "ar" 
        ? `المساحة المستخدمة: ${formatBytes(storageBreakdown.totalUsedBytes)} | المساحة المتبقية: ${formatBytes(storageBreakdown.remainingBytes)}` 
        : `Used: ${formatBytes(storageBreakdown.totalUsedBytes)} | Remaining: ${formatBytes(storageBreakdown.remainingBytes)}`);
    }, 400);
  };

  const handleAutoReconnect = async () => {
    await testConnection(true);
  };

  const firebaseConsoleUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;

  return (
    <div className="space-y-6">
      {/* 1. Header & Main Status Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              status === "CONNECTED" ? "bg-emerald-50 text-emerald-600" :
              status === "DISCONNECTED" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600 animate-pulse"
            }`}>
              {status === "CONNECTED" ? <Wifi className="w-6 h-6" /> :
               status === "DISCONNECTED" ? <WifiOff className="w-6 h-6" /> :
               <Activity className="w-6 h-6 animate-spin" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {language === "ar" ? "فحص اتصال وحصص قاعدة البيانات (Firebase)" : "Firebase Connection & Quota Center"}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200/60">
                  Spark Enterprise Tier
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === "ar"
                  ? "مراقبة حالة الاتصال الحي، وحساب المساحة المستخدمة والمتبقية من باقة Firebase السحابية"
                  : "Live connection health monitoring, used & remaining storage quota analytics"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => testConnection(false)}
              disabled={status === "CHECKING"}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${status === "CHECKING" ? "animate-spin" : ""}`} />
              <span>{language === "ar" ? "فحص الاتصال الآن" : "Test Now"}</span>
            </button>

            <button
              onClick={handleRecalculateStorage}
              disabled={isCalculatingStorage}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <HardDrive className={`w-4 h-4 ${isCalculatingStorage ? "animate-spin" : ""}`} />
              <span>{language === "ar" ? "تحديث حساب المساحة" : "Recalculate Quota"}</span>
            </button>

            <button
              onClick={handleAutoReconnect}
              disabled={isAutoReconnecting || status === "CHECKING"}
              className="px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Zap className={`w-4 h-4 ${isAutoReconnecting ? "animate-bounce" : ""}`} />
              <span>{language === "ar" ? "إعادة الاتصال" : "Auto-Reconnect"}</span>
            </button>
          </div>
        </div>

        {/* Status Metrics Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {language === "ar" ? "حالة الاتصال الحالية" : "Connection Status"}
            </span>
            <div className="flex items-center gap-2 mt-2">
              <span className={`w-3 h-3 rounded-full ${
                status === "CONNECTED" ? "bg-emerald-500 animate-pulse" :
                status === "DISCONNECTED" ? "bg-rose-500" : "bg-amber-500 animate-ping"
              }`} />
              <span className={`text-sm font-black ${
                status === "CONNECTED" ? "text-emerald-700" :
                status === "DISCONNECTED" ? "text-rose-700" : "text-amber-700"
              }`}>
                {status === "CONNECTED" ? (language === "ar" ? "متصل بنجاح (Online)" : "Connected (Online)") :
                 status === "DISCONNECTED" ? (language === "ar" ? "منقطع / غير متصل" : "Disconnected / Offline") :
                 (language === "ar" ? "جاري الفحص..." : "Checking...")}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {language === "ar" ? "سرعة الاستجابة (Latency)" : "Roundtrip Latency"}
            </span>
            <div className="text-sm font-black text-slate-800 mt-2">
              {latency !== null ? `${latency} ms` : (language === "ar" ? "غير متوفر" : "N/A")}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {language === "ar" ? "آخر وقت فحص" : "Last Checked At"}
            </span>
            <div className="text-xs font-bold text-slate-700 mt-2 truncate">
              {lastChecked || (language === "ar" ? "لم يُفحص بعد" : "Not yet checked")}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {language === "ar" ? "معرّف قاعدة البيانات" : "Database ID"}
            </span>
            <div className="text-[11px] font-mono text-slate-700 mt-2 truncate" title={firebaseConfig.firestoreDatabaseId}>
              {firebaseConfig.firestoreDatabaseId}
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block mb-1">
                {language === "ar" ? "تفاصيل الخطأ في الاتصال:" : "Connection Error Details:"}
              </span>
              <span className="font-mono text-[11px] break-all">{errorMessage}</span>
            </div>
          </div>
        )}

        {isQuotaExceeded && (
          <div className="mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">
                  {language === "ar" ? "تنبيه: تم الوصول للحد الأقصى المجاني للباقة اليومية (Quota Exceeded)" : "Alert: Free Daily Quota Exceeded"}
                </span>
                <p className="text-[11px] text-amber-800">
                  {language === "ar"
                    ? "تتجدد الحصة المجانية تلقائياً في بداية اليوم التالي، أو يمكنك ترقية الباقة لعدم انقطاع العمليات."
                    : "The daily quota will reset automatically tomorrow, or you can upgrade your plan for unlimited operations."}
                </p>
              </div>
            </div>
            <a
              href={firebaseConsoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 flex-shrink-0"
            >
              <span>{language === "ar" ? "ترقية الباقة" : "Upgrade Plan"}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* 2. Cloud Storage Quota Cockpit (Used & Remaining Space) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">
                {language === "ar" ? "المساحة التخزينية وحصص الباقة السحابية (Storage & Plan Quotas)" : "Cloud Storage & Plan Quotas"}
              </h4>
              <p className="text-xs text-slate-500">
                {language === "ar"
                  ? "احتساب المساحة الإجمالية للباقة، المستهلك منها، والمساحة المتبقية بدقة تامة"
                  : "Total plan capacity, used storage, and remaining quota calculated in real time"}
              </p>
            </div>
          </div>

          <a
            href={firebaseConsoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
          >
            <span>{language === "ar" ? "فتح Firebase Console" : "Open Firebase Console"}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Primary Storage Progress Bar */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-slate-700 block">
                {language === "ar" ? "مؤشر استهلاك باقة التخزين الإجمالية" : "Storage Capacity Consumption"}
              </span>
              <span className="text-[11px] text-slate-500">
                {language === "ar"
                  ? `السعة الكلية المخصصة للباقة: ${formatBytes(TOTAL_PLAN_BYTES)} (1 GiB Spark Free Tier)`
                  : `Total Allocated Plan Quota: ${formatBytes(TOTAL_PLAN_BYTES)} (1 GiB Spark Free Tier)`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">
                {language === "ar" ? "المستهلك:" : "Used:"}
              </span>
              <span className="text-sm font-black text-amber-700">
                {storageBreakdown.usedPercentage.toFixed(3)}%
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-xs font-bold text-slate-500">
                {language === "ar" ? "المتبقي:" : "Remaining:"}
              </span>
              <span className="text-sm font-black text-emerald-600">
                {storageBreakdown.remainingPercentage.toFixed(3)}%
              </span>
            </div>
          </div>

          {/* Graphical Progress Bar */}
          <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
            <div
              className={`h-full transition-all duration-700 ${
                storageBreakdown.usedPercentage > 90 
                  ? "bg-rose-500" 
                  : storageBreakdown.usedPercentage > 70 
                  ? "bg-amber-500" 
                  : "bg-emerald-500"
              }`}
              style={{ width: `${Math.max(1, storageBreakdown.usedPercentage)}%` }}
              title={`Used: ${storageBreakdown.usedPercentage.toFixed(2)}%`}
            />
            <div
              className="h-full bg-slate-200/60 transition-all duration-700"
              style={{ width: `${storageBreakdown.remainingPercentage}%` }}
              title={`Remaining: ${storageBreakdown.remainingPercentage.toFixed(2)}%`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <span className="font-bold flex items-center gap-1.5 text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {language === "ar" 
                ? `المساحة المتبقية حرة ومتاحة: ${formatBytes(storageBreakdown.remainingBytes)}` 
                : `Available Free Space: ${formatBytes(storageBreakdown.remainingBytes)}`}
            </span>
            <span className="font-medium text-slate-400">
              {language === "ar" 
                ? `حالة السعة: ${storageBreakdown.usedPercentage < 70 ? "ممتازة (مساحة كافية جداً)" : "تتطلب المراقبة"}` 
                : `Health: ${storageBreakdown.usedPercentage < 70 ? "Optimal (Plenty of space)" : "Requires Attention"}`}
            </span>
          </div>
        </div>

        {/* Storage Metric Cards: 1) Total Plan, 2) Used Space, 3) Remaining Space, 4) Total Documents */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Plan */}
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/70">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                {language === "ar" ? "سعة الباقة الإجمالية" : "Total Plan Quota"}
              </span>
              <HardDrive className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl font-black text-slate-900 mt-2">
              1.00 GB
            </div>
            <span className="text-[11px] font-semibold text-amber-700 block mt-1">
              {formatBytes(TOTAL_PLAN_BYTES)} (1,024 MB)
            </span>
          </div>

          {/* Card 2: Used Storage Space */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                {language === "ar" ? "المساحة المستخدمة حالياً" : "Used Storage Space"}
              </span>
              <PieChart className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-xl font-black text-slate-900 mt-2">
              {formatBytes(storageBreakdown.totalUsedBytes)}
            </div>
            <span className="text-[11px] font-bold text-slate-500 block mt-1">
              {storageBreakdown.usedPercentage.toFixed(3)}% {language === "ar" ? "من إجمالي الباقة" : "of total quota"}
            </span>
          </div>

          {/* Card 3: Remaining Storage Space */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                {language === "ar" ? "المساحة المتبقية في الباقة" : "Remaining Quota"}
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-black text-emerald-700 mt-2">
              {formatBytes(storageBreakdown.remainingBytes)}
            </div>
            <span className="text-[11px] font-bold text-emerald-600 block mt-1">
              {storageBreakdown.remainingPercentage.toFixed(3)}% {language === "ar" ? "متبقية متاحة" : "available remaining"}
            </span>
          </div>

          {/* Card 4: Total Stored Documents */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                {language === "ar" ? "إجمالي المستندات المخزنة" : "Total Stored Documents"}
              </span>
              <FileText className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-xl font-black text-slate-900 mt-2">
              {storageBreakdown.totalDocsCount.toLocaleString()}
            </div>
            <span className="text-[11px] font-semibold text-slate-500 block mt-1">
              {language === "ar" ? "سجل ومستند عبر 16 مجموعة" : "Records across 16 collections"}
            </span>
          </div>
        </div>

        {/* Detailed Breakdown by Category Table / Grid */}
        <div>
          <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-500" />
            <span>{language === "ar" ? "تفصيل استهلاك المساحة حسب الأقسام والمجموعات" : "Storage Breakdown by Category"}</span>
          </h5>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {storageBreakdown.categories.map((cat) => {
              const shareOfUsed = storageBreakdown.totalUsedBytes > 0 
                ? ((cat.bytes / storageBreakdown.totalUsedBytes) * 100).toFixed(1)
                : "0.0";

              return (
                <div key={cat.id} className={`p-3.5 rounded-2xl border ${cat.borderColor} ${cat.bgColor} flex flex-col justify-between`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`text-xs font-bold ${cat.textColor} block`}>
                        {cat.name}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {cat.count.toLocaleString()} {language === "ar" ? "سجل / مستند" : "records"}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white text-slate-700 shadow-2xs border border-slate-200/50">
                      {shareOfUsed}% {language === "ar" ? "من المستخدم" : "of used"}
                    </span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/40 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {language === "ar" ? "الحجم:" : "Size:"}
                    </span>
                    <span className="text-xs font-black text-slate-800">
                      {formatBytes(cat.bytes)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Firebase Spark Plan Operational Quotas Information */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
          <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>{language === "ar" ? "حدود العمليات اليومية المجانية للباقة (Firebase Spark Plan Limits)" : "Daily Operations Free Tier Quota Limits"}</span>
          </h5>
          <p className="text-[11px] text-slate-500 mb-3">
            {language === "ar"
              ? "تتجدد هذه الحصص تلقائياً كل 24 ساعة بدون أي تكلفة إضافية:"
              : "These operational quotas reset automatically every 24 hours at no additional cost:"}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-white rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                {language === "ar" ? "القراءات اليومية" : "Daily Reads"}
              </span>
              <span className="text-sm font-black text-slate-800 mt-1 block">
                {DAILY_READ_QUOTA.toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-600 font-bold">
                {language === "ar" ? "عملية مجانية / يوم" : "free ops / day"}
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                {language === "ar" ? "الكتابات اليومية" : "Daily Writes"}
              </span>
              <span className="text-sm font-black text-slate-800 mt-1 block">
                {DAILY_WRITE_QUOTA.toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-600 font-bold">
                {language === "ar" ? "عملية مجانية / يوم" : "free ops / day"}
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                {language === "ar" ? "عمليات الحذف اليومية" : "Daily Deletes"}
              </span>
              <span className="text-sm font-black text-slate-800 mt-1 block">
                {DAILY_DELETE_QUOTA.toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-600 font-bold">
                {language === "ar" ? "عملية مجانية / يوم" : "free ops / day"}
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                {language === "ar" ? "نقل البيانات الصادرة" : "Bandwidth Egress"}
              </span>
              <span className="text-sm font-black text-slate-800 mt-1 block">
                {MONTHLY_EGRESS_GB} GB
              </span>
              <span className="text-[10px] text-emerald-600 font-bold">
                {language === "ar" ? "شهرياً (~360MB/يوم)" : "per month"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Live Diagnostics Log */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {language === "ar" ? "سجل الفحص المباشر وتشخيص قاعدة البيانات" : "Live Diagnostics & Database Log"}
          </h4>
          <span className="text-[11px] text-slate-400">
            {testLog.length} {language === "ar" ? "أحداث مسجلة" : "events logged"}
          </span>
        </div>

        <div className="bg-slate-900 text-slate-200 font-mono text-xs p-4 rounded-2xl max-h-52 overflow-y-auto space-y-1.5 shadow-inner">
          {testLog.length === 0 ? (
            <div className="text-slate-500 italic">
              {language === "ar" ? "لا توجد سجلات بعد..." : "No logs recorded yet..."}
            </div>
          ) : (
            testLog.map((log, idx) => (
              <div key={idx} className={
                log.includes("✅") ? "text-emerald-400 font-bold" : 
                log.includes("❌") ? "text-rose-400 font-bold" : 
                log.includes("المساحة") || log.includes("Used:") ? "text-amber-300 font-semibold" :
                "text-slate-300"
              }>
                {log}
              </div>
            ))
          )}
        </div>

        {/* Configuration Summary */}
        <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
          <div>
            <span className="font-bold text-slate-800 block mb-1">
              {language === "ar" ? "مشروع Firebase المرتبط:" : "Linked Firebase Project:"}
            </span>
            <span className="font-mono text-slate-500">{firebaseConfig.projectId}</span>
          </div>
          <div>
            <span className="font-bold text-slate-800 block mb-1">
              {language === "ar" ? "نطاق المصادقة (Auth Domain):" : "Auth Domain:"}
            </span>
            <span className="font-mono text-slate-500">{firebaseConfig.authDomain}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

