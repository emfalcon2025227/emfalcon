import React from "react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";

export interface OfficePrintHeaderProps {
  titleAr: string;
  titleEn: string;
  subtitleAr?: string;
  subtitleEn?: string;
  refNumber?: string;
  extraInfo?: Array<{ labelAr: string; labelEn: string; value: string }>;
  className?: string;
  hideOnScreen?: boolean;
}

export const OfficePrintHeader: React.FC<OfficePrintHeaderProps> = ({
  titleAr,
  titleEn,
  subtitleAr,
  subtitleEn,
  refNumber,
  extraInfo,
  className = "",
  hideOnScreen = false,
}) => {
  const { companyProfile } = useData();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const logoSrc = companyProfile.logoUrl || companyProfile.logoBase64 || companyProfile.logo;
  const companyNameAr = companyProfile.nameAr || "صقر الإمارات لإدارة العقارات";
  const companyNameEn = companyProfile.nameEn || "Emirates Falcon Real Estate Management";
  const companyAddress = isAr
    ? companyProfile.addressAr || companyProfile.address || "الشارقة - دبي - الإمارات العربية المتحدة"
    : companyProfile.addressEn || companyProfile.address || "Sharjah - Dubai - United Arab Emirates";

  const formattedDate = new Date().toLocaleDateString(isAr ? "ar-AE" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const formattedTime = new Date().toLocaleTimeString(isAr ? "ar-AE" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const autoRef = refNumber || `DOC-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

  return (
    <div
      className={`${hideOnScreen ? "hidden print:block" : "block"} border-b-2 border-slate-900 pb-5 mb-6 space-y-3 ${className}`}
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Company Identity */}
        <div className="flex items-center gap-3.5">
          {logoSrc ? (
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border border-slate-200 overflow-hidden shrink-0 bg-white flex items-center justify-center p-1 shadow-xs print:shadow-none">
              <img
                src={logoSrc}
                alt="Office Logo"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-900 text-amber-400 flex items-center justify-center rounded-xl font-black text-xl shrink-0">
              EF
            </div>
          )}

          <div>
            <h1 className="text-base sm:text-lg print:text-base font-black text-slate-900 leading-tight">
              {companyNameAr}
            </h1>
            <h2 className="text-[11px] sm:text-xs print:text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">
              {companyNameEn}
            </h2>
            <p className="text-[10px] print:text-[8px] text-slate-500 mt-1">
              {companyAddress}
            </p>
          </div>
        </div>

        {/* Document Title & Reference Block */}
        <div className="text-end shrink-0 space-y-1">
          <div className="inline-block bg-slate-900 text-white px-3.5 py-1.5 rounded-xl print:rounded-lg">
            <h3 className="text-xs print:text-[11px] font-black text-amber-400 uppercase tracking-wide">
              {titleAr}
            </h3>
            <p className="text-[9px] print:text-[8px] font-bold text-slate-300 uppercase">
              {titleEn}
            </p>
          </div>

          {(subtitleAr || subtitleEn) && (
            <p className="text-[10px] print:text-[8px] font-bold text-slate-600">
              {isAr ? subtitleAr : subtitleEn}
            </p>
          )}

          <div className="text-[10px] print:text-[8px] text-slate-500 font-mono space-y-0.5 pt-1">
            <div>
              <span className="font-bold text-slate-700">{isAr ? "المرجع: " : "Ref: "}</span>
              <span>{autoRef}</span>
            </div>
            <div>
              <span className="font-bold text-slate-700">{isAr ? "التاريخ: " : "Date: "}</span>
              <span>{formattedDate} - {formattedTime}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Legal and Contact Metadata Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[10px] print:text-[8px] text-slate-600">
        <div className="flex flex-wrap items-center gap-4">
          {companyProfile.vatTrn && (
            <span className="font-mono">
              <strong className="text-slate-800">{isAr ? "الرقم الضريبي TRN:" : "TRN:"}</strong> {companyProfile.vatTrn}
            </span>
          )}
          {companyProfile.phone && (
            <span>
              <strong className="text-slate-800">{isAr ? "الهاتف:" : "Tel:"}</strong> {companyProfile.phone}
            </span>
          )}
          {companyProfile.email && (
            <span>
              <strong className="text-slate-800">{isAr ? "البريد:" : "Email:"}</strong> {companyProfile.email}
            </span>
          )}
        </div>

        {extraInfo && extraInfo.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {extraInfo.map((item, idx) => (
              <span key={idx} className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                <strong className="text-slate-800">{isAr ? item.labelAr : item.labelEn}: </strong>
                <span>{item.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
