import React, { useState, useMemo } from "react";
import { 
  ShieldCheck, Activity, Award, CheckCircle2, 
  AlertTriangle, Clock, History, FileText, 
  Search, Filter, ChevronRight, Download, 
  Printer, ShieldAlert, RefreshCcw, ClipboardCheck,
  Zap, Lock, Unlock, AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { evaluateRecoveryCertification, CertificationReport } from "../../utils/recoveryCertificationEngine";
import { getRecoveryExceptions, RecoveryException } from "../../utils/recoveryExceptionManagement";
import { recoveryRunbook } from "../../utils/recoveryRunbook";
import { calculateProductionStabilityScore } from "../../utils/productionStabilityScore";
import { getBackupHistory } from "../../utils/productionBackupHealth";
import { SearchableSelect } from "../common/SearchableSelect";

export const RecoveryCertificationCenter: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const data = useData();

  const [activeTab, setActiveTab] = useState<"CERTIFICATION" | "DRILLS" | "EXCEPTIONS" | "RUNBOOK">("CERTIFICATION");
  const [isProcessing, setIsProcessing] = useState(false);

  const cert = useMemo(() => evaluateRecoveryCertification(data), [data]);
  const stability = useMemo(() => calculateProductionStabilityScore(data), [data]);
  const exceptions = getRecoveryExceptions();
  const backups = getBackupHistory();

  const handleRefresh = () => {
    setIsProcessing(true);
    setTimeout(() => setIsProcessing(false), 1000);
  };

  const kpis = [
    { labelAr: "نقاط الاستقرار", labelEn: "Stability Score", value: `${stability.overall}%`, icon: Zap, color: "blue" },
    { labelAr: "جاهزية التعافي", labelEn: "Recovery Ready", value: `${cert.score}%`, icon: ShieldCheck, color: "emerald" },
    { labelAr: "استثناءات نشطة", labelEn: "Active Exceptions", value: exceptions.filter(e => e.status !== "CLOSED").length, icon: AlertTriangle, color: "amber" },
    { labelAr: "حالة الشهادة", labelEn: "Cert Status", value: cert.status, icon: Award, color: cert.status === "CERTIFIED" ? "emerald" : "rose" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
            <Award className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900">
              {isAr ? "شهادة الجاهزية للتعافي واستمرارية الأعمال" : "Recovery & Business Continuity Certification"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                cert.status === "CERTIFIED" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
              }`}>
                {cert.status.replace("_", " ")}
              </span>
              <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {isAr ? `تنتهي في: ${new Date(cert.expiryDate).toLocaleDateString("ar-EG")}` : `Expires: ${new Date(cert.expiryDate).toLocaleDateString()}`}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCcw className={`w-4 h-4 ${isProcessing ? "animate-spin" : ""}`} />
            {isAr ? "تحديث الشهادة" : "Refresh Certificate"}
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
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {[
          { id: "CERTIFICATION", labelAr: "تفاصيل الشهادة", labelEn: "Certification Details", icon: ClipboardCheck },
          { id: "DRILLS", labelAr: "سجل الاختبارات", labelEn: "Drill History", icon: History },
          { id: "EXCEPTIONS", labelAr: "الاستثناءات", labelEn: "Exceptions", icon: AlertTriangle },
          { id: "RUNBOOK", labelAr: "دليل التعافي", labelEn: "Recovery Runbook", icon: FileText },
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

      {/* Content */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs min-h-[400px]">
        <AnimatePresence mode="wait">
          {activeTab === "CERTIFICATION" && (
            <motion.div
              key="cert"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-900">{isAr ? "معايير الجاهزية الرقمية" : "Readiness Compliance Standards"}</h3>
                  <div className="space-y-3">
                    {Object.entries(cert.details).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
                        <span className="text-xs font-bold text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        {value ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 font-black text-[10px]">
                            <CheckCircle2 className="w-4 h-4" />
                            {isAr ? "مطابق" : "COMPLIANT"}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-rose-600 font-black text-[10px]">
                            <AlertCircle className="w-4 h-4" />
                            {isAr ? "غير مطابق" : "NON-COMPLIANT"}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center p-8 rounded-3xl bg-slate-900 text-white text-center space-y-6">
                  <div className="w-24 h-24 rounded-full border-4 border-emerald-500/30 flex items-center justify-center relative">
                    <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin-slow" />
                    <Award className="w-12 h-12 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black">{isAr ? "شهادة استمرارية الأعمال" : "Continuity Certified"}</h4>
                    <p className="text-xs text-slate-400 mt-2 max-w-[240px]">
                      {isAr 
                        ? "تم التحقق من جميع الأنظمة الفرعية والتعافي بنجاح وفقاً للمعايير الدولية." 
                        : "All subsystems and recovery procedures verified against international standards."}
                    </p>
                  </div>
                  <div className="w-full h-px bg-slate-800" />
                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">RPO</div>
                      <div className="text-sm font-black text-emerald-400">99.8%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">RTO</div>
                      <div className="text-sm font-black text-emerald-400">45m</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "RUNBOOK" && (
            <motion.div
              key="runbook"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">{isAr ? "دليل التعافي القياسي" : "Standard Recovery Runbook"}</h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Rev 2.4 - Aug 2026</span>
              </div>
              <div className="space-y-4">
                {recoveryRunbook.map(step => (
                  <div key={step.step} className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all group flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 font-black text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                      {step.step}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">{isAr ? step.titleAr : step.titleEn}</h4>
                      <p className="text-[11px] text-slate-500 mt-1">{isAr ? step.actionAr : step.actionEn}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase">{isAr ? "المسؤول:" : "Responsible:"}</span>
                        <span className="text-[9px] font-bold text-slate-600 px-2 py-0.5 bg-slate-100 rounded-full">{step.responsible}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "EXCEPTIONS" && (
            <motion.div
              key="exceptions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
              <h3 className="text-sm font-black text-slate-900">{isAr ? "إدارة استثناءات التعافي" : "Recovery Exception Management"}</h3>
              <div className="space-y-3">
                {exceptions.map(ex => (
                  <div key={ex.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        ex.severity === "CRITICAL" ? "bg-rose-100 text-rose-600" : 
                        ex.severity === "HIGH" ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                      }`}>
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-400 text-[10px]">{ex.id}</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[9px] font-black uppercase">{ex.status}</span>
                        </div>
                        <h4 className="text-xs font-black text-slate-900 mt-1">{isAr ? ex.descriptionAr : ex.descriptionEn}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 italic">{isAr ? ex.impactAr : ex.impactEn}</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">
                      {isAr ? "تفاصيل" : "Details"}
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "DRILLS" && (
            <motion.div
              key="drills"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
              <h3 className="text-sm font-black text-slate-900">{isAr ? "سجل اختبارات التعافي الموثقة" : "Certified Recovery Drill Logs"}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <tr>
                      <th className="py-3 px-4 text-start">Drill ID</th>
                      <th className="py-3 px-4 text-start">Date</th>
                      <th className="py-3 px-4 text-start">Duration</th>
                      <th className="py-3 px-4 text-start">Result</th>
                      <th className="py-3 px-4 text-start">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">DRILL-20260819-001</td>
                      <td className="py-3 px-4 text-slate-500">19/08/2026</td>
                      <td className="py-3 px-4 font-bold">48m</td>
                      <td className="py-3 px-4">
                        <span className="text-emerald-600 font-black">PASS</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">COMPLETED</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">DRILL-20260715-001</td>
                      <td className="py-3 px-4 text-slate-500">15/07/2026</td>
                      <td className="py-3 px-4 font-bold">52m</td>
                      <td className="py-3 px-4">
                        <span className="text-emerald-600 font-black">PASS</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">COMPLETED</span>
                      </td>
                    </tr>
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
