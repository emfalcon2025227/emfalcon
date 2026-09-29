
import React, { useState, useMemo } from "react";
import { 
  ShieldCheck, Activity, Database, AlertTriangle, 
  CheckCircle2, Clock, History, Search, 
  Filter, FileText, AlertCircle, BarChart3,
  ShieldAlert, RefreshCcw, HardDrive, Share2,
  Lock, Unlock, PlayCircle, ClipboardCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { getBackupHistory, getLatestBackup, getBackupFreshnessStatus } from "../../utils/productionBackupHealth";
import { evaluateRecoveryReadiness } from "../../utils/productionRecoveryReadiness";
import { getFinancialFailSafeState, setFinancialFailSafeState } from "../../utils/financialFailSafe";
import { runRecoveryFinancialWatchdog } from "../../utils/recoveryFinancialIntegrityWatchdog";
import { getContinuityConfig } from "../../utils/businessContinuityConfiguration";
import { SearchableSelect, SearchableOption } from "../common/SearchableSelect";

export const BusinessContinuityCenter: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const data = useData();
  const config = getContinuityConfig();

  const [activeTab, setActiveTab] = useState<"STATUS" | "BACKUPS" | "SIMULATION" | "FAILSAFE">("STATUS");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState("");
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const backups = getBackupHistory();
  const latestBackup = getLatestBackup();
  const readiness = evaluateRecoveryReadiness(data);
  const failsafe = getFinancialFailSafeState();

  const handleRunSimulation = async () => {
    if (!selectedBackupId) return;
    setIsProcessing(true);
    try {
      const result = await runDRSimulation(selectedBackupId);
      setSimulationResult(result);
    } finally {
      setIsProcessing(false);
    }
  };

  const backupOptions: SearchableOption[] = backups.map(b => ({
    id: b.id,
    label: b.id,
    subLabel: `${b.timestamp.slice(0,10)} - ${b.recordCount} records`,
    badge: b.status
  }));

  const healthKpis = useMemo(() => [
    { labelAr: "جاهزية التعافي", labelEn: "Recovery Readiness", value: `${readiness.score}%`, status: readiness.status, icon: ShieldCheck },
    { labelAr: "أحدث نسخة", labelEn: "Latest Backup", value: latestBackup ? latestBackup.id.split('-').pop() : "None", status: latestBackup ? "HEALTHY" : "CRITICAL", icon: HardDrive },
    { labelAr: "حالة الأمان", labelEn: "Fail-Safe Mode", value: failsafe.state, status: failsafe.state === "NORMAL" ? "HEALTHY" : "WARNING", icon: Lock },
    { labelAr: "استمرارية الأعمال", labelEn: "Business Continuity", value: readiness.status, status: readiness.status, icon: Activity },
  ], [readiness, latestBackup, failsafe]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg bg-slate-900 text-white`}>
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900">
              {isAr ? "مركز استمرارية الأعمال والتعافي من الكوارث" : "Business Continuity & Disaster Recovery Center"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                readiness.status === "HEALTHY" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}>
                {readiness.status}
              </span>
              <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                RPO: {config.rpoThresholdHours}h | RTO: {config.rtoThresholdMinutes}m
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {healthKpis.map((kpi, idx) => (
          <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              kpi.status === "HEALTHY" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
            }`}>
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
          { id: "STATUS", labelAr: "حالة الاستمرارية", labelEn: "Continuity Status", icon: Activity },
          { id: "BACKUPS", labelAr: "سجل النسخ الاحتياطي", labelEn: "Backup History", icon: HardDrive },
          { id: "SIMULATION", labelAr: "محاكاة التعافي", labelEn: "Recovery Simulation", icon: PlayCircle },
          { id: "FAILSAFE", labelAr: "وضع الأمان المالي", labelEn: "Financial Fail-Safe", icon: ShieldAlert },
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

      {/* Tab Content */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden min-h-[400px]">
        <AnimatePresence mode="wait">
          {activeTab === "STATUS" && (
            <motion.div
              key="status"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
              <h3 className="text-sm font-black text-slate-900">{isAr ? "تحليل جاهزية التعافي من الكوارث" : "DR Readiness Analysis"}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isAr ? "التحقق من الأنظمة الفرعية" : "Subsystem Verification"}</h4>
                  <div className="space-y-2">
                    {Object.entries(readiness.details).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-xs font-bold text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        {value ? (
                          <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600">
                            <CheckCircle2 className="w-3 h-3" /> {isAr ? "تم التحقق" : "VERIFIED"}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-black text-rose-600">
                            <AlertCircle className="w-3 h-3" /> {isAr ? "غير متحقق" : "NOT VERIFIED"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-6 rounded-2xl bg-slate-900 text-white flex flex-col items-center justify-center text-center space-y-4">
                  <div className="relative w-32 h-32 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                      <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" 
                        strokeDasharray={364.4} strokeDashoffset={364.4 * (1 - readiness.score / 100)}
                        className="text-emerald-500 transition-all duration-1000" />
                    </svg>
                    <span className="absolute text-2xl font-black">{readiness.score}%</span>
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400">{isAr ? "نقاط الجاهزية" : "Readiness Score"}</div>
                    <div className="text-[11px] text-slate-400 mt-2">{isAr ? "درجة الجاهزية الكلية بناءً على المعايير الأمنية والتشغيلية." : "Overall readiness score based on security and operational standards."}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "BACKUPS" && (
            <motion.div
              key="backups"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
              <h3 className="text-sm font-black text-slate-900">{isAr ? "سجل النسخ الاحتياطي والتحقق من التكامل" : "Backup History & Integrity Logs"}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <tr>
                      <th className="py-3 px-4 text-start">Backup ID</th>
                      <th className="py-3 px-4 text-start">Timestamp</th>
                      <th className="py-3 px-4 text-start">Records</th>
                      <th className="py-3 px-4 text-start">Status</th>
                      <th className="py-3 px-4 text-start">Integrity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {backups.map(b => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{b.id}</td>
                        <td className="py-3 px-4 text-slate-500">{new Date(b.timestamp).toLocaleString()}</td>
                        <td className="py-3 px-4 font-bold">{b.recordCount.toLocaleString()}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            b.status === "VERIFIED" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                          }`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500" style={{ width: `${b.integrityScore}%` }} />
                            </div>
                            <span className="text-[10px] font-black">{b.integrityScore}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === "SIMULATION" && (
            <motion.div
              key="simulation"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                  <h3 className="text-sm font-black text-slate-900">{isAr ? "محاكاة التعافي من الكوارث (بيئة معزولة)" : "Disaster Recovery Simulation (Isolated)"}</h3>
                  <p className="text-xs text-slate-500">{isAr ? "قم بإجراء محاكاة لعملية الاستعادة للتحقق من سلامة البيانات والوقت المستغرق." : "Run a simulated restoration to verify data integrity and recovery duration."}</p>
                </div>

                <div className="p-6 rounded-3xl border border-slate-200 bg-slate-50 space-y-6">
                  <SearchableSelect
                    label={isAr ? "اختر النسخة الاحتياطية للمحاكاة" : "Select Backup for Simulation"}
                    options={backupOptions}
                    value={selectedBackupId}
                    onChange={(val) => setSelectedBackupId(val)}
                    placeholder={isAr ? "-- اختر نسخة --" : "-- Select Backup --"}
                  />

                  <button
                    onClick={handleRunSimulation}
                    disabled={isProcessing || !selectedBackupId}
                    className="w-full py-3 bg-slate-900 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isProcessing ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
                    {isAr ? "بدء المحاكاة المعزولة" : "Start Isolated Simulation"}
                  </button>
                </div>

                {simulationResult && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 rounded-3xl border border-emerald-200 bg-emerald-50 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-800">
                        <ClipboardCheck className="w-5 h-5" />
                        <h4 className="text-xs font-black uppercase">{isAr ? "نتائج المحاكاة" : "Simulation Results"}</h4>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-600 font-bold">{simulationResult.id}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-2xl bg-white/50">
                        <div className="text-[9px] font-black text-emerald-600/60 uppercase">{isAr ? "وقت الاستعادة" : "Recovery Time"}</div>
                        <div className="text-sm font-black text-emerald-900">{simulationResult.durationMs}ms</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-white/50">
                        <div className="text-[9px] font-black text-emerald-600/60 uppercase">{isAr ? "دقة البيانات" : "Data Accuracy"}</div>
                        <div className="text-sm font-black text-emerald-900">{simulationResult.integrityScore}%</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-white/50">
                        <div className="text-[9px] font-black text-emerald-600/60 uppercase">{isAr ? "الامتثال لـ RTO" : "RTO Compliance"}</div>
                        <div className="text-sm font-black text-emerald-900">{simulationResult.rtoStatus}</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-white/50">
                        <div className="text-[9px] font-black text-emerald-600/60 uppercase">{isAr ? "السجلات المعالجة" : "Records Processed"}</div>
                        <div className="text-sm font-black text-emerald-900">{simulationResult.recordsProcessed.toLocaleString()}</div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "FAILSAFE" && (
            <motion.div
              key="failsafe"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
              <div className="max-w-md mx-auto space-y-6 text-center">
                <div className="w-20 h-20 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="w-10 h-10" />
                </div>
                <h3 className="text-sm font-black text-slate-900">{isAr ? "وضع الأمان المالي والتحكم في الطوارئ" : "Financial Fail-Safe & Emergency Control"}</h3>
                <p className="text-xs text-slate-500">{isAr ? "في حالات عدم اليقين أو أثناء الكوارث، يمكن تفعيل وضع الأمان لحماية البيانات المالية." : "In cases of uncertainty or disasters, fail-safe mode can be activated to protect financial data."}</p>

                <div className="p-6 rounded-3xl border border-slate-200 bg-slate-50 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">{isAr ? "الحالة الحالية" : "Current Fail-Safe State"}</span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                      failsafe.state === "NORMAL" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    }`}>
                      {failsafe.state}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 pt-4">
                    {[
                      { id: "NORMAL", labelAr: "وضع طبيعي", labelEn: "Normal Operation", color: "emerald" },
                      { id: "PROTECTED", labelAr: "وضع محمي", labelEn: "Protected Mode", color: "blue" },
                      { id: "READ_ONLY", labelAr: "للقراءة فقط", labelEn: "Read-Only Mode", color: "amber" },
                      { id: "EMERGENCY", labelAr: "وضع الطوارئ", labelEn: "Emergency Lock", color: "rose" },
                    ].map(mode => (
                      <button
                        key={mode.id}
                        onClick={() => setFinancialFailSafeState(mode.id as any, "Administrative override")}
                        className={`w-full py-3 rounded-2xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                          failsafe.state === mode.id 
                            ? `bg-${mode.color}-600 text-white border-transparent shadow-lg` 
                            : `bg-white text-slate-600 border-slate-200 hover:bg-slate-50`
                        }`}
                      >
                        {failsafe.state === mode.id ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        {isAr ? mode.labelAr : mode.labelEn}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-start gap-3 text-start">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-rose-700 leading-relaxed font-bold">
                    {isAr 
                      ? "تحذير: تغيير وضع الأمان المالي قد يؤدي إلى منع العمليات الحيوية للنظام. يجب أن يتم ذلك فقط من قبل المسؤولين المخولين." 
                      : "Warning: Changing the financial fail-safe state may block critical system operations. This should only be done by authorized administrators."}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
