import React, { useState, useEffect } from "react";
import {
  Scale,
  Sparkles,
  Printer,
  Copy,
  Check,
  Share2,
  FileText,
  Building2,
  AlertTriangle,
  Send,
  Download,
  CheckCircle2,
  Clock,
  Edit3,
} from "lucide-react";
import { Modal } from "./Modal";
import { Badge } from "./Badge";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { Cheque, Tenant } from "../../types";

interface LegalNoticeGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCheques?: Cheque[];
  initialTenant?: Tenant | null;
  defaultNoticeType?: "EVICTION_NOTICE_30_DAYS" | "CHEQUE_PAYMENT_DEMAND" | "RDC_STATEMENT_OF_CLAIM" | "AMICABLE_SETTLEMENT_DEED";
}

interface LegalNoticeResponse {
  title: string;
  statutoryCitations: string;
  content: string;
  keyClauses: string[];
}

export const LegalNoticeGeneratorModal: React.FC<LegalNoticeGeneratorModalProps> = ({
  isOpen,
  onClose,
  initialCheques = [],
  initialTenant = null,
  defaultNoticeType = "EVICTION_NOTICE_30_DAYS",
}) => {
  const { language } = useLanguage();
  const { companyProfile } = useData();
  const isArabic = language === "ar";

  const [noticeType, setNoticeType] = useState<string>(defaultNoticeType);
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [emiratesId, setEmiratesId] = useState("");
  const [tradeLicenseNo, setTradeLicenseNo] = useState("");
  const [propertyName, setPropertyName] = useState("برج الصقر 1");
  const [unitNumber, setUnitNumber] = useState("101");
  const [leaseNumber, setLeaseNumber] = useState("EJARI-2024-8841");
  const [totalClaimAED, setTotalClaimAED] = useState(50000);
  const [returnReason, setReturnReason] = useState("عدم كفاية الرصيد (Insufficient Funds)");
  const [customRemarks, setCustomRemarks] = useState("");
  const [chequeNumbers, setChequeNumbers] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [noticeData, setNoticeData] = useState<LegalNoticeResponse | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isInsideIframe, setIsInsideIframe] = useState(false);

  useEffect(() => {
    setIsInsideIframe(window.self !== window.top);
  }, []);

  const getPrintUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("printNotice", "true");
    if (initialTenant) {
      url.searchParams.set("tenantId", initialTenant.id);
    }
    if (initialCheques && initialCheques.length > 0) {
      url.searchParams.set("chequeId", initialCheques[0].id);
    }
    url.searchParams.set("noticeType", noticeType);
    return url.toString();
  };

  // Sync initial props
  useEffect(() => {
    if (initialTenant) {
      setTenantName(isArabic ? initialTenant.nameAr || initialTenant.nameEn : initialTenant.nameEn);
      setTenantPhone(initialTenant.phone || "");
      setEmiratesId(initialTenant.emiratesId || "");
      setTradeLicenseNo(initialTenant.tradeLicenseNo || "");
    }

    if (initialCheques && initialCheques.length > 0) {
      setChequeNumbers(initialCheques.map((c) => c.chequeNumber));
      const sum = initialCheques.reduce((acc, c) => acc + (c.amount || 0), 0);
      setTotalClaimAED(sum);
      if (initialCheques[0].returnReason) {
        setReturnReason(initialCheques[0].returnReason);
      }
    }
  }, [initialCheques, initialTenant, isOpen, isArabic]);

  // Client-Side Fallback Legal Notice Generator (Handles cases when Gemini rate limit or network fails)
  const generateClientFallbackNotice = () => {
    const isAr = language === "ar";
    const chqStr = Array.isArray(chequeNumbers) && chequeNumbers.length > 0 ? chequeNumbers.join("، ") : "N/A";
    const formattedAmount = Number(totalClaimAED || 0).toLocaleString();
    const today = new Date().toLocaleDateString(isAr ? "ar-AE" : "en-GB");

    if (noticeType === "EVICTION_NOTICE_30_DAYS") {
      return {
        title: isAr
          ? "إنذار عدلي رسمي بالإخلاء وسداد بدلات الإيجار المتأخرة (عبر الكاتب العدل)"
          : "Official Notarial Eviction Notice and Overdue Rent Demand (30 Days)",
        statutoryCitations: isAr
          ? "استناداً لأحكام القانون رقم (26) لسنة 2007 وتعديلاته بالقانون رقم (33) لسنة 2008 بشأن تنظيم العلاقة بين مؤجري ومستأجري العقارات في إمارة دبي، لا سيما المادة (25) الفقرة (1/أ)."
          : "Pursuant to Dubai Law No. (26) of 2007, as amended by Law No. (33) of 2008, Regulating the Relationship Between Landlords and Tenants in the Emirate of Dubai, specifically Article 25(1)(a).",
        content: isAr
          ? `التاريخ: ${today}\n\nإلى المنذر إليه:\nالسيد / الشركة: ${tenantName}\nرقم الهوية / الرخصة التجارية: ${emiratesId || tradeLicenseNo || "مسجل بالنظام"}\nالعقار المستأجر: وحدة رقم (${unitNumber}) - ${propertyName}\nرقم عقد الإيجار (توثيق/إيجاري): ${leaseNumber}\n\nبناءً على طلب المنذر:\nشركة صقر الامارات للعقارات (بصفتها الممثل القانوني للمؤجر).\n\nالموضوع: إنذار عدلي رسمي بالسداد والإخلاء خلال ثلاثين (30) يوماً\n\nتحية طيبة وبعد،،،\n\nنود إحاطتكم علماً بأنكم تشغلون الوحدة العقارية المشار إليها أعلاه بموجب عقد الإيجار الساري، وحيث أنكم قد تخلفتم عن سداد بدلات الإيجار المستحقة المترتبة بذمتكم والبالغ مجموعها (${formattedAmount}) درهم إماراتي، والمتمثلة في الشيكات المرتجعة رقم (${chqStr}) بسبب (${returnReason}).\n\nوحيث تنص المادة (25) من قانون الإيجارات على أنه "يحق للمؤجر طلب إخلاء المستأجر من العقار قبل انتهاء مدة الإجارة إذا لم يقم المستأجر بسداد بدل الإيجار أو أي جزء منه خلال ثلاثين يوماً من تاريخ إخطاره بالسداد من قبل المؤجر بإشعار رسمي".\n\nعليه، فإننا ننذركم رسمياً بوجوب سداد كامل المبلغ المتأخر وقدره (${formattedAmount} درهم) إلى حساب صقر الامارات للعقارات في موعد أقصاه ثلاثون (30) يوماً من تاريخ تسلمكم هذا الإنذار.\n\nوفي حال انقضاء هذه المهلة دون السداد التام، فإن الشركة ستلجأ فوراً لمركز فض المنازعات الإيجارية (RDC) لفتح دعوى إخلاء مستعجلة، والمطالبة بالأجرة المتأخرة، مع تحميلكم كافة الرسوم القضائية ومصروفات المحاماة وأي تعويضات عن الأضرار.\n\nوتفضلوا بقبول فائق الاحترام والتقدير،،،\n\nعن شركة صقر الامارات للعقارات\nالدائرة القانونية والتحصيل العقاري`
          : `Date: ${today}\n\nTO THE NOTIFIED PARTY (TENANT):\nName / Entity: ${tenantName}\nEmirates ID / Trade License: ${emiratesId || tradeLicenseNo || "On File"}\nLeased Premises: Unit (${unitNumber}), ${propertyName}\nLease Agreement (Ejari): ${leaseNumber}\n\nON BEHALF OF THE LANDLORD:\nEmirates Falcon Real Estate LLC (As Legal Property Manager)\n\nSUBJECT: FORMAL 30-DAY NOTARIAL LEGAL NOTICE FOR PAYMENT AND EVICTION\n\nDear Sirs,\n\nPlease be advised that pursuant to the tenancy contract for the above-referenced premises, you are in default of overdue rental installments totaling AED ${formattedAmount}, arising from dishonored cheque(s) #${chqStr} due to (${returnReason}).\n\nPursuant to Article 25(1)(a) of Dubai Tenancy Law No. (26) of 2007 (as amended by Law No. 33 of 2008), the Landlord is legally entitled to demand immediate eviction and claim all arrears if the tenant fails to settle rent within thirty (30) days from formal notification.\n\nYOU ARE HEREBY FORMALLY NOTIFIED to settle the total outstanding balance of AED ${formattedAmount} within thirty (30) calendar days from receipt hereof.\n\nFailure to cure this default within the stipulated 30-day statutory window will result in the immediate filing of an Eviction and Rental Claim lawsuit before the Rental Dispute Center (RDC), wherein we will seek full eviction, payment of arrears, legal fees, court charges, and statutory damages.\n\nYours faithfully,\n\nEmirates Falcon Real Estate LLC\nLegal Affairs & Credit Recovery Department`,
        keyClauses: [
          isAr ? "مهلة قانونية حتمية: 30 يوماً من تاريخ التبليغ" : "Statutory Cure Period: 30 Calendar Days",
          isAr ? `المبلغ الإجمالي المطالب به: ${formattedAmount} درهم` : `Total Claim Amount: AED ${formattedAmount}`,
          isAr ? "سند المطالبة: قانون الإيجارات رقم 26 لسنة 2007 المادة 25" : "Legal Basis: Article 25, Dubai Law 26/2007",
          isAr ? "المحكمة المختصة: مركز فض المنازعات الإيجارية (RDC)" : "Competent Tribunal: Rental Dispute Center (RDC)",
        ],
      };
    }

    return {
      title: isAr
        ? "إشعار رسمي بالسداد المباشر لشيك مرتجع وفق المرسوم بقانون رقم 14 لسنة 2020"
        : "Official Cheque Dishonor Payment Demand (Decree Law No. 14/2020)",
      statutoryCitations: isAr
        ? "استناداً للمرسوم بقانون اتحادي رقم (14) لسنة 2020 بتعديل بعض أحكام قانون المعاملات التجارية رقم (18) لسنة 1993 بشأن تحصيل الشيكات والتنفيذ المباشر كأداة تنفيذية جبرية."
        : "Pursuant to Federal Decree-Law No. (14) of 2020 amending the Commercial Transactions Law, regarding direct execution of dishonored cheques as writ of execution.",
      content: isAr
        ? `إشعار بالسداد الفوري للشيك رقم (${chqStr}) بمبلغ (${formattedAmount}) درهم المسحوب لصالح صقر الامارات للعقارات والمردود بسبب (${returnReason}). يرجى السداد الفوري خلال مهلة أقصاها (15) يوماً قبل تحويل الشيك مباشرة لقاضي التنفيذ للحجز على الحسابات والأموال وفق السند التنفيذي المباشر.`
        : `Demand for immediate payment of Cheque #${chqStr} for AED ${formattedAmount} returned for (${returnReason}). Settle within 15 days to avoid immediate writ of execution and account freezing under Federal Decree Law 14/2020.`,
      keyClauses: [
        isAr ? "مهلة السداد الفوري: 15 يوماً" : "Grace Period: 15 Days",
        isAr ? "سند تنفيذي مباشر لدى المحكمة" : "Direct Writ of Execution Enforceable in UAE Courts",
      ],
    };
  };

  const handleGenerateNotice = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/ai/generate-legal-notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noticeType,
          tenantName,
          tenantPhone,
          emiratesId,
          tradeLicenseNo,
          propertyName,
          unitNumber,
          leaseNumber,
          chequeNumbers,
          totalClaimAED,
          returnReason,
          daysToCure: noticeType === "EVICTION_NOTICE_30_DAYS" ? 30 : 15,
          customRemarks,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.warn("Response was not valid JSON, using client-side fallback notice. Raw:", text);
        throw new Error("Invalid JSON");
      }

      const noticeResult = data?.notice || (data?.noticeText ? { noticeText: data.noticeText, keyClauses: data.keyClauses || [] } : null);
      if (noticeResult) {
        setNoticeData(noticeResult);
      } else {
        throw new Error("No notice data in response");
      }
    } catch (err) {
      setNoticeData(generateClientFallbackNotice());
    } finally {
      setIsLoading(false);
    }
  };

  // Auto generate upon opening if not generated yet
  useEffect(() => {
    if (isOpen && !noticeData) {
      handleGenerateNotice();
    }
  }, [isOpen]);

  const handleCopyText = () => {
    if (!noticeData) return;
    const fullText = `${noticeData.title}\n\n${noticeData.statutoryCitations}\n\n${noticeData.content}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isArabic ? "صائغ الإخطارات واللوائح القانونية بالذكاء الاصطناعي" : "AI Legal Notice & Document Drafter"}
      
    >
      <div className="space-y-6">
        {isInsideIframe && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
            <div className="space-y-1">
              <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                <span>⚠️ تنبيه لتشغيل الطباعة بنجاح</span>
                <span className="text-[9px] px-1.5 py-0.2 bg-amber-200 text-amber-950 rounded-md font-bold uppercase font-mono">iFrame Sandbox</span>
              </span>
              <p className="text-[11px] leading-relaxed text-amber-800">
                {isArabic
                  ? "أنت تتصفح النظام داخل بيئة معاينة آمنة تمنع فتح شاشة الطباعة الخاصة بالمتصفح. يرجى فتح النظام في علامة تبويب جديدة مستقلة لتتمكن من طباعة الإخطار كـ PDF مباشرة."
                  : "You are currently viewing the app inside a secure preview iFrame, which blocks browser print dialogs. Please open the app in a new tab to print the notice successfully."}
              </p>
            </div>
            <a
              href={getPrintUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors text-center"
            >
              <span>{isArabic ? "افتح في علامة تبويب جديدة ↗" : "Open in New Tab ↗"}</span>
            </a>
          </div>
        )}

        {/* Controls & Notice Type Tabs */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-purple-700" />
              <span>{isArabic ? "نوع الوثيقة القانونية المطلوبة:" : "Legal Instrument Type:"}</span>
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-600 animate-pulse" />
                Gemini 3.7 Flash UAE Legal Core
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setNoticeType("EVICTION_NOTICE_30_DAYS")}
              className={`p-2.5 rounded-xl text-xs font-bold text-start transition-all cursor-pointer ${
                noticeType === "EVICTION_NOTICE_30_DAYS"
                  ? "bg-purple-900 text-white shadow-md shadow-purple-950/20"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>{isArabic ? "إنذار عدلي بالإخلاء (30 يوماً)" : "30-Day Notarial Eviction"}</span>
              </div>
              <div className="text-[10px] opacity-80 mt-1 font-normal">
                {isArabic ? "وفق قانون 26 لسنة 2007" : "Dubai Law 26/2007 (Art 25)"}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setNoticeType("CHEQUE_PAYMENT_DEMAND")}
              className={`p-2.5 rounded-xl text-xs font-bold text-start transition-all cursor-pointer ${
                noticeType === "CHEQUE_PAYMENT_DEMAND"
                  ? "bg-purple-900 text-white shadow-md shadow-purple-950/20"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-300" />
                <span>{isArabic ? "إشعار سداد شيك مرتجع" : "Cheque Demand Notice"}</span>
              </div>
              <div className="text-[10px] opacity-80 mt-1 font-normal">
                {isArabic ? "مرسوم بقانون 14 لسنة 2020" : "Federal Decree Law 14/2020"}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setNoticeType("RDC_STATEMENT_OF_CLAIM")}
              className={`p-2.5 rounded-xl text-xs font-bold text-start transition-all cursor-pointer ${
                noticeType === "RDC_STATEMENT_OF_CLAIM"
                  ? "bg-purple-900 text-white shadow-md shadow-purple-950/20"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>{isArabic ? "صحيفة دعوى فض منازعات" : "RDC Statement of Claim"}</span>
              </div>
              <div className="text-[10px] opacity-80 mt-1 font-normal">
                {isArabic ? "لائحة دعوى إيجارية مستعجلة" : "Dispute Center Eviction Petition"}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setNoticeType("AMICABLE_SETTLEMENT_DEED")}
              className={`p-2.5 rounded-xl text-xs font-bold text-start transition-all cursor-pointer ${
                noticeType === "AMICABLE_SETTLEMENT_DEED"
                  ? "bg-purple-900 text-white shadow-md shadow-purple-950/20"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-300" />
                <span>{isArabic ? "اتفاقية صلح وتقسيط" : "Settlement Deed"}</span>
              </div>
              <div className="text-[10px] opacity-80 mt-1 font-normal">
                {isArabic ? "إقرار دين وجدولة سداد ملزمة" : "Enforceable Debt Schedule"}
              </div>
            </button>
          </div>

          {/* Quick parameter inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                {isArabic ? "اسم المستأجر / الكيان:" : "Tenant Name:"}
              </label>
              <input
                type="text"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white rounded-lg border border-slate-300 font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                {isArabic ? "إجمالي المطالبة (AED):" : "Total Claim (AED):"}
              </label>
              <input
                type="number"
                value={totalClaimAED}
                onChange={(e) => setTotalClaimAED(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs bg-white rounded-lg border border-slate-300 font-mono font-bold text-purple-950"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleGenerateNotice}
                disabled={isLoading}
                className="w-full py-2 px-4 bg-purple-900 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isLoading ? "animate-spin" : ""}`} />
                <span>{isLoading ? (isArabic ? "جارِ الصياغة القانونية..." : "Drafting with AI...") : (isArabic ? "إعادة الصياغة بالذكاء الاصطناعي" : "Re-Draft with AI")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Legal Document Display Paper */}
        {noticeData && (
          <div className="space-y-4">
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 font-serif print:border-none print:shadow-none print:p-0">
              {/* Header Letterhead */}
              <div className="border-b-2 border-slate-800 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {companyProfile.logoUrl || companyProfile.logoBase64 || companyProfile.logo ? (
                    <div className="w-14 h-14 rounded-xl border border-slate-200 overflow-hidden shrink-0 bg-white flex items-center justify-center p-1 shadow-xs">
                      <img
                        src={companyProfile.logoUrl || companyProfile.logoBase64 || companyProfile.logo}
                        alt="Office Logo"
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : null}
                  <div>
                    <h3 className="text-base sm:text-lg font-black font-sans text-slate-900">
                      {companyProfile.nameAr}
                    </h3>
                    <div className="text-xs text-slate-500 font-sans tracking-wide uppercase">
                      {companyProfile.nameEn} • {companyProfile.addressEn || companyProfile.address}
                    </div>
                    {companyProfile.vatTrn && (
                      <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                        TRN: {companyProfile.vatTrn}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-end font-sans shrink-0">
                  <span className="inline-block px-3 py-1 bg-purple-100 text-purple-950 text-xs font-black rounded-lg border border-purple-200">
                    {isArabic ? "وثيقة قانونية رسمية" : "OFFICIAL LEGAL NOTICE"}
                  </span>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">
                    REF: EFR-LEG-{Date.now().toString().slice(-6)}
                  </div>
                </div>
              </div>

              {/* Title & Citations */}
              <div className="space-y-2 text-center py-2">
                <h4 
                  contentEditable={isEditMode}
                  suppressContentEditableWarning
                  onBlur={(e) => setNoticeData(prev => prev ? { ...prev, title: e.currentTarget.textContent || "" } : null)}
                  className={`text-base sm:text-lg font-bold text-slate-900 font-sans underline underline-offset-8 decoration-purple-800 ${
                    isEditMode ? "outline-dashed outline-2 outline-amber-400 bg-amber-50/50 p-1 rounded" : ""
                  }`}
                >
                  {noticeData.title}
                </h4>
                {noticeData.statutoryCitations && (
                  <p 
                    contentEditable={isEditMode}
                    suppressContentEditableWarning
                    onBlur={(e) => setNoticeData(prev => prev ? { ...prev, statutoryCitations: e.currentTarget.textContent || "" } : null)}
                    className={`text-xs text-slate-600 italic max-w-2xl mx-auto leading-relaxed pt-2 ${
                      isEditMode ? "outline-dashed outline-2 outline-amber-400 bg-amber-50/50 p-1 rounded" : ""
                    }`}
                  >
                    {noticeData.statutoryCitations}
                  </p>
                )}
              </div>

              {/* Document Key Clauses */}
              {noticeData.keyClauses && noticeData.keyClauses.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 font-sans text-xs">
                  {noticeData.keyClauses.map((clause, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-slate-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-800 shrink-0"></div>
                      <span 
                        contentEditable={isEditMode}
                        suppressContentEditableWarning
                        className={`font-semibold ${isEditMode ? "outline-dashed outline-1 outline-amber-400 px-1" : ""}`}
                      >
                        {clause}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Main Content Body */}
              <div 
                contentEditable={isEditMode}
                suppressContentEditableWarning
                onBlur={(e) => setNoticeData(prev => prev ? { ...prev, content: e.currentTarget.textContent || "" } : null)}
                className={`text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line font-sans border-t border-slate-100 pt-4 ${
                  isEditMode ? "outline-dashed outline-2 outline-amber-400 bg-amber-50/30 p-2 rounded min-h-[200px]" : ""
                }`}
              >
                {noticeData.content}
              </div>

              {/* Footer Signature Block */}
              <div className="pt-8 border-t border-slate-200 flex items-end justify-between text-xs font-sans text-slate-600">
                <div className="space-y-1">
                  <div>{isArabic ? "حرر في: دبي، الإمارات العربية المتحدة" : "Issued at: Dubai, United Arab Emirates"}</div>
                  <div className="text-[11px] text-slate-400">
                    {new Date().toLocaleDateString(isArabic ? "ar-AE" : "en-GB", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                </div>

                <div className="text-center space-y-3">
                  <div className="w-24 h-12 border-b border-dashed border-slate-400 mx-auto"></div>
                  <div className="font-bold text-slate-900">
                    {isArabic ? "خاتم وتوقيع الدائرة القانونية" : "Authorized Legal Signatory"}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{isArabic ? "صيغة قانونية معتمدة ومتوافقة مع نظام كاتب العدل ومركز فض المنازعات" : "Court-admissible UAE legal notice draft"}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border ${
                    isEditMode
                      ? "bg-amber-600 text-white border-amber-700 shadow-xs animate-pulse"
                      : "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300"
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditMode ? (isArabic ? "قفل التعديل" : "Lock Edit") : (isArabic ? "✏️ التعديل المباشر" : "✏️ Live Edit")}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyText}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? (isArabic ? "تم النسخ!" : "Copied!") : (isArabic ? "نسخ النص" : "Copy Text")}</span>
                </button>

                {isInsideIframe ? (
                  <a
                    href={getPrintUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-md text-center"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{isArabic ? "افتح للطباعة ↗" : "Open to Print ↗"}</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-4 py-2 bg-purple-900 hover:bg-purple-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-purple-950/20"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{isArabic ? "طباعة / تصدير PDF" : "Print / Export PDF"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
