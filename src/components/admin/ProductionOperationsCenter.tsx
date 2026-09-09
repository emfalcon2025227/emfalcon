import React from "react";
import { Activity, ShieldCheck, HardDrive, Database, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

export const ProductionOperationsCenter: React.FC = () => {
  const { language } = useLanguage();

  const healthItems = [
    { labelAr: "قاعدة البيانات", labelEn: "Database Connectivity", status: "HEALTHY" },
    { labelAr: "المحرك المالي", labelEn: "Financial Engine", status: "HEALTHY" },
    { labelAr: "التحقق من الصلاحيات (RBAC)", labelEn: "RBAC System", status: "HEALTHY" },
    { labelAr: "النسخ الاحتياطي", labelEn: "Backup System", status: "HEALTHY" },
    { labelAr: "التكامل الخارجي", labelEn: "External Integrations", status: "NOT VERIFIED" },
    { labelAr: "مراقبة الأخطاء", labelEn: "Error Monitoring", status: "HEALTHY" },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <h2 className="text-sm font-black text-slate-900 mb-6">
          {language === "ar" ? "مركز العمليات الإنتاجية (Phase 34)" : "Production Operations Center (Phase 34)"}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {healthItems.map((item, idx) => (
            <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                {language === "ar" ? item.labelAr : item.labelEn}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                item.status === "HEALTHY" ? "bg-emerald-100 text-emerald-800" : 
                item.status === "NOT VERIFIED" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
              }`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
