import React, { useState, useMemo } from "react";
import {
  Printer,
  FileText,
  Search,
  Filter,
  Download,
  Calendar,
  DollarSign,
  ArrowRightLeft,
  Building,
  User,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Eye,
  CreditCard,
  Building2,
  Tag,
  Wallet,
  Coins,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Receipt,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { matchAnyArabicSearch } from "../../utils/arabicTextNormalizer";
import { buildUnifiedFinancialDocuments } from "../../utils/financialDocumentMapper";
import { UnifiedFinancialDocument, UnifiedDocumentType } from "../../types/unifiedPrinting";
import { UnifiedDocumentPreviewModal } from "./UnifiedDocumentPreviewModal";
import { SearchableSelect } from "../common/SearchableSelect";

export const ReceiptAndVoucherPrintingCenter: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentUser } = useAuth();
  const {
    collections = [],
    ownerTransfers = [],
    propertyExpenses = [],
    officePettyCashExpenses = [],
    cheques = [],
    dailyDeposits = [],
    owners = [],
    tenants = [],
    properties = [],
    units = [],
    leases = [],
    logAudit,
  } = useData();

  // 1. Build authoritative unified documents catalog
  const allDocuments = useMemo(() => {
    return buildUnifiedFinancialDocuments({
      collections,
      ownerTransfers,
      propertyExpenses,
      officePettyCashExpenses,
      cheques,
      dailyDeposits,
      owners,
      tenants,
      properties,
      units,
      leases,
    });
  }, [
    collections,
    ownerTransfers,
    propertyExpenses,
    officePettyCashExpenses,
    cheques,
    dailyDeposits,
    owners,
    tenants,
    properties,
    units,
    leases,
  ]);

  // 2. Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<UnifiedDocumentType | "ALL">("ALL");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [datePreset, setDatePreset] = useState<"ALL" | "TODAY" | "THIS_MONTH" | "LAST_MONTH" | "THIS_YEAR">("ALL");

  // 3. Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // 4. Active Preview / Print Modal
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<UnifiedFinancialDocument | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Quick Date Preset Handler
  const handleDatePresetChange = (preset: "ALL" | "TODAY" | "THIS_MONTH" | "LAST_MONTH" | "THIS_YEAR") => {
    setDatePreset(preset);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (preset === "ALL") {
      setDateFrom("");
      setDateTo("");
    } else if (preset === "TODAY") {
      const todayStr = now.toISOString().split("T")[0];
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === "THIS_MONTH") {
      const start = new Date(year, month, 1).toISOString().split("T")[0];
      const end = new Date(year, month + 1, 0).toISOString().split("T")[0];
      setDateFrom(start);
      setDateTo(end);
    } else if (preset === "LAST_MONTH") {
      const start = new Date(year, month - 1, 1).toISOString().split("T")[0];
      const end = new Date(year, month, 0).toISOString().split("T")[0];
      setDateFrom(start);
      setDateTo(end);
    } else if (preset === "THIS_YEAR") {
      const start = `${year}-01-01`;
      const end = `${year}-12-31`;
      setDateFrom(start);
      setDateTo(end);
    }
    setCurrentPage(1);
  };

  // 5. Filtered Documents Logic
  const filteredDocuments = useMemo(() => {
    return allDocuments.filter((doc) => {
      // Type Filter
      if (selectedType !== "ALL" && doc.documentType !== selectedType) return false;

      // Payment Method Filter
      if (selectedPaymentMethod !== "ALL" && doc.paymentMethod !== selectedPaymentMethod) return false;

      // Status Filter
      if (selectedStatus === "PAID_ONLY") {
        if (doc.status !== "PAID" && doc.status !== "POSTED" && doc.status !== "COMPLETED" && doc.status !== "RECONCILED") {
          return false;
        }
      } else if (selectedStatus === "REVERSED_ONLY") {
        if (!doc.isCancelledOrReversed) return false;
      }

      // Property Filter
      if (selectedPropertyId !== "ALL" && doc.propertyId !== selectedPropertyId) return false;

      // Date Range Filter
      if (dateFrom) {
        const docDateStr = doc.date ? doc.date.split("T")[0] : "";
        if (docDateStr < dateFrom) return false;
      }
      if (dateTo) {
        const docDateStr = doc.date ? doc.date.split("T")[0] : "";
        if (docDateStr > dateTo) return false;
      }

      // Text Search with Arabic normalization
      if (searchQuery.trim()) {
        const q = searchQuery.trim();
        const searchPool = [
          doc.documentNumber || "",
          doc.authoritativeId || "",
          doc.titleAr || "",
          doc.titleEn || "",
          doc.partyName || "",
          doc.partyPhone || "",
          doc.propertyName || "",
          doc.unitNumber || "",
          doc.leaseNumber || "",
          doc.referenceNumber || "",
          doc.chequeNumber || "",
          doc.bankName || "",
          doc.iban || "",
          doc.description || "",
          doc.notes || "",
          doc.recordedByName || "",
          (doc.amount || 0).toString(),
        ];

        const matches = matchAnyArabicSearch(searchPool, q);
        if (!matches) return false;
      }

      return true;
    });
  }, [
    allDocuments,
    selectedType,
    selectedPaymentMethod,
    selectedStatus,
    selectedPropertyId,
    dateFrom,
    dateTo,
    searchQuery,
  ]);

  // 6. KPIs & Summary Stats
  const stats = useMemo(() => {
    let totalAll = 0;
    let totalReceipts = 0;
    let totalSecurityDeposits = 0;
    let totalOwnerVouchers = 0;
    let totalExpenses = 0;
    let totalPettyCash = 0;
    let totalCheques = 0;
    let totalAmountAED = 0;

    allDocuments.forEach((d) => {
      totalAll++;
      totalAmountAED += Number(d.amount || 0);
      if (d.documentType === "RENTAL_RECEIPT") totalReceipts++;
      else if (d.documentType === "SECURITY_DEPOSIT_RECEIPT") totalSecurityDeposits++;
      else if (d.documentType === "OWNER_PAYMENT_VOUCHER") totalOwnerVouchers++;
      else if (d.documentType === "PROPERTY_EXPENSE_VOUCHER") totalExpenses++;
      else if (d.documentType === "PETTY_CASH_VOUCHER") totalPettyCash++;
      else if (d.documentType === "CHEQUE_RECEIPT") totalCheques++;
    });

    return {
      totalAll,
      totalReceipts,
      totalSecurityDeposits,
      totalOwnerVouchers,
      totalExpenses,
      totalPettyCash,
      totalCheques,
      totalAmountAED,
    };
  }, [allDocuments]);

  // 7. Paginated Slices
  const totalPages = Math.ceil(filteredDocuments.length / pageSize) || 1;
  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDocuments.slice(start, start + pageSize);
  }, [filteredDocuments, currentPage, pageSize]);

  const handleOpenPreview = (doc: UnifiedFinancialDocument) => {
    setSelectedDocForPreview(doc);
    setIsPreviewModalOpen(true);
  };

  const getTypeBadge = (type: UnifiedDocumentType) => {
    switch (type) {
      case "RENTAL_RECEIPT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Receipt className="w-3.5 h-3.5 text-emerald-600" />
            {isAr ? "إيصال قبض إيجاري" : "Rental Receipt"}
          </span>
        );
      case "SECURITY_DEPOSIT_RECEIPT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
            <Receipt className="w-3.5 h-3.5 text-cyan-600" />
            {isAr ? "سند استلام تأمين" : "Security Deposit"}
          </span>
        );
      case "OWNER_PAYMENT_VOUCHER":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
            {isAr ? "سند صرف للمالك" : "Owner Payment"}
          </span>
        );
      case "PROPERTY_EXPENSE_VOUCHER":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Building2 className="w-3.5 h-3.5 text-amber-600" />
            {isAr ? "سند مصروفات وصيانة" : "Property Expense"}
          </span>
        );
      case "PETTY_CASH_VOUCHER":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
            <Wallet className="w-3.5 h-3.5 text-teal-600" />
            {isAr ? "سند نثرية مكتبية" : "Petty Cash"}
          </span>
        );
      case "CHEQUE_RECEIPT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
            <CreditCard className="w-3.5 h-3.5 text-purple-600" />
            {isAr ? "سند استلام شيك" : "Cheque Receipt"}
          </span>
        );
      case "BANK_DEPOSIT_SLIP":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <Building className="w-3.5 h-3.5 text-blue-600" />
            {isAr ? "سند إيداع بنكي" : "Bank Deposit"}
          </span>
        );
      default:
        return <span>{type}</span>;
    }
  };

  // Export filtered table to CSV
  const handleExportCSV = () => {
    const headers = [
      isAr ? "رقم السند" : "Document #",
      isAr ? "التاريخ" : "Date",
      isAr ? "نوع السند" : "Document Type",
      isAr ? "الطرف" : "Party Name",
      isAr ? "المبلغ (AED)" : "Amount (AED)",
      isAr ? "طريقة الدفع" : "Payment Method",
      isAr ? "العقار" : "Property",
      isAr ? "الوحدة" : "Unit",
      isAr ? "الحالة" : "Status",
      isAr ? "المعرف المالي" : "Authoritative ID",
    ];

    const rows = filteredDocuments.map((d) => [
      d.documentNumber,
      d.date ? d.date.split("T")[0] : "",
      d.titleAr,
      d.partyName,
      (d.amount ?? 0).toString(),
      d.paymentMethod,
      d.propertyName || "",
      d.unitNumber || "",
      d.status,
      d.authoritativeId || d.id || "",
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((e) => e.map((val) => `"${(val || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `سجل_السندات_المالية_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" dir={isAr ? "rtl" : "ltr"}>
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
              <Printer className="w-3.5 h-3.5" />
              <span>{isAr ? "المنظومة المالية الموحدة للطباعة" : "Unified Financial Printing System"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {isAr ? "مركز طباعة السندات والإيصالات المالية" : "Financial Receipts & Vouchers Printing Center"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
              {isAr
                ? "لوحة تحكم رسمية موحدة لمعاينة وطباعة وتصدير كافة الإيصالات وسندات القبض والصرف المعتمدة، مرتبطة مباشرة بسجلات القيود المالية الأصلية دون تكرار أو مساس بالسلامة المحاسبية."
                : "Authoritative centralized center to preview, print, and export certified payment receipts and disbursement vouchers directly linked to original ledger transactions."}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-slate-700 shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>{isAr ? "تصدير الجدول (Excel/CSV)" : "Export CSV"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Live KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Documents */}
        <div
          onClick={() => {
            setSelectedType("ALL");
            setCurrentPage(1);
          }}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            selectedType === "ALL"
              ? "bg-slate-900 text-white border-slate-900 shadow-lg scale-102"
              : "bg-white text-slate-900 border-slate-200 hover:border-slate-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-bold ${selectedType === "ALL" ? "text-amber-400" : "text-slate-500"}`}>
              {isAr ? "إجمالي السندات" : "Total Documents"}
            </span>
            <FileText className={`w-4 h-4 ${selectedType === "ALL" ? "text-amber-400" : "text-slate-400"}`} />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono">{stats.totalAll.toLocaleString()}</div>
          <div className={`text-[10px] mt-1 ${selectedType === "ALL" ? "text-slate-300" : "text-slate-500"}`}>
            {isAr ? "كافة الحركات المالية" : "All transactions"}
          </div>
        </div>

        {/* Rental Receipts */}
        <div
          onClick={() => {
            setSelectedType("RENTAL_RECEIPT");
            setCurrentPage(1);
          }}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            selectedType === "RENTAL_RECEIPT"
              ? "bg-emerald-800 text-white border-emerald-800 shadow-lg scale-102"
              : "bg-white text-slate-900 border-slate-200 hover:border-emerald-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-bold ${selectedType === "RENTAL_RECEIPT" ? "text-emerald-200" : "text-emerald-700"}`}>
              {isAr ? "إيصالات القبض" : "Rental Receipts"}
            </span>
            <Receipt className={`w-4 h-4 ${selectedType === "RENTAL_RECEIPT" ? "text-emerald-200" : "text-emerald-600"}`} />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono">{stats.totalReceipts.toLocaleString()}</div>
          <div className={`text-[10px] mt-1 ${selectedType === "RENTAL_RECEIPT" ? "text-emerald-100" : "text-slate-500"}`}>
            {isAr ? "سندات تحصيل الإيجارات" : "Tenant collections"}
          </div>
        </div>

        {/* Security Deposits */}
        <div
          onClick={() => {
            setSelectedType("SECURITY_DEPOSIT_RECEIPT");
            setCurrentPage(1);
          }}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            selectedType === "SECURITY_DEPOSIT_RECEIPT"
              ? "bg-cyan-800 text-white border-cyan-800 shadow-lg scale-102"
              : "bg-white text-slate-900 border-slate-200 hover:border-cyan-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-bold ${selectedType === "SECURITY_DEPOSIT_RECEIPT" ? "text-cyan-200" : "text-cyan-700"}`}>
              {isAr ? "تأمينات الإيجار" : "Security Deposits"}
            </span>
            <Receipt className={`w-4 h-4 ${selectedType === "SECURITY_DEPOSIT_RECEIPT" ? "text-cyan-200" : "text-cyan-600"}`} />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono">{stats.totalSecurityDeposits.toLocaleString()}</div>
          <div className={`text-[10px] mt-1 ${selectedType === "SECURITY_DEPOSIT_RECEIPT" ? "text-cyan-100" : "text-slate-500"}`}>
            {isAr ? "سندات التأمين المحتجز" : "Held deposit collections"}
          </div>
        </div>

        {/* Owner Transfers */}
        <div
          onClick={() => {
            setSelectedType("OWNER_PAYMENT_VOUCHER");
            setCurrentPage(1);
          }}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            selectedType === "OWNER_PAYMENT_VOUCHER"
              ? "bg-indigo-800 text-white border-indigo-800 shadow-lg scale-102"
              : "bg-white text-slate-900 border-slate-200 hover:border-indigo-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-bold ${selectedType === "OWNER_PAYMENT_VOUCHER" ? "text-indigo-200" : "text-indigo-700"}`}>
              {isAr ? "سندات الملاك" : "Owner Vouchers"}
            </span>
            <ArrowRightLeft className={`w-4 h-4 ${selectedType === "OWNER_PAYMENT_VOUCHER" ? "text-indigo-200" : "text-indigo-600"}`} />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono">{stats.totalOwnerVouchers.toLocaleString()}</div>
          <div className={`text-[10px] mt-1 ${selectedType === "OWNER_PAYMENT_VOUCHER" ? "text-indigo-100" : "text-slate-500"}`}>
            {isAr ? "صرف وتحويل الإيجار" : "Owner payouts"}
          </div>
        </div>

        {/* Property Expenses */}
        <div
          onClick={() => {
            setSelectedType("PROPERTY_EXPENSE_VOUCHER");
            setCurrentPage(1);
          }}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            selectedType === "PROPERTY_EXPENSE_VOUCHER"
              ? "bg-amber-800 text-white border-amber-800 shadow-lg scale-102"
              : "bg-white text-slate-900 border-slate-200 hover:border-amber-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-bold ${selectedType === "PROPERTY_EXPENSE_VOUCHER" ? "text-amber-200" : "text-amber-700"}`}>
              {isAr ? "سندات المصروفات" : "Expenses"}
            </span>
            <Building2 className={`w-4 h-4 ${selectedType === "PROPERTY_EXPENSE_VOUCHER" ? "text-amber-200" : "text-amber-600"}`} />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono">{stats.totalExpenses.toLocaleString()}</div>
          <div className={`text-[10px] mt-1 ${selectedType === "PROPERTY_EXPENSE_VOUCHER" ? "text-amber-100" : "text-slate-500"}`}>
            {isAr ? "مصروفات العقارات والصيانة" : "Property & Maintenance"}
          </div>
        </div>

        {/* Petty Cash */}
        <div
          onClick={() => {
            setSelectedType("PETTY_CASH_VOUCHER");
            setCurrentPage(1);
          }}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            selectedType === "PETTY_CASH_VOUCHER"
              ? "bg-teal-800 text-white border-teal-800 shadow-lg scale-102"
              : "bg-white text-slate-900 border-slate-200 hover:border-teal-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-bold ${selectedType === "PETTY_CASH_VOUCHER" ? "text-teal-200" : "text-teal-700"}`}>
              {isAr ? "سندات النثرية" : "Petty Cash"}
            </span>
            <Wallet className={`w-4 h-4 ${selectedType === "PETTY_CASH_VOUCHER" ? "text-teal-200" : "text-teal-600"}`} />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono">{stats.totalPettyCash.toLocaleString()}</div>
          <div className={`text-[10px] mt-1 ${selectedType === "PETTY_CASH_VOUCHER" ? "text-teal-100" : "text-slate-500"}`}>
            {isAr ? "مصاريف وعهدة المكتب" : "Office petty expenses"}
          </div>
        </div>

        {/* Cheques */}
        <div
          onClick={() => {
            setSelectedType("CHEQUE_RECEIPT");
            setCurrentPage(1);
          }}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            selectedType === "CHEQUE_RECEIPT"
              ? "bg-purple-800 text-white border-purple-800 shadow-lg scale-102"
              : "bg-white text-slate-900 border-slate-200 hover:border-purple-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-bold ${selectedType === "CHEQUE_RECEIPT" ? "text-purple-200" : "text-purple-700"}`}>
              {isAr ? "سندات الشيكات" : "Cheques"}
            </span>
            <CreditCard className={`w-4 h-4 ${selectedType === "CHEQUE_RECEIPT" ? "text-purple-200" : "text-purple-600"}`} />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono">{stats.totalCheques.toLocaleString()}</div>
          <div className={`text-[10px] mt-1 ${selectedType === "CHEQUE_RECEIPT" ? "text-purple-100" : "text-slate-500"}`}>
            {isAr ? "حركات وسندات الشيكات" : "Cheque custody"}
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        {/* Row 1: Search Bar & Preset Tags */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={
                isAr
                  ? "بحث سريع برقم السند، رقم المعاملة، اسم المستأجر، المالك، العقار، الوحدة، رقم الشيك، المبلغ..."
                  : "Search by voucher #, transaction ID, tenant, owner, property, unit, cheque #, amount..."
              }
              className="w-full ps-10 pe-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all font-medium"
            />
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {(
              [
                { id: "ALL", labelAr: "الكل", labelEn: "All" },
                { id: "TODAY", labelAr: "اليوم", labelEn: "Today" },
                { id: "THIS_MONTH", labelAr: "هذا الشهر", labelEn: "This Month" },
                { id: "LAST_MONTH", labelAr: "الشهر السابق", labelEn: "Last Month" },
                { id: "THIS_YEAR", labelAr: "هذا العام", labelEn: "This Year" },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => handleDatePresetChange(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  datePreset === p.id
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {isAr ? p.labelAr : p.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Detailed Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Document Type */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              {isAr ? "نوع المستند:" : "Document Type:"}
            </label>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">{isAr ? "جميع أنواع المستندات" : "All Document Types"}</option>
              <option value="RENTAL_RECEIPT">{isAr ? "إيصالات وسندات القبض الإيجاري" : "Rental Collection Receipts"}</option>
              <option value="SECURITY_DEPOSIT_RECEIPT">{isAr ? "سندات استلام مبلغ التأمين" : "Security Deposit Receipts"}</option>
              <option value="OWNER_PAYMENT_VOUCHER">{isAr ? "سندات صرف وتحويل الملاك" : "Owner Payment Vouchers"}</option>
              <option value="PROPERTY_EXPENSE_VOUCHER">{isAr ? "سندات مصروفات العقار والصيانة" : "Property & Maintenance Vouchers"}</option>
              <option value="PETTY_CASH_VOUCHER">{isAr ? "سندات النثرية المكتبية" : "Petty Cash Vouchers"}</option>
              <option value="CHEQUE_RECEIPT">{isAr ? "سندات استلام وحركة الشيكات" : "Cheque Custody Receipts"}</option>
              <option value="BANK_DEPOSIT_SLIP">{isAr ? "سندات الإيداع البنكي" : "Bank Deposit Slips"}</option>
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              {isAr ? "طريقة السداد:" : "Payment Method:"}
            </label>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => {
                setSelectedPaymentMethod(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">{isAr ? "كافة طرق الدفع" : "All Methods"}</option>
              <option value="BANK_TRANSFER">{isAr ? "تحويل بنكي / مصرفي" : "Bank Transfer"}</option>
              <option value="CHEQUE">{isAr ? "شيك مصرفي" : "Cheque"}</option>
              <option value="CASH">{isAr ? "نقداً (كاش)" : "Cash"}</option>
              <option value="VISA">{isAr ? "بطاقة ائتمان فيزا" : "Visa"}</option>
              <option value="MASTERCARD">{isAr ? "ماستركارد" : "Mastercard"}</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              {isAr ? "الحالة المالية:" : "Financial Status:"}
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">{isAr ? "جميع الحالات" : "All Statuses"}</option>
              <option value="PAID_ONLY">{isAr ? "المسدد والمعتمد فقط (Paid)" : "Paid & Settled Only"}</option>
              <option value="REVERSED_ONLY">{isAr ? "الملغى والمعكوس القيد فقط" : "Reversed / Cancelled Only"}</option>
            </select>
          </div>

          {/* Date Range From/To */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">{isAr ? "من:" : "From:"}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setDatePreset("ALL");
                  setCurrentPage(1);
                }}
                className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">{isAr ? "إلى:" : "To:"}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setDatePreset("ALL");
                  setCurrentPage(1);
                }}
                className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Unified Documents Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Header Bar */}
        <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">
              {isAr ? "سجل السندات والإيصالات المالية المعتمدة" : "Certified Financial Documents Register"}
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold font-mono">
              {filteredDocuments.length.toLocaleString()} {isAr ? "سند" : "docs"}
            </span>
          </div>

          {/* Page size selector */}
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>{isAr ? "عرض في الصفحة:" : "Show per page:"}</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="py-1 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 text-start">{isAr ? "التاريخ" : "Date"}</th>
                <th className="py-3 px-4 text-start">{isAr ? "رقم السند" : "Voucher #"}</th>
                <th className="py-3 px-4 text-start">{isAr ? "نوع المستند" : "Document Type"}</th>
                <th className="py-3 px-4 text-start">{isAr ? "الطرف المعني" : "Party / Beneficiary"}</th>
                <th className="py-3 px-4 text-start">{isAr ? "العقار / الوحدة" : "Property / Unit"}</th>
                <th className="py-3 px-4 text-end">{isAr ? "المبلغ (AED)" : "Amount (AED)"}</th>
                <th className="py-3 px-4 text-center">{isAr ? "طريقة الدفع" : "Method"}</th>
                <th className="py-3 px-4 text-center">{isAr ? "الحالة" : "Status"}</th>
                <th className="py-3 px-4 text-end">{isAr ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedDocs.length > 0 ? (
                paginatedDocs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-amber-50/40 transition-colors group cursor-pointer"
                    onClick={() => handleOpenPreview(doc)}
                  >
                    {/* Date */}
                    <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                      {doc.date ? doc.date.split("T")[0] : "—"}
                    </td>

                    {/* Voucher # */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-amber-600 font-black">#{doc.documentNumber}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {(doc.authoritativeId || doc.id || "").substring(0, 10)}
                      </span>
                    </td>

                    {/* Type Badge */}
                    <td className="py-3 px-4 whitespace-nowrap">{getTypeBadge(doc.documentType)}</td>

                    {/* Party Name */}
                    <td className="py-3 px-4 max-w-[200px]">
                      <div className="font-bold text-slate-900 truncate">{doc.partyName}</div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {doc.partyType === "TENANT"
                          ? isAr ? "مستأجر" : "Tenant"
                          : doc.partyType === "OWNER"
                          ? isAr ? "مالك" : "Owner"
                          : doc.partyType === "VENDOR"
                          ? isAr ? "مورد / مقاول" : "Vendor"
                          : doc.partyType === "EMPLOYEE"
                          ? isAr ? "موظف" : "Employee"
                          : doc.partyType}
                        {doc.partyPhone ? ` • ${doc.partyPhone}` : ""}
                      </div>
                    </td>

                    {/* Property / Unit */}
                    <td className="py-3 px-4 max-w-[180px]">
                      {doc.propertyName ? (
                        <div>
                          <span className="font-semibold text-slate-800 truncate block">{doc.propertyName}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {doc.unitNumber ? `${isAr ? "وحدة:" : "Unit:"} #${doc.unitNumber}` : ""}
                            {doc.leaseNumber ? ` • ${isAr ? "عقد:" : "Lease:"} #${doc.leaseNumber}` : ""}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Amount AED */}
                    <td className="py-3 px-4 text-end whitespace-nowrap">
                      <div className="font-mono font-black text-slate-900 text-sm">
                        AED {doc.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      {doc.vatAmount ? (
                        <span className="text-[10px] text-amber-700 font-medium">
                          {isAr ? `شامل ضريبة ${doc.vatAmount} درهم` : `Incl. VAT ${doc.vatAmount} AED`}
                        </span>
                      ) : null}
                    </td>

                    {/* Payment Method */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className="px-2 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
                        {doc.paymentMethod}
                      </span>
                      {doc.referenceNumber && (
                        <span className="block text-[10px] text-slate-400 font-mono truncate max-w-[100px] mx-auto">
                          {doc.referenceNumber}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {doc.isCancelledOrReversed ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          {isAr ? "ملغى" : "Reversed"}
                        </span>
                      ) : doc.status === "PAID" || doc.status === "POSTED" || doc.status === "COMPLETED" || doc.status === "RECONCILED" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {isAr ? "معتمد" : "Paid"}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          {doc.status}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-end whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenPreview(doc)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all"
                          title={isAr ? "معاينة السند" : "Preview"}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenPreview(doc)}
                          disabled={!doc.isPrintable}
                          className={`p-1.5 rounded-lg transition-all ${
                            doc.isPrintable
                              ? "bg-amber-100 hover:bg-amber-200 text-amber-900"
                              : "bg-slate-100 text-slate-400 cursor-not-allowed"
                          }`}
                          title={doc.isPrintable ? (isAr ? "طباعة السند" : "Print") : doc.unprintableReasonAr}
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 space-y-2">
                    <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-700">
                      {isAr ? "لا توجد سندات أو إيصالات مالية مطابقة لشروط البحث" : "No financial vouchers matching filter criteria"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {isAr ? "جرّب تغيير فلاتر البحث أو النطاق الزمني" : "Try adjusting your search queries or date filters"}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer & Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              {isAr
                ? `عرض ${(currentPage - 1) * pageSize + 1} إلى ${Math.min(currentPage * pageSize, filteredDocuments.length)} من أصل ${filteredDocuments.length} سند`
                : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, filteredDocuments.length)} of ${filteredDocuments.length} vouchers`}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <span className="font-mono font-bold px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-900">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Unified Document Preview & Print Modal */}
      <UnifiedDocumentPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => {
          setIsPreviewModalOpen(false);
          setSelectedDocForPreview(null);
        }}
        document={selectedDocForPreview}
      />
    </div>
  );
};
