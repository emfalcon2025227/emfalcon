import React, { useState, useMemo } from "react";
import {
  LayoutDashboard,
  Users,
  Clock,
  AlertCircle,
  MessageSquare,
  HandCoins,
  Gavel,
  History,
  FileBarChart,
  Settings,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Receipt,
  Plus,
  CreditCard,
  Coins,
  AlertTriangle,
  Mail,
  Printer,
  Download,
  FileText,
  TrendingUp,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useNavigation } from "../../context/NavigationContext";
import { CloseBackButton } from "../common/CloseBackButton";
import { CollectionDashboard } from "./CollectionDashboard";
import { TenantReceivablesView } from "./TenantReceivablesView";
import { AgingEngineView } from "./AgingEngineView";
import { FollowUpSystem } from "./FollowUpSystem";
import { PromisesView } from "./PromisesView";
import { LegalEscalationView } from "./LegalEscalationView";
import { CollectionHistoryView } from "./CollectionHistoryView";
import { CollectionsView } from "./CollectionsView";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { Cheque } from "../../types";
import { OfficePrintHeader } from "../common/OfficePrintHeader";

export const CollectionCenter: React.FC = () => {
  const { canGoBack } = useNavigation();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [activeTab, setActiveTab] = useState<
    | "DASHBOARD"
    | "VOUCHERS"
    | "RECEIVABLES"
    | "AGING"
    | "DUE_PAYMENTS"
    | "OVERDUE"
    | "BOUNCED"
    | "FOLLOW_UP"
    | "PROMISES"
    | "LEGAL"
    | "HISTORY"
    | "REPORTS"
    | "TESTS"
    | "PHASE54_TESTS"
    | "SETTINGS"
  >("VOUCHERS");

  const [selectedChequeForPay, setSelectedChequeForPay] = useState<Cheque | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [phase54Result, setPhase54Result] = useState<any>(null);

  const {
    owners,
    tenants,
    leases,
    commissions,
    vatRates,
    financialPeriods,
    chartOfAccounts,
    ownerTransfers,
    propertyExpenses,
    journalEntries,
    collections,
    paymentAllocations,
    getTenantReceivablePosition,
    collectionActions,
    paymentPromises,
    cheques,
  } = useData();

  const runPhase54Tests = () => {
    const result = runPhase54EndToEndFinancialReconciliationTests({
      owners,
      tenants,
      leases,
      commissions,
      vatRates,
      financialPeriods,
      chartOfAccounts,
      ownerTransfers,
      propertyExpenses,
      journalEntries,
      collections,
      paymentAllocations,
    });
    setPhase54Result(result);
  };

  const runTests = () => {
    const result = runPhase19CollectionTests(
      tenants,
      getTenantReceivablePosition,
      collectionActions,
      paymentPromises
    );
    setTestResult(result);
  };

  const outstandingCheques = useMemo(() => {
    return cheques.filter((c) => c.outstanding > 0);
  }, [cheques]);

  const summaryMetrics = useMemo(() => {
    const allPositions = tenants.map((t) => getTenantReceivablePosition(t.id));
    const totalOutstanding = allPositions.reduce((sum, p) => sum + p.outstanding, 0);
    const totalOverdue = allPositions.reduce(
      (sum, p) => sum + (p.outstanding - p.aging.current),
      0
    );
    const bouncedCount = cheques.filter((c) => c.status === "BOUNCED").length;
    const activePromisesCount = paymentPromises.filter((p) => p.status === "ACTIVE").length;

    return {
      totalOutstanding,
      totalOverdue,
      bouncedCount,
      activePromisesCount,
    };
  }, [tenants, getTenantReceivablePosition, cheques, paymentPromises]);

  const handleRecordPaymentDirect = () => {
    const target = outstandingCheques[0] || null;
    if (target) {
      setSelectedChequeForPay(target);
    } else {
      setActiveTab("RECEIVABLES");
    }
  };

  const tabsGroupCore = [
    { id: "DASHBOARD", label: isAr ? "لوحة التحكم" : "Dashboard", icon: LayoutDashboard },
    { id: "VOUCHERS", label: isAr ? "التحصيلات والسندات" : "Receipts & Vouchers", icon: Receipt },
    { id: "RECEIVABLES", label: isAr ? "ذمم المستأجرين" : "Receivables", icon: Users },
    { id: "AGING", label: isAr ? "أعمار الديون" : "Debt Aging", icon: Clock },
  ];

  const tabsGroupRecovery = [
    { id: "FOLLOW_UP", label: isAr ? "المتابعة والتحصيل" : "Follow-up", icon: MessageSquare },
    { id: "PROMISES", label: isAr ? "وعود السداد" : "Promises", icon: HandCoins },
    { id: "LEGAL", label: isAr ? "التصعيد القانوني" : "Legal", icon: Gavel },
  ];

  const tabsGroupReports = [
    { id: "HISTORY", label: isAr ? "السجل" : "History", icon: History },
    { id: "REPORTS", label: isAr ? "التقارير" : "Reports", icon: FileBarChart },
    { id: "TESTS", label: isAr ? "فحص التدقيق" : "Audit Tests", icon: ShieldCheck },
    { id: "PHASE54_TESTS", label: isAr ? "سلامة الدورة المالية" : "Financial Integrity (P54)", icon: ShieldCheck },
    { id: "SETTINGS", label: isAr ? "الإعدادات" : "Settings", icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Header & Control Center */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 sm:px-6 sm:py-4 space-y-3 shrink-0">
        {/* Title Row & Top Metrics */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <HandCoins className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 shrink-0" />
              <span>{isAr ? "مركز التحصيل وتحصيل الديون" : "Collection & Debt Recovery Center"}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {isAr
                ? "إدارة ذمم المستأجرين، المتابعة، وعود السداد، والتصعيد القانوني"
                : "Manage tenant receivables, follow-ups, payment promises, and legal escalations"}
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-slate-500">{isAr ? "المديونية:" : "Outstanding:"}</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {summaryMetrics.totalOutstanding.toLocaleString()} AED
              </span>
            </div>

            <div className="bg-rose-50 dark:bg-rose-950/30 px-3 py-1.5 rounded-xl border border-rose-100 dark:border-rose-900/50 flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-rose-600/80">{isAr ? "المتأخرات:" : "Overdue:"}</span>
              <span className="font-bold">{summaryMetrics.totalOverdue.toLocaleString()} AED</span>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-xl border border-amber-100 dark:border-amber-900/50 flex items-center gap-1.5 text-amber-800 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="text-amber-700/80">{isAr ? "مرتجعة:" : "Bounced:"}</span>
              <span className="font-bold">{summaryMetrics.bouncedCount}</span>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400">
              <HandCoins className="w-3.5 h-3.5" />
              <span className="text-indigo-600/80">{isAr ? "وعود نشطة:" : "Promises:"}</span>
              <span className="font-bold">{summaryMetrics.activePromisesCount}</span>
            </div>

            {canGoBack && <CloseBackButton />}
          </div>
        </div>

        {/* Tab Groups Toolbar - All Visible Without Horizontal Scrolling */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/60">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Core Group */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
              {tabsGroupCore.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-extrabold transition-all duration-150 cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Recovery Group */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
              {tabsGroupRecovery.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-extrabold transition-all duration-150 cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Reports & Audit Group */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
              {tabsGroupReports.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-extrabold transition-all duration-150 cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Primary & Secondary Operational Action Toolbar - Grouped & Zero Scrolling */}
        <div className="bg-slate-900 text-white p-3 sm:p-3.5 rounded-2xl shadow-lg border border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* Collection Actions Group */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400 px-1 hidden xl:inline">
              {isAr ? "التحصيل والدفع:" : "Collection:"}
            </span>

            <button
              type="button"
              onClick={handleRecordPaymentDirect}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 shadow-md shadow-emerald-900/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>{isAr ? "تحصيل دفعة" : "Collect Payment"}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("RECEIVABLES")}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>{isAr ? "تسجيل تحصيل" : "Record Payment"}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("RECEIVABLES")}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-xs"
            >
              <CreditCard className="w-4 h-4 text-indigo-400" />
              <span>{isAr ? "توزيع الدفعات" : "Allocate Payment"}</span>
            </button>
          </div>

          {/* Cheque Actions Group */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400 px-1 hidden xl:inline">
              {isAr ? "الشيكات والمرتجعات:" : "Cheques:"}
            </span>

            <button
              type="button"
              onClick={() => setActiveTab("RECEIVABLES")}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-xs"
            >
              <Coins className="w-4 h-4 text-amber-400" />
              <span>{isAr ? "تحصيل شيك" : "Collect Cheque"}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("RECEIVABLES")}
              className="px-3.5 py-2 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 shadow-md shadow-rose-900/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>{isAr ? "شيكات مرتجعة" : "Mark as Bounced"}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("RECEIVABLES")}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-xs"
            >
              <FileText className="w-4 h-4 text-slate-400" />
              <span>{isAr ? "تفاصيل الدفعات" : "Payment Details"}</span>
            </button>
          </div>

          {/* Recovery Actions Group */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400 px-1 hidden xl:inline">
              {isAr ? "المتابعة والتعافي:" : "Recovery:"}
            </span>

            <button
              type="button"
              onClick={() => setActiveTab("FOLLOW_UP")}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-xs"
            >
              <MessageSquare className="w-4 h-4 text-amber-400" />
              <span>{isAr ? "إرسال تذكير" : "Send Reminder"}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("FOLLOW_UP")}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-xs"
            >
              <Mail className="w-4 h-4 text-amber-400" />
              <span>{isAr ? "إشعار سداد" : "Send Notice"}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("PROMISES")}
              className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 shadow-md shadow-indigo-900/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <HandCoins className="w-4 h-4" />
              <span>{isAr ? "وعد سداد" : "New Promise"}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("LEGAL")}
              className="px-3.5 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Gavel className="w-4 h-4" />
              <span>{isAr ? "تصعيد قضائي" : "Convert Case"}</span>
            </button>
          </div>

          {/* Records & Reports Actions Group */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("HISTORY")}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-xs"
            >
              <History className="w-4 h-4 text-slate-400" />
              <span>{isAr ? "السجل" : "History"}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span>{isAr ? "طباعة" : "Print"}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("REPORTS")}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span>{isAr ? "تصدير" : "Export"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("PHASE54_TESTS");
                runPhase54Tests();
              }}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/40 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-xs"
            >
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>{isAr ? "فحص النزاهة (Phase 54)" : "Run Integrity (P54)"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("TESTS");
                runTests();
              }}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-xs"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{isAr ? "فحص تدقيق" : "Run Audit"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Stage */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        {/* Printable Header with Office Logo and Name */}
        <OfficePrintHeader
          titleAr="مركز التحصيلات ومتابعة المستحقات الإيجارية"
          titleEn="RENTAL COLLECTIONS & RECEIVABLES CENTER"
          hideOnScreen={true}
        />

        {activeTab === "DASHBOARD" && <CollectionDashboard />}
        {activeTab === "VOUCHERS" && <CollectionsView />}
        {activeTab === "RECEIVABLES" && <TenantReceivablesView />}
        {activeTab === "AGING" && <AgingEngineView />}
        {activeTab === "FOLLOW_UP" && <FollowUpSystem />}
        {activeTab === "PROMISES" && <PromisesView />}
        {activeTab === "LEGAL" && <LegalEscalationView />}
        {activeTab === "HISTORY" && <CollectionHistoryView />}
        {activeTab === "PHASE54_TESTS" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-700 text-center">
              <ShieldCheck className="w-16 h-16 text-teal-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                {isAr ? "نظام التحقق من النزاهة المالية (Phase 54)" : "Phase 54 Financial Integrity & Reconciliation"}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto mb-8">
                {isAr
                  ? "إجراء فحص شامل للدورة المالية الكاملة، من إنشاء الالتزام المالي وحتى ظهوره في الأستاذ والتقارير."
                  : "Comprehensive check of the full financial cycle, from obligation creation to ledger posting and reporting."}
              </p>
              <button
                onClick={runPhase54Tests}
                className="px-8 py-3 bg-teal-600 text-white rounded-2xl font-bold hover:bg-teal-700 transition-all shadow-lg shadow-teal-600/20 cursor-pointer"
              >
                {isAr ? "تشغيل فحص النزاهة الشامل" : "Run Financial Integrity Audit"}
              </button>
            </div>

            {phase54Result && (
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-bold text-slate-900 dark:text-white">
                    {isAr ? "ملخص نتائج المرحلة 54" : "Phase 54 Audit Summary"}
                  </h4>
                  <div className="flex gap-4">
                    <div className="px-4 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                      PASS: {phase54Result.pass}
                    </div>
                    <div className={`px-4 py-1 rounded-full text-xs font-bold ${phase54Result.fail > 0 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>
                      FAIL: {phase54Result.fail}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {phase54Result.results.map((r: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700"
                    >
                      <div className="flex items-center gap-3">
                        {r.status === "PASS" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600" />
                        )}
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{r.name}</span>
                      </div>
                      <div className={`text-[10px] font-bold ${r.status === "PASS" ? "text-emerald-600" : "text-rose-600"}`}>
                        {r.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === "TESTS" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-700 text-center">
              <ShieldCheck className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                {isAr ? "نظام التدقيق والفحص المالي (Phase 19)" : "Phase 19 Financial Audit & Verification"}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto mb-8">
                {isAr
                  ? "يقوم هذا النظام بفحص دقة حسابات مديونية المستأجرين وتوزيع أعمار الديون وسلامة سجلات المتابعة والوعود."
                  : "This system audits the accuracy of tenant receivables, aging buckets, and the integrity of follow-up/promise logs."}
              </p>
              <button
                onClick={runTests}
                className="px-8 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                {isAr ? "تشغيل الفحص الشامل" : "Run Comprehensive Audit"}
              </button>
            </div>

            {testResult && (
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-bold text-slate-900 dark:text-white">{isAr ? "نتائج الفحص" : "Audit Results"}</h4>
                  <div
                    className={`px-4 py-1 rounded-full text-xs font-bold ${
                      testResult.success ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {testResult.success ? (isAr ? "اجتاز الفحص" : "Passed") : isAr ? "فشل الفحص" : "Failed"}
                  </div>
                </div>

                <div className="space-y-3">
                  {testResult.assertions.map((a: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700"
                    >
                      <div className="flex items-center gap-3">
                        {a.passed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-600" />
                        )}
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{a.label}</span>
                      </div>
                      <div className="text-xs font-mono text-slate-400">{JSON.stringify(a.actual)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {(activeTab === "REPORTS" || activeTab === "SETTINGS") && (
          <div className="flex items-center justify-center h-64 text-slate-400 italic">
            {isAr ? "قيد التطوير في المراحل النهائية" : "Under final development"}
          </div>
        )}
      </div>

      {/* Payment Recording Modal */}
      <RecordPaymentModal
        isOpen={!!selectedChequeForPay}
        onClose={() => setSelectedChequeForPay(null)}
        cheque={selectedChequeForPay}
        onPaymentSuccess={() => {
          setSelectedChequeForPay(null);
        }}
      />
    </div>
  );
};
