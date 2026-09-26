/**
 * Phase 29 Production Configuration & Readiness Center
 * Displays environment health, security status, and system readiness for Go-Live.
 */

import React, { useState, useEffect } from "react";
import {
  ShieldCheck, Database, Cloud, AlertTriangle, CheckCircle2,
  Lock, RefreshCw, Settings, FileText, Server, Shield
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { getSystemHealthDiagnostics } from "../../utils/productionIntegrity";

export const ProductionReadinessCenter: React.FC = () => {
  const { language } = useLanguage();
  const { companyProfile } = useData();
  const { currentUser } = useAuth();
  const [diagnostics, setDiagnostics] = useState(getSystemHealthDiagnostics(currentUser?.role, currentUser?.id));

  const isAr = language === "ar";

  useEffect(() => {
    // Refresh diagnostics periodically
    const interval = setInterval(() => {
      setDiagnostics(getSystemHealthDiagnostics(currentUser?.role, currentUser?.id));
    }, 10000);
    return () => clearInterval(interval);
  }, [currentUser]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Shield className="w-6 h-6 text-indigo-600" />
          {isAr ? "مركز جاهزية العمليات للإنتاج (Go-Live Readiness Center)" : "Production Readiness & Operations Center"}
        </h2>
        <p className="text-xs text-slate-500 mt-2">
          {isAr 
            ? "لوحة تحكم إدارية مركزية للتحقق من سلامة النظام، أمن البيانات، وتكامل الإعدادات قبل التشغيل الفعلي."
            : "Centralized administrative dashboard for system health, data security, and operational readiness verification."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Application Status */}
        <ReadinessSection
          title={isAr ? "حالة التطبيق" : "Application Status"}
          icon={<Server className="w-5 h-5 text-sky-600" />}
          items={[
            { label: isAr ? "الإصدار" : "Version", value: diagnostics.appVersion },
            { label: isAr ? "البيئة" : "Environment", value: diagnostics.environment },
            { label: isAr ? "قاعدة البيانات" : "Database", value: diagnostics.databaseStatus.provider },
          ]}
        />

        {/* Security & Access */}
        <ReadinessSection
          title={isAr ? "الأمن والتحكم" : "Security & Access"}
          icon={<Lock className="w-5 h-5 text-rose-600" />}
          items={[
            { label: isAr ? "المصادقة" : "Authentication", value: diagnostics.authStatus.authenticated ? (isAr ? "مفعل" : "Active") : (isAr ? "غير مفعل" : "Inactive") },
            { label: isAr ? "صلاحيات RBAC" : "RBAC Status", value: diagnostics.authStatus.hasAdminRights ? (isAr ? "مفعل" : "Active") : (isAr ? "غير مفعل" : "Inactive") },
            { label: isAr ? "حماية البيانات المالية" : "Financial Protection", value: isAr ? "مفعل" : "Active" },
          ]}
        />

        {/* External Services */}
        <ReadinessSection
          title={isAr ? "الخدمات الخارجية" : "External Services"}
          icon={<Cloud className="w-5 h-5 text-emerald-600" />}
          items={diagnostics.services.map(s => ({
            label: isAr ? s.serviceNameAr : s.serviceNameEn,
            value: s.status === "ONLINE" ? (isAr ? "متصل" : "Connected") : (isAr ? "غير متحقق منه" : "Not verified")
          }))}
        />
      </div>
    </div>
  );
};

const ReadinessSection: React.FC<{ title: string; icon: React.ReactNode; items: { label: string; value: string }[] }> = ({ title, icon, items }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
    <div className="flex items-center gap-2">
      {icon}
      <h3 className="font-black text-slate-900 text-sm">{title}</h3>
    </div>
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex justify-between text-xs border-b border-slate-100 pb-1">
          <span className="text-slate-500">{item.label}</span>
          <span className="font-bold text-slate-800">{item.value}</span>
        </div>
      ))}
    </div>
  </div>
);
