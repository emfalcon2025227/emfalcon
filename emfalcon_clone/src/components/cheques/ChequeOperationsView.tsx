import React, { useState, useEffect, useMemo } from "react";
import {
  CreditCard,
  AlertTriangle,
  Layers,
  History,
  CheckCircle2,
  Calendar,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { Cheque } from "../../types";
import { isBouncedWithoutLegalAction, isChequeInActiveCase } from "../../utils/chequeUtils";
import { PDCChequesView } from "./PDCChequesView";
import { ChequesView } from "./ChequesView";
import { AllChequesView } from "./AllChequesView";

export type ChequeOperationsTab = "PDC" | "RETURNED" | "ALL";

interface ChequeOperationsViewProps {
  initialTab?: ChequeOperationsTab;
  onOpenCollectionModal?: (cheque: Cheque) => void;
  onOpenConvertToCaseModal?: (chequeIds: string[]) => void;
}

export const ChequeOperationsView: React.FC<ChequeOperationsViewProps> = ({
  initialTab = "PDC",
  onOpenCollectionModal,
  onOpenConvertToCaseModal,
}) => {
  const { language, t } = useLanguage();
  const isAr = language === "ar";
  const { cheques, cases } = useData();

  // Active Tab State — defaults to "PDC" (الشيكات الآجلة)
  const [activeTab, setActiveTab] = useState<ChequeOperationsTab>(initialTab);

  // Sync with initialTab if it changes from outside navigation
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Operational Counts
  const bouncedActiveCount = useMemo(() => {
    return cheques.filter((c) => isBouncedWithoutLegalAction(c, cases)).length;
  }, [cheques, cases]);

  const activePdcCount = useMemo(() => {
    return cheques.filter((c) => {
      if (c.status !== "POST_DATED" && c.status !== "PENDING" && c.status !== "DEPOSITED") return false;
      if (isChequeInActiveCase(c, cases)) return false;
      return (c.outstanding ?? c.amount) > 0;
    }).length;
  }, [cheques, cases]);

  const totalChequesCount = cheques.length;

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Navigation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-slate-900 text-white dark:bg-emerald-600 shadow-xs">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{isAr ? "عمليات الشيكات" : "Cheque Operations"}</span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isAr
                    ? "المركز التشغيلي الموحد لإدارة الشيكات الآجلة، تسوية المرتجعات، وتدقيق السجل الشامل"
                    : "Unified operational hub for PDC handling, bounced cheque settlement, and full audit ledger"}
                </p>
              </div>
            </div>
          </div>

          {/* 3 Dedicated Tabs Switcher */}
          <div className="flex items-center p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/60 self-start md:self-auto shadow-inner">
            {/* Tab 1: الشيكات الآجلة (PDC Cheques) */}
            <button
              onClick={() => setActiveTab("PDC")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "PDC"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700/60"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>{isAr ? "الشيكات الآجلة" : "PDC Cheques"}</span>
              {activePdcCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                    activeTab === "PDC"
                      ? "bg-white/20 text-white"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  }`}
                >
                  {activePdcCount}
                </span>
              )}
            </button>

            {/* Tab 2: الشيكات المرتجعة (Returned Cheques) */}
            <button
              onClick={() => setActiveTab("RETURNED")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "RETURNED"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700/60"
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>{isAr ? "الشيكات المرتجعة" : "Returned Cheques"}</span>
              {bouncedActiveCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                    activeTab === "RETURNED"
                      ? "bg-white/20 text-white"
                      : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 animate-pulse"
                  }`}
                >
                  {bouncedActiveCount}
                </span>
              )}
            </button>

            {/* Tab 3: سجل الشيكات الشامل (All Cheques Register) */}
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "ALL"
                  ? "bg-slate-900 text-white dark:bg-indigo-600 shadow-xs"
                  : "text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700/60"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{isAr ? "سجل الشيكات الشامل" : "All Cheques Register"}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                  activeTab === "ALL"
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300"
                }`}
              >
                {totalChequesCount}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: الشيكات الآجلة (PDC Cheques View) */}
      {activeTab === "PDC" && (
        <PDCChequesView
          onNavigateToReturnedCheques={() => setActiveTab("RETURNED")}
          onNavigateToAllCheques={() => setActiveTab("ALL")}
        />
      )}

      {/* Tab 2: الشيكات المرتجعة (Returned Cheques View) */}
      {activeTab === "RETURNED" && (
        <ChequesView
          bouncedOnly={true}
          onOpenCollectionModal={onOpenCollectionModal}
          onOpenConvertToCaseModal={onOpenConvertToCaseModal}
        />
      )}

      {/* Tab 3: سجل الشيكات الشامل (All Cheques Audit Register) */}
      {activeTab === "ALL" && (
        <AllChequesView
          onNavigateToPDC={() => setActiveTab("PDC")}
          onNavigateToReturned={() => setActiveTab("RETURNED")}
        />
      )}
    </div>
  );
};
