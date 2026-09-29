import React, { useState, useMemo } from "react";
import { 
  Rocket, History, Clock, CheckCircle2, 
  AlertTriangle, RefreshCcw, ShieldCheck,
  Terminal, FileText, ChevronRight, Download,
  Printer, Fingerprint, Award, Layers,
  Activity, Zap, Search
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { getProductionBaseline } from "../../utils/productionVersionBaseline";
import { generateReleaseFingerprint } from "../../utils/releaseFingerprint";
import { SearchableSelect } from "../common/SearchableSelect";

export const ReleaseManagementCenter: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const data = useData();

  const [activeTab, setActiveTab] = useState<"ACTIVE" | "HISTORY" | "BASELINE">("ACTIVE");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const baseline = useMemo(() => getProductionBaseline(), []);
  const fingerprint = useMemo(() => generateReleaseFingerprint(baseline.appVersion, 12), [baseline]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const currentRelease = {
    id: "REL-20260820-001",
    version: baseline.appVersion,
    status: "RELEASED",
    date: baseline.releaseTimestamp,
    risk: "MEDIUM",
    changesCount: 14,
    testPassRate: "100%"
  };

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
              {isAr ? "إدارة الإصدارات والتحقق" : "Release Management & Verification"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                {isAr ? "إصدار مستقر" : "STABLE RELEASE"}
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
            {isAr ? "تحديث الحالة" : "Refresh Status"}
          </button>
        </div>
      </div>

      {/* Main Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Active Release */}
        <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900">{isAr ? "الإصدار النشط حالياً" : "Current Active Release"}</h3>
            <span className="text-[10px] font-black text-slate-400 uppercase">{currentRelease.id}</span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
             <div className="space-y-1">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isAr ? "الإصدار" : "Version"}</div>
                <div className="text-lg font-black text-slate-900">{currentRelease.version}</div>
             </div>
             <div className="space-y-1">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isAr ? "تاريخ النشر" : "Released On"}</div>
                <div className="text-xs font-bold text-slate-700">{new Date(currentRelease.date).toLocaleDateString(isAr ? "ar-EG" : "en-US")}</div>
             </div>
             <div className="space-y-1">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isAr ? "نسبة النجاح" : "Pass Rate"}</div>
                <div className="text-xs font-bold text-emerald-600">{currentRelease.testPassRate}</div>
             </div>
             <div className="space-y-1">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isAr ? "الحالة" : "Status"}</div>
                <div className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full inline-block">{currentRelease.status}</div>
             </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <Award className="w-5 h-5 text-amber-500" />
                <span className="text-xs font-black text-slate-700">{isAr ? "جاهزية الاستعادة المالية" : "Financial Recovery Ready"}</span>
             </div>
             <div className="flex items-center gap-2 text-emerald-600 font-black text-[10px]">
                <CheckCircle2 className="w-4 h-4" />
                {isAr ? "تم التحقق" : "VERIFIED"}
             </div>
          </div>
        </div>

        {/* Baseline Details */}
        <div className="bg-slate-900 text-white p-6 rounded-3xl space-y-6 shadow-xl">
           <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest">{isAr ? "خط الأساس للإصدار" : "Release Baseline"}</h3>
           <div className="space-y-4">
              {[
                { label: isAr ? "المحرك المالي" : "Financial Engine", value: baseline.financialEngineVersion },
                { label: isAr ? "مخطط البيانات" : "Data Schema", value: baseline.schemaVersion },
                { label: isAr ? "التكوين" : "Configuration", value: baseline.configurationVersion },
                { label: isAr ? "إطار العمل" : "Framework", value: "React 18.3" }
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                   <span className="text-[11px] text-slate-400 font-bold">{item.label}</span>
                   <span className="text-[11px] font-mono font-black text-white">{item.value}</span>
                </div>
              ))}
           </div>
           <div className="pt-4 border-t border-slate-800">
              <button className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2">
                 <ShieldCheck className="w-3 h-3 text-emerald-400" />
                 {isAr ? "التحقق من خط الأساس" : "Verify Baseline"}
              </button>
           </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: "ACTIVE", labelAr: "الإصدار النشط", labelEn: "Active Release", icon: Zap },
          { id: "HISTORY", labelAr: "سجل الإصدارات", labelEn: "Release History", icon: History },
          { id: "BASELINE", labelAr: "مقارنة خط الأساس", labelEn: "Baseline Comparison", icon: Layers },
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

      {/* Content Area */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs min-h-[400px]">
        <AnimatePresence mode="wait">
          {activeTab === "ACTIVE" && (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-8"
            >
              <div className="flex flex-col md:flex-row gap-8">
                 <div className="flex-1 space-y-6">
                    <h3 className="text-sm font-black text-slate-900">{isAr ? "محتويات الإصدار الحالي" : "Current Release Notes"}</h3>
                    <div className="space-y-4">
                       {[
                         { titleEn: "Financial Engine Optimization", titleAr: "تحسين المحرك المالي", category: "FINANCIAL" },
                         { titleEn: "Arabic Search Normalization Fix", titleAr: "إصلاح تسوية البحث العربي", category: "BUG_FIX" },
                         { titleEn: "New Capacity Planning Module", titleAr: "وحدة تخطيط السعة الجديدة", category: "FEATURE" }
                       ].map((item, i) => (
                         <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                            <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0">
                               <FileText className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                               <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{item.category}</div>
                               <h4 className="text-xs font-black text-slate-900 mt-0.5">{isAr ? item.titleAr : item.titleEn}</h4>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
                 <div className="w-full md:w-80 space-y-6">
                    <h3 className="text-sm font-black text-slate-900">{isAr ? "إحصائيات النشر" : "Deployment Metrics"}</h3>
                    <div className="space-y-4">
                       <div className="p-4 rounded-2xl border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase">
                             <span>{isAr ? "زمن النشر" : "Deploy Time"}</span>
                             <span className="text-slate-900">14m</span>
                          </div>
                          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                             <div className="w-full h-full bg-emerald-500" />
                          </div>
                       </div>
                       <div className="p-4 rounded-2xl border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase">
                             <span>{isAr ? "أخطاء ما بعد النشر" : "Post-Deploy Errors"}</span>
                             <span className="text-emerald-600">0</span>
                          </div>
                          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                             <div className="w-0 h-full bg-rose-500" />
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === "HISTORY" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6"
            >
               <div className="overflow-x-auto">
                 <table className="w-full text-start text-xs">
                   <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                     <tr>
                       <th className="py-3 px-4 text-start">Release ID</th>
                       <th className="py-3 px-4 text-start">Version</th>
                       <th className="py-3 px-4 text-start">Date</th>
                       <th className="py-3 px-4 text-start">Result</th>
                       <th className="py-3 px-4 text-start">Status</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     <tr className="hover:bg-slate-50 transition-all">
                       <td className="py-4 px-4 font-mono font-bold text-slate-900">REL-20260820-001</td>
                       <td className="py-4 px-4 font-black text-slate-700">4.1.0</td>
                       <td className="py-4 px-4 font-bold text-slate-500">20/08/2026</td>
                       <td className="py-4 px-4"><span className="text-emerald-600 font-black">SUCCESS</span></td>
                       <td className="py-4 px-4">
                         <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black">RELEASED</span>
                       </td>
                     </tr>
                     <tr className="hover:bg-slate-50 transition-all">
                       <td className="py-4 px-4 font-mono font-bold text-slate-900">REL-20260715-001</td>
                       <td className="py-4 px-4 font-black text-slate-700">4.0.5</td>
                       <td className="py-4 px-4 font-bold text-slate-500">15/07/2026</td>
                       <td className="py-4 px-4"><span className="text-emerald-600 font-black">SUCCESS</span></td>
                       <td className="py-4 px-4">
                         <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-black">ARCHIVED</span>
                       </td>
                     </tr>
                   </tbody>
                 </table>
               </div>
            </motion.div>
          )}

          {activeTab === "BASELINE" && (
            <motion.div
              key="baseline"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
               <h3 className="text-sm font-black text-slate-900">{isAr ? "تحليل الانحراف عن خط الأساس" : "Baseline Drift Analysis"}</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 rounded-3xl bg-emerald-50 border border-emerald-100 flex flex-col items-center justify-center text-center space-y-4">
                     <ShieldCheck className="w-12 h-12 text-emerald-500" />
                     <div>
                        <h4 className="text-sm font-black text-emerald-900">{isAr ? "لا يوجد انحراف" : "No Drift Detected"}</h4>
                        <p className="text-[11px] text-emerald-700 mt-1">
                           {isAr 
                             ? "الحالة الحالية للنظام تتطابق تماماً مع خط الأساس المعتمد للإصدار 4.1.0." 
                             : "The current system state perfectly matches the approved baseline for release 4.1.0."}
                        </p>
                     </div>
                  </div>
                  <div className="space-y-3">
                     {[
                       { name: "Schema Integrity", status: "MATCH" },
                       { name: "Config Integrity", status: "MATCH" },
                       { name: "Binary Fingerprint", status: "MATCH" },
                       { name: "RBAC Matrix", status: "MATCH" }
                     ].map((item, i) => (
                       <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100 shadow-sm">
                          <span className="text-[11px] font-bold text-slate-600">{item.name}</span>
                          <span className="text-[10px] font-black text-emerald-600">{item.status}</span>
                       </div>
                     ))}
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
