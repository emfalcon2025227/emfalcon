import React, { useState } from "react";
import {
  Calendar,
  CreditCard,
  Building,
  CheckSquare,
  Square,
  Search,
  AlertCircle,
  CheckCircle2,
  Receipt,
  Mail,
  MessageSquare,
  Filter,
  X,
  Lock,
  ArrowUpDown,
  User,
  Hash,
  ArrowRight,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { Cheque, ChequeStatus, Lease } from "../../types";
import { Badge } from "../common/Badge";
import { SearchableSelect } from "../common/SearchableSelect";

interface DueChecksViewProps {
  onOpenCollectionModal?: (cheque: Cheque) => void;
}

export const DueChecksView: React.FC<DueChecksViewProps> = ({
  onOpenCollectionModal,
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
  } = useData();

  const { currentUser } = useAuth();

  // Helper: Get start and end date of current calendar month in YYYY-MM-DD
  const getCurrMonthStartEnd = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0); // last day of month

    const formatStr = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    return {
      start: formatStr(start),
      end: formatStr(end),
    };
  };

  const currentMonthRange = getCurrMonthStartEnd();

  // Filters State
  const [fromDate, setFromDate] = useState<string>(currentMonthRange.start);
  const [toDate, setToDate] = useState<string>(currentMonthRange.end);
  const [ownerFilter, setOwnerFilter] = useState<string>("ALL");
  const [tenantFilter, setTenantFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [bankFilter, setBankFilter] = useState<string>("");
  const [chequeNumFilter, setChequeNumFilter] = useState<string>("");
  const [contractFilter, setContractFilter] = useState<string>("");

  const isRangeInvalid = fromDate && toDate && fromDate > toDate;

  // Formatting date YYYY-MM-DD to DD/MM/YYYY for UI
  const formatDateForUI = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // 1. Filter Cheques Authoritatively
  const filteredCheques = cheques.filter((c) => {
    // 1.1 Date range filter (authoritative cheque dueDate)
    if (fromDate && c.dueDate < fromDate) return false;
    if (toDate && c.dueDate > toDate) return false;

    // 1.2 Owner Filter
    if (ownerFilter !== "ALL" && c.ownerId !== ownerFilter) return false;

    // 1.3 Tenant Filter
    if (tenantFilter !== "ALL" && c.tenantId !== tenantFilter) return false;

    // 1.4 Status Filter
    if (statusFilter !== "ALL" && c.status !== statusFilter) return false;

    // 1.5 Bank name search (case-insensitive & partial Arabic matching)
    if (bankFilter.trim()) {
      const bLower = bankFilter.toLowerCase();
      const cBank = (c.bankName || "").toLowerCase();
      if (!cBank.includes(bLower)) return false;
    }

    // 1.6 Cheque number filter
    if (chequeNumFilter.trim() && !c.chequeNumber.includes(chequeNumFilter.trim())) {
      return false;
    }

    // 1.7 Contract Number (Lease Number) filter
    if (contractFilter.trim()) {
      const lease = leases.find((l) => l.id === c.leaseId);
      const lNum = (lease?.leaseNumber || "").toLowerCase();
      if (!lNum.includes(contractFilter.toLowerCase().trim())) return false;
    }

    return true;
  });

  // Calculate Derived Summary Values (KPIs)
  const totalChequesCount = filteredCheques.length;
  const totalChequesAmount = filteredCheques.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const pendingCount = filteredCheques.filter((c) => c.status === "PENDING" || c.status === "DEPOSITED" || c.status === "POST_DATED").length;
  const clearedCount = filteredCheques.filter((c) => c.status === "CLEARED" || c.status === "COLLECTED").length;
  const bouncedCount = filteredCheques.filter((c) => c.status === "BOUNCED" || c.status === "UNDER_LEGAL").length;
  const cancelledCount = filteredCheques.filter((c) => c.status === "CANCELLED").length;

  // Prepare select options for Owner and Tenant
  const ownerOptions = [
    { id: "ALL", label: isAr ? "كافة الملاك" : "All Owners" },
    ...owners.map((o) => ({
      id: o.id,
      label: isAr ? o.nameAr : o.nameEn,
      badge: o.code || undefined,
    })),
  ];

  const tenantOptions = [
    { id: "ALL", label: isAr ? "كافة المستأجرين" : "All Tenants" },
    ...tenants.map((t) => ({
      id: t.id,
      label: isAr ? t.nameAr : t.nameEn,
      badge: t.code || undefined,
    })),
  ];

  // Cheque Status Options
  const statusOptions = [
    { id: "ALL", label: isAr ? "كافة الحالات" : "All Statuses" },
    { id: "PENDING", label: isAr ? "قيد الانتظار" : "PENDING" },
    { id: "DEPOSITED", label: isAr ? "تم الإيداع" : "DEPOSITED" },
    { id: "CLEARED", label: isAr ? "تم الصرف" : "CLEARED" },
    { id: "COLLECTED", label: isAr ? "تم التحصيل" : "COLLECTED" },
    { id: "BOUNCED", label: isAr ? "مرتجع" : "BOUNCED" },
    { id: "UNDER_LEGAL", label: isAr ? "قيد التقاضي" : "UNDER_LEGAL" },
    { id: "CANCELLED", label: isAr ? "ملغى" : "CANCELLED" },
    { id: "REPLACED", label: isAr ? "مستبدل" : "REPLACED" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-700 shrink-0" />
            <span>{isAr ? "الشيكات المستحقة" : "Due Checks"}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isAr
              ? "رقابة تشغيلية مستمرة للشيكات الإيجارية المستحقة والمسواة ودرجة تسويتها المالية وفق استحقاقاتها التاريخية."
              : "Continuous operational monitoring of lease cheques, settlement ratios, and payment due statuses."}
          </p>
        </div>

        {/* Quick Clear Filters Button */}
        <button
          onClick={() => {
            const range = getCurrMonthStartEnd();
            setFromDate(range.start);
            setToDate(range.end);
            setOwnerFilter("ALL");
            setTenantFilter("ALL");
            setStatusFilter("ALL");
            setBankFilter("");
            setChequeNumFilter("");
            setContractFilter("");
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isAr ? "إعادة تعيين الفلاتر" : "Reset Filters"}</span>
        </button>
      </div>

      {/* Date Warning Banner */}
      {isRangeInvalid && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-pulse">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>
            {isAr
              ? "تنبيه: تاريخ البدء لا يمكن أن يكون بعد تاريخ الانتهاء!"
              : "Warning: From Date cannot be after To Date!"}
          </span>
        </div>
      )}

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {/* KPI 1: Number of Cheques */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">
            {isAr ? "عدد الشيكات" : "Cheques Count"}
          </span>
          <span className="text-base font-black text-slate-900 font-mono block mt-1">
            {totalChequesCount}
          </span>
        </div>

        {/* KPI 2: Total Cheque Amount */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs col-span-1 md:col-span-2">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">
            {isAr ? "إجمالي قيمة الشيكات" : "Total Amount"}
          </span>
          <span className="text-base font-black text-amber-800 font-mono block mt-1">
            AED {totalChequesAmount.toLocaleString()}
          </span>
        </div>

        {/* KPI 3: Due / Pending */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">
            {isAr ? "مستحق / معلق" : "Due / Pending"}
          </span>
          <span className="text-base font-black text-amber-600 font-mono block mt-1">
            {pendingCount}
          </span>
        </div>

        {/* KPI 4: Cleared */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">
            {isAr ? "تم صرفها" : "Cleared"}
          </span>
          <span className="text-base font-black text-emerald-600 font-mono block mt-1">
            {clearedCount}
          </span>
        </div>

        {/* KPI 5: Bounced / Under Legal */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">
            {isAr ? "مرتجع / قضائي" : "Bounced"}
          </span>
          <span className="text-base font-black text-rose-600 font-mono block mt-1">
            {bouncedCount}
          </span>
        </div>
      </div>

      {/* Advanced Filter Workspace */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3.5">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
          <Filter className="w-4 h-4 text-slate-400" />
          <span>{isAr ? "فلاتر البحث والاستعلام" : "Query & Search Parameters"}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Filter Row 1: Dates */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 block">
              {isAr ? "من تاريخ الاستحقاق:" : "From Due Date:"}
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-hidden text-slate-800"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 block">
              {isAr ? "إلى تاريخ الاستحقاق:" : "To Due Date:"}
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-hidden text-slate-800"
            />
          </div>

          {/* Owner Selector */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 block">
              {isAr ? "المالك العقاري:" : "Property Owner:"}
            </label>
            <SearchableSelect
              options={ownerOptions}
              value={ownerFilter}
              onChange={(val) => setOwnerFilter(val)}
              placeholder={isAr ? "اختر المالك..." : "Filter Owner..."}
              searchPlaceholder={isAr ? "ابحث بالمالك..." : "Search Owner..."}
            />
          </div>

          {/* Tenant Selector */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 block">
              {isAr ? "المستأجر:" : "Tenant Name:"}
            </label>
            <SearchableSelect
              options={tenantOptions}
              value={tenantFilter}
              onChange={(val) => setTenantFilter(val)}
              placeholder={isAr ? "اختر المستأجر..." : "Filter Tenant..."}
              searchPlaceholder={isAr ? "ابحث بالمستأجر..." : "Search Tenant..."}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Status Selector */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 block">
              {isAr ? "حالة الشيك البنكي:" : "Cheque Status:"}
            </label>
            <SearchableSelect
              options={statusOptions}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              placeholder={isAr ? "اختر الحالة..." : "Filter Status..."}
              searchPlaceholder={isAr ? "ابحث بالحالة..." : "Search Status..."}
            />
          </div>

          {/* Bank Text Search */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 block">
              {isAr ? "المصرف البنكي:" : "Bank Name:"}
            </label>
            <input
              type="text"
              value={bankFilter}
              onChange={(e) => setBankFilter(e.target.value)}
              placeholder={isAr ? "مثال: بنك دبي الإسلامي..." : "e.g. Dubai Islamic Bank..."}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-hidden text-slate-800"
            />
          </div>

          {/* Cheque Number Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 block">
              {isAr ? "رقم الشيك:" : "Cheque Number:"}
            </label>
            <input
              type="text"
              value={chequeNumFilter}
              onChange={(e) => setChequeNumFilter(e.target.value)}
              placeholder={isAr ? "رقم الشيك..." : "Cheque number..."}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-hidden text-slate-800 font-mono"
            />
          </div>

          {/* Contract Number (Lease ID/Num) */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 block">
              {isAr ? "رقم عقد الإيجار:" : "Lease Contract Number:"}
            </label>
            <input
              type="text"
              value={contractFilter}
              onChange={(e) => setContractFilter(e.target.value)}
              placeholder={isAr ? "رقم العقد..." : "Contract number..."}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-hidden text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* Due Checks Table Form */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold select-none">
              <tr>
                <th className="py-3.5 px-4 text-start">{isAr ? "المالك" : "Owner"}</th>
                <th className="py-3.5 px-4 text-start">{isAr ? "المستأجر" : "Tenant"}</th>
                <th className="py-3.5 px-4 text-start">{isAr ? "رقم العقد" : "Contract #"}</th>
                <th className="py-3.5 px-4 text-start">{isAr ? "العقار والوحدة" : "Property / Unit"}</th>
                <th className="py-3.5 px-4 text-start">{isAr ? "رقم الشيك والمصرف" : "Cheque # & Bank"}</th>
                <th className="py-3.5 px-4 text-start">{isAr ? "تاريخ الاستحقاق" : "Due Date"}</th>
                <th className="py-3.5 px-4 text-start">{isAr ? "المبلغ المستحق" : "Amount (AED)"}</th>
                <th className="py-3.5 px-4 text-start">{isAr ? "الحالة" : "Status"}</th>
                <th className="py-3.5 px-4 text-start">{isAr ? "القسط المرتبط" : "Installment"}</th>
                <th className="py-3.5 px-4 text-end">{isAr ? "الإجراء والتشغيل" : "Action / View"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredCheques.map((cheque, idx) => {
                const owner = owners.find((o) => o.id === cheque.ownerId);
                const tenant = tenants.find((t) => t.id === cheque.tenantId);
                const prop = properties.find((p) => p.id === cheque.propertyId);
                const unit = units.find((u) => u.id === cheque.unitId);
                const lease = leases.find((l) => l.id === cheque.leaseId);

                // Find Related Installment
                const relatedInstallment = lease?.installments.find(
                  (inst) => inst.chequeId === cheque.id || inst.chequeNumber === cheque.chequeNumber
                );

                return (
                  <tr
                    key={`${cheque.id}-${idx}`}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    {/* 1. Owner Name */}
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {owner ? (isAr ? owner.nameAr : owner.nameEn) : cheque.ownerName || "Owner"}
                    </td>

                    {/* 2. Tenant Name */}
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "N/A"}
                    </td>

                    {/* 3. Contract Number */}
                    <td className="py-3 px-4 font-mono font-bold text-amber-900">
                      {lease?.leaseNumber || "N/A"}
                    </td>

                    {/* 4. Property & 5. Unit */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">
                        {prop ? (isAr ? prop.nameAr : prop.nameEn) : "Property"}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {isAr ? "الوحدة:" : "Unit:"} #{unit?.unitNumber || "N/A"}
                      </div>
                    </td>

                    {/* 6. Bank Name & 7. Cheque Number */}
                    <td className="py-3 px-4">
                      <div className="font-mono font-black text-slate-900 flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                        <span>#{cheque.chequeNumber}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">{cheque.bankName}</div>
                    </td>

                    {/* 8. Cheque Due Date */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-800 whitespace-nowrap">
                      {formatDateForUI(cheque.dueDate)}
                    </td>

                    {/* 9. Cheque Amount */}
                    <td className="py-3 px-4 font-mono font-black text-slate-900 whitespace-nowrap">
                      AED {cheque.amount.toLocaleString()}
                    </td>

                    {/* 10. Cheque Status */}
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          cheque.status === "BOUNCED"
                            ? "danger"
                            : cheque.status === "CLEARED" || cheque.status === "COLLECTED"
                            ? "success"
                            : cheque.status === "UNDER_LEGAL"
                            ? "purple"
                            : cheque.status === "DEPOSITED"
                            ? "info"
                            : "neutral"
                        }
                        size="sm"
                      >
                        {cheque.status}
                      </Badge>
                    </td>

                    {/* 11. Related Installment */}
                    <td className="py-3 px-4">
                      {relatedInstallment ? (
                        <div className="font-bold text-slate-700">
                          {isAr
                            ? `القسط ${relatedInstallment.installmentNumber}`
                            : `Installment #${relatedInstallment.installmentNumber}`}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* 12. Operational Action / View */}
                    <td className="py-3 px-4 text-end">
                      {cheque.outstanding > 0 &&
                      (cheque.status === "PENDING" ||
                        cheque.status === "BOUNCED" ||
                        cheque.status === "DEPOSITED" ||
                        cheque.status === "POST_DATED") ? (
                        <button
                          onClick={() => onOpenCollectionModal && onOpenCollectionModal(cheque)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                          title={isAr ? "تحصيل دفعة الشيك" : "Record Collection Payment"}
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>{isAr ? "تحصيل السند" : "Collect"}</span>
                        </button>
                      ) : (
                        <div className="text-[10px] text-slate-400 font-bold flex items-center justify-end gap-1 select-none">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{isAr ? "تمت التسوية" : "Settled"}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State Banner */}
        {filteredCheques.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-xs font-bold text-slate-800">
              {isAr ? "لم يتم العثور على أي شيكات مستحقة!" : "No due checks found!"}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
              {isAr
                ? "تأكد من اختيار نطاق تاريخ استحقاق مناسب أو تصفية فلاتر البحث الأخرى للعقود والملاك."
                : "Try expanding your date range parameters or clearing your filter selectors."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
