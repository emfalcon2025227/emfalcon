import React from "react";
import { CompanyProfile } from "../../../types";
import { UniversalReportFilters } from "../../../types/reportingTypes";
import { useLanguage } from "../../../context/LanguageContext";

interface ReportPrintHeaderProps {
  reportTitleAr: string;
  reportTitleEn: string;
  reportSubtitleAr?: string;
  reportSubtitleEn?: string;
  companyProfile: CompanyProfile;
  filters: UniversalReportFilters;
  filterSummary?: string;
  reportRef?: string;
}

export const ReportPrintHeader: React.FC<ReportPrintHeaderProps> = ({
  reportTitleAr,
  reportTitleEn,
  reportSubtitleAr,
  reportSubtitleEn,
  companyProfile,
  filters,
  filterSummary,
  reportRef = `RPT-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const companyName = isAr ? companyProfile.nameAr : companyProfile.nameEn;
  const companyAddress = isAr
    ? companyProfile.addressAr || companyProfile.address
    : companyProfile.addressEn || companyProfile.address;

  const formattedDate = new Date().toLocaleDateString(isAr ? "ar-AE" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  
  const formattedTime = new Date().toLocaleTimeString(isAr ? "ar-AE" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });

  const logoSrc = companyProfile.logoUrl || companyProfile.logoBase64 || companyProfile.logo;

  return (
    <div className="space-y-6 print:space-y-4 mb-8 print:mb-6 relative">
      {/* Decorative Side Accents for "Official Paper" Look */}
      <div className="absolute -left-6 top-0 bottom-0 w-1 bg-slate-900/10 print:hidden hidden sm:block"></div>
      
      {/* Official Header */}
      <div className="flex justify-between items-start border-b-4 border-double border-slate-900 dark:border-white pb-6 print:pb-4">
        <div className="space-y-2">
          <div className="flex items-center gap-4 print:gap-3">
            {logoSrc ? (
              <div className="p-1 bg-white rounded-lg shadow-sm print:shadow-none border border-slate-100 shrink-0">
                <img
                  src={logoSrc}
                  alt="Logo"
                  className="h-16 print:h-12 w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="h-16 w-16 bg-slate-900 flex items-center justify-center rounded-lg shrink-0">
                <span className="text-white font-black text-xl">EF</span>
              </div>
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl print:text-xl font-black text-slate-900 dark:text-white uppercase leading-none font-sans">
                {companyName || "Emirates Falcon Real Estate"}
              </h1>
              <p className="text-[11px] print:text-[9px] font-bold text-slate-500 mt-1 uppercase font-sans">
                {companyAddress || "United Arab Emirates"}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 print:gap-3 text-[11px] print:text-[8px] font-bold text-slate-400 pt-2 border-t border-slate-100 mt-2 font-sans">
            {companyProfile.vatTrn && (
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                <span className="text-slate-600 dark:text-slate-300 uppercase">TRN:</span> 
                <span className="font-mono text-slate-900 dark:text-white">{companyProfile.vatTrn}</span>
              </div>
            )}
            {companyProfile.phone && (
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                <span className="text-slate-600 dark:text-slate-300 uppercase">Tel:</span> 
                <span className="font-mono text-slate-900 dark:text-white">{companyProfile.phone}</span>
              </div>
            )}
            {companyProfile.email && (
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                <span className="text-slate-600 dark:text-slate-300 uppercase">Email:</span> 
                <span className="font-mono text-slate-900 dark:text-white lowercase">{companyProfile.email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Report Metadata Box - Formal Arrangement */}
        <div className="text-right rtl:text-left min-w-[180px] print:min-w-[140px]">
          <div className="mb-3">
            <h2 className="text-lg print:text-sm font-black text-slate-900 dark:text-white uppercase leading-tight font-sans">
              {isAr ? reportTitleAr : reportTitleEn}
            </h2>
            {(reportSubtitleAr || reportSubtitleEn) && (
              <p className="text-[10px] print:text-[8px] font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 uppercase font-sans">
                {isAr ? reportSubtitleAr : reportSubtitleEn}
              </p>
            )}
          </div>
          
          <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900/50 p-3 print:p-2 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center gap-4 text-[10px] print:text-[8px]">
              <span className="text-slate-500 font-bold uppercase">{isAr ? "المرجع" : "Reference"}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{reportRef}</span>
            </div>
            <div className="flex justify-between items-center gap-4 text-[10px] print:text-[8px]">
              <span className="text-slate-500 font-bold uppercase">{isAr ? "التاريخ" : "Date"}</span>
              <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap">{formattedDate}</span>
            </div>
            <div className="flex justify-between items-center gap-4 text-[10px] print:text-[8px]">
              <span className="text-slate-500 font-bold uppercase">{isAr ? "الوقت" : "Time"}</span>
              <span className="font-bold text-slate-900 dark:text-white">{formattedTime}</span>
            </div>
            <div className="h-px bg-slate-200 dark:bg-slate-800 my-1"></div>
            <div className="flex justify-between items-center gap-4 text-[10px] print:text-[8px]">
              <span className="text-slate-500 font-bold uppercase">{isAr ? "الحالة" : "Status"}</span>
              <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-black uppercase">
                {isAr ? "معتمد" : "Certified"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Context Bar - Refined */}
      <div className="flex flex-col sm:flex-row items-stretch gap-4 print:gap-2">
        <div className="flex-1 bg-white dark:bg-slate-950 p-4 print:p-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-6 print:gap-4">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase font-sans">{isAr ? "النطاق الزمني" : "REPORTING PERIOD"}</p>
              <div className="flex items-center gap-2">
                {filters.fromDate || filters.toDate ? (
                  <span className="text-xs print:text-[10px] font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="font-mono bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900">{filters.fromDate || "EARLIEST"}</span>
                    <span className="text-slate-400">→</span>
                    <span className="font-mono bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900">{filters.toDate || "LATEST"}</span>
                  </span>
                ) : (
                  <span className="text-xs print:text-[10px] font-bold text-slate-600 italic">
                    {isAr ? "جميع البيانات التاريخية (Full History)" : "Consolidated Historical Data"}
                  </span>
                )}
              </div>
            </div>

            {filterSummary && (
              <div className="border-l-2 border-slate-100 dark:border-slate-800 pl-6 rtl:pr-6 rtl:border-r-2 rtl:border-l-0 space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase font-sans">{isAr ? "معايير التدقيق" : "AUDIT CRITERIA"}</p>
                <p className="text-xs print:text-[10px] font-bold text-slate-800 dark:text-slate-200">{filterSummary}</p>
              </div>
            )}
          </div>

          <div className="hidden sm:flex flex-col items-end gap-1">
            <div className="text-[10px] font-black text-slate-900 dark:text-white uppercase font-sans flex items-center gap-1.5">
              <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse print:hidden"></div>
              <span>{isAr ? "مستند رسمي مصدق" : "OFFICIAL CERTIFIED DOCUMENT"}</span>
            </div>
            <p className="text-[8px] font-bold text-slate-400 italic">Valid for Legal & Commercial Use</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ReportPrintFooter: React.FC<{ isAr: boolean }> = ({ isAr }) => {
  return (
    <div className="mt-16 print:mt-10 pt-8 print:pt-6 border-t-2 border-slate-900 grid grid-cols-1 sm:grid-cols-3 gap-8 print:gap-4 text-[10px] print:text-[8px] font-sans">
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="font-black text-slate-900 uppercase font-sans">
            {isAr ? "إعداد القسم المالي" : "PREPARED BY FINANCE"}
          </p>
          <p className="text-slate-500 font-bold italic">{isAr ? "المحاسب المسؤول" : "Responsible Accountant"}</p>
        </div>
        <div className="pt-8">
          <div className="w-40 h-px bg-slate-400"></div>
          <p className="mt-1 text-[8px] text-slate-400 uppercase font-sans">Sign & Date / التوقيع والتاريخ</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center space-y-2">
        <div className="w-24 h-24 print:w-20 print:h-20 rounded-full border-4 border-double border-slate-200 flex items-center justify-center text-center p-2 rotate-[-5deg]">
          <div className="text-[8px] font-black text-slate-300 leading-tight uppercase font-sans">
            {isAr ? "ختم المؤسسة الرسمي" : "OFFICIAL CORPORATE SEAL"}
          </div>
        </div>
        <p className="text-[7px] font-bold text-slate-300 uppercase italic">Document Authenticity Verified</p>
      </div>

      <div className="space-y-4 text-right rtl:text-left">
        <div className="space-y-1">
          <p className="font-black text-slate-900 uppercase font-sans">
            {isAr ? "اعتماد الإدارة العليا" : "EXECUTIVE APPROVAL"}
          </p>
          <p className="text-slate-500 font-bold italic">{isAr ? "المدير العام / الشريك" : "Managing Director / Partner"}</p>
        </div>
        <div className="pt-8 flex flex-col items-end rtl:items-start">
          <div className="w-40 h-px bg-slate-400"></div>
          <p className="mt-1 text-[8px] text-slate-400 uppercase font-sans">Official Endorsement / المصادقة الرسمية</p>
        </div>
      </div>
    </div>
  );
};
