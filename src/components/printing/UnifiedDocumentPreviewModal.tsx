import React, { useRef, useState, useEffect } from "react";
import {
  Printer,
  Download,
  Building2,
  User,
  Calendar,
  DollarSign,
  CheckCircle2,
  FileText,
  ShieldCheck,
  CreditCard,
  Building,
  X,
  Languages,
  AlertTriangle,
  QrCode,
  Tag,
  Hash,
  Clock,
} from "lucide-react";
import { UnifiedFinancialDocument } from "../../types/unifiedPrinting";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { exportElementToPdf } from "../../utils/pdfExportUtils";
import { tafqeetAED, tafqeetEnglishAED } from "../../utils/arabicTafqeet";
import { CompanyLetterheadFrame, useCompanyLetterhead } from "../common/CompanyLetterheadFrame";
import QRCode from "react-qr-code";

interface UnifiedDocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: UnifiedFinancialDocument | null;
  onPrintSuccess?: () => void;
}

export const UnifiedDocumentPreviewModal: React.FC<UnifiedDocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  document: doc,
  onPrintSuccess,
}) => {
  const { language: currentAppLanguage } = useLanguage();
  const { companyProfile, logAudit } = useData();
  const { currentUser } = useAuth();
  const { activeLetterhead, hasActiveLetterhead } = useCompanyLetterhead();

  const [docLanguage, setDocLanguage] = useState<"ar" | "en">(currentAppLanguage);
  const [showLetterhead, setShowLetterhead] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const printableAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDocLanguage(currentAppLanguage);
  }, [currentAppLanguage, doc]);

  // Log read-only view event
  useEffect(() => {
    if (isOpen && doc) {
      logAudit(
        "DOCUMENT_VIEW",
        "DOCUMENT",
        doc.authoritativeId,
        doc.documentNumber,
        `Viewed financial document #${doc.documentNumber} (${doc.documentType} - Authoritative ID: ${doc.authoritativeId})`
      );
    }
  }, [isOpen, doc?.id]);

  if (!isOpen || !doc) return null;

  const isAr = docLanguage === "ar";
  const isPrintable = doc.isPrintable;

  const handlePrint = () => {
    // Log safe reprint audit
    logAudit(
      "RECEIPT_PRINT",
      "DOCUMENT",
      doc.authoritativeId,
      doc.documentNumber,
      `Printed / Exported financial voucher #${doc.documentNumber} (${doc.documentType} - Authoritative ID: ${doc.authoritativeId})`
    );

    if (onPrintSuccess) {
      onPrintSuccess();
    }

    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleDownloadPdf = async () => {
    if (!printableAreaRef.current) return;
    setIsExportingPdf(true);

    try {
      logAudit(
        "RECEIPT_PRINT",
        "DOCUMENT",
        doc.authoritativeId,
        doc.documentNumber,
        `Exported PDF for financial voucher #${doc.documentNumber} (${doc.documentType} - Authoritative ID: ${doc.authoritativeId})`
      );

      await exportElementToPdf(printableAreaRef.current, {
        fileName: `${doc.documentNumber}_${doc.documentType}.pdf`,
        title: `${isAr ? doc.titleAr : doc.titleEn} - ${doc.documentNumber}`,
        orientation: "p",
      });
    } catch (err) {
      console.error("PDF export error:", err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const arabicWords = tafqeetAED(doc.amount);
  const englishWords = tafqeetEnglishAED(doc.amount);

  // Status Colors and Badges
  const getStatusBadge = () => {
    if (doc.isCancelledOrReversed) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
          <AlertTriangle className="w-3.5 h-3.5" />
          {isAr ? "ملغى / معكوس القيد" : "Reversed / Cancelled"}
        </span>
      );
    }
    if (doc.status === "PAID" || doc.status === "POSTED" || doc.status === "COMPLETED" || doc.status === "RECONCILED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {isAr ? "معتمد ومسدد" : "Paid & Settled"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
        <Clock className="w-3.5 h-3.5" />
        {doc.status}
      </span>
    );
  };

  const getPaymentMethodLabel = () => {
    switch (doc.paymentMethod) {
      case "CASH":
        return isAr ? "نقداً (كاش)" : "Cash";
      case "CHEQUE":
        return isAr ? `شيك بنكي (${doc.chequeNumber ? `#${doc.chequeNumber}` : ""})` : `Cheque (${doc.chequeNumber ? `#${doc.chequeNumber}` : ""})`;
      case "BANK_TRANSFER":
        return isAr ? "تحويل مصرفي" : "Bank Transfer";
      case "VISA":
      case "MASTERCARD":
        return isAr ? `بطاقة ائتمان (${doc.paymentMethod})` : `Credit Card (${doc.paymentMethod})`;
      default:
        return doc.paymentMethod;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[96vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden print:max-h-none print:shadow-none print:border-none print:rounded-none">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">
                  {isAr ? doc.titleAr : doc.titleEn}
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-semibold border border-slate-700">
                  {doc.documentNumber}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {isAr
                  ? `المعرف المالي المعتمد: ${doc.authoritativeId}`
                  : `Authoritative Transaction ID: ${doc.authoritativeId}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <button
              onClick={() => setDocLanguage((l) => (l === "ar" ? "en" : "ar"))}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border border-slate-700"
              title={isAr ? "Switch to English" : "التحويل للغة العربية"}
            >
              <Languages className="w-3.5 h-3.5 text-amber-400" />
              <span>{isAr ? "English" : "عربي"}</span>
            </button>

            {/* Letterhead toggle if template exists */}
            {hasActiveLetterhead && (
              <button
                onClick={() => setShowLetterhead((v) => !v)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border ${
                  showLetterhead
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>{isAr ? "الترويسة الرسمية" : "Letterhead"}</span>
              </button>
            )}

            {/* Print Button */}
            <button
              onClick={handlePrint}
              disabled={!isPrintable}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all ${
                isPrintable
                  ? "bg-amber-600 hover:bg-amber-500 text-white cursor-pointer"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isAr ? "طباعة فورية" : "Print Voucher"}</span>
            </button>

            {/* Download PDF Button */}
            <button
              onClick={handleDownloadPdf}
              disabled={!isPrintable || isExportingPdf}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all ${
                isPrintable && !isExportingPdf
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? (isAr ? "جار التصدير..." : "Exporting...") : (isAr ? "تحميل PDF" : "Export PDF")}</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Unprintable Warning Banner if transfer is not PAID */}
        {!isPrintable && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center gap-3 text-amber-900 text-xs shrink-0 print:hidden">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold">
                {isAr ? "المستند في وضع المعاينة فقط (غير معتمد للطباعة النهائية)" : "Document in Preview Mode Only (Not Finalized for Print)"}
              </p>
              <p className="text-amber-800 mt-0.5">
                {isAr ? doc.unprintableReasonAr || "هذا المستند لا يستوفي شروط الاعتماد المالي النهائي للطباعة." : doc.unprintableReasonEn || "This record does not meet financial conditions for final printout."}
              </p>
            </div>
          </div>
        )}

        {/* Printable Document Sheet Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          <div
            ref={printableAreaRef}
            id="printable-financial-voucher"
            dir={isAr ? "rtl" : "ltr"}
            className="w-full max-w-[210mm] min-h-[297mm] bg-white rounded-xl shadow-lg border border-slate-200 p-8 sm:p-10 flex flex-col justify-between print:shadow-none print:border-none print:rounded-none print:p-8 print:w-full print:max-w-none"
          >
            <CompanyLetterheadFrame showLetterhead={showLetterhead} className="flex-1 flex flex-col justify-between">
              <div>
                {/* 1. OFFICIAL LETTERHEAD HEADER */}
                <div className="border-b-2 border-slate-900 pb-5 mb-6">
                  <div className="flex items-start justify-between gap-4">
                    {/* Company Branding */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        {companyProfile.logoUrl || companyProfile.logoBase64 || companyProfile.logo ? (
                          <div className="w-14 h-14 rounded-xl border border-slate-200 overflow-hidden shrink-0 bg-white flex items-center justify-center p-1 shadow-xs">
                            <img
                              src={companyProfile.logoUrl || companyProfile.logoBase64 || companyProfile.logo}
                              alt="Company Logo"
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-xl shadow-sm shrink-0">
                            {companyProfile.nameAr ? companyProfile.nameAr.charAt(0) : "E"}
                          </div>
                        )}
                        <div>
                          <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                            {isAr ? companyProfile.nameAr || "شركة إميريتس فالكون لإدارة العقارات" : companyProfile.nameEn || "Emirates Falcon Real Estate Management"}
                          </h1>
                          <p className="text-xs text-slate-600 font-semibold">
                            {isAr ? "نظام إدارة الأملاك والحسابات العقارية المتكامل" : "Comprehensive Property & Financial ERP System"}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
                        {companyProfile.vatTrn && (
                          <span className="font-mono">
                            <strong>{isAr ? "الرقم الضريبي TRN:" : "TRN:"}</strong> {companyProfile.vatTrn}
                          </span>
                        )}
                        {companyProfile.phone && (
                          <span>
                            <strong>{isAr ? "الهاتف:" : "Tel:"}</strong> {companyProfile.phone}
                          </span>
                        )}
                        {companyProfile.address && (
                          <span>
                            <strong>{isAr ? "العنوان:" : "Address:"}</strong> {companyProfile.address}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Document Meta Header (Right / Left) */}
                    <div className="text-end space-y-2">
                      <div className="inline-block bg-slate-900 text-white px-4 py-1.5 rounded-xl">
                        <span className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                          {isAr ? "نوع السند المالي" : "Financial Document"}
                        </span>
                        <span className="text-sm font-black tracking-tight block">
                          {isAr ? doc.titleAr : doc.titleEn}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-slate-700">
                        <div>
                          <span className="text-slate-500 font-medium">{isAr ? "رقم السند:" : "Voucher #:"} </span>
                          <span className="font-mono font-black text-slate-950 text-sm bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {doc.documentNumber}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-medium">{isAr ? "التاريخ:" : "Date:"} </span>
                          <span className="font-semibold text-slate-900">
                            {doc.date ? new Date(doc.date).toLocaleDateString(isAr ? "ar-AE" : "en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}
                          </span>
                        </div>
                        <div className="pt-0.5">{getStatusBadge()}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. PARTY / BENEFICIARY & PROPERTY CONTEXT */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Party Card */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 border-b border-slate-200 pb-1.5">
                      <User className="w-4 h-4 text-amber-600" />
                      <span>
                        {doc.partyType === "OWNER"
                          ? isAr ? "بيانات المالك المستفيد" : "Owner / Beneficiary Details"
                          : doc.partyType === "TENANT"
                          ? isAr ? "بيانات المستأجر / الدافع" : "Tenant / Payer Details"
                          : doc.partyType === "VENDOR"
                          ? isAr ? "بيانات المورد / مقاول الصيانة" : "Vendor / Contractor Details"
                          : isAr ? "بيانات الطرف المعني" : "Party Details"}
                      </span>
                    </div>

                    <div className="text-xs space-y-1 text-slate-700">
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? "الاسم:" : "Name:"}</span>
                        <span className="font-bold text-slate-900">{doc.partyName || "—"}</span>
                      </div>
                      {doc.partyPhone && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">{isAr ? "رقم الهاتف:" : "Phone:"}</span>
                          <span className="font-mono text-slate-800">{doc.partyPhone}</span>
                        </div>
                      )}
                      {doc.partyIdNumber && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">{isAr ? "الهوية الوطنية:" : "Emirates ID:"}</span>
                          <span className="font-mono text-slate-800">{doc.partyIdNumber}</span>
                        </div>
                      )}
                      {doc.iban && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">{isAr ? "رقم الآيبان IBAN:" : "IBAN:"}</span>
                          <span className="font-mono text-xs font-bold text-slate-900">{doc.iban}</span>
                        </div>
                      )}
                      {doc.bankName && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">{isAr ? "البنك المصرفي:" : "Bank:"}</span>
                          <span className="font-semibold text-slate-800">{doc.bankName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Real Estate & Contract Context */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 border-b border-slate-200 pb-1.5">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      <span>{isAr ? "بيانات العقار والتعاقد" : "Property & Lease Context"}</span>
                    </div>

                    <div className="text-xs space-y-1 text-slate-700">
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? "اسم العقار / المبنى:" : "Property:"}</span>
                        <span className="font-bold text-slate-900">{doc.propertyName || "—"}</span>
                      </div>
                      {doc.unitNumber && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">{isAr ? "رقم الوحدة:" : "Unit #:"}</span>
                          <span className="font-mono font-bold text-slate-900">#{doc.unitNumber}</span>
                        </div>
                      )}
                      {doc.leaseNumber && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">{isAr ? "رقم عقد الإيجار:" : "Lease #:"}</span>
                          <span className="font-mono font-bold text-slate-900">#{doc.leaseNumber}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isAr ? "طريقة الدفع:" : "Payment Method:"}</span>
                        <span className="font-bold text-slate-900">{getPaymentMethodLabel()}</span>
                      </div>
                      {doc.referenceNumber && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">{isAr ? "المرجع / الشيك:" : "Reference #:"}</span>
                          <span className="font-mono font-semibold text-slate-800">{doc.referenceNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. HERO AMOUNT & TAFQEET DISPLAY */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 mb-6 shadow-md border border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
                    <div>
                      <span className="text-xs text-amber-400 font-bold uppercase tracking-wider block">
                        {isAr ? "المبلغ المالي المعتمد" : "Authoritative Financial Amount"}
                      </span>
                      <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight mt-0.5">
                        AED {doc.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="text-start sm:text-end">
                      <span className="text-xs text-slate-400 font-medium block">
                        {isAr ? "طريقة السداد والتحصيل" : "Payment & Settlement"}
                      </span>
                      <span className="inline-block bg-amber-500/20 text-amber-300 font-bold px-3 py-1 rounded-lg text-xs border border-amber-500/30 mt-1">
                        {getPaymentMethodLabel()}
                      </span>
                    </div>
                  </div>

                  {/* Tafqeet Words */}
                  <div className="pt-3 space-y-1">
                    <div className="text-xs text-amber-200/90 font-medium leading-relaxed">
                      <strong className="text-amber-400">{isAr ? "فقط وقدره:" : "Amount in Arabic words:"} </strong>
                      {arabicWords}
                    </div>
                    {!isAr && (
                      <div className="text-[11px] text-slate-300 font-medium leading-relaxed">
                        <strong className="text-slate-200">Amount in English words: </strong>
                        {englishWords}
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. FINANCIAL BREAKDOWN & ITEMIZATION TABLE */}
                <div className="mb-6">
                  <h3 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-slate-700" />
                    <span>{isAr ? "بيان تفاصيل البنود والمبالغ المالية" : "Itemized Financial Breakdown"}</span>
                  </h3>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-start">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4 text-start">#</th>
                          <th className="py-2.5 px-4 text-start">{isAr ? "البيان / الوصف" : "Item Description"}</th>
                          <th className="py-2.5 px-4 text-center">{isAr ? "النوع" : "Type"}</th>
                          <th className="py-2.5 px-4 text-end">{isAr ? "المبلغ (AED)" : "Amount (AED)"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {doc.breakdown && doc.breakdown.length > 0 ? (
                          doc.breakdown.map((item, idx) => (
                            <tr key={idx} className={item.type === "TOTAL" || item.type === "NET" ? "bg-slate-50 font-bold" : ""}>
                              <td className="py-2.5 px-4 text-slate-400 font-mono">{idx + 1}</td>
                              <td className="py-2.5 px-4 font-semibold text-slate-800">
                                {isAr ? item.labelAr : item.labelEn}
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    item.type === "ADDITION"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : item.type === "TAX"
                                      ? "bg-amber-50 text-amber-700"
                                      : item.type === "DEDUCTION"
                                      ? "bg-rose-50 text-rose-700"
                                      : "bg-slate-200 text-slate-800"
                                  }`}
                                >
                                  {item.type}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-end font-mono font-bold text-slate-900">
                                AED {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="py-2.5 px-4 text-slate-400 font-mono">1</td>
                            <td className="py-2.5 px-4 font-semibold text-slate-800">{doc.description}</td>
                            <td className="py-2.5 px-4 text-center font-bold text-slate-500">TOTAL</td>
                            <td className="py-2.5 px-4 text-end font-mono font-bold text-slate-900">
                              AED {doc.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="bg-slate-900 text-white font-bold">
                        <tr>
                          <td colSpan={3} className="py-2.5 px-4 text-start font-bold text-amber-300">
                            {isAr ? "صافي القيمة الإجمالية المعتمدة للسند" : "Total Net Authoritative Voucher Value"}
                          </td>
                          <td className="py-2.5 px-4 text-end font-mono text-sm font-black text-amber-300">
                            AED {doc.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* 5. DESCRIPTION / NOTES */}
                {doc.description && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-6 text-xs space-y-1">
                    <span className="font-bold text-slate-800 block">{isAr ? "البيان والشرح التفصيلي:" : "Description & Remarks:"}</span>
                    <p className="text-slate-700 leading-relaxed">{doc.description}</p>
                    {doc.notes && doc.notes !== doc.description && (
                      <p className="text-slate-500 text-[11px] italic mt-1 border-t border-slate-200 pt-1">
                        <strong>{isAr ? "ملاحظات إضافية:" : "Additional notes:"}</strong> {doc.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 6. SIGNATURES & OFFICIAL AUDIT BLOCK */}
              <div className="mt-8 border-t-2 border-slate-300 pt-6">
                <div className="grid grid-cols-3 gap-6 text-center text-xs">
                  {/* Prepared by Accountant */}
                  <div className="space-y-8 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="font-bold text-slate-900 block">{isAr ? "المحاسب المسؤول" : "Prepared by Accountant"}</span>
                      <span className="text-[11px] text-slate-500">{doc.recordedByName || (isAr ? "المحاسب المعتمد" : "Accountant")}</span>
                    </div>
                    <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto pb-1 text-[10px] text-slate-400">
                      {isAr ? "التوقيع والختم" : "Signature & Stamp"}
                    </div>
                  </div>

                  {/* Audited / Manager */}
                  <div className="space-y-8 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="font-bold text-slate-900 block">{isAr ? "المراجعة والاعتماد المالي" : "Audited & Approved"}</span>
                      <span className="text-[11px] text-slate-500">{doc.approvedByName || doc.paidByName || (isAr ? "المدير المالي" : "Financial Manager")}</span>
                    </div>
                    <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto pb-1 text-[10px] text-slate-400">
                      {isAr ? "التوقيع والختم الرسمي" : "Official Stamp"}
                    </div>
                  </div>

                  {/* Recipient / Beneficiary */}
                  <div className="space-y-8 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="font-bold text-slate-900 block">{isAr ? "المستلم / المعني" : "Received by / Beneficiary"}</span>
                      <span className="text-[11px] text-slate-500">{doc.partyName || "—"}</span>
                    </div>
                    <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto pb-1 text-[10px] text-slate-400">
                      {isAr ? "توقيع المستلم" : "Receiver Signature"}
                    </div>
                  </div>
                </div>

                {/* Document Security Footer */}
                <div className="mt-6 pt-3 border-t border-slate-200 flex items-start justify-between text-[10px] text-slate-400">
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-1 rounded-lg shadow-sm border border-slate-200">
                      <QRCode 
                        value={`${window.location.origin}/verify/receipt/${doc.authoritativeId}`} 
                        size={48} 
                        level="L" 
                      />
                    </div>
                    <div className="flex flex-col gap-1 font-mono">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          {isAr
                            ? `مستند مالي إلكتروني معتمد — كود التحقق: ${doc.authoritativeId.substring(0, 12)}`
                            : `Certified Electronic Financial Voucher — Hash: ${doc.authoritativeId.substring(0, 12)}`}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-400">
                        {isAr ? "امسح الرمز للتحقق من صحة السند" : "Scan QR code to verify authenticity"}
                      </span>
                    </div>
                  </div>
                  <div className="self-end">
                    <span>{isAr ? "تاريخ الإصدار والطباعة:" : "Printed on:"} {new Date().toLocaleString(isAr ? "ar-AE" : "en-US")}</span>
                  </div>
                </div>
              </div>
            </CompanyLetterheadFrame>
          </div>
        </div>
      </div>
    </div>
  );
};
