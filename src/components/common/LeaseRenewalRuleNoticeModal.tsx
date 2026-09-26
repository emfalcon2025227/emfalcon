import React from "react";
import {
  AlertTriangle,
  Clock,
  Calendar,
  ShieldAlert,
  Info,
  X,
  CheckCircle2,
  FileText,
  Building,
  User,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { Lease } from "../../types";
import { getLeaseRenewalEligibility } from "../../utils/leaseRenewalRules";
import { Badge } from "./Badge";

interface LeaseRenewalRuleNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  lease: Lease | null;
  tenantName?: string;
  propertyName?: string;
  unitNumber?: string;
}

export const LeaseRenewalRuleNoticeModal: React.FC<LeaseRenewalRuleNoticeModalProps> = ({
  isOpen,
  onClose,
  lease,
  tenantName,
  propertyName,
  unitNumber,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  if (!isOpen || !lease) return null;

  const eligibility = getLeaseRenewalEligibility(lease, language as any);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* Header with High-Visibility Warning Banner */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 end-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md shrink-0 shadow-inner">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider bg-black/20 px-2.5 py-0.5 rounded-full inline-block mb-1">
                {isAr ? "لائحة وسياسة تجديد العقود" : "Lease Renewal Governance Policy"}
              </span>
              <h3 className="text-lg font-black leading-tight">
                {isAr ? "تنبيه: غير متاح تجديد هذا العقد حالياً" : "Notice: Contract Not Eligible for Renewal"}
              </h3>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Rule Statement Card */}
          <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{isAr ? "قاعدة اعتماد وتجديد العقود الإيجارية:" : "Tenancy Contract Renewal Rule:"}</span>
            </div>
            <p className="text-xs text-amber-800 dark:text-amber-400/90 leading-relaxed">
              {isAr
                ? "تنص اللائحة المحاسبية والإدارية على عدم إمكانية تجديد العقد إلا عند انتهائه رسمياً أو خلال فترة شهر واحد (30 يوماً) كحد أقصى قبل تاريخ الانتهاء المعتمد."
                : "Standard property management policy strictly restricts contract renewals to expired contracts or contracts within 30 days prior to their expiration date."}
            </p>
          </div>

          {/* Current Contract Status Breakdown */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {isAr ? "رقم العقد:" : "Lease #:"}
              </span>
              <span className="text-xs font-black text-slate-900 dark:text-slate-100 font-mono">
                {lease.leaseNumber}
              </span>
            </div>

            {(tenantName || propertyName || unitNumber) && (
              <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                {tenantName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{isAr ? "المستأجر:" : "Tenant:"}</span>
                    <span className="font-semibold">{tenantName}</span>
                  </div>
                )}
                {propertyName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{isAr ? "العقار والوحدة:" : "Property & Unit:"}</span>
                    <span className="font-semibold">{propertyName} {unitNumber ? `- وحدة ${unitNumber}` : ""}</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-500 block mb-1">
                  {isAr ? "تاريخ نهاية العقد:" : "Lease End Date:"}
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {lease.endDate}
                </span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-500 block mb-1">
                  {isAr ? "المتبقي على الانتهاء:" : "Time Remaining:"}
                </span>
                <span className="text-xs font-black text-amber-700 dark:text-amber-400 font-mono">
                  {eligibility.daysRemaining} {isAr ? "يوماً" : "days"}
                </span>
              </div>
            </div>

            {/* Earliest allowed renewal date */}
            <div className="p-3 bg-amber-100/60 dark:bg-amber-950/40 border border-amber-300/60 dark:border-amber-800/60 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-800 dark:text-amber-400" />
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                  {isAr ? "أقرب موعد مسموح لبدء التجديد:" : "Earliest Allowed Renewal Date:"}
                </span>
              </div>
              <span className="text-xs font-black text-amber-900 dark:text-amber-200 font-mono bg-white/80 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-700">
                {eligibility.earliestAllowedRenewalDate}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-800/60 p-3 rounded-xl">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              {isAr
                ? "يسمح النظام تلقائياً بفتح نافذة التجديد عند بلوغ التاريخ المسموح به أو في حال تم إنهاء العقد وإعادة جدولته."
                : "The system will automatically enable the renewal workflow once the contract reaches the 30-day window or upon expiration."}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            {isAr ? "حسناً، فهمت القاعدة" : "Understood, Close"}
          </button>
        </div>
      </div>
    </div>
  );
};
