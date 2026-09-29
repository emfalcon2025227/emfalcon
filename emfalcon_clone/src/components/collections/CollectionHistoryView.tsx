import React, { useMemo } from "react";
import {
  History,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";

export const CollectionHistoryView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { collectionActions, tenants, properties, leases } = useData();

  const sortedActions = useMemo(() => {
    return [...collectionActions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [collectionActions]);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-600" />
            <span>{isAr ? "سجل إجراءات التحصيل" : "Collection Action History"}</span>
          </h3>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all">
            <Download className="w-4 h-4" />
            <span>{isAr ? "تصدير التقرير" : "Export Report"}</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left rtl:text-right">
            <thead className="text-[10px] uppercase font-bold text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">{isAr ? "رقم الإجراء" : "Action #"}</th>
                <th className="px-6 py-4">{isAr ? "المستأجر" : "Tenant"}</th>
                <th className="px-6 py-4">{isAr ? "التاريخ" : "Date"}</th>
                <th className="px-6 py-4">{isAr ? "النوع" : "Type"}</th>
                <th className="px-6 py-4">{isAr ? "المديونية" : "Outstanding"}</th>
                <th className="px-6 py-4">{isAr ? "النتيجة" : "Result"}</th>
                <th className="px-6 py-4">{isAr ? "بواسطة" : "By"}</th>
                <th className="px-6 py-4">{isAr ? "الحالة" : "Status"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {sortedActions.map((action) => {
                const tenant = tenants.find(t => t.id === action.tenantId);
                return (
                  <tr key={action.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-emerald-600">{action.actionNumber}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white">{tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "---"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                       {new Date(action.actionDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-[10px] font-bold text-slate-400 uppercase">{action.actionType}</span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white">
                       {action.outstandingAtTime.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                       <div className="text-xs text-slate-600 dark:text-slate-300 truncate font-bold">{action.result}</div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center text-[10px] font-bold">
                             {action.assignedEmployeeName?.charAt(0)}
                          </div>
                          <span className="text-xs text-slate-600 dark:text-slate-400">{action.assignedEmployeeName}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          action.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" :
                          action.status === "FAILED" || action.status === "NO_RESPONSE" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400" :
                          "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                        }`}>
                          {action.status}
                        </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
