import React, { useState, useMemo, useEffect } from "react";
import {
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  ShieldCheck,
  Building2,
  Users,
  Coins,
  Receipt,
  Download,
  Layers,
  ArrowUpRight,
  Sparkles,
  Info,
  Calendar,
  X,
  Scale,
  RefreshCw,
  Percent,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useNavigation } from "../../context/NavigationContext";
import { useAuth } from "../../context/AuthContext";
import {
  detectAdminFeeExceptions,
  AdminFeeExceptionRecord,
  AdminFeeExceptionType,
} from "../../utils/feeExceptionDetector";
import { SearchableSelect } from "../common/SearchableSelect";
import { downloadElementAsPdf } from "../../utils/pdfExportUtils";

interface AdminFeeExceptionCenterViewProps {
  initialFilter?: "ALL" | "ACTIVE" | "PENDING" | "APPROVED" | "REJECTED";
}

export const AdminFeeExceptionCenterView: React.FC<AdminFeeExceptionCenterViewProps> = ({
  initialFilter = "ACTIVE",
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { open360, navigateTo } = useNavigation();
  const { currentUser } = useAuth();

  const {
    commissions = [],
    leases = [],
    owners = [],
    tenants = [],
    properties = [],
    financialReversals = [],
    vatRates = [],
  } = useData();

  // Run derived exception detection engine
  const { records, summary } = useMemo(() => {
    return detectAdminFeeExceptions({
      commissions,
      leases,
      owners,
      tenants,
      properties,
      financialReversals,
      vatRateHistory: vatRates,
    });
  }, [commissions, leases, owners, tenants, properties, financialReversals, vatRates]);

  // Filters State
  const [activeQuickFilter, setActiveQuickFilter] = useState<
    "ALL_EXCEPTIONS" | "ACTIVE" | "PENDING" | "APPROVED" | "FULL_EXEMPTION" | "PARTY_RATE" | "MANUAL_REDUCTION" | "ALL_RECORDS"
  >(initialFilter === "ACTIVE" ? "ACTIVE" : "ALL_EXCEPTIONS");

  const [exceptionsOnly, setExceptionsOnly] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedPartyType, setSelectedPartyType] = useState<"ALL" | "OWNER" | "TENANT">("ALL");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Details Modal
  const [selectedRecord, setSelectedRecord] = useState<AdminFeeExceptionRecord | null>(null);

  // Listen for custom navigation event to switch filter
  useEffect(() => {
    const handleSetFilter = (e: any) => {
      if (e.detail?.filter) {
        setActiveQuickFilter(e.detail.filter);
        setExceptionsOnly(true);
      }
    };
    window.addEventListener("set-fee-exceptions-filter", handleSetFilter);
    return () => window.removeEventListener("set-fee-exceptions-filter", handleSetFilter);
  }, []);

  // Filter Logic
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Exceptions Only Toggle
      if (exceptionsOnly && !r.isException) return false;

      // Quick Filter
      if (activeQuickFilter === "ACTIVE" && !r.requiresAttention) return false;
      if (activeQuickFilter === "PENDING" && r.exceptionType !== "PENDING_APPROVAL") return false;
      if (activeQuickFilter === "APPROVED" && r.approvalStatus !== "APPROVED") return false;
      if (activeQuickFilter === "FULL_EXEMPTION" && r.exceptionType !== "FULL_EXEMPTION") return false;
      if (activeQuickFilter === "PARTY_RATE" && r.exceptionType !== "PARTY_RATE_REDUCTION") return false;
      if (
        activeQuickFilter === "MANUAL_REDUCTION" &&
        r.exceptionType !== "MANUAL_REDUCTION" &&
        r.exceptionType !== "MANUAL_AMOUNT_BELOW_EXPECTED"
      )
        return false;
      if (activeQuickFilter === "ALL_EXCEPTIONS" && !r.isException) return false;

      // Type Filter
      if (selectedTypeFilter !== "ALL" && r.exceptionType !== selectedTypeFilter) return false;

      // Status Filter
      if (selectedStatusFilter !== "ALL" && r.approvalStatus !== selectedStatusFilter) return false;

      // Party Type
      if (selectedPartyType !== "ALL" && r.partyType !== selectedPartyType) return false;

      // Owner / Tenant / Property
      if (selectedOwnerId && r.ownerId !== selectedOwnerId) return false;
      if (selectedTenantId && r.tenantId !== selectedTenantId) return false;
      if (selectedPropertyId && r.propertyId !== selectedPropertyId) return false;

      // Date Range
      if (fromDate && r.transactionDate < fromDate) return false;
      if (toDate && r.transactionDate > toDate) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          r.leaseNumber.toLowerCase().includes(q) ||
          r.ownerName.toLowerCase().includes(q) ||
          r.tenantName.toLowerCase().includes(q) ||
          r.propertyName.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q) ||
          r.notes.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [
    records,
    exceptionsOnly,
    activeQuickFilter,
    selectedTypeFilter,
    selectedStatusFilter,
    selectedPartyType,
    selectedOwnerId,
    selectedTenantId,
    selectedPropertyId,
    fromDate,
    toDate,
    searchQuery,
  ]);

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredRecords.map((r, idx) => ({
      "#": idx + 1,
      [isAr ? "رقم العقد" : "Lease Number"]: r.leaseNumber,
      [isAr ? "نوع الطرف" : "Party Type"]:
        r.partyType === "OWNER" ? (isAr ? "مالك" : "Owner") : isAr ? "مستأجر" : "Tenant",
      [isAr ? "اسم الطرف" : "Party Name"]:
        r.partyType === "OWNER" ? r.ownerName : r.tenantName,
      [isAr ? "العقار" : "Property"]: r.propertyName,
      [isAr ? "نوع الاستثناء" : "Exception Type"]: getExceptionTypeLabel(r.exceptionType, isAr),
      [isAr ? "النسبة القياسية" : "Expected Rate"]: `${r.expectedRate}%`,
      [isAr ? "النسبة المطبقة" : "Applied Rate"]: `${r.appliedRate}%`,
      [isAr ? "الرسوم المتوقعة (درهم)" : "Expected Fee (AED)"]: r.expectedAmount,
      [isAr ? "الرسوم المطبقة (درهم)" : "Applied Fee (AED)"]: r.actualAmount,
      [isAr ? "مبلغ الخصم/الإعفاء (درهم)" : "Reduction Amount (AED)"]: r.reductionAmount,
      [isAr ? "فرق الضريبة (درهم)" : "VAT Difference (AED)"]: r.vatDifference,
      [isAr ? "السبب" : "Reason"]: r.reason,
      [isAr ? "حالة الاعتماد" : "Approval Status"]: getApprovalStatusLabel(r.approvalStatus, isAr),
      [isAr ? "المعتمد بواسطة" : "Approved By"]: r.approvedBy || "—",
      [isAr ? "حالة التحصيل" : "Collection Status"]: getCollectionStatusLabel(r.collectionStatus, isAr),
      [isAr ? "تاريخ المعاملة" : "Transaction Date"]: r.transactionDate.split("T")[0],
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Admin Fee Exceptions");
    XLSX.writeFile(wb, `Admin_Fee_Exceptions_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Print PDF
  const handlePrintPdf = () => {
    downloadElementAsPdf("admin-fee-exception-table", {
      fileName: "Admin_Fee_Exceptions_Report.pdf",
      orientation: "l",
    });
  };

  // Helper Labels & Styling
  function getExceptionTypeBadge(type: AdminFeeExceptionType, ar: boolean) {
    switch (type) {
      case "FULL_EXEMPTION":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
            {ar ? "إعفاء كامل (100%)" : "Full Exemption"}
          </span>
        );
      case "PARTY_RATE_REDUCTION":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-orange-100 text-orange-900 border border-orange-300">
            <Percent className="w-3.5 h-3.5 text-orange-700" />
            {ar ? "تخفيض طرف خاص" : "Party Rate Override"}
          </span>
        );
      case "MANUAL_REDUCTION":
      case "MANUAL_AMOUNT_BELOW_EXPECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-yellow-100 text-yellow-900 border border-yellow-300">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-700" />
            {ar ? "تخفيض يدوي" : "Manual Reduction"}
          </span>
        );
      case "PENDING_APPROVAL":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300 animate-pulse">
            <Clock className="w-3.5 h-3.5 text-rose-700" />
            {ar ? "قيد الاعتماد الإداري" : "Pending Approval"}
          </span>
        );
      case "REJECTED_EXCEPTION":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <XCircle className="w-3.5 h-3.5 text-slate-500" />
            {ar ? "استثناء مرفوض" : "Rejected"}
          </span>
        );
      case "REVERSED_RECORD":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            {ar ? "سجل مالي مسترجع" : "Reversed"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            {ar ? "مطابق للسياسة القياسية" : "Normal Policy"}
          </span>
        );
    }
  }

  function getRowHighlightClass(type: AdminFeeExceptionType) {
    switch (type) {
      case "FULL_EXEMPTION":
        return "bg-amber-50/50 hover:bg-amber-100/60 border-l-4 border-l-amber-500";
      case "PARTY_RATE_REDUCTION":
        return "bg-orange-50/40 hover:bg-orange-100/50 border-l-4 border-l-orange-400";
      case "MANUAL_REDUCTION":
      case "MANUAL_AMOUNT_BELOW_EXPECTED":
        return "bg-yellow-50/40 hover:bg-yellow-100/50 border-l-4 border-l-yellow-400";
      case "PENDING_APPROVAL":
        return "bg-rose-50/50 hover:bg-rose-100/60 border-l-4 border-l-rose-500";
      default:
        return "bg-white hover:bg-slate-50";
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">
                {isAr ? "مركز استثناءات الرسوم الإدارية" : "Administrative Fee Exception Center"}
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {isAr
                  ? "منظومة الرقابة المالية والتدقيق للكشف عن الإعفاءات وتخفيضات الرسوم الإدارية ومقارنتها بالسياسة القياسية"
                  : "Financial monitoring & audit layer detecting fee exemptions, reductions and deviations from standard policy"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{isAr ? "تصدير إكسل" : "Export Excel"}</span>
          </button>

          <button
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>{isAr ? "طباعة التقرير" : "Print PDF"}</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards (Financial Impact & Exception Breakdown) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Card 1: Active Exceptions Requiring Attention */}
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-800 uppercase">
              {isAr ? "استثناءات تتطلب مراجعة" : "Active Exceptions"}
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-rose-900">{summary.totalActiveExceptions}</div>
            <div className="text-[10px] text-rose-700 font-semibold mt-0.5">
              {isAr ? "تتطلب اهتمام الإدارة" : "Require management review"}
            </div>
          </div>
        </div>

        {/* Card 2: Total Reduction (Waived Amount) */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase">
              {isAr ? "إجمالي التخفيض/الإعفاء" : "Total Waived"}
            </span>
            <Coins className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-amber-900">
              {summary.totalReductionAmount.toLocaleString()} <span className="text-xs">AED</span>
            </div>
            <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
              {isAr ? "فارق الرسوم المعفاة" : "Expected minus applied"}
            </div>
          </div>
        </div>

        {/* Card 3: Expected vs Applied Fees */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-800 uppercase">
              {isAr ? "الرسوم المطبقة" : "Applied Fees"}
            </span>
            <Receipt className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-indigo-900">
              {summary.totalAppliedFees.toLocaleString()} <span className="text-xs">AED</span>
            </div>
            <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">
              {isAr ? `من أصل ${summary.totalExpectedFees.toLocaleString()} متوقع` : `From ${summary.totalExpectedFees.toLocaleString()} expected`}
            </div>
          </div>
        </div>

        {/* Card 4: Full Exemptions */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 uppercase">
              {isAr ? "إعفاء كامل (100%)" : "Full Exemptions"}
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">{summary.totalFullExemptions}</div>
            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
              {isAr ? "عقود معفاة بالكامل" : "Contracts 100% exempt"}
            </div>
          </div>
        </div>

        {/* Card 5: Party Rate Reductions */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 uppercase">
              {isAr ? "تخفيض نسبة طرف" : "Party Overrides"}
            </span>
            <Percent className="w-4 h-4 text-orange-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">{summary.totalPartyRateReductions}</div>
            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
              {isAr ? "نسب مخصصة للملاك/المستأجرين" : "Special owner/tenant rates"}
            </div>
          </div>
        </div>

        {/* Card 6: Pending Approvals */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 uppercase">
              {isAr ? "قيد الاعتماد" : "Pending Approvals"}
            </span>
            <Clock className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">{summary.totalPendingApprovals}</div>
            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
              {isAr ? "طلبات إعفاء غير معتمدة" : "Awaiting management action"}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Quick Filter Tabs & Search Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-4">
        {/* Quick Filter Buttons */}
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => {
                setActiveQuickFilter("ACTIVE");
                setExceptionsOnly(true);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeQuickFilter === "ACTIVE"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {isAr ? `تتطلب مراجعة (${summary.totalActiveExceptions})` : `Requires Attention (${summary.totalActiveExceptions})`}
            </button>

            <button
              onClick={() => {
                setActiveQuickFilter("ALL_EXCEPTIONS");
                setExceptionsOnly(true);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeQuickFilter === "ALL_EXCEPTIONS"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {isAr ? `جميع الاستثناءات (${summary.totalExceptionsCount})` : `All Exceptions (${summary.totalExceptionsCount})`}
            </button>

            <button
              onClick={() => {
                setActiveQuickFilter("FULL_EXEMPTION");
                setExceptionsOnly(true);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeQuickFilter === "FULL_EXEMPTION"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {isAr ? `إعفاء كامل (${summary.totalFullExemptions})` : `Full Exemption (${summary.totalFullExemptions})`}
            </button>

            <button
              onClick={() => {
                setActiveQuickFilter("PARTY_RATE");
                setExceptionsOnly(true);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeQuickFilter === "PARTY_RATE"
                  ? "bg-orange-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {isAr ? `تخفيض طرف (${summary.totalPartyRateReductions})` : `Party Overrides (${summary.totalPartyRateReductions})`}
            </button>

            <button
              onClick={() => {
                setActiveQuickFilter("MANUAL_REDUCTION");
                setExceptionsOnly(true);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeQuickFilter === "MANUAL_REDUCTION"
                  ? "bg-yellow-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {isAr ? `تخفيض يدوي (${summary.totalManualReductions})` : `Manual Reductions (${summary.totalManualReductions})`}
            </button>

            <button
              onClick={() => {
                setActiveQuickFilter("PENDING");
                setExceptionsOnly(true);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeQuickFilter === "PENDING"
                  ? "bg-rose-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {isAr ? `قيد الاعتماد (${summary.totalPendingApprovals})` : `Pending Approvals (${summary.totalPendingApprovals})`}
            </button>

            <button
              onClick={() => {
                setActiveQuickFilter("ALL_RECORDS");
                setExceptionsOnly(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeQuickFilter === "ALL_RECORDS" && !exceptionsOnly
                  ? "bg-slate-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {isAr ? `جميع السجلات (${records.length})` : `All Records (${records.length})`}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={exceptionsOnly}
                onChange={(e) => setExceptionsOnly(e.target.checked)}
                className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
              />
              <span>{isAr ? "عرض الاستثناءات فقط" : "Exceptions Only"}</span>
            </label>
          </div>
        </div>

        {/* Detailed Search & Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Universal Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute top-3 left-3 text-slate-400 rtl:right-3 rtl:left-auto" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? "بحث بالعقد، المالك، المستأجر، العقار..." : "Search lease, owner, tenant..."}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 rtl:pr-9 rtl:pl-3"
            />
          </div>

          {/* Owner Filter */}
          <SearchableSelect
            options={[
              { id: "all-owners", value: "", label: isAr ? "جميع الملاك" : "All Owners" },
              ...owners.map((o) => ({
                id: o.id,
                value: o.id,
                label: isAr ? (o.nameAr || o.nameEn) : (o.nameEn || o.nameAr),
                subLabel: o.emiratesId || o.email || o.code,
              })),
            ]}
            value={selectedOwnerId}
            onChange={(val) => setSelectedOwnerId(val)}
            placeholder={isAr ? "تصفية حسب المالك" : "Filter by Owner"}
            className="text-xs"
          />

          {/* Tenant Filter */}
          <SearchableSelect
            options={[
              { id: "all-tenants", value: "", label: isAr ? "جميع المستأجرين" : "All Tenants" },
              ...tenants.map((t) => ({
                id: t.id,
                value: t.id,
                label: isAr ? (t.nameAr || t.nameEn) : (t.nameEn || t.nameAr),
                subLabel: t.phone || t.email || t.emiratesId,
              })),
            ]}
            value={selectedTenantId}
            onChange={(val) => setSelectedTenantId(val)}
            placeholder={isAr ? "تصفية حسب المستأجر" : "Filter by Tenant"}
            className="text-xs"
          />

          {/* Property Filter */}
          <SearchableSelect
            options={[
              { id: "all-properties", value: "", label: isAr ? "جميع العقارات" : "All Properties" },
              ...properties.map((p) => ({
                id: p.id,
                value: p.id,
                label: isAr ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr),
                subLabel: p.community ? `${p.community} (${p.emirate})` : p.emirate || p.code,
              })),
            ]}
            value={selectedPropertyId}
            onChange={(val) => setSelectedPropertyId(val)}
            placeholder={isAr ? "تصفية حسب العقار" : "Filter by Property"}
            className="text-xs"
          />

          {/* Party Type Select */}
          <select
            value={selectedPartyType}
            onChange={(e) => setSelectedPartyType(e.target.value as any)}
            className="py-2 px-3 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
          >
            <option value="ALL">{isAr ? "الطرف: الكل (مالك ومستأجر)" : "Party: All"}</option>
            <option value="OWNER">{isAr ? "رسوم المالك فقط" : "Owner Fees Only"}</option>
            <option value="TENANT">{isAr ? "رسوم المستأجر فقط" : "Tenant Fees Only"}</option>
          </select>
        </div>
      </div>

      {/* 4. Exceptions Table */}
      <div id="admin-fee-exception-table" className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
              {isAr ? "سجلات الاستثناءات المكتشفة" : "Detected Exception Records"}
            </span>
            <span className="bg-slate-200 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-full">
              {filteredRecords.length}
            </span>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            {isAr ? "الترتيب حسب المعاملات الحديثة" : "Sorted by recent transactions"}
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {isAr ? "لا توجد استثناءات تطابق شروط البحث" : "No exception records match criteria"}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {isAr
                ? "جميع السجلات تتبع السياسة القياسية أو تم تصفيتها بنجاح."
                : "All records adhere to standard policy or were filtered out."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right border-collapse">
              <thead>
                <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="p-3.5">{isAr ? "نوع الاستثناء" : "Exception Type"}</th>
                  <th className="p-3.5">{isAr ? "العقد / العقار" : "Contract / Property"}</th>
                  <th className="p-3.5">{isAr ? "الطرف" : "Party"}</th>
                  <th className="p-3.5 text-center">{isAr ? "النسبة (المتوقعة → المطبقة)" : "Rate (Exp → App)"}</th>
                  <th className="p-3.5 text-right rtl:text-left">{isAr ? "الرسوم المتوقعة" : "Expected Fee"}</th>
                  <th className="p-3.5 text-right rtl:text-left">{isAr ? "الرسوم المطبقة" : "Applied Fee"}</th>
                  <th className="p-3.5 text-right rtl:text-left">{isAr ? "مبلغ الخصم" : "Reduction"}</th>
                  <th className="p-3.5 text-center">{isAr ? "حالة الاعتماد" : "Approval"}</th>
                  <th className="p-3.5 text-center">{isAr ? "حالة التحصيل" : "Collection"}</th>
                  <th className="p-3.5 text-center">{isAr ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 font-medium text-slate-800">
                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className={`transition-colors ${getRowHighlightClass(record.exceptionType)}`}
                  >
                    {/* 1. Exception Badge */}
                    <td className="p-3.5">
                      <div className="flex flex-col gap-1">
                        {getExceptionTypeBadge(record.exceptionType, isAr)}
                        <span className="text-[10px] text-slate-500 font-mono">
                          {record.reason}
                        </span>
                      </div>
                    </td>

                    {/* 2. Contract & Property */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{record.leaseNumber}</div>
                      <div className="text-[11px] text-slate-500">{record.propertyName}</div>
                    </td>

                    {/* 3. Party */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">
                        {record.partyType === "OWNER" ? record.ownerName : record.tenantName}
                      </div>
                      <span
                        className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          record.partyType === "OWNER"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {record.partyType === "OWNER"
                          ? isAr
                            ? "مالك"
                            : "Owner"
                          : isAr
                          ? "مستأجر"
                          : "Tenant"}
                      </span>
                    </td>

                    {/* 4. Rates */}
                    <td className="p-3.5 text-center">
                      <div className="font-mono font-bold text-slate-800">
                        {record.expectedRate}% →{" "}
                        <span
                          className={
                            record.appliedRate < record.expectedRate
                              ? "text-rose-600 font-black"
                              : "text-emerald-700"
                          }
                        >
                          {record.appliedRate}%
                        </span>
                      </div>
                    </td>

                    {/* 5. Expected Amount */}
                    <td className="p-3.5 text-right rtl:text-left font-mono font-bold text-slate-700">
                      {record.expectedAmount.toLocaleString()}{" "}
                      <span className="text-[10px] font-normal">AED</span>
                    </td>

                    {/* 6. Applied Amount */}
                    <td className="p-3.5 text-right rtl:text-left font-mono font-black">
                      <span
                        className={
                          record.actualAmount < record.expectedAmount
                            ? "text-amber-700"
                            : "text-slate-900"
                        }
                      >
                        {record.actualAmount.toLocaleString()}{" "}
                        <span className="text-[10px] font-normal">AED</span>
                      </span>
                    </td>

                    {/* 7. Reduction Amount */}
                    <td className="p-3.5 text-right rtl:text-left font-mono font-black">
                      {record.reductionAmount > 0 ? (
                        <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block">
                          -{record.reductionAmount.toLocaleString()} AED
                        </span>
                      ) : (
                        <span className="text-slate-400">0.00</span>
                      )}
                    </td>

                    {/* 8. Approval Status */}
                    <td className="p-3.5 text-center">
                      {record.approvalStatus === "APPROVED" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {isAr ? "معتمد" : "Approved"}
                        </span>
                      ) : record.approvalStatus === "PENDING" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded animate-pulse">
                          <Clock className="w-3 h-3 text-rose-600" />
                          {isAr ? "قيد المراجعة" : "Pending"}
                        </span>
                      ) : record.approvalStatus === "REJECTED" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded">
                          <XCircle className="w-3 h-3 text-slate-500" />
                          {isAr ? "مرفوض" : "Rejected"}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>

                    {/* 9. Collection Status */}
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
                          record.collectionStatus === "COLLECTED"
                            ? "bg-emerald-100 text-emerald-800"
                            : record.collectionStatus === "PARTIAL"
                            ? "bg-amber-100 text-amber-800"
                            : record.collectionStatus === "WAIVED"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-rose-50 text-rose-800 border border-rose-200"
                        }`}
                      >
                        {getCollectionStatusLabel(record.collectionStatus, isAr)}
                      </span>
                    </td>

                    {/* 10. Actions */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedRecord(record)}
                          title={isAr ? "عرض التفاصيل والتدقيق" : "View Details & Audit"}
                          className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {record.leaseId && (
                          <button
                            onClick={() => {
                              navigateTo("LEASES");
                            }}
                            title={isAr ? "فتح العقد" : "Open Lease"}
                            className="p-1.5 text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Details Modal */}
      {selectedRecord && (
        <AdminFeeExceptionDetailsModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          isAr={isAr}
        />
      )}
    </div>
  );
};

interface DetailsModalProps {
  record: AdminFeeExceptionRecord;
  onClose: () => void;
  isAr: boolean;
}

const AdminFeeExceptionDetailsModal: React.FC<DetailsModalProps> = ({
  record,
  onClose,
  isAr,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-600 text-white rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base">
                {isAr ? "تفاصيل استثناء الرسوم الإدارية" : "Administrative Fee Exception Details"}
              </h3>
              <p className="text-xs text-slate-300 font-mono mt-0.5">
                {record.leaseNumber} • {record.propertyName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 text-xs text-slate-700 max-h-[80vh] overflow-y-auto">
          {/* Comparison Cards: Expected vs Applied */}
          <div className="grid grid-cols-2 gap-4">
            {/* Standard Policy Mandate */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-500 font-bold uppercase text-[10px]">
                <span>{isAr ? "السياسة القياسية (المتوقعة)" : "Standard Policy"}</span>
                <span className="font-mono">{record.expectedRate}%</span>
              </div>
              <div className="text-lg font-black text-slate-900">
                {record.expectedAmount.toLocaleString()} <span className="text-xs">AED</span>
              </div>
              <div className="text-[11px] text-slate-500 space-y-1 pt-2 border-t border-slate-200/60 font-mono">
                <div className="flex justify-between">
                  <span>{isAr ? "ضريبة القيمة المضافة (5%):" : "Expected VAT (5%):"}</span>
                  <span>{record.expectedVat.toLocaleString()} AED</span>
                </div>
                <div className="flex justify-between font-bold text-slate-700">
                  <span>{isAr ? "صافي إيراد المكتب:" : "Expected Net Revenue:"}</span>
                  <span>{record.expectedNetRevenue.toLocaleString()} AED</span>
                </div>
              </div>
            </div>

            {/* Applied / Recorded Transaction */}
            <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-rose-700 font-bold uppercase text-[10px]">
                <span>{isAr ? "المعاملة المطبقة فعلياً" : "Applied Transaction"}</span>
                <span className="font-mono">{record.appliedRate}%</span>
              </div>
              <div className="text-lg font-black text-rose-950">
                {record.actualAmount.toLocaleString()} <span className="text-xs">AED</span>
              </div>
              <div className="text-[11px] text-rose-800 space-y-1 pt-2 border-t border-rose-200 font-mono">
                <div className="flex justify-between">
                  <span>{isAr ? "الضريبة المطبقة:" : "Applied VAT:"}</span>
                  <span>{record.actualVat.toLocaleString()} AED</span>
                </div>
                <div className="flex justify-between font-bold text-rose-900">
                  <span>{isAr ? "الصافي الفعلي:" : "Actual Net Revenue:"}</span>
                  <span>{record.actualNetRevenue.toLocaleString()} AED</span>
                </div>
              </div>
            </div>
          </div>

          {/* Variance & Reduction Summary */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-black text-amber-900">
                {isAr ? "فارق التخفيض المالي (المبلغ المعفى)" : "Total Fee Reduction / Waived Amount"}
              </div>
              <div className="text-[11px] text-amber-700 mt-0.5">
                {isAr
                  ? "يمثل الفارق المحسوم من إيرادات الرسوم الإدارية"
                  : "Variance deducted from administrative revenue"}
              </div>
            </div>
            <div className="text-right rtl:text-left">
              <div className="text-xl font-black text-amber-900 font-mono">
                {record.reductionAmount.toLocaleString()} AED
              </div>
              <div className="text-[10px] text-amber-800 font-mono">
                {isAr ? `فارق الضريبة: ${record.vatDifference} AED` : `VAT Diff: ${record.vatDifference} AED`}
              </div>
            </div>
          </div>

          {/* Context & Metadata Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
            <div className="p-3 bg-slate-50 font-bold text-slate-800 flex justify-between">
              <span>{isAr ? "مصدر السياسة والاستثناء:" : "Policy Source & Exception:"}</span>
              <span className="font-mono">{record.policySource}</span>
            </div>
            <div className="p-3 flex justify-between">
              <span className="text-slate-500">{isAr ? "السبب الموثق:" : "Reason:"}</span>
              <span className="font-bold text-slate-900">{record.reason}</span>
            </div>
            {record.notes && (
              <div className="p-3 flex justify-between">
                <span className="text-slate-500">{isAr ? "ملاحظات إضافية:" : "Notes:"}</span>
                <span className="text-slate-800">{record.notes}</span>
              </div>
            )}
            <div className="p-3 flex justify-between">
              <span className="text-slate-500">{isAr ? "حالة الاعتماد الإداري:" : "Approval Status:"}</span>
              <span className="font-bold text-slate-900">{record.approvalStatus}</span>
            </div>
            {record.approvedBy && (
              <div className="p-3 flex justify-between">
                <span className="text-slate-500">{isAr ? "معتمد من قِبل:" : "Approved By:"}</span>
                <span className="font-bold text-slate-900">{record.approvedBy} ({record.approvedAt?.split("T")[0]})</span>
              </div>
            )}
            <div className="p-3 flex justify-between">
              <span className="text-slate-500">{isAr ? "حالة التحصيل المالي:" : "Collection Status:"}</span>
              <span className="font-bold text-slate-900">
                {record.collectionStatus} (المحصل: {record.collectedAmount.toLocaleString()} AED / المتبقي: {record.outstandingBalance.toLocaleString()} AED)
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-all cursor-pointer"
          >
            {isAr ? "إغلاق" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
};

function getExceptionTypeLabel(type: AdminFeeExceptionType, ar: boolean) {
  switch (type) {
    case "FULL_EXEMPTION":
      return ar ? "إعفاء كامل" : "Full Exemption";
    case "PARTY_RATE_REDUCTION":
      return ar ? "تخفيض نسبة طرف خاص" : "Party Rate Override";
    case "MANUAL_REDUCTION":
      return ar ? "تخفيض يدوي" : "Manual Reduction";
    case "MANUAL_AMOUNT_BELOW_EXPECTED":
      return ar ? "مبلغ يدوي أقل من المتوقع" : "Manual Below Expected";
    case "PENDING_APPROVAL":
      return ar ? "قيد الاعتماد" : "Pending Approval";
    case "REJECTED_EXCEPTION":
      return ar ? "استثناء مرفوض" : "Rejected";
    case "REVERSED_RECORD":
      return ar ? "مسترجع" : "Reversed";
    default:
      return ar ? "عادي" : "Normal";
  }
}

function getApprovalStatusLabel(status: string, ar: boolean) {
  switch (status) {
    case "APPROVED":
      return ar ? "معتمد" : "Approved";
    case "PENDING":
      return ar ? "قيد المراجعة" : "Pending";
    case "REJECTED":
      return ar ? "مرفوض" : "Rejected";
    default:
      return "—";
  }
}

function getCollectionStatusLabel(status: string, ar: boolean) {
  switch (status) {
    case "COLLECTED":
      return ar ? "محصل بالكامل" : "Collected";
    case "PARTIAL":
      return ar ? "محصل جزئياً" : "Partial";
    case "WAIVED":
      return ar ? "معفى بالكامل" : "Waived";
    case "REVERSED":
      return ar ? "مسترجع" : "Reversed";
    default:
      return ar ? "معلق غير محصل" : "Pending";
  }
}
