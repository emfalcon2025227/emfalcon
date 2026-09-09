import React, { useEffect, useState } from "react";
import { ShieldCheck, XCircle, AlertCircle, RefreshCcw, Building2 } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import QRCode from "react-qr-code";

interface VerificationData {
  valid: boolean;
  receiptNumber: string;
  amount: number;
  currency: string;
  paymentDate: string;
  paymentMethod: string;
  tenantName: string;
  payerName: string;
  status: "VERIFIED" | "REVERSED" | "CANCELLED";
  error?: string;
}

export const PublicReceiptVerification: React.FC<{ token: string }> = ({ token }) => {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerificationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = language === "ar" ? "التحقق من الإيصال" : "Receipt Verification";
    
    fetch(`/api/verify/receipt/${token}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.error) {
          setError(resData.error);
        } else {
          setData(resData);
        }
      })
      .catch((err) => {
        setError("NETWORK_ERROR");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token, language]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  const renderError = () => {
    let title = language === "ar" ? "إيصال غير صالح" : "Invalid Verification Code";
    let message = language === "ar" ? "رابط التحقق غير صالح أو منتهي الصلاحية." : "The verification link is invalid or has expired.";
    
    if (error === "NOT_FOUND") {
      title = language === "ar" ? "الإيصال غير موجود" : "Receipt Not Found";
      message = language === "ar" ? "لم يتم العثور على إيصال صالح لرمز التحقق هذا." : "No valid receipt was found for this verification code.";
    }

    return (
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border border-slate-100 text-center space-y-4">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-500 mb-2">
          <XCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-800">{title}</h2>
        <p className="text-sm text-slate-500 leading-relaxed">{message}</p>
      </div>
    );
  };

  const renderContent = () => {
    if (!data) return renderError();

    if (data.status === "REVERSED" || data.status === "CANCELLED") {
      return (
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border border-slate-100 text-center space-y-4">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-500 mb-2">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-800">
            {language === "ar" ? "تم عكس الدفع" : "Payment Reversed"}
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            {language === "ar" 
              ? "تم إصدار هذا الإيصال سابقًا، ولكن الدفعة المرتبطة به لم تعد نشطة." 
              : "This receipt was previously issued, but the associated payment is no longer active."}
          </p>
          <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100 text-start space-y-2">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Receipt No.</span>
              <span className="font-mono font-bold text-slate-800">{data.receiptNumber}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Status</span>
              <span className="font-bold text-rose-600 uppercase">{data.status}</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-3xl shadow-xl max-w-sm w-full border border-slate-100 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
        <div className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-4 shadow-inner shadow-emerald-200">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-800">
              {language === "ar" ? "تم التحقق من الدفع" : "Payment Verified"}
            </h2>
            <p className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full inline-block border border-emerald-200">
              {language === "ar" ? "هذا الإيصال مطابق للسجلات المالية الرسمية" : "Matches Official Financial Records"}
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex justify-between items-center pb-3 border-b border-slate-50">
              <span className="text-xs text-slate-500 font-semibold">{language === "ar" ? "رقم الإيصال" : "Receipt No."}</span>
              <span className="text-sm font-mono font-black text-slate-900">{data.receiptNumber}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-50">
              <span className="text-xs text-slate-500 font-semibold">{language === "ar" ? "المبلغ" : "Amount"}</span>
              <span className="text-sm font-mono font-black text-slate-900">AED {data.amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-50">
              <span className="text-xs text-slate-500 font-semibold">{language === "ar" ? "تاريخ الدفع" : "Payment Date"}</span>
              <span className="text-sm font-mono font-bold text-slate-800">{data.paymentDate}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-50">
              <span className="text-xs text-slate-500 font-semibold">{language === "ar" ? "طريقة الدفع" : "Payment Method"}</span>
              <span className="text-[10px] font-mono font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded uppercase">
                {data.paymentMethod.replace("_", " ")}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 font-semibold">{language === "ar" ? "المستأجر" : "Tenant"}</span>
              <span className="text-xs font-bold text-slate-800">{data.tenantName}</span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center pt-6 border-t border-slate-100 mt-6">
            <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 mb-3">
              <QRCode value={window.location.href} size={96} level="L" />
            </div>
            <span className="text-[10px] text-slate-400 font-medium">{language === "ar" ? "امسح الرمز للتحقق" : "Scan to verify"}</span>
          </div>

        </div>
        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <Building2 className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Emirates Falcon ERP</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 md:p-8 selection:bg-amber-100 font-sans" dir={language === "ar" ? "rtl" : "ltr"}>
      {error ? renderError() : renderContent()}
    </div>
  );
};
