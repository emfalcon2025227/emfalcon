import React, { useState, useMemo } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  FileText,
  Search,
  Filter,
  Printer,
  FileSpreadsheet,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Hash,
  User,
  Calendar,
  Lock,
  Eye,
  BarChart4,
  Layers,
  ArrowUpRight,
  History,
  FileBarChart,
  BadgePercent,
  ShieldAlert
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { 
  CommissionObligation, 
  OwnerTransferRecord, 
  DailyDepositRecord, 
  JournalEntryRecord,
  FinancialPeriod,
  CollectionRecord,
  PaymentAllocation
} from "../../types";

/**
 * PHASE 55 — Financial Management & Reconciliation Center
 * A comprehensive reporting layer for Emirates Falcon ERP.
 */

type ReportTab = 
  | "EXECUTIVE_SUMMARY"
  | "REVENUE_RECON"
  | "DEPOSIT_RECON"
  | "OWNER_PAYABLES"
  | "EXCEPTION_LOG"
  | "LIFECYCLE_TRACKER"
  | "PHASE55_TESTS";

interface FinancialException {
  id: string;
  type: "AMOUNT_MISMATCH" | "MISSING_PROOF" | "BATCH_IMBALANCE" | "MISSING_POSTING" | "UNLINKED_DEPOSIT" | "DUPLICATE_REFERENCE" | "PERIOD_VIOLATION" | "OWNER_PAYABLE_MISMATCH";
  severity: "CRITICAL" | "WARNING" | "INFO";
  sourceId: string;
  sourceType: string;
  amount?: number;
  date: string;
  descriptionAr: string;
  descriptionEn: string;
  suggestedActionAr: string;
  suggestedActionEn: string;
}

export const FinancialReconciliationCenter: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const {
    commissions = [],
    ownerTransfers = [],
    dailyDeposits = [],
    journalEntries = [],
    financialPeriods = [],
    collections = [],
    paymentAllocations = [],
    owners = [],
    tenants = [],
    properties = [],
    leases = [],
    vatRates = []
  } = useData();

  const [activeTab, setActiveTab] = useState<ReportTab>("EXECUTIVE_SUMMARY");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [phase55Result, setPhase55Result] = useState<any>(null);

  const runPhase55Tests = () => {
    const result = runPhase55FinancialReportingReconciliationTests({
      owners,
      tenants,
      leases,
      commissions,
      vatRates,
      financialPeriods,
      ownerTransfers,
      journalEntries,
      collections,
      paymentAllocations,
      dailyDepositBatches: dailyDeposits as any
    });
    setPhase55Result(result);
  };

  // 1. Reconciliation Engine — Detect Exceptions
  const exceptions = useMemo(() => {
    const list: FinancialException[] = [];

    // Check Deposits
    dailyDeposits.forEach(deposit => {
      if (deposit.status === "VERIFIED" && deposit.proofStatus === "MISSING") {
        list.push({
          id: `missing-proof-${deposit.id}`,
          type: "MISSING_PROOF",
          severity: "WARNING",
          sourceId: deposit.id,
          sourceType: "DEPOSIT",
          date: deposit.depositDate,
          descriptionAr: `الإيداع المعتمد ${deposit.depositReference} لا يحتوي على إثبات`,
          descriptionEn: `Verified deposit ${deposit.depositReference} is missing proof`,
          suggestedActionAr: "رفع إثبات الإيداع البنكي للأرشيف والتدقيق",
          suggestedActionEn: "Upload bank deposit proof for audit"
        });
      }
    });

    // Check Commissions (Revenue)
    commissions.forEach(c => {
      if (c.status === "COLLECTED" || c.status === "FULLY_COLLECTED") {
        const isDeposited = dailyDeposits.some(d => d.sourceId === c.id);
        if (!isDeposited) {
          list.push({
            id: `unlinked-rev-${c.id}`,
            type: "UNLINKED_DEPOSIT",
            severity: "WARNING",
            sourceId: c.id,
            sourceType: "REVENUE",
            amount: c.collectedAmount,
            date: c.createdAt,
            descriptionAr: `إيراد محصل (${c.businessKey}) لم يتم إدراجه في أي إيداع بنكي`,
            descriptionEn: `Collected revenue (${c.businessKey}) not linked to any bank deposit`,
            suggestedActionAr: "إدراج المعاملة في إيداع بنكي يومي",
            suggestedActionEn: "Include transaction in a bank deposit"
          });
        }

        const hasJournal = journalEntries.some(j => j.sourceId === c.id);
        if (!hasJournal) {
          list.push({
            id: `missing-post-${c.id}`,
            type: "MISSING_POSTING",
            severity: "CRITICAL",
            sourceId: c.id,
            sourceType: "REVENUE",
            amount: c.collectedAmount,
            date: c.createdAt,
            descriptionAr: `إيراد محصل (${c.businessKey}) غير مرحل للأستاذ العام`,
            descriptionEn: `Collected revenue (${c.businessKey}) not posted to GL`,
            suggestedActionAr: "ترحيل المعاملة محاسبياً",
            suggestedActionEn: "Post transaction to general ledger"
          });
        }
      }
    });

    return list;
  }, [dailyDeposits, commissions, journalEntries]);

  // Metrics for Summary View
  const summaryMetrics = useMemo(() => {
    const officeRevenueCreated = commissions.reduce((acc, c) => acc + (c.totalCommissionAmount || 0), 0);
    const officeCollected = commissions.reduce((acc, c) => acc + (c.collectedAmount || 0), 0);
    
    const ownerPayable = ownerTransfers.reduce((acc, t) => acc + t.amount, 0);
    const ownerPaid = ownerTransfers.filter(t => t.status === "PAID").reduce((acc, t) => acc + t.amount, 0);

    const pendingDepositsCount = dailyDeposits.filter(d => d.status === "SUBMITTED").length;
    const criticalExceptionsCount = exceptions.filter(e => e.severity === "CRITICAL").length;

    return {
      officeRevenueCreated,
      officeCollected,
      ownerPayable,
      ownerPaid,
      pendingDepositsCount,
      criticalExceptionsCount
    };
  }, [commissions, ownerTransfers, dailyDeposits, exceptions]);

  // Export functions (Simulated)
  const handleExport = () => {
    alert(isAr ? "بدء تصدير البيانات إلى Excel..." : "Starting Excel export...");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-teal-600" />
            {isAr ? "مركز المطابقة والتقارير المالية" : "Financial Management & Reconciliation Center"}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {isAr ? "نظام التدقيق والرقابة الشاملة على الدورة المالية" : "Comprehensive audit and control system for the financial cycle"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePrint}
            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
            title={isAr ? "طباعة" : "Print"}
          >
            <Printer className="w-5 h-5" />
          </button>
          <button
            onClick={handleExport}
            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer shadow-sm"
            title={isAr ? "تصدير Excel" : "Export Excel"}
          >
            <FileSpreadsheet className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
        {[
          { id: "EXECUTIVE_SUMMARY", label: isAr ? "الملخص التنفيذي" : "Executive Summary", icon: TrendingUp },
          { id: "REVENUE_RECON", label: isAr ? "مطابقة الإيرادات" : "Revenue Recon", icon: BadgePercent },
          { id: "DEPOSIT_RECON", label: isAr ? "تتبع الإيداعات" : "Deposit Tracker", icon: Building2 },
          { id: "OWNER_PAYABLES", label: isAr ? "مستحقات الملاك" : "Owner Settlements", icon: Wallet },
          { id: "EXCEPTION_LOG", label: isAr ? "سجل الاستثناءات" : "Exceptions Log", icon: ShieldAlert },
          { id: "LIFECYCLE_TRACKER", label: isAr ? "متتبع الدورة" : "Lifecycle Tracker", icon: History },
          { id: "PHASE55_TESTS", label: isAr ? "فحص النزاهة (P55)" : "Integrity Audit (P55)", icon: ShieldCheck },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ReportTab)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? "bg-white dark:bg-slate-800 text-teal-600 shadow-sm border border-slate-200 dark:border-slate-700"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? "text-teal-600" : "text-slate-400"}`} />
            {tab.label}
            {tab.id === "EXCEPTION_LOG" && exceptions.length > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${exceptions.some(e => e.severity === "CRITICAL") ? "bg-rose-500 text-white" : "bg-amber-500 text-white"}`}>
                {exceptions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="min-h-[400px]">
        {activeTab === "EXECUTIVE_SUMMARY" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
             {/* Summary Cards */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2.5 bg-teal-50 dark:bg-teal-900/30 rounded-xl">
                      <TrendingUp className="w-5 h-5 text-teal-600" />
                    </div>
                    <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">{isAr ? "إيراد المكتب" : "OFFICE REVENUE"}</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {summaryMetrics.officeRevenueCreated.toLocaleString()} <span className="text-xs font-normal text-slate-400">AED</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {isAr ? "المحصل:" : "Collected:"} <span className="text-emerald-600 font-bold">{summaryMetrics.officeCollected.toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2.5 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
                      <Wallet className="w-5 h-5 text-amber-600" />
                    </div>
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{isAr ? "مستحقات الملاك" : "OWNER PAYABLES"}</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {summaryMetrics.ownerPayable.toLocaleString()} <span className="text-xs font-normal text-slate-400">AED</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {isAr ? "المدفوع:" : "Paid:"} <span className="text-amber-600 font-bold">{summaryMetrics.ownerPaid.toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                      <Layers className="w-5 h-5 text-indigo-600" />
                    </div>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{isAr ? "الإيداعات المعلقة" : "PENDING DEPOSITS"}</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {summaryMetrics.pendingDepositsCount}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {isAr ? "تحتاج لمراجعة واعتماد" : "Requires review and approval"}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-rose-100 dark:border-rose-900/50 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-900/30 rounded-xl">
                      <ShieldAlert className="w-5 h-5 text-rose-600" />
                    </div>
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">{isAr ? "استثناءات حرجة" : "CRITICAL ERRORS"}</span>
                  </div>
                  <div className="text-2xl font-black text-rose-600">
                    {summaryMetrics.criticalExceptionsCount}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {isAr ? "تحتاج تدخل محاسبي فوري" : "Immediate accounting action required"}
                  </div>
                </div>
             </div>

             {/* Fund Integrity Guard */}
             <div className="bg-teal-900/5 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-900/30 rounded-3xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <ShieldCheck className="w-6 h-6 text-teal-600" />
                  <h4 className="font-bold text-slate-900 dark:text-white">{isAr ? "ميثاق نزاهة الفصل المحاسبي" : "Accounting Fund Integrity Guard"}</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {isAr 
                        ? "يتم الفصل التام بين أموال المكتب وأموال الملاك في هذا النظام. لا يُسمح بدمج الحوافظ أو الخلط بين مصادر التمويل لضمان الشفافية والامتثال الضريبي."
                        : "Total separation between Office and Owner funds is enforced. Mixing batches or funding sources is prohibited to ensure transparency and tax compliance."}
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-teal-500" />
                        <span className="text-[10px] font-bold text-slate-500">OFFICE FUNDS</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-[10px] font-bold text-slate-500">OWNER FUNDS</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-12 text-center">
                    <div>
                      <div className="text-3xl font-black text-teal-600">{summaryMetrics.officeCollected.toLocaleString()}</div>
                      <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{isAr ? "صافي أموال المكتب" : "Net Office Funds"}</div>
                    </div>
                    <div className="w-px h-12 bg-slate-200 dark:bg-slate-700" />
                    <div>
                      <div className="text-3xl font-black text-amber-600">{summaryMetrics.ownerPaid.toLocaleString()}</div>
                      <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{isAr ? "صافي أموال الملاك" : "Net Owner Funds"}</div>
                    </div>
                  </div>
                </div>
             </div>
          </div>
        )}

        {activeTab === "EXCEPTION_LOG" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {exceptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4 opacity-20" />
                <p className="text-slate-500 font-medium">{isAr ? "لا توجد استثناءات مالية حالياً. جميع البيانات متطابقة." : "No financial exceptions detected. All data is reconciled."}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {exceptions.map(ex => (
                  <div key={ex.id} className={`bg-white dark:bg-slate-800 p-5 rounded-2xl border-l-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    ex.severity === "CRITICAL" ? "border-l-rose-500" : "border-l-amber-500"
                  }`}>
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-xl mt-1 ${ex.severity === "CRITICAL" ? "bg-rose-50 dark:bg-rose-900/20" : "bg-amber-50 dark:bg-amber-900/20"}`}>
                        <AlertTriangle className={`w-5 h-5 ${ex.severity === "CRITICAL" ? "text-rose-600" : "text-amber-600"}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            ex.severity === "CRITICAL" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {ex.type}
                          </span>
                          <span className="text-xs text-slate-400">{ex.date}</span>
                        </div>
                        <h5 className="font-bold text-slate-900 dark:text-white">{isAr ? ex.descriptionAr : ex.descriptionEn}</h5>
                        <p className="text-sm text-slate-500 mt-1 italic">
                          <span className="font-bold text-teal-600">{isAr ? "الإجراء المقترح:" : "Suggested Action:"} </span>
                          {isAr ? ex.suggestedActionAr : ex.suggestedActionEn}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <button className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all cursor-pointer">
                         {isAr ? "عرض المصدر" : "View Source"}
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "REVENUE_RECON" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-lg">
                    <BadgePercent className="w-4 h-4 text-teal-600" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white">{isAr ? "سجل مطابقة إيرادات المكتب" : "Office Revenue Reconciliation Log"}</h4>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left rtl:text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                      <th className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">{isAr ? "المعاملة" : "Transaction"}</th>
                      <th className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">{isAr ? "النوع" : "Type"}</th>
                      <th className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">{isAr ? "المبلغ (AED)" : "Amount (AED)"}</th>
                      <th className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">{isAr ? "VAT" : "VAT"}</th>
                      <th className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">{isAr ? "الصافي" : "Net"}</th>
                      <th className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">{isAr ? "الحالة" : "Status"}</th>
                      <th className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">{isAr ? "دورة الحياة" : "Lifecycle"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {commissions.map((c) => {
                      const hasDeposit = dailyDeposits.some(d => d.sourceId === c.id);
                      const hasJournal = journalEntries.some(j => j.sourceId === c.id);
                      
                      return (
                        <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors group">
                          <td className="px-4 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">{c.businessKey}</span>
                              <span className="text-[10px] text-slate-400">{c.createdAt}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 uppercase text-[10px] font-bold text-slate-500">{c.commissionType.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-4 font-bold text-xs text-slate-900 dark:text-white">{(c.totalCommissionAmount || 0).toLocaleString()}</td>
                          <td className="px-4 py-4 text-xs text-slate-500">{(c.vatAmount || 0).toLocaleString()}</td>
                          <td className="px-4 py-4 text-xs text-teal-600 font-bold">{(c.netRevenueAmount || 0).toLocaleString()}</td>
                          <td className="px-4 py-4 text-[10px] font-bold uppercase tracking-tight">{c.status}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1.5">
                              <div title={isAr ? "تحصيل" : "Collected"} className={`w-2 h-2 rounded-full ${(c.status === "COLLECTED" || c.status === "FULLY_COLLECTED") ? "bg-teal-500" : "bg-slate-200"}`} />
                              <div title={isAr ? "إيداع" : "Deposited"} className={`w-2 h-2 rounded-full ${hasDeposit ? "bg-teal-500" : "bg-slate-200"}`} />
                              <div title={isAr ? "ترحيل" : "Posted"} className={`w-2 h-2 rounded-full ${hasJournal ? "bg-teal-500" : "bg-slate-200"}`} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "DEPOSIT_RECON" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
               <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 flex items-center gap-2">
                 <Building2 className="w-5 h-5 text-teal-600" />
                 <h4 className="font-bold text-slate-900 dark:text-white">{isAr ? "سجل تتبع الإيداعات البنكية" : "Bank Deposit Tracker"}</h4>
               </div>
               <div className="overflow-x-auto">
                <table className="w-full text-left rtl:text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                      <th className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">{isAr ? "المرجع" : "Reference"}</th>
                      <th className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">{isAr ? "التاريخ" : "Date"}</th>
                      <th className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">{isAr ? "المصدر" : "Source"}</th>
                      <th className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">{isAr ? "المبلغ" : "Amount"}</th>
                      <th className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">{isAr ? "الإثبات" : "Proof"}</th>
                      <th className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">{isAr ? "الحالة" : "Status"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {dailyDeposits.map(d => (
                      <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="px-4 py-4 text-xs font-bold text-teal-600">{d.depositReference}</td>
                        <td className="px-4 py-4 text-xs text-slate-500">{d.depositDate}</td>
                        <td className="px-4 py-4 text-xs text-slate-400 font-bold">
                          {d.paymentSource}
                        </td>
                        <td className="px-4 py-4 text-xs font-bold text-slate-900 dark:text-white">{d.amount.toLocaleString()}</td>
                        <td className="px-4 py-4">
                          {d.proofStatus === "UPLOADED" || d.proofStatus === "VERIFIED" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-rose-500" />}
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-[10px] font-bold uppercase tracking-tight">{d.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
               </div>
            </div>
          </div>
        )}

        {activeTab === "OWNER_PAYABLES" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
               <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 flex items-center gap-2">
                 <Wallet className="w-5 h-5 text-amber-600" />
                 <h4 className="font-bold text-slate-900 dark:text-white">{isAr ? "مستحقات وتسويات الملاك" : "Owner Payables & Settlements"}</h4>
               </div>
               <div className="overflow-x-auto">
                <table className="w-full text-left rtl:text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                      <th className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">{isAr ? "المالك" : "Owner"}</th>
                      <th className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">{isAr ? "المبلغ" : "Amount"}</th>
                      <th className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">{isAr ? "الحالة" : "Status"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {ownerTransfers.map(t => {
                      const owner = owners.find(o => o.id === t.ownerId);
                      return (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="px-4 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold">{owner?.nameEn || t.ownerId}</span>
                              <span className="text-[10px] text-slate-400">{t.transferDate}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-xs text-slate-900 dark:text-white font-bold">{t.amount.toLocaleString()}</td>
                          <td className="px-4 py-4">
                            <span className="text-[10px] font-bold uppercase tracking-tight">{t.status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
               </div>
             </div>
          </div>
        )}

        {activeTab === "PHASE55_TESTS" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-700 text-center">
              <ShieldCheck className="w-16 h-16 text-teal-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                {isAr ? "نظام فحص التقارير والمطابقة المالية (Phase 55)" : "Phase 55 Reporting & Reconciliation Audit"}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto mb-8 text-sm">
                {isAr
                  ? "إجراء فحص شامل لطبقة التقارير والمطابقة المالية، والتأكد من صحة الربط بين المعاملات والحوافظ والقيود المحاسبية."
                  : "Comprehensive check of the reporting and reconciliation layer, ensuring valid linkage between transactions, batches, and journal entries."}
              </p>
              <button
                onClick={runPhase55Tests}
                className="px-8 py-3 bg-teal-600 text-white rounded-2xl font-bold hover:bg-teal-700 transition-all shadow-lg shadow-teal-600/20 cursor-pointer"
              >
                {isAr ? "تشغيل فحص التقارير الشامل" : "Run Financial Reporting Audit"}
              </button>
            </div>

            {phase55Result && (
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-bold text-slate-900 dark:text-white">
                    {isAr ? "ملخص نتائج المرحلة 55" : "Phase 55 Audit Summary"}
                  </h4>
                  <div className="flex gap-4">
                    <div className="px-4 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                      PASS: {phase55Result.pass}
                    </div>
                    <div className={`px-4 py-1 rounded-full text-xs font-bold ${phase55Result.fail > 0 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>
                      FAIL: {phase55Result.fail}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {phase55Result.results.map((r: any, i: number) => (
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
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{r.name}</span>
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

        {activeTab === "LIFECYCLE_TRACKER" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="bg-white dark:bg-slate-800 rounded-3xl p-20 text-center border border-slate-100 dark:border-slate-700 shadow-sm">
                <History className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                <h4 className="font-bold text-slate-900 dark:text-white">{isAr ? "متتبع دورة حياة المعاملة" : "Transaction Lifecycle Tracker"}</h4>
                <p className="text-slate-500 text-sm max-w-sm mx-auto mt-2">
                  {isAr ? "أدخل رقم المعاملة لتتبع حركتها من الإنشاء وحتى الأستاذ العام" : "Enter transaction ID to track its path from creation to General Ledger"}
                </p>
                <div className="mt-8 max-w-xs mx-auto relative">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                   <input type="text" placeholder="TX-123456..." className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm" />
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
