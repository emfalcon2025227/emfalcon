
import React, { useState, useMemo } from "react";
import { 
  Activity, ShieldCheck, Database, AlertTriangle, 
  CheckCircle2, Clock, History, Search, 
  Filter, FileText, AlertCircle, BarChart3,
  ShieldAlert, RefreshCcw
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { runContinuousFinancialHealthScan } from "../../utils/continuousFinancialIntegrityMonitor";
import { runContinuousDataIntegrityScan } from "../../utils/continuousDataIntegrityMonitor";
import { runAuditIntegrityScan } from "../../utils/auditIntegrityMonitor";
import { getProductionPerformanceSummary } from "../../utils/productionPerformanceMonitor";
import { runConfigurationDriftCheck } from "../../utils/productionConfigurationDriftMonitor";
import { ChequeBackgroundJobWidget } from "./ChequeBackgroundJobWidget";

export const ProductionMonitoringCenter: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const data = useData();

  const [lastScan, setLastScan] = useState<string>(new Date().toISOString());
  const [isScanning, setIsScanning] = useState(false);

  // Run scans
  const financialHealth = useMemo(() => runContinuousFinancialHealthScan(data), [data, lastScan]);
  const dataIntegrity = useMemo(() => runContinuousDataIntegrityScan(data), [data, lastScan]);
  const auditIntegrity = useMemo(() => runAuditIntegrityScan(data.archive), [data, lastScan]);
  const performanceMetrics = useMemo(() => getProductionPerformanceSummary(), [lastScan]);
  const configDrift = useMemo(() => runConfigurationDriftCheck(), [lastScan]);

  const handleRefresh = () => {
    setIsScanning(true);
    setTimeout(() => {
      setLastScan(new Date().toISOString());
      setIsScanning(false);
    }, 1000);
  };

  const getOverallStatus = () => {
    if (financialHealth.status === "CRITICAL" || dataIntegrity.status === "CRITICAL" || configDrift.status === "CRITICAL") return "CRITICAL";
    if (financialHealth.status === "WARNING" || dataIntegrity.status === "WARNING" || auditIntegrity.status === "WARNING") return "WARNING";
    return "HEALTHY";
  };

  const status = getOverallStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
            status === "HEALTHY" ? "bg-emerald-50 text-emerald-600" : 
            status === "WARNING" ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
          }`}>
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900">
              {isAr ? "مركز المراقبة المستمرة للإنتاج" : "Continuous Production Monitoring Center"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                status === "HEALTHY" ? "bg-emerald-100 text-emerald-800" : 
                status === "WARNING" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
              }`}>
                {status}
              </span>
              <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {isAr ? "آخر فحص:" : "Last scan:"} {new Date(lastScan).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isScanning}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all disabled:opacity-50 cursor-pointer"
        >
          <RefreshCcw className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
          {isAr ? "تحديث المراقبة" : "Refresh Monitoring"}
        </button>
      </div>

      {/* Main Grid */}
      <div className="space-y-6">
        <ChequeBackgroundJobWidget />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Financial Integrity */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">{isAr ? "النزاهة المالية" : "Financial Integrity"}</h3>
            <ShieldCheck className={`w-5 h-5 ${financialHealth.status === "HEALTHY" ? "text-emerald-500" : "text-amber-500"}`} />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">{isAr ? "الحالة:" : "Status:"}</span>
              <span className={`text-xs font-black ${financialHealth.status === "HEALTHY" ? "text-emerald-600" : "text-rose-600"}`}>{financialHealth.status}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">{isAr ? "الانحرافات المكتشفة:" : "Drifts detected:"}</span>
              <span className="text-xs font-black text-slate-900">{financialHealth.drifts.length}</span>
            </div>
          </div>
        </div>

        {/* Data Integrity */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">{isAr ? "سلامة البيانات" : "Data Integrity"}</h3>
            <Database className="w-5 h-5 text-blue-500" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">{isAr ? "نقاط السلامة:" : "Integrity Score:"}</span>
              <span className="text-xs font-black text-slate-900">{dataIntegrity.score}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">{isAr ? "الاستثناءات:" : "Exceptions:"}</span>
              <span className="text-xs font-black text-slate-900">{dataIntegrity.exceptions.length}</span>
            </div>
          </div>
        </div>

        {/* Performance Monitoring */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">{isAr ? "مراقبة الأداء" : "Performance"}</h3>
            <BarChart3 className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="space-y-2">
            {performanceMetrics.slice(0, 3).map((m, i) => (
              <div key={i} className="flex items-center justify-between text-[10px]">
                <span className="font-bold text-slate-500 truncate max-w-[140px]">{m.name}</span>
                <span className={`font-black ${m.status === "FAST" ? "text-emerald-500" : "text-amber-500"}`}>{m.durationMs}ms</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Issues Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900">{isAr ? "تنبيهات المراقبة النشطة" : "Active Monitoring Alerts"}</h3>
          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black">
            {financialHealth.drifts.length + dataIntegrity.exceptions.length} {isAr ? "تنبيه" : "Alerts"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold">
              <tr>
                <th className="py-3 px-6 text-start">{isAr ? "المعرف" : "ID"}</th>
                <th className="py-3 px-6 text-start">{isAr ? "الفئة" : "Category"}</th>
                <th className="py-3 px-6 text-start">{isAr ? "الوصف" : "Description"}</th>
                <th className="py-3 px-6 text-start">{isAr ? "الأولوية" : "Priority"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {financialHealth.drifts.map(d => (
                <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-6 font-mono font-bold text-slate-400">{d.id.split('-').pop()}</td>
                  <td className="py-3 px-6"><span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-[10px] font-bold uppercase">Financial</span></td>
                  <td className="py-3 px-6 text-slate-600">{d.description}</td>
                  <td className="py-3 px-6"><span className="text-rose-600 font-black">{d.severity}</span></td>
                </tr>
              ))}
              {dataIntegrity.exceptions.map(e => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-6 font-mono font-bold text-slate-400">{e.id.split('-').pop()}</td>
                  <td className="py-3 px-6"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold uppercase">Integrity</span></td>
                  <td className="py-3 px-6 text-slate-600">{e.description}</td>
                  <td className="py-3 px-6"><span className={`${e.severity === "HIGH" ? "text-amber-600" : "text-slate-600"} font-black`}>{e.severity}</span></td>
                </tr>
              ))}
              {financialHealth.drifts.length === 0 && dataIntegrity.exceptions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 font-bold">
                    {isAr ? "لا توجد تنبيهات نشطة. النظام يعمل بكفاءة." : "No active alerts. System is operating normally."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
