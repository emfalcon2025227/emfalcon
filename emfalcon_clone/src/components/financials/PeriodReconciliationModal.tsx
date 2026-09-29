import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  FileCheck2,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  ChevronDown,
  ChevronUp,
  FileText,
  DollarSign,
  TrendingUp,
  ArrowRightLeft,
  Scale,
  Receipt,
  Building,
  Gavel,
  RefreshCw,
  Award,
  Hash,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import {
  FinancialPeriod,
  PeriodReconciliationReport,
  ForensicClosingCertification,
  AreaReconciliationResult,
  ForensicDifferenceItem,
} from "../../types";

interface PeriodReconciliationModalProps {
  period: FinancialPeriod;
  isOpen: boolean;
  onClose: () => void;
}

export const PeriodReconciliationModal: React.FC<PeriodReconciliationModalProps> = ({
  period,
  isOpen,
  onClose,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { runPeriodReconciliation, generatePeriodCertification, periodCertifications, companyProfile } = useData();
  const { currentUser } = useAuth();

  const [report, setReport] = useState<PeriodReconciliationReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [certifying, setCertifying] = useState<boolean>(false);
  const [certificationNotes, setCertificationNotes] = useState<string>("");
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [showCertificateView, setShowCertificateView] = useState<boolean>(false);
  const [activeCertification, setActiveCertification] = useState<ForensicClosingCertification | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  // Existing certification for this period if any
  const existingCertification = periodCertifications.find(
    (c) => c.periodId === period.id
  );

  const handleRunReconciliation = () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = runPeriodReconciliation(period.id);
      if (res.success && res.report) {
        setReport(res.report);
      } else {
        setErrorMsg(res.error || (isAr ? "فشل إجراء المطابقة" : "Failed to run reconciliation"));
      }
    } catch (err: any) {
      setErrorMsg(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      handleRunReconciliation();
      if (existingCertification) {
        setActiveCertification(existingCertification);
      }
    }
  }, [isOpen, period.id]);

  const handleCertify = async () => {
    if (!report || report.overallStatus === "NOT_RECONCILED") return;
    setCertifying(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await generatePeriodCertification(period.id, certificationNotes);
      if (res.success && res.certification) {
        setActiveCertification(res.certification);
        setSuccessMsg(
          isAr
            ? `تم إصدار شهادة الإغلاق المالي والتدقيق الجنائي رقم ${res.certification.certificateNumber} بنجاح.`
            : `Forensic Closing Certification #${res.certification.certificateNumber} issued successfully.`
        );
        setShowCertificateView(true);
      } else {
        setErrorMsg(res.error || (isAr ? "فشل إصدار شهادة الإغلاق" : "Failed to certify period"));
      }
    } catch (err: any) {
      setErrorMsg(err.message || String(err));
    } finally {
      setCertifying(false);
    }
  };

  if (!isOpen) return null;

  const getAreaIcon = (area: string) => {
    switch (area) {
      case "GENERAL_LEDGER":
        return <Scale className="w-5 h-5 text-indigo-600" />;
      case "RENT_COLLECTIONS":
        return <Receipt className="w-5 h-5 text-emerald-600" />;
      case "OWNER_PAYABLE":
        return <Building className="w-5 h-5 text-blue-600" />;
      case "SECURITY_DEPOSITS_ADVANCES":
        return <DollarSign className="w-5 h-5 text-amber-600" />;
      case "VAT_TAX":
        return <TrendingUp className="w-5 h-5 text-purple-600" />;
      case "CHEQUES_RECEIVABLES":
        return <FileText className="w-5 h-5 text-teal-600" />;
      case "LEGAL_CLAIMS":
        return <Gavel className="w-5 h-5 text-rose-600" />;
      case "REVERSALS_ADJUSTMENTS":
        return <ArrowRightLeft className="w-5 h-5 text-orange-600" />;
      default:
        return <FileCheck2 className="w-5 h-5 text-slate-600" />;
    }
  };

  return (
    <div id="period-reconciliation-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        id="period-reconciliation-modal-container"
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8 overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div id="period-reconciliation-header" className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/30 rounded-xl border border-indigo-500/30">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black">{isAr ? "مطابقة وتدقيق الفترة المالية" : "Financial Period Closing Reconciliation"}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 border border-slate-700 text-slate-300">
                  {period.name}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                  period.status === "OPEN" 
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                    : "bg-slate-700 text-slate-300 border border-slate-600"
                }`}>
                  {period.status === "OPEN" ? (isAr ? "مفتوحة" : "OPEN") : (isAr ? "مغلقة" : "CLOSED")}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                <span>{period.startDate} {isAr ? "إلى" : "to"} {period.endDate}</span>
                {existingCertification && (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" />
                    {isAr ? "معتمدة بشهادة إغلاق جنائي" : "Certified with Forensic Certificate"}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-re-run-reconciliation"
              onClick={handleRunReconciliation}
              disabled={loading}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              {isAr ? "إعادة الفحص" : "Re-evaluate"}
            </button>
            <button
              id="btn-close-reconciliation-modal"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div id="period-reconciliation-body" className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {errorMsg && (
            <div id="reconciliation-error-alert" className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-start gap-3 text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{isAr ? "خطأ في المطابقة" : "Reconciliation Error"}</p>
                <p className="text-xs mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {successMsg && (
            <div id="reconciliation-success-alert" className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-start gap-3 text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{isAr ? "تم بنجاح" : "Success"}</p>
                <p className="text-xs mt-0.5">{successMsg}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
              <p className="font-bold text-sm">{isAr ? "جاري إجراء الفحص والمطابقة المحاسبية والجنائية..." : "Running forensic reconciliation checks..."}</p>
              <p className="text-xs text-slate-400 mt-1">{isAr ? "مطابقة قيود اليومية، سندات القبض، مستحقات الملاك، الضريبة، والشيكات" : "Cross-verifying journals, collections, owner payable, VAT & cheques"}</p>
            </div>
          ) : report ? (
            <>
              {/* Overall Status Banner */}
              <div id="overall-status-banner" className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                report.overallStatus === "RECONCILED"
                  ? "bg-emerald-50/90 border-emerald-200 text-emerald-950"
                  : report.overallStatus === "RECONCILED_WITH_WARNINGS"
                  ? "bg-amber-50/90 border-amber-200 text-amber-950"
                  : "bg-rose-50/90 border-rose-200 text-rose-950"
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${
                    report.overallStatus === "RECONCILED"
                      ? "bg-emerald-100 text-emerald-700"
                      : report.overallStatus === "RECONCILED_WITH_WARNINGS"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-rose-100 text-rose-700"
                  }`}>
                    {report.overallStatus === "RECONCILED" ? (
                      <CheckCircle2 className="w-8 h-8" />
                    ) : report.overallStatus === "RECONCILED_WITH_WARNINGS" ? (
                      <AlertTriangle className="w-8 h-8" />
                    ) : (
                      <XCircle className="w-8 h-8" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black">
                        {report.overallStatus === "RECONCILED"
                          ? (isAr ? "مطابقة مالية مكتملة وموزونة بالكامل" : "Fully Reconciled & Balanced")
                          : report.overallStatus === "RECONCILED_WITH_WARNINGS"
                          ? (isAr ? "مطابقة مالية مكتملة مع وجود تنبيهات غير مانعة" : "Reconciled with Non-blocking Warnings")
                          : (isAr ? "فشل المطابقة المالية - توجد فروقات واستثناءات حرجة" : "Reconciliation Failed - Critical Exceptions Found")}
                      </span>
                    </div>
                    <p className="text-xs opacity-80 mt-1">
                      {isAr
                        ? `تم الفحص بواسطة: ${report.reconciledByUserName} بتاريخ ${new Date(report.reconciledAt).toLocaleString('ar-AE')} | الاستثناءات: ${report.totalExceptions} | التنبيهات: ${report.totalWarnings}`
                        : `Audited by: ${report.reconciledByUserName} on ${new Date(report.reconciledAt).toLocaleString('en-GB')} | Exceptions: ${report.totalExceptions} | Warnings: ${report.totalWarnings}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {existingCertification ? (
                    <button
                      id="btn-view-existing-cert"
                      onClick={() => setShowCertificateView(true)}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                    >
                      <Award className="w-4 h-4 text-amber-400" />
                      {isAr ? "عرض شهادة الإغلاق الجنائي" : "View Forensic Certificate"}
                    </button>
                  ) : report.canCertify ? (
                    <button
                      id="btn-open-certification-drawer"
                      onClick={() => setShowCertificateView(true)}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      <Award className="w-4 h-4 text-amber-300" />
                      {isAr ? "إصدار شهادة الإغلاق المالي" : "Issue Closing Certificate"}
                    </button>
                  ) : (
                    <div className="text-xs text-rose-600 font-bold px-3 py-1.5 bg-rose-100 rounded-lg border border-rose-200">
                      {isAr ? "الإصدار محظور حتى تسوية الاستثناءات" : "Certification Blocked Until Resolved"}
                    </div>
                  )}
                </div>
              </div>

              {/* Financial KPI Summary Cards */}
              <div id="reconciliation-kpis-grid" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 block">{isAr ? "إجمالي المقبوضات" : "Total Collections"}</span>
                  <span className="text-base font-black text-slate-800 mt-1 block">
                    {report.totalCollections.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal text-slate-400">{isAr ? "د.إ" : "AED"}</span>
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 block">{isAr ? "إجمالي المصروفات" : "Total Expenses"}</span>
                  <span className="text-base font-black text-slate-800 mt-1 block">
                    {report.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal text-slate-400">{isAr ? "د.إ" : "AED"}</span>
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 block">{isAr ? "تحويلات الملاك" : "Owner Transfers"}</span>
                  <span className="text-base font-black text-slate-800 mt-1 block">
                    {report.totalOwnerTransfers.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal text-slate-400">{isAr ? "د.إ" : "AED"}</span>
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 block">{isAr ? "ضريبة القيمة المضافة" : "Total VAT"}</span>
                  <span className="text-base font-black text-slate-800 mt-1 block">
                    {report.totalVat.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal text-slate-400">{isAr ? "د.إ" : "AED"}</span>
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 block">{isAr ? "مستحقات الملاك" : "Owner Payables"}</span>
                  <span className="text-base font-black text-indigo-700 mt-1 block">
                    {report.totalOwnerPayable.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal text-slate-400">{isAr ? "د.إ" : "AED"}</span>
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 block">{isAr ? "الاستثناءات والتنبيهات" : "Exceptions & Warns"}</span>
                  <span className={`text-base font-black mt-1 block ${report.totalExceptions > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {report.totalExceptions} {isAr ? "حرج" : "Crit"} / {report.totalWarnings} {isAr ? "تنبيه" : "Warn"}
                  </span>
                </div>
              </div>

              {/* 8 Audit Areas Reconciliation Matrix */}
              <div id="reconciliation-matrix-section" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="p-4 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-indigo-600" />
                    {isAr ? "مصفوفة التدقيق والمطابقة في المجالات المحاسبية الثمانية (8 Audit Areas)" : "8-Area Financial Reconciliation Matrix"}
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    {isAr ? "انقر على أي مجال لعرض الفروقات والتفاصيل" : "Click any area to expand details"}
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {report.areaResults.map((area) => {
                    const isExpanded = selectedArea === area.area;
                    return (
                      <div key={area.area} className="transition-colors hover:bg-slate-50/50">
                        <div
                          id={`area-row-${area.area.toLowerCase()}`}
                          onClick={() => setSelectedArea(isExpanded ? null : area.area)}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-slate-100">
                              {getAreaIcon(area.area)}
                            </div>
                            <div>
                              <span className="font-bold text-sm text-slate-800 block">
                                {isAr ? area.nameAr : area.nameEn}
                              </span>
                              <span className="text-xs text-slate-400">
                                {isAr
                                  ? `المتوقع: ${area.totalExpected.toLocaleString('en-US', { minimumFractionDigits: 2 })} د.إ | الفعلي: ${area.totalActual.toLocaleString('en-US', { minimumFractionDigits: 2 })} د.إ`
                                  : `Expected: ${area.totalExpected.toLocaleString('en-US', { minimumFractionDigits: 2 })} AED | Actual: ${area.totalActual.toLocaleString('en-US', { minimumFractionDigits: 2 })} AED`}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1 ${
                                area.status === "PASS"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : area.status === "WARNING"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              }`}>
                                {area.status === "PASS" ? (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                ) : area.status === "WARNING" ? (
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5" />
                                )}
                                {area.status === "PASS" ? (isAr ? "متطابق 100%" : "MATCHED") : area.status === "WARNING" ? (isAr ? "تنبيه" : "WARNING") : (isAr ? "غير متطابق" : "DISCREPANCY")}
                              </span>
                            </div>

                            <div className="text-xs font-mono font-bold text-slate-700 min-w-[90px] text-left">
                              {isAr ? "الفرق: " : "Diff: "}
                              <span className={Math.abs(area.difference) > 0.001 ? "text-rose-600" : "text-emerald-600"}>
                                {Math.abs(area.difference) < 0.001 ? "0.00" : area.difference.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            </div>

                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </div>
                        </div>

                        {/* Expanded Area Details */}
                        {isExpanded && (
                          <div className="p-4 bg-slate-50 border-t border-slate-100 text-xs space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-white p-3 rounded-xl border border-slate-200">
                                <span className="font-bold text-slate-700 block mb-2">{isAr ? "تفاصيل المقارنة المحاسبية" : "Accounting Comparison Details"}</span>
                                <div className="space-y-1 text-slate-600">
                                  <div className="flex justify-between py-1 border-b border-slate-100">
                                    <span>{isAr ? "القيمة المحسوبة المتوقعة:" : "Calculated Expected Value:"}</span>
                                    <span className="font-mono font-bold">{area.totalExpected.toLocaleString('en-US', { minimumFractionDigits: 2 })} AED</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-slate-100">
                                    <span>{isAr ? "القيمة الفعلية المقيدة:" : "Actual Recorded Value:"}</span>
                                    <span className="font-mono font-bold">{area.totalActual.toLocaleString('en-US', { minimumFractionDigits: 2 })} AED</span>
                                  </div>
                                  <div className="flex justify-between py-1 font-bold">
                                    <span>{isAr ? "الفارق المحاسبي:" : "Accounting Difference:"}</span>
                                    <span className={`font-mono ${Math.abs(area.difference) > 0.001 ? "text-rose-600" : "text-emerald-600"}`}>
                                      {area.difference.toLocaleString('en-US', { minimumFractionDigits: 2 })} AED
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white p-3 rounded-xl border border-slate-200">
                                <span className="font-bold text-slate-700 block mb-2">{isAr ? "ملاحظات وتفسير النظام" : "System Observations"}</span>
                                <p className="text-slate-600 leading-relaxed">
                                  {isAr ? area.detailsAr : area.detailsEn}
                                </p>
                              </div>
                            </div>

                            {/* Specific Discrepancies if any */}
                            {area.differences.length > 0 && (
                              <div className="space-y-2 mt-2">
                                <span className="font-bold text-slate-700 block">{isAr ? "قائمة الفروقات والاستثناءات:" : "List of Discrepancies:"}</span>
                                {area.differences.map((diff, idx) => (
                                  <div key={idx} className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                    diff.severity === "CRITICAL"
                                      ? "bg-rose-50 border-rose-200 text-rose-900"
                                      : diff.severity === "HIGH" || diff.severity === "MEDIUM"
                                      ? "bg-amber-50 border-amber-200 text-amber-900"
                                      : "bg-blue-50 border-blue-200 text-blue-900"
                                  }`}>
                                    <div>
                                      <span className="font-bold text-xs block">{isAr ? diff.descriptionAr : diff.descriptionEn}</span>
                                      <span className="text-[11px] opacity-80">{isAr ? `الإجراء الموصى به: ${diff.recommendedAction}` : `Action: ${diff.recommendedAction}`}</span>
                                    </div>
                                    <div className="text-left font-mono font-bold text-xs shrink-0">
                                      {diff.difference > 0 && `Diff: ${diff.difference.toLocaleString('en-US', { minimumFractionDigits: 2 })} AED`}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* All Forensic Differences & Exceptions Summary Table */}
              {report.allDifferences.length > 0 && (
                <div id="all-differences-section" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="p-4 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      {isAr ? "سجل الفروقات والاستثناءات الجنائية المكتشفة" : "Forensic Discrepancy & Exception Register"}
                    </h3>
                    <span className="text-xs font-bold text-slate-600">
                      {report.allDifferences.length} {isAr ? "عنصر" : "Items"}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {report.allDifferences.map((diff, idx) => (
                      <div key={idx} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/50">
                        <div className="flex items-start gap-3">
                          <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                            diff.severity === "CRITICAL"
                              ? "bg-rose-100 text-rose-700"
                              : diff.severity === "HIGH" || diff.severity === "MEDIUM"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-blue-100 text-blue-700"
                          }`}>
                            {diff.severity === "CRITICAL" ? <XCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-800">{isAr ? diff.descriptionAr : diff.descriptionEn}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                diff.severity === "CRITICAL"
                                  ? "bg-rose-100 text-rose-700"
                                  : diff.severity === "HIGH"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}>
                                {diff.severity}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                              {isAr ? `المرجع: ${diff.transactionReference} | الإجراء الموصى به: ${diff.recommendedAction}` : `Ref: ${diff.transactionReference} | Recommended: ${diff.recommendedAction}`}
                            </p>
                          </div>
                        </div>

                        <div className="text-right sm:text-left shrink-0">
                          <span className="text-[10px] text-slate-400 block">{isAr ? "قيمة الفرق:" : "Difference:"}</span>
                          <span className="text-xs font-mono font-bold text-slate-800">
                            {diff.difference.toLocaleString('en-US', { minimumFractionDigits: 2 })} AED
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Certificate View / Certification Action Modal Overlay */}
        <AnimatePresence>
          {showCertificateView && (
            <div id="certificate-subview-overlay" className="absolute inset-0 bg-slate-900/80 backdrop-blur-md z-20 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                id="certificate-card"
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 border border-slate-200"
              >
                {activeCertification ? (
                  /* Display existing or newly issued certificate */
                  <div className="space-y-6">
                    <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {companyProfile?.logoUrl || companyProfile?.logoBase64 || companyProfile?.logo ? (
                          <div className="w-14 h-14 rounded-xl border border-slate-200 overflow-hidden shrink-0 bg-white flex items-center justify-center p-1 shadow-xs">
                            <img
                              src={companyProfile.logoUrl || companyProfile.logoBase64 || companyProfile.logo}
                              alt="Office Logo"
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : null}
                        <div>
                          <div className="text-xs font-bold text-slate-500">
                            {isAr ? companyProfile?.nameAr : companyProfile?.nameEn}
                          </div>
                          <h3 className="text-xl font-black text-slate-900 mt-0.5">
                            {isAr ? "شهادة إغلاق وتدقيق مالي جنائي" : "Forensic Financial Closing Certificate"}
                          </h3>
                          <span className="text-[10px] font-bold tracking-widest text-indigo-600 uppercase">
                            EMIRATES FALCON ERP • FORENSIC AUDIT
                          </span>
                        </div>
                      </div>
                      <Award className="w-10 h-10 text-amber-500 shrink-0" />
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-bold">{isAr ? "رقم الشهادة:" : "Certificate Number:"}</span>
                        <span className="font-mono font-black text-indigo-600">{activeCertification.certificateNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-bold">{isAr ? "الفترة المالية:" : "Financial Period:"}</span>
                        <span className="font-bold text-slate-800">{activeCertification.periodName} ({activeCertification.startDate} → {activeCertification.endDate})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-bold">{isAr ? "تاريخ الإصدار والختم:" : "Issued & Sealed At:"}</span>
                        <span className="font-mono text-slate-700">{new Date(activeCertification.certifiedAt).toLocaleString('en-GB')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-bold">{isAr ? "المدقق المعتمد:" : "Certified Auditor:"}</span>
                        <span className="font-bold text-slate-800">{activeCertification.certifiedByUserName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-bold">{isAr ? "حالة التدقيق:" : "Reconciliation Status:"}</span>
                        <span className="font-black text-emerald-700">{activeCertification.overallStatus}</span>
                      </div>
                    </div>

                    {/* Snapshot Financial Totals */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 block">{isAr ? "المقبوضات" : "Collections"}</span>
                        <span className="text-xs font-mono font-black text-slate-800 mt-0.5 block">{activeCertification.totalCollections.toLocaleString()} AED</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 block">{isAr ? "المصروفات" : "Expenses"}</span>
                        <span className="text-xs font-mono font-black text-slate-800 mt-0.5 block">{activeCertification.totalExpenses.toLocaleString()} AED</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 block">{isAr ? "تحويلات الملاك" : "Transfers"}</span>
                        <span className="text-xs font-mono font-black text-slate-800 mt-0.5 block">{activeCertification.totalOwnerTransfers.toLocaleString()} AED</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 block">{isAr ? "الضريبة" : "VAT"}</span>
                        <span className="text-xs font-mono font-black text-slate-800 mt-0.5 block">{activeCertification.totalVat.toLocaleString()} AED</span>
                      </div>
                    </div>

                    {/* Snapshot Hash */}
                    <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 mb-1">
                        <Hash className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{isAr ? "بصمة التشفير الجنائية للقطة المالية (Snapshot Integrity Hash):" : "Forensic Snapshot Cryptographic Hash:"}</span>
                      </div>
                      <p className="font-mono text-[11px] text-indigo-800 break-all bg-white p-2 rounded-lg border border-indigo-100">
                        {activeCertification.snapshotHash}
                      </p>
                    </div>

                    {activeCertification.notes && (
                      <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <span className="font-bold block mb-1">{isAr ? "ملاحظات المدقق:" : "Auditor Notes:"}</span>
                        <p>{activeCertification.notes}</p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => window.print()}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer shadow-sm"
                      >
                        <Printer className="w-4 h-4" />
                        {isAr ? "طباعة الشهادة الرسمية" : "Print Official Certificate"}
                      </button>
                      <button
                        onClick={() => setShowCertificateView(false)}
                        className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-all text-xs cursor-pointer"
                      >
                        {isAr ? "إغلاق" : "Close"}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Issuance Confirmation Form */
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 text-indigo-600 border-b border-slate-100 pb-3">
                      <Award className="w-7 h-7" />
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">
                          {isAr ? "إصدار شهادة إغلاق مالي جنائي رسمية" : "Issue Official Forensic Closing Certificate"}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {isAr ? `تثبيت لقطة مالية غير قابلة للتعديل للفترة: ${period.name}` : `Seal an immutable forensic snapshot for ${period.name}`}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-800">
                      {isAr
                        ? "تحذير حوكمة: إصدار هذه الشهادة ينشئ سجلاً جنائياً وبصمة تشفير دائمة تثبت توازن الحسابات في لحظة الفحص. لا يلغي هذا المعاملات الأساسية، ولا يمكن حذف الشهادة."
                        : "Governance Notice: Issuing this certificate seals an immutable snapshot hash verifying account balance. It does not replace underlying transactions and cannot be deleted."}
                    </p>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        {isAr ? "ملاحظات الاعتماد والتدقيق (اختياري):" : "Auditor Certification Notes (Optional):"}
                      </label>
                      <textarea
                        value={certificationNotes}
                        onChange={(e) => setCertificationNotes(e.target.value)}
                        placeholder={isAr ? "أدخل أي ملاحظات تدقيقية أو قرارات تسوية..." : "Enter audit notes or reconciliation remarks..."}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-indigo-500 h-24"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={handleCertify}
                        disabled={certifying}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                      >
                        {certifying ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-4 h-4" />
                        )}
                        {isAr ? "تأكيد واعتماد وإصدار الشهادة" : "Confirm & Issue Certificate"}
                      </button>
                      <button
                        onClick={() => setShowCertificateView(false)}
                        className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-all text-xs cursor-pointer"
                      >
                        {isAr ? "إلغاء" : "Cancel"}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div id="period-reconciliation-footer" className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{isAr ? "نظام الرقابة المالية والحوكمة الجنائية - صقر الإمارات" : "Emirates Falcon ERP Financial Reconciliation & Forensic Engine"}</span>
          </div>

          <button
            id="btn-footer-close"
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            {isAr ? "إغلاق النافذة" : "Close Window"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
