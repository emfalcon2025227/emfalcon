import React, { useState, useMemo, useEffect } from "react";
import {
  Plus,
  Receipt,
  Calendar,
  DollarSign,
  X,
  Lock,
  Unlock,
  Edit,
  Trash2,
  Filter,
  Search,
  FileText,
  CheckCircle,
  TrendingUp,
  Wallet,
  FolderPlus,
  ArrowUpRight,
  Download,
  Tag,
  AlertCircle,
  Eye,
  BookOpen,
  FileCheck,
  Percent,
  Upload,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { DocumentStorageService } from "../../services/documentStorageService";
import { SearchableSelect, SearchableOption } from "../common/SearchableSelect";
import { matchAnyArabicSearch } from "../../utils/arabicTextNormalizer";
import { OfficePettyCashMonth, OfficePettyCashExpense, OfficePettyCashCategory, PettyCashCarryForwardOption, OfficePettyCashReceiptDocument } from "../../types";
import { OfficePrintHeader } from "../common/OfficePrintHeader";

export const OfficePettyCashView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentUser, hasPermission } = useAuth();
  const {
    officePettyCashMonths = [],
    officePettyCashExpenses = [],
    officePettyCashCategories = [],
    addOfficePettyCashMonth,
    updateOfficePettyCashMonth,
    closeOfficePettyCashMonth,
    reopenOfficePettyCashMonth,
    addOfficePettyCashExpense,
    updateOfficePettyCashExpense,
    deleteOfficePettyCashExpense,
    addOfficePettyCashCategory,
    updateOfficePettyCashCategory,
  } = useData();

  // Selected Month ID state
  const [selectedMonthId, setSelectedMonthId] = useState<string>("");

  // Search and Category filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");

  // Modals state
  const [isAddMonthModalOpen, setIsAddMonthModalOpen] = useState(false);
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isManageCatsModalOpen, setIsManageCatsModalOpen] = useState(false);
  const [isCloseMonthModalOpen, setIsCloseMonthModalOpen] = useState(false);
  
  // Reason / Modification confirmation dialogs state
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmReopenOpen, setIsConfirmReopenOpen] = useState(false);
  const [confirmingExpenseId, setConfirmingExpenseId] = useState<string>("");
  const [confirmingMonthId, setConfirmingMonthId] = useState<string>("");
  const [modificationReason, setModificationReason] = useState("");
  const [actionError, setActionError] = useState("");

  // Expense Edit target state
  const [editingExpense, setEditingExpense] = useState<OfficePettyCashExpense | null>(null);

  // New Month Form State
  const [newMonthVal, setNewMonthVal] = useState<number>(new Date().getMonth() + 1);
  const [newYearVal, setNewYearVal] = useState<number>(new Date().getFullYear());
  const [newOpeningAmount, setNewOpeningAmount] = useState<number>(1000);
  const [newMonthNotes, setNewMonthNotes] = useState("");
  const [newMonthError, setNewMonthError] = useState("");

  // New/Edit Expense Form State
  const [expDate, setExpDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [expCategoryId, setExpCategoryId] = useState<string>("");
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expDescription, setExpDescription] = useState("");
  const [expPayee, setExpPayee] = useState("");
  const [expRefNumber, setExpRefNumber] = useState("");
  const [expNotes, setExpNotes] = useState("");
  const [expError, setExpError] = useState("");
  const [expenseReceipt, setExpenseReceipt] = useState<OfficePettyCashReceiptDocument | null>(null);

  // Manage Categories Form State
  const [newCatNameAr, setNewCatNameAr] = useState("");
  const [newCatNameEn, setNewCatNameEn] = useState("");
  const [catError, setCatError] = useState("");

  // Close Month Form State
  const [carryOption, setCarryOption] = useState<PettyCashCarryForwardOption>("CARRY_FORWARD");
  const [closeNotes, setCloseNotes] = useState("");
  const [closeError, setCloseError] = useState("");
  const [actualCashCounted, setActualCashCounted] = useState<string>("");

  // Check initial VIEW permission
  if (!hasPermission("VIEW_OFFICE_PETTY_CASH")) {
    return (
      <div id="petty-cash-denied" className="p-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-center shadow-xs">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">
          {isAr ? "عذراً، لا تمتلك الصلاحية الكافية" : "Access Denied"}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isAr
            ? "ليس لديك الصلاحيات اللازمة للوصول إلى وحدة المصروفات النثرية للمكتب."
            : "You do not have sufficient permissions to view the office petty cash ledger."}
        </p>
      </div>
    );
  }

  // Sort months chronologically descending (Year then Month)
  const sortedMonths = useMemo(() => {
    return [...officePettyCashMonths].sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [officePettyCashMonths]);

  // Set default selected month if not already selected
  useEffect(() => {
    if (!selectedMonthId && sortedMonths.length > 0) {
      setSelectedMonthId(sortedMonths[0].id);
    }
  }, [sortedMonths, selectedMonthId]);

  // Current active month record
  const activeMonthRecord = useMemo(() => {
    return officePettyCashMonths.find((m) => m.id === selectedMonthId);
  }, [officePettyCashMonths, selectedMonthId]);

  // Filtered expenses for active month based on Search query & Category
  const filteredExpenses = useMemo(() => {
    if (!selectedMonthId) return [];
    
    let expenses = officePettyCashExpenses.filter((e) => e.monthId === selectedMonthId);

    if (selectedCategoryId && selectedCategoryId !== "ALL") {
      expenses = expenses.filter((e) => e.categoryId === selectedCategoryId);
    }

    if (searchQuery.trim()) {
      expenses = expenses.filter((e) => {
        const terms = [
          e.expenseNumber,
          e.description,
          e.payee,
          e.refNumber,
          e.categoryNameArabic,
          e.categoryNameEnglish,
          String(e.amount),
        ];
        return matchAnyArabicSearch(terms, searchQuery);
      });
    }

    // Sort newer first
    return expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [officePettyCashExpenses, selectedMonthId, selectedCategoryId, searchQuery]);

  // Total calculated expenses for currently selected month
  const computedMonthExpensesSum = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  // Month names for Arabic and English selection
  const arabicMonthNames = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
  ];

  const englishMonthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getMonthName = (m: number) => {
    return isAr ? arabicMonthNames[m - 1] : englishMonthNames[m - 1];
  };

  // Helper: Open add expense modal
  const handleOpenAddExpense = () => {
    if (!activeMonthRecord) return;
    setEditingExpense(null);
    setExpCategoryId("");
    // Set default date as matching the month and year of the active month record
    const today = new Date();
    let defaultDay = today.getDate();
    const padMonth = String(activeMonthRecord.month).padStart(2, "0");
    const padDay = String(defaultDay).padStart(2, "0");
    setExpDate(`${activeMonthRecord.year}-${padMonth}-${padDay}`);
    setExpAmount(0);
    setExpDescription("");
    setExpPayee("");
    setExpRefNumber("");
    setExpNotes("");
    setExpenseReceipt(null);
    setExpError("");
    setIsAddExpenseModalOpen(true);
  };

  // Helper: Open edit expense modal
  const handleOpenEditExpense = (expense: OfficePettyCashExpense) => {
    setEditingExpense(expense);
    setExpCategoryId(expense.categoryId);
    setExpDate(expense.date);
    setExpAmount(expense.amount);
    setExpDescription(expense.description);
    setExpPayee(expense.payee || "");
    setExpRefNumber(expense.refNumber || "");
    setExpNotes(expense.notes || "");
    setExpenseReceipt(expense.receiptDocument || null);
    setExpError("");
    setIsAddExpenseModalOpen(true);
  };

  // Submit Expense (Add or Edit)
  const handleSubmitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setExpError("");

    if (!expCategoryId) {
      setExpError(isAr ? "الرجاء تحديد تصنيف للمصروف" : "Please select an expense category");
      return;
    }
    if (expAmount <= 0) {
      setExpError(isAr ? "يجب أن تكون قيمة المصروف أكبر من الصفر" : "Expense amount must be greater than zero");
      return;
    }
    if (!expDate) {
      setExpError(isAr ? "الرجاء تحديد تاريخ للمصروف" : "Please select an expense date");
      return;
    }
    if (activeMonthRecord) {
      const parts = expDate.split("-");
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (y !== activeMonthRecord.year || m !== activeMonthRecord.month) {
          setExpError(
            isAr
              ? `يجب أن يكون تاريخ المصروف ضمن شهر ${activeMonthRecord.month}/${activeMonthRecord.year}`
              : `Expense date must belong to month ${activeMonthRecord.month}/${activeMonthRecord.year}`
          );
          return;
        }
      }
    }
    if (!expDescription.trim()) {
      setExpError(isAr ? "الرجاء إدخال وصف للمصروف" : "Please enter an expense description");
      return;
    }

    const payload = {
      monthId: selectedMonthId,
      categoryId: expCategoryId,
      amount: Number(expAmount),
      date: expDate,
      description: expDescription.trim(),
      payee: expPayee.trim() || undefined,
      refNumber: expRefNumber.trim() || undefined,
      notes: expNotes.trim() || undefined,
      paymentMethod: "CASH",
      receiptDocument: expenseReceipt || undefined,
    };

    if (editingExpense) {
      // Modification logging
      const res = updateOfficePettyCashExpense(editingExpense.id, payload, isAr ? "تعديل مباشر من شاشة النثريات" : "Direct editing from Petty Cash portal");
      if (!res.success) {
        setExpError(res.error || "Failed to update");
      } else {
        setIsAddExpenseModalOpen(false);
      }
    } else {
      const res = addOfficePettyCashExpense(payload);
      if (!res.success) {
        setExpError(res.error || "Failed to add expense");
      } else {
        setIsAddExpenseModalOpen(false);
      }
    }
  };

  // Open delete confirmation
  const handleRequestDeleteExpense = (expenseId: string) => {
    setConfirmingExpenseId(expenseId);
    setModificationReason("");
    setActionError("");
    setIsConfirmDeleteOpen(true);
  };

  // Confirm delete expense
  const handleConfirmDeleteExpense = () => {
    if (!modificationReason.trim()) {
      setActionError(isAr ? "الرجاء تحديد سبب الحذف للمطابقة والتدقيق" : "Please specify a reason for deletion for audit matching");
      return;
    }
    const res = deleteOfficePettyCashExpense(confirmingExpenseId, modificationReason.trim());
    if (res.success) {
      setIsConfirmDeleteOpen(false);
    } else {
      setActionError(res.error || "Failed to delete");
    }
  };

  // Submit Create New Month Fund
  const handleCreateMonth = (e: React.FormEvent) => {
    e.preventDefault();
    setNewMonthError("");

    if (newOpeningAmount < 0) {
      setNewMonthError(isAr ? "يجب أن تكون القيمة الافتتاحية أكبر من أو تساوي صفر" : "Opening amount must be positive");
      return;
    }

    const payload = {
      month: Number(newMonthVal),
      year: Number(newYearVal),
      openingAmount: Number(newOpeningAmount),
      notes: newMonthNotes.trim() || undefined,
    };

    const res = addOfficePettyCashMonth(payload);
    if (!res.success) {
      setNewMonthError(res.error || "Failed to create petty cash month");
    } else {
      if (res.month) {
        setSelectedMonthId(res.month.id);
      }
      setIsAddMonthModalOpen(false);
    }
  };

  // Submit Month Closure
  const handleCloseMonth = (e: React.FormEvent) => {
    e.preventDefault();
    setCloseError("");

    const expected = activeMonthRecord ? activeMonthRecord.closingBalance : 0;
    const actualVal = parseFloat(actualCashCounted) || 0;
    const diff = actualVal - expected;
    const statusStr = diff === 0 ? "RECONCILED" : "DISCREPANCY";

    const res = closeOfficePettyCashMonth(
      selectedMonthId,
      carryOption,
      closeNotes.trim() || undefined,
      actualVal,
      diff,
      statusStr
    );
    if (!res.success) {
      setCloseError(res.error || "Failed to close month");
    } else {
      setIsCloseMonthModalOpen(false);
    }
  };

  // Open Reopen confirm modal
  const handleRequestReopenMonth = () => {
    setConfirmingMonthId(selectedMonthId);
    setModificationReason("");
    setActionError("");
    setIsConfirmReopenOpen(true);
  };

  // Confirm reopen month
  const handleConfirmReopenMonth = () => {
    if (!modificationReason.trim()) {
      setActionError(isAr ? "الرجاء إدخال سبب إعادة فتح الشهر للتدقيق" : "Please enter a reason to reopen for audit compliance");
      return;
    }
    const res = reopenOfficePettyCashMonth(confirmingMonthId, modificationReason.trim());
    if (res.success) {
      setIsConfirmReopenOpen(false);
    } else {
      setActionError(res.error || "Failed to reopen");
    }
  };

  // Submit Category Add
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setCatError("");

    if (!newCatNameAr.trim() || !newCatNameEn.trim()) {
      setCatError(isAr ? "يرجى تعبئة كلا الاسمين العربي والإنجليزي" : "Please fill in both Arabic and English names");
      return;
    }

    const res = addOfficePettyCashCategory({
      nameArabic: newCatNameAr.trim(),
      nameEnglish: newCatNameEn.trim(),
    });

    if (res.success) {
      setNewCatNameAr("");
      setNewCatNameEn("");
    } else {
      setCatError(res.error || "Failed to add category");
    }
  };

  // Toggle category active state
  const handleToggleCategoryActive = (category: OfficePettyCashCategory) => {
    const res = updateOfficePettyCashCategory(category.id, { active: !category.active });
    if (!res.success) {
      alert(res.error || "Failed to update category");
    }
  };

  // Convert categories list to SearchableOptions for the SearchableSelect combobox
  const searchableCategories = useMemo((): SearchableOption[] => {
    return officePettyCashCategories
      .filter((c) => c.active)
      .map((c) => ({
        id: c.id,
        label: isAr ? c.nameArabic : c.nameEnglish,
        subLabel: isAr ? c.nameEnglish : c.nameArabic,
      }));
  }, [officePettyCashCategories, isAr]);

  return (
    <div id="office-petty-cash-module" className="space-y-6 mt-6 print:space-y-4">
      {/* Top Banner Toolbar */}
      <div id="petty-cash-toolbar" className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
              {isAr ? "مصروفات المكتب النثرية" : "Office Petty Cash Ledger"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAr
                ? "إدارة مستقلة ومستقلة تماماً للمصروفات النثرية والتشغيلية الشهرية للمكتب"
                : "Completely independent month-by-month office operations expense tracker"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Active Month Dropdown Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
              {isAr ? "اختر الصندوق الشهري:" : "Month fund:"}
            </span>
            <select
              id="selected-month-picker"
              value={selectedMonthId}
              onChange={(e) => setSelectedMonthId(e.target.value)}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-extrabold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer transition-all"
            >
              {sortedMonths.length === 0 ? (
                <option value="">{isAr ? "-- لا توجد صناديق --" : "-- No funds available --"}</option>
              ) : (
                sortedMonths.map((m) => (
                  <option key={m.id} value={m.id}>
                    {getMonthName(m.month)} {m.year} ({m.status === "CLOSED" ? (isAr ? "مغلق" : "Closed") : (isAr ? "مفتوح" : "Open")})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Create New Month Button */}
          {hasPermission("CREATE_OFFICE_PETTY_CASH_MONTH") && (
            <button
              type="button"
              id="btn-create-month"
              onClick={() => {
                setNewMonthError("");
                setIsAddMonthModalOpen(true);
              }}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <FolderPlus className="w-4 h-4 text-emerald-400" />
              <span>{isAr ? "إنشاء صندوق شهري" : "New Month Fund"}</span>
            </button>
          )}

          {/* Manage Categories Button */}
          {hasPermission("MANAGE_OFFICE_EXPENSE_CATEGORIES") && (
            <button
              type="button"
              id="btn-manage-cats"
              onClick={() => {
                setCatError("");
                setIsManageCatsModalOpen(true);
              }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Tag className="w-4 h-4 text-slate-400" />
              <span>{isAr ? "إدارة الفئات" : "Manage Categories"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main KPI Dashboard Section */}
      {activeMonthRecord ? (
        <div id="petty-cash-kpis" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Opening Amount */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isAr ? "الرصيد الافتتاحي المخصص" : "Allocated Opening Balance"}
              </span>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {activeMonthRecord.openingAmount.toLocaleString()} <span className="text-sm font-normal">AED</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {isAr ? `تاريخ البدء: ${new Date(activeMonthRecord.createdAt).toLocaleDateString("ar-AE")}` : `Started: ${new Date(activeMonthRecord.createdAt).toLocaleDateString()}`}
              </p>
            </div>
          </div>

          {/* Card 2: Total Expenses */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isAr ? "إجمالي المصروفات المنفذة" : "Total Executed Expenses"}
              </span>
              <div className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-lg">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {activeMonthRecord.totalExpenses.toLocaleString()} <span className="text-sm font-normal text-slate-500">AED</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {filteredExpenses.length} {isAr ? "حركة سحب مسجلة" : "recorded withdrawals"}
              </p>
            </div>
          </div>

          {/* Card 3: Remaining / Closing Balance */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isAr ? "الرصيد الفعلي المتبقي" : "Net Remaining Balance"}
              </span>
              <div className={`p-2 rounded-lg ${activeMonthRecord.closingBalance < 100 ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40" : "bg-blue-50 text-blue-600 dark:bg-blue-950/40"}`}>
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className={`text-2xl font-black ${activeMonthRecord.closingBalance < 100 ? "text-amber-600" : "text-blue-600 dark:text-blue-400"}`}>
                {activeMonthRecord.closingBalance.toLocaleString()} <span className="text-sm font-normal text-slate-500">AED</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {isAr ? "محدث بالكامل لحظياً" : "Fully synchronized in real time"}
              </p>
            </div>
          </div>

          {/* Card 4: Status Indicator & Settlement Details */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isAr ? "حالة تسوية صندوق الشهر" : "Fund Settlement Status"}
              </span>
              <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                activeMonthRecord.status === "CLOSED" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
              }`}>
                {activeMonthRecord.status === "CLOSED" ? (isAr ? "مغلق ومسوى" : "CLOSED") : (isAr ? "نشط ومفتوح" : "OPEN")}
              </span>
            </div>
            <div className="mt-3 flex flex-col justify-end">
              {activeMonthRecord.status === "CLOSED" ? (
                <div className="space-y-0.5 text-xs text-slate-500">
                  <p>
                    <span className="font-semibold">{isAr ? "التسوية:" : "Settlement:"}</span>{" "}
                    {activeMonthRecord.carryForwardOption === "CARRY_FORWARD"
                      ? (isAr ? "رحّل للشهر التالي" : "Carried Forward")
                      : activeMonthRecord.carryForwardOption === "RETURN_TO_OWNER"
                      ? (isAr ? "أرجع للمكتب الرئيسي" : "Returned to main office")
                      : (isAr ? "عدم ترحيل الرصيد" : "Do Not Carry Balance")}
                  </p>
                  {hasPermission("REOPEN_OFFICE_PETTY_CASH_MONTH") && (
                    <button
                      type="button"
                      onClick={handleRequestReopenMonth}
                      className="text-xs text-emerald-600 hover:text-emerald-500 font-extrabold flex items-center gap-1 mt-1.5 cursor-pointer"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>{isAr ? "إعادة فتح الصندوق" : "Reopen Fund"}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-2">
                  {hasPermission("CLOSE_OFFICE_PETTY_CASH_MONTH") ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCarryOption("CARRY_FORWARD");
                        setCloseNotes("");
                        setCloseError("");
                        setActualCashCounted(activeMonthRecord ? activeMonthRecord.closingBalance.toString() : "");
                        setIsCloseMonthModalOpen(true);
                      }}
                      className="w-full py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{isAr ? "إغلاق وتسوية الشهر" : "Close & Settle Month"}</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                      {isAr ? "غير مسموح لك بإغلاق الصندوق" : "You cannot close this month fund"}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs print:hidden">
          <Wallet className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">
            {isAr ? "لا توجد صناديق نثريات نشطة" : "No Petty Cash Funds Active"}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            {isAr
              ? "لم يتم البدء في إنشاء صناديق المصروفات النثرية الشهرية بعد. قم بإنشاء أول صندوق شهري لبدء تسجيل ومتابعة نثريات التشغيل."
              : "No month-by-month petty cash funds have been created yet. Please create your first monthly fund to start logging operational expenses."}
          </p>
          {hasPermission("CREATE_OFFICE_PETTY_CASH_MONTH") && (
            <button
              type="button"
              onClick={() => {
                setNewMonthError("");
                setIsAddMonthModalOpen(true);
              }}
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-xl text-sm font-black inline-flex items-center gap-2 cursor-pointer shadow-md"
            >
              <FolderPlus className="w-5 h-5 text-emerald-400 dark:text-white" />
              <span>{isAr ? "إنشاء الصندوق الأول الآن" : "Create First Fund Now"}</span>
            </button>
          )}
        </div>
      )}

      {/* Operations Ledger Table Section */}
      {activeMonthRecord && (
        <div id="petty-cash-ledger-card" className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
          {/* Filters & Actions Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4 print:hidden">
            {/* Search Input & Category Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
              {/* Search text */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isAr ? "ابحث بالبيان، المدفوع له، القيمة..." : "Search expenses..."}
                  className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category selector */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-3.5 h-3.5 text-slate-400 whitespace-nowrap" />
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="ALL">{isAr ? "كل تصنيفات المصاريف" : "All categories"}</option>
                  {officePettyCashCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {isAr ? c.nameArabic : c.nameEnglish}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Print and Add Expense buttons */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-400" />
                <span>{isAr ? "طباعة الكشف" : "Print Statement"}</span>
              </button>

              {hasPermission("ADD_OFFICE_EXPENSE") && (
                <button
                  type="button"
                  id="btn-add-expense"
                  onClick={handleOpenAddExpense}
                  disabled={activeMonthRecord.status === "CLOSED" && !hasPermission("MODIFY_CLOSED_OFFICE_PETTY_CASH")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-md cursor-pointer ${
                    activeMonthRecord.status === "CLOSED" && !hasPermission("MODIFY_CLOSED_OFFICE_PETTY_CASH")
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none dark:bg-slate-900 dark:border-slate-800"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAr ? "تسجيل مصروف جديد" : "Record Expense"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Printable Header with Office Logo and Name */}
          <OfficePrintHeader
            titleAr={`كشف حساب العهدة والمصروفات النثرية (${activeMonthRecord.month}/${activeMonthRecord.year})`}
            titleEn={`OFFICE PETTY CASH STATEMENT (${activeMonthRecord.month}/${activeMonthRecord.year})`}
            hideOnScreen={true}
            extraInfo={[
              { labelAr: "الرصيد الافتتاحي", labelEn: "Opening Balance", value: `AED ${activeMonthRecord.openingAmount.toLocaleString()}` },
              { labelAr: "إجمالي المصروفات", labelEn: "Total Spent", value: `AED ${activeMonthRecord.totalExpenses.toLocaleString()}` },
              { labelAr: "الرصيد المتبقي", labelEn: "Current Balance", value: `AED ${activeMonthRecord.closingBalance.toLocaleString()}` },
            ]}
          />

          {/* Expenses Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-5 py-3 text-right text-xs font-black text-slate-500 dark:text-slate-400 tracking-wider">
                    {isAr ? "التاريخ" : "Date"}
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-black text-slate-500 dark:text-slate-400 tracking-wider">
                    {isAr ? "رقم القيد" : "Ref Number"}
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-black text-slate-500 dark:text-slate-400 tracking-wider">
                    {isAr ? "البيان / الوصف" : "Description"}
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-black text-slate-500 dark:text-slate-400 tracking-wider">
                    {isAr ? "التصنيف" : "Category"}
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-black text-slate-500 dark:text-slate-400 tracking-wider">
                    {isAr ? "المدفوع له" : "Payee"}
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-black text-slate-500 dark:text-slate-400 tracking-wider">
                    {isAr ? "المبلغ" : "Amount"}
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-black text-slate-500 dark:text-slate-400 tracking-wider print:hidden">
                    {isAr ? "إجراءات" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                      {isAr ? "لا توجد مصروفات مسجلة تطابق محددات البحث" : "No expenses match the filter query"}
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 text-xs text-slate-700 dark:text-slate-300 transition">
                      <td className="px-5 py-3.5 text-right whitespace-nowrap font-semibold">
                        {new Date(e.date).toLocaleDateString(isAr ? "ar-AE" : "en-US")}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {e.expenseNumber}
                      </td>
                      <td className="px-5 py-3.5 text-right max-w-xs truncate" title={e.description}>
                        {e.description}
                        {e.notes && <span className="block text-[10px] text-slate-400 dark:text-slate-500 truncate">{e.notes}</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                          {isAr ? e.categoryNameArabic : e.categoryNameEnglish}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold">
                        {e.payee || (isAr ? "غير محدد" : "N/A")}
                        {e.refNumber && <span className="block text-[10px] font-mono text-slate-400">{e.refNumber}</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                        {e.amount.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">AED</span>
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap print:hidden">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          {e.receiptDocument && (
                            <a
                              href={e.receiptDocument.fileUrl}
                              download={e.receiptDocument.fileName}
                              target="_blank"
                              referrerPolicy="no-referrer"
                              className="p-1.5 rounded-lg transition-all text-emerald-600 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
                              title={isAr ? "عرض السند المرفق" : "View Attached Receipt"}
                            >
                              <Eye className="w-4 h-4" />
                            </a>
                          )}

                          {hasPermission("EDIT_OFFICE_EXPENSE") && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditExpense(e)}
                              disabled={activeMonthRecord.status === "CLOSED" && !hasPermission("MODIFY_CLOSED_OFFICE_PETTY_CASH")}
                              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                activeMonthRecord.status === "CLOSED" && !hasPermission("MODIFY_CLOSED_OFFICE_PETTY_CASH")
                                  ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                                  : "text-slate-400 hover:text-emerald-600 dark:text-slate-500 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-900"
                              }`}
                              title={isAr ? "تعديل المصروف" : "Edit Expense"}
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}

                          {hasPermission("DELETE_OFFICE_EXPENSE") && (
                            <button
                              type="button"
                              onClick={() => handleRequestDeleteExpense(e.id)}
                              disabled={activeMonthRecord.status === "CLOSED" && !hasPermission("MODIFY_CLOSED_OFFICE_PETTY_CASH")}
                              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                activeMonthRecord.status === "CLOSED" && !hasPermission("MODIFY_CLOSED_OFFICE_PETTY_CASH")
                                  ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                                  : "text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-900"
                              }`}
                              title={isAr ? "حذف المصروف" : "Delete Expense"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer stats summary */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between text-xs font-semibold text-slate-500 gap-2">
            <span>
              {isAr
                ? `عرض ${filteredExpenses.length} مصروفات مسجلة`
                : `Showing ${filteredExpenses.length} recorded operations`}
            </span>
            <span className="font-extrabold text-slate-900 dark:text-white">
              {isAr ? "مجموع الصفحة:" : "Page Total:"} {computedMonthExpensesSum.toLocaleString()} AED
            </span>
          </div>
        </div>
      )}

      {/* MODAL 1: Create Petty Cash Month */}
      {isAddMonthModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-emerald-500" />
                <span>{isAr ? "صندوق نثريات شهر جديد" : "New Month Fund Setup"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddMonthModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMonth} className="p-5 space-y-4">
              {newMonthError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{newMonthError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? "الشهر" : "Month"}
                  </label>
                  <select
                    value={newMonthVal}
                    onChange={(e) => setNewMonthVal(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-extrabold text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {m} - {getMonthName(m)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? "السنة" : "Year"}
                  </label>
                  <select
                    value={newYearVal}
                    onChange={(e) => setNewYearVal(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-extrabold text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "قيمة التمويل الافتتاحي (AED)" : "Opening Allocated Amount (AED)"}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={newOpeningAmount}
                  onChange={(e) => setNewOpeningAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "ملاحظات إضافية" : "Additional Notes"}
                </label>
                <textarea
                  value={newMonthNotes}
                  onChange={(e) => setNewMonthNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none h-16 resize-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddMonthModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-md cursor-pointer transition"
                >
                  {isAr ? "تأكيد والبدء" : "Initialize Fund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Record/Edit Expense */}
      {isAddExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-500" />
                <span>
                  {editingExpense
                    ? (isAr ? `تعديل المصروف ${editingExpense.expenseNumber}` : `Edit Expense ${editingExpense.expenseNumber}`)
                    : (isAr ? "تسجيل حركة مصروف نثري جديدة" : "Record New Petty Cash Expense")}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddExpenseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitExpense} className="p-5 space-y-4">
              {expError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{expError}</span>
                </div>
              )}

              {/* Category Searchable Selector - Mandated Standard */}
              <SearchableSelect
                label={isAr ? "تصنيف النثريات (اختر من القائمة)" : "Petty Cash Category (Select from List)"}
                options={searchableCategories}
                value={expCategoryId}
                onChange={(val) => setExpCategoryId(val)}
                placeholder={isAr ? "ابحث أو اختر الفئة..." : "Search or choose category..."}
                searchPlaceholder={isAr ? "ابحث بالفئة..." : "Search categories..."}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? "التاريخ" : "Date"}
                  </label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? "قيمة المصروف (AED)" : "Expense Amount (AED)"}
                  </label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={expAmount || ""}
                    onChange={(e) => setExpAmount(Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "البيان / تفصيل المصروف" : "Description / Details"}
                </label>
                <input
                  type="text"
                  required
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  placeholder={isAr ? "مثال: شراء مياه ضيافة للعملاء..." : "e.g., hospitality water bottles..."}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? "اسم المستلم / المدفوع له" : "Payee Name"}
                  </label>
                  <input
                    type="text"
                    value={expPayee}
                    onChange={(e) => setExpPayee(e.target.value)}
                    placeholder={isAr ? "الشركة أو الموظف المستلم" : "Company or Employee"}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? "رقم الفاتورة / المستند" : "Invoice / Receipt Ref No."}
                  </label>
                  <input
                    type="text"
                    value={expRefNumber}
                    onChange={(e) => setExpRefNumber(e.target.value)}
                    placeholder="INV-..."
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "ملاحظات وتوضيحات إضافية" : "Internal Clarifications / Notes"}
                </label>
                <textarea
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none h-16 resize-none"
                />
              </div>

              {/* Receipt Attachment Block - Fully Functional */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                <span className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {isAr ? "سند ومستند الفاتورة المرفق:" : "Invoice Supporting Document Attachment:"}
                </span>

                {expenseReceipt ? (
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-lg flex items-center justify-center font-mono text-[9px] font-black uppercase shrink-0">
                        {expenseReceipt.fileType.split("/")[1] || "DOC"}
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-black text-slate-800 dark:text-slate-200 truncate">
                          {expenseReceipt.fileName}
                        </span>
                        <span className="block text-[10px] text-emerald-600 font-bold">
                          {isAr ? "تم إرفاق المستند بنجاح" : "Successfully attached document"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* View Button */}
                      <a
                        href={expenseReceipt.fileUrl}
                        download={expenseReceipt.fileName}
                        target="_blank"
                        referrerPolicy="no-referrer"
                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition cursor-pointer"
                        title={isAr ? "تحميل / عرض" : "Download / View"}
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                      
                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => setExpenseReceipt(null)}
                        className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-950/30 rounded-lg text-rose-500 hover:text-rose-600 transition cursor-pointer"
                        title={isAr ? "حذف" : "Remove"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="flex flex-col items-center justify-center py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                      <Upload className="w-5 h-5 text-slate-400 mb-1" />
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        {isAr ? "انقر لإرفاق سند (PDF, JPG, PNG)" : "Click to attach receipt (PDF, JPG, PNG)"}
                      </span>
                      <span className="text-[9px] text-slate-400">
                        {isAr ? "الحد الأقصى 2 ميجابايت" : "Max size 2MB"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,image/png,image/jpeg,image/jpg"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          if (file.size > 2 * 1024 * 1024) {
                            alert(isAr ? "حجم الملف كبير جداً، الحد الأقصى 2 ميجابايت" : "File is too large, maximum 2MB");
                            return;
                          }

                          try {
                            const archiveItem = await DocumentStorageService.uploadAndArchive(file, {
                              category: "PAYMENTS",
                              entityType: "PETTY_CASH",
                              entityId: "temp-id",
                              fileName: file.name,
                              mimeType: file.type,
                              description: "Petty Cash Receipt",
                              uploadedByUserId: currentUser?.id || "sys-01",
                              uploadedByName: currentUser?.nameEn || "Admin",
                              tags: ["PETTY_CASH", "RECEIPT"]
                            });

                            setExpenseReceipt({
                              fileName: archiveItem.fileName,
                              fileType: archiveItem.fileType,
                              fileSize: archiveItem.fileSize,
                              fileUrl: archiveItem.driveWebViewLink || archiveItem.previewUrl || "",
                              uploadedAt: archiveItem.createdAt,
                              uploadedBy: archiveItem.uploadedByUserId || "sys-01"
                            });
                          } catch (err) {
                            console.error("Failed to upload receipt:", err);
                            alert(isAr ? "فشل رفع الإيصال" : "Failed to upload receipt");
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-md cursor-pointer transition"
                >
                  {isAr ? "تأكيد وحفظ" : "Confirm & Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Manage Categories */}
      {isManageCatsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-500" />
                <span>{isAr ? "إدارة فئات النثريات" : "Manage Expense Categories"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsManageCatsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Add New Category Form */}
              <form onSubmit={handleAddCategory} className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="block text-xs font-black text-slate-800 dark:text-slate-200">
                  {isAr ? "إضافة فئة جديدة" : "Add New Category"}
                </span>

                {catError && (
                  <div className="p-2 bg-rose-50 text-rose-600 text-[10px] rounded-lg">
                    {catError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      {isAr ? "الاسم بالعربية" : "Arabic Name"}
                    </label>
                    <input
                      type="text"
                      required
                      value={newCatNameAr}
                      onChange={(e) => setNewCatNameAr(e.target.value)}
                      placeholder="مثال: وقود المركبات"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      {isAr ? "الاسم بالإنجليزية" : "English Name"}
                    </label>
                    <input
                      type="text"
                      required
                      value={newCatNameEn}
                      onChange={(e) => setNewCatNameEn(e.target.value)}
                      placeholder="e.g., Vehicle Fuel"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-slate-900 dark:bg-emerald-600 text-white rounded-xl text-xs font-black transition shadow-xs cursor-pointer"
                  >
                    {isAr ? "إضافة الفئة" : "Add Category"}
                  </button>
                </div>
              </form>

              {/* Categories list */}
              <div className="space-y-2">
                <span className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                  {isAr ? "قائمة التصنيفات الحالية" : "Active Categories"}
                </span>
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900/20">
                  {officePettyCashCategories.map((c) => (
                    <div key={c.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/50">
                      <div>
                        <span className="font-extrabold text-slate-900 dark:text-white block">
                          {c.nameArabic}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {c.nameEnglish}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Status label */}
                        <span className={`px-2 py-0.5 text-[9px] font-black rounded-full ${c.active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                          {c.active ? (isAr ? "نشط" : "Active") : (isAr ? "معطل" : "Disabled")}
                        </span>
                        
                        {/* Toggle active button */}
                        <button
                          type="button"
                          onClick={() => handleToggleCategoryActive(c)}
                          className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg border transition-all cursor-pointer ${
                            c.active
                              ? "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100"
                              : "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100"
                          }`}
                        >
                          {c.active ? (isAr ? "تعطيل" : "Disable") : (isAr ? "تفعيل" : "Enable")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Settle & Close Month */}
      {isCloseMonthModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-rose-500" />
                <span>{isAr ? `إغلاق وتسوية صندوق ${getMonthName(activeMonthRecord?.month || 1)} ${activeMonthRecord?.year}` : `Settle & Close Fund ${activeMonthRecord?.month}/${activeMonthRecord?.year}`}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCloseMonthModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCloseMonth} className="p-5 space-y-4">
              {closeError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{closeError}</span>
                </div>
              )}

              {/* Financial Snapshot */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                <span className="block font-black text-slate-800 dark:text-slate-200 mb-1">
                  {isAr ? "الخلاصة المالية قبل الإغلاق:" : "Financial Summary Prior to Closure:"}
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-500">{isAr ? "التمويل المبدئي:" : "Initial Opening Allocation:"}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{activeMonthRecord?.openingAmount.toLocaleString()} AED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{isAr ? "إجمالي المصروفات المنفذة:" : "Total Spent:"}</span>
                  <span className="font-bold text-rose-600">{activeMonthRecord?.totalExpenses.toLocaleString()} AED</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1.5 font-extrabold">
                  <span className="text-slate-950 dark:text-slate-200">{isAr ? "المبلغ المتبقي للتسوية:" : "Remaining Settleable Balance:"}</span>
                  <span className="text-emerald-600">{activeMonthRecord?.closingBalance.toLocaleString()} AED</span>
                </div>
              </div>

              {/* Cash Reconciliation Block */}
              <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl text-xs space-y-3">
                <span className="block font-black text-emerald-800 dark:text-emerald-300">
                  {isAr ? "المطابقة النقدية والجرد الفعلي:" : "Cash Reconciliation & Audit Check:"}
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      {isAr ? "الرصيد الدفتري المتوقع:" : "Expected Book Cash:"}
                    </label>
                    <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-lg text-slate-700 dark:text-slate-300 font-bold">
                      {(activeMonthRecord?.closingBalance || 0).toLocaleString()} AED
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                      {isAr ? "النقد الفعلي الموجود في الصندوق (AED):" : "Actual Physical Cash Counted (AED):"}
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={actualCashCounted}
                      onChange={(e) => setActualCashCounted(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-lg text-slate-900 dark:text-white font-black text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Calculation & Status Row */}
                {actualCashCounted !== "" && (
                  <div className="flex items-center justify-between pt-2 border-t border-emerald-100 dark:border-emerald-900/20 text-xs font-extrabold">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">{isAr ? "فارق المطابقة:" : "Discrepancy Difference:"}</span>
                      <span className={
                        (parseFloat(actualCashCounted) || 0) - (activeMonthRecord?.closingBalance || 0) === 0
                          ? "text-emerald-600 font-black"
                          : "text-rose-600 font-black"
                      }>
                        {((parseFloat(actualCashCounted) || 0) - (activeMonthRecord?.closingBalance || 0)).toLocaleString()} AED
                      </span>
                    </div>

                    <div>
                      {(parseFloat(actualCashCounted) || 0) - (activeMonthRecord?.closingBalance || 0) === 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                          {isAr ? "مطابق" : "Reconciled"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
                          {isAr ? "غير مطابق" : "Discrepancy"}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isAr ? "طريقة تسوية ومعالجة الرصيد المتبقي" : "Remaining Balance Settlement Strategy"}
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="carryOption"
                      value="CARRY_FORWARD"
                      checked={carryOption === "CARRY_FORWARD"}
                      onChange={() => setCarryOption("CARRY_FORWARD")}
                      className="mt-1 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div>
                      <span className="block text-xs font-black text-slate-900 dark:text-white">
                        {isAr ? "ترحيل الفائض للشهر التالي" : "Carry forward surplus"}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        {isAr
                          ? "سيتم ترحيل هذا الرصيد المتبقي تلقائياً كقيمة افتتاحية إضافية في صندوق الشهر الجديد."
                          : "Surplus amount is pushed as an addition to the subsequent month's fund."}
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="carryOption"
                      value="RETURN_TO_OWNER"
                      checked={carryOption === "RETURN_TO_OWNER"}
                      onChange={() => setCarryOption("RETURN_TO_OWNER")}
                      className="mt-1 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div>
                      <span className="block text-xs font-black text-slate-900 dark:text-white">
                        {isAr ? "إرجاع المبلغ لخزينة المكتب الرئيسي" : "Returned to main office treasury"}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        {isAr
                          ? "يتم تصفير الصندوق وإرجاع المبلغ المتبقي لخزينة الشركة الرئيسية."
                          : "The petty cash fund is zeroed, returning the physical cash back to the main treasury."}
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="carryOption"
                      value="DO_NOT_CARRY"
                      checked={carryOption === "DO_NOT_CARRY"}
                      onChange={() => setCarryOption("DO_NOT_CARRY")}
                      className="mt-1 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div>
                      <span className="block text-xs font-black text-slate-900 dark:text-white">
                        {isAr ? "عدم ترحيل الرصيد" : "Do Not Carry Balance"}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        {isAr
                          ? "تتم تسوية الصندوق وتصفيره دون ترحيل الرصيد المتبقي للشهر القادم أو اعتباره عجزاً."
                          : "The residual balance is cleared and not carried forward to the next monthly ledger."}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "ملاحظات إغلاق الصندوق" : "Closure & Audit Comments"}
                </label>
                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder={isAr ? "اكتب تفاصيل أو أسباب التسوية هنا..." : "Enter closure comments here..."}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none h-16 resize-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCloseMonthModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-extrabold shadow-md cursor-pointer transition"
                >
                  {isAr ? "تأكيد إغلاق الصندوق" : "Confirm Settle & Close"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG: Reopen Month */}
      {isConfirmReopenOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Unlock className="w-5 h-5 text-emerald-500" />
                <span>{isAr ? "تأكيد إعادة فتح الصندوق" : "Confirm Reopen Fund"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsConfirmReopenOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {isAr
                  ? "تحذير: أنت على وشك إعادة فتح صندوق النثريات لهذا الشهر المغلق مسبقاً. سيسمح هذا لمسؤولي الصندوق بإضافة مصاريف أو تعديل مبالغ. يتطلب هذا الإجراء تسجيل سبب التعديل للرقابة المالية."
                  : "Warning: You are about to reopen a closed monthly fund ledger. This allows edits and modifications to previously closed accounts. A detailed reason must be entered for administrative auditing."}
              </p>

              {actionError && (
                <div className="p-2 bg-rose-50 text-rose-600 text-xs rounded-xl">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "سبب إعادة فتح الصندوق (مطلوب)" : "Reason to Reopen (Required)"}
                </label>
                <textarea
                  required
                  value={modificationReason}
                  onChange={(e) => setModificationReason(e.target.value)}
                  placeholder={isAr ? "يرجى كتابة سبب الإجراء بوضوح..." : "Why is this month fund being reopened?..."}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none h-16 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmReopenOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReopenMonth}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-md cursor-pointer transition"
                >
                  {isAr ? "فتح الصندوق" : "Unseal Ledger"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG: Delete Expense */}
      {isConfirmDeleteOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-500" />
                <span>{isAr ? "حذف قيد مصروف من السجل" : "Confirm Delete Expense Record"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsConfirmDeleteOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {isAr
                  ? "تنبيه: سيؤدي حذف هذا القيد المالي إلى إلغائه تماماً وتعديل الرصيد المتبقي لصندوق هذا الشهر. كإجراء رقابي مالي إلزامي، يجب تسجيل سبب الحذف للتدقيق والأرشفة."
                  : "Attention: This action completely removes the expense from the records and recalculates the monthly fund balance. For auditing purposes, you must provide a reason for this deletion."}
              </p>

              {actionError && (
                <div className="p-2 bg-rose-50 text-rose-600 text-xs rounded-xl">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "سبب حذف المصروف (مطلوب)" : "Reason for Deletion (Required)"}
                </label>
                <textarea
                  required
                  value={modificationReason}
                  onChange={(e) => setModificationReason(e.target.value)}
                  placeholder={isAr ? "يرجى كتابة سبب الحذف بوضوح..." : "Specify reason for deletion..."}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none h-16 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmDeleteOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteExpense}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-extrabold shadow-md cursor-pointer transition"
                >
                  {isAr ? "تأكيد الحذف النهائي" : "Confirm Permanently Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
