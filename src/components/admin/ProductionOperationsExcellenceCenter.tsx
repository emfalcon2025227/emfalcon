import React, { useState, useMemo } from "react";
import { 
  ShieldCheck, Activity, Award, CheckCircle2, 
  AlertTriangle, Clock, History, FileText, 
  Search, Filter, ChevronRight, Download, 
  Printer, ShieldAlert, RefreshCcw, ClipboardCheck,
  Zap, Lock, Unlock, AlertCircle, BarChart3,
  Database, Gauge, Target, Calendar, Settings2,
  TrendingUp, TrendingDown, Minus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { calculateProductionCapacity, CapacityMetric } from "../../utils/productionCapacityPlanning";
import { analyzeProductionPerformance, PerformanceMetric } from "../../utils/productionPerformanceAnalytics";
import { monitorProductionSla, SlaDefinition } from "../../utils/productionSlaMonitor";
import { getPreventiveMaintenanceTasks, MaintenanceTask } from "../../utils/productionPreventiveMaintenance";
import { calculateOperationalRiskScore, RiskReport } from "../../utils/productionOperationalRiskScore";
import { runFinancialStabilityScan } from "../../utils/financialEngineStabilityMonitor";
import { getOperationalThresholds } from "../../utils/productionOperationalThresholds";
import { monitorSecurityMaintenance } from "../../utils/productionSecurityMaintenance";
import { calculateProductionStabilityScore } from "../../utils/productionStabilityScore";

export const ProductionOperationsExcellenceCenter: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const data = useData();

  const [activeTab, setActiveTab] = useState<"DASHBOARD" | "CAPACITY" | "PERFORMANCE" | "MAINTENANCE" | "SLA">("DASHBOARD");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Memoized data for performance
  const capacity = useMemo(() => calculateProductionCapacity(data), [data]);
  const performance = useMemo(() => analyzeProductionPerformance(), []);
  const slas = useMemo(() => monitorProductionSla(), []);
  const maintenance = useMemo(() => getPreventiveMaintenanceTasks(), []);
  const risk = useMemo(() => calculateOperationalRiskScore(), []);
  const finStability = useMemo(() => runFinancialStabilityScan(), []);
  const stability = useMemo(() => calculateProductionStabilityScore(data), [data]);
  const thresholds = useMemo(() => getOperationalThresholds(), []);
  const security = useMemo(() => monitorSecurityMaintenance(), []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const kpis = [
    { labelAr: "معدل الاستقرار", labelEn: "Stability Score", value: `${stability.overall}%`, icon: Zap, color: "emerald", trend: "STABLE" },
    { labelAr: "مخاطر التشغيل", labelEn: "Operational Risk", value: risk.level, icon: AlertTriangle, color: risk.level === "LOW" ? "emerald" : "amber", trend: "DOWN" },
    { labelAr: "أداء النظام", labelEn: "System Performance", value: "92%", icon: Gauge, color: "blue", trend: "UP" },
    { labelAr: "الامتثال لـ SLA", labelEn: "SLA Compliance", value: "98.5%", icon: Target, color: "purple", trend: "STABLE" },
  ];

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
              {isAr ? "التميز التشغيلي والاستقرار طويل الأمد" : "Operational Excellence & Long-Term Stability"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                {isAr ? "إنتاج مستقر" : "STABLE PRODUCTION"}
              </span>
              <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {isAr ? "آخر تحديث قبل: 5 دقائق" : "Last updated: 5m ago"}
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
            {isAr ? "تحديث البيانات" : "Refresh Data"}
          </button>
          <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${kpi.color}-50 text-${kpi.color}-600`}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{isAr ? kpi.labelAr : kpi.labelEn}</div>
                <div className="text-sm font-black text-slate-900">{kpi.value}</div>
              </div>
            </div>
            {kpi.trend === "UP" ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : 
             kpi.trend === "DOWN" ? <TrendingDown className="w-4 h-4 text-rose-500" /> : 
             <Minus className="w-4 h-4 text-slate-300" />}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: "DASHBOARD", labelAr: "لوحة التحكم", labelEn: "Health Dashboard", icon: BarChart3 },
          { id: "CAPACITY", labelAr: "تخطيط السعة", labelEn: "Capacity Planning", icon: Database },
          { id: "PERFORMANCE", labelAr: "تحليل الأداء", labelEn: "Performance", icon: Gauge },
          { id: "MAINTENANCE", labelAr: "الصيانة الوقائية", labelEn: "Preventive Maintenance", icon: Calendar },
          { id: "SLA", labelAr: "مراقبة SLA", labelEn: "SLA Monitoring", icon: Target },
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
          {activeTab === "DASHBOARD" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* System Health Indicators */}
                <div className="lg:col-span-2 space-y-6">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    {isAr ? "مؤشرات صحة النظام" : "System Health Indicators"}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { name: "Stability", nameAr: "الاستقرار العام", value: stability.overall, icon: ShieldCheck },
                      { name: "Financial Integrity", nameAr: "النزاهة المالية", value: 100, icon: Lock },
                      { name: "Data Integrity", nameAr: "سلامة البيانات", value: 99, icon: CheckCircle2 },
                      { name: "Performance", nameAr: "أداء العمليات", value: 94, icon: Zap },
                    ].map(health => (
                      <div key={health.name} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <health.icon className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-black text-slate-700">{isAr ? health.nameAr : health.name}</span>
                          </div>
                          <span className="text-[10px] font-black text-emerald-600">HEALTHY</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${health.value}%` }}
                            className="h-full bg-slate-900"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Operational Risk Factors */}
                <div className="space-y-6">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {isAr ? "عوامل مخاطر التشغيل" : "Operational Risk Factors"}
                  </h3>
                  <div className="p-6 rounded-3xl bg-slate-900 text-white space-y-6">
                    <div className="text-center">
                      <div className="text-3xl font-black text-emerald-400">{risk.score}</div>
                      <div className="text-[10px] font-black text-slate-400 uppercase mt-1 tracking-widest">{isAr ? "مستوى المخاطر" : "Risk Level"}</div>
                      <div className="text-xs font-bold text-white mt-2 px-3 py-1 bg-emerald-500/20 rounded-full inline-block border border-emerald-500/30">
                        {risk.level}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {risk.factors.map(f => (
                        <div key={f.nameEn} className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">{isAr ? f.nameAr : f.nameEn}</span>
                          <span className={f.status === "NORMAL" ? "text-emerald-400" : "text-amber-400"}>{f.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stability Trend Table (Simulated) */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-900">{isAr ? "تحليل اتجاه الاستقرار" : "Stability Trend Analysis"}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <tr>
                        <th className="py-3 px-4 text-start">{isAr ? "التاريخ" : "Date"}</th>
                        <th className="py-3 px-4 text-start">{isAr ? "مستوى الاستقرار" : "Stability Level"}</th>
                        <th className="py-3 px-4 text-start">{isAr ? "الحوادث" : "Incidents"}</th>
                        <th className="py-3 px-4 text-start">{isAr ? "الأداء" : "Performance"}</th>
                        <th className="py-3 px-4 text-start">{isAr ? "الحالة" : "Status"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        { date: "20/08/2026", stability: "98%", incidents: 0, perf: "95%", status: "OPTIMAL" },
                        { date: "19/08/2026", stability: "97%", incidents: 1, perf: "94%", status: "OPTIMAL" },
                        { date: "18/08/2026", stability: "94%", incidents: 3, perf: "92%", status: "WARNING" },
                      ].map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-all">
                          <td className="py-4 px-4 font-bold text-slate-900">{row.date}</td>
                          <td className="py-4 px-4 font-black text-slate-700">{row.stability}</td>
                          <td className="py-4 px-4 font-bold text-slate-500">{row.incidents}</td>
                          <td className="py-4 px-4 font-bold text-slate-500">{row.perf}</td>
                          <td className="py-4 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              row.status === "OPTIMAL" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                            }`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "CAPACITY" && (
            <motion.div
              key="capacity"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">{isAr ? "تحليل السعة واتجاهات النمو" : "Capacity Analysis & Growth Trends"}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase">{isAr ? "أفق التوقع:" : "Forecast Horizon:"}</span>
                  <span className="text-[10px] font-bold text-slate-900">6 {isAr ? "أشهر" : "Months"}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {capacity.map(metric => (
                  <div key={metric.nameEn} className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">{isAr ? metric.nameAr : metric.nameEn}</span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        +{metric.growthPercentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-2xl font-black text-slate-900">{metric.current.toLocaleString()}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">{isAr ? "الحالي" : "Current Count"}</div>
                      </div>
                      <div className="text-end">
                        <div className="text-sm font-black text-slate-500">{metric.estimatedFutureVolume.toLocaleString()}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">{isAr ? "المتوقع" : "Projected"}</div>
                      </div>
                    </div>
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-slate-400" 
                        style={{ width: `${Math.min(100, (metric.current / metric.capacityWarningLevel) * 100)}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "PERFORMANCE" && (
            <motion.div
              key="performance"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
              <h3 className="text-sm font-black text-slate-900">{isAr ? "قياسات الأداء المرجعية" : "Performance Benchmark Measurements"}</h3>
              <div className="space-y-4">
                {performance.map(perf => (
                  <div key={perf.operation} className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        perf.rating === "EXCELLENT" ? "bg-emerald-100 text-emerald-600" :
                        perf.rating === "NORMAL" ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"
                      }`}>
                        <Gauge className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900">{isAr ? perf.operationAr : perf.operation}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-slate-400">{isAr ? "الهدف:" : "Target:"} {perf.baselineMs}ms</span>
                          <span className="text-[10px] text-slate-300">|</span>
                          <span className="text-[10px] font-bold text-slate-400">{new Date(perf.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-end">
                      <div className={`text-sm font-black ${
                        perf.durationMs <= perf.baselineMs ? "text-emerald-600" : "text-amber-600"
                      }`}>{perf.durationMs}ms</div>
                      <div className={`text-[10px] font-black uppercase mt-1 ${
                        perf.rating === "EXCELLENT" ? "text-emerald-500" : "text-slate-400"
                      }`}>{perf.rating}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "MAINTENANCE" && (
            <motion.div
              key="maintenance"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">{isAr ? "جدول الصيانة الوقائية" : "Preventive Maintenance Schedule"}</h3>
                <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-bold flex items-center gap-2 hover:bg-slate-800 transition-all cursor-pointer">
                  <Calendar className="w-3 h-3" />
                  {isAr ? "إضافة مهمة" : "Add Task"}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {maintenance.map(task => (
                  <div key={task.id} className="p-4 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          task.status === "COMPLETED" ? "bg-emerald-100 text-emerald-600" :
                          task.status === "OVERDUE" ? "bg-rose-100 text-rose-600" :
                          task.status === "FAILED" ? "bg-slate-900 text-white" : "bg-blue-100 text-blue-600"
                        }`}>
                          <Settings2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[10px] font-mono font-bold text-slate-400">{task.id}</div>
                          <div className="text-xs font-black text-slate-900">{isAr ? task.nameAr : task.nameEn}</div>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        task.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" :
                        task.status === "OVERDUE" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-600"
                      }`}>
                        {task.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-2">{isAr ? task.descriptionAr : task.descriptionEn}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                      <div className="text-[10px] text-slate-400">
                        {isAr ? "تاريخ الاستحقاق:" : "Due Date:"} <span className="font-bold text-slate-700">{new Date(task.nextDueDate).toLocaleDateString(isAr ? "ar-EG" : "en-US")}</span>
                      </div>
                      <button className="text-[10px] font-black text-slate-900 hover:underline cursor-pointer">
                        {isAr ? "إجراء الآن" : "Run Now"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "SLA" && (
            <motion.div
              key="sla"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
              <h3 className="text-sm font-black text-slate-900">{isAr ? "تقرير الامتثال لاتفاقية مستوى الخدمة" : "SLA Compliance Report"}</h3>
              <div className="space-y-3">
                {slas.map(sla => (
                  <div key={sla.id} className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4 group hover:bg-slate-50 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-10 rounded-full ${
                        sla.status === "HEALTHY" ? "bg-emerald-500" : "bg-amber-500"
                      }`} />
                      <div>
                        <h4 className="text-xs font-black text-slate-900">{isAr ? sla.metricAr : sla.metricEn}</h4>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {isAr ? "آخر قياس:" : "Last measured:"} {new Date(sla.lastMeasured).toLocaleString(isAr ? "ar-EG" : "en-US")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-center">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isAr ? "المستهدف" : "Target"}</div>
                        <div className="text-xs font-black text-slate-700">{sla.target}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isAr ? "الفعلي" : "Actual"}</div>
                        <div className="text-xs font-black text-emerald-600">{sla.actual}</div>
                      </div>
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
