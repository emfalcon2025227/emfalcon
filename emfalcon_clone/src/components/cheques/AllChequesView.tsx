import React, { useState, useMemo } from "react";
import {
  CreditCard,
  Search,
  Filter,
  RotateCcw,
  Printer,
  Calendar,
  Building2,
  User,
  CheckCircle2,
  Clock,
  Coins,
  AlertTriangle,
  FileCheck,
  Scale,
  X,
  ArrowRightLeft,
  Ban,
  History,
  FileSpreadsheet,
  Eye,
  Hash,
  Layers,
  ArrowUpRight,
  Upload,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { SearchableSelect, SearchableOption } from "../common/SearchableSelect";
import { Cheque, ChequeStatus } from "../../types";
import { ReplaceChequeModal } from "./ReplaceChequeModal";
import { Modal } from "../common/Modal";
import { Badge } from "../common/Badge";
import { OfficePrintHeader } from "../common/OfficePrintHeader";

interface AllChequesViewProps {
  onNavigateToReturned?: () => void;
  onNavigateToPDC?: () => void;
}

export const AllChequesView: React.FC<AllChequesViewProps> = ({
  onNavigateToReturned,
  onNavigateToPDC,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const {
    cheques,
    tenants,
    properties,
    units,
    owners,
    leases,
    cases,
    collections,
    companyProfile,
  } = useData();

  // Filters
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [contractFilter, setContractFilter] = useState<string>("");
  const [chequeNoFilter, setChequeNoFilter] = useState<string>("");
  const [bankFilter, setBankFilter] = useState<string>("");
  const [ownerFilter, setOwnerFilter] = useState<string>("ALL");
  const [tenantFilter, setTenantFilter] = useState<string>("ALL");
  const [propertyFilter, setPropertyFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL"); // ALL, REPLACEMENT, REPLACED, CANCELLED, LEGACY

  // Detail Modal
  const [inspectedCheque, setInspectedCheque] = useState<Cheque | null>(null);
  const [viewingAuditCheque, setViewingAuditCheque] = useState<Cheque | null>(null);
  const [viewingProof, setViewingProof] = useState<{ title: string; url: string; fileName?: string } | null>(null);

  // Operation Modals
  const [replacingCheque, setReplacingCheque] = useState<Cheque | null>(null);

  // Reset Filters
  const handleResetFilters = () => {
    setFromDate("");
    setToDate("");
    setContractFilter("");
    setChequeNoFilter("");
    setBankFilter("");
    setOwnerFilter("ALL");
    setTenantFilter("ALL");
    setPropertyFilter("ALL");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
  };

  // Combobox Options
  const ownerOptions: SearchableOption[] = useMemo(() => {
    const list: SearchableOption[] = [
      { id: "ALL", label: isAr ? "جميع الملاك" : "All Property Owners" },
    ];
    owners.forEach((o) => {
      list.push({
        id: o.id,
        label: isAr ? o.nameAr : o.nameEn,
        subLabel: o.phone,
      });
    });
    return list;
  }, [owners, isAr]);

  const tenantOptions: SearchableOption[] = useMemo(() => {
    const list: SearchableOption[] = [
      { id: "ALL", label: isAr ? "جميع المستأجرين" : "All Tenants" },
    ];
    tenants.forEach((t) => {
      list.push({
        id: t.id,
        label: isAr ? t.nameAr : t.nameEn,
        subLabel: t.phone,
      });
    });
    return list;
  }, [tenants, isAr]);

  const propertyOptions: SearchableOption[] = useMemo(() => {
    const list: SearchableOption[] = [
      { id: "ALL", label: isAr ? "جميع العقارات" : "All Properties" },
    ];
    properties.forEach((p) => {
      const owner = owners.find((o) => o.id === p.ownerId);
      list.push({
        id: p.id,
        label: isAr ? p.nameAr : p.nameEn,
        subLabel: owner ? `${isAr ? "المالك" : "Owner"}: ${isAr ? owner.nameAr : owner.nameEn}` : undefined,
      });
    });
    return list;
  }, [properties, owners, isAr]);

  const statusOptions: SearchableOption[] = [
    { id: "ALL", label: isAr ? "جميع الحالات (9 حالات)" : "All Statuses (9)" },
    { id: "POST_DATED", label: isAr ? "شيك آجل (Post-Dated)" : "Post-Dated" },
    { id: "PENDING", label: isAr ? "قيد التحصيل (Pending)" : "Pending" },
    { id: "DEPOSITED", label: isAr ? "مودع بالبنك (Deposited)" : "Deposited" },
    { id: "CLEARED", label: isAr ? "تم الصرف بنجاح (Cleared)" : "Cleared" },
    { id: "COLLECTED", label: isAr ? "تم السداد بسند (Collected)" : "Collected" },
    { id: "BOUNCED", label: isAr ? "مرتجع (Bounced)" : "Bounced" },
    { id: "UNDER_LEGAL", label: isAr ? "محال للقضاء (Under Legal)" : "Under Legal" },
    { id: "REPLACED", label: isAr ? "مستبدل (Replaced)" : "Replaced" },
    { id: "CANCELLED", label: isAr ? "ملغى (Cancelled)" : "Cancelled" },
  ];

  const typeOptions: SearchableOption[] = [
    { id: "ALL", label: isAr ? "جميع أنواع الشيكات" : "All Types" },
    { id: "NORMAL", label: isAr ? "شيكات دورية اعتيادية" : "Standard Cheques" },
    { id: "REPLACEMENT", label: isAr ? "شيكات بديلة فقط (Replacement Only)" : "Replacement Cheques" },
    { id: "REPLACED", label: isAr ? "شيكات تم استبدالها (Replaced Originals)" : "Replaced Originals" },
    { id: "CANCELLED", label: isAr ? "شيكات ملغاة (Cancelled)" : "Cancelled Cheques" },
    { id: "LEGACY", label: isAr ? "شيكات تاريخية سابقة (Legacy)" : "Legacy Cheques" },
  ];

  // Filtered Cheques
  const filteredCheques = useMemo(() => {
    return cheques.filter((c) => {
      if (fromDate && c.dueDate < fromDate) return false;
      if (toDate && c.dueDate > toDate) return false;

      if (contractFilter.trim()) {
        const query = contractFilter.trim().toLowerCase();
        const lease = leases.find((l) => l.id === c.leaseId);
        const leaseNo = (lease?.leaseNumber || c.leaseId || "").toLowerCase();
        if (!leaseNo.includes(query)) return false;
      }

      if (chequeNoFilter.trim()) {
        const query = chequeNoFilter.trim().toLowerCase();
        if (!(c.chequeNumber || "").toLowerCase().includes(query)) return false;
      }

      if (bankFilter.trim()) {
        const query = bankFilter.trim().toLowerCase();
        if (!(c.bankName || "").toLowerCase().includes(query)) return false;
      }

      if (ownerFilter !== "ALL" && c.ownerId !== ownerFilter) return false;
      if (tenantFilter !== "ALL" && c.tenantId !== tenantFilter) return false;
      if (propertyFilter !== "ALL" && c.propertyId !== propertyFilter) return false;
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;

      if (typeFilter === "REPLACEMENT" && !c.isReplacement && !c.originalChequeId) return false;
      if (typeFilter === "REPLACED" && c.status !== "REPLACED") return false;
      if (typeFilter === "CANCELLED" && c.status !== "CANCELLED") return false;
      if (typeFilter === "LEGACY" && !c.isLegacy) return false;
      if (typeFilter === "NORMAL" && (c.isReplacement || c.isLegacy || c.status === "REPLACED" || c.status === "CANCELLED")) return false;

      return true;
    });
  }, [
    cheques,
    fromDate,
    toDate,
    contractFilter,
    chequeNoFilter,
    bankFilter,
    ownerFilter,
    tenantFilter,
    propertyFilter,
    statusFilter,
    typeFilter,
    leases,
  ]);

  // KPIs
  const stats = useMemo(() => {
    let totalCount = 0;
    let totalAmount = 0;
    let clearedCount = 0;
    let clearedAmount = 0;
    let bouncedCount = 0;
    let bouncedAmount = 0;
    let replacedCount = 0;
    let cancelledCount = 0;

    filteredCheques.forEach((c) => {
      const amt = Number(c.amount) || 0;
      totalCount++;
      totalAmount += amt;

      if (c.status === "CLEARED" || c.status === "COLLECTED") {
        clearedCount++;
        clearedAmount += amt;
      } else if (c.status === "BOUNCED" || c.status === "UNDER_LEGAL") {
        bouncedCount++;
        bouncedAmount += amt;
      } else if (c.status === "REPLACED") {
        replacedCount++;
      } else if (c.status === "CANCELLED") {
        cancelledCount++;
      }
    });

    return {
      totalCount,
      totalAmount,
      clearedCount,
      clearedAmount,
      bouncedCount,
      bouncedAmount,
      replacedCount,
      cancelledCount,
    };
  }, [filteredCheques]);

  const renderStatusBadge = (status: ChequeStatus) => {
    switch (status) {
      case "POST_DATED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3" />
            {isAr ? "شيك آجل" : "Post-Dated"}
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Clock className="w-3 h-3" />
            {isAr ? "قيد التحصيل" : "Pending"}
          </span>
        );
      case "DEPOSITED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            <Coins className="w-3 h-3" />
            {isAr ? "مودع بالبنك" : "Deposited"}
          </span>
        );
      case "CLEARED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            {isAr ? "مصروف بنكياً" : "Cleared"}
          </span>
        );
      case "COLLECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
            <FileCheck className="w-3 h-3" />
            {isAr ? "تم السداد بسند" : "Collected"}
          </span>
        );
      case "BOUNCED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertTriangle className="w-3 h-3" />
            {isAr ? "مرتجع" : "Bounced"}
          </span>
        );
      case "UNDER_LEGAL":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <Scale className="w-3 h-3" />
            {isAr ? "محال للقضاء" : "Under Legal"}
          </span>
        );
      case "REPLACED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <ArrowRightLeft className="w-3 h-3 text-amber-600" />
            {isAr ? "مستبدل" : "Replaced"}
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Ban className="w-3 h-3 text-rose-600" />
            {isAr ? "ملغى" : "Cancelled"}
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const formatAED = (amt: number) => {
    return `${(amt || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${isAr ? "د.إ" : "AED"}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-800 text-white rounded-xl shadow-xs">
            <Layers className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {isAr ? "الاستعلام الشامل عن الشيكات (All Cheques Desk)" : "All Cheques Register"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isAr
                ? "سجل رقابي وتحليلي شامل لجميع الشيكات الإيجارية بكافة حالاتها (9 حالات) وتتبع الشيكات المستبدلة والملغاة"
                : "Universal audit desk for all rental cheques across all 9 statuses with replacement & cancellation links"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>{isAr ? "طباعة التقرير" : "Print Register"}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
        {/* Total In Query */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">
            {isAr ? "إجمالي الشيكات بالسجل" : "Total Cheques in Query"}
          </span>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {stats.totalCount}{" "}
            <span className="text-xs font-normal text-slate-500">{isAr ? "شيك" : "cheques"}</span>
          </div>
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">
            {formatAED(stats.totalAmount)}
          </div>
        </div>

        {/* Cleared / Settled */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 block">
            {isAr ? "تم الصرف بنجاح" : "Cleared & Settled"}
          </span>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {stats.clearedCount}{" "}
            <span className="text-xs font-normal text-slate-500">{isAr ? "شيك" : "cheques"}</span>
          </div>
          <div className="text-xs font-semibold text-emerald-600 mt-1">
            {formatAED(stats.clearedAmount)}
          </div>
        </div>

        {/* Bounced / Under Legal */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-xs font-semibold text-rose-600 block">
            {isAr ? "مرتجع / محال للقضاء" : "Bounced / Under Legal"}
          </span>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {stats.bouncedCount}{" "}
            <span className="text-xs font-normal text-slate-500">{isAr ? "شيك" : "cheques"}</span>
          </div>
          <div className="text-xs font-semibold text-rose-600 mt-1">
            {formatAED(stats.bouncedAmount)}
          </div>
        </div>

        {/* Replaced & Cancelled */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-xs font-semibold text-amber-600 block">
            {isAr ? "مستبدل / ملغى إدارياً" : "Replaced & Cancelled"}
          </span>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {stats.replacedCount + stats.cancelledCount}{" "}
            <span className="text-xs font-normal text-slate-500">{isAr ? "شيك" : "cheques"}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {isAr
              ? `(${stats.replacedCount} مستبدل / ${stats.cancelledCount} ملغى)`
              : `(${stats.replacedCount} replaced / ${stats.cancelledCount} cancelled)`}
          </div>
        </div>
      </div>

      {/* Filter Card */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4 print:hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
          <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold text-sm">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>{isAr ? "تصفية وفلترة السجل الشامل" : "Universal Filters"}</span>
          </div>
          <button
            onClick={handleResetFilters}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isAr ? "إعادة تعيين" : "Reset"}</span>
          </button>
        </div>

        {/* Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? "من تاريخ استحقاق" : "From Due Date"}
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? "إلى تاريخ استحقاق" : "To Due Date"}
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? "رقم العقد" : "Contract Number"}
            </label>
            <input
              type="text"
              placeholder={isAr ? "ابحث برقم العقد..." : "Search contract..."}
              value={contractFilter}
              onChange={(e) => setContractFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? "رقم الشيك" : "Cheque Number"}
            </label>
            <input
              type="text"
              placeholder={isAr ? "ابحث برقم الشيك..." : "Search cheque..."}
              value={chequeNoFilter}
              onChange={(e) => setChequeNoFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <SearchableSelect
              label={isAr ? "مالك العقار" : "Owner"}
              options={ownerOptions}
              value={ownerFilter}
              onChange={(val) => setOwnerFilter(val)}
              searchPlaceholder={isAr ? "اختر المالك..." : "Select owner..."}
            />
          </div>

          <div>
            <SearchableSelect
              label={isAr ? "المستأجر" : "Tenant"}
              options={tenantOptions}
              value={tenantFilter}
              onChange={(val) => setTenantFilter(val)}
              searchPlaceholder={isAr ? "اختر المستأجر..." : "Select tenant..."}
            />
          </div>

          <div>
            <SearchableSelect
              label={isAr ? "حالة الشيك (Status)" : "Cheque Status"}
              options={statusOptions}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              searchPlaceholder={isAr ? "اختر الحالة..." : "Select status..."}
            />
          </div>

          <div>
            <SearchableSelect
              label={isAr ? "نوع الشيك (Category)" : "Cheque Category"}
              options={typeOptions}
              value={typeFilter}
              onChange={(val) => setTypeFilter(val)}
              searchPlaceholder={isAr ? "اختر النوع..." : "Select type..."}
            />
          </div>
        </div>
      </div>

      {/* Cheques Grid */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden print:border-none print:shadow-none p-0 print:p-4">
        {/* Printable Header with Office Logo and Name */}
        <OfficePrintHeader
          titleAr="سجل الشيكات الشامل"
          titleEn="UNIVERSAL CHEQUES REGISTER"
          hideOnScreen={true}
          extraInfo={[
            { labelAr: "إجمالي الشيكات", labelEn: "Total Cheques", value: filteredCheques.length.toString() },
            { labelAr: "إجمالي القيمة", labelEn: "Total Amount", value: `AED ${filteredCheques.reduce((sum, c) => sum + (c.amount || 0), 0).toLocaleString()}` },
          ]}
        />

        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-black text-sm text-slate-900 dark:text-white">
              {isAr ? "سجل جميع الشيكات" : "Universal Cheque Log"}
            </span>
            <span className="px-2 py-0.5 text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">
              {filteredCheques.length} {isAr ? "شيك" : "cheques"}
            </span>
          </div>

          <div className="w-60">
            <input
              type="text"
              placeholder={isAr ? "فلترة باسم البنك..." : "Filter by bank..."}
              value={bankFilter}
              onChange={(e) => setBankFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "رقم العقد" : "Contract #"}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "مالك العقار" : "Owner"}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "العقار / الوحدة" : "Property / Unit"}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "المستأجر" : "Tenant"}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "البنك" : "Bank"}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "رقم الشيك" : "Cheque #"}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "تاريخ الاستحقاق" : "Due Date"}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "المبلغ الأصلي" : "Original Amount"}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "الرصيد المتبقي" : "Outstanding"}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "حالة الشيك" : "Status"}</th>
                <th className="py-3 px-3.5 whitespace-nowrap text-center print:hidden">{isAr ? "إجراءات وفحص" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {filteredCheques.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <CreditCard className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    {isAr ? "لا توجد شيكات مطابقة لمعايير البحث." : "No cheques found matching filters."}
                  </td>
                </tr>
              ) : (
                filteredCheques.map((chq) => {
                  const lease = leases.find((l) => l.id === chq.leaseId);
                  const owner = owners.find((o) => o.id === chq.ownerId);
                  const tenant = tenants.find((t) => t.id === chq.tenantId);
                  const prop = properties.find((p) => p.id === chq.propertyId);
                  const unit = units.find((u) => u.id === chq.unitId);

                  const isReplacement = chq.isReplacement || !!chq.originalChequeId;
                  const isLegacy = chq.isLegacy;

                  return (
                    <tr key={chq.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition">
                      <td className="py-3 px-3.5 font-bold font-mono text-slate-900 dark:text-white whitespace-nowrap">
                        {lease?.leaseNumber || chq.leaseId || "—"}
                      </td>
                      <td className="py-3 px-3.5 text-slate-700 dark:text-slate-200 whitespace-nowrap font-medium">
                        {owner ? (isAr ? owner.nameAr : owner.nameEn) : "—"}
                      </td>
                      <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">
                          {prop ? (isAr ? prop.nameAr : prop.nameEn) : "—"}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {unit ? `${isAr ? "وحدة" : "Unit"} #${unit.unitNumber}` : "—"}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-slate-800 dark:text-slate-100 whitespace-nowrap font-semibold">
                        {tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "—"}
                      </td>
                      <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {chq.bankName || "—"}
                      </td>
                      <td className="py-3 px-3.5 text-slate-900 dark:text-white whitespace-nowrap font-mono font-bold">
                        <div className="flex items-center gap-1.5">
                          <span>#{chq.chequeNumber}</span>
                          {isReplacement && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              {isAr ? "بديل" : "Repl"}
                            </span>
                          )}
                          {isLegacy && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {isAr ? "سابق" : "Legacy"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {chq.dueDate}
                      </td>
                      <td className="py-3 px-3.5 text-slate-900 dark:text-white whitespace-nowrap font-mono font-bold">
                        {formatAED(chq.amount)}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap font-mono font-bold">
                        <span
                          className={
                            (chq.outstanding ?? chq.amount) > 0
                              ? "text-rose-600 dark:text-rose-400 font-bold"
                              : "text-emerald-600 dark:text-emerald-400 font-bold"
                          }
                        >
                          {formatAED(chq.outstanding ?? chq.amount)}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {renderStatusBadge(chq.status)}
                      </td>
                      <td className="py-3 px-3.5 text-center whitespace-nowrap print:hidden">
                        <div className="flex items-center justify-center gap-1">
                          {/* Inspect Full Details */}
                          <button
                            onClick={() => setInspectedCheque(chq)}
                            title={isAr ? "عرض السجل والارتباطات" : "View Details & Links"}
                            className="p-1 text-slate-600 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Audit History / Timeline */}
                          <button
                            onClick={() => setViewingAuditCheque(chq)}
                            title={isAr ? "سجل التتبع والتدقيق (Timeline)" : "View Audit Trail"}
                            className="p-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {/* Quick Replace (if not replaced/cancelled) */}
                          {chq.status !== "REPLACED" && chq.status !== "CANCELLED" && chq.status !== "CLEARED" && chq.status !== "COLLECTED" && (
                            <button
                              onClick={() => setReplacingCheque(chq)}
                              title={isAr ? "استبدال الشيك" : "Replace Cheque"}
                              className="p-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition"
                            >
                              <ArrowRightLeft className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Cheque Modal */}
      {inspectedCheque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="w-6 h-6 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold">
                    {isAr ? "سجل الشيك وتفاصيل دورة الحياة" : "Cheque Lifecycle & Audit Record"}
                  </h3>
                  <p className="text-xs text-slate-300 font-mono">
                    #{inspectedCheque.chequeNumber} — {inspectedCheque.bankName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectedCheque(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Status & Amount Box */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block mb-1">{isAr ? "الحالة الحالية" : "Current Status"}</span>
                  {renderStatusBadge(inspectedCheque.status)}
                </div>
                <div className="text-left rtl:text-right">
                  <span className="text-slate-400 block mb-1">{isAr ? "المبلغ الإجمالي" : "Total Amount"}</span>
                  <span className="text-base font-mono font-bold text-emerald-600">
                    {formatAED(inspectedCheque.amount)}
                  </span>
                </div>
              </div>

              {/* Core Information */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-400 block">{isAr ? "تاريخ الاستحقاق" : "Due Date"}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{inspectedCheque.dueDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{isAr ? "تاريخ التحرير" : "Cheque Date"}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{inspectedCheque.chequeDate || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{isAr ? "الرصيد المتبقي" : "Outstanding"}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {formatAED(inspectedCheque.outstanding)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">{isAr ? "اسم الساحب" : "Drawer Name"}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{inspectedCheque.drawerName || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{isAr ? "رقم الحساب" : "Account #"}</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{inspectedCheque.accountNumber || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{isAr ? "معرف الشيك (System ID)" : "Cheque ID"}</span>
                  <span className="font-mono text-[10px] text-slate-500 truncate block">{inspectedCheque.id}</span>
                </div>
              </div>

              {/* Replacement Audit Trail */}
              {(inspectedCheque.isReplacement || inspectedCheque.originalChequeId || inspectedCheque.replacementChequeIds?.length) && (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
                  <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4" />
                    {isAr ? "معلومات الاستبدال (Replacement Trail)" : "Replacement Linkage"}
                  </span>
                  {inspectedCheque.originalChequeId && (
                    <div>
                      <span className="text-amber-700 dark:text-amber-400">
                        {isAr ? "هذا الشيك بديل عن الشيك الأصلي ID:" : "Replacement for original cheque ID:"}{" "}
                        <span className="font-mono font-bold">{inspectedCheque.originalChequeId}</span>
                      </span>
                    </div>
                  )}
                  {inspectedCheque.replacementReason && (
                    <div>
                      <span className="text-amber-700 dark:text-amber-400">
                        {isAr ? "سبب الاستبدال:" : "Replacement Reason:"} {inspectedCheque.replacementReason}
                      </span>
                    </div>
                  )}
                  {inspectedCheque.replacementDate && (
                    <div>
                      <span className="text-amber-700 dark:text-amber-400">
                        {isAr ? "تاريخ الاستبدال:" : "Replacement Date:"} {inspectedCheque.replacementDate}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Cancellation Audit Trail */}
              {inspectedCheque.status === "CANCELLED" && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl space-y-2">
                  <span className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                    <Ban className="w-4 h-4" />
                    {isAr ? "بيانات الإلغاء والتوثيق المالي" : "Cancellation Details"}
                  </span>
                  <div>
                    <span className="text-rose-700 dark:text-rose-400">
                      {isAr ? "نوع الإلغاء:" : "Cancellation Type:"} {inspectedCheque.cancellationType || "—"}
                    </span>
                  </div>
                  {inspectedCheque.cancellationSettlementRef && (
                    <div>
                      <span className="text-rose-700 dark:text-rose-400">
                        {isAr ? "المرجع المالي البديل:" : "Settlement Ref:"} {inspectedCheque.cancellationSettlementRef}
                      </span>
                    </div>
                  )}
                  {inspectedCheque.cancellationReason && (
                    <div>
                      <span className="text-rose-700 dark:text-rose-400">
                        {isAr ? "سبب وتفاصيل الإلغاء:" : "Reason:"} {inspectedCheque.cancellationReason}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {inspectedCheque.notes && (
                <div>
                  <span className="text-slate-400 block mb-1">{isAr ? "ملاحظات الشيك" : "Notes"}</span>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300">
                    {inspectedCheque.notes}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setInspectedCheque(null)}
                className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl text-slate-700 dark:text-slate-200"
              >
                {isAr ? "إغلاق" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replace Cheque Modal */}
      {replacingCheque && (
        <ReplaceChequeModal
          originalCheque={replacingCheque}
          isOpen={true}
          onClose={() => setReplacingCheque(null)}
        />
      )}

      {/* Attachment / Proof Viewer Modal */}
      {viewingProof && (
        <Modal
          isOpen={true}
          onClose={() => setViewingProof(null)}
          title={viewingProof.title}
        >
          <div className="space-y-4">
            <div className="max-h-[60vh] overflow-auto flex items-center justify-center bg-slate-900/5 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
              {viewingProof.url.startsWith("data:application/pdf") ? (
                <iframe
                  src={viewingProof.url}
                  className="w-full h-96 rounded-lg border-0"
                  title="PDF Document Viewer"
                />
              ) : (
                <img
                  src={viewingProof.url}
                  alt={viewingProof.title}
                  className="max-h-[50vh] max-w-full object-contain rounded-lg shadow-xs"
                />
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
              <a
                href={viewingProof.url}
                download={viewingProof.fileName || "proof-document"}
                className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 rotate-180" />
                <span>{isAr ? "تحميل المرفق" : "Download File"}</span>
              </a>

              <button
                type="button"
                onClick={() => setViewingProof(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                {isAr ? "إغلاق" : "Close"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cheque Lifecycle Audit Trail Modal */}
      {viewingAuditCheque && (
        <Modal
          isOpen={true}
          onClose={() => setViewingAuditCheque(null)}
          title={
            isAr
              ? `سجل التدقيق والتتبع — الشيك #${viewingAuditCheque.chequeNumber}`
              : `Audit Trail — Cheque #${viewingAuditCheque.chequeNumber}`
          }
        >
          <div className="space-y-4 text-xs">
            {/* Header info badge */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-slate-400 block">{isAr ? "معرف الشيك المركزي" : "Central Cheque ID"}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{viewingAuditCheque.id}</span>
              </div>
              <div className="text-right rtl:text-left">
                <span className="text-slate-400 block">{isAr ? "الحالة الحالية" : "Current Status"}</span>
                <span className="font-bold">
                  <Badge variant="neutral" size="sm">{viewingAuditCheque.status}</Badge>
                </span>
              </div>
            </div>

            {/* Audit History Timeline */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <History className="w-4 h-4 text-indigo-600" />
                <span>{isAr ? "التسلسل الزمني للعمليات والحركات" : "Operational Timeline"}</span>
              </h4>

              {(!viewingAuditCheque.auditTrail || viewingAuditCheque.auditTrail.length === 0) ? (
                <div className="py-8 text-center text-slate-400">
                  <Clock className="w-8 h-8 mx-auto mb-1 stroke-[1.5]" />
                  <p>{isAr ? "لا توجد سجلات تدقيق سابقة لهذا الشيك بعد." : "No audit entries recorded for this cheque yet."}</p>
                </div>
              ) : (
                <div className="relative border-s-2 border-indigo-200 dark:border-indigo-900 ms-3 space-y-4 py-1">
                  {viewingAuditCheque.auditTrail.map((entry, idx) => (
                    <div key={idx} className="relative ps-4 group">
                      <div className="absolute -start-1.5 top-1 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900" />
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 shadow-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-indigo-700 dark:text-indigo-400">
                            {entry.action}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(entry.timestamp).toLocaleString(isAr ? "ar-AE" : "en-GB")}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                          <span>
                            {isAr ? "الحالة:" : "Status:"}{" "}
                            <strong className="text-slate-800 dark:text-white">
                              {entry.previousStatus || "INIT"} → {entry.newStatus}
                            </strong>
                          </span>
                          {entry.userName && (
                            <span className="text-slate-400">
                              • {isAr ? "بواسطة:" : "By:"} {entry.userName}
                            </span>
                          )}
                        </div>

                        {entry.notes && (
                          <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                            {entry.notes}
                          </div>
                        )}

                        {entry.referenceNumber && (
                          <div className="text-[10px] font-mono text-slate-500">
                            {isAr ? "المرجع:" : "Ref:"} {entry.referenceNumber}
                          </div>
                        )}

                        {entry.proofUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setViewingProof({
                                title: isAr
                                  ? `مرفق عملية (${entry.action}) - شيك #${viewingAuditCheque.chequeNumber}`
                                  : `Proof for ${entry.action} - Cheque #${viewingAuditCheque.chequeNumber}`,
                                url: entry.proofUrl!,
                              })
                            }
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-[11px] font-bold cursor-pointer pt-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>{isAr ? "عرض الوثيقة المرفقة للعملية" : "View Attached Proof"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingAuditCheque(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl font-bold cursor-pointer"
              >
                {isAr ? "إغلاق" : "Close"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
