
import React, { useState } from "react";
import { 
  ShieldCheck, Activity, Database, AlertTriangle, 
  CheckCircle2, Clock, Info, ShieldAlert, FileText, 
  History, Settings, HardDrive, Share2
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { runFinancialIntegrityWatchdog } from "../../utils/productionFinancialIntegrityWatchdog";
import { runConfigurationIntegrityCheck } from "../../utils/productionConfigurationIntegrity";
import { getProductionChanges, getOperationalIncidents } from "../../utils/productionChangeManagement";

export const ProductionGovernanceCenter: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const financialAudit = runFinancialIntegrityWatchdog();
  const configAudit = runConfigurationIntegrityCheck();
  const changes = getProductionChanges();
  const incidents = getOperationalIncidents();

  const [activeSubTab, setActiveSubTab] = useState<"HEALTH" | "FINANCIAL" | "CHANGES" | "INCIDENTS">("HEALTH");

  const overallHealth = financialAudit.status === "PASS" && configAudit.status === "PASS" ? "HEALTHY" : "WARNING";

  return (
    <div className="space-y-6">
      {/* Governance Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
            overallHealth === "HEALTHY" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
          }`}>
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900">
              {isAr ? "مركز حوكمة الإنتاج والرقابة" : "Production Governance & Monitoring"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                overallHealth === "HEALTHY" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}>
                {overallHealth}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">
                PROD-GOV-2026.08
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {[
          { id: "HEALTH", labelAr: "صحة النظام", labelEn: "System Health", icon: Activity },
          { id: "FINANCIAL", labelAr: "النزاهة المالية", labelEn: "Financial Integrity", icon: Database },
          { id: "CHANGES", labelAr: "إدارة التغيير", labelEn: "Change Management", icon: History },
          { id: "INCIDENTS", labelAr: "إدارة الحوادث", labelEn: "Incident Tracking", icon: AlertTriangle },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === tab.id ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{isAr ? tab.labelAr : tab.labelEn}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden min-h-[400px]">
        {activeSubTab === "HEALTH" && (
          <div className="p-6 space-y-6">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              {isAr ? "فحص تكامل الإعدادات والبيئة" : "Environment & Configuration Integrity"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {configAudit.details.map((d, idx) => (
                <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold text-slate-900">{isAr ? d.labelAr : d.labelEn}</div>
                    <div className="text-[11px] text-slate-500 mt-1">{isAr ? d.messageAr : d.messageEn}</div>
                  </div>
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    d.status === "PASS" ? "bg-emerald-100 text-emerald-800" : 
                    d.status === "NOT_CONFIGURED" ? "bg-slate-200 text-slate-600" : "bg-rose-100 text-rose-800"
                  }`}>
                    {d.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSubTab === "FINANCIAL" && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                {isAr ? "مراقبة نزاهة المحرك المالي" : "Financial Engine Integrity Watchdog"}
              </h3>
              <span className={`px-3 py-1 rounded-full text-xs font-black ${
                financialAudit.status === "PASS" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
              }`}>
                {financialAudit.status}
              </span>
            </div>
            <div className="space-y-3">
              {financialAudit.checks.map((c) => (
                <div key={c.checkId} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    c.status === "PASS" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                  }`}>
                    {c.status === "PASS" ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{c.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{c.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSubTab === "CHANGES" && (
          <div className="p-6 space-y-6">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              {isAr ? "سجل التغييرات المعتمدة للإنتاج" : "Controlled Production Change Log"}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="py-3 px-4 text-start">Change ID</th>
                    <th className="py-3 px-4 text-start">Module</th>
                    <th className="py-3 px-4 text-start">Category</th>
                    <th className="py-3 px-4 text-start">Risk</th>
                    <th className="py-3 px-4 text-start">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {changes.map((chg) => (
                    <tr key={chg.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{chg.id}</td>
                      <td className="py-3 px-4 text-slate-700">{chg.module}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
                          {chg.category}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          chg.risk === "CRITICAL" ? "bg-rose-100 text-rose-800" : 
                          chg.risk === "HIGH" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                        }`}>
                          {chg.risk}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{chg.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubTab === "INCIDENTS" && (
          <div className="p-6 space-y-6">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              {isAr ? "سجل تتبع الحوادث التشغيلية" : "Operational Incident Tracking"}
            </h3>
            {incidents.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-bold text-xs">
                {isAr ? "لا توجد حوادث نشطة" : "No active incidents recorded."}
              </div>
            ) : (
              <div className="space-y-3">
                {incidents.map((inc) => (
                  <div key={inc.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        inc.severity === "CRITICAL" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
                      }`}>
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 text-xs">{inc.id}</span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                            {inc.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 font-bold mt-1">{inc.description}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {new Date(inc.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
