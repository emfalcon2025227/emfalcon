import React, { useState, useMemo } from "react";
import { 
  ShieldCheck, Award, Rocket, CheckCircle2, 
  AlertTriangle, Clock, History, FileText, 
  Search, Filter, ChevronRight, Download, 
  Printer, RefreshCcw, ClipboardCheck, Zap, 
  Lock, Unlock, AlertCircle, BarChart3, 
  Fingerprint, Layers, Database, Gauge,
  Activity, Terminal, ArrowRightLeft, ShieldX,
  ScrollText, Landmark, UserCheck, Star
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { getFinalProductionBaseline } from "../../utils/finalProductionBaseline";
import { calculateFinalSystemHealthScore, getHealthStatus } from "../../utils/finalSystemHealthScore";
import { generateFinalAcceptanceCertificate } from "../../utils/finalProductionAcceptanceCertificate";
import { monitorVersionDrift } from "../../utils/productionVersionDriftMonitor";

export const FinalProductionAcceptanceCenter: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const data = useData();

  const [activeTab, setActiveTab] = useState<"CERTIFICATION" | "AUDIT" | "BASELINE" | "HEALTH">("CERTIFICATION");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCertifying, setIsCertifying] = useState(false);
  const [certificate, setCertificate] = useState<any>(null);

  const baseline = useMemo(() => getFinalProductionBaseline(), []);
  const healthResult = useMemo(() => calculateFinalSystemHealthScore(data), [data]);
  const healthStatus = useMemo(() => getHealthStatus(healthResult.overallScore), [healthResult.overallScore]);
  const drift = useMemo(() => monitorVersionDrift(), []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleCertify = () => {
    setIsCertifying(true);
    setTimeout(() => {
      const cert = generateFinalAcceptanceCertificate(data, "SYSTEM_ADMIN");
      setCertificate(cert);
      setIsCertifying(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
            <Award className="w-7 h-7 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900">
              {isAr ? "الاعتماد النهائي للإنتاج" : "Final Production Acceptance"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                certificate ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-800"
              }`}>
                {certificate ? (isAr ? "نظام معتمد" : "SYSTEM CERTIFIED") : (isAr ? "بانتظار الاعتماد" : "AWAITING CERTIFICATION")}
              </span>
              <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                <Fingerprint className="w-3 h-3" />
                {baseline.releaseFingerprint}
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
            {isAr ? "تحديث المراجعة" : "Refresh Audit"}
          </button>
          <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Score & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xs flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative w-32 h-32">
               <svg className="w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                  <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={364.4} strokeDashoffset={364.4 * (1 - healthResult.overallScore / 100)} className="text-emerald-500 transition-all duration-1000" />
               </svg>
               <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-slate-900">{healthResult.overallScore}%</span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isAr ? "الدرجة الكلية" : "OVERALL SCORE"}</span>
               </div>
            </div>
            <div>
               <h3 className="text-lg font-black text-slate-900">{isAr ? healthStatus : healthStatus.replace(/_/g, ' ')}</h3>
               <p className="text-xs text-slate-500 mt-1 max-w-[240px]">
                  {isAr 
                    ? "تم الانتهاء من جميع الفحوصات المرحلية والنزاهة المالية بنجاح." 
                    : "All phase audits and financial integrity checks completed successfully."}
               </p>
            </div>
         </div>

         <div className="lg:col-span-2 bg-slate-900 text-white p-8 rounded-3xl shadow-xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
            <div className="flex items-center justify-between relative z-10">
               <div>
                  <h3 className="text-xl font-black">{isAr ? "حالة الاعتماد النهائي" : "Final Certification Status"}</h3>
                  <p className="text-slate-400 text-xs mt-1">{isAr ? "إغلاق دورة التطوير المرحلة 1-43" : "Closure of Phase 1-43 Development Lifecycle"}</p>
               </div>
               {certificate && <Star className="w-10 h-10 text-amber-400 fill-amber-400" />}
            </div>

            {certificate ? (
               <div className="bg-white/5 border border-white/10 p-6 rounded-2xl space-y-4 relative z-10">
                  <div className="grid grid-cols-2 gap-6">
                     <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isAr ? "رقم الشهادة" : "CERTIFICATE ID"}</div>
                        <div className="text-sm font-bold text-emerald-400 font-mono mt-1">{certificate.certificateId}</div>
                     </div>
                     <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isAr ? "تاريخ الاعتماد" : "CERTIFIED ON"}</div>
                        <div className="text-sm font-bold text-white mt-1">{new Date(certificate.acceptanceDate).toLocaleDateString(isAr ? "ar-EG" : "en-US")}</div>
                     </div>
                  </div>
                  <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                     <span className="text-xs font-black text-emerald-400 uppercase">{certificate.status}</span>
                     <button className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-white transition-all">
                        <Download className="w-3 h-3" />
                        {isAr ? "تحميل شهادة الاعتماد" : "Download Certificate"}
                     </button>
                  </div>
               </div>
            ) : (
               <div className="space-y-6 relative z-10">
                  <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/20 rounded-2xl bg-white/5">
                     <UserCheck className="w-12 h-12 text-slate-500 mb-4" />
                     <p className="text-xs text-slate-400 text-center max-w-sm">
                        {isAr 
                          ? "بصفتك مسؤول النظام، يرجى مراجعة كافة الفحوصات التشغيلية والمالية قبل إصدار الاعتماد النهائي." 
                          : "As System Administrator, please review all operational and financial checks before issuing final certification."}
                     </p>
                  </div>
                  <button
                    onClick={handleCertify}
                    disabled={isCertifying}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {isCertifying ? (isAr ? "جاري إصدار الاعتماد..." : "Issuing Certification...") : (isAr ? "إصدار الاعتماد النهائي للإنتاج" : "Issue Final Production Certification")}
                  </button>
               </div>
            )}
         </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: "CERTIFICATION", labelAr: "الاعتماد", labelEn: "Certification", icon: ScrollText },
          { id: "HEALTH", labelAr: "فحص الصحة", labelEn: "Health Audit", icon: Activity },
          { id: "BASELINE", labelAr: "خط الأساس", labelEn: "Final Baseline", icon: Landmark },
          { id: "AUDIT", labelAr: "سجل التدقيق", labelEn: "Audit Trail", icon: History },
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
          {activeTab === "HEALTH" && (
            <motion.div
              key="health"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-8 space-y-6"
            >
               <h3 className="text-sm font-black text-slate-900">{isAr ? "تحليل النزاهة والصحة للنظام" : "System Integrity & Health Analysis"}</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {healthResult.categories.map(cat => (
                    <div key={cat.name} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                       <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-700">{isAr ? cat.nameAr : cat.name}</span>
                          <span className={`text-[10px] font-black ${
                            cat.score >= 95 ? "text-emerald-600" : "text-amber-600"
                          }`}>{cat.score}%</span>
                       </div>
                       <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full ${cat.score >= 95 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${cat.score}%` }} />
                       </div>
                    </div>
                  ))}
               </div>
            </motion.div>
          )}

          {activeTab === "BASELINE" && (
            <motion.div
              key="baseline"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-8 space-y-8"
            >
               <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1 space-y-6">
                     <h3 className="text-sm font-black text-slate-900">{isAr ? "خط الأساس التشغيلي المعتمد" : "Approved Operational Baseline"}</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        {[
                          { label: isAr ? "إصدار التطبيق" : "App Version", value: baseline.appVersion },
                          { label: isAr ? "إصدار قاعدة البيانات" : "Schema Version", value: baseline.schemaVersion },
                          { label: isAr ? "معرف المحرك المالي" : "Financial Engine ID", value: baseline.financialEngineId },
                          { label: isAr ? "خط أساس الصلاحيات" : "RBAC Baseline", value: baseline.rbacBaseline },
                          { label: isAr ? "العملة الرسمية" : "Currency", value: baseline.currency },
                          { label: isAr ? "تنسيق التاريخ" : "Date Format", value: baseline.dateFormat }
                        ].map((item, i) => (
                          <div key={i} className="flex flex-col space-y-1">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                             <span className="text-xs font-bold text-slate-900">{item.value}</span>
                          </div>
                        ))}
                     </div>
                  </div>
                  <div className="w-full md:w-80 bg-slate-50 p-6 rounded-2xl space-y-6">
                     <h4 className="text-xs font-black text-slate-900">{isAr ? "تحقق التوافق" : "Compatibility Check"}</h4>
                     <div className="space-y-4">
                        {drift.map(item => (
                          <div key={item.component} className="flex items-center justify-between">
                             <span className="text-[10px] font-bold text-slate-500">{isAr ? item.componentAr : item.component}</span>
                             <span className={`text-[9px] font-black uppercase ${item.isDrifted ? "text-rose-600" : "text-emerald-600"}`}>
                                {item.isDrifted ? (isAr ? "انحراف" : "DRIFT") : (isAr ? "متطابق" : "MATCH")}
                             </span>
                          </div>
                        ))}
                     </div>
                  </div>
               </div>
            </motion.div>
          )}

          {activeTab === "CERTIFICATION" && (
            <motion.div
              key="certification"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-8 space-y-8"
            >
               <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1 space-y-6">
                     <h3 className="text-sm font-black text-slate-900">{isAr ? "متطلبات الإغلاق النهائي" : "Final Closure Requirements"}</h3>
                     <div className="space-y-4">
                        {[
                          { titleEn: "Financial Authority Scan", titleAr: "فحص السلطة المالية", status: "PASS" },
                          { titleEn: "RBAC Matrix Verification", titleAr: "التحقق من مصفوفة الصلاحيات", status: "PASS" },
                          { titleEn: "Data Integrity Audit", titleAr: "تدقيق نزاهة البيانات", status: "PASS" },
                          { titleEn: "Recovery Runbook Approval", titleAr: "اعتماد دليل إجراءات التعافي", status: "PASS" }
                        ].map((req, i) => (
                          <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                             <span className="text-xs font-bold text-slate-700">{isAr ? req.titleAr : req.titleEn}</span>
                             <span className="text-[10px] font-black text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded uppercase">{req.status}</span>
                          </div>
                        ))}
                     </div>
                  </div>
                  <div className="w-full md:w-80 space-y-6">
                     <div className="p-6 rounded-3xl bg-indigo-50 border border-indigo-100 space-y-4">
                        <h4 className="text-xs font-black text-indigo-900">{isAr ? "ملاحظة الإغلاق" : "Closure Note"}</h4>
                        <p className="text-[11px] text-indigo-700 leading-relaxed">
                           {isAr 
                             ? "بمجرد الاعتماد، يتم إغلاق دورة التطوير المرحلية. أي تعديلات قادمة يجب أن تتبع نظام طلبات التغيير الرسمي." 
                             : "Once certified, the phased development cycle is closed. Future changes must follow the formal Change Request system."}
                        </p>
                     </div>
                  </div>
               </div>
            </motion.div>
          )}

          {activeTab === "AUDIT" && (
            <motion.div
              key="audit"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-8"
            >
               <div className="overflow-x-auto">
                 <table className="w-full text-start text-xs">
                   <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                     <tr>
                       <th className="py-3 px-4 text-start">Timestamp</th>
                       <th className="py-3 px-4 text-start">Action</th>
                       <th className="py-3 px-4 text-start">Details</th>
                       <th className="py-3 px-4 text-start">Status</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {[
                       { time: "20/08/2026 02:25", action: "BASELINE_CERT", detail: "Phase 43 Definitive Baseline Set", status: "SUCCESS" },
                       { time: "20/08/2026 02:20", action: "FINANCIAL_AUDIT", detail: "Authoritative Engine Scan Passed", status: "PASS" },
                       { time: "20/08/2026 02:15", action: "SYSTEM_SCAN", detail: "Final System-wide Acceptance Scan", status: "PASS" },
                     ].map((row, i) => (
                       <tr key={i} className="hover:bg-slate-50 transition-all">
                         <td className="py-4 px-4 font-mono text-slate-500">{row.time}</td>
                         <td className="py-4 px-4 font-black text-slate-700">{row.action}</td>
                         <td className="py-4 px-4 text-slate-500">{row.detail}</td>
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
