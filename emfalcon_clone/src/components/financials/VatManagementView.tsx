import React, { useState, useMemo } from "react";
import { 
  Percent, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  History, 
  Trash2, 
  Edit3, 
  Search, 
  Filter,
  FileSpreadsheet,
  Printer,
  Coins,
  Receipt,
  Building2,
  FileText
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { VatRateRecord, VatRateStatus, VatRateCategory } from "../../types";
import { motion, AnimatePresence } from "motion/react";

export const VatManagementView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { 
    vatRates = [], 
    addVatRate, 
    updateVatRate, 
    deleteVatRate,
    commissions = [],
    collections = [],
    financialReversals = [],
    companyProfile
  } = useData();
  const { hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState<"OUTPUT_VAT_REPORT" | "VAT_RATES_CONFIG">("OUTPUT_VAT_REPORT");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newRate, setNewRate] = useState<number>(5.0);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState<VatRateCategory>("ADMIN_FEE");
  const [error, setError] = useState("");

  const sortedRates = [...vatRates].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

  // Compute Output VAT Transactions (Administrative Fees & Taxable Commissions)
  const reversedCollectionIds = new Set(
    (financialReversals || []).filter((r) => r.targetType === "COLLECTION").map((r) => r.targetId)
  );

  const vatOutputRows = useMemo(() => {
    const rows: Array<{
      id: string;
      date: string;
      refNumber: string;
      partyType: "OWNER" | "TENANT";
      payerName: string;
      description: string;
      grossAmount: number;
      taxableAmount: number;
      vatRate: number;
      outputVatAmount: number;
      status: string;
    }> = [];

    // From Commissions / Admin Fees
    (commissions || []).forEach((c) => {
      if (c.status === "CANCELLED") return;
      const date = c.dueDate || c.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10);
      if (fromDate && date < fromDate) return;
      if (toDate && date > toDate) return;

      const gross = c.totalCommissionAmount || 0;
      if (gross <= 0) return;

      const vat = c.vatAmount || Number(((gross * 5) / 105).toFixed(2));
      const taxable = Number((gross - vat).toFixed(2));

      rows.push({
        id: `com-${c.id}`,
        date,
        refNumber: `COM-${c.id.slice(0, 6)}`,
        partyType: c.partyType as any,
        payerName: c.partyType === "OWNER" ? "المالك" : "المستأجر",
        description: (c as any).description || (c as any).notes || `رسوم إدارية وتأجير (${c.ratePercentage || 5}%)`,
        grossAmount: gross,
        taxableAmount: taxable,
        vatRate: c.vatRate || 5.0,
        outputVatAmount: vat,
        status: c.status,
      });
    });

    // From Collections with Admin Fee
    (collections || []).forEach((col) => {
      if (reversedCollectionIds.has(col.id)) return;
      if (!col.adminFeeAmount || col.adminFeeAmount <= 0) return;

      const date = col.paymentDate || col.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10);
      if (fromDate && date < fromDate) return;
      if (toDate && date > toDate) return;

      const gross = col.adminFeeAmount;
      const vat = Number(((gross * 5) / 105).toFixed(2));
      const taxable = Number((gross - vat).toFixed(2));

      rows.push({
        id: `col-fee-${col.id}`,
        date,
        refNumber: col.receiptNumber || `RCP-${col.id.slice(0, 6)}`,
        partyType: "TENANT",
        payerName: col.payerName || "المستأجر",
        description: `رسوم إدارية مقتطعة ضمن سند قبض ${col.receiptNumber || ""}`,
        grossAmount: gross,
        taxableAmount: taxable,
        vatRate: 5.0,
        outputVatAmount: vat,
        status: "COLLECTED",
      });
    });

    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [commissions, collections, reversedCollectionIds, fromDate, toDate]);

  const filteredVatRows = useMemo(() => {
    if (!searchQuery.trim()) return vatOutputRows;
    const q = searchQuery.toLowerCase();
    return vatOutputRows.filter(
      (r) =>
        r.refNumber.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.payerName.toLowerCase().includes(q)
    );
  }, [vatOutputRows, searchQuery]);

  // Totals
  const totalOutputVat = useMemo(() => {
    return filteredVatRows.reduce((sum, r) => sum + r.outputVatAmount, 0);
  }, [filteredVatRows]);

  const totalTaxableBase = useMemo(() => {
    return filteredVatRows.reduce((sum, r) => sum + r.taxableAmount, 0);
  }, [filteredVatRows]);

  const totalGrossAmount = useMemo(() => {
    return filteredVatRows.reduce((sum, r) => sum + r.grossAmount, 0);
  }, [filteredVatRows]);

  const handleAdd = () => {
    if (!hasPermission("MANAGE_VAT_CONFIG") && !hasPermission("MANAGE_CHART_OF_ACCOUNTS")) {
      setError(isAr ? "ليس لديك صلاحية لإدارة إعدادات ضريبة القيمة المضافة" : "You don't have permission to manage VAT config");
      return;
    }

    const result = addVatRate({
      rate: newRate,
      effectiveFrom,
      category,
      status: "ACTIVE"
    });

    if (result.success) {
      setIsAddModalOpen(false);
      setNewRate(5.0);
      setEffectiveFrom(new Date().toISOString().split("T")[0]);
      setError("");
    } else {
      setError(result.error || "Error adding VAT rate");
    }
  };

  const toggleStatus = (id: string, currentStatus: VatRateStatus) => {
    const newStatus: VatRateStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    updateVatRate(id, { status: newStatus }, `Changed status to ${newStatus}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Percent className="w-6 h-6 text-indigo-600" />
            {isAr ? "ضريبة القيمة المضافة ومخرجات الرسوم الإدارية" : "VAT & Output Tax Management"}
          </h2>
          <p className="text-slate-500 mt-1">
            {isAr 
              ? "تقرير مخرجات ضريبة القيمة المضافة المستحقة للهيئة الاتحادية للضرائب وإعدادات النسب التاريخية" 
              : "Output VAT reports for administrative fees and historical VAT rates registry"}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab("OUTPUT_VAT_REPORT")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "OUTPUT_VAT_REPORT"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {isAr ? "تقرير مخرجات الضريبة (Output VAT)" : "Output VAT Report"}
          </button>
          <button
            onClick={() => setActiveTab("VAT_RATES_CONFIG")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "VAT_RATES_CONFIG"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {isAr ? "سجل معدلات الضريبة" : "VAT Rates"}
          </button>
        </div>
      </div>

      {/* Tab 1: Output VAT Report */}
      {activeTab === "OUTPUT_VAT_REPORT" && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-2xl shadow-md space-y-1">
              <span className="text-xs font-semibold text-indigo-100 uppercase flex items-center gap-1.5">
                <Percent className="w-4 h-4" />
                {isAr ? "إجمالي ضريبة المخرجات المستحقة (FTA Output VAT)" : "Total Output VAT Payable"}
              </span>
              <div className="text-2xl font-black font-mono mt-1">
                AED {totalOutputVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-indigo-100/80">
                {isAr ? "محسوبة بنسبة 5% من الرسوم الإدارية الشاملة" : "Computed at 5% VAT on taxable gross fees"}
              </p>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-600" />
                {isAr ? "صافي الإيراد الخاضع للضريبة (Net Revenue Base)" : "Taxable Net Base"}
              </span>
              <div className="text-2xl font-black text-slate-800 font-mono mt-1">
                AED {totalTaxableBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400">
                {isAr ? "المبلغ الخاضع للضريبة قبل إضافة الضريبة" : "Net revenue excluding VAT"}
              </p>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-indigo-600" />
                {isAr ? "إجمالي الرسوم الإدارية الشاملة" : "Gross Taxable Fees"}
              </span>
              <div className="text-2xl font-black text-slate-800 font-mono mt-1">
                AED {totalGrossAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400">
                {isAr ? `إجمالي ${filteredVatRows.length} معاملة خاضعة للضريبة` : `${filteredVatRows.length} taxable transactions`}
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder={isAr ? "بحث بالمرجع أو البيان..." : "Search ref or desc..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-9 pl-4 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold">{isAr ? "من:" : "From:"}</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                />
                <span className="font-semibold">{isAr ? "إلى:" : "To:"}</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                />
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition"
            >
              <Printer className="w-4 h-4" />
              <span>{isAr ? "طباعة إقرار الضريبة" : "Print Tax Schedule"}</span>
            </button>
          </div>

          {/* VAT Breakdown Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                <tr>
                  <th className="px-4 py-3">{isAr ? "التاريخ" : "Date"}</th>
                  <th className="px-4 py-3">{isAr ? "المرجع" : "Ref"}</th>
                  <th className="px-4 py-3">{isAr ? "البيان والتفاصيل" : "Description"}</th>
                  <th className="px-4 py-3">{isAr ? "الطرف" : "Party"}</th>
                  <th className="px-4 py-3 font-mono">{isAr ? "المبلغ الإجمالي (Gross)" : "Gross"}</th>
                  <th className="px-4 py-3 font-mono">{isAr ? "الخاضع للضريبة (Net)" : "Net"}</th>
                  <th className="px-4 py-3 text-center">{isAr ? "النسبة" : "Rate"}</th>
                  <th className="px-4 py-3 font-mono text-indigo-700">{isAr ? "ضريبة المخرجات (VAT 5%)" : "Output VAT"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredVatRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3 text-slate-600">{row.date}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">{row.refNumber}</td>
                    <td className="px-4 py-3 font-sans text-slate-700">{row.description}</td>
                    <td className="px-4 py-3 font-sans">
                      <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 font-semibold">
                        {row.payerName}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800">{row.grossAmount.toLocaleString()} AED</td>
                    <td className="px-4 py-3 text-emerald-700">{row.taxableAmount.toLocaleString()} AED</td>
                    <td className="px-4 py-3 text-center font-bold text-indigo-600">{row.vatRate}%</td>
                    <td className="px-4 py-3 font-bold text-indigo-700">{row.outputVatAmount.toLocaleString()} AED</td>
                  </tr>
                ))}

                {filteredVatRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-sans">
                      {isAr ? "لا توجد حركات ضريبية مسجلة في هذه الفترة." : "No VAT transactions found in this period."}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t border-slate-200">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-sans text-slate-800">
                    {isAr ? "إجمالي ضريبة المخرجات المستحقة للهيئة الاتحادية للضرائب:" : "Total Output VAT Payable to FTA:"}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-900">{totalGrossAmount.toLocaleString()} AED</td>
                  <td className="px-4 py-3 font-mono text-emerald-800">{totalTaxableBase.toLocaleString()} AED</td>
                  <td className="px-4 py-3 text-center text-slate-500">—</td>
                  <td className="px-4 py-3 font-mono text-indigo-900 text-sm">
                    {totalOutputVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: VAT Rates Config */}
      {activeTab === "VAT_RATES_CONFIG" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors font-medium shadow-sm text-xs"
            >
              <Plus className="w-4 h-4" />
              {isAr ? "إضافة معدل ضريبة جديد" : "Add New VAT Rate"}
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right dir-rtl text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className={`px-6 py-4 ${isAr ? "text-right" : "text-left"}`}>
                      {isAr ? "المعدل (%)" : "Rate (%)"}
                    </th>
                    <th className={`px-6 py-4 ${isAr ? "text-right" : "text-left"}`}>
                      {isAr ? "يسري من تاريخ" : "Effective From"}
                    </th>
                    <th className={`px-6 py-4 ${isAr ? "text-right" : "text-left"}`}>
                      {isAr ? "الفئة" : "Category"}
                    </th>
                    <th className={`px-6 py-4 ${isAr ? "text-right" : "text-left"}`}>
                      {isAr ? "الحالة" : "Status"}
                    </th>
                    <th className={`px-6 py-4 ${isAr ? "text-right" : "text-left"}`}>
                      {isAr ? "تاريخ الإنشاء" : "Created At"}
                    </th>
                    <th className={`px-6 py-4 ${isAr ? "text-right" : "text-left"}`}>
                      {isAr ? "الإجراءات" : "Actions"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedRates.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className={`px-6 py-4 font-bold text-indigo-600 ${isAr ? "text-right text-base" : "text-left text-base"}`}>
                        {record.rate}%
                      </td>
                      <td className={`px-6 py-4 text-slate-700 font-medium ${isAr ? "text-right" : "text-left"}`}>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {record.effectiveFrom}
                        </div>
                      </td>
                      <td className={`px-6 py-4 ${isAr ? "text-right" : "text-left"}`}>
                        <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold">
                          {record.category === "ADMIN_FEE" 
                            ? (isAr ? "الرسوم الإدارية" : "Administrative Fee")
                            : record.category}
                        </span>
                      </td>
                      <td className={`px-6 py-4 ${isAr ? "text-right" : "text-left"}`}>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          record.status === "ACTIVE" 
                            ? "bg-emerald-100 text-emerald-700" 
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {record.status === "ACTIVE" 
                            ? (isAr ? "نشط" : "Active") 
                            : (isAr ? "غير نشط" : "Inactive")}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-slate-500 text-xs ${isAr ? "text-right" : "text-left"}`}>
                        {new Date(record.createdAt).toLocaleDateString(isAr ? 'ar-AE' : 'en-GB')}
                      </td>
                      <td className={`px-6 py-4 ${isAr ? "text-right" : "text-left"}`}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleStatus(record.id, record.status)}
                            className={`p-2 rounded-lg transition-colors ${
                              record.status === "ACTIVE" 
                                ? "hover:bg-amber-50 text-amber-600" 
                                : "hover:bg-emerald-50 text-emerald-600"
                            }`}
                            title={record.status === "ACTIVE" ? (isAr ? "إيقاف" : "Deactivate") : (isAr ? "تفعيل" : "Activate")}
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              const result = deleteVatRate(record.id);
                              if (!result.success) alert(result.error);
                            }}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title={isAr ? "حذف" : "Delete"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add VAT Rate Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Percent className="w-5 h-5 text-indigo-600" />
                  {isAr ? "إضافة معدل ضريبة جديد" : "Add New VAT Rate"}
                </h3>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {isAr ? "معدل الضريبة (%)" : "VAT Rate (%)"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newRate}
                    onChange={(e) => setNewRate(parseFloat(e.target.value))}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    placeholder="5.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {isAr ? "تاريخ السريان" : "Effective From"}
                  </label>
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {isAr ? "الفئة" : "Category"}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as VatRateCategory)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  >
                    <option value="ADMIN_FEE">{isAr ? "الرسوم الإدارية" : "Administrative Fee"}</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={handleAdd}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition-all shadow-md shadow-indigo-200 active:scale-[0.98]"
                >
                  {isAr ? "حفظ" : "Save"}
                </button>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl transition-all active:scale-[0.98]"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
