import React from "react";
import { AlertTriangle, X, Check, Copy, FileText, User, CreditCard } from "lucide-react";
import { Modal } from "../common/Modal";
import { Cheque } from "../../types";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";

interface DuplicateWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmOverride: () => void;
  existingCheque: Cheque;
  newChequeData: {
    chequeNumber: string;
    bankName: string;
    amount: number;
    drawerName?: string;
    leaseId?: string;
    tenantId?: string;
    chequeDate: string;
    dueDate: string;
  };
}

export const DuplicateWarningModal: React.FC<DuplicateWarningModalProps> = ({
  isOpen,
  onClose,
  onConfirmOverride,
  existingCheque,
  newChequeData,
}) => {
  const { t, language } = useLanguage();
  const { tenants, leases, properties } = useData();

  const isArabic = language === "ar";

  // Resolve existing details
  const existingTenant = tenants.find((t) => t.id === existingCheque.tenantId);
  const existingLease = leases.find((l) => l.id === existingCheque.leaseId);
  const existingDrawerName =
    existingCheque.drawerName ||
    (existingTenant ? (isArabic ? existingTenant.nameAr : existingTenant.nameEn) : "—");

  // Resolve new input details
  const newTenant = tenants.find((t) => t.id === newChequeData.tenantId);
  const newLease = leases.find((l) => l.id === newChequeData.leaseId);
  const newDrawerName =
    newChequeData.drawerName ||
    (newTenant ? (isArabic ? newTenant.nameAr : newTenant.nameEn) : "—");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isArabic ? "تحذير: تطابق واشتباه تكرار الشيك في النظام!" : "Warning: Duplicate Cheque Detected!"}
      subtitle={
        isArabic
          ? "تم التحقق ومطابقة رقم الشيك مع اسم كاتب الشيك وعقد الإيجار المسجل"
          : "Verified match across Cheque Number, Drawer Name, and Lease Contract"
      }
      icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
      maxWidth="3xl"
    >
      <div className="space-y-4 text-xs">
        <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl text-amber-950 leading-relaxed shadow-2xs">
          <div className="font-bold flex items-center gap-1.5 mb-1 text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>{isArabic ? "معايير التحقق من التكرار النشطة:" : "Active Verification Criteria:"}</span>
          </div>
          <p>
            {isArabic
              ? "تم رصد تطابق كامل بين الشيك المدخل والشيك المسجل مسبقاً بناءً على: (1) رقم الشيك، (2) اسم كاتب الشيك / الساحب، و(3) عقد الإيجار. يرجى مراجعة البيانات أدناه لتفادي قيد الشيك مرتين."
              : "A match was found based on (1) Cheque Number, (2) Drawer/Writer Name, and (3) Lease Contract. Please review the comparison below to avoid double entry."}
          </p>
        </div>

        {/* Side by Side Comparison Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Existing Cheque Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                {isArabic ? "الشيك المسجل مسبقاً في النظام" : "Existing System Record"}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
                {existingCheque.status}
              </span>
            </div>
            <div className="space-y-2 text-slate-700">
              <div className="p-2 bg-white rounded-xl border border-slate-200/80">
                <span className="text-slate-400 block text-[10px] font-semibold">{isArabic ? "رقم الشيك:" : "Cheque Number:"}</span>
                <span className="font-bold font-mono text-slate-900 text-sm">#{existingCheque.chequeNumber}</span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-slate-200/80">
                <span className="text-slate-400 block text-[10px] font-semibold">{isArabic ? "اسم كاتب الشيك / الساحب:" : "Drawer / Writer Name:"}</span>
                <span className="font-bold text-amber-950 text-xs">{existingDrawerName}</span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-slate-200/80">
                <span className="text-slate-400 block text-[10px] font-semibold">{isArabic ? "عقد الإيجار المرتبط:" : "Lease Contract:"}</span>
                <span className="font-bold font-mono text-slate-900 text-xs">
                  {existingLease ? existingLease.leaseNumber : isArabic ? "غير محدد" : "N/A"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px]">{isArabic ? "المصرف:" : "Bank:"}</span>
                  <span className="font-semibold text-slate-800 text-[11px] truncate block">{existingCheque.bankName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{isArabic ? "المبلغ:" : "Amount:"}</span>
                  <span className="font-bold font-mono text-amber-800 text-xs">AED {existingCheque.amount.toLocaleString()}</span>
                </div>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">{isArabic ? "تاريخ الاستحقاق:" : "Due Date:"}</span>
                <span className="font-mono text-slate-800 text-xs">{existingCheque.dueDate}</span>
              </div>
            </div>
          </div>

          {/* New Proposed Cheque Card */}
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-300 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-amber-200 pb-2">
              <span className="font-bold text-amber-950 uppercase tracking-wider text-[11px]">
                {isArabic ? "بيانات الشيك الجديد المراد إدخاله" : "New Input Cheque"}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                {isArabic ? "قيد جديد" : "New Entry"}
              </span>
            </div>
            <div className="space-y-2 text-slate-700">
              <div className="p-2 bg-white rounded-xl border border-amber-200/80">
                <span className="text-slate-400 block text-[10px] font-semibold">{isArabic ? "رقم الشيك:" : "Cheque Number:"}</span>
                <span className="font-bold font-mono text-slate-900 text-sm">#{newChequeData.chequeNumber}</span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-amber-200/80">
                <span className="text-slate-400 block text-[10px] font-semibold">{isArabic ? "اسم كاتب الشيك / الساحب:" : "Drawer / Writer Name:"}</span>
                <span className="font-bold text-amber-950 text-xs">{newDrawerName}</span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-amber-200/80">
                <span className="text-slate-400 block text-[10px] font-semibold">{isArabic ? "عقد الإيجار المرتبط:" : "Lease Contract:"}</span>
                <span className="font-bold font-mono text-slate-900 text-xs">
                  {newLease ? newLease.leaseNumber : isArabic ? "غير محدد" : "N/A"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px]">{isArabic ? "المصرف:" : "Bank:"}</span>
                  <span className="font-semibold text-slate-800 text-[11px] truncate block">{newChequeData.bankName || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{isArabic ? "المبلغ:" : "Amount:"}</span>
                  <span className="font-bold font-mono text-amber-800 text-xs">AED {newChequeData.amount.toLocaleString()}</span>
                </div>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">{isArabic ? "تاريخ الاستحقاق:" : "Due Date:"}</span>
                <span className="font-mono text-slate-800 text-xs">{newChequeData.dueDate}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            {isArabic ? "إلغاء وتعديل البيانات" : "Cancel & Edit Data"}
          </button>
          <button
            type="button"
            onClick={onConfirmOverride}
            className="px-5 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            {isArabic ? "تأكيد الحفظ بالرغم من التطابق" : "Force Proceed & Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
};
