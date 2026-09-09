import React, { useState, useMemo, useEffect } from "react";
import {
  Wrench,
  Plus,
  Search,
  Filter,
  Building,
  Home,
  User,
  Phone,
  Calendar,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Settings,
  Briefcase,
  Printer,
  FileSpreadsheet,
  Trash2,
  Eye,
  Paperclip,
  Image as ImageIcon,
  Receipt,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useNavigation } from "../../context/NavigationContext";
import { CloseBackButton } from "../common/CloseBackButton";
import {
  MaintenanceRequest,
  MaintenanceStatus,
  MaintenancePriority,
  CostBearer,
} from "../../types";
import { Badge } from "../common/Badge";
import { KpiCard } from "../common/KpiCard";
import { NewMaintenanceModal } from "./NewMaintenanceModal";
import { MaintenanceDetailsModal } from "./MaintenanceDetailsModal";
import { TechniciansModal } from "./TechniciansModal";
import { MaintenanceSettingsModal } from "./MaintenanceSettingsModal";
import { OwnerMaintenanceStatementModal } from "./OwnerMaintenanceStatementModal";
import { ConfirmDeleteModal } from "../common/ConfirmDeleteModal";
import { matchAnyArabicSearch } from "../../utils/arabicTextNormalizer";
import { SearchableSelect } from "../common/SearchableSelect";

export const MaintenanceView: React.FC = () => {
  const { canGoBack } = useNavigation();
  const {
    maintenanceRequests,
    properties,
    units,
    tenants,
    owners,
    technicians,
    maintenanceSettings,
    deleteMaintenanceRequest,
    updateMaintenanceStatus,
    archive,
  } = useData();

  const { t, language, formatAED } = useLanguage();
  const { currentUser, hasPermission } = useAuth();

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [propertyFilter, setPropertyFilter] = useState<string>("ALL");
  const [costBearerFilter, setCostBearerFilter] = useState<string>("ALL");

  // Modals State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedRequestForDetails, setSelectedRequestForDetails] =
    useState<MaintenanceRequest | null>(null);
  const [isTechniciansModalOpen, setIsTechniciansModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] =
    useState<MaintenanceRequest | null>(null);

  // URL query params listener for deep-linked print requests
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // 1. Auto-open Owner Maintenance Statement
    if (params.get("printOwnerStatement") === "true") {
      setIsStatementModalOpen(true);
    }

    // 2. Auto-open Work Order Details
    const workOrderId = params.get("printWorkOrderId");
    if (workOrderId && maintenanceRequests.length > 0) {
      const found = maintenanceRequests.find((r) => r.id === workOrderId);
      if (found) {
        setSelectedRequestForDetails(found);
        
        // Clear work order query param to prevent loop
        const url = new URL(window.location.href);
        url.searchParams.delete("printWorkOrderId");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [maintenanceRequests]);

  // SLA Threshold in Hours
  const delayedDaysThreshold = maintenanceSettings?.delayedDaysThreshold || 5;

  // Delayed Check Helper
  const isRequestDelayed = (req: MaintenanceRequest) => {
    if (
      req.status === "COMPLETED" ||
      req.status === "CANCELLED" ||
      req.status === "REJECTED"
    ) {
      return false;
    }
    const created = new Date(req.createdAt || req.requestDate);
    const now = new Date();
    const elapsedDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return elapsedDays > delayedDaysThreshold;
  };

  // KPIs Calculation
  const totalCount = maintenanceRequests.length;
  const openCount = maintenanceRequests.filter((r) => r.status === "OPEN").length;
  const inProgressCount = maintenanceRequests.filter(
    (r) => r.status === "IN_PROGRESS"
  ).length;
  const urgentCount = maintenanceRequests.filter(
    (r) =>
      r.priority === "URGENT" &&
      r.status !== "COMPLETED" &&
      r.status !== "CANCELLED" &&
      r.status !== "REJECTED"
  ).length;
  const completedCount = maintenanceRequests.filter(
    (r) => r.status === "COMPLETED"
  ).length;
  
  const completedUnpaidCount = maintenanceRequests.filter(
    (r) => r.status === "COMPLETED" && r.collectionStatus === "UNPAID"
  ).length;
  const completedPartiallyPaidCount = maintenanceRequests.filter(
    (r) => r.status === "COMPLETED" && r.collectionStatus === "PARTIALLY_PAID"
  ).length;
  const completedPaidCount = maintenanceRequests.filter(
    (r) => r.status === "COMPLETED" && r.collectionStatus === "PAID"
  ).length;

  const delayedRequests = maintenanceRequests.filter(isRequestDelayed);
  const delayedCount = delayedRequests.length;

  const totalCost = maintenanceRequests.reduce((sum, r) => sum + (r.totalCost || 0), 0);
  const paidCost = maintenanceRequests.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
  const remainingCost = maintenanceRequests.reduce(
    (sum, r) => sum + (r.remainingAmount || 0),
    0
  );

  // Filtered List
  const filteredRequests = useMemo(() => {
    return maintenanceRequests.filter((req) => {
      // Status Filter
      if (statusFilter === "DELAYED") {
        if (!isRequestDelayed(req)) return false;
      } else if (statusFilter !== "ALL" && req.status !== statusFilter) {
        return false;
      }

      // Priority Filter
      if (priorityFilter !== "ALL" && req.priority !== priorityFilter) {
        return false;
      }

      // Category Filter
      if (categoryFilter !== "ALL" && req.category !== categoryFilter) {
        return false;
      }

      // Property Filter
      if (propertyFilter !== "ALL" && req.propertyId !== propertyFilter) {
        return false;
      }

      // Cost Bearer Filter
      if (costBearerFilter !== "ALL" && req.costBearer !== costBearerFilter) {
        return false;
      }

      // Search Query Filter
      if (searchTerm.trim()) {
        const prop = properties.find((p) => p.id === req.propertyId);
        const u = units.find((un) => un.id === req.unitId);
        const tnt = req.tenantId ? tenants.find((t) => t.id === req.tenantId) : null;
        const own = req.ownerId ? owners.find((o) => o.id === req.ownerId) : null;

        const searchableFields = [
          req.requestNumber,
          req.issueDescription,
          req.category,
          req.requestedBy,
          req.requesterPhone,
          req.assignedTechnicianName,
          req.assignedTechnicianCompany,
          prop?.nameAr,
          prop?.nameEn,
          u?.unitNumber,
          tnt?.nameAr,
          tnt?.nameEn,
          own?.nameAr,
          own?.nameEn,
        ];

        const match = matchAnyArabicSearch(searchableFields, searchTerm);
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      const statusWeight = (status: MaintenanceStatus) => {
        switch (status) {
          case "RETURNED": return 1;
          case "OPEN": return 2;
          case "IN_PROGRESS": return 3;
          case "COMPLETED": return 4;
          case "REJECTED": return 5;
          case "CANCELLED": return 6;
          default: return 3;
        }
      };
      const wA = statusWeight(a.status);
      const wB = statusWeight(b.status);
      if (wA !== wB) return wA - wB;
      return new Date(b.requestDate || "").getTime() - new Date(a.requestDate || "").getTime();
    });
  }, [
    maintenanceRequests,
    statusFilter,
    priorityFilter,
    categoryFilter,
    propertyFilter,
    costBearerFilter,
    searchTerm,
    properties,
    units,
    tenants,
    owners,
    delayedDaysThreshold,
  ]);

  const handleDeleteRequest = (req: MaintenanceRequest, e: React.MouseEvent) => {
    e.stopPropagation();
    setRequestToDelete(req);
  };

  const confirmDelete = (options?: { keepAttachments?: boolean; reason?: string }) => {
    if (requestToDelete) {
      deleteMaintenanceRequest(requestToDelete.id, options);
      setRequestToDelete(null);
    }
  };

  const getPriorityBadge = (p: MaintenancePriority) => {
    switch (p) {
      case "URGENT":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white uppercase tracking-wider shadow-2xs">
            {t("maintPriority_URGENT")}
          </span>
        );
      case "HIGH":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 uppercase tracking-wider">
            {t("maintPriority_HIGH")}
          </span>
        );
      case "NORMAL":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800">
            {t("maintPriority_NORMAL")}
          </span>
        );
      case "LOW":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
            {t("maintPriority_LOW")}
          </span>
        );
    }
  };

  const getStatusBadge = (s: MaintenanceStatus) => {
    switch (s) {
      case "OPEN":
        return <Badge variant="warning">{t("maintStatus_OPEN")}</Badge>;
      case "IN_PROGRESS":
        return <Badge variant="info">{t("maintStatus_IN_PROGRESS")}</Badge>;
      case "COMPLETED":
        return <Badge variant="success">{t("maintStatus_COMPLETED")}</Badge>;
      case "REJECTED":
        return <Badge variant="danger">{t("maintStatus_REJECTED")}</Badge>;
      case "CANCELLED":
        return <Badge variant="neutral">{t("maintStatus_CANCELLED")}</Badge>;
      case "RETURNED":
        return <Badge variant="warning">{t("maintStatus_RETURNED")}</Badge>;
    }
  };

  return (
    <div
      id="maintenance-view-container"
      className="space-y-6 animate-in fade-in duration-150"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-600 flex items-center justify-center border border-amber-400/30">
              <Wrench className="w-4 h-4" />
            </div>
            <span>{t("maintDashboard")}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {language === "ar"
              ? "نظام إدارة ومتابعة طلبات الصيانة، تكليف الفنيين، الفواتير، وكشوفات مصاريف الملاك"
              : "Integrated maintenance requests, technicians dispatch, invoices & owner expense statements"}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {hasPermission("CREATE_MAINTENANCE") && (
            <button
              id="btn-new-maintenance-request"
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t("maintNewRequest")}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsTechniciansModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Briefcase className="w-4 h-4 text-sky-600" />
            <span>{t("maintTechnicians")}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsStatementModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{t("maintExportStatement")}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(true)}
            title={t("maintSettings")}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-all cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-600" />
          </button>

          {canGoBack && <CloseBackButton />}
        </div>
      </div>

      {/* Delayed SLA Warning Banner */}
      {delayedCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-rose-900">
                {t("maintDelayedWarning")}
              </h4>
              <p className="text-[11px] text-rose-700 mt-0.5">
                {language === "ar"
                  ? `يوجد ${delayedCount} طلب صيانة نشط تجاوزت فترة المتابعة القصوى (${delayedDaysThreshold} أيام) دون إنجاز.`
                  : `There are ${delayedCount} active requests exceeding the SLA limit (${delayedDaysThreshold} days).`}
              </p>
            </div>
          </div>

          <button
            onClick={() => setStatusFilter("DELAYED")}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            {language === "ar" ? "عرض الطلبات المتأخرة" : "View Delayed Requests"}
          </button>
        </div>
      )}

      {/* Executive KPIs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div
          onClick={() => setStatusFilter("ALL")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === "ALL"
              ? "bg-slate-900 text-white border-slate-900 shadow-md"
              : "bg-white text-slate-900 border-slate-200 shadow-2xs hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold opacity-80">{t("maintTotalRequests")}</span>
            <Wrench className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-end justify-between mt-2">
            <p className="text-xl font-black font-mono">{totalCount}</p>
            <p className="text-[10px] opacity-70 mb-0.5">{language === "ar" ? "الإجمالي:" : "Total:"} {formatAED(totalCost)}</p>
          </div>
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/20 text-[9px] font-medium opacity-90">
            <span>{language === "ar" ? "محصل:" : "Paid:"} {formatAED(paidCost)}</span>
            <span>{language === "ar" ? "متبقي:" : "Rem:"} {formatAED(remainingCost)}</span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter("OPEN")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === "OPEN"
              ? "bg-amber-500 text-slate-950 border-amber-600 shadow-md"
              : "bg-white text-slate-900 border-slate-200 shadow-2xs hover:border-amber-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-900">{t("maintOpenRequestsCount")}</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl font-black mt-2 text-amber-950 font-mono">{openCount}</p>
          <p className="text-[10px] text-amber-800 mt-0.5">
            {language === "ar" ? "بانتظار الإجراء" : "Pending Action"}
          </p>
        </div>

        <div
          onClick={() => setStatusFilter("IN_PROGRESS")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === "IN_PROGRESS"
              ? "bg-sky-600 text-white border-sky-700 shadow-md"
              : "bg-white text-slate-900 border-slate-200 shadow-2xs hover:border-sky-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-900">{t("maintInProgressCount")}</span>
            <Briefcase className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-xl font-black mt-2 text-sky-950 font-mono">{inProgressCount}</p>
          <p className="text-[10px] text-sky-700 mt-0.5">
            {language === "ar" ? "قيد المعاينة والإصلاح" : "Under Repair"}
          </p>
        </div>

        <div
          onClick={() => {
            setStatusFilter("ALL");
            setPriorityFilter("URGENT");
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            priorityFilter === "URGENT"
              ? "bg-rose-600 text-white border-rose-700 shadow-md"
              : "bg-white text-slate-900 border-slate-200 shadow-2xs hover:border-rose-300"
          } ${urgentCount > 0 ? "urgent-flicker border-rose-500" : ""}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-900">{t("maintUrgentAlertsCount")}</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl font-black mt-2 text-rose-950 font-mono">{urgentCount}</p>
          <p className="text-[10px] text-rose-700 mt-0.5">
            {language === "ar" ? "أولوية طارئة" : "Critical Priority"}
          </p>
        </div>

        <div
          onClick={() => setStatusFilter("COMPLETED")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === "COMPLETED"
              ? "bg-emerald-700 text-white border-emerald-800 shadow-md"
              : "bg-white text-slate-900 border-slate-200 shadow-2xs hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold ${statusFilter === "COMPLETED" ? "text-emerald-50" : "text-emerald-900"}`}>{t("maintCompletedCount")}</span>
            <CheckCircle2 className={`w-4 h-4 ${statusFilter === "COMPLETED" ? "text-emerald-300" : "text-emerald-600"}`} />
          </div>
          <p className={`text-xl font-black mt-2 font-mono ${statusFilter === "COMPLETED" ? "text-white" : "text-emerald-950"}`}>{completedCount}</p>
          <div className={`flex items-center gap-2 mt-2 pt-2 border-t text-[9px] font-bold ${statusFilter === "COMPLETED" ? "border-emerald-600" : "border-emerald-900/10"}`}>
            <span className={statusFilter === "COMPLETED" ? "text-rose-300" : "text-rose-600"} title="غير محصل">{completedUnpaidCount}</span> •
            <span className={statusFilter === "COMPLETED" ? "text-amber-300" : "text-amber-600"} title="محصل جزئياً">{completedPartiallyPaidCount}</span> •
            <span className={statusFilter === "COMPLETED" ? "text-emerald-300" : "text-emerald-700"} title="محصل بالكامل">{completedPaidCount}</span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter("DELAYED")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === "DELAYED"
              ? "bg-rose-700 text-white border-rose-800 shadow-md"
              : "bg-white text-slate-900 border-slate-200 shadow-2xs hover:border-rose-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-900">{t("maintDelayedRequests")}</span>
            <Clock className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl font-black mt-2 text-rose-950 font-mono">{delayedCount}</p>
          <p className="text-[10px] text-rose-700 mt-0.5">
            {language === "ar" ? `تجاوزت ${delayedDaysThreshold} أيام` : `Over ${delayedDaysThreshold}d`}
          </p>
        </div>
      </div>

      {/* Filter and Search Box */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        {/* Status Tab Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: "ALL", label: t("maintAllRequests"), count: totalCount },
            { id: "OPEN", label: t("maintOpen"), count: openCount },
            { id: "IN_PROGRESS", label: t("maintInProgress"), count: inProgressCount },
            { id: "COMPLETED", label: t("maintCompleted"), count: completedCount },
            { id: "DELAYED", label: t("maintDelayedRequests"), count: delayedCount },
            {
              id: "RETURNED",
              label: t("maintStatus_RETURNED"),
              count: maintenanceRequests.filter((r) => r.status === "RETURNED").length,
            },
            {
              id: "REJECTED",
              label: t("maintRejected"),
              count: maintenanceRequests.filter(
                (r) => r.status === "REJECTED" || r.status === "CANCELLED"
              ).length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                if (tab.id !== "ALL") setPriorityFilter("ALL");
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  statusFilter === tab.id
                    ? "bg-amber-400 text-slate-950"
                    : "bg-white text-slate-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Dropdown Filters & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute top-3 start-3.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                language === "ar"
                  ? "بحث برقم الطلب، الوحدة، العقار، المستأجر، المشكلة، الفني..."
                  : "Search request #, unit, property, tenant, issue..."
              }
              className="w-full ps-10 pe-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
            />
          </div>

          {/* Property Filter */}
          <div>
            <SearchableSelect
              options={[
                { id: "ALL", label: language === "ar" ? "كافة العقارات" : "All Properties" },
                ...properties.map((p) => ({
                  id: p.id,
                  label: p.nameAr || p.nameEn,
                })),
              ]}
              value={propertyFilter}
              onChange={(val) => setPropertyFilter(val)}
              placeholder={language === "ar" ? "تصفية حسب العقار..." : "Property..."}
              searchPlaceholder={language === "ar" ? "ابحث عن عقار..." : "Search property..."}
            />
          </div>

          {/* Priority Filter */}
          <div>
            <SearchableSelect
              options={[
                { id: "ALL", label: language === "ar" ? "كافة مستويات الأولوية" : "All Priorities" },
                { id: "URGENT", label: t("maintPriority_URGENT") },
                { id: "HIGH", label: t("maintPriority_HIGH") },
                { id: "NORMAL", label: t("maintPriority_NORMAL") },
                { id: "LOW", label: t("maintPriority_LOW") },
              ]}
              value={priorityFilter}
              onChange={(val) => setPriorityFilter(val)}
              placeholder={language === "ar" ? "الأولوية..." : "Priority..."}
              searchPlaceholder={language === "ar" ? "ابحث بالأولوية..." : "Search priority..."}
            />
          </div>

          {/* Category Filter */}
          <div>
            <SearchableSelect
              options={[
                { id: "ALL", label: language === "ar" ? "كافة أنواع الصيانة" : "All Categories" },
                { id: "سباكة", label: "سباكة (Plumbing)" },
                { id: "كهرباء", label: "كهرباء (Electrical)" },
                { id: "تكييف", label: "تكييف (HVAC)" },
                { id: "مصاعد", label: "مصاعد (Elevator)" },
                { id: "نجارة", label: "نجارة (Carpentry)" },
                { id: "ألمنيوم وزجاج", label: "ألمنيوم وزجاج (Aluminum)" },
                { id: "دهانات", label: "دهانات (Painting)" },
                { id: "مكافحة حشرات", label: "مكافحة حشرات (Pest Control)" },
                { id: "أخرى", label: "أخرى (Other)" },
              ]}
              value={categoryFilter}
              onChange={(val) => setCategoryFilter(val)}
              placeholder={language === "ar" ? "نوع الصيانة..." : "Category..."}
              searchPlaceholder={language === "ar" ? "ابحث بنوع الصيانة..." : "Search category..."}
            />
          </div>
        </div>
      </div>

      {/* Main Request Table & Cards View */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Table View (Desktop & Tablet) */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="p-3.5 text-start">{t("maintRequestNumber")}</th>
                <th className="p-3.5 text-start">{t("maintProperty")} & {language === "ar" ? "الوحدة" : "Unit"}</th>
                <th className="p-3.5 text-start">{t("maintCategory")}</th>
                <th className="p-3.5 text-start">{t("maintPriority")}</th>
                <th className="p-3.5 text-start">{t("maintStatus")}</th>
                <th className="p-3.5 text-start">{language === "ar" ? "حالة التحصيل" : "Collection Status"}</th>
                <th className="p-3.5 text-end">{t("maintTotalCost")}</th>
                <th className="p-3.5 text-end">{language === "ar" ? "المحصل" : "Collected"}</th>
                <th className="p-3.5 text-end">{language === "ar" ? "المتبقي" : "Remaining"}</th>
                <th className="p-3.5 text-center">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.length > 0 ? (
                filteredRequests.map((req) => {
                  const prop = properties.find((p) => p.id === req.propertyId);
                  const u = units.find((un) => un.id === req.unitId);
                  const tnt = req.tenantId ? tenants.find((t) => t.id === req.tenantId) : null;
                  const isDelayed = isRequestDelayed(req);

                  return (
                    <tr
                      key={req.id}
                      onClick={() => setSelectedRequestForDetails(req)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                        req.priority === "URGENT" &&
                        req.status !== "COMPLETED" &&
                        req.status !== "CANCELLED" &&
                        req.status !== "REJECTED"
                          ? "urgent-flicker"
                          : ""
                      }`}
                    >
                      {/* Request Number & Date */}
                      <td className="p-3.5">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-slate-900 group-hover:text-amber-800">
                            {req.requestNumber}
                          </span>
                          <span className="text-[11px] text-slate-400 mt-0.5">
                            {req.requestDate}
                          </span>
                          {isDelayed && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 mt-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{language === "ar" ? "متأخر SLA" : "Delayed"}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Property & Unit */}
                      <td className="p-3.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">
                            {prop?.nameAr || prop?.nameEn || "—"}
                          </span>
                          <span className="text-[11px] text-slate-600 font-semibold mt-0.5">
                            {language === "ar" ? "وحدة: " : "Unit: "}
                            {u?.unitNumber || "—"}
                          </span>
                          {tnt && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                              {tnt.nameAr || tnt.nameEn}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-semibold text-[11px]">
                          {req.category}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="p-3.5">{getPriorityBadge(req.priority)}</td>

                      {/* Status */}
                      <td className="p-3.5">{getStatusBadge(req.status)}</td>

                      {/* Collection Status */}
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                          req.collectionStatus === "PAID" ? "bg-emerald-100 text-emerald-800" :
                          req.collectionStatus === "PARTIALLY_PAID" ? "bg-amber-100 text-amber-800" :
                          "bg-rose-100 text-rose-800"
                        }`}>
                          {req.collectionStatus === "PAID" ? (language === "ar" ? "محصل بالكامل" : "Fully Paid") :
                           req.collectionStatus === "PARTIALLY_PAID" ? (language === "ar" ? "محصل جزئياً" : "Partially Paid") :
                           (language === "ar" ? "غير محصل" : "Unpaid")}
                        </span>
                      </td>

                      {/* Cost & Bearer */}
                      <td className="p-3.5 text-end">
                        <div className="flex flex-col items-end">
                          <span className="font-mono font-black text-slate-900 text-xs">
                            {formatAED(req.totalCost || 0)}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold mt-0.5">
                            {t(`maintBearer${req.costBearer}` as any)}
                          </span>
                        </div>
                      </td>

                      {/* Paid Amount */}
                      <td className="p-3.5 text-end">
                        <span className="font-mono font-bold text-emerald-700 text-xs">
                          {formatAED(req.paidAmount || 0)}
                        </span>
                      </td>

                      {/* Remaining Amount */}
                      <td className="p-3.5 text-end">
                        <span className="font-mono font-bold text-rose-600 text-xs">
                          {formatAED(req.remainingAmount || 0)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        <div
                          className="flex items-center justify-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedRequestForDetails(req)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
                            title={t("view")}
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {hasPermission("DELETE_MAINTENANCE") && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteRequest(req, e)}
                              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                              title={t("delete")}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    <div className="max-w-sm mx-auto space-y-2">
                      <Wrench className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-600">
                        {t("noDataFound")}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {language === "ar"
                          ? "لم يتم العثور على طلبات صيانة تطابق شروط التصفية والبحث."
                          : "No maintenance requests match the current filters."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: NEW MAINTENANCE REQUEST */}
      {isNewModalOpen && (
        <NewMaintenanceModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
        />
      )}

      {/* MODAL 2: 360 DETAILS MODAL */}
      {selectedRequestForDetails && (
        <MaintenanceDetailsModal
          request={
            maintenanceRequests.find((r) => r.id === selectedRequestForDetails.id) ||
            selectedRequestForDetails
          }
          isOpen={!!selectedRequestForDetails}
          onClose={() => setSelectedRequestForDetails(null)}
          onDelete={(req) => {
            setSelectedRequestForDetails(null);
            setRequestToDelete(req);
          }}
        />
      )}

      {/* MODAL 3: TECHNICIANS & CONTRACTORS DIRECTORY */}
      {isTechniciansModalOpen && (
        <TechniciansModal
          isOpen={isTechniciansModalOpen}
          onClose={() => setIsTechniciansModalOpen(false)}
        />
      )}

      {/* MODAL 4: MAINTENANCE SETTINGS */}
      {isSettingsModalOpen && (
        <MaintenanceSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      )}

      {/* MODAL 5: OWNER STATEMENT */}
      {isStatementModalOpen && (
        <OwnerMaintenanceStatementModal
          isOpen={isStatementModalOpen}
          onClose={() => setIsStatementModalOpen(false)}
        />
      )}

      {/* MODAL 6: CONFIRM DELETE MODAL WITH INTEGRITY CHECK */}
      {requestToDelete && (() => {
        const prop = properties.find((p) => p.id === requestToDelete.propertyId);
        const unit = units.find((u) => u.id === requestToDelete.unitId);
        const linkedDocs = archive.filter(
          (a) =>
            a.recordId === requestToDelete.id || a.entityId === requestToDelete.id
        );

        return (
          <ConfirmDeleteModal
            isOpen={!!requestToDelete}
            onClose={() => setRequestToDelete(null)}
            onConfirm={confirmDelete}
            title={
              language === "ar"
                ? "حذف طلب الصيانة وأرشفته تاريخياً"
                : "Delete Maintenance Request & Archive"
            }
            itemName={`${requestToDelete.requestNumber} - ${
              prop ? prop.nameAr || prop.nameEn : ""
            } (${unit ? unit.unitNumber : ""})`}
            itemCode={requestToDelete.requestNumber}
            itemType={
              language === "ar" ? "طلب صيانة" : "Maintenance Request"
            }
            entityType="MAINTENANCE"
            entityId={requestToDelete.id}
            statusAtDeletion={requestToDelete.status}
            attachmentsCount={linkedDocs.length + (requestToDelete.attachments?.length || 0)}
            attachments={linkedDocs.map((d) => ({
              id: d.id,
              fileName: d.fileName,
              fileUrl: d.previewUrl,
              fileSize: d.fileSize,
              category: d.category,
              driveWebViewLink: d.driveWebViewLink,
            }))}
          />
        );
      })()}
    </div>
  );
};
