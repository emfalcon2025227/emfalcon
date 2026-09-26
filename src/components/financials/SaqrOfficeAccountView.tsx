import React, { useState, useMemo } from "react";
import {
  Building2,
  Wallet,
  DollarSign,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  FileSpreadsheet,
  Printer,
  Edit,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  CreditCard,
  Building,
  Receipt,
  Sparkles,
  Layers,
  HelpCircle,
  X,
  AlertTriangle
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { getApplicableVatRate } from "../../services/financialEngine";
import { SearchableSelect } from "../common/SearchableSelect";
import { matchAnyArabicSearch } from "../../utils/arabicTextNormalizer";
import { SaqrOfficeManualTransaction } from "../../types";
import { OfficePrintHeader } from "../common/OfficePrintHeader";

export const SaqrOfficeAccountView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentUser, hasPermission } = useAuth();
  const {
    saqrOfficeConfig,
    updateSaqrOfficeConfig,
    saqrOfficeManualTransactions = [],
    addOfficeSaqrTransaction,
    deleteOfficeSaqrTransaction,
    collections = [],
    propertyExpenses = [],
    owners = [],
    properties = [],
    commissions = [],
    paymentAllocations = [],
    financialReversals = [],
    vatRates = [],
  } = useData();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<"ALL" | "DEPOSIT" | "WITHDRAWAL">("ALL");

  // Modals
  const [isEditConfigModalOpen, setIsEditConfigModalOpen] = useState(false);
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Edit Config Form
  const [officeNameAr, setOfficeNameAr] = useState(saqrOfficeConfig.officeNameAr);
  const [officeNameEn, setOfficeNameEn] = useState(saqrOfficeConfig.officeNameEn);
  const [bankName, setBankName] = useState(saqrOfficeConfig.bankName);
  const [accountNumber, setAccountNumber] = useState(saqrOfficeConfig.accountNumber);
  const [iban, setIban] = useState(saqrOfficeConfig.iban);

  // Add Manual Tx Form
  const [txType, setTxType] = useState<"DEPOSIT" | "WITHDRAWAL">("DEPOSIT");
  const [txAmount, setTxAmount] = useState<number>(1000);
  const [txCategory, setTxCategory] = useState<"ADMIN_FEE" | "BOUNCED_PENALTY" | "CLEANING" | "GUARD" | "OTHER_INCOME" | "OTHER_EXPENSE">("OTHER_INCOME");
  const [txDescription, setTxDescription] = useState("");
  const [txRefNumber, setTxRefNumber] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [txError, setTxError] = useState("");

  // Automatically gather all items destined for Office Account
  const autoTransactions = useMemo(() => {
    const list: Array<{
      id: string;
      date: string;
      type: "DEPOSIT" | "WITHDRAWAL";
      amount: number;
      netRevenue?: number;
      vatAmount?: number;
      category: string;
      categoryName: string;
      description: string;
      source: string;
      reference?: string;
      isAuto: boolean;
      createdAt: string;
    }> = [];

    // 1. Bounced Cheque Penalties from Collections
    collections.forEach((col) => {
      // Skip if collection itself is reversed
      const isColReversed = financialReversals.some(r => r.targetType === "COLLECTION" && r.targetId === col.id);
      if (isColReversed) return;

      if (col.bouncedFeeAmount && col.bouncedFeeAmount > 0) {
        list.push({
          id: `bounced-${col.id}`,
          date: col.paymentDate || col.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          type: "DEPOSIT",
          amount: col.bouncedFeeAmount,
          category: "BOUNCED_PENALTY",
          categoryName: isAr ? "غرامة شيك راجع" : "Bounced Cheque Penalty",
          description: isAr ? `تحصيل غرامة شيك راجع من المستأجر: ${col.payerName || "المستأجر"}` : `Bounced cheque penalty collected from ${col.payerName || "Tenant"}`,
          source: col.payerName || (isAr ? "مستأجر" : "Tenant"),
          reference: col.transactionReference || col.id,
          isAuto: true,
          createdAt: col.createdAt,
        });
      }

      // 2. Administrative Fees collected
      if (col.adminFeeAmount && col.adminFeeAmount > 0) {
        let totalNet = 0;
        let totalVat = 0;
        const relatedAllocations = paymentAllocations.filter(a => a.collectionId === col.id && a.targetType === "COMMISSION" && a.status === "ACTIVE");
        relatedAllocations.forEach(alloc => {
          const comm = commissions.find(c => c.id === alloc.targetId);
          if (comm && comm.totalCommissionAmount > 0) {
            const ratio = alloc.allocatedAmount / comm.totalCommissionAmount;
            totalNet += (comm.netRevenueAmount || 0) * ratio;
            totalVat += (comm.vatAmount || 0) * ratio;
          }
        });
        if (totalNet === 0 && totalVat === 0) {
          // Fallback for legacy records or missing commission data
          const fallbackVatRate = getApplicableVatRate(
            col.paymentDate || col.createdAt || new Date().toISOString(),
            vatRates,
            "ADMIN_FEE"
          );
          totalVat = Math.round((col.adminFeeAmount * fallbackVatRate / (100 + fallbackVatRate)) * 100) / 100;
          totalNet = Math.round((col.adminFeeAmount - totalVat) * 100) / 100;
        } else {
          totalNet = Math.round(totalNet * 100) / 100;
          totalVat = Math.round(totalVat * 100) / 100;
        }
        list.push({
          id: `admin-${col.id}`,
          date: col.paymentDate || col.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          type: "DEPOSIT",
          amount: col.adminFeeAmount,
          netRevenue: totalNet,
          vatAmount: totalVat,
          category: "ADMIN_FEE",
          categoryName: isAr ? "رسوم إدارية" : "Administrative Fee",
          description: isAr ? `رسوم إدارية محصلة من سند قبض رقم ${col.id ? col.id.slice(-6) : ""}` : `Admin fee collected from receipt #${col.id ? col.id.slice(-6) : ""}`,
          source: col.payerName || (isAr ? "مستأجر" : "Tenant"),
          reference: col.transactionReference,
          isAuto: true,
          createdAt: col.createdAt,
        });
      }
    });

    // 3. Cleaning and Guard / Security Deductions from Owners
    propertyExpenses.forEach((exp) => {
      if (exp.status !== "CANCELLED" && exp.status !== "REVERSED") {
        const descLower = (exp.description || "").toLowerCase();
        const catLower = (exp.category || "").toLowerCase();
        
        const isCleaning = descLower.includes("نظافة") || catLower.includes("cleaning") || descLower.includes("تنظيف");
        const isGuard = descLower.includes("حراسة") || catLower.includes("security") || descLower.includes("أمن") || descLower.includes("guard");
        
        if ((isCleaning || isGuard) && exp.costBearer === "OWNER") {
          const owner = owners.find(o => o.id === exp.ownerId);
          const ownerName = owner ? (isAr ? owner.nameAr : owner.nameEn) : (isAr ? "مالك العقار" : "Property Owner");
          
          list.push({
            id: `exp-deduct-${exp.id}`,
            date: exp.expenseDate || exp.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            type: "DEPOSIT", // Deduction from owner goes to office account
            amount: exp.amount,
            category: isCleaning ? "CLEANING" : "GUARD",
            categoryName: isCleaning ? (isAr ? "خصم نظافة من المالك" : "Cleaning Deduction") : (isAr ? "خصم حراسة من المالك" : "Guard Deduction"),
            description: isAr ? `خصم ${isCleaning ? "نظافة" : "حراسة"} لصالح المكتب من المالك: ${ownerName} (${exp.description})` : `${isCleaning ? "Cleaning" : "Guard"} deduction credited to office from owner: ${ownerName}`,
            source: ownerName,
            reference: exp.expenseNumber || exp.id,
            isAuto: true,
            createdAt: exp.createdAt,
          });
        }
      }
    });

    // 4. Manual Transactions added by user
    saqrOfficeManualTransactions.forEach((tx) => {
      let catName = "";
      switch (tx.category) {
        case "ADMIN_FEE": catName = isAr ? "رسوم إدارية" : "Admin Fee"; break;
        case "BOUNCED_PENALTY": catName = isAr ? "غرامة شيك راجع" : "Bounced Penalty"; break;
        case "CLEANING": catName = isAr ? "نظافة" : "Cleaning"; break;
        case "GUARD": catName = isAr ? "حراسة وأمن" : "Guard & Security"; break;
        case "OTHER_INCOME": catName = isAr ? "إيراد يدوي إضافي" : "Other Income"; break;
        case "OTHER_EXPENSE": catName = isAr ? "مصروف يدوي إضافي" : "Other Expense"; break;
      }

      list.push({
        id: tx.id,
        date: tx.date,
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        categoryName: catName,
        description: tx.description,
        source: isAr ? "إدخال يدوي مباشر" : "Manual Direct Entry",
        reference: tx.referenceNumber,
        isAuto: false,
        createdAt: tx.createdAt,
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [collections, propertyExpenses, saqrOfficeManualTransactions, owners, isAr]);

  // Filter transactions based on search and filters
  const filteredTransactions = useMemo(() => {
    return autoTransactions.filter((tx) => {
      if (selectedType !== "ALL" && tx.type !== selectedType) return false;
      if (selectedCategory !== "ALL" && tx.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesText =
          tx.description.toLowerCase().includes(query) ||
          tx.source.toLowerCase().includes(query) ||
          tx.categoryName.toLowerCase().includes(query) ||
          (tx.reference && tx.reference.toLowerCase().includes(query));
        if (!matchesText) return false;
      }
      return true;
    });
  }, [autoTransactions, selectedType, selectedCategory, searchQuery]);

  // Calculate totals
  const totalDeposits = useMemo(() => {
    return autoTransactions
      .filter((tx) => tx.type === "DEPOSIT")
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [autoTransactions]);

  const totalWithdrawals = useMemo(() => {
    return autoTransactions
      .filter((tx) => tx.type === "WITHDRAWAL")
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [autoTransactions]);

  const netOfficeBalance = totalDeposits - totalWithdrawals;

  const totalBouncedPenalties = useMemo(() => {
    return autoTransactions
      .filter((tx) => tx.category === "BOUNCED_PENALTY")
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [autoTransactions]);

  const totalAdminFees = useMemo(() => {
    return autoTransactions
      .filter((tx) => tx.category === "ADMIN_FEE")
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [autoTransactions]);

  const totalCleaningGuard = useMemo(() => {
    return autoTransactions
      .filter((tx) => tx.category === "CLEANING" || tx.category === "GUARD")
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [autoTransactions]);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateSaqrOfficeConfig({
      officeNameAr,
      officeNameEn,
      bankName,
      accountNumber,
      iban,
    });
    setIsEditConfigModalOpen(false);
  };

  const handleAddManualTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txDescription.trim() || txAmount <= 0) {
      setTxError(isAr ? "يرجى إدخال وصف صحيح ومبلغ أكبر من الصفر." : "Please enter a valid description and amount greater than zero.");
      return;
    }

    addOfficeSaqrTransaction({
      id: `tx-${Date.now()}`,
      date: txDate,
      type: txType,
      amount: txAmount,
      category: txCategory,
      description: txDescription,
      referenceNumber: txRefNumber || undefined,
      uploadedBy: (isAr ? currentUser?.nameAr : currentUser?.nameEn) || "Admin",
      createdAt: new Date().toISOString(),
    });

    setTxDescription("");
    setTxRefNumber("");
    setTxAmount(1000);
    setTxError("");
    setIsAddTxModalOpen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Printable Header with Office Logo and Name */}
      <OfficePrintHeader
        titleAr={`كشف حساب ${saqrOfficeConfig.officeNameAr}`}
        titleEn={`ACCOUNT STATEMENT - ${saqrOfficeConfig.officeNameEn}`}
        subtitleAr={`رقم الحساب: ${saqrOfficeConfig.accountNumber} | IBAN: ${saqrOfficeConfig.iban}`}
        subtitleEn={`Account No: ${saqrOfficeConfig.accountNumber} | IBAN: ${saqrOfficeConfig.iban}`}
        hideOnScreen={true}
      />

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-500/20 relative overflow-hidden print:hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <Building2 className="w-4 h-4" />
              <span>{isAr ? "حساب المكتب الرئيسي المعتمد" : "Main Office Account"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {isAr ? saqrOfficeConfig.officeNameAr : saqrOfficeConfig.officeNameEn}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 font-mono">
              <span className="flex items-center gap-1 bg-slate-800/80 px-3 py-1 rounded-xl border border-slate-700">
                <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                {isAr ? "رقم الحساب:" : "Account No:"} <strong className="text-white">{saqrOfficeConfig.accountNumber}</strong>
              </span>
              <span className="flex items-center gap-1 bg-slate-800/80 px-3 py-1 rounded-xl border border-slate-700">
                <Building className="w-3.5 h-3.5 text-emerald-400" />
                {isAr ? "آيبان (IBAN):" : "IBAN:"} <strong className="text-emerald-400">{saqrOfficeConfig.iban}</strong>
              </span>
              <span className="bg-indigo-900/50 text-indigo-200 px-3 py-1 rounded-xl border border-indigo-700/50">
                {saqrOfficeConfig.bankName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setIsEditConfigModalOpen(true)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition flex items-center gap-2"
            >
              <Edit className="w-4 h-4 text-indigo-400" />
              <span>{isAr ? "تعديل بيانات ورقم الحساب" : "Edit Account Details"}</span>
            </button>
            <button
              onClick={() => setIsAddTxModalOpen(true)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{isAr ? "إضافة معاملة يدوية مرنة" : "Add Manual Entry"}</span>
            </button>
            <button
              onClick={handlePrint}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
              title={isAr ? "طباعة التقرير" : "Print Report"}
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full pointer-events-none" />
          <span className="text-xs font-bold text-slate-500 block uppercase">
            {isAr ? "إصافي رصيد حساب المكتب" : "Net Office Balance"}
          </span>
          <div className="text-2xl font-black text-slate-900 font-mono">
            AED {netOfficeBalance.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{isAr ? "محدث لحظياً من العمليات" : "Live auto-synced"}</span>
          </div>
        </div>

        {/* Bounced Penalties */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2 relative overflow-hidden">
          <span className="text-xs font-bold text-indigo-600 block uppercase">
            {isAr ? "غرامات الشيكات الراجعة" : "Bounced Penalties"}
          </span>
          <div className="text-2xl font-black text-slate-900 font-mono">
            AED {totalBouncedPenalties.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            {isAr ? "مقتطعة من الشيكات المرتجعة" : "From bounced cheques"}
          </div>
        </div>

        {/* Admin Fees */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2 relative overflow-hidden">
          <span className="text-xs font-bold text-amber-600 block uppercase">
            {isAr ? "الرسوم الإدارية للتحصيل" : "Admin & Service Fees"}
          </span>
          <div className="text-2xl font-black text-slate-900 font-mono">
            AED {totalAdminFees.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            {isAr ? "عمولات ورسوم إدارية للمكتب" : "Office service revenue"}
          </div>
        </div>

        {/* Cleaning & Guard Deductions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2 relative overflow-hidden">
          <span className="text-xs font-bold text-violet-600 block uppercase">
            {isAr ? "نظافة وحراسة (على المالك)" : "Cleaning & Guard Deductions"}
          </span>
          <div className="text-2xl font-black text-slate-900 font-mono">
            AED {totalCleaningGuard.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            {isAr ? "خصومات مرحلة لحساب المكتب" : "Credited to office"}
          </div>
        </div>

        {/* Total Withdrawals */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2 relative overflow-hidden">
          <span className="text-xs font-bold text-rose-600 block uppercase">
            {isAr ? "إجمالي المسحوبات / المصروفات" : "Total Withdrawals"}
          </span>
          <div className="text-2xl font-black text-rose-600 font-mono">
            AED {totalWithdrawals.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            {isAr ? "مصروفات أو سحوبات مسجلة" : "Expenses & outflows"}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? "بحث في الوصف، المرجع، أو المصدر..." : "Search description, reference, source..."}
            className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="ALL">{isAr ? "جميع الحركات (إيداعات وسحوبات)" : "All Movements"}</option>
            <option value="DEPOSIT">{isAr ? "إيداعات فقط (Inflows)" : "Deposits Only"}</option>
            <option value="WITHDRAWAL">{isAr ? "سحوبات فقط (Outflows)" : "Withdrawals Only"}</option>
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="ALL">{isAr ? "جميع التصنيفات المحاسبية" : "All Categories"}</option>
            <option value="BOUNCED_PENALTY">{isAr ? "غرامات الشيكات الراجعة" : "Bounced Penalties"}</option>
            <option value="ADMIN_FEE">{isAr ? "الرسوم الإدارية" : "Admin Fees"}</option>
            <option value="CLEANING">{isAr ? "خصومات النظافة" : "Cleaning Deductions"}</option>
            <option value="GUARD">{isAr ? "خصومات الحراسة" : "Guard Deductions"}</option>
            <option value="OTHER_INCOME">{isAr ? "إيراد يدوي إضافي" : "Other Income"}</option>
            <option value="OTHER_EXPENSE">{isAr ? "مصروف يدوي إضافي" : "Other Expense"}</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900 text-sm">
              {isAr ? "سجل الحركات المالية المباشرة لحساب المكتب" : "Office Account Transaction Ledger"}
            </h2>
          </div>
          <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">
            {filteredTransactions.length} {isAr ? "حركة مسجلة" : "transactions"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4">{isAr ? "التاريخ والمرجع" : "Date & Ref"}</th>
                <th className="py-3 px-4">{isAr ? "نوع الحركة" : "Type"}</th>
                <th className="py-3 px-4">{isAr ? "التصنيف" : "Category"}</th>
                <th className="py-3 px-4">{isAr ? "المصدر / المستفيد" : "Source / Payer"}</th>
                <th className="py-3 px-4">{isAr ? "البيان والتفاصيل" : "Description"}</th>
                <th className="py-3 px-4 text-left">{isAr ? "المبلغ (درهم)" : "Amount (AED)"}</th>
                <th className="py-3 px-4 text-center">{isAr ? "طريقة الإدراج" : "Mode"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    {isAr ? "لا توجد حركات مالية مطابقة لمعايير البحث." : "No transactions match your search criteria."}
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-900 block">{tx.date}</span>
                      {tx.reference && (
                        <span className="text-[10px] text-slate-400 font-mono">Ref: {tx.reference}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {tx.type === "DEPOSIT" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <ArrowUpRight className="w-3 h-3" />
                          {isAr ? "إيداع (إيراد)" : "Deposit"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <ArrowDownRight className="w-3 h-3" />
                          {isAr ? "سحب (مصروف)" : "Withdrawal"}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {tx.categoryName}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {tx.source}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={tx.description}>
                      {tx.description}
                    </td>
                    <td className="py-3 px-4 text-left">
                      <div className={`font-mono font-black text-sm ${tx.type === "DEPOSIT" ? "text-emerald-600" : "text-rose-600"}`}>
                        {tx.type === "DEPOSIT" ? "+" : "-"} AED {tx.amount.toLocaleString()}
                      </div>
                      {tx.netRevenue !== undefined && tx.vatAmount !== undefined && (
                        <div className="text-[10px] text-slate-500 mt-1 flex flex-col items-start font-mono">
                          <span>{isAr ? "الصافي:" : "Net:"} {tx.netRevenue.toLocaleString()}</span>
                          <span>{isAr ? "ضريبة:" : "VAT:"} {tx.vatAmount.toLocaleString()}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {tx.isAuto ? (
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-semibold">
                          {isAr ? "تلقائي من النظام" : "System Auto"}
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-semibold">
                            {isAr ? "يدوي" : "Manual"}
                          </span>
                          <button
                            onClick={() => deleteOfficeSaqrTransaction(tx.id)}
                            className="text-rose-500 hover:text-rose-700 p-1 transition"
                            title={isAr ? "حذف الحركة اليدوية" : "Delete Manual Entry"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Config Modal */}
      {isEditConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-base">
                {isAr ? "تعديل بيانات حساب مكتب صقر الإمارات" : "Edit Saqr Office Account Details"}
              </h3>
              <button onClick={() => setIsEditConfigModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isAr ? "اسم المكتب بالعربية" : "Office Name (Ar)"}</label>
                  <input
                    type="text"
                    value={officeNameAr}
                    onChange={(e) => setOfficeNameAr(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isAr ? "اسم المكتب بالإنجليزية" : "Office Name (En)"}</label>
                  <input
                    type="text"
                    value={officeNameEn}
                    onChange={(e) => setOfficeNameEn(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{isAr ? "اسم البنك" : "Bank Name"}</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isAr ? "رقم الحساب" : "Account Number"}</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isAr ? "رقم الآيبان (IBAN)" : "IBAN"}</label>
                  <input
                    type="text"
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsEditConfigModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md"
                >
                  {isAr ? "حفظ التعديلات" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Manual Transaction Modal */}
      {isAddTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-base">
                {isAr ? "إضافة معاملة مالية يدوية لحساب المكتب" : "Add Manual Office Transaction"}
              </h3>
              <button onClick={() => setIsAddTxModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {txError && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl font-semibold border border-rose-200">
                {txError}
              </div>
            )}

            <form onSubmit={handleAddManualTx} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isAr ? "نوع الحركة" : "Movement Type"}</label>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-xl font-bold"
                  >
                    <option value="DEPOSIT">{isAr ? "إيداع (إيراد للمكتب)" : "Deposit (Income)"}</option>
                    <option value="WITHDRAWAL">{isAr ? "سحب (مصروف للمكتب)" : "Withdrawal (Expense)"}</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isAr ? "التصنيف" : "Category"}</label>
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-xl font-bold"
                  >
                    <option value="OTHER_INCOME">{isAr ? "إيراد يدوي إضافي" : "Other Income"}</option>
                    <option value="OTHER_EXPENSE">{isAr ? "مصروف يدوي إضافي" : "Other Expense"}</option>
                    <option value="ADMIN_FEE">{isAr ? "رسوم إدارية" : "Admin Fee"}</option>
                    <option value="BOUNCED_PENALTY">{isAr ? "غرامة شيك راجع" : "Bounced Penalty"}</option>
                    <option value="CLEANING">{isAr ? "نظافة" : "Cleaning"}</option>
                    <option value="GUARD">{isAr ? "حراسة وأمن" : "Guard & Security"}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isAr ? "المبلغ (درهم)" : "Amount (AED)"} *</label>
                  <input
                    type="number"
                    min={1}
                    value={txAmount}
                    onChange={(e) => setTxAmount(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full px-3 py-2 border rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isAr ? "تاريخ الحركة" : "Date"}</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{isAr ? "رقم المرجع (اختياري)" : "Reference Number"}</label>
                <input
                  type="text"
                  value={txRefNumber}
                  onChange={(e) => setTxRefNumber(e.target.value)}
                  placeholder="e.g. REC-99201"
                  className="w-full px-3 py-2 border rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{isAr ? "بيان الحركة وتفاصيلها" : "Description / Details"} *</label>
                <textarea
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  required
                  rows={3}
                  placeholder={isAr ? "اكتب تفاصيل المعاملة المالية يدوياً..." : "Enter manual transaction details..."}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddTxModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md"
                >
                  {isAr ? "حفظ وإضافة المعاملة" : "Save Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
