import React, { useState, useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Search,
  Download,
  Printer,
  ChevronRight,
  ArrowLeft,
  Users,
  Building2,
  Home,
  FileSpreadsheet,
  FolderLock,
  Wrench,
  Scale,
  Calendar,
  CreditCard,
  CheckSquare,
  XCircle,
  ExternalLink,
  ShieldCheck,
  RotateCcw,
  Plus,
  Play,
  Layers,
  Send,
  Zap,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useNavigation } from "../../context/NavigationContext";
import { CloseBackButton } from "../common/CloseBackButton";
import { SearchableSelect } from "../common/SearchableSelect";
import { useAuth } from "../../context/AuthContext";
import {
  OperationalException,
  OperationalExceptionSeverity,
  OperationalExceptionStatus,
  OperationalReportType,
  ViewState,
  DailyWorklistItem,
  OperationalTask,
} from "../../types";
import {
  scanOperationalExceptions,
  generateTasksFromExceptions,
  resolveOperationalException,
  dismissOperationalException,
} from "../../services/exceptionService";
import {
  calculateOperationalKPIs,
  generateDailyOperationsWorklist,
  generateOperationalReport,
  exportOperationalReportToExcel,
  OperationalReportFilter,
} from "../../services/operationalControlService";
import { normalizeArabicText } from "../../utils/arabicTextNormalizer";

interface OperationalControlCenterProps {
  onNavigateToProperty?: (propertyId: string) => void;
  onNavigateToUnit?: (unitId: string) => void;
  onNavigateToTenant?: (tenantId: string) => void;
  onNavigateToOwner?: (ownerId: string) => void;
  onNavigateToLeases?: () => void;
  onNavigateToMaintenance?: () => void;
  onNavigateToCases?: () => void;
  onNavigateToDocuments?: () => void;
  onNavigateToTasks?: () => void;
  onNavigateToBouncedCheques?: () => void;
  onNavigateToFinancials?: () => void;
}

export const OperationalControlCenter: React.FC<OperationalControlCenterProps> = ({
  onNavigateToProperty,
  onNavigateToUnit,
  onNavigateToTenant,
  onNavigateToOwner,
  onNavigateToLeases,
  onNavigateToMaintenance,
  onNavigateToCases,
  onNavigateToDocuments,
  onNavigateToTasks,
  onNavigateToBouncedCheques,
  onNavigateToFinancials,
}) => {
  const { language } = useLanguage();
  const { canGoBack } = useNavigation();
  const isAr = language === "ar";
  const { currentUser, hasPermission } = useAuth();
  const {
    owners,
    properties,
    units,
    tenants,
    leases,
    cheques,
    cases,
    maintenanceRequests,
    ownerTransfers,
    commissions,
    archive,
    notifications,
    paymentPromises,
    collectionActions,
    companyProfile,
    logAudit,
  } = useData();

  // Local demo tasks state
  const [tasks, setTasks] = useState<OperationalTask[]>(() => {
    return [
      {
        id: "task-init-01",
        taskNumber: "TSK-0001",
        title: isAr ? "متابعة تجديد عقد إيجار برج الصقر" : "Follow up Falcon Tower Lease Renewal",
        description: isAr ? "التواصل مع المستأجر لبحث تجديد العقد" : "Contact tenant regarding renewal",
        priority: "HIGH",
        status: "OPEN",
        dueDate: "2026-06-30",
        createdAt: "2026-01-15",
        createdById: "admin",
        assignedUserName: "Property Manager",
      },
    ];
  });

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<"DASHBOARD" | "WORKLIST" | "EXCEPTIONS" | "REPORTS">("DASHBOARD");

  // State for Exceptions
  const rawExceptions = useMemo(() => {
    return scanOperationalExceptions({
      owners,
      properties,
      units,
      tenants,
      leases,
      cheques,
      cases,
      maintenanceRequests,
      ownerTransfers,
      commissions,
      tasks,
      paymentPromises,
      collectionActions,
    });
  }, [owners, properties, units, tenants, leases, cheques, cases, maintenanceRequests, ownerTransfers, commissions, tasks, paymentPromises, collectionActions]);

  const [exceptions, setExceptions] = useState<OperationalException[]>(rawExceptions);

  // Exception Filters
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [entityFilter, setEntityFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Resolution / Dismissal Modal State
  const [selectedExceptionForAction, setSelectedExceptionForAction] = useState<OperationalException | null>(null);
  const [actionType, setActionType] = useState<"RESOLVE" | "DISMISS" | null>(null);
  const [actionNote, setActionNote] = useState<string>("");
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Report State
  const [selectedReportType, setSelectedReportType] = useState<OperationalReportType>("EXCEPTIONS");
  const [reportDateFrom, setReportDateFrom] = useState<string>("");
  const [reportDateTo, setReportDateTo] = useState<string>("");
  const [reportPropertyId, setReportPropertyId] = useState<string>("");
  const [reportGroupBy, setReportGroupBy] = useState<"CATEGORY" | "STATUS" | "PROPERTY" | "TENANT" | "NONE">("CATEGORY");

  // KPI Calculations
  const kpis = useMemo(() => {
    return calculateOperationalKPIs(
      {
        owners,
        properties,
        units,
        tenants,
        leases,
        cheques,
        cases,
        maintenanceRequests,
        ownerTransfers,
        commissions,
        tasks,
        paymentPromises,
        collectionActions,
      },
      exceptions
    );
  }, [owners, properties, units, tenants, leases, cheques, cases, maintenanceRequests, ownerTransfers, commissions, tasks, paymentPromises, collectionActions, exceptions]);

  // Worklist Generation
  const worklistSections = useMemo(() => {
    return generateDailyOperationsWorklist(
      {
        owners,
        properties,
        units,
        tenants,
        leases,
        cheques,
        cases,
        maintenanceRequests,
        ownerTransfers,
        commissions,
        tasks,
        paymentPromises,
        collectionActions,
      },
      exceptions
    );
  }, [owners, properties, units, tenants, leases, cheques, cases, maintenanceRequests, ownerTransfers, commissions, tasks, paymentPromises, collectionActions, exceptions]);

  // Filtered Exceptions
  const filteredExceptions = useMemo(() => {
    return exceptions.filter((exc) => {
      if (severityFilter !== "ALL" && exc.severity !== severityFilter) return false;
      if (statusFilter !== "ALL" && exc.status !== statusFilter) return false;
      if (entityFilter !== "ALL" && exc.sourceEntity !== entityFilter) return false;

      if (searchQuery.trim()) {
        const q = normalizeArabicText((searchQuery || "").toLowerCase());
        const tAr = normalizeArabicText((exc.titleAr || "").toLowerCase());
        const tEn = (exc.titleEn || "").toLowerCase();
        const dAr = normalizeArabicText((exc.descriptionAr || "").toLowerCase());
        const num = (exc.exceptionNumber || "").toLowerCase();
        if (!tAr.includes(q) && !tEn.includes(q) && !dAr.includes(q) && !num.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [exceptions, severityFilter, statusFilter, entityFilter, searchQuery]);

  // Generated Operational Report
  const currentReportResult = useMemo(() => {
    return generateOperationalReport(
      selectedReportType,
      {
        owners,
        properties,
        units,
        tenants,
        leases,
        cheques,
        cases,
        maintenanceRequests,
        ownerTransfers,
        commissions,
        tasks,
        paymentPromises,
        collectionActions,
      },
      exceptions,
      {
        dateFrom: reportDateFrom || undefined,
        dateTo: reportDateTo || undefined,
        propertyId: reportPropertyId || undefined,
        groupBy: reportGroupBy,
      }
    );
  }, [selectedReportType, owners, properties, units, tenants, leases, cheques, cases, maintenanceRequests, ownerTransfers, commissions, tasks, paymentPromises, collectionActions, exceptions, reportDateFrom, reportDateTo, reportPropertyId, reportGroupBy]);

  // Auto-generate tasks handler
  const handleAutoGenerateTasks = () => {
    const { newTasks, duplicateCount } = generateTasksFromExceptions(exceptions, tasks);
    if (newTasks.length > 0) {
      setTasks((prev) => [...prev, ...newTasks]);
      setFeedbackMessage({
        text: isAr
          ? `تم إنشاء ${newTasks.length} مهمة أوتوماتيكية بنجاح (${duplicateCount} مهمة مكررة تم منعها)`
          : `Generated ${newTasks.length} automated tasks (${duplicateCount} duplicate tasks prevented).`,
        type: "success",
      });
      logAudit(
        "TASK_CREATED" as any,
        "TASK" as any,
        "BATCH_AUTOPILOT",
        "Automated Task Generation",
        `Generated ${newTasks.length} tasks from active critical exceptions.`
      );
    } else {
      setFeedbackMessage({
        text: isAr ? "جميع المهام التشغيلية محدثة ولا توجد مهام جديدة مطلوبة" : "All operational tasks are up to date.",
        type: "success",
      });
    }
  };

  // Resolve Exception Action
  const handleResolveException = () => {
    if (!selectedExceptionForAction) return;
    const user = { id: currentUser?.id || "admin", name: currentUser?.nameAr || currentUser?.username || "Admin" };
    const res = resolveOperationalException(selectedExceptionForAction, actionNote, user);

    if (res.success && res.updatedException) {
      setExceptions((prev) =>
        prev.map((e) => (e.id === selectedExceptionForAction.id ? res.updatedException! : e))
      );
      logAudit(
        "EDIT_PAYMENT_PROMISE" as any,
        "COMMUNICATION" as any,
        selectedExceptionForAction.id,
        selectedExceptionForAction.exceptionNumber,
        `Resolved exception #${selectedExceptionForAction.exceptionNumber}: ${actionNote}`
      );
      setSelectedExceptionForAction(null);
      setActionType(null);
      setActionNote("");
      setFeedbackMessage({
        text: isAr ? "تم حل الاستثناء وتحديث السجل بنجاح" : "Exception resolved successfully.",
        type: "success",
      });
    } else {
      setFeedbackMessage({ text: res.error || "Failed to resolve exception.", type: "error" });
    }
  };

  // Dismiss Exception Action
  const handleDismissException = () => {
    if (!selectedExceptionForAction) return;
    const user = { id: currentUser?.id || "admin", name: currentUser?.nameAr || currentUser?.username || "Admin" };
    const res = dismissOperationalException(selectedExceptionForAction, actionNote, user);

    if (res.success && res.updatedException) {
      setExceptions((prev) =>
        prev.map((e) => (e.id === selectedExceptionForAction.id ? res.updatedException! : e))
      );
      logAudit(
        "EDIT_PAYMENT_PROMISE" as any,
        "COMMUNICATION" as any,
        selectedExceptionForAction.id,
        selectedExceptionForAction.exceptionNumber,
        `Dismissed exception #${selectedExceptionForAction.exceptionNumber}. Reason: ${actionNote}`
      );
      setSelectedExceptionForAction(null);
      setActionType(null);
      setActionNote("");
      setFeedbackMessage({
        text: isAr ? "تم تجاهل الاستثناء وتوثيق السبب في سجل التدقيق" : "Exception dismissed with audit reason.",
        type: "success",
      });
    } else {
      setFeedbackMessage({ text: res.error || "A non-empty reason is required.", type: "error" });
    }
  };

  // Direct Drilldown Router
  const handleDrilldown = (item: DailyWorklistItem | OperationalException) => {
    const route = "actionRoute" in item ? item.actionRoute : undefined;
    if (!route) return;

    if (route.view === "LEASES" && onNavigateToLeases) onNavigateToLeases();
    else if (route.view === "MAINTENANCE" && onNavigateToMaintenance) onNavigateToMaintenance();
    else if (route.view === "CASES" && onNavigateToCases) onNavigateToCases();
    else if (route.view === "DOCUMENT_CONTROL" && onNavigateToDocuments) onNavigateToDocuments();
    else if (route.view === "TASK_CENTER" && onNavigateToTasks) onNavigateToTasks();
    else if (route.view === "BOUNCED_CHEQUES" && onNavigateToBouncedCheques) onNavigateToBouncedCheques();
    else if (route.view === "FINANCIALS" && onNavigateToFinancials) onNavigateToFinancials();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
            <Activity className="w-4 h-4" />
            <span>{isAr ? "مركز الرقابة التشغيلية والعمليات" : "Operational Control & Workflow Center"}</span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-black text-[10px] uppercase">
              Phase 25 Autopilot
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black">
            {isAr ? "لوحة القيادة والرقابة الاستثنائية اليومية" : "Operational Control & Exception Management"}
          </h1>
          <p className="text-xs text-slate-300">
            {isAr
              ? "مراقبة استباقية لانتهاء العقود، الوثائق، الشيكات المرتجعة، مصاريف الصيانة، وإدارة المهام التشغيلية"
              : "Proactive intelligence for lease renewals, document expiries, bounced cheques, and task automation."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleAutoGenerateTasks}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl transition shadow-xs cursor-pointer"
          >
            <Zap className="w-4 h-4 text-slate-950" />
            <span>{isAr ? "توليد المهام تلقائياً" : "Auto-Generate Tasks"}</span>
          </button>

          {canGoBack && <CloseBackButton variant="dark" />}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("DASHBOARD")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === "DASHBOARD" ? "bg-slate-900 text-white shadow-xs" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>{isAr ? "لوحة الرقابة والمؤشرات" : "Control Dashboard"}</span>
        </button>

        <button
          onClick={() => setActiveTab("WORKLIST")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === "WORKLIST" ? "bg-slate-900 text-white shadow-xs" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{isAr ? "قائمة العمليات اليومية (12 قسم)" : "Daily Worklist (12 Sections)"}</span>
        </button>

        <button
          onClick={() => setActiveTab("EXCEPTIONS")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === "EXCEPTIONS" ? "bg-slate-900 text-white shadow-xs" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>{isAr ? "إدارة الاستثناءات والملاحظات" : "Exceptions Management"}</span>
          {kpis.totalActiveExceptions > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
              {kpis.totalActiveExceptions}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("REPORTS")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === "REPORTS" ? "bg-slate-900 text-white shadow-xs" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{isAr ? "التقارير التشغيلية (14 تقريراً)" : "Operational Reports (14 Reports)"}</span>
        </button>
      </div>

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between ${
            feedbackMessage.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-rose-50 text-rose-900 border-rose-200"
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-slate-600 font-black cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: DASHBOARD (24 Clickable KPIs Matrix) */}
      {activeTab === "DASHBOARD" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* KPI 1 */}
            <div
              onClick={() => {
                setActiveTab("EXCEPTIONS");
                setSeverityFilter("CRITICAL");
              }}
              className="p-4 bg-rose-50/80 border border-rose-200 hover:border-rose-400 rounded-2xl cursor-pointer transition shadow-xs space-y-1.5"
            >
              <div className="text-[10px] font-black text-rose-700 uppercase">{isAr ? "استثناءات حرجة" : "Critical Alerts"}</div>
              <div className="text-2xl font-black text-rose-950">{kpis.criticalExceptionsCount}</div>
              <p className="text-[10px] text-rose-600">{isAr ? "تتطلب تدخلاً فورياً" : "Immediate action needed"}</p>
            </div>

            {/* KPI 2 */}
            <div
              onClick={() => {
                setActiveTab("WORKLIST");
              }}
              className="p-4 bg-amber-50/80 border border-amber-200 hover:border-amber-400 rounded-2xl cursor-pointer transition shadow-xs space-y-1.5"
            >
              <div className="text-[10px] font-black text-amber-700 uppercase">{isAr ? "مهام متأخرة" : "Overdue Tasks"}</div>
              <div className="text-2xl font-black text-amber-950">{kpis.overdueTasks}</div>
              <p className="text-[10px] text-amber-600">{isAr ? "تجاوزت تاريخ الاستحقاق" : "Past due date"}</p>
            </div>

            {/* KPI 3 */}
            <div
              onClick={() => {
                setActiveTab("WORKLIST");
              }}
              className="p-4 bg-blue-50/80 border border-blue-200 hover:border-blue-400 rounded-2xl cursor-pointer transition shadow-xs space-y-1.5"
            >
              <div className="text-[10px] font-black text-blue-700 uppercase">{isAr ? "تستحق اليوم" : "Due Today"}</div>
              <div className="text-2xl font-black text-blue-950">{kpis.tasksDueToday}</div>
              <p className="text-[10px] text-blue-600">{isAr ? "خطة العمل لليوم" : "Today's action items"}</p>
            </div>

            {/* KPI 4 */}
            <div
              onClick={() => {
                if (onNavigateToLeases) onNavigateToLeases();
              }}
              className="p-4 bg-indigo-50/80 border border-indigo-200 hover:border-indigo-400 rounded-2xl cursor-pointer transition shadow-xs space-y-1.5"
            >
              <div className="text-[10px] font-black text-indigo-700 uppercase">{isAr ? "عقود تنتهي قريباً" : "Expiring Leases"}</div>
              <div className="text-2xl font-black text-indigo-950">{kpis.expiringLeases}</div>
              <p className="text-[10px] text-indigo-600">{isAr ? "أقل من 60 يوماً" : "< 60 days remaining"}</p>
            </div>

            {/* KPI 5 */}
            <div
              onClick={() => {
                if (onNavigateToDocuments) onNavigateToDocuments();
              }}
              className="p-4 bg-purple-50/80 border border-purple-200 hover:border-purple-400 rounded-2xl cursor-pointer transition shadow-xs space-y-1.5"
            >
              <div className="text-[10px] font-black text-purple-700 uppercase">{isAr ? "وثائق تنتهي قريباً" : "Expiring Docs"}</div>
              <div className="text-2xl font-black text-purple-950">{kpis.expiringDocuments}</div>
              <p className="text-[10px] text-purple-600">{isAr ? "هويات، جوازات ورخص" : "EID, Trade Licenses"}</p>
            </div>

            {/* KPI 6 */}
            <div
              onClick={() => {
                if (onNavigateToBouncedCheques) onNavigateToBouncedCheques();
              }}
              className="p-4 bg-red-50/80 border border-red-200 hover:border-red-400 rounded-2xl cursor-pointer transition shadow-xs space-y-1.5"
            >
              <div className="text-[10px] font-black text-red-700 uppercase">{isAr ? "شيكات مرتجعة بدون دعوى" : "Bounced Cheques"}</div>
              <div className="text-2xl font-black text-red-950">{kpis.bouncedCheques}</div>
              <p className="text-[10px] text-red-600">{isAr ? "تتطلب فتح نزاع إيجاري" : "Legal case candidate"}</p>
            </div>
          </div>

          {/* Operational Quick Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-3xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs font-black text-slate-800">
                <span className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-600" />
                  {isAr ? "الصيانة والتكاليف" : "Maintenance & Costs"}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px]">
                  {kpis.openMaintenanceRequests} {isAr ? "طلب مفتوح" : "Open"}
                </span>
              </div>
              <div className="text-xs text-slate-600 space-y-1.5">
                <div className="flex justify-between">
                  <span>{isAr ? "صيانة معتمدة غير مرحلة:" : "Unposted Expenses:"}</span>
                  <span className="font-black text-rose-600">{kpis.unpostedMaintenanceExpenses}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isAr ? "إجمالي الطلبات المفتوحة:" : "Total Open Tickets:"}</span>
                  <span className="font-black text-slate-900">{kpis.openMaintenanceRequests}</span>
                </div>
              </div>
            </div>

            <div className="p-5 bg-white rounded-3xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs font-black text-slate-800">
                <span className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  {isAr ? "تحصيلات ودفعات الملاك" : "Transfers & Collections"}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
                  {kpis.pendingOwnerTransfers} {isAr ? "معلق" : "Pending"}
                </span>
              </div>
              <div className="text-xs text-slate-600 space-y-1.5">
                <div className="flex justify-between">
                  <span>{isAr ? "تحويلات بانتظار الاعتماد:" : "Pending Transfers:"}</span>
                  <span className="font-black text-slate-900">{kpis.pendingOwnerTransfers}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isAr ? "رسوم إدارية غير محصلة:" : "Pending Admin Fees:"}</span>
                  <span className="font-black text-amber-600">{kpis.pendingAdminFees}</span>
                </div>
              </div>
            </div>

            <div className="p-5 bg-white rounded-3xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs font-black text-slate-800">
                <span className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-indigo-600" />
                  {isAr ? "القضايا والوعود" : "Cases & Promises"}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px]">
                  {kpis.openLegalCases} {isAr ? "قضية" : "Cases"}
                </span>
              </div>
              <div className="text-xs text-slate-600 space-y-1.5">
                <div className="flex justify-between">
                  <span>{isAr ? "إخلال بوعود السداد:" : "Broken Promises:"}</span>
                  <span className="font-black text-rose-600">{kpis.brokenPaymentPromises}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isAr ? "قضايا مفتوحة في المحكمة:" : "Active RDC Cases:"}</span>
                  <span className="font-black text-slate-900">{kpis.openLegalCases}</span>
                </div>
              </div>
            </div>

            <div className="p-5 bg-white rounded-3xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs font-black text-slate-800">
                <span className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-purple-600" />
                  {isAr ? "المراسلات والتجديدات" : "Renewals & Comms"}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px]">
                  {kpis.pendingRenewals} {isAr ? "تجديد" : "Renewals"}
                </span>
              </div>
              <div className="text-xs text-slate-600 space-y-1.5">
                <div className="flex justify-between">
                  <span>{isAr ? "عقود قيد التفاوض:" : "Pending Renewals:"}</span>
                  <span className="font-black text-purple-600">{kpis.pendingRenewals}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isAr ? "إشعارات متعثرة:" : "Failed Comms:"}</span>
                  <span className="font-black text-rose-600">{kpis.failedCommunications}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DAILY OPERATIONS WORKLIST (12 Sections) */}
      {activeTab === "WORKLIST" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(worklistSections).map(([secKey, unknownItems]) => {
              const items = unknownItems as DailyWorklistItem[];
              if (items.length === 0) return null;
              return (
                <div key={secKey} className="p-5 bg-white rounded-3xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                      <span>{secKey.replace(/_/g, " ")}</span>
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-black text-[10px]">
                      {items.length}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-md font-black text-[9px] uppercase ${
                                item.priority === "URGENT" || item.severity === "CRITICAL"
                                  ? "bg-rose-100 text-rose-800"
                                  : item.priority === "HIGH" || item.severity === "HIGH"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {item.priority}
                            </span>
                            <span className="font-bold text-slate-900 truncate">
                              {isAr ? item.titleAr : item.titleEn}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1">
                            {isAr ? item.descriptionAr : item.descriptionEn}
                          </p>
                        </div>

                        <button
                          onClick={() => handleDrilldown(item)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] rounded-xl transition shrink-0 cursor-pointer flex items-center gap-1"
                        >
                          <span>{isAr ? "فتح" : "Open"}</span>
                          <ChevronRight className="w-3 h-3 rtl:rotate-180" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: EXCEPTION MANAGEMENT ENGINE */}
      {activeTab === "EXCEPTIONS" && (
        <div className="p-6 bg-white rounded-3xl border border-slate-200 space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={isAr ? "بحث في الاستثناءات والملاحظات..." : "Search exceptions..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="min-w-[170px]">
                <SearchableSelect
                  options={[
                    { id: "ALL", label: isAr ? "كافة درجات الخطورة" : "All Severities" },
                    { id: "CRITICAL", label: isAr ? "حرجة (Critical)" : "Critical" },
                    { id: "HIGH", label: isAr ? "عالية (High)" : "High" },
                    { id: "WARNING", label: isAr ? "تحذير (Warning)" : "Warning" },
                    { id: "INFORMATION", label: isAr ? "معلومات (Info)" : "Info" },
                  ]}
                  value={severityFilter}
                  onChange={(val) => setSeverityFilter(val)}
                  placeholder={isAr ? "درجة الخطورة..." : "Severity..."}
                />
              </div>

              <div className="min-w-[170px]">
                <SearchableSelect
                  options={[
                    { id: "ALL", label: isAr ? "كافة الحالات" : "All Statuses" },
                    { id: "OPEN", label: isAr ? "مفتوحة (Open)" : "Open" },
                    { id: "ACKNOWLEDGED", label: isAr ? "تم الإشعار (Acknowledged)" : "Acknowledged" },
                    { id: "RESOLVED", label: isAr ? "تمت المعالجة (Resolved)" : "Resolved" },
                    { id: "DISMISSED", label: isAr ? "تم التجاهل (Dismissed)" : "Dismissed" },
                  ]}
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val)}
                  placeholder={isAr ? "الحالة..." : "Status..."}
                />
              </div>
            </div>
          </div>

          {/* Exceptions Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
                  <th className="p-3">{isAr ? "الرقم" : "ID"}</th>
                  <th className="p-3">{isAr ? "الخطورة" : "Severity"}</th>
                  <th className="p-3">{isAr ? "العنوان والتفاصيل" : "Title & Details"}</th>
                  <th className="p-3">{isAr ? "الجهة" : "Entity"}</th>
                  <th className="p-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="p-3 text-right">{isAr ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExceptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                      {isAr ? "لا توجد استثناءات مسجلة مطابقة للبحث" : "No exceptions match the criteria."}
                    </td>
                  </tr>
                ) : (
                  filteredExceptions.map((exc) => (
                    <tr key={exc.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-mono font-black text-slate-900">{exc.exceptionNumber}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full font-black text-[10px] ${
                            exc.severity === "CRITICAL"
                              ? "bg-rose-100 text-rose-800"
                              : exc.severity === "HIGH"
                              ? "bg-amber-100 text-amber-800"
                              : exc.severity === "WARNING"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {exc.severity}
                        </span>
                      </td>
                      <td className="p-3 space-y-0.5 max-w-sm">
                        <div className="font-bold text-slate-900">{isAr ? exc.titleAr : exc.titleEn}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">
                          {isAr ? exc.descriptionAr : exc.descriptionEn}
                        </div>
                      </td>
                      <td className="p-3 font-bold text-slate-700">{exc.sourceEntity}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            exc.status === "RESOLVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : exc.status === "DISMISSED"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {exc.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1.5 rtl:space-x-reverse">
                        {exc.status !== "RESOLVED" && exc.status !== "DISMISSED" && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedExceptionForAction(exc);
                                setActionType("RESOLVE");
                                setActionNote("");
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition cursor-pointer"
                            >
                              {isAr ? "معالجة" : "Resolve"}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedExceptionForAction(exc);
                                setActionType("DISMISS");
                                setActionNote("");
                              }}
                              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[10px] rounded-lg transition cursor-pointer"
                            >
                              {isAr ? "تجاهل" : "Dismiss"}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDrilldown(exc)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] rounded-lg transition cursor-pointer"
                        >
                          {isAr ? "فتح السجل" : "View"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: 14 OPERATIONAL REPORTS */}
      {activeTab === "REPORTS" && (
        <div className="p-6 bg-white rounded-3xl border border-slate-200 space-y-6">
          {/* Report Setup Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">{isAr ? "نوع التقرير التشغيلي" : "Operational Report"}</label>
              <SearchableSelect
                options={[
                  { id: "EXCEPTIONS", label: isAr ? "1. تقرير الاستثناءات والملاحظات" : "1. Exceptions Report" },
                  { id: "OPERATIONAL_TASKS", label: isAr ? "2. تقرير المهام التشغيلية" : "2. Operational Tasks" },
                  { id: "OVERDUE_TASKS", label: isAr ? "3. تقرير المهام المتأخرة" : "3. Overdue Tasks" },
                  { id: "DOCUMENT_EXPIRY", label: isAr ? "4. تقرير انتهاء صلاحية الوثائق" : "4. Document Expiry" },
                  { id: "MISSING_DOCUMENTS", label: isAr ? "5. تقرير الوثائق الناقصة" : "5. Missing Documents" },
                  { id: "LEASE_RENEWAL_PIPELINE", label: isAr ? "6. تقرير خطة تجديد العقود" : "6. Lease Renewals Pipeline" },
                  { id: "BOUNCED_CHEQUE_FOLLOWUP", label: isAr ? "7. تقرير الشيكات المرتجعة" : "7. Bounced Cheques" },
                  { id: "MAINTENANCE_FOLLOWUP", label: isAr ? "8. تقرير متابعة الصيانة" : "8. Maintenance Follow-up" },
                  { id: "COMMUNICATION_ACTIVITY", label: isAr ? "9. تقرير المراسلات والإشعارات" : "9. Communication Activity" },
                  { id: "VACANCY_OPERATIONS", label: isAr ? "10. تقرير الوحدات الشاغرة" : "10. Vacancy Operations" },
                  { id: "PROPERTY_OPERATIONAL_PERFORMANCE", label: isAr ? "11. تقرير الأداء التشغيلي" : "11. Performance Report" },
                ]}
                value={selectedReportType}
                onChange={(val) => setSelectedReportType(val as any)}
                placeholder={isAr ? "نوع التقرير..." : "Report type..."}
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">{isAr ? "من تاريخ (شامل)" : "From Date (Inclusive)"}</label>
              <input
                type="date"
                value={reportDateFrom}
                onChange={(e) => setReportDateFrom(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">{isAr ? "إلى تاريخ (شامل)" : "To Date (Inclusive)"}</label>
              <input
                type="date"
                value={reportDateTo}
                onChange={(e) => setReportDateTo(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">{isAr ? "التجميع الفرعي" : "Group By"}</label>
              <SearchableSelect
                options={[
                  { id: "CATEGORY", label: isAr ? "حسب التصنيف" : "Category" },
                  { id: "STATUS", label: isAr ? "حسب الحالة" : "Status" },
                  { id: "PROPERTY", label: isAr ? "حسب العقار" : "Property" },
                  { id: "TENANT", label: isAr ? "حسب المستأجر" : "Tenant" },
                  { id: "NONE", label: isAr ? "بدون تجميع" : "None" },
                ]}
                value={reportGroupBy}
                onChange={(val) => setReportGroupBy(val as any)}
                placeholder={isAr ? "التجميع..." : "Group by..."}
              />
            </div>
          </div>

          {/* Report Actions & Export */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {isAr ? currentReportResult.titleAr : currentReportResult.titleEn}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAr ? `إجمالي السجلات: ${currentReportResult.totalCount}` : `Total Records: ${currentReportResult.totalCount}`}
                {currentReportResult.totalAmount && ` • ${isAr ? "الإجمالي المالي:" : "Total:"} ${currentReportResult.totalAmount.toLocaleString()} AED`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => exportOperationalReportToExcel(currentReportResult, companyProfile, language)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isAr ? "تصدير إكسل" : "Excel"}</span>
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isAr ? "طباعة" : "Print"}</span>
              </button>
            </div>
          </div>

          {/* Grouped Table View */}
          <div className="space-y-4">
            {Object.entries(currentReportResult.groupedRows || {}).map(([grpKey, unknownGrpData]) => {
              const grpData = unknownGrpData as { subtotalCount: number; subtotalAmount?: number; rows: any[] };
              return (
              <div key={grpKey} className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 text-xs font-black text-slate-800 flex items-center justify-between">
                  <span>{grpKey}</span>
                  <span>
                    {grpData.subtotalCount} {isAr ? "سجل" : "records"}
                    {grpData.subtotalAmount ? ` • ${grpData.subtotalAmount.toLocaleString()} AED` : ""}
                  </span>
                </div>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <th className="p-2.5">{isAr ? "المرجع" : "Ref"}</th>
                      <th className="p-2.5">{isAr ? "التاريخ" : "Date"}</th>
                      <th className="p-2.5">{isAr ? "العنوان" : "Title"}</th>
                      <th className="p-2.5">{isAr ? "الجهة" : "Entity"}</th>
                      <th className="p-2.5">{isAr ? "التصنيف" : "Category"}</th>
                      <th className="p-2.5">{isAr ? "الحالة" : "Status"}</th>
                      <th className="p-2.5 text-right">{isAr ? "المبلغ" : "Amount"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {grpData.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/60">
                        <td className="p-2.5 font-mono font-bold text-slate-900">{row.reference}</td>
                        <td className="p-2.5 text-slate-600">{row.date}</td>
                        <td className="p-2.5 font-bold text-slate-900">{row.title}</td>
                        <td className="p-2.5 text-slate-700">{row.entityName}</td>
                        <td className="p-2.5 text-slate-600">{row.category}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-[10px]">
                            {row.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-black text-slate-900">
                          {row.amount !== undefined ? `${row.amount.toLocaleString()} AED` : "---"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
            })}
          </div>
        </div>
      )}

      {/* Resolution & Dismissal Action Modal */}
      {selectedExceptionForAction && actionType && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-200 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900">
                {actionType === "RESOLVE"
                  ? isAr
                    ? "معالجة وحل الاستثناء التشغيلي"
                    : "Resolve Operational Exception"
                  : isAr
                  ? "تجاهل الاستثناء وتوثيق السبب"
                  : "Dismiss Exception with Justification"}
              </h3>
              <button
                onClick={() => setSelectedExceptionForAction(null)}
                className="text-slate-400 hover:text-slate-600 font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
              <div className="font-bold text-slate-900">
                {isAr ? selectedExceptionForAction.titleAr : selectedExceptionForAction.titleEn}
              </div>
              <div className="text-[11px] text-slate-500">
                {isAr ? selectedExceptionForAction.descriptionAr : selectedExceptionForAction.descriptionEn}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {actionType === "RESOLVE"
                  ? isAr
                    ? "ملاحظات وتفاصيل المعالجة (إلزامي)"
                    : "Resolution Notes (Mandatory)"
                  : isAr
                  ? "سبب التجاهل ومبرر الإغلاق (إلزامي)"
                  : "Dismissal Reason (Mandatory)"}
              </label>
              <textarea
                rows={3}
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder={isAr ? "اكتب تفاصيل الإجراء المتخذ..." : "Enter action notes..."}
                className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedExceptionForAction(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={actionType === "RESOLVE" ? handleResolveException : handleDismissException}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                {actionType === "RESOLVE" ? (isAr ? "تأكيد المعالجة" : "Confirm Resolution") : (isAr ? "تأكيد التجاهل" : "Confirm Dismissal")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
