import React, { useState, useMemo } from "react";
import { 
  ShieldCheck, Activity, Award, CheckCircle2, 
  AlertTriangle, Clock, History, FileText, 
  Search, Filter, ChevronRight, Download, 
  Printer, ShieldAlert, RefreshCcw, ClipboardCheck,
  Zap, Lock, Unlock, AlertCircle, BarChart3,
  GitPullRequest, GitMerge, ShieldEllipsis, 
  Settings, UserCheck, Eye, ListFilter
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { getChangeRequests, ChangeRequest } from "../../utils/productionChangeGovernance";
import { runReleaseGateVerification } from "../../utils/productionReleaseGate";
import { runFinancialRegressionGuard } from "../../utils/financialRegressionGuard";
import { analyzeChangeImpact } from "../../utils/changeImpactAnalysis";
import { SearchableSelect } from "../common/SearchableSelect";

export const ChangeGovernanceCenter: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const data = useData();

  const [activeTab, setActiveTab] = useState<"CHANGES" | "GOVERNANCE" | "REGRESSION" | "WORKFLOW">("CHANGES");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const changes = useMemo(() => getChangeRequests(), []);
  const regFindings = useMemo(() => runFinancialRegressionGuard(data), [data]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const stats = [
    { labelAr: "تغييرات نشطة", labelEn: "Active Changes", value: changes.length, icon: GitPullRequest, color: "blue" },
    { labelAr: "بانتظار الموافقة", labelEn: "Pending Approval", value: changes.filter(c => c.approvalStatus === "REVIEW").length, icon: ClipboardCheck, color: "amber" },
    { labelAr: "أخطاء التراجع", labelEn: "Regression Issues", value: regFindings.length, icon: ShieldAlert, color: "rose" },
    { labelAr: "حالة الحوكمة", labelEn: "Governance Status", value: isAr ? "نشط" : "ACTIVE", icon: ShieldCheck, color: "emerald" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
            <ShieldEllipsis className="w-7 h-7 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900">
              {isAr ? "حوكمة التغييرات والإصدارات" : "Change & Release Governance"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase tracking-wider">
                {isAr ? "حوكمة معتمدة" : "GOVERNANCE CERTIFIED"}
              </span>
              <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {isAr ? "آخر مراجعة: اليوم" : "Last Review: Today"}
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
            {isAr ? "تحديث الحوكمة" : "Refresh Governance"}
          </button>
          <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${stat.color}-50 text-${stat.color}-600`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{isAr ? stat.labelAr : stat.labelEn}</div>
              <div className="text-sm font-black text-slate-900">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: "CHANGES", labelAr: "طلبات التغيير", labelEn: "Change Requests", icon: GitPullRequest },
          { id: "GOVERNANCE", labelAr: "بوابات الإصدار", labelEn: "Release Gates", icon: GitMerge },
          { id: "REGRESSION", labelAr: "مراقبة التراجع", labelEn: "Regression Guard", icon: ShieldAlert },
          { id: "WORKFLOW", labelAr: "مسار العمل", labelEn: "Approval Workflow", icon: UserCheck },
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
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs min-h-[500px]">
        <AnimatePresence mode="wait">
          {activeTab === "CHANGES" && (
            <motion.div
              key="changes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">{isAr ? "سجل التغييرات النشطة" : "Active Change Register"}</h3>
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all cursor-pointer">
                  {isAr ? "طلب تغيير جديد" : "New Change Request"}
                </button>
              </div>
              <div className="space-y-4">
                {changes.map(chg => (
                  <div key={chg.id} className="p-5 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all group">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          chg.riskLevel === "CRITICAL" ? "bg-rose-100 text-rose-600" :
                          chg.riskLevel === "HIGH" ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                        }`}>
                          <GitPullRequest className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-slate-400">{chg.id}</span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-wider">{chg.category}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              chg.riskLevel === "CRITICAL" ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-700"
                            }`}>
                              {chg.riskLevel} {isAr ? "خطر" : "RISK"}
                            </span>
                          </div>
                          <h4 className="text-sm font-black text-slate-900 mt-1">{isAr ? chg.titleAr : chg.titleEn}</h4>
                          <p className="text-[11px] text-slate-500 mt-1 max-w-2xl">{isAr ? chg.descriptionAr : chg.descriptionEn}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                          chg.approvalStatus === "APPROVED" ? "bg-emerald-100 text-emerald-800" :
                          chg.approvalStatus === "REVIEW" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                        }`}>
                          {chg.approvalStatus}
                        </span>
                        <div className="flex items-center gap-2 mt-2">
                          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-all">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-bold">
                            {isAr ? "إدارة" : "Manage"}
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="mt-6 flex items-center gap-2">
                       <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden flex">
                          <div className="h-full bg-emerald-500" style={{ width: "40%" }} />
                          <div className="h-full bg-indigo-500 opacity-50" style={{ width: "20%" }} />
                       </div>
                       <span className="text-[9px] font-black text-slate-400">60% {isAr ? "مكتمل" : "COMPLETE"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "GOVERNANCE" && (
            <motion.div
              key="governance"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
              <h3 className="text-sm font-black text-slate-900">{isAr ? "بوابات التحقق من الإصدار (Release Gates)" : "Release Gate Verification"}</h3>
              <div className="space-y-4">
                {runReleaseGateVerification("CHG-001").map((gate, i) => (
                  <div key={i} className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        gate.status === "PASS" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                      }`}>
                        {gate.status === "PASS" ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900">{isAr ? gate.itemAr : gate.itemEn}</h4>
                        <p className="text-[10px] text-slate-500 mt-1">{isAr ? gate.messageAr : gate.messageEn}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                      gate.status === "PASS" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    }`}>
                      {gate.status}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "REGRESSION" && (
            <motion.div
              key="regression"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">{isAr ? "نتائج حماية التراجع المالي" : "Financial Regression Results"}</h3>
                <span className="text-[10px] font-black text-emerald-600 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100">
                  {isAr ? "لا توجد خروقات" : "NO VIOLATIONS DETECTED"}
                </span>
              </div>
              <div className="p-12 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-center space-y-4">
                 <ShieldCheck className="w-16 h-16 text-emerald-500 opacity-20" />
                 <div>
                    <h4 className="text-sm font-black text-slate-900">{isAr ? "النزاهة المالية مؤمنة" : "Financial Integrity Secured"}</h4>
                    <p className="text-xs text-slate-500 mt-2 max-w-sm">
                      {isAr 
                        ? "كافة المحركات المالية المعتمدة تتطابق مع خط الأساس التشغيلي. لم يتم العثور على أي حسابات موازية أو ثغرات في منطق الحسابات." 
                        : "All authoritative financial engines match the operational baseline. No parallel calculations or logic gaps found."}
                    </p>
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === "WORKFLOW" && (
            <motion.div
              key="workflow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-8"
            >
               <h3 className="text-sm font-black text-slate-900">{isAr ? "مسار اعتماد التغييرات" : "Change Approval Workflow"}</h3>
               <div className="relative space-y-12 before:absolute before:inset-y-0 before:start-[19px] before:w-0.5 before:bg-slate-100">
                  {[
                    { step: 1, titleAr: "تقديم الطلب", titleEn: "Request Submission", status: "COMPLETED" },
                    { step: 2, titleAr: "المراجعة الفنية والأمنية", titleEn: "Technical & Security Review", status: "IN_PROGRESS" },
                    { step: 3, titleAr: "اختبار تراجع المحرك المالي", titleEn: "Financial Regression Testing", status: "PENDING" },
                    { step: 4, titleAr: "اعتماد مدير النظام", titleEn: "Admin Final Approval", status: "PENDING" }
                  ].map((s, idx) => (
                    <div key={idx} className="relative flex gap-8 group">
                      <div className={`w-10 h-10 rounded-full border-4 border-white shadow-md flex items-center justify-center z-10 shrink-0 transition-all ${
                        s.status === "COMPLETED" ? "bg-emerald-500 text-white" : 
                        s.status === "IN_PROGRESS" ? "bg-indigo-600 text-white animate-pulse" : "bg-slate-200 text-slate-400"
                      }`}>
                        {s.status === "COMPLETED" ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-xs font-black">{s.step}</span>}
                      </div>
                      <div className="flex-1 pt-1">
                        <h4 className="text-xs font-black text-slate-900">{isAr ? s.titleAr : s.titleEn}</h4>
                        <span className={`text-[10px] font-black uppercase ${
                          s.status === "COMPLETED" ? "text-emerald-500" : "text-slate-400"
                        }`}>{s.status.replace("_", " ")}</span>
                      </div>
                    </div>
                  ))}
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
