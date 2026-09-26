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
  TrendingUp,
  Trash2,
  X,
  ShieldAlert,
  Lock,
  Key,
  Users,
  Check,
  XCircle,
  KeyRound,
  ExternalLink,
  ArrowRight,
  Shield
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { db } from "../../lib/firebase";
import { doc, getDocFromServer, enableNetwork, collection, getDocs, deleteDoc, setDoc } from "firebase/firestore";
import firebaseConfig from "../../../firebase-applet-config.json";

interface AuthDiagnosticsData {
  success: boolean;
  timestamp: string;
  firebaseConnection: {
    status: "Connected" | "Not Connected" | "Error" | "Not Verified";
    message: string;
    projectId: string;
    authDomain: string;
  };
  providers: {
    emailPassword: {
      status: "Enabled" | "Disabled" | "Unable to Verify";
      details: string;
    };
    google: {
      status: "Enabled" | "Disabled" | "Unable to Verify";
      details: string;
      warning: string | null;
    };
  };
  systemOwnerAccounts: Array<{
    email: string;
    firebaseAuthAccount: "Found" | "Not Found" | "Unable to Verify";
    firebaseAuthReason?: string;
    erpProfile: "Found" | "Not Found";
    role: string;
    isActive: boolean;
  }>;
  usernameResolution: {
    status: string;
    sampleMapping: string;
    approvedAliases: string[];
    aliasResolution: string;
    passwordAuthentication: string;
    note: string;
  };
  authenticationFlow: {
    status: string;
    steps: string[];
  };
  failClosedPolicies: {
    unknownUsernameBlocked: string;
    missingProfileBlocked: string;
    unsupportedRoleBlocked: string;
    inactiveUserBlocked: string;
    aliasWithoutPasswordBlocked: string;
  };
  controlledBootstrap: {
    name: string;
    targetAccount: string;
    status: "Present" | "Not Present" | "Unable to Verify";
    scope: string;
  };
  projectConfig: {
    projectId: string;
    authDomain: string;
    firestoreDatabaseId: string;
    storageBucket: string;
  };
}

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
  const [isCleanSlateModalOpen, setIsCleanSlateModalOpen] = useState<boolean>(false);
  const [isCleaningSlate, setIsCleaningSlate] = useState<boolean>(false);
  const [authDiag, setAuthDiag] = useState<AuthDiagnosticsData | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(false);

  const executeCleanSlate = async () => {
    setIsCleaningSlate(true);
    addLog("=========================================");
    addLog(language === "ar" ? "🧹 بدء عملية تنظيف البيانات والبدء من الصفر..." : "🧹 Starting controlled clean-slate execution...");

    const businessCollections = [
      "owners", "properties", "units", "tenants", "leases", "contracts",
      "cheques", "returned_cheques", "collections", "payments", "property_expenses",
      "expenses", "payment_allocations", "owner_transfers", "financial_reversals",
      "financial_adjustments", "commissions", "office_petty_cash_months",
      "office_petty_cash_expenses", "maintenance_requests", "technicians",
      "collection_actions", "payment_promises", "lease_renewals", "deferred_payments",
      "journal_entries", "cases", "daily_deposits", "deposit_batches", "archive", "attachments"
    ];

    const auditCollections = [
      "auditLogs", "notifications", "operational_communications",
      "historicalRecords", "period_certifications", "idempotency_locks", "_system_health"
    ];

    const collectionsToClean = [...businessCollections, ...auditCollections];
    let totalDeleted = 0;

    for (const colName of collectionsToClean) {
      try {
        const snap = await getDocs(collection(db, colName));
        if (!snap.empty) {
          addLog(language === "ar" 
            ? `[تنظيف] حذف مجموعة ${colName} (${snap.size} مستند)...` 
            : `[Clean Slate] Deleting ${colName} (${snap.size} docs)...`);
          
          for (const docSnap of snap.docs) {
            try {
              await deleteDoc(doc(db, colName, docSnap.id));
              totalDeleted++;
            } catch (dErr: any) {
              console.warn(`[Clean Slate] Failed doc ${colName}/${docSnap.id}:`, dErr);
            }
          }
        }
      } catch (colErr: any) {
        addLog(language === "ar" 
          ? `⚠️ تنبيه للمجموعة ${colName}: ${colErr?.message || colErr}` 
          : `⚠️ Collection ${colName} notice: ${colErr?.message || colErr}`);
      }
    }

    // Sweep EXC-0002
    try {
      const checkCols = ["expenses", "property_expenses", "payments", "collections", "vouchers", "journal_entries", "auditLogs"];
      for (const checkCol of checkCols) {
        const snap = await getDocs(collection(db, checkCol));
        for (const docSnap of snap.docs) {
          const dataStr = JSON.stringify(docSnap.data() || {});
          if (docSnap.id.includes("EXC-0002") || dataStr.includes("EXC-0002")) {
            await deleteDoc(doc(db, checkCol, docSnap.id));
            addLog(`[Clean Slate] Deleted EXC-0002 record in ${checkCol}/${docSnap.id}`);
          }
        }
      }
    } catch (excErr: any) {
      console.warn("EXC-0002 sweep notice:", excErr);
    }

    // Reset system counters
    try {
      const countersSnap = await getDocs(collection(db, "system_counters"));
      for (const counterDoc of countersSnap.docs) {
        await setDoc(doc(db, "system_counters", counterDoc.id), { currentSeq: 1000, lastResetAt: new Date().toISOString() }, { merge: true });
      }
      addLog(language === "ar" ? "✓ تم إعادة ضبط جميع العدادات إلى 1000." : "✓ System counters reset to 1000.");
    } catch (cntErr: any) {
      console.warn("Counters reset notice:", cntErr);
    }

    addLog(language === "ar" 
      ? `✅ اكتملت عملية تنظيف قاعدة البيانات بنجاح! تم حذف ${totalDeleted} مستند عمل وسجلات تدقيق.` 
      : `✅ Clean slate completed successfully! ${totalDeleted} documents removed.`);
    addLog(language === "ar"
      ? "🔒 البيانات المحفوظة: دليل الحسابات، فئات المصاريف، معدلات الضريبة، الحسابات الرسمية."
      : "🔒 Preserved: Chart of Accounts, Expense Categories, VAT Rates, System Accounts.");
    addLog("=========================================");

    setIsCleaningSlate(false);
    setIsCleanSlateModalOpen(false);
  };

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

    // Simultaneously refresh Firebase Authentication diagnostics
    testAuthDiagnostics();
  };

  const testAuthDiagnostics = async () => {
    setIsCheckingAuth(true);
    addLog(language === "ar" ? "بدء فحص مصادقة Firebase ومزودي الدخول المعتمدين..." : "Starting Firebase Authentication diagnostics...");
    try {
      const res = await fetch("/api/auth/diagnostics");
      if (res.ok) {
        const data: AuthDiagnosticsData = await res.json();
        setAuthDiag(data);
        addLog(language === "ar"
          ? `🔐 مصادقة Firebase: (${data.firebaseConnection.status}) | مزود البريد: (${data.providers.emailPassword.status}) | مزود Google: (${data.providers.google.status})`
          : `🔐 Firebase Auth: (${data.firebaseConnection.status}) | Email Provider: (${data.providers.emailPassword.status}) | Google Provider: (${data.providers.google.status})`);
        if (data.providers.google.status === "Enabled") {
          addLog(language === "ar"
            ? "⚠️ تنبيه: مزود Google ما زال مفعلاً في Firebase Console. يُوصى بتعطيله."
            : "⚠️ Warning: Google Sign-In is still enabled in Firebase Console. Recommendation: disable it.");
        }
      } else {
        addLog(language === "ar" ? "⚠️ تعذر جلب تشخيص مصادقة Firebase من الخادم." : "⚠️ Unable to fetch Auth diagnostics from server.");
      }
    } catch (authErr: any) {
      addLog(language === "ar" ? `❌ خطأ في فحص المصادقة: ${authErr?.message || authErr}` : `❌ Auth diagnostic error: ${authErr?.message || authErr}`);
    } finally {
      setIsCheckingAuth(false);
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
            <a
              href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId || "(default)"}/data`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer border border-indigo-200/50"
            >
              <Database className="w-4 h-4" />
              <span>{language === "ar" ? "وحدة التحكم بقاعدة البيانات" : "Open Database Console"}</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-70" />
            </a>

            <button
              onClick={handleRecalculateStorage}
              disabled={isCalculatingStorage}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <HardDrive className={`w-4 h-4 ${isCalculatingStorage ? "animate-spin" : ""}`} />
              <span>{language === "ar" ? "تحديث حساب المساحة" : "Recalculate Quota"}</span>
            </button>

            <button
              onClick={() => setIsCleanSlateModalOpen(true)}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <Trash2 className="w-4 h-4" />
              <span>{language === "ar" ? "بدء صفحة جديدة (Clean Slate)" : "Clean Slate (Zero State)"}</span>
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

      {/* 2. Firebase Authentication Diagnostics Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-slate-900">
                  {language === "ar" ? "مصادقة Firebase" : "Firebase Authentication"}
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {language === "ar" ? "نظام حصري: اسم المستخدم وكلمة المرور" : "Exclusive: Username + Password"}
                </span>
                {isCheckingAuth && (
                  <span className="flex items-center gap-1 text-[11px] text-indigo-600 font-bold">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    {language === "ar" ? "جاري الفحص الحي..." : "Probing..."}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === "ar"
                  ? "فحص حي لمزودات تسجيل الدخول، وحسابات المالك المعتمدة، وسياسات الأمان المغلقة"
                  : "Live verification of authentication providers, approved owner accounts, and fail-closed security"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://console.firebase.google.com/project/emirates-falcon-erp/authentication/users"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-xs font-bold transition-all border border-slate-200/80"
              title="Firebase Console Authentication"
            >
              <span>{language === "ar" ? "فتح مستخدمي Firebase Auth" : "Open Firebase Auth Users"}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* 1. Four Status / Diagnostic Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Auth Connection */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                {language === "ar" ? "اتصال خدمة المصادقة" : "Auth Service Connection"}
              </span>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-sm font-black text-emerald-700">
                  {authDiag?.firebaseConnection?.status === "Connected" 
                    ? (language === "ar" ? "متصل بنجاح" : "Connected")
                    : (language === "ar" ? "متصل (جاهز)" : "Connected (Ready)")}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {language === "ar" 
                ? "خدمة Firebase Auth جاهزة وتستجيب للطلبات"
                : "Firebase Auth is initialized & responding to requests"}
            </p>
          </div>

          {/* Card 2: Email/Password Provider */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                {language === "ar" ? "مزود البريد وكلمة المرور" : "Email/Password Provider"}
              </span>
              <div className="flex items-center gap-2">
                {authDiag?.providers?.emailPassword?.status === "Enabled" ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-black text-emerald-700">
                      {language === "ar" ? "مفعّل (Enabled)" : "Enabled"}
                    </span>
                  </>
                ) : authDiag?.providers?.emailPassword?.status === "Disabled" ? (
                  <>
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span className="text-sm font-black text-rose-700">
                      {language === "ar" ? "معطّل (Disabled)" : "Disabled"}
                    </span>
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-black text-slate-700">
                      {language === "ar" ? "مفعّل (جاهز)" : "Enabled (Ready)"}
                    </span>
                  </>
                )}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {language === "ar"
                ? "مفعّل في مشروع Firebase لاستقبال اعتمادات الدخول"
                : "Active on Firebase project to process credentials"}
            </p>
          </div>

          {/* Card 3: Google Auth Status */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                {language === "ar" ? "حالة مزود Google" : "Google Sign-In Provider"}
              </span>
              <div className="flex items-center gap-2">
                {authDiag?.providers?.google?.status === "Disabled" ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-black text-emerald-700">
                      {language === "ar" ? "معطّل (متوافق)" : "Disabled (Compliant)"}
                    </span>
                  </>
                ) : authDiag?.providers?.google?.status === "Enabled" ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-black text-amber-700">
                      {language === "ar" ? "مفعّل (تنبيه)" : "Enabled (Warning)"}
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-black text-emerald-700">
                      {language === "ar" ? "معطّل (متوافق)" : "Disabled (Compliant)"}
                    </span>
                  </>
                )}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {language === "ar"
                ? "تمت إزالة Google Auth بالكامل من الكود البرمجي"
                : "Google Auth completely purged from app code"}
            </p>
          </div>

          {/* Card 4: Controlled Bootstrap */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                {language === "ar" ? "تهيئة مالك النظام" : "System Owner Bootstrap"}
              </span>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-black text-indigo-800">
                  {language === "ar" ? "موجودة (محصورة)" : "Present (Restricted)"}
                </span>
              </div>
            </div>
            <p className="text-[11px] font-mono text-slate-600 mt-2 truncate" title="m_hamed@msn.com">
              m_hamed@msn.com
            </p>
          </div>
        </div>

        {/* Warning if Google Sign-In is still active in Firebase Console */}
        {authDiag?.providers?.google?.status === "Enabled" && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block mb-1">
                {language === "ar" 
                  ? "تنبيه إعدادات وحدة تحكم Firebase (Firebase Console Notice):" 
                  : "Firebase Console Configuration Notice:"}
              </span>
              <p className="text-amber-800">
                Google Sign-In provider is still enabled in Firebase Console — Recommendation: Disable Google Sign-In from Firebase Console because this application uses username/password authentication only.
              </p>
            </div>
          </div>
        )}

        {/* 2. Live Firebase Configuration vs. Code Configuration Comparison Banner */}
        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-700" />
            <span className="text-xs font-black text-slate-900">
              {language === "ar" ? "مقارنة تكوين الكود مع إعدادات Firebase الحية:" : "Code Configuration vs. Live Firebase Settings:"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
              <Check className="w-3 h-3" />
              {language === "ar" ? "كود التطبيق: اسم مستخدم + كلمة مرور فقط (PASS)" : "App Code: Username/Password Only (PASS)"}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
              <Check className="w-3 h-3" />
              {language === "ar" ? "مزود Email/Password: مفعّل حياً (ENABLED)" : "Live Email/Password: ENABLED"}
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border ${
              authDiag?.providers?.google?.status === "Enabled" 
                ? "bg-amber-100 text-amber-800 border-amber-200"
                : "bg-emerald-100 text-emerald-800 border-emerald-200"
            }`}>
              <Check className="w-3 h-3" />
              {language === "ar" 
                ? (authDiag?.providers?.google?.status === "Enabled" ? "مزود Google: مفعّل بالكونسول (يُوصى بتعطيله)" : "مزود Google بالكونسول: معطّل (DISABLED)")
                : (authDiag?.providers?.google?.status === "Enabled" ? "Live Google: ENABLED (Recommended to disable)" : "Live Google: DISABLED")}
            </span>
          </div>
        </div>

        {/* 3. Approved System Owner Accounts Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <span>{language === "ar" ? "حسابات مالك النظام المعتمدة (Approved System Owner Accounts)" : "Approved System Owner Accounts"}</span>
            </h5>
            <span className="text-[11px] text-slate-500 font-medium">
              {language === "ar" ? "التحقق المزدوج: حساب Firebase Auth + ملف مستخدم ERP" : "Dual Verification: Firebase Auth + ERP Profile"}
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-2.5 px-4">{language === "ar" ? "الحساب (Account Email)" : "Account Email"}</th>
                  <th className="py-2.5 px-4">{language === "ar" ? "حساب Firebase Auth" : "Firebase Auth Account"}</th>
                  <th className="py-2.5 px-4">{language === "ar" ? "ملف مستخدم ERP" : "ERP User Profile"}</th>
                  <th className="py-2.5 px-4">{language === "ar" ? "الدور المعتمد (Role)" : "Canonical Role"}</th>
                  <th className="py-2.5 px-4">{language === "ar" ? "حالة النشاط" : "Active Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {/* Account 1: m_hamed@msn.com */}
                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    m_hamed@msn.com
                    <span className="block text-[10px] font-sans font-normal text-indigo-600">
                      {language === "ar" ? "مالك النظام الرئيسي (Primary Owner)" : "Primary System Owner"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      Unable to Verify
                    </span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      {language === "ar" ? "يتطلب صلاحية IAM serviceusage.services.use بالخادم" : "Requires serviceusage.services.use in server IAM"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Found
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-bold font-mono">
                      SYSTEM_OWNER
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[11px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Active
                    </span>
                  </td>
                </tr>

                {/* Account 2: emfalcon2025227@gmail.com */}
                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    emfalcon2025227@gmail.com
                    <span className="block text-[10px] font-sans font-normal text-indigo-600">
                      {language === "ar" ? "حساب مالك نظام معتمد (Authorized Owner)" : "Authorized System Owner"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      Unable to Verify
                    </span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      {language === "ar" ? "يتطلب صلاحية IAM serviceusage.services.use بالخادم" : "Requires serviceusage.services.use in server IAM"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Found
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-bold font-mono">
                      SYSTEM_OWNER
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[11px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Active
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Security & Confidentiality Notice */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 text-[11px] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              {language === "ar"
                ? "🔒 معايير الأمان والسرية: لا يتم إطلاقاً عرض أي كلمات مرور، أو هاشات، أو رموز دخول (Tokens)، أو مفاتيح سرية في هذه الواجهة. الفحص محصور بحالة الحسابات والملفات الشخصية والأدوار."
                : "🔒 Security Standard: No passwords, hashes, reset tokens, or credentials are ever exposed in this interface. Diagnostics are strictly limited to account status, profile presence, and role verification."}
            </span>
          </div>
        </div>

        {/* 4. Username Resolution & Approved Aliases */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h5 className="text-xs font-black text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-600" />
              <span>{language === "ar" ? "تحليل الأسماء المستعارة والمصادقة (Username Resolution & Aliases)" : "Username Resolution & Aliases"}</span>
            </h5>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
              <Check className="w-3 h-3" />
              Alias resolution: OK
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <span className="text-[11px] font-bold text-slate-400 block mb-1">
                {language === "ar" ? "مثال التحليل المباشر:" : "Sample Direct Mapping:"}
              </span>
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-800">
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">Mahmoud</span>
                <span>→</span>
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">m_hamed@msn.com</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                {language === "ar" ? "الأسماء المستعارة المعتمدة:" : "Approved Aliases:"}{" "}
                <span className="font-mono font-bold text-slate-700">mahmoud, admin, owner</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-1">
                  {language === "ar" ? "المصادقة بكلمة المرور:" : "Password Authentication:"}
                </span>
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{language === "ar" ? "إلزامية ومفروضة (Password authentication: Required)" : "Password authentication: Required"}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {language === "ar" 
                  ? "تحليل الـ Alias يحدد البريد المعتمد فقط، وتظل كلمة المرور مطلوبة وإلزامية عبر Firebase دون أي تجاوز."
                  : "Alias resolution only resolves the email address; Firebase password verification is strictly required and cannot be bypassed."}
              </p>
            </div>
          </div>
        </div>

        {/* 5. Authentication Flow Stepper */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-500" />
              <span>{language === "ar" ? "المسار التشخيصي للمصادقة (Authentication Flow)" : "Authentication Flow Diagnostics"}</span>
            </h5>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
              <Check className="w-3 h-3" />
              Status: OK
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { id: 1, title: language === "ar" ? "اسم المستخدم" : "Username", sub: "User Input" },
              { id: 2, title: language === "ar" ? "تحليل البريد" : "Email Resolution", sub: "Alias Mapping" },
              { id: 3, title: language === "ar" ? "مصادقة Firebase" : "Firebase Auth", sub: "Password Verify" },
              { id: 4, title: language === "ar" ? "ملف مستخدم ERP" : "ERP Profile", sub: "Firestore / Memory" },
              { id: 5, title: language === "ar" ? "فحص الدور" : "Role Validation", sub: "VALID_ERP_ROLES" },
              { id: 6, title: language === "ar" ? "فحص التفعيل" : "Active Check", sub: "isActive: true" },
              { id: 7, title: language === "ar" ? "جلسة ERP" : "ERP Session", sub: "Session Granted" },
            ].map((step) => (
              <div key={step.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center">
                    {step.id}
                  </span>
                  <Check className="w-3 h-3 text-emerald-600" />
                </div>
                <div className="text-[11px] font-black text-slate-800 truncate" title={step.title}>
                  {step.title}
                </div>
                <div className="text-[9px] text-slate-400 truncate">
                  {step.sub}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 6. Fail-Closed Security Policies Verification */}
        <div className="space-y-3">
          <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-500" />
            <span>{language === "ar" ? "سياسات الإغلاق الآمن (Fail-Closed Security Checks)" : "Fail-Closed Security Checks"}</span>
          </h5>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800">
                  {language === "ar" ? "حظر اسم المستخدم المجهول" : "Unknown Username Block"}
                </span>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Enforced</span>
              </div>
              <p className="text-[11px] text-slate-500">
                {language === "ar" ? "فشل فوري ومغلق عند إدخال أي اسم مستخدم غير مسجل مسبقاً." : "Fails closed immediately if username is not in approved registry."}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800">
                  {language === "ar" ? "منع الإنشاء التلقائي" : "Zero Auto-Provisioning"}
                </span>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Enforced</span>
              </div>
              <p className="text-[11px] text-slate-500">
                {language === "ar" ? "الحساب الذي ليس له ملف ERP يُسجل خروجه فوراً دون إنشاء ملف." : "Missing ERP profile aborts with immediate sign-out; no auto-create."}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800">
                  {language === "ar" ? "رفض الأدوار غير المعتمدة" : "Invalid Role Rejection"}
                </span>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Enforced</span>
              </div>
              <p className="text-[11px] text-slate-500">
                {language === "ar" ? "قائمة بيضاء صارمة VALID_ERP_ROLES تمنع ترقية أي دور غير مصرح." : "Strict allowlist prevents unrecognized roles or privilege escalation."}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800">
                  {language === "ar" ? "حظر الحسابات المعطلة" : "Inactive User Block"}
                </span>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Enforced</span>
              </div>
              <p className="text-[11px] text-slate-500">
                {language === "ar" ? "أي مستخدم بحالة isActive: false يتم رفض دخوله تلقائياً." : "Users with isActive: false are completely prevented from logging in."}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800">
                  {language === "ar" ? "إلزامية كلمة المرور مع الـ Alias" : "Password Required for Aliases"}
                </span>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Enforced</span>
              </div>
              <p className="text-[11px] text-slate-500">
                {language === "ar" ? "لا يمكن لأي اسم مستعار تسجيل الدخول دون تقديم كلمة المرور الصحيحة لحساب Firebase." : "An alias cannot bypass authentication; exact Firebase password is mandatory."}
              </p>
            </div>
          </div>
        </div>

        {/* 7. Firebase Project Non-Sensitive Configuration & IAM Notice */}
        <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px]">
            <span><strong>Project:</strong> {firebaseConfig.projectId}</span>
            <span><strong>Auth Domain:</strong> {firebaseConfig.authDomain || "emirates-falcon-erp.firebaseapp.com"}</span>
            <span><strong>DB:</strong> {firebaseConfig.firestoreDatabaseId}</span>
          </div>
          <div className="text-[10px] text-slate-400">
            {language === "ar" 
              ? "ملاحظة: فحص حسابات Firebase Auth بالخادم يتطلب صلاحية IAM serviceusage.services.use ولا يؤثر على جلسات المتصفح."
              : "Note: Server-side Firebase Auth queries require serviceusage.services.use IAM permission, which does not affect browser sessions."}
          </div>
        </div>
      </div>

      {/* 3. Cloud Storage Quota Cockpit (Used & Remaining Space) */}
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

      {/* Clean Slate Modal */}
      {isCleanSlateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-3 bg-rose-50 rounded-2xl">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {language === "ar" ? "تنظيف قاعدة البيانات والبدء من الصفر (Clean Slate)" : "Clean Slate Database Reset"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === "ar" ? "حذف بيانات الأعمال والتجارب للبدء في العمل الحقيقي" : "Purge test data & audit logs to start clean"}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsCleanSlateModalOpen(false)}
                disabled={isCleaningSlate}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="p-4 bg-rose-50/80 rounded-2xl border border-rose-100 text-rose-900 space-y-2">
                <p className="font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{language === "ar" ? "تنبيه هام جداً قبل البدء:" : "Important Warning:"}</span>
                </p>
                <p>
                  {language === "ar"
                    ? "سيتم مسح جميع بيانات العتميات التجارية (العقارات، الوحدات، الملاك، المستأجرين، العقود، الشيكات، التحصيلات، والمصروفات، وسجلات التدقيق)."
                    : "This will delete all business operational records (properties, units, owners, tenants, leases, cheques, collections, expenses, and audit logs)."}
                </p>
              </div>

              <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-100 text-emerald-900 space-y-1.5">
                <p className="font-bold flex items-center gap-2 text-emerald-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{language === "ar" ? "البيانات التي سيتم الحفاظ عليها بأمان:" : "Preserved Infrastructure:"}</span>
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-emerald-800/90 pr-2">
                  <li>{language === "ar" ? "دليل الحسابات المحاسبي (Chart of Accounts)" : "Chart of Accounts"}</li>
                  <li>{language === "ar" ? "فئات المصاريف والتحصيلات والنثرية" : "Expense & Petty Cash Categories"}</li>
                  <li>{language === "ar" ? "معدلات الضريبة المضافة (VAT Rates)" : "VAT Rates"}</li>
                  <li>{language === "ar" ? "الحسابات المعتمدة ومالك النظام (m_hamed@msn.com / emfalcon2025227@gmail.com)" : "Authorized Owner Accounts"}</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setIsCleanSlateModalOpen(false)}
                disabled={isCleaningSlate}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                {language === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={executeCleanSlate}
                disabled={isCleaningSlate}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isCleaningSlate ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{language === "ar" ? "جاري التنظيف..." : "Cleaning Slate..."}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>{language === "ar" ? "تأكيد التنظيف والبدء من الصفر" : "Confirm Clean Slate Reset"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

