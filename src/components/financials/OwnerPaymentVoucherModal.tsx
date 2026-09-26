import React, { useRef } from "react";
import {
  Printer,
  Download,
  Building,
  User,
  Calendar,
  DollarSign,
  CheckCircle2,
  FileText,
  ShieldCheck,
  CreditCard,
  Building2,
  X,
} from "lucide-react";
import { OwnerTransferRecord, Owner, Property } from "../../types";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { exportElementToPdf } from "../../utils/pdfExportUtils";

interface OwnerPaymentVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: OwnerTransferRecord | null;
  owner?: Owner | null;
  properties?: Property[];
}

/**
 * Basic Arabic Tafqeet Helper for UAE Dirhams
 */
function numberToArabicWordsAED(num: number): string {
  if (!num || isNaN(num) || num <= 0) return "صفر درهم إماراتي لا غير";
  
  const units = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
  const teens = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مئتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

  const integerPart = Math.floor(num);
  const filsPart = Math.round((num - integerPart) * 100);

  function convertGroup(n: number): string {
    let res = "";
    const h = Math.floor(n / 100);
    const remainder = n % 100;
    const t = Math.floor(remainder / 10);
    const u = remainder % 10;

    if (h > 0) res += hundreds[h];

    if (remainder > 0) {
      if (res.length > 0) res += " و ";
      if (remainder < 10) {
        res += units[remainder];
      } else if (remainder < 20) {
        res += teens[remainder - 10];
      } else {
        if (u > 0) res += units[u] + " و ";
        res += tens[t];
      }
    }
    return res;
  }

  let result = "";
  const thousands = Math.floor(integerPart / 1000);
  const remainder = integerPart % 1000;

  if (thousands > 0) {
    if (thousands === 1) result += "ألف";
    else if (thousands === 2) result += "ألفان";
    else if (thousands >= 3 && thousands <= 10) result += convertGroup(thousands) + " آلاف";
    else result += convertGroup(thousands) + " ألف";
  }

  if (remainder > 0) {
    if (result.length > 0) result += " و ";
    result += convertGroup(remainder);
  }

  result += " درهم إماراتي";

  if (filsPart > 0) {
    result += ` و ${filsPart} فلساً`;
  }

  result += " لا غير";
  return result;
}

export const OwnerPaymentVoucherModal: React.FC<OwnerPaymentVoucherModalProps> = ({
  isOpen,
  onClose,
  transfer,
  owner,
  properties = [],
}) => {
  const { language } = useLanguage();
  const { companyProfile } = useData();
  const isAr = language === "ar";
  const voucherRef = useRef<HTMLDivElement>(null);

  const logoSrc = companyProfile?.logoUrl || companyProfile?.logoBase64 || companyProfile?.logo;
  const companyNameAr = companyProfile?.nameAr || "شركة صقر الإمارات العقارية";
  const companyNameEn = companyProfile?.nameEn || "EMIRATES FALCON REAL ESTATE L.L.C";
  const companyAddress = isAr
    ? companyProfile?.addressAr || companyProfile?.address || "الشارقة - دبي - الإمارات العربية المتحدة"
    : companyProfile?.addressEn || companyProfile?.address || "Sharjah - Dubai - United Arab Emirates";

  if (!isOpen || !transfer) return null;

  // STRICT RULE: Payment Voucher is ONLY for PAID transfers
  if (transfer.status !== "PAID") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <X className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {isAr ? "سند الدفع غير متاح" : "Payment Voucher Unavailable"}
          </h3>
          <p className="text-xs text-slate-600">
            {isAr
              ? "لا يمكن إصدار سند دفع إلا بعد صرف وتحويل الدفعة فعلياً وتغيير حالتها إلى (مسددة - PAID)."
              : "Payment vouchers can only be generated for transfers with 'PAID' status."}
          </p>
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-900 text-white text-xs font-bold rounded-xl"
          >
            {isAr ? "إغلاق" : "Close"}
          </button>
        </div>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!voucherRef.current) return;
    await exportElementToPdf(voucherRef.current, {
      fileName: `سند_دفع_مالك_${transfer.transferNumber || transfer.id}.pdf`,
      title: `سند دفع مالك - ${transfer.transferNumber}`,
      orientation: "p",
    });
  };

  const netAmount = transfer.amount;
  const arabicWords = numberToArabicWordsAED(netAmount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Top Actions Bar (Hidden on Print) */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-sm">
              {isAr ? "سند دفع وتحويل مالك رسمي (Payment Voucher)" : "Official Owner Payment Voucher"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isAr ? "طباعة السند" : "Print"}</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isAr ? "تصدير PDF" : "PDF"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Container */}
        <div className="p-6 sm:p-8 overflow-y-auto bg-slate-50 flex-1">
          <div
            ref={voucherRef}
            className="bg-white p-8 rounded-xl shadow-xs border border-slate-300 max-w-2xl mx-auto space-y-6 text-slate-900 print:shadow-none print:border-none print:p-0"
          >
            {/* 1. Official Letterhead */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5 gap-4">
              <div className="flex items-center gap-3">
                {logoSrc ? (
                  <div className="w-14 h-14 rounded-xl border border-slate-200 overflow-hidden shrink-0 bg-white flex items-center justify-center p-1 shadow-xs">
                    <img
                      src={logoSrc}
                      alt="Office Logo"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 bg-slate-900 text-amber-400 flex items-center justify-center rounded-xl font-black text-xl shrink-0">
                    EF
                  </div>
                )}
                <div>
                  <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
                    {companyNameAr}
                  </h1>
                  <div className="text-xs text-slate-500 font-medium">{companyNameEn}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{companyAddress}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {companyProfile?.phone ? `هاتف: ${companyProfile.phone}` : "هاتف: 06-5000000"} 
                    {companyProfile?.vatTrn ? ` | TRN: ${companyProfile.vatTrn}` : " | ترخيص عقاري معتمد"}
                  </div>
                </div>
              </div>

              <div className="text-end shrink-0">
                <div className="inline-block px-3 py-1 bg-amber-500 text-slate-950 font-black text-xs rounded uppercase tracking-wider mb-2">
                  سند دفع وتحويل مالك
                </div>
                <div className="text-xs font-mono font-bold text-slate-900">
                  VOUCHER #: {transfer.transferNumber || `TR-${transfer.id.slice(-6)}`}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  التاريخ: {transfer.transferDate || new Date().toISOString().split("T")[0]}
                </div>
              </div>
            </div>

            {/* 2. Amount Highlights Banner */}
            <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-400 font-bold uppercase">الصافي المدفوع للمالك / Net Amount Paid</div>
                <div className="text-2xl font-black font-mono text-amber-400 mt-0.5">
                  AED {netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="text-end">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  مسدد نهائياً (PAID)
                </span>
                <div className="text-[11px] text-slate-400 mt-1">
                  طريقة الدفع: {transfer.paymentMethod || "تحويل بنكي"}
                </div>
              </div>
            </div>

            {/* Written Amount In Words */}
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs font-bold text-amber-950 flex items-center gap-2">
              <span className="text-amber-800 shrink-0">المبلغ كتابةً:</span>
              <span className="font-semibold">{arabicWords}</span>
            </div>

            {/* 3. Owner & Beneficiary Details */}
            <div className="grid grid-cols-2 gap-4 text-xs border border-slate-200 p-4 rounded-xl bg-slate-50/50">
              <div>
                <div className="text-slate-500 font-bold mb-1">بيانات المالك المستفيد:</div>
                <div className="font-bold text-slate-900 text-sm">
                  {owner?.nameAr || owner?.nameEn || transfer.ownerName || "المالك"}
                </div>
                <div className="text-slate-600 mt-0.5">كود المالك: {owner?.code || transfer.ownerId}</div>
                {owner?.phone && <div className="text-slate-600">الهاتف: {owner.phone}</div>}
              </div>

              <div>
                <div className="text-slate-500 font-bold mb-1">البيانات المصرفية للتحويل:</div>
                <div className="text-slate-700">البنك: {owner?.bankName || transfer.beneficiaryBankName || "بنك محلي"}</div>
                <div className="text-slate-700 font-mono text-[11px] truncate">
                  IBAN: {owner?.iban || transfer.beneficiaryIban || transfer.bankAccountReference || "N/A"}
                </div>
                <div className="text-slate-700 font-mono text-[11px]">
                  رقم المرجع / الحوالة: {transfer.transactionReferenceNumber || transfer.transferNumber || "TR-REF-CONFIRMED"}
                </div>
              </div>
            </div>

            {/* 4. Financial Breakdown Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 text-start">البيان المالي / Description</th>
                    <th className="py-2.5 px-4 text-end">المبلغ (AED)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-2.5 px-4 font-bold text-slate-800">
                      إجمالي مبلغ التحويل المسدد (Transfer Amount)
                    </td>
                    <td className="py-2.5 px-4 text-end font-mono font-bold text-emerald-700">
                      {netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>

                  <tr className="bg-amber-50 font-black text-sm border-t-2 border-slate-900">
                    <td className="py-3 px-4 text-slate-950">الصافي المحول لحساب المالك الفعلي</td>
                    <td className="py-3 px-4 text-end font-mono text-slate-950">
                      AED {netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Notes if any */}
            {transfer.notes && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                <span className="font-bold block mb-0.5">ملاحظات التحويل:</span>
                <span>{transfer.notes}</span>
              </div>
            )}

            {/* 5. Official Signatures Section */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-200 text-center text-xs">
              <div>
                <div className="font-bold text-slate-800">إعداد المحاسب</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {transfer.createdByName || "قسم الحسابات"}
                </div>
                <div className="h-12 border-b border-dashed border-slate-300 mt-2"></div>
                <div className="text-[10px] text-slate-400 mt-1">التوقيع والختم</div>
              </div>

              <div>
                <div className="font-bold text-slate-800">اعتماد المدير المالي</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {transfer.approvedByUserName || "الإدارة المالية"}
                </div>
                <div className="h-12 border-b border-dashed border-slate-300 mt-2"></div>
                <div className="text-[10px] text-slate-400 mt-1">التوقيع والختم</div>
              </div>

              <div>
                <div className="font-bold text-slate-800">استلام المالك / الحوالة</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {transfer.paidByUserName || "إشعار قيد مصرفي معتمد"}
                </div>
                <div className="h-12 border-b border-dashed border-slate-300 mt-2"></div>
                <div className="text-[10px] text-slate-400 mt-1">تأكيد الاستلام</div>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-slate-100">
              هذا المستند صادر إلكترونياً من نظام صقر الإمارات العقاري لإدارة العقارات والأموال. لا يتطلب توقيعاً يدوياً في حال وجود الختم الإلكتروني.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
