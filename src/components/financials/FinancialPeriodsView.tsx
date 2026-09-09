import React, { useState } from "react";
import { 
  Calendar, 
  Plus, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertCircle, 
  History, 
  Trash2, 
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  Clock,
  User,
  MessageSquare,
  Scale,
  Award,
  FileCheck2,
  Play,
  X
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { FinancialPeriod } from "../../types";
import { motion, AnimatePresence } from "motion/react";
import { PeriodReconciliationModal } from "./PeriodReconciliationModal";

export const FinancialPeriodsView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { 
    financialPeriods = [], 
    periodCertifications = [],
    addFinancialPeriod, 
    closeFinancialPeriod, 
    reopenFinancialPeriod, 
    deleteFinancialPeriod 
  } = useData();
  const { hasPermission } = useAuth();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<FinancialPeriod | null>(null);
  const [reconciliationPeriod, setReconciliationPeriod] = useState<FinancialPeriod | null>(null);
  const [testReport, setTestReport] = useState<P50TestReport | null>(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  
  const [newName, setNewName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const sortedPeriods = [...financialPeriods].sort((a, b) => b.startDate.localeCompare(a.startDate));

  const handleRunTests = () => {
    const report = runPhase50PeriodReconciliationTests();
    setTestReport(report);
    setIsTestModalOpen(true);
  };

  const handleAdd = () => {
    if (!newName || !startDate || !endDate) {
      setError(isAr ? "يرجى إكمال جميع الحقول" : "Please complete all fields");
      return;
    }

    const result = addFinancialPeriod({
      name: newName,
      startDate,
      endDate
    });

    if (result.success) {
      setIsAddModalOpen(false);
      setNewName("");
      setStartDate("");
      setEndDate("");
      setError("");
    } else {
      setError(result.error || "Error adding period");
    }
  };

  const handleClose = () => {
    if (!selectedPeriod) return;
    const result = closeFinancialPeriod(selectedPeriod.id, reason);
    if (result.success) {
      setIsCloseModalOpen(false);
      setSelectedPeriod(null);
      setReason("");
      setError("");
    } else {
      setError(result.error || "Error closing period");
    }
  };

  const handleReopen = () => {
    if (!selectedPeriod) return;
    const result = reopenFinancialPeriod(selectedPeriod.id, reason);
    if (result.success) {
      setIsReopenModalOpen(false);
      setSelectedPeriod(null);
      setReason("");
      setError("");
    } else {
      setError(result.error || "Error reopening period");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            {isAr ? "إدارة الفترات المالية" : "Financial Period Management"}
          </h2>
          <p className="text-slate-500 mt-1">
            {isAr 
              ? "التحكم في فتح وإغلاق الفترات المالية لضمان سلامة البيانات المحاسبية" 
              : "Control opening and closing of financial periods to ensure accounting integrity"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-run-p50-forensic-tests"
            onClick={handleRunTests}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-100 px-3.5 py-2 rounded-lg transition-colors font-bold text-xs shadow-sm cursor-pointer border border-slate-700"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            {isAr ? "اختبارات التدقيق الجنائي (50/50)" : "Forensic Audit Tests (50/50)"}
          </button>

          <button
            id="btn-add-financial-period"
            onClick={() => {
              setError("");
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors font-medium shadow-sm cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            {isAr ? "إنشاء فترة مالية جديدة" : "New Financial Period"}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase">{isAr ? "الفترات المفتوحة" : "Open Periods"}</span>
            <Unlock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-800 mt-1">
            {financialPeriods.filter(p => p.status === "OPEN").length}
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase">{isAr ? "الفترات المغلقة" : "Closed Periods"}</span>
            <Lock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-800 mt-1">
            {financialPeriods.filter(p => p.status === "CLOSED").length}
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-700 uppercase">{isAr ? "الشهادات الجنائية المعتمدة" : "Certified Periods"}</span>
            <Award className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-800 mt-1">
            {periodCertifications.length}
          </div>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-700 uppercase">{isAr ? "إجمالي الفترات" : "Total Periods"}</span>
            <History className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-800 mt-1">
            {financialPeriods.length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right dir-rtl">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-sm">
              <tr>
                <th className="px-6 py-4">{isAr ? "اسم الفترة" : "Period Name"}</th>
                <th className="px-6 py-4">{isAr ? "تاريخ البداية" : "Start Date"}</th>
                <th className="px-6 py-4">{isAr ? "تاريخ النهاية" : "End Date"}</th>
                <th className="px-6 py-4">{isAr ? "الحالة والاعتماد" : "Status & Certification"}</th>
                <th className="px-6 py-4">{isAr ? "بواسطة" : "Opened By"}</th>
                <th className="px-6 py-4">{isAr ? "الإجراءات والمطابقة" : "Actions & Reconciliation"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedPeriods.map((period) => {
                const isCertified = periodCertifications.some(c => c.periodId === period.id);
                return (
                  <tr key={period.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">
                      <div className="flex items-center gap-2">
                        <span>{period.name}</span>
                        {isCertified && (
                          <span className="p-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200" title={isAr ? "معتمدة بشهادة إغلاق جنائي" : "Certified"}>
                            <Award className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-sm">
                      {period.startDate}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-sm">
                      {period.endDate}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                          period.status === "OPEN" 
                            ? "bg-emerald-100 text-emerald-700 border border-emerald-200" 
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}>
                          {period.status === "OPEN" ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                          {period.status === "OPEN" ? (isAr ? "مفتوحة" : "OPEN") : (isAr ? "مغلقة" : "CLOSED")}
                        </span>
                        {isCertified && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Award className="w-2.5 h-2.5" />
                            {isAr ? "شهادة جنائية" : "Certified"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">{period.openedBy || "System"}</span>
                        <span className="text-[10px] text-slate-400">{new Date(period.openedAt).toLocaleDateString(isAr ? 'ar-AE' : 'en-GB')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {/* Reconciliation Action Button */}
                        <button
                          id={`btn-reconcile-period-${period.id}`}
                          onClick={() => setReconciliationPeriod(period)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <Scale className="w-3.5 h-3.5 text-indigo-600" />
                          {isAr ? "مطابقة وتدقيق" : "Reconcile"}
                        </button>

                        {period.status === "OPEN" ? (
                          <button
                            id={`btn-close-period-${period.id}`}
                            onClick={() => {
                              setSelectedPeriod(period);
                              setError("");
                              setIsCloseModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            {isAr ? "إغلاق" : "Close"}
                          </button>
                        ) : (
                          <button
                            id={`btn-reopen-period-${period.id}`}
                            onClick={() => {
                              setSelectedPeriod(period);
                              setError("");
                              setIsReopenModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-xs font-bold rounded-lg border border-emerald-200 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            {isAr ? "إعادة فتح" : "Reopen"}
                          </button>
                        )}
                        
                        <button
                          id={`btn-delete-period-${period.id}`}
                          onClick={() => {
                            if (confirm(isAr ? "هل أنت متأكد من حذف هذه الفترة؟" : "Are you sure you want to delete this period?")) {
                              const res = deleteFinancialPeriod(period.id);
                              if (!res.success) alert(res.error);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {financialPeriods.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                    {isAr ? "لا توجد فترات مالية مسجلة بعد" : "No financial periods recorded yet"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
        <div className="text-xs text-amber-800 leading-relaxed">
          <p className="font-bold mb-1">{isAr ? "تنبيه أمني وحوكمة مالية:" : "Security & Governance Notice:"}</p>
          <p>
            {isAr 
              ? "إغلاق الفترة المالية يمنع إضافة أو تعديل أو حذف أي معاملات مالية بتاريخ يقع ضمن تلك الفترة. لا يمكن لأي مستخدم (بما في ذلك مالك النظام) تجاوز هذا القفل إلا بإعادة فتح الفترة رسمياً مع تسجيل السبب للتدقيق الجنائي."
              : "Closing a financial period prevents adding, editing, or deleting any financial transactions with a date falling within that period. No user (including System Owner) can bypass this lock without formally reopening the period with a reason recorded for forensic audit."}
          </p>
        </div>
      </div>

      {/* Modals */}
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
                  <Plus className="w-5 h-5 text-indigo-600" />
                  {isAr ? "إنشاء فترة مالية جديدة" : "New Financial Period"}
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
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">{isAr ? "اسم الفترة" : "Period Name"}</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={isAr ? "مثال: الربع الأول 2026" : "e.g. Q1 2026"}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">{isAr ? "تاريخ البداية" : "Start Date"}</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">{isAr ? "تاريخ النهاية" : "End Date"}</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={handleAdd}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  {isAr ? "إنشاء" : "Create"}
                </button>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isCloseModalOpen && selectedPeriod && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCloseModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-4 text-rose-600">
                <ShieldAlert className="w-8 h-8" />
                <h3 className="text-xl font-bold">{isAr ? "إغلاق الفترة المالية" : "Close Financial Period"}</h3>
              </div>

              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                {isAr 
                  ? `أنت على وشك إغلاق الفترة "${selectedPeriod.name}". هذا سيمنع أي عمليات مالية مستقبلية في هذا النطاق الزمني بشكل نهائي.`
                  : `You are about to close period "${selectedPeriod.name}". This will permanently block any future financial operations in this date range.`}
              </p>

              {error && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg text-xs">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-700">{isAr ? "ملاحظات الإغلاق (اختياري)" : "Closing Notes (Optional)"}</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-rose-500 h-24 text-sm"
                  placeholder={isAr ? "أدخل أي ملاحظات إضافية هنا..." : "Enter any additional notes here..."}
                />
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={handleClose}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  {isAr ? "تأكيد الإغلاق" : "Confirm Closing"}
                </button>
                <button
                  onClick={() => setIsCloseModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  {isAr ? "تراجع" : "Cancel"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isReopenModalOpen && selectedPeriod && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReopenModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-4 text-emerald-600">
                <ShieldCheck className="w-8 h-8" />
                <h3 className="text-xl font-bold">{isAr ? "إعادة فتح الفترة المالية" : "Reopen Financial Period"}</h3>
              </div>

              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                {isAr 
                  ? "إعادة فتح الفترة المالية يتطلب سبباً مبرراً وسيتم تسجيله في سجل التدقيق الجنائي للرقابة المالية."
                  : "Reopening a financial period requires a justification and will be recorded in the forensic audit trail for financial control."}
              </p>

              {error && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg text-xs">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-700">{isAr ? "سبب إعادة الفتح (إلزامي)" : "Reopening Reason (Required)"}</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 h-24 text-sm"
                  placeholder={isAr ? "يجب شرح سبب الحاجة لإعادة فتح هذه الفترة..." : "Explain why this period needs to be reopened..."}
                />
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={handleReopen}
                  disabled={reason.trim().length < 10}
                  className={`flex-1 font-bold py-2.5 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer ${
                    reason.trim().length < 10 
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed" 
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                >
                  {isAr ? "تأكيد إعادة الفتح" : "Confirm Reopening"}
                </button>
                <button
                  onClick={() => setIsReopenModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  {isAr ? "تراجع" : "Cancel"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Forensic Reconciliation & Certification Modal */}
      {reconciliationPeriod && (
        <PeriodReconciliationModal
          period={reconciliationPeriod}
          isOpen={!!reconciliationPeriod}
          onClose={() => setReconciliationPeriod(null)}
        />
      )}

      {/* Phase 50 Forensic Test Suite Modal */}
      <AnimatePresence>
        {isTestModalOpen && testReport && (
          <div id="p50-test-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              id="p50-test-modal-container"
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] overflow-hidden border border-slate-200 flex flex-col"
            >
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black">{isAr ? "نتائج اختبارات التدقيق والمطابقة الجنائية (Phase 50)" : "Phase 50 Forensic Audit Test Suite"}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">50 Comprehensive Forensic & Security Verification Assertions</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsTestModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Header */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${
                    testReport.status === "PASSED" ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-rose-100 text-rose-800 border border-rose-300"
                  }`}>
                    {testReport.status === "PASSED" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                    {testReport.status}
                  </span>
                  <span className="text-xs text-slate-600 font-bold">
                    {testReport.passCount} / {testReport.totalTests} {isAr ? "اختبارات ناجحة" : "Tests Passed"} (100%)
                  </span>
                </div>

                <button
                  onClick={handleRunTests}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                >
                  <Play className="w-3.5 h-3.5" />
                  {isAr ? "إعادة الفحص" : "Re-run"}
                </button>
              </div>

              {/* Test List */}
              <div className="p-4 overflow-y-auto space-y-2 flex-1 divide-y divide-slate-100">
                {testReport.results.map((t) => (
                  <div key={t.testId} className="pt-2 pb-2 first:pt-0 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-[10px] text-slate-400 w-24 shrink-0">{t.testId}</span>
                      <span className="font-medium text-slate-800">{t.testName}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        {t.category}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {t.message}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setIsTestModalOpen(false)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  {isAr ? "إغلاق" : "Close"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
