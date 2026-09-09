import React, { useState, useMemo } from "react";
import {
  BookOpen,
  Search,
  Filter,
  CheckCircle2,
  RotateCcw,
  FileText,
  Calendar,
  Layers,
  Building2,
  Users,
  ShieldCheck,
  AlertCircle,
  Eye,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  Scale,
  RefreshCw,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { JournalEntryRecord, JournalLine } from "../../types";

export const GeneralLedgerView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentUser } = useAuth();
  const {
    journalEntries = [],
    chartOfAccounts = [],
    owners = [],
    tenants = [],
    properties = [],
    reverseJournalEntry,
  } = useData();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>("ALL");
  const [selectedSourceType, setSelectedSourceType] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const [viewingEntry, setViewingEntry] = useState<JournalEntryRecord | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [isReversing, setIsReversing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filtered Entries
  const filteredEntries = useMemo(() => {
    return journalEntries.filter((je) => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchEntryNumber = je.entryNumber.toLowerCase().includes(q);
        const matchRef = (je.reference || "").toLowerCase().includes(q);
        const matchDesc = (je.description || "").toLowerCase().includes(q);
        const matchCreator = (je.createdBy || "").toLowerCase().includes(q);
        const matchLines = je.lines.some(
          (l) =>
            l.accountCode.toLowerCase().includes(q) ||
            l.accountNameAr.toLowerCase().includes(q) ||
            l.accountNameEn.toLowerCase().includes(q) ||
            (l.description && l.description.toLowerCase().includes(q))
        );
        if (!matchEntryNumber && !matchRef && !matchDesc && !matchCreator && !matchLines) {
          return false;
        }
      }

      // Account filter
      if (selectedAccountCode !== "ALL") {
        const matchesAcc = je.lines.some((l) => l.accountCode === selectedAccountCode);
        if (!matchesAcc) return false;
      }

      // Source type filter
      if (selectedSourceType !== "ALL" && je.sourceType !== selectedSourceType) {
        return false;
      }

      // Status filter
      if (selectedStatus !== "ALL" && je.status !== selectedStatus) {
        return false;
      }

      // Date range filter
      if (fromDate && je.transactionDate < fromDate) return false;
      if (toDate && je.transactionDate > toDate) return false;

      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [journalEntries, searchQuery, selectedAccountCode, selectedSourceType, selectedStatus, fromDate, toDate]);

  // General Ledger Statistics
  const stats = useMemo(() => {
    let totalPostedDebit = 0;
    let totalPostedCredit = 0;

    filteredEntries.forEach((je) => {
      if (je.status === "POSTED") {
        totalPostedDebit += je.totalDebit;
        totalPostedCredit += je.totalCredit;
      }
    });

    const variance = Math.abs(totalPostedDebit - totalPostedCredit);

    return {
      totalPostedDebit,
      totalPostedCredit,
      variance,
      isBalanced: variance < 0.01,
      totalCount: filteredEntries.length,
      postedCount: filteredEntries.filter((e) => e.status === "POSTED").length,
      reversedCount: filteredEntries.filter((e) => e.status === "REVERSED").length,
    };
  }, [filteredEntries]);

  // Handle Journal Entry Reversal
  const handlePerformReversal = () => {
    if (!viewingEntry) return;
    if (!reversalReason.trim()) {
      setActionError(isAr ? "يرجى كتابة سبب العكس المحاسبي." : "Please enter a reversal reason.");
      return;
    }

    setIsReversing(true);
    setActionError(null);
    setActionSuccess(null);

    const result = reverseJournalEntry(viewingEntry.id, reversalReason.trim());
    setIsReversing(false);

    if (result.success && result.reversalEntry) {
      setActionSuccess(
        isAr
          ? `تمت عملية العكس المحاسبي بنجاح بالقيد رقم #${result.reversalEntry.entryNumber}`
          : `Reversal completed with entry #${result.reversalEntry.entryNumber}`
      );
      setReversalReason("");
      setViewingEntry(null);
    } else {
      setActionError(result.error || (isAr ? "فشل إجراء العكس المحاسبي." : "Failed to reverse journal entry."));
    }
  };

  const getSourceTypeLabel = (st: string) => {
    switch (st) {
      case "RENT_COLLECTION":
        return isAr ? "تحصيل إيجار" : "Rent Collection";
      case "ADMIN_FEE":
        return isAr ? "رسوم إدارية / عمولة" : "Administrative Fee";
      case "PROPERTY_EXPENSE":
        return isAr ? "مصروف عقاري" : "Property Expense";
      case "OFFICE_EXPENSE":
        return isAr ? "مصروف إداري / مكتب" : "Office Expense";
      case "OWNER_TRANSFER":
        return isAr ? "تسوية حوالة مالك" : "Owner Transfer";
      case "OWNER_TRANSFER_REVERSAL":
        return isAr ? "عكس حوالة مالك" : "Owner Transfer Reversal";
      case "BOUNCED_CHEQUE":
        return isAr ? "ارتجاع شيك" : "Bounced Cheque";
      case "FINANCIAL_REVERSAL":
        return isAr ? "قيد عكس مالي" : "Financial Reversal";
      case "MANUAL_JOURNAL":
        return isAr ? "قيد يدوي" : "Manual Journal";
      default:
        return st;
    }
  };

  return (
    <div className="space-y-6 dir-rtl" dir={isAr ? "rtl" : "ltr"}>
      {/* Top Banner & Title */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-xl p-6 shadow-md border border-emerald-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
              <BookOpen className="w-8 h-8 text-emerald-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {isAr ? "دفتر اليومية العامة والأستاذ العام (General Ledger)" : "General Ledger & Journal Entries"}
              </h1>
              <p className="text-sm text-emerald-200 mt-1">
                {isAr
                  ? "السجل المحاسبي المركزي الموحد للقيد المزدوج المربوط بمحرك العمليات المالية"
                  : "Central double-entry accounting ledger integrated with operational financial engine"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-emerald-950/60 px-4 py-2 rounded-lg border border-emerald-500/30">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-200">
              {isAr ? "قيود محمية غير قابلة للتعديل المباشر" : "Protected Immutable Posted Entries"}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isAr ? "إجمالي المدين المرحل" : "Total Posted Debits"}
            </span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
            {stats.totalPostedDebit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {isAr ? "مجموع الأطراف المدينة المقبولة" : "Sum of all posted debits"}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isAr ? "إجمالي الدائن المرحل" : "Total Posted Credits"}
            </span>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
            {stats.totalPostedCredit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {isAr ? "مجموع الأطراف الدائنة المقبولة" : "Sum of all posted credits"}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isAr ? "توازن الأستاذ العام (Variance)" : "Ledger Balance Variance"}
            </span>
            <div
              className={`p-2 rounded-lg ${
                stats.isBalanced
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
            {stats.variance.toFixed(2)} AED
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-medium">
            {stats.isBalanced ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isAr ? "الأستاذ العام متوازن تماماً (0.00)" : "General Ledger Perfectly Balanced"}
              </span>
            ) : (
              <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {isAr ? "تنبيه: يوجد فارق محاسبي غير متوازن" : "Warning: Ledger Discrepancy Found"}
              </span>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isAr ? "عدد القيود المحاسبية" : "Total Journal Entries"}
            </span>
            <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-lg text-teal-600 dark:text-teal-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
            {stats.totalCount}{" "}
            <span className="text-xs text-slate-400 font-normal">
              ({stats.postedCount} {isAr ? "مرحل" : "posted"})
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {stats.reversedCount > 0 && `${stats.reversedCount} ${isAr ? "قيود معكوسة" : "reversed entries"}`}
            {stats.reversedCount === 0 && (isAr ? "جميع القيود مستقرة وفعالة" : "All entries active")}
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {actionSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center justify-between text-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-medium">{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-xs text-emerald-600 underline">
            {isAr ? "إغلاق" : "Dismiss"}
          </button>
        </div>
      )}

      {actionError && (
        <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center justify-between text-red-800 dark:text-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium">{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-xs text-red-600 underline">
            {isAr ? "إغلاق" : "Dismiss"}
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Field */}
          <div className="relative">
            <Search className="w-4 h-4 absolute top-3 right-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? "بحث بالرقم، المرجع، البيان، الحساب..." : "Search entry #, ref, account..."}
              className="w-full pr-9 pl-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Account Filter */}
          <div>
            <select
              value={selectedAccountCode}
              onChange={(e) => setSelectedAccountCode(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">{isAr ? "جميع الحسابات" : "All Accounts"}</option>
              {chartOfAccounts.map((acc) => (
                <option key={acc.id} value={acc.accountCode}>
                  {acc.accountCode} - {isAr ? acc.accountNameAr : acc.accountNameEn}
                </option>
              ))}
            </select>
          </div>

          {/* Source Type Filter */}
          <div>
            <select
              value={selectedSourceType}
              onChange={(e) => setSelectedSourceType(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">{isAr ? "جميع أنواع المعاملات" : "All Transaction Types"}</option>
              <option value="RENT_COLLECTION">{isAr ? "تحصيل إيجار" : "Rent Collection"}</option>
              <option value="ADMIN_FEE">{isAr ? "رسوم إدارية" : "Administrative Fee"}</option>
              <option value="PROPERTY_EXPENSE">{isAr ? "مصروف عقاري" : "Property Expense"}</option>
              <option value="OFFICE_EXPENSE">{isAr ? "مصروف إداري" : "Office Expense"}</option>
              <option value="OWNER_TRANSFER">{isAr ? "تسوية حوالة مالك" : "Owner Transfer"}</option>
              <option value="OWNER_TRANSFER_REVERSAL">{isAr ? "عكس حوالة مالك" : "Owner Transfer Reversal"}</option>
              <option value="BOUNCED_CHEQUE">{isAr ? "ارتجاع شيك" : "Bounced Cheque"}</option>
              <option value="FINANCIAL_REVERSAL">{isAr ? "قيد عكس مالي" : "Financial Reversal"}</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">{isAr ? "جميع الحالات" : "All Statuses"}</option>
              <option value="POSTED">{isAr ? "مرحل (POSTED)" : "POSTED"}</option>
              <option value="REVERSED">{isAr ? "معكوس (REVERSED)" : "REVERSED"}</option>
            </select>
          </div>
        </div>

        {/* Date Filters & Clear */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">{isAr ? "من تاريخ:" : "From:"}</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
            />
            <span className="text-xs font-medium text-slate-500 ms-2">{isAr ? "إلى تاريخ:" : "To:"}</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
            />
          </div>

          {(searchQuery || selectedAccountCode !== "ALL" || selectedSourceType !== "ALL" || selectedStatus !== "ALL" || fromDate || toDate) && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedAccountCode("ALL");
                setSelectedSourceType("ALL");
                setSelectedStatus("ALL");
                setFromDate("");
                setToDate("");
              }}
              className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {isAr ? "إعادة ضبط الفلاتر" : "Reset Filters"}
            </button>
          )}
        </div>
      </div>

      {/* Journal Entry List Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {isAr ? "سجل القيود المحاسبية المرحّلة" : "Posted Journal Entries Record"}
            </h3>
            <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold px-2.5 py-0.5 rounded-full">
              {filteredEntries.length} {isAr ? "قيد" : "entries"}
            </span>
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold">{isAr ? "لا توجد قيود محاسبية تطابق محددات البحث" : "No journal entries found"}</p>
            <p className="text-xs mt-1 text-slate-400">
              {isAr ? "تأكد من اختيار الخيارات الصحيحة أو تغيير الفلاتر" : "Try adjusting your search criteria"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 text-xs font-semibold">
                <tr>
                  <th className="p-3 text-center">{isAr ? "رقم القيد" : "Entry #"}</th>
                  <th className="p-3">{isAr ? "التاريخ" : "Date"}</th>
                  <th className="p-3">{isAr ? "نوع المعاملة" : "Source Event"}</th>
                  <th className="p-3">{isAr ? "المرجع" : "Reference"}</th>
                  <th className="p-3">{isAr ? "البيان / الشرح" : "Description"}</th>
                  <th className="p-3 text-center">{isAr ? "الطرف المدين (Debit)" : "Debit"}</th>
                  <th className="p-3 text-center">{isAr ? "الطرف الدائن (Credit)" : "Credit"}</th>
                  <th className="p-3 text-center">{isAr ? "الحالة" : "Status"}</th>
                  <th className="p-3 text-center">{isAr ? "الإجراء" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredEntries.map((je) => {
                  const isReversed = je.status === "REVERSED";
                  return (
                    <tr
                      key={je.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${
                        isReversed ? "opacity-65 bg-slate-50/50 dark:bg-slate-900/20" : ""
                      }`}
                    >
                      <td className="p-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                        {je.entryNumber}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {je.transactionDate}
                      </td>
                      <td className="p-3 font-medium">
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                          {getSourceTypeLabel(je.sourceType)}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {je.reference || "-"}
                      </td>
                      <td className="p-3 max-w-xs truncate text-slate-800 dark:text-slate-200" title={je.description}>
                        {je.description}
                      </td>
                      <td className="p-3 text-center font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {je.totalDebit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {je.totalCredit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">
                        {isReversed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            <RotateCcw className="w-3 h-3" />
                            {isAr ? "معكوس" : "Reversed"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            {isAr ? "مرحّل" : "Posted"}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            setViewingEntry(je);
                            setActionError(null);
                            setActionSuccess(null);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-xs font-medium transition flex items-center gap-1 mx-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {isAr ? "معاينة التفاصيل" : "View"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Viewing Entry Modal */}
      {viewingEntry && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-700 dir-rtl">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 rounded-xl">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{isAr ? "تفاصيل القيد المحاسبي" : "Journal Entry Details"}</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      #{viewingEntry.entryNumber}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {getSourceTypeLabel(viewingEntry.sourceType)} — {viewingEntry.transactionDate}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewingEntry(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Header Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
                <div>
                  <span className="text-slate-400 block">{isAr ? "المرجع:" : "Reference:"}</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {viewingEntry.reference || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">{isAr ? "محرر القيد:" : "Created By:"}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{viewingEntry.createdBy}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{isAr ? "تاريخ الترحيل:" : "Posting Date:"}</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {new Date(viewingEntry.postingDate).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">{isAr ? "الحالة المحاسبية:" : "Status:"}</span>
                  <span
                    className={`font-bold ${
                      viewingEntry.status === "POSTED" ? "text-emerald-600" : "text-amber-600"
                    }`}
                  >
                    {viewingEntry.status === "POSTED"
                      ? isAr
                        ? "مرحّل ومقبول"
                        : "POSTED"
                      : isAr
                      ? "معكوس بالكامل"
                      : "REVERSED"}
                  </span>
                </div>
              </div>

              {/* Description Statement */}
              <div className="p-3 bg-slate-100 dark:bg-slate-900/40 rounded-lg text-xs text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                <span className="font-bold block mb-1 text-slate-500">{isAr ? "البيان المحاسبي:" : "Description:"}</span>
                <p className="leading-relaxed">{viewingEntry.description}</p>
              </div>

              {/* Individual Journal Lines Table */}
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">
                  {isAr ? "أطراف القيد المحاسبي (Journal Lines)" : "Journal Lines"}
                </h4>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold">
                      <tr>
                        <th className="p-2.5">{isAr ? "رمز الحساب" : "Code"}</th>
                        <th className="p-2.5">{isAr ? "اسم الحساب" : "Account Name"}</th>
                        <th className="p-2.5">{isAr ? "البيان الفرعي" : "Sub Description"}</th>
                        <th className="p-2.5 text-center">{isAr ? "مدين (AED)" : "Debit (AED)"}</th>
                        <th className="p-2.5 text-center">{isAr ? "دائن (AED)" : "Credit (AED)"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {viewingEntry.lines.map((line, idx) => (
                        <tr key={line.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/20">
                          <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-white">
                            {line.accountCode}
                          </td>
                          <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">
                            {isAr ? line.accountNameAr : line.accountNameEn}
                          </td>
                          <td className="p-2.5 text-slate-500 max-w-xs truncate">
                            {line.description || "-"}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {line.debit > 0 ? line.debit.toFixed(2) : "-"}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                            {line.credit > 0 ? line.credit.toFixed(2) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 dark:bg-slate-700/80 font-bold border-t border-slate-200 dark:border-slate-700">
                      <tr>
                        <td colSpan={3} className="p-3 text-left">
                          {isAr ? "الإجمالي:" : "Total:"}
                        </td>
                        <td className="p-3 text-center font-mono text-emerald-600 dark:text-emerald-400">
                          {viewingEntry.totalDebit.toFixed(2)} AED
                        </td>
                        <td className="p-3 text-center font-mono text-blue-600 dark:text-blue-400">
                          {viewingEntry.totalCredit.toFixed(2)} AED
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Balance Verification Footer */}
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-semibold">
                    {isAr ? "القيد متوازن تماماً: مجموع المدين يساوي مجموع الدائن" : "Entry is fully balanced: Debits = Credits"}
                  </span>
                </div>
                <span className="font-mono font-bold">
                  {(viewingEntry.totalDebit - viewingEntry.totalCredit).toFixed(2)} AED Variance
                </span>
              </div>

              {/* Reversal Section (if POSTED) */}
              {viewingEntry.status === "POSTED" && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
                  <h4 className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4" />
                    {isAr ? "عكس القيد المحاسبي (Financial Reversal)" : "Reverse Journal Entry"}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {isAr
                      ? "سيؤدي هذا إلى إنشاء قيد مالي معكوس وحفظ القيد الحالي في السجل كقيد معكوس لضمان نزاهة الحسابات."
                      : "This will create a mirrored reversal journal entry preserving audit integrity."}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={reversalReason}
                      onChange={(e) => setReversalReason(e.target.value)}
                      placeholder={isAr ? "يرجى كتابة سبب العكس المحاسبي..." : "Enter reversal reason..."}
                      className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                    <button
                      onClick={handlePerformReversal}
                      disabled={isReversing}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {isReversing ? (isAr ? "جاري العكس..." : "Reversing...") : isAr ? "تأكيد العكس المحاسبي" : "Confirm Reversal"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
