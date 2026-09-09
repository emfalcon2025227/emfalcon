import React, { useState, useEffect, useMemo } from "react";
import {
  Filter,
  Calendar,
  UserCheck,
  Users,
  Building2,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  RotateCcw,
  Sparkles,
  Search,
  Tag,
  CreditCard,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { SearchableSelect } from "./SearchableSelect";
import { UniversalReportFilters, ReportGroupByOption } from "../../types/reportingTypes";
import { Owner, Tenant, Property, Unit, Lease } from "../../types";

interface UniversalReportFilterProps {
  filters: UniversalReportFilters;
  onFilterChange: (filters: UniversalReportFilters) => void;
  owners?: Owner[];
  tenants?: Tenant[];
  properties?: Property[];
  units?: Unit[];
  leases?: Lease[];
  mode?: "all" | "owner" | "tenant";
  availableGroupings?: ReportGroupByOption[];
  showAdvancedToggle?: boolean;
}

export const UniversalReportFilter: React.FC<UniversalReportFilterProps> = ({
  filters,
  onFilterChange,
  owners = [],
  tenants = [],
  properties = [],
  units = [],
  leases = [],
  mode = "all",
  availableGroupings = ["NONE", "OWNER", "TENANT", "PROPERTY", "CATEGORY", "MONTH", "PAYMENT_METHOD"],
  showAdvancedToggle = true,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "owner" | "tenant">(mode);

  useEffect(() => {
    setFilterMode(mode);
  }, [mode]);

  // Date Preset Handlers
  const handleDatePreset = (preset: "TODAY" | "THIS_MONTH" | "LAST_MONTH" | "THIS_QUARTER" | "THIS_YEAR" | "ALL") => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");

    let fromDate = "";
    let toDate = "";

    if (preset === "TODAY") {
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      fromDate = todayStr;
      toDate = todayStr;
    } else if (preset === "THIS_MONTH") {
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      fromDate = `${y}-${pad(m)}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      toDate = `${y}-${pad(m)}-${pad(lastDay)}`;
    } else if (preset === "LAST_MONTH") {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const y = prev.getFullYear();
      const m = prev.getMonth() + 1;
      fromDate = `${y}-${pad(m)}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      toDate = `${y}-${pad(m)}-${pad(lastDay)}`;
    } else if (preset === "THIS_QUARTER") {
      const y = now.getFullYear();
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const startMonth = currentQuarter * 3 + 1;
      const endMonth = startMonth + 2;
      fromDate = `${y}-${pad(startMonth)}-01`;
      const lastDay = new Date(y, endMonth, 0).getDate();
      toDate = `${y}-${pad(endMonth)}-${pad(lastDay)}`;
    } else if (preset === "THIS_YEAR") {
      const y = now.getFullYear();
      fromDate = `${y}-01-01`;
      toDate = `${y}-12-31`;
    } else if (preset === "ALL") {
      fromDate = "";
      toDate = "";
    }

    onFilterChange({
      ...filters,
      fromDate,
      toDate,
    });
  };

  const handleUpdate = (key: keyof UniversalReportFilters, val: any) => {
    onFilterChange({
      ...filters,
      [key]: val,
    });
  };

  const handleClearAll = () => {
    onFilterChange({
      fromDate: "",
      toDate: "",
      ownerId: "",
      tenantId: "",
      propertyId: "",
      unitId: "",
      leaseId: "",
      transactionType: "",
      status: "",
      paymentMethod: "",
      expenseCategory: "",
      operatorId: "",
      groupBy: "NONE",
      searchQuery: "",
    });
  };

  // Filter units according to property if selected
  const availableUnits = useMemo(() => {
    if (!filters.propertyId) return units;
    return units.filter((u) => u.propertyId === filters.propertyId);
  }, [units, filters.propertyId]);

  // Filter leases according to tenant/property/owner
  const availableLeases = useMemo(() => {
    return leases.filter((l) => {
      if (filters.tenantId && l.tenantId !== filters.tenantId) return false;
      if (filters.propertyId && l.propertyId !== filters.propertyId) return false;
      if (filters.ownerId && l.ownerId !== filters.ownerId) return false;
      return true;
    });
  }, [leases, filters.tenantId, filters.propertyId, filters.ownerId]);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.fromDate || filters.toDate) count++;
    if (filters.ownerId) count++;
    if (filters.tenantId) count++;
    if (filters.propertyId) count++;
    if (filters.unitId) count++;
    if (filters.leaseId) count++;
    if (filters.status) count++;
    if (filters.paymentMethod) count++;
    if (filters.expenseCategory) count++;
    if (filters.transactionType) count++;
    if (filters.groupBy && filters.groupBy !== "NONE") count++;
    if (filters.searchQuery) count++;
    return count;
  }, [filters]);

  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4 print:hidden">
      {/* Header & Modes */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-3.5">
        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span className="text-sm">{isAr ? "محرك الفلاتر الموحد للتقارير" : "Universal Report Filter Engine"}</span>
          {activeFiltersCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
              {activeFiltersCount} {isAr ? "نشط" : "active"}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Mode Buttons */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => {
                setFilterMode("owner");
                onFilterChange({ ...filters, tenantId: "" });
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                filterMode === "owner"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{isAr ? "الملاك" : "Owners"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterMode("tenant");
                onFilterChange({ ...filters, ownerId: "" });
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                filterMode === "tenant"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{isAr ? "المستأجرين" : "Tenants"}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                filterMode === "all"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isAr ? "الكل" : "All"}</span>
            </button>
          </div>

          {activeFiltersCount > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-xl transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isAr ? "إعادة ضبط" : "Reset"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Date Presets Row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-bold text-slate-500 mr-1 rtl:ml-1 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          {isAr ? "فترات سريعة:" : "Presets:"}
        </span>
        <button
          onClick={() => handleDatePreset("ALL")}
          className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition ${
            !filters.fromDate && !filters.toDate
              ? "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-bold"
              : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
          }`}
        >
          {isAr ? "كل الأوقات" : "All Time"}
        </button>
        <button
          onClick={() => handleDatePreset("TODAY")}
          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition"
        >
          {isAr ? "اليوم" : "Today"}
        </button>
        <button
          onClick={() => handleDatePreset("THIS_MONTH")}
          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition"
        >
          {isAr ? "هذا الشهر" : "This Month"}
        </button>
        <button
          onClick={() => handleDatePreset("LAST_MONTH")}
          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition"
        >
          {isAr ? "الشهر السابق" : "Last Month"}
        </button>
        <button
          onClick={() => handleDatePreset("THIS_QUARTER")}
          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition"
        >
          {isAr ? "هذا الربع" : "This Quarter"}
        </button>
        <button
          onClick={() => handleDatePreset("THIS_YEAR")}
          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition"
        >
          {isAr ? "هذا العام" : "This Year"}
        </button>
      </div>

      {/* Primary Filters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* From Date */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
            {isAr ? "من تاريخ" : "From Date"}
          </label>
          <input
            type="date"
            value={filters.fromDate || ""}
            onChange={(e) => handleUpdate("fromDate", e.target.value)}
            className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 ${
              filters.fromDate && filters.toDate && filters.fromDate > filters.toDate
                ? "border-rose-500 text-rose-600 dark:text-rose-400"
                : "border-slate-200 dark:border-slate-700"
            }`}
          />
        </div>

        {/* To Date */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
            {isAr ? "إلى تاريخ" : "To Date"}
          </label>
          <input
            type="date"
            value={filters.toDate || ""}
            onChange={(e) => handleUpdate("toDate", e.target.value)}
            className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 ${
              filters.fromDate && filters.toDate && filters.fromDate > filters.toDate
                ? "border-rose-500 text-rose-600 dark:text-rose-400"
                : "border-slate-200 dark:border-slate-700"
            }`}
          />
        </div>

        {/* Date Validation Error Banner */}
        {filters.fromDate && filters.toDate && filters.fromDate > filters.toDate && (
          <div className="col-span-1 sm:col-span-2 lg:col-span-4 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-bold">
            <X className="w-4 h-4 shrink-0 text-rose-600" />
            <span>
              {isAr
                ? "تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية."
                : "From date cannot be later than To date."}
            </span>
          </div>
        )}

        {/* Owner Selector */}
        {(filterMode === "owner" || filterMode === "all") && (
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              {isAr ? "المالك" : "Owner"}
            </label>
            <SearchableSelect
              options={owners.map((o) => ({
                id: o.id,
                title: isAr ? o.nameAr : o.nameEn,
                subLabel: `${isAr ? "المالك:" : "Owner:"} ${isAr ? o.nameAr : o.nameEn} | ${o.phone || o.code || ""}`,
                badge: o.code || "OW",
                extraSearchTerms: [o.code || "", o.phone || "", o.iban || "", o.emiratesId || ""],
              }))}
              value={filters.ownerId || ""}
              onChange={(val) => handleUpdate("ownerId", val)}
              placeholder={isAr ? "جميع الملاك (افتراضي)" : "All Owners (Default)"}
              searchPlaceholder={isAr ? "ابحث بالاسم، الهاتف أو الآيبان..." : "Search owner..."}
            />
          </div>
        )}

        {/* Tenant Selector */}
        {(filterMode === "tenant" || filterMode === "all") && (
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              {isAr ? "المستأجر" : "Tenant"}
            </label>
            <SearchableSelect
              options={tenants.map((t) => ({
                id: t.id,
                title: isAr ? t.nameAr : t.nameEn,
                subLabel: `${isAr ? "المستأجر:" : "Tenant:"} ${isAr ? t.nameAr : t.nameEn} | ${t.phone || t.code || ""}`,
                badge: t.code || "TNT",
                extraSearchTerms: [t.code || "", t.phone || "", t.emiratesId || ""],
              }))}
              value={filters.tenantId || ""}
              onChange={(val) => handleUpdate("tenantId", val)}
              placeholder={isAr ? "جميع المستأجرين (افتراضي)" : "All Tenants (Default)"}
              searchPlaceholder={isAr ? "ابحث بالاسم أو الهاتف..." : "Search tenant..."}
            />
          </div>
        )}

        {/* Property Selector */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
            {isAr ? "العقار" : "Property"}
          </label>
          <SearchableSelect
            options={properties.map((p) => {
              const owner = owners.find((o) => o.id === p.ownerId);
              const ownerName = owner ? (isAr ? owner.nameAr : owner.nameEn) : "---";
              return {
                id: p.id,
                title: isAr ? p.nameAr : p.nameEn,
                subLabel: isAr ? `المالك: ${ownerName}` : `Owner: ${ownerName}`,
                badge: p.code || "PROP",
                extraSearchTerms: [p.code || "", ownerName, p.community || ""],
              };
            })}
            value={filters.propertyId || ""}
            onChange={(val) => handleUpdate("propertyId", val)}
            placeholder={isAr ? "جميع العقارات (افتراضي)" : "All Properties (Default)"}
            searchPlaceholder={isAr ? "ابحث عن عقار..." : "Search property..."}
          />
        </div>

        {/* Group By Selector */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
            {isAr ? "التجميع وحساب الإجماليات" : "Grouping & Subtotals"}
          </label>
          <SearchableSelect
            options={[
              { id: "NONE", label: isAr ? "بدون تجميع (جدول موحد)" : "No Grouping (Flat Table)" },
              ...(availableGroupings.includes("OWNER") ? [{ id: "OWNER", label: isAr ? "تجميع حسب المالك (Group by Owner)" : "Group by Owner" }] : []),
              ...(availableGroupings.includes("TENANT") ? [{ id: "TENANT", label: isAr ? "تجميع حسب المستأجر (Group by Tenant)" : "Group by Tenant" }] : []),
              ...(availableGroupings.includes("PROPERTY") ? [{ id: "PROPERTY", label: isAr ? "تجميع حسب العقار (Group by Property)" : "Group by Property" }] : []),
              ...(availableGroupings.includes("CATEGORY") ? [{ id: "CATEGORY", label: isAr ? "تجميع حسب التصنيف (Group by Category)" : "Group by Category" }] : []),
              ...(availableGroupings.includes("MONTH") ? [{ id: "MONTH", label: isAr ? "تجميع حسب الشهر (Group by Month)" : "Group by Month" }] : []),
              ...(availableGroupings.includes("PAYMENT_METHOD") ? [{ id: "PAYMENT_METHOD", label: isAr ? "تجميع حسب طريقة الدفع (Group by Payment Method)" : "Group by Payment Method" }] : []),
            ]}
            value={filters.groupBy || "NONE"}
            onChange={(val) => handleUpdate("groupBy", val as ReportGroupByOption)}
            placeholder={isAr ? "اختر التجميع..." : "Select Grouping..."}
            searchPlaceholder={isAr ? "ابحث نوع التجميع..." : "Search grouping..."}
          />
        </div>
      </div>

      {/* Advanced Collapsible Section */}
      {showAdvancedToggle && (
        <div>
          <button
            type="button"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline py-1"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{isAdvancedOpen ? (isAr ? "إخفاء الفلاتر الإضافية" : "Hide Advanced Filters") : (isAr ? "إظهار الفلاتر الإضافية (الوحدة، العقد، طريقة الدفع، التصنيف...)" : "Show Advanced Filters (Unit, Lease, Payment Method, Category...)")}</span>
            {isAdvancedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {isAdvancedOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-3 border-t border-slate-100 dark:border-slate-700/60 mt-2">
              {/* Unit Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  {isAr ? "الوحدة الإيجارية" : "Rental Unit"}
                </label>
                <SearchableSelect
                  options={availableUnits.map((u) => {
                    const tenant = tenants.find((t) => t.id === u.currentTenantId);
                    const tenantName = tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "";
                    return {
                      id: u.id,
                      title: `${isAr ? "وحدة رقم" : "Unit #"} ${u.unitNumber}`,
                      subLabel: tenant ? (isAr ? `المستأجر: ${tenantName}` : `Tenant: ${tenantName}`) : (isAr ? "شاغرة" : "Vacant"),
                      badge: u.unitNumber,
                    };
                  })}
                  value={filters.unitId || ""}
                  onChange={(val) => handleUpdate("unitId", val)}
                  placeholder={isAr ? "جميع الوحدات" : "All Units"}
                  searchPlaceholder={isAr ? "ابحث عن وحدة..." : "Search unit..."}
                />
              </div>

              {/* Lease Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  {isAr ? "عقد الإيجار" : "Lease Contract"}
                </label>
                <SearchableSelect
                  options={availableLeases.map((l) => {
                    const tenant = tenants.find((t) => t.id === l.tenantId);
                    const prop = properties.find((p) => p.id === l.propertyId);
                    return {
                      id: l.id,
                      title: `${l.leaseNumber || l.id.slice(0, 8)} (${Number(l.annualRent || 0).toLocaleString()} AED)`,
                      subLabel: `${tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : ""} | ${prop ? (isAr ? prop.nameAr : prop.nameEn) : ""}`,
                      badge: l.contractStatus,
                      extraSearchTerms: [l.leaseNumber || "", l.ejariNumber || ""],
                    };
                  })}
                  value={filters.leaseId || ""}
                  onChange={(val) => handleUpdate("leaseId", val)}
                  placeholder={isAr ? "جميع العقود" : "All Leases"}
                  searchPlaceholder={isAr ? "ابحث برقم العقد..." : "Search lease..."}
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  {isAr ? "طريقة الدفع" : "Payment Method"}
                </label>
                <SearchableSelect
                  options={[
                    { id: "", label: isAr ? "جميع طرق الدفع" : "All Payment Methods" },
                    { id: "BANK_TRANSFER", label: isAr ? "تحويل مصرفي (Bank Transfer)" : "Bank Transfer" },
                    { id: "CHEQUE", label: isAr ? "شيك (Cheque)" : "Cheque" },
                    { id: "CASH", label: isAr ? "نقدي (Cash)" : "Cash" },
                    { id: "CREDIT_CARD", label: isAr ? "بطاقة ائتمان (Credit Card)" : "Credit Card" },
                  ]}
                  value={filters.paymentMethod || ""}
                  onChange={(val) => handleUpdate("paymentMethod", val)}
                  placeholder={isAr ? "جميع طرق الدفع" : "All Payment Methods"}
                  searchPlaceholder={isAr ? "ابحث بالاسم..." : "Search method..."}
                />
              </div>

              {/* Expense Category */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  {isAr ? "تصنيف المصروف" : "Expense Category"}
                </label>
                <SearchableSelect
                  options={[
                    { id: "", label: isAr ? "جميع التصنيفات" : "All Categories" },
                    { id: "MAINTENANCE", label: isAr ? "صيانة وإصلاحات (Maintenance)" : "Maintenance" },
                    { id: "UTILITIES", label: isAr ? "كهرباء ومياه (Utilities / SEWA / DEWA)" : "Utilities" },
                    { id: "MUNICIPALITY_FEES", label: isAr ? "رسوم بلدية وتوثيق (Municipality)" : "Municipality Fees" },
                    { id: "LEGAL_FEES", label: isAr ? "رسوم ومصاريف قضائية (Legal / Court)" : "Legal Fees" },
                    { id: "MANAGEMENT", label: isAr ? "إدارة وتشغيل (Management)" : "Management" },
                    { id: "SERVICE_CHARGES", label: isAr ? "خدمات ورسوم خدمات (Service Charges)" : "Service Charges" },
                    { id: "CLEANING", label: isAr ? "نظافة (Cleaning)" : "Cleaning" },
                    { id: "SECURITY", label: isAr ? "حراسة وأمن (Security)" : "Security" },
                    { id: "INSURANCE", label: isAr ? "تأمين (Insurance)" : "Insurance" },
                    { id: "OTHER", label: isAr ? "أخرى (Other)" : "Other" },
                  ]}
                  value={filters.expenseCategory || ""}
                  onChange={(val) => handleUpdate("expenseCategory", val)}
                  placeholder={isAr ? "جميع التصنيفات" : "All Categories"}
                  searchPlaceholder={isAr ? "ابحث عن تصنيف..." : "Search category..."}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
