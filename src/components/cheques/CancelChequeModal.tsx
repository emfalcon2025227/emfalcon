import React, { useState, useMemo } from "react";
import {
  X,
  Ban,
  AlertTriangle,
  FileSpreadsheet,
  Building2,
  User,
  CreditCard,
  FileCheck,
  AlertCircle,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { Cheque, ChequeCancellationType } from "../../types";
import { SearchableSelect, SearchableOption } from "../common/SearchableSelect";

interface CancelChequeModalProps {
  cheque: Cheque;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CancelChequeModal: React.FC<CancelChequeModalProps> = ({
  cheque,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const {
    cancelCheque,
    tenants,
    properties,
    leases,
    owners,
    cases,
  } = useData();

  const [cancellationType, setCancellationType] = useState<ChequeCancellationType>(
    "SETTLED_OTHER_MEANS"
  );
  const [settlementRef, setSettlementRef] = useState("");
  const [reason, setReason] = useState("");
  const [cancellationDate, setCancellationDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cancellationOptions: SearchableOption[] = useMemo(() => [
    {
      id: "SETTLED_OTHER_MEANS",
      label: isAr
        ? "تم السداد بوسيلة بديلة (نقداً / تحويل بنكي / بطاقة)"
        : "Settled via Alternative Means (Cash / Bank Transfer / Card)",
      subLabel: isAr
        ? "يتطلب توثيق المرجع المالي البديل أو رقم سند القبض"
        : "Requires recording alternative settlement voucher / transaction ref",
    },
    {
      id: "REPLACED",
      label: isAr
        ? "تم استبدال الشيك بشيك آخر جديد (Replaced)"
        : "Replaced with New Cheque (Replaced)",
      subLabel: isAr
        ? "استبدال رسمي مع إنشاء سجل الشيك البديل"
        : "Official replacement linked to replacement record",
    },
    {
      id: "CONTRACT_TERMINATED",
      label: isAr
        ? "تم فسخ أو إنهاء العقد الإيجاري بالتراضي"
        : "Lease Contract Terminated / Cancelled",
      subLabel: isAr
        ? "إلغاء الشيك تزامناً مع إخلاء أو إنهاء العقد رسمياً"
        : "Cheque cancelled in conjunction with formal contract termination",
    },
    {
      id: "APPROVED_WAIVER",
      label: isAr
        ? "إعفاء / خصم مالي معتمد من المالك (Approved Waiver)"
        : "Approved Financial Waiver / Discount by Owner",
      subLabel: isAr
        ? "إسقاط الدفعة بموجب موافقة خطية أو تسوية معتمدة"
        : "Installment waived pursuant to owner authorization",
    },
    {
      id: "OTHER",
      label: isAr
        ? "سبب إداري / تشغيلي آخر (Other Reason)"
        : "Other Administrative / Operational Reason",
      subLabel: isAr
        ? "إلغاء الورقة المالية مع توثيق السبب التفصيلي"
        : "Cancel financial instrument with detailed justification",
    },
  ], [isAr]);

  if (!isOpen) return null;

  const tenant = tenants.find((t) => t.id === cheque.tenantId);
  const lease = leases.find((l) => l.id === cheque.leaseId);
  const owner = owners.find((o) => o.id === cheque.ownerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // 1. Legal check
    const isControlled = cases.some((c) => {
      if (c.status === "CLOSED" || c.status === "ARCHIVED" || c.status === "SETTLED") return false;
      return (c as any).chequeId === cheque.id || (Array.isArray(c.linkedChequeIds) && c.linkedChequeIds.includes(cheque.id));
    });

    if (isControlled) {
      setErrorMsg(
        isAr
          ? "عذراً، هذا الشيك محجوز على ذمة قضية قانونية ولا يمكن إلغاؤه من شاشة العمليات."
          : "Sorry, this cheque is locked under an active legal case and cannot be cancelled."
      );
      return;
    }

    // 2. Reason validation
    if (!reason.trim()) {
      setErrorMsg(
        isAr
          ? "يرجى توضيح سبب إلغاء الشيك بالتفصيل."
          : "Please specify the cancellation reason."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = cancelCheque({
        chequeId: cheque.id,
        reason: `${reason.trim()} [تاريخ الإلغاء: ${cancellationDate}]`,
        cancellationType,
        settlementRef: settlementRef.trim() || undefined,
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to cancel cheque");
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-rose-700 to-rose-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs">
              <Ban className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">
                {isAr ? "إلغاء شيك إيجاري (Cancel Cheque)" : "Cheque Cancellation"}
              </h3>
              <p className="text-xs text-rose-100 mt-0.5">
                {isAr
                  ? "إلغاء ورقة الشيك رسمياً وتوثيق المرجع المالي البديل لضمان حقوق المالك"
                  : "Officially cancel cheque with financial justification and settlement reference"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Error Banner */}
          {errorMsg && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-3 text-rose-800 dark:text-rose-300 text-xs font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Cheque Info Summary */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-rose-600" />
                {isAr ? "بيانات الشيك المراد إلغاؤه" : "Target Cheque Details"}
              </span>
              <span className="font-mono font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md">
                #{cheque.chequeNumber}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-400 block">{isAr ? "المستأجر" : "Tenant"}</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">{isAr ? "رقم العقد" : "Contract #"}</span>
                <span className="font-bold font-mono text-slate-800 dark:text-slate-100">
                  {lease?.leaseNumber || cheque.leaseId || "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">{isAr ? "البنك" : "Bank"}</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {cheque.bankName || "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">{isAr ? "مبلغ الشيك" : "Amount"}</span>
                <span className="font-black text-slate-900 dark:text-white font-mono">
                  {cheque.amount.toLocaleString()} {isAr ? "د.إ" : "AED"}
                </span>
              </div>
            </div>
          </div>

          {/* Cancellation Type with SearchableSelect */}
          <div>
            <SearchableSelect
              label={isAr ? "نوع وتصنيف الإلغاء المالي *" : "Cancellation Type *"}
              options={cancellationOptions}
              value={cancellationType}
              onChange={(val) => setCancellationType(val as ChequeCancellationType)}
              searchPlaceholder={isAr ? "ابحث عن نوع الإلغاء..." : "Search cancellation type..."}
            />
          </div>

          {/* Settlement / Financial Reference */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? "المرجع المالي / رقم السند البديل" : "Settlement Reference / Voucher #"}
            </label>
            <input
              type="text"
              placeholder={
                isAr
                  ? "مثال: سند قبض رقم RV-2026-0042 أو إشعار تحويل بنكي TX-892"
                  : "e.g. Receipt Voucher #RV-2026-0042 or Bank Transfer Ref TX-892"
              }
              value={settlementRef}
              onChange={(e) => setSettlementRef(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 font-mono text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Cancellation Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? "تاريخ الإلغاء *" : "Cancellation Date *"}
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 rtl:right-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                required
                value={cancellationDate}
                onChange={(e) => setCancellationDate(e.target.value)}
                className="w-full pl-9 pr-3 rtl:pr-9 rtl:pl-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 font-semibold text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Detailed Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? "التفاصيل والملاحظات الرقابية *" : "Detailed Notes & Justification *"}
            </label>
            <textarea
              required
              rows={3}
              placeholder={
                isAr
                  ? "اكتب تفاصيل قرار الإلغاء والاعتماد الإداري..."
                  : "Enter comprehensive cancellation notes and management authorization details..."
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Modal Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
            >
              {isAr ? "تراجع" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <span>{isAr ? "جارٍ الإلغاء..." : "Cancelling..."}</span>
              ) : (
                <>
                  <Ban className="w-4 h-4" />
                  <span>{isAr ? "تأكيد إلغاء الشيك" : "Confirm Cheque Cancellation"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
