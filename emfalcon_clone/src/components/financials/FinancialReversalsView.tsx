
import React, { useState, useMemo } from "react";
import { 
  RotateCcw, 
  Search, 
  Filter, 
  ArrowRightLeft, 
  History,
  Calendar,
  User,
  Building2,
  Tag,
  DollarSign,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Printer,
  FileSpreadsheet
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { FinancialReversalRecord } from "../../types";
import { OfficePrintHeader } from "../common/OfficePrintHeader";

export const FinancialReversalsView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const {
    financialReversals = [],
    owners = [],
    tenants = [],
    properties = [],
    leases = [],
    collections = [],
    commissions = [],
    propertyExpenses = [],
    ownerTransfers = []
  } = useData();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReversalId, setSelectedReversalId] = useState<string | null>(null);

  const filteredReversals = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return financialReversals.filter(r => 
      (r.reversalNumber && r.reversalNumber.toLowerCase().includes(q)) ||
      (r.reason && r.reason.toLowerCase().includes(q)) ||
      (r.performedByUserName && r.performedByUserName.toLowerCase().includes(q)) ||
      (r.targetId && r.targetId.toLowerCase().includes(q))
    );
  }, [financialReversals, searchQuery]);

  const selectedReversal = useMemo(() => 
    financialReversals.find(r => r.id === selectedReversalId),
    [financialReversals, selectedReversalId]
  );

  const handlePrint = () => window.print();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Sidebar: Reversal List */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="relative">
            <Search className="absolute left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={isAr ? "بحث في العمليات الملغاة..." : "Search reversals..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 rtl:pr-9 rtl:pl-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              {isAr ? "تاريخ الإلغاءات" : "Reversal History"}
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[600px] overflow-y-auto">
            {filteredReversals.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedReversalId(r.id)}
                className={`w-full p-4 text-right rtl:text-right hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors flex items-start justify-between ${
                  selectedReversalId === r.id ? "bg-indigo-50/50 dark:bg-indigo-900/20 border-r-4 border-indigo-600" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-slate-900 dark:text-white mb-1">{r.reversalNumber}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                    <RotateCcw className="w-3 h-3" />
                    {r.targetType}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-2 line-clamp-1">{r.reason}</div>
                </div>
                <div className="text-left rtl:text-right ml-4">
                  <div className="text-xs font-mono font-bold text-rose-600">-{r.reversedAmount.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{r.reversalDate}</div>
                </div>
              </button>
            ))}
            {filteredReversals.length === 0 && (
              <div className="p-12 text-center text-slate-400 italic text-xs">
                {isAr ? "لا توجد عمليات إلغاء مطابقة" : "No matching reversals found"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Panel: Detail View */}
      <div className="lg:col-span-2">
        {selectedReversal ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <OfficePrintHeader
              titleAr={`سند قيد إلغاء مالي (${selectedReversal.reversalNumber})`}
              titleEn={`FINANCIAL REVERSAL VOUCHER (${selectedReversal.reversalNumber})`}
              subtitleAr={`المرجع: ${selectedReversal.targetId} | التاريخ: ${selectedReversal.reversalDate}`}
              subtitleEn={`Ref: ${selectedReversal.targetId} | Date: ${selectedReversal.reversalDate}`}
              hideOnScreen={true}
              extraInfo={[
                { labelAr: "المبلغ الأصلي", labelEn: "Original Amount", value: `AED ${selectedReversal.originalAmount.toLocaleString()}` },
                { labelAr: "المبلغ الملغى", labelEn: "Reversed Amount", value: `AED ${selectedReversal.reversedAmount.toLocaleString()}` },
                { labelAr: "نوع العملية", labelEn: "Source Type", value: selectedReversal.targetType },
              ]}
            />

            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between print:hidden">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <RotateCcw className="w-6 h-6 text-rose-600" />
                  {selectedReversal.reversalNumber}
                </h2>
                <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">
                  {isAr ? "تفاصيل عملية الإلغاء المالي" : "Financial Reversal Audit Details"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handlePrint} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors">
                  <Printer className="w-5 h-5" />
                </button>
                <div className="px-3 py-1 bg-rose-50 dark:bg-rose-900/20 text-rose-600 text-[10px] font-black rounded-lg border border-rose-100 dark:border-rose-900/50 uppercase">
                  {isAr ? "تم الإلغاء" : "REVERSED"}
                </div>
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "المبلغ الأصلي" : "Original Amount"}</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white font-mono">{selectedReversal.originalAmount.toLocaleString()} <span className="text-xs font-normal opacity-50">AED</span></div>
                </div>
                <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-xl border border-rose-100 dark:border-rose-800/50">
                  <div className="text-[10px] font-bold text-rose-400 uppercase mb-1">{isAr ? "المبلغ الملغى" : "Reversed Amount"}</div>
                  <div className="text-lg font-black text-rose-600 font-mono">-{selectedReversal.reversedAmount.toLocaleString()} <span className="text-xs font-normal opacity-50">AED</span></div>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                  <div className="text-[10px] font-bold text-indigo-400 uppercase mb-1">{isAr ? "الرصيد المتبقي" : "Net Balance"}</div>
                  <div className="text-lg font-black text-indigo-600 font-mono">{(selectedReversal.originalAmount - selectedReversal.reversedAmount).toLocaleString()} <span className="text-xs font-normal opacity-50">AED</span></div>
                </div>
              </div>

              {/* Detail Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                      <History className="w-4 h-4 text-indigo-600" />
                      {isAr ? "بيانات العملية الأصلية" : "Original Transaction"}
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">{isAr ? "المرجع:" : "Reference:"}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{selectedReversal.targetId}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">{isAr ? "نوع العملية:" : "Source Type:"}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{selectedReversal.targetType}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">{isAr ? "تاريخ العملية:" : "Original Date:"}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{selectedReversal.reversalDate}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                      <User className="w-4 h-4 text-indigo-600" />
                      {isAr ? "التدقيق والاعتماد" : "Audit & Approval"}
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">{isAr ? "بواسطة:" : "Performed By:"}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{selectedReversal.performedByUserName}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">{isAr ? "رقم المستخدم:" : "User ID:"}</span>
                        <span className="font-mono text-slate-500">{selectedReversal.performedByUserId}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">{isAr ? "وقت العملية:" : "Timestamp:"}</span>
                        <span className="text-slate-500">{new Date(selectedReversal.reversalTimestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      {isAr ? "سبب الإلغاء" : "Reversal Reason"}
                    </h4>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic">
                      "{selectedReversal.reason}"
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                      <ExternalLink className="w-4 h-4 text-indigo-600" />
                      {isAr ? "الارتباطات النظامية" : "System Links"}
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                       <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg flex flex-col">
                         <span className="text-[10px] text-slate-400 uppercase">Entity</span>
                         <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Property Ledger</span>
                       </div>
                       <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg flex flex-col">
                         <span className="text-[10px] text-slate-400 uppercase">Ledger Effect</span>
                         <span className="text-xs font-bold text-emerald-600">Credit Restored</span>
                       </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning box */}
              <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl flex gap-3">
                 <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                 <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                   {isAr 
                     ? "تنبيه: هذه العملية محاسبية نهائية وتم عكس تأثيرها المالي على كافة أرصدة الملاك والمستأجرين المرتبطة. لا يمكن استرجاع هذه العملية بعد الإلغاء."
                     : "Notice: This is a final accounting reversal. Its financial impact has been rolled back across all linked owner and tenant balances. This action is irreversible."}
                 </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm flex items-center justify-center mb-4">
              <RotateCcw className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              {isAr ? "حدد عملية إلغاء للمعاينة" : "Select a Reversal to Preview"}
            </h3>
            <p className="text-xs text-slate-400 max-w-xs uppercase tracking-widest font-bold">
              {isAr ? "اختر من القائمة الجانبية لعرض التدقيق المالي الكامل" : "Choose from the sidebar to view full financial audit details"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
