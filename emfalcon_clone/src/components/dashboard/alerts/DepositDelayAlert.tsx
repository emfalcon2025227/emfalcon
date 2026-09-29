import React, { useMemo, useState, useEffect } from "react";
import { AlertTriangle, Clock, ChevronRight, AlertCircle, Eye, RefreshCw } from "lucide-react";
import { useData } from "../../../context/DataContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useNavigation } from "../../../context/NavigationContext";
import { useAuth } from "../../../context/AuthContext";
import { motion, AnimatePresence } from "motion/react";

export interface DelayedDepositItem {
  id: string;
  transactionId: string;
  type: string;
  amount: number;
  createdAt: string;
  elapsedHours: number;
  elapsedMs: number;
  ownerName: string;
  tenantName: string;
  propertyName: string;
  unitId: string;
  contractId: string;
  fundType: "OFFICE" | "OWNER";
  status: string;
  isCritical: boolean;
  originalRecord: any;
}

export const DepositDelayAlert: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { navigateTo } = useNavigation();
  const { hasPermission } = useAuth();
  
  const {
    ownerTransfers,
    propertyExpenses,
    commissions,
    dailyDeposits,
    owners,
    properties,
    units,
    tenants,
  } = useData();

  const [now, setNow] = useState(Date.now());
  const [showRecords, setShowRecords] = useState(false);

  useEffect(() => {
    // Update every minute for performance
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const delayedItems = useMemo(() => {
    const items: DelayedDepositItem[] = [];

    const getOwnerName = (id?: string) => {
      const o = owners.find((x) => x.id === id);
      return o ? (isAr ? o.nameAr : o.nameEn) : (isAr ? "غير معروف" : "Unknown");
    };
    const getTenantName = (id?: string) => {
      const t = tenants.find((x) => x.id === id);
      return t ? (isAr ? t.nameAr : t.nameEn) : (isAr ? "غير محدد" : "N/A");
    };
    const getPropertyName = (id?: string) => {
      const p = properties.find((x) => x.id === id);
      return p ? (isAr ? p.nameAr : p.nameEn) : (isAr ? "غير محدد" : "N/A");
    };

    // 1. Owner Transfers (Owner Funds)
    ownerTransfers.forEach((t) => {
      if (t.status === "PAID" || t.status === "CANCELLED" || t.status === "REVERSED" || t.status === "RECONCILED") return;

      const createdTime = new Date(t.createdAt).getTime();
      const elapsedMs = now - createdTime;
      const elapsedHours = elapsedMs / (1000 * 60 * 60);

      if (elapsedHours >= 4) {
        items.push({
          id: t.id,
          transactionId: t.transferNumber,
          type: "Owner Transfer",
          amount: t.amount,
          createdAt: t.createdAt,
          elapsedHours,
          elapsedMs,
          ownerName: getOwnerName(t.ownerId),
          tenantName: "N/A",
          propertyName: getPropertyName(t.propertyId),
          unitId: t.unitId || "N/A",
          contractId: t.leaseId || "N/A",
          fundType: "OWNER",
          status: elapsedHours >= 24 ? "CRITICAL_DEPOSIT_DELAY" : "DEPOSIT_DELAYED",
          isCritical: elapsedHours >= 24,
          originalRecord: t,
        });
      }
    });

    // 2. Property Expenses (Office Funds)
    propertyExpenses.forEach((exp) => {
      if (exp.status === "PAID" || exp.status === "CANCELLED" || exp.status === "REVERSED") return;

      const createdTime = new Date(exp.createdAt).getTime();
      const elapsedMs = now - createdTime;
      const elapsedHours = elapsedMs / (1000 * 60 * 60);

      if (elapsedHours >= 4) {
        items.push({
          id: exp.id,
          transactionId: exp.expenseNumber || `EXP-${exp.id.slice(-6)}`,
          type: exp.category,
          amount: exp.amount,
          createdAt: exp.createdAt,
          elapsedHours,
          elapsedMs,
          ownerName: getOwnerName(exp.ownerId),
          tenantName: getTenantName(exp.tenantId),
          propertyName: getPropertyName(exp.propertyId),
          unitId: exp.unitId || "N/A",
          contractId: exp.leaseId || "N/A",
          fundType: "OFFICE",
          status: elapsedHours >= 24 ? "CRITICAL_DEPOSIT_DELAY" : "DEPOSIT_DELAYED",
          isCritical: elapsedHours >= 24,
          originalRecord: exp,
        });
      }
    });

    // 3. Commissions (Office Funds)
    commissions.forEach((c) => {
      if (c.status !== "COLLECTED" && c.status !== "FULLY_COLLECTED") return;

      const isDeposited = dailyDeposits.some((d) => d.sourceId === c.id);
      if (isDeposited) return;

      const createdTime = new Date(c.createdAt).getTime();
      const elapsedMs = now - createdTime;
      const elapsedHours = elapsedMs / (1000 * 60 * 60);

      if (elapsedHours >= 4) {
        items.push({
          id: c.id,
          transactionId: c.businessKey || `COMM-${c.id.slice(-6)}`,
          type: "Commission",
          amount: c.collectedAmount || c.baseAmount,
          createdAt: c.createdAt,
          elapsedHours,
          elapsedMs,
          ownerName: getOwnerName(c.ownerId),
          tenantName: getTenantName(c.tenantId),
          propertyName: getPropertyName(c.propertyId),
          unitId: c.unitId || "N/A",
          contractId: c.leaseId || "N/A",
          fundType: "OFFICE",
          status: elapsedHours >= 24 ? "CRITICAL_DEPOSIT_DELAY" : "DEPOSIT_DELAYED",
          isCritical: elapsedHours >= 24,
          originalRecord: c,
        });
      }
    });

    return items.sort((a, b) => b.elapsedMs - a.elapsedMs);
  }, [ownerTransfers, propertyExpenses, commissions, dailyDeposits, owners, properties, units, tenants, now, isAr]);

  if (!hasPermission("VIEW_FINANCIALS") && !hasPermission("MANAGE_FINANCIALS")) return null;
  if (delayedItems.length === 0) return null;

  const criticalItems = delayedItems.filter((i) => i.isCritical);
  const isCritical = criticalItems.length > 0;
  
  const officeDelayed = delayedItems.filter(i => i.fundType === "OFFICE");
  const ownerDelayed = delayedItems.filter(i => i.fundType === "OWNER");

  const formatWaitTime = (ms: number) => {
    const totalMins = Math.floor(ms / 60000);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  return (
    <div className="mb-6 space-y-4">
      {/* Alert Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-2xl border ${
          isCritical
            ? "bg-red-50/90 border-red-200 shadow-sm"
            : "bg-amber-50/90 border-amber-200 shadow-sm"
        }`}
      >
        <div
          className={`absolute left-0 top-0 bottom-0 w-1.5 ${
            isCritical ? "bg-red-500" : "bg-amber-500"
          } ${isCritical ? "animate-pulse" : ""}`}
        />
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-xl flex-shrink-0 ${
                isCritical ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
              }`}
            >
              {isCritical ? <AlertCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <h3
                className={`text-lg font-bold ${
                  isCritical ? "text-red-900" : "text-amber-900"
                }`}
              >
                {isCritical
                  ? (isAr ? "إيداعات حرجة" : "Critical Deposits")
                  : (isAr ? "تنبيه الإيداعات" : "Deposit Alert")}
              </h3>
              <p
                className={`mt-1 text-sm font-medium ${
                  isCritical ? "text-red-700" : "text-amber-700"
                }`}
              >
                {isAr
                  ? `توجد ${delayedItems.length} معاملات تجاوزت مدة ${isCritical ? "24" : "4"} ساعات دون إيداع.`
                  : `There are ${delayedItems.length} transactions exceeding ${isCritical ? "24" : "4"} hours without deposit.`}
              </p>
              
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5 bg-white/60 px-2.5 py-1 rounded-md text-xs font-semibold text-slate-700 border border-slate-200">
                  <span className="text-slate-500">{isAr ? "المكتب:" : "Office:"}</span>
                  <span className={officeDelayed.length > 0 ? "text-red-600" : ""}>{officeDelayed.length}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/60 px-2.5 py-1 rounded-md text-xs font-semibold text-slate-700 border border-slate-200">
                  <span className="text-slate-500">{isAr ? "الملاك:" : "Owners:"}</span>
                  <span className={ownerDelayed.length > 0 ? "text-red-600" : ""}>{ownerDelayed.length}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 w-full sm:w-auto">
            {isCritical && (
              <button
                onClick={() => navigateTo("FINANCIALS")}
                className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                {isAr ? "السجلات الحرجة" : "Critical Records"}
              </button>
            )}
            <button
              onClick={() => setShowRecords(!showRecords)}
              className={`w-full sm:w-auto px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                isCritical
                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                  : "bg-amber-600 text-white hover:bg-amber-700 shadow-sm"
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              {isAr ? "عرض السجلات" : "View Records"}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Expanded Records List */}
      <AnimatePresence>
        {showRecords && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{isAr ? "المعاملة" : "Transaction"}</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{isAr ? "الوقت المنقضي" : "Elapsed"}</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{isAr ? "الأطراف" : "Parties"}</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{isAr ? "العقار" : "Property"}</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{isAr ? "النوع" : "Fund"}</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">{isAr ? "إجراء" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {delayedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                              {item.type} — AED {item.amount.toLocaleString()}
                            </span>
                            <span className="text-xs text-slate-500 font-mono mt-0.5">{item.transactionId}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(item.createdAt).toLocaleString(isAr ? "ar-AE" : "en-AE", { timeZone: "Asia/Dubai" })}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${item.isCritical ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            <Clock className="w-3.5 h-3.5" />
                            {formatWaitTime(item.elapsedMs)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-slate-700"><span className="text-slate-400">{isAr ? "المالك:" : "Owner:"}</span> {item.ownerName}</span>
                            <span className="text-xs text-slate-700"><span className="text-slate-400">{isAr ? "المستأجر:" : "Tenant:"}</span> {item.tenantName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-slate-800">{item.propertyName}</span>
                            <span className="text-xs text-slate-500">{isAr ? "وحدة:" : "Unit:"} {item.unitId}</span>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">{item.contractId}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${item.fundType === 'OFFICE' ? 'bg-indigo-50 text-indigo-700' : 'bg-teal-50 text-teal-700'}`}>
                            {item.fundType === 'OFFICE' ? (isAr ? "أموال المكتب" : "Office Funds") : (isAr ? "أموال الملاك" : "Owner Funds")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => navigateTo("FINANCIALS")}
                            className="inline-flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          >
                            <ChevronRight className={`w-4 h-4 ${isAr ? "rotate-180" : ""}`} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
