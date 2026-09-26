import React, { useState, useMemo } from "react";
import { 
  Rocket, ShieldCheck, ShieldAlert, Award, 
  CheckCircle2, AlertTriangle, Clock, History, 
  Search, Filter, ChevronRight, Download, 
  Printer, RefreshCcw, ClipboardCheck, Zap, 
  Lock, Unlock, AlertCircle, BarChart3, 
  Fingerprint, Layers, Database, Gauge,
  Activity, Terminal, ArrowRightLeft, ShieldX
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { evaluateProductionReleaseGate, calculateReleaseReadinessScore } from "../../utils/productionReleaseExecutionGate";
import { monitorVersionDrift } from "../../utils/productionVersionDriftMonitor";
import { getPostReleaseStability } from "../../utils/postReleaseStabilityMonitor";
import { getProductionBaseline } from "../../utils/productionVersionBaseline";
import { generateReleaseFingerprint } from "../../utils/releaseFingerprint";
import { runFinancialRegressionGuard } from "../../utils/financialRegressionGuard";
import { monitorDataGrowth } from "../../utils/productionDataGrowthMonitor";

export const ProductionReleaseExecutionCenter: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const data = useData();

  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "GATE" | "DRIFT" | "STABILITY" | "AUDIT">("OVERVIEW");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const baseline = useMemo(() => getProductionBaseline(), []);
  const gateResults = useMemo(() => evaluateProductionReleaseGate(data), [data]);
  const readinessScore = useMemo(() => calculateReleaseReadinessScore(gateResults), [gateResults]);
  const drift = useMemo(() => monitorVersionDrift(), []);
  const stability = useMemo(() => getPostReleaseStability(30), []);
  const finRegression = useMemo(() => runFinancialRegressionGuard(data), [data]);
  const fingerprint = useMemo(() => generateReleaseFingerprint(baseline.appVersion, 15), [baseline]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const kpis = [
    { labelAr: "جاهزية الإصدار", labelEn: "Release Readiness", value: `${readinessScore}%`, icon: Rocket, color: readinessScore > 90 ? "emerald" : "amber" },
    { labelAr: "درجة الاستقرار", labelEn: "Stability Score", value: `${stability.healthScore}%`, icon: Zap, color: "blue" },
    { labelAr: "انحراف الإصدار", labelEn: "Version Drift", value: drift.some(d => d.isDrifted) ? (isAr ? "مكتشف" : "DRIFTED") : (isAr ? "لا يوجد" : "NONE"), icon: Layers, color: drift.some(d => d.isDrifted) ? "rose" : "emerald" },
    { labelAr: "الحالة المالية", labelEn: "Financial Status", value: finRegression.length === 0 ? (isAr ? "سليم" : "SECURE") : (isAr ? "حرج" : "CRITICAL"), icon: Lock, color: finRegression.length === 0 ? "emerald" : "rose" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
            <Rocket className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900">
              {isAr ? "تنفيذ الإصدار الإنتاجي والتحقق" : "Production Release Execution & Verification"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                readinessScore > 90 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}>
                {readinessScore > 90 ? (isAr ? "جاهز للإصدار" : "READY FOR RELEASE") : (isAr ? "مراجعة مطلوبة" : "REVIEW REQUIRED")}
              </span>
              <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                <Fingerprint className="w-3 h-3" />
                {fingerprint}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCcw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isAr ? "تحديث التنفيذ" : "Refresh Execution"}
          </button>
          <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${kpi.color}-50 text-${kpi.color}-600`}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{isAr ? kpi.labelAr : kpi.labelEn}</div>
              <div className="text-sm font-black text-slate-900">{kpi.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: "OVERVIEW", labelAr: "نظرة عامة", labelEn: "Overview", icon: BarChart3 },
          { id: "GATE", labelAr: "بوابات التحقق", labelEn: "Release Gates", icon: ClipboardCheck },
          { id: "DRIFT", labelAr: "انحراف الإصدار", labelEn: "Version Drift", icon: Layers },
          { id: "STABILITY", labelAr: "الاستقرار بعد النشر", labelEn: "Post-Release Stability", icon: Activity },
          { id: "AUDIT", labelAr: "سجل العمليات", labelEn: "Execution Audit", icon: History },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === tab.id ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{isAr ? tab.labelAr : tab.labelEn}</span>
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs min-h-[500px]">
        <AnimatePresence mode="wait">
          {activeTab === "OVERVIEW" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="lg:col-span-2 space-y-6">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                       <ShieldCheck className="w-4 h-4 text-emerald-500" />
                       {isAr ? "شهادة جاهزية الإصدار" : "Release Certification Readiness"}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {gateResults.map(res => (
                         <div key={res.category} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between">
                               <span className="text-xs font-black text-slate-700">{isAr ? res.categoryAr : res.category}</span>
                               <span className={`text-[10px] font-black ${
                                 res.status === "READY" ? "text-emerald-600" : "text-amber-600"
                               }`}>{res.status}</span>
                            </div>
                            <p className="text-[10px] text-slate-500">{isAr ? res.detailsAr : res.details}</p>
                            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                               <div className="h-full bg-slate-900" style={{ width: `${res.score}%` }} />
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-6">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                       <Zap className="w-4 h-4 text-indigo-500" />
                       {isAr ? "إجراءات الإصدار" : "Release Actions"}
                    </h3>
                    <div className="p-6 rounded-3xl bg-slate-900 text-white space-y-4">
                       <button className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2">
                          <Rocket className="w-4 h-4" />
                          {isAr ? "تنفيذ النشر الإنتاجي" : "Execute Production Deploy"}
                       </button>
                       <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2">
                          <RefreshCcw className="w-4 h-4" />
                          {isAr ? "إعادة تشغيل بوابات التحقق" : "Rerun Verification Gates"}
                       </button>
                       <button className="w-full py-3 bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2">
                          <ArrowRightLeft className="w-4 h-4" />
                          {isAr ? "طلب تراجع طارئ" : "Request Emergency Rollback"}
                       </button>
                    </div>
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === "GATE" && (
            <motion.div
              key="gate"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
               <h3 className="text-sm font-black text-slate-900">{isAr ? "تفاصيل بوابات الإصدار" : "Release Gate Detailed Report"}</h3>
               <div className="space-y-3">
                  {gateResults.map((gate, i) => (
                    <div key={i} className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4 group hover:bg-slate-50 transition-all">
                       <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            gate.status === "READY" ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                          }`}>
                            {gate.status === "READY" ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                          </div>
                          <div>
                             <h4 className="text-xs font-black text-slate-900">{isAr ? gate.categoryAr : gate.category}</h4>
                             <p className="text-[10px] text-slate-500 mt-1">{isAr ? gate.detailsAr : gate.details}</p>
                          </div>
                       </div>
                       <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                         gate.status === "READY" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                       }`}>
                         {gate.status}
                       </span>
                    </div>
                  ))}
               </div>
            </motion.div>
          )}

          {activeTab === "DRIFT" && (
            <motion.div
              key="drift"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
               <h3 className="text-sm font-black text-slate-900">{isAr ? "تحليل انحراف الإصدار عن خط الأساس" : "Version Drift Analysis vs Baseline"}</h3>
               <div className="space-y-4">
                  {drift.map(item => (
                    <div key={item.component} className="p-5 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                       <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            item.isDrifted ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                          }`}>
                            {item.isDrifted ? <ShieldX className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                          </div>
                          <div>
                             <h4 className="text-xs font-black text-slate-900">{isAr ? item.componentAr : item.component}</h4>
                             <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-bold text-slate-400">{isAr ? "المتوقع:" : "Expected:"} {item.expected}</span>
                                <span className="text-[10px] text-slate-300">|</span>
                                <span className={`text-[10px] font-bold ${item.isDrifted ? "text-rose-600" : "text-emerald-600"}`}>
                                   {isAr ? "الفعلي:" : "Actual:"} {item.actual}
                                </span>
                             </div>
                          </div>
                       </div>
                       <div className="flex items-center gap-2">
                          {item.isDrifted && (
                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[9px] font-black uppercase">
                               DRIFT DETECTED
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            item.isDrifted ? "bg-rose-500 text-white" : "bg-emerald-500 text-white"
                          }`}>
                             {item.isDrifted ? "CRITICAL" : "MATCHED"}
                          </span>
                       </div>
                    </div>
                  ))}
               </div>
            </motion.div>
          )}

          {activeTab === "STABILITY" && (
            <motion.div
              key="stability"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
               <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900">{isAr ? "مراقبة الاستقرار بعد النشر" : "Post-Release Stability Monitoring"}</h3>
                  <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black border border-indigo-100">
                     {isAr ? "نافذة المراقبة: 30 دقيقة" : "Stability Window: 30m"}
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stability.metrics.map(metric => (
                    <div key={metric.name} className="p-4 rounded-2xl border border-slate-200 space-y-3">
                       <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-700">{isAr ? metric.nameAr : metric.name}</span>
                          <span className={`text-[10px] font-black ${
                            metric.status === "STABLE" ? "text-emerald-600" : "text-rose-600"
                          }`}>{metric.status}</span>
                       </div>
                       <div className="flex items-end justify-between">
                          <div className="text-xl font-black text-slate-900">{metric.value}</div>
                          {metric.trend === "STABLE" ? <Minus className="w-4 h-4 text-slate-300" /> : 
                           metric.trend === "UP" ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : 
                           <TrendingDown className="w-4 h-4 text-rose-500" />}
                       </div>
                    </div>
                  ))}
               </div>
            </motion.div>
          )}

          {activeTab === "AUDIT" && (
            <motion.div
              key="audit"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6"
            >
               <div className="overflow-x-auto">
                 <table className="w-full text-start text-xs">
                   <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                     <tr>
                       <th className="py-3 px-4 text-start">Timestamp</th>
                       <th className="py-3 px-4 text-start">User</th>
                       <th className="py-3 px-4 text-start">Action</th>
                       <th className="py-3 px-4 text-start">Release ID</th>
                       <th className="py-3 px-4 text-start">Status</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {[
                       { time: "20/08/2026 01:50", user: "Admin", action: "DEPLOY_START", rel: "REL-20260820-001", status: "SUCCESS" },
                       { time: "20/08/2026 01:45", user: "Admin", action: "GATE_VERIFY", rel: "REL-20260820-001", status: "PASS" },
                       { time: "20/08/2026 01:40", user: "System", action: "BASELINE_MATCH", rel: "REL-20260820-001", status: "MATCH" },
                     ].map((row, i) => (
                       <tr key={i} className="hover:bg-slate-50 transition-all">
                         <td className="py-4 px-4 font-mono text-slate-500">{row.time}</td>
                         <td className="py-4 px-4 font-bold text-slate-900">{row.user}</td>
                         <td className="py-4 px-4 font-black text-slate-700">{row.action}</td>
                         <td className="py-4 px-4 font-mono text-slate-400">{row.rel}</td>
                         <td className="py-4 px-4">
                           <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black">{row.status}</span>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const TrendingUp = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
);

const TrendingDown = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
);

const Minus = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);
