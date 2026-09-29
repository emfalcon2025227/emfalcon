import React, { useState, useMemo } from "react";
import {
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Search,
  Printer,
  FileSpreadsheet,
  Building2,
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  RefreshCw,
  FileText
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { getApplicableVatRate } from "../../services/financialEngine";
import { runPhase7AReconEngine } from "../../utils/phase7AReconEngine";
import { OfficePrintHeader } from "../common/OfficePrintHeader";

export const DailyCashReconciliationView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const {
    collections = [],
    commissions = [],
    ownerTransfers = [],
    propertyExpenses = [],
    financialReversals = [],
    vatRates = [],
  } = useData();

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [actualClosingInput, setActualClosingInput] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"summary" | "details" | "invariants" | "tests">("summary");

  // Run Phase 7A Reconciliation Engine
  const reconReport = useMemo(() => {
    const actualClosing = actualClosingInput !== "" ? parseFloat(actualClosingInput) : undefined;
    return runPhase7AReconEngine({
      collections,
      commissions,
      ownerTransfers,
      propertyExpenses,
      financialReversals,
      openingBalance,
      actualClosingBalance: actualClosing,
      vatRates,
    });
  }, [collections, commissions, ownerTransfers, propertyExpenses, financialReversals, openingBalance, actualClosingInput]);

  const {
    summary = {
      status: "PASS",
      totalCollections: 0,
      rentCollections: 0,
      administrativeFees: 0,
      bouncedChequePenalties: 0,
      ownerTransfers: 0,
      expenses: 0,
      expectedClosing: 0,
      difference: 0,
      total: 0,
      passed: 0,
      failed: 0,
    },
    items = [],
    invariantChecks = [],
    testResults = [],
  } = reconReport || {};

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Printable Header with Office Logo and Name */}
      <OfficePrintHeader
        titleAr="تقرير المطابقة اليومية للنقدية والبنوك"
        titleEn="DAILY CASH & BANK RECONCILIATION REPORT"
        hideOnScreen={true}
      />

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-500/25 relative overflow-hidden print:hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold">
              <Scale className="w-4 h-4" />
              <span>{isAr ? "المرحلة 7أ — المطابقة المالية اليومية والنقدية" : "Phase 7A — Daily Cash & Bank Reconciliation"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {isAr ? "المطابقة اليومية للنقدية والبنوك" : "Daily Cash & Bank Reconciliation Engine"}
            </h1>
            <p className="text-xs text-slate-300 max-w-xl">
              {isAr
                ? "إجراء مطابقة متقدمة وشاملة بين الإيرادات النقدية، الرسوم الإدارية، ضريبة المخرجات على أساس الاستحقاق، حوالات الملاك، والمصروفات بدقة متناهية ودون تداخل."
                : "Comprehensive daily reconciliation separating cash inflows, net revenue, accrual VAT, owner transfers, and expenses."}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition flex items-center gap-2"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>{isAr ? "طباعة التقرير" : "Print Report"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab("summary")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "summary"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          {isAr ? "ملخص المطابقة اليومية" : "Reconciliation Summary"}
        </button>
        <button
          onClick={() => setActiveTab("details")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "details"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          {isAr ? "تفاصيل الحركات النقدية" : "Detailed Ledger Items"}
        </button>
        <button
          onClick={() => setActiveTab("invariants")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "invariants"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          {isAr ? "التحقق من الثوابت المالية (Invariants)" : "Financial Invariants"}
        </button>
        <button
          onClick={() => setActiveTab("tests")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "tests"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          {isAr ? "نتائج اختبارات المرحلة 7أ" : "Phase 7A Test Suite"}
        </button>
      </div>

      {/* TAB 1: SUMMARY */}
      {activeTab === "summary" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Reconciliation Card */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-slate-900 text-base">
                  {isAr ? "بيان المطابقة النقدية والبنكية (Daily Cash Flow)" : "Daily Cash & Bank Reconciliation Statement"}
                </h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                summary.status === "PASS"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}>
                {summary.status === "PASS" ? (isAr ? "مطابق تماماً (RECONCILED)" : "RECONCILED") : (isAr ? "يوجد فرق (CRITICAL)" : "DIFFERENCE DETECTED")}
              </span>
            </div>

            <div className="space-y-3 text-xs font-medium">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">{isAr ? "الرصيد الافتتاحي (Opening Balance):" : "Opening Balance:"}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                    className="w-28 px-2 py-1 border rounded-lg text-right font-mono text-xs"
                  />
                  <span className="font-mono font-bold text-slate-800">AED</span>
                </div>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-100 text-emerald-700 font-bold bg-emerald-50/40 px-3 rounded-xl">
                <span>+ {isAr ? "إجمالي التحصيلات النقدية والبنكية:" : "Total Collections Inflow:"}</span>
                <span className="font-mono">AED {(summary?.totalCollections ?? 0).toLocaleString()}</span>
              </div>
              <div className="pr-4 space-y-1 text-slate-600 text-[11px]">
                <div className="flex justify-between">
                  <span>• {isAr ? "إيجارات محصلة:" : "Rent Collections:"}</span>
                  <span className="font-mono">AED {(summary?.rentCollections ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• {isAr ? "رسوم إدارية محصلة (شاملة الضريبة):" : "Administrative Fees (Gross):"}</span>
                  <span className="font-mono">AED {(summary?.administrativeFees ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• {isAr ? "غرامات شيكات راجعة:" : "Bounced Cheque Penalties:"}</span>
                  <span className="font-mono">AED {(summary?.bouncedChequePenalties ?? 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-100 text-rose-600 font-bold bg-rose-50/40 px-3 rounded-xl">
                <span>- {isAr ? "حوالات ومستحقات الملاك الصادرة:" : "Owner Payout Transfers:"}</span>
                <span className="font-mono">AED {(summary?.ownerTransfers ?? 0).toLocaleString()}</span>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-100 text-rose-600 font-bold bg-rose-50/40 px-3 rounded-xl">
                <span>- {isAr ? "مصروفات وتشغيل العقارات:" : "Property Expenses Paid:"}</span>
                <span className="font-mono">AED {(summary?.expenses ?? 0).toLocaleString()}</span>
              </div>

              <div className="flex justify-between py-3 bg-slate-900 text-white px-4 rounded-2xl font-bold text-sm">
                <span>{isAr ? "الرصيد الختامي المتوقع (Expected Closing):" : "Expected Closing Cash:"}</span>
                <span className="font-mono text-emerald-400">AED {(summary?.expectedClosing ?? 0).toLocaleString()}</span>
              </div>

              <div className="flex justify-between py-2 items-center bg-slate-50 px-4 rounded-xl border">
                <span className="font-bold text-slate-700">{isAr ? "الرصيد الختامي الفعلي بالبنك (Actual Closing):" : "Actual Closing Cash (Bank):"}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={actualClosingInput}
                    placeholder={(summary?.expectedClosing ?? 0).toString()}
                    onChange={(e) => setActualClosingInput(e.target.value)}
                    className="w-32 px-3 py-1.5 border rounded-xl text-right font-mono font-bold text-xs"
                  />
                  <span className="font-mono font-bold text-slate-800">AED</span>
                </div>
              </div>

              <div className={`flex justify-between py-3 px-4 rounded-2xl font-bold ${
                (summary?.difference ?? 0) === 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
              }`}>
                <span>{isAr ? "الفرق (Difference):" : "Difference / Variance:"}</span>
                <span className="font-mono">AED {(summary?.difference ?? 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Right Side: VAT & Revenue Split Panel */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="flex items-center gap-2 border-b pb-3">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-slate-900 text-sm">
                  {isAr ? "فصل النقدية عن الإيراد والضريبة" : "Cash vs Revenue vs VAT Breakdown"}
                </h3>
              </div>

              <p className="text-[11px] text-slate-500">
                {isAr
                  ? "قاعدة أساسية: الرسوم الإدارية المحصلة تدخل البنك بكامل قيمتها الإجمالية (Gross)، بينما يوزع النظام الدفترية تلقائياً بين الإيراد الصافي (Net) والتزام ضريبة المخرجات (Accrual VAT)."
                  : "Rule: Gross admin fee enters cash in full. System automatically separates Net Revenue and Accrual Output VAT."}
              </p>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-1">
                  <span className="text-[10px] font-bold text-indigo-600 block">{isAr ? "إجمالي النقدية المحصلة من الرسوم" : "Gross Cash Collected"}</span>
                  <div className="text-lg font-black text-slate-900 font-mono">AED {(summary?.administrativeFees ?? 0).toLocaleString()}</div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
                  <span className="text-[10px] font-bold text-emerald-600 block">{isAr ? "صافي الإيراد الدفتري (Office Revenue)" : "Net Office Revenue"}</span>
                  {(() => {
                    const vRate = getApplicableVatRate(new Date().toISOString(), vatRates, "ADMIN_FEE");
                    const net = (summary?.administrativeFees ?? 0) / (1 + vRate / 100);
                    return (
                      <div className="text-lg font-black text-emerald-700 font-mono">AED {(net || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    );
                  })()}
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-1">
                  <span className="text-[10px] font-bold text-amber-600 block">{isAr ? "التزام ضريبة المخرجات (Accrual VAT)" : "Output VAT Liability (Accrual)"}</span>
                  {(() => {
                    const vRate = getApplicableVatRate(new Date().toISOString(), vatRates, "ADMIN_FEE");
                    const net = (summary?.administrativeFees ?? 0) / (1 + vRate / 100);
                    const vat = (summary?.administrativeFees ?? 0) - net;
                    return (
                      <div className="text-lg font-black text-amber-700 font-mono">AED {(vat || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DETAILS */}
      {activeTab === "details" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">
              {isAr ? "تفصيل حركات المقبوضات والتحصيلات النشطة" : "Active Collections Ledger Detail"}
            </h3>
            <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">
              {items.length} {isAr ? "حركة" : "records"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <th className="py-3 px-4">{isAr ? "التاريخ والرجع" : "Date & Ref"}</th>
                  <th className="py-3 px-4">{isAr ? "نوع الحركة" : "Type"}</th>
                  <th className="py-3 px-4">{isAr ? "الطرف / الدافع" : "Party / Payer"}</th>
                  <th className="py-3 px-4 text-left">{isAr ? "الإجمالي (Gross)" : "Gross"}</th>
                  <th className="py-3 px-4 text-left">{isAr ? "الصافي (Net)" : "Net"}</th>
                  <th className="py-3 px-4 text-left">{isAr ? "الضريبة (VAT)" : "VAT"}</th>
                  <th className="py-3 px-4 text-left">{isAr ? "النقدية الفعلية (Cash)" : "Cash Inflow"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      {isAr ? "لا توجد تحصيلات مسجلة بعد." : "No collection records found."}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-900 block">{item.date}</span>
                        <span className="text-[10px] text-slate-400 font-mono">Ref: {item.reference}</span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {item.transactionType}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {item.party}
                      </td>
                      <td className="py-3 px-4 text-left font-mono font-bold">
                        AED {(item.gross ?? 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-left font-mono text-emerald-700 font-semibold">
                        AED {(item.net ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-left font-mono text-amber-600 font-semibold">
                        AED {(item.vat ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-left font-mono font-black text-slate-900">
                        AED {(item.cash ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INVARIANTS */}
      {activeTab === "invariants" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="font-black text-slate-900 text-sm">
              {isAr ? "التحقق من الثوابت المالية الصارمة (Master Financial Invariants)" : "Master Financial Invariants Verification"}
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            {invariantChecks.map((inv, idx) => (
              <div key={idx} className="p-4 bg-slate-50 border rounded-2xl flex items-center justify-between">
                <div className="space-y-1">
                  <strong className="text-slate-900 text-sm block">{inv.name}</strong>
                  <div className="text-slate-500 font-mono text-[11px]">
                    Expected: {inv.expected} | Actual: {inv.actual}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  inv.status === "PASS" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                }`}>
                  {inv.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: TESTS */}
      {activeTab === "tests" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <RefreshCw className="w-5 h-5 text-emerald-600" />
            <h3 className="font-black text-slate-900 text-sm">
              {isAr ? "نتائج اختبارات المطابقة والتحقق (Phase 7A Test Suite)" : "Phase 7A Test Suite Results"}
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            {testResults.map((t, idx) => (
              <div key={idx} className="p-4 bg-slate-50 border rounded-2xl flex items-center justify-between">
                <div className="space-y-1">
                  <span className="font-mono font-bold text-emerald-700">{t.testId}</span>
                  <strong className="text-slate-900 block">{t.testName}</strong>
                  <span className="text-[11px] text-slate-500">Expected: {t.expected}</span>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
