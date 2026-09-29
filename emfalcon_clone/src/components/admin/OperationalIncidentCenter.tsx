
import React, { useState, useMemo } from "react";
import { 
  AlertTriangle, ShieldCheck, Activity, Bell, 
  Clock, CheckCircle2, AlertCircle, User, 
  Search, Filter, ChevronRight, History, 
  ShieldAlert, Settings, Info, RefreshCcw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { getActiveAlerts, acknowledgeAlert, resolveAlert, ProductionAlert } from "../../utils/productionAlertEngine";
import { getIncidents, updateIncidentStatus, assignIncident, OperationalIncident } from "../../utils/productionIncidentManagement";
import { runProductionAutomationCycle } from "../../utils/productionAutomationBridge";
import { SearchableSelect } from "../common/SearchableSelect";

export const OperationalIncidentCenter: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const data = useData();

  const [activeTab, setActiveTab] = useState<"ALERTS" | "INCIDENTS" | "MAINTENANCE">("ALERTS");
  const [isProcessing, setIsProcessing] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceReason, setMaintenanceReason] = useState("");

  const alerts = getActiveAlerts();
  const incidents = getIncidents();

  const handleRunCycle = () => {
    setIsProcessing(true);
    setTimeout(() => {
      runProductionAutomationCycle(data);
      setIsProcessing(false);
    }, 1000);
  };

  const kpis = useMemo(() => [
    { labelAr: "تنبيهات نشطة", labelEn: "Active Alerts", value: alerts.length, color: "rose", icon: Bell },
    { labelAr: "حوادث مفتوحة", labelEn: "Open Incidents", value: incidents.filter(i => i.status !== "CLOSED" && i.status !== "RESOLVED").length, color: "amber", icon: AlertTriangle },
    { labelAr: "تم حلها اليوم", labelEn: "Resolved Today", value: incidents.filter(i => i.status === "RESOLVED").length, color: "emerald", icon: CheckCircle2 },
    { labelAr: "صحة النظام", labelEn: "System Health", value: "98%", color: "blue", icon: Activity },
  ], [alerts.length, incidents]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900">
              {isAr ? "مركز المرونة التشغيلية والاستجابة للحوادث" : "Operational Resilience & Incident Response"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${maintenanceMode ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
                {maintenanceMode ? (isAr ? "وضع الصيانة نشط" : "Maintenance Active") : (isAr ? "النظام يعمل" : "System Operational")}
              </span>
              <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {isAr ? "تحديث تلقائي مفعل" : "Auto-refresh enabled"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunCycle}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCcw className={`w-4 h-4 ${isProcessing ? "animate-spin" : ""}`} />
            {isAr ? "بدء فحص الحوكمة" : "Run Governance Cycle"}
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
              <div className="text-lg font-black text-slate-900">{kpi.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {[
          { id: "ALERTS", labelAr: "التنبيهات النشطة", labelEn: "Active Alerts", icon: Bell },
          { id: "INCIDENTS", labelAr: "إدارة الحوادث", labelEn: "Incident Management", icon: AlertTriangle },
          { id: "MAINTENANCE", labelAr: "وضع الصيانة", labelEn: "Maintenance Mode", icon: Settings },
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
          {activeTab === "ALERTS" && (
            <motion.div
              key="alerts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">{isAr ? "تنبيهات العمليات النشطة" : "Active Operational Alerts"}</h3>
              </div>

              {alerts.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  {isAr ? "لا توجد تنبيهات نشطة حالياً." : "No active alerts currently detected."}
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map(alert => (
                    <div key={alert.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          alert.severity === "CRITICAL" ? "bg-rose-100 text-rose-600" : 
                          alert.severity === "HIGH" ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                        }`}>
                          <AlertCircle className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-400 text-[10px]">{alert.id}</span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[9px] font-black uppercase">{alert.category}</span>
                            <span className="text-[10px] text-slate-400 font-bold">{alert.occurrenceCount} occurrences</span>
                          </div>
                          <h4 className="text-xs font-black text-slate-900 mt-1">{isAr ? alert.titleAr : alert.titleEn}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">{isAr ? alert.descriptionAr : alert.descriptionEn}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                          onClick={() => acknowledgeAlert(alert.id, "Admin")}
                          disabled={alert.status === "ACKNOWLEDGED"}
                          className="flex-1 md:flex-none px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {isAr ? "تأكيد" : "Acknowledge"}
                        </button>
                        <button
                          onClick={() => resolveAlert(alert.id, "Admin", "Resolved via Dashboard")}
                          className="flex-1 md:flex-none px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-bold hover:bg-slate-800 transition-all cursor-pointer"
                        >
                          {isAr ? "حل المشكلة" : "Resolve"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "INCIDENTS" && (
            <motion.div
              key="incidents"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
              <h3 className="text-sm font-black text-slate-900">{isAr ? "سجل الحوادث والتعامل معها" : "Incident Management & Response"}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <tr>
                      <th className="py-3 px-4 text-start">Incident ID</th>
                      <th className="py-3 px-4 text-start">Severity</th>
                      <th className="py-3 px-4 text-start">Status</th>
                      <th className="py-3 px-4 text-start">Assigned To</th>
                      <th className="py-3 px-4 text-start">Module</th>
                      <th className="py-3 px-4 text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {incidents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                          {isAr ? "لا توجد حوادث مسجلة." : "No incidents recorded."}
                        </td>
                      </tr>
                    ) : (
                      incidents.map(inc => (
                        <tr key={inc.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{inc.id}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              inc.severity === "CRITICAL" ? "bg-rose-100 text-rose-800" : 
                              inc.severity === "HIGH" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                            }`}>
                              {inc.severity}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
                              {inc.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-700">{inc.assignedUser || (isAr ? "غير معين" : "Unassigned")}</td>
                          <td className="py-3 px-4 text-slate-500">{inc.affectedModule}</td>
                          <td className="py-3 px-4 text-end">
                            <button className="p-1 hover:bg-slate-100 rounded text-slate-400">
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
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
              <div className="max-w-md space-y-6">
                <div>
                  <h3 className="text-sm font-black text-slate-900">{isAr ? "وضع الصيانة النشط" : "Controlled Maintenance Mode"}</h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {isAr 
                      ? "تفعيل وضع الصيانة سيمنع المستخدمين العاديين من الوصول إلى النظام مؤقتاً." 
                      : "Activating maintenance mode will temporarily prevent regular users from accessing the system."}
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">{isAr ? "الحالة الحالية" : "Current Status"}</span>
                    <button
                      onClick={() => setMaintenanceMode(!maintenanceMode)}
                      className={`w-12 h-6 rounded-full transition-all relative ${maintenanceMode ? "bg-rose-500" : "bg-slate-300"}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isAr ? (maintenanceMode ? "left-1" : "left-7") : (maintenanceMode ? "left-7" : "left-1")}`} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase">{isAr ? "سبب الصيانة" : "Maintenance Reason"}</label>
                    <textarea
                      value={maintenanceReason}
                      onChange={(e) => setMaintenanceReason(e.target.value)}
                      placeholder={isAr ? "أدخل سبب الصيانة هنا..." : "Enter maintenance reason..."}
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-900 transition-all min-h-[80px]"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-100">
                  <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700 leading-relaxed font-bold">
                    {isAr 
                      ? "تنبيه: جميع التغييرات في وضع الصيانة يتم تسجيلها في سجل التدقيق لأغراض الامتثال." 
                      : "Note: All maintenance mode changes are recorded in the audit trail for compliance purposes."}
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
