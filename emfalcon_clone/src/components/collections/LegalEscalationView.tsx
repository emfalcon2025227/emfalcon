import React, { useMemo } from "react";
import {
  Gavel,
  AlertTriangle,
  ArrowRight,
  User,
  Scale,
  FileText,
  Clock,
  Building2,
  Receipt,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";

export const LegalEscalationView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { tenants, properties, leases, getTenantReceivablePosition, addCase, cases } = useData();

  const escalationList = useMemo(() => {
    return tenants
      .map(t => {
        const pos = getTenantReceivablePosition(t.id);
        const activeLease = leases.find(l => l.tenantId === t.id && (l.contractStatus === "ACTIVE" || l.contractStatus === "RENEWED"));
        const property = activeLease ? properties.find(p => p.id === activeLease.propertyId) : null;
        const existingCase = cases.find(c => c.tenantId === t.id && c.status !== "CLOSED" && c.status !== "SETTLED");
        
        return {
          ...pos,
          tenant: t,
          lease: activeLease,
          property,
          existingCase
        };
      })
      .filter(p => p.priority === "CRITICAL" || p.status === "LEGAL_ESCALATION" || p.bouncedChequeAmount > 0)
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [tenants, getTenantReceivablePosition, leases, properties, cases]);

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 rounded-3xl p-6 flex items-start gap-4">
        <div className="p-3 bg-rose-600 rounded-2xl text-white shadow-lg shadow-rose-600/20">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-lg font-bold text-rose-800 dark:text-rose-400">
            {isAr ? "تحذير: حالات حرجة تتطلب تصعيد قانوني" : "Warning: Critical Cases Requiring Legal Escalation"}
          </h4>
          <p className="text-sm text-rose-700 dark:text-rose-400/80 mt-1">
            {isAr 
              ? "تم تحديد المستأجرين أدناه كحالات حرجة جداً بناءً على مبالغ الشيكات المرتجعة أو فترات التأخير التي تتجاوز 120 يوماً." 
              : "The tenants below are identified as critical based on bounced cheque amounts or overdue periods exceeding 120 days."}
          </p>
        </div>
      </div>

      {/* Escalation Cards */}
      <div className="grid grid-cols-1 gap-6">
        {escalationList.map((p) => (
          <div key={p.tenantId} className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row gap-6 relative overflow-hidden group">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 -mr-16 -mt-16 rounded-full" />
            
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 flex items-center justify-center border border-rose-100 dark:border-rose-900/50">
                    <User className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{isAr ? p.tenant.nameAr : p.tenant.nameEn}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>{p.property ? (isAr ? p.property.nameAr : p.property.nameEn) : "---"}</span>
                      </div>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <div className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        <span>{isAr ? "عقد #" : "Lease #"} {p.lease?.leaseNumber || "---"}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                   <div className="text-[10px] font-bold text-slate-400 uppercase">{isAr ? "إجمالي المديونية" : "Total Debt"}</div>
                   <div className="text-2xl font-bold text-rose-600 font-mono">{p.outstanding.toLocaleString()} AED</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                 <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "شيكات مرتجعة" : "Bounced"}</div>
                    <div className="text-sm font-bold text-rose-600">{p.bouncedChequeAmount.toLocaleString()}</div>
                 </div>
                 <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "تأخير > 120 يوم" : "121+ Days"}</div>
                    <div className="text-sm font-bold text-rose-800 dark:text-rose-400">{p.aging.days121Plus.toLocaleString()}</div>
                 </div>
                 <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "رسوم قانونية" : "Legal Fees"}</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{p.legalChargesDue.toLocaleString()}</div>
                 </div>
                 <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? "الحالة الحالية" : "Current Status"}</div>
                    <div className="text-xs font-bold text-rose-600 truncate">{p.status}</div>
                 </div>
              </div>

              <div className="space-y-2">
                 <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
                   <AlertTriangle className="w-3 h-3" />
                   <span>{isAr ? "أسباب التصعيد" : "Escalation Reasons"}</span>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {p.priorityReasons.map((reason, idx) => (
                      <span key={idx} className="px-3 py-1 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 rounded-lg text-[10px] font-bold border border-rose-100 dark:border-rose-900/30">
                        {reason}
                      </span>
                    ))}
                 </div>
              </div>
            </div>

            <div className="md:w-64 flex flex-col justify-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-3xl border border-slate-100 dark:border-slate-700">
               {p.existingCase ? (
                 <div className="text-center py-4">
                   <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                     <Scale className="w-6 h-6" />
                   </div>
                   <div className="text-xs font-bold text-emerald-600">{isAr ? "قضية مفتوحة نشطة" : "Active Case Open"}</div>
                   <div className="text-[10px] text-slate-400 mt-1">#{p.existingCase.caseNumber}</div>
                   <button className="mt-4 text-xs font-bold text-emerald-600 hover:underline flex items-center justify-center gap-1 w-full">
                     <span>{isAr ? "عرض تفاصيل القضية" : "View Case Details"}</span>
                     <ExternalLink className="w-3 h-3" />
                   </button>
                 </div>
               ) : (
                 <>
                   <button className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-all">
                     <span>{isAr ? "إرسال إنذار عدلي" : "Send Legal Notice"}</span>
                     <FileText className="w-4 h-4 text-rose-600" />
                   </button>
                   <button className="w-full flex items-center justify-between px-4 py-3 bg-rose-600 text-white rounded-2xl text-xs font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20">
                     <span>{isAr ? "فتح قضية إخلاء/مطالبة" : "Open Eviction Case"}</span>
                     <Gavel className="w-4 h-4" />
                   </button>
                   <p className="text-[10px] text-slate-400 text-center mt-1">
                     {isAr ? "سيتم ترحيل كافة المديونيات للمطالبة" : "All debts will be posted to the claim"}
                   </p>
                 </>
               )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
