import React, { useMemo } from "react";
import {
  Clock,
  Filter,
  Download,
  Printer,
  ChevronRight,
  AlertTriangle,
  Calendar,
  Building2,
  User,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";

export const AgingEngineView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { tenants, properties, leases, getTenantReceivablePosition } = useData();

  const agingReport = useMemo(() => {
    return tenants
      .map(t => {
        const pos = getTenantReceivablePosition(t.id);
        const activeLease = leases.find(l => l.tenantId === t.id && (l.contractStatus === "ACTIVE" || l.contractStatus === "RENEWED"));
        const property = activeLease ? properties.find(p => p.id === activeLease.propertyId) : null;
        
        return {
          ...pos,
          tenant: t,
          lease: activeLease,
          property
        };
      })
      .filter(p => p.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [tenants, getTenantReceivablePosition, leases, properties]);

  const totals = useMemo(() => {
    return agingReport.reduce((acc, p) => ({
      current: acc.current + p.aging.current,
      d1_30: acc.d1_30 + p.aging.days1_30,
      d31_60: acc.d31_60 + p.aging.days31_60,
      d61_90: acc.d61_90 + p.aging.days61_90,
      d91_120: acc.d91_120 + p.aging.days91_120,
      d121Plus: acc.d121Plus + p.aging.days121Plus,
      total: acc.total + p.outstanding,
    }), { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d91_120: 0, d121Plus: 0, total: 0 });
  }, [agingReport]);

  return (
    <div className="space-y-6">
      {/* Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
        {[
          { label: isAr ? "حالي" : "Current", val: totals.current, color: "emerald" },
          { label: "1-30", val: totals.d1_30, color: "amber" },
          { label: "31-60", val: totals.d31_60, color: "orange" },
          { label: "61-90", val: totals.d61_90, color: "rose" },
          { label: "91-120", val: totals.d91_120, color: "rose" },
          { label: "121+", val: totals.d121Plus, color: "rose" },
          { label: isAr ? "الإجمالي" : "Total", val: totals.total, color: "slate", bold: true },
        ].map((item, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className={`text-[10px] font-bold uppercase ${item.bold ? "text-slate-900 dark:text-white" : `text-${item.color}-600`}`}>{item.label}</div>
            <div className={`text-sm font-bold mt-1 ${item.bold ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}>
              {item.val.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            <span>{isAr ? "تحليل أعمار ذمم المستأجرين" : "Tenant Aging Analysis"}</span>
          </h3>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all">
              <Printer className="w-4 h-4" />
              <span>{isAr ? "طباعة" : "Print"}</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/10">
              <Download className="w-4 h-4" />
              <span>{isAr ? "تصدير Excel" : "Export Excel"}</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left rtl:text-right">
            <thead className="text-[10px] uppercase font-bold text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">{isAr ? "المستأجر / العقار" : "Tenant / Property"}</th>
                <th className="px-6 py-4 text-center">{isAr ? "حالي" : "Current"}</th>
                <th className="px-6 py-4 text-center">1-30</th>
                <th className="px-6 py-4 text-center">31-60</th>
                <th className="px-6 py-4 text-center">61-90</th>
                <th className="px-6 py-4 text-center">91-120</th>
                <th className="px-6 py-4 text-center">121+</th>
                <th className="px-6 py-4 text-right">{isAr ? "الإجمالي" : "Total"}</th>
                <th className="px-6 py-4 text-center">{isAr ? "الحالة" : "Status"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {agingReport.map((p) => (
                <tr key={p.tenantId} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{isAr ? p.tenant.nameAr : p.tenant.nameEn}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3" />
                          <span>{p.property ? (isAr ? p.property.nameAr : p.property.nameEn) : "---"}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-xs">{p.aging.current > 0 ? p.aging.current.toLocaleString() : "-"}</td>
                  <td className="px-6 py-4 text-center font-mono text-xs text-amber-600">{p.aging.days1_30 > 0 ? p.aging.days1_30.toLocaleString() : "-"}</td>
                  <td className="px-6 py-4 text-center font-mono text-xs text-orange-600">{p.aging.days31_60 > 0 ? p.aging.days31_60.toLocaleString() : "-"}</td>
                  <td className="px-6 py-4 text-center font-mono text-xs text-rose-500">{p.aging.days61_90 > 0 ? p.aging.days61_90.toLocaleString() : "-"}</td>
                  <td className="px-6 py-4 text-center font-mono text-xs text-rose-600">{p.aging.days91_120 > 0 ? p.aging.days91_120.toLocaleString() : "-"}</td>
                  <td className="px-6 py-4 text-center font-mono text-xs text-rose-900 font-bold">{p.aging.days121Plus > 0 ? p.aging.days121Plus.toLocaleString() : "-"}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                    {p.outstanding.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                       <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                         p.priority === "CRITICAL" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400" :
                         p.priority === "HIGH" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" :
                         "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                       }`}>
                         {p.priority}
                       </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 dark:bg-slate-900/80 font-bold border-t border-slate-200 dark:border-slate-700">
               <tr>
                 <td className="px-6 py-4 text-slate-900 dark:text-white">{isAr ? "الإجمالي الكلي" : "Grand Total"}</td>
                 <td className="px-6 py-4 text-center font-mono text-xs">{totals.current.toLocaleString()}</td>
                 <td className="px-6 py-4 text-center font-mono text-xs">{totals.d1_30.toLocaleString()}</td>
                 <td className="px-6 py-4 text-center font-mono text-xs">{totals.d31_60.toLocaleString()}</td>
                 <td className="px-6 py-4 text-center font-mono text-xs">{totals.d61_90.toLocaleString()}</td>
                 <td className="px-6 py-4 text-center font-mono text-xs">{totals.d91_120.toLocaleString()}</td>
                 <td className="px-6 py-4 text-center font-mono text-xs">{totals.d121Plus.toLocaleString()}</td>
                 <td className="px-6 py-4 text-right text-emerald-600 font-mono">{totals.total.toLocaleString()}</td>
                 <td className="px-6 py-4"></td>
               </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
