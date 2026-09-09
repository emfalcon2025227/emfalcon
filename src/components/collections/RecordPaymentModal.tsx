import React, { useState } from "react";
import { Receipt, AlertTriangle, CheckCircle2, CreditCard, DollarSign, ShieldAlert, Sparkles } from "lucide-react";
import { Modal } from "../common/Modal";
import { Cheque, PaymentMethod, CollectionRecord } from "../../types";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { SearchableSelect } from "../common/SearchableSelect";
import { isCardPayment } from "../../utils/paymentUtils";
import { SmartDocumentCaptureModal } from "../ai/SmartDocumentCaptureModal";

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cheque: Cheque | null;
  onPaymentSuccess: (receipt: CollectionRecord) => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  cheque,
  onPaymentSuccess,
}) => {
  const { t, language } = useLanguage();
  const { tenants, recordCollection, cases } = useData();
  const { currentUser } = useAuth();

  const isAdmin = currentUser?.role === "SYSTEM_OWNER" || currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "MANAGER";

  const tenant = cheque ? tenants.find((t) => t.id === cheque.tenantId) : null;

  const [amountEntered, setAmountEntered] = useState<number>(0);
  const [bouncedFeeAmount, setBouncedFeeAmount] = useState<number>(500);
  const [bouncedFeeReason, setBouncedFeeReason] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [payerName, setPayerName] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [approvalCode, setApprovalCode] = useState("");
  const [notes, setNotes] = useState("");
  const [showConfirmStep, setShowConfirmStep] = useState(false);
  const [isSmartCaptureOpen, setIsSmartCaptureOpen] = useState(false);

  const checkCaseControlledCheque = (chequeId: string): { isControlled: boolean; caseId?: string; caseNumber?: string } => {
    if (!cheque || !cheque.convertedToCaseId) {
      return { isControlled: false };
    }
    const linkedCase = cases.find(c => c.id === cheque.convertedToCaseId);
    if (!linkedCase) {
      return { isControlled: false };
    }
    const isControlled = linkedCase.status !== "CLOSED" && linkedCase.status !== "ARCHIVED";
    if (isControlled) {
      return { isControlled: true, caseId: linkedCase.id, caseNumber: linkedCase.caseNumber };
    }
    return { isControlled: false };
  };

  const caseControl = cheque ? checkCaseControlledCheque(cheque.id) : { isControlled: false };

  // Synchronize state when the cheque prop changes
  React.useEffect(() => {
    if (cheque) {
      setAmountEntered(cheque.outstanding);
      setBouncedFeeAmount(cheque.bouncedFeeCollected ? 0 : 500);
      setBouncedFeeReason("");
      setPaymentMethod("BANK_TRANSFER");
      setPayerName(tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : "");
      setTransactionReference("");
      setNotes("");
      setShowConfirmStep(false);
    }
  }, [cheque, tenant, language]);

  if (!cheque) return null;

  const outstanding = cheque.outstanding;
  const isOverpayment = amountEntered > outstanding;
  const appliedAmount = Math.min(amountEntered, outstanding);
  const remainingAfterPayment = Math.max(0, outstanding - appliedAmount);
  const finalBouncedFee = cheque.bouncedFeeCollected ? 0 : bouncedFeeAmount;
  const totalAmountCollected = appliedAmount + finalBouncedFee;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (caseControl.isControlled) {
      return;
    }

    if (finalBouncedFee !== 500 && !cheque.bouncedFeeCollected && !bouncedFeeReason.trim()) {
      alert(language === "ar" ? "يرجى كتابة سبب تعديل أو إلغاء غرامة الشيك الراجع (إجباري)" : "Please enter the reason for modifying or cancelling the bounced cheque fee (Mandatory)");
      return;
    }

    if (!showConfirmStep) {
      setShowConfirmStep(true);
      return;
    }

    const combinedNotes = [
      notes,
      finalBouncedFee !== 500 && !cheque.bouncedFeeCollected 
        ? (language === "ar" ? `سبب تعديل/إلغاء غرامة الشيك الراجع (${finalBouncedFee} درهم): ${bouncedFeeReason}` : `Bounced fee modification/cancellation reason (${finalBouncedFee} AED): ${bouncedFeeReason}`)
        : ""
    ].filter(Boolean).join(" | ");

    const res = await recordCollection({
      chequeId: cheque.id,
      amountEntered,
      bouncedFeeAmount: finalBouncedFee,
      paymentMethod,
      payerName: payerName || "Tenant Representative",
      transactionReference: transactionReference || undefined,
      approvalCode: isCardPayment(paymentMethod) ? approvalCode : undefined,
      notes: combinedNotes || undefined,
    });

    setIsSubmitting(false);
    if (res.success && res.receipt) {
      setShowConfirmStep(false);
      onClose();
      onPaymentSuccess(res.receipt);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={language === "ar" ? "تسجيل وقيد تحصيل مالي" : "Record Cheque Collection"}
      subtitle={`Cheque #${cheque.chequeNumber} — Outstanding: AED ${outstanding.toLocaleString()}`}
      icon={<Receipt className="w-5 h-5 text-emerald-600" />}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {caseControl.isControlled && (
          <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl space-y-2 text-rose-950">
            <div className="flex items-center gap-2 font-bold text-rose-900 text-sm">
              <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0" />
              <span>
                {language === "ar"
                  ? "تحصيل مالي محظور - الشيك خاضع لسيطرة القضية"
                  : "Collection Blocked - Case-Controlled Cheque"}
              </span>
            </div>
            <p className="text-xs text-rose-800 leading-relaxed font-semibold">
              {language === "ar"
                ? `هذا الشيك محجوز على ذمة قضية قانونية مفتوحة رقم (${caseControl.caseNumber})، ولا يمكن تحصيله من هذه الشاشة. يتم التحصيل فقط من داخل القضية المرتبطة به كبوابة تحصيل وحيدة.`
                : `This cheque is reserved under an active open legal case #${caseControl.caseNumber} and cannot be collected from this screen. Collection is allowed only from the linked case as the exclusive gateway.`}
            </p>
          </div>
        )}

        {/* Cheque Info Header */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">{language === "ar" ? "رقم الشيك:" : "Cheque #:"}</span>
            <span className="font-mono font-bold text-slate-900">#{cheque.chequeNumber}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">{language === "ar" ? "المبلغ الأصلي:" : "Original Amount:"}</span>
            <span className="font-mono font-bold text-slate-900">AED {cheque.amount.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-amber-700 block text-[10px] uppercase font-bold">{language === "ar" ? "الرصيد المتبقي:" : "Current Outstanding:"}</span>
            <span className="font-mono font-black text-amber-800 text-sm">AED {outstanding.toLocaleString()}</span>
          </div>
        </div>

        {/* Overpayment Warning if Entered > Outstanding */}
        {isOverpayment && (
          <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-1 text-amber-900">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                {language === "ar"
                  ? "تنبيه: المبلغ المدخل أكبر من الرصيد المتبقي على الشيك!"
                  : "Overpayment Warning: Entered amount exceeds outstanding balance!"}
              </span>
            </div>
            <p className="text-[11px] text-amber-800">
              {language === "ar"
                ? `سيقوم النظام تلقائياً بتطبيق الحد الأقصى للمطالبة (${outstanding.toLocaleString()} درهم) وتصفير المتبقي، مع إشعار الفائض (${(amountEntered - outstanding).toLocaleString()} درهم) في سجل التدقيق.`
                : `The system will strictly apply exactly AED ${outstanding.toLocaleString()} to close this cheque balance. Excess AED ${(amountEntered - outstanding).toLocaleString()} will be flagged in the audit log.`}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              {language === "ar" ? "مبلغ تسديد الشيك الفعلي (درهم)" : "Cheque Payment Amount (AED)"} *
            </label>
            <input
              type="number"
              min={1}
              required
              value={amountEntered}
              disabled={caseControl.isControlled}
              onChange={(e) => setAmountEntered(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-black text-slate-900 focus:bg-white text-sm disabled:opacity-50"
            />
          </div>

          <div>
            <SearchableSelect
              label={language === "ar" ? "طريقة السداد والتحصيل" : "Payment Method"}
              required
              disabled={caseControl.isControlled}
              options={[
                { id: "BANK_TRANSFER", label: "تحويل بنكي مباشر", subLabel: "Bank Transfer" },
                { id: "CASH", label: "نقداً بالخزينة", subLabel: "Cash" },
                { id: "CREDIT_CARD", label: "بطاقة بنكية", subLabel: "Credit/Debit Card" },
                { id: "REPLACEMENT_CHEQUE", label: "شيك مصرفي بديل مصدق", subLabel: "Manager's Cheque" },
                { id: "SETTLEMENT_INSTALLMENT", label: "تسوية ودية مقسطة", subLabel: "Settlement Installment" },
              ]}
              value={paymentMethod}
              onChange={(val) => setPaymentMethod(val as PaymentMethod)}
              placeholder={language === "ar" ? "-- اختر طريقة السداد --" : "-- Select Method --"}
              searchPlaceholder={language === "ar" ? "ابحث بنوع طريقة السداد..." : "Search method..."}
            />
            {paymentMethod === "REPLACEMENT_CHEQUE" && (
              <button
                type="button"
                onClick={() => setIsSmartCaptureOpen(true)}
                className="mt-2 w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{language === "ar" ? "مسح الشيك البديل (AI)" : "Scan Replacement Cheque (AI)"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Bounced Cheque Penalty Fee (Office Revenue) */}
        <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <label className="block font-bold text-indigo-900">
              {language === "ar" ? "غرامة الشيك الراجع (تُستحق لصالح حساب المكتب)" : "Bounced Cheque Penalty Fee (Office Revenue)"}
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBouncedFeeAmount(0)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  bouncedFeeAmount === 0 
                    ? "bg-rose-600 text-white shadow-xs" 
                    : "bg-white text-rose-700 border border-rose-200 hover:bg-rose-50"
                }`}
              >
                {language === "ar" ? "إلغاء الغرامة (0)" : "Waive / Cancel (0)"}
              </button>
              <button
                type="button"
                onClick={() => setBouncedFeeAmount(500)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  bouncedFeeAmount === 500 
                    ? "bg-indigo-600 text-white shadow-xs" 
                    : "bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50"
                }`}
              >
                {language === "ar" ? "الافتراضي (500)" : "Default (500)"}
              </button>
            </div>
          </div>

          {cheque.bouncedFeeCollected ? (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl font-medium">
              {language === "ar"
                ? "✓ تم تحصيل غرامة الشيك الراجع مسبقاً لهذا الشيك (صفر رسوم إضافية لتجنب تكرار التحصيل)."
                : "✓ Bounced cheque penalty was already collected for this cheque (0 additional fee to prevent duplicate charging)."}
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={bouncedFeeAmount}
                  disabled={caseControl.isControlled}
                  onChange={(e) => setBouncedFeeAmount(parseFloat(e.target.value) || 0)}
                  className="flex-1 px-3 py-2 text-xs bg-white border border-indigo-300 rounded-xl font-mono font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <span className="text-xs font-bold text-indigo-800">AED</span>
              </div>

              {bouncedFeeAmount !== 500 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 animate-fadeIn">
                  <label className="block text-[11px] font-bold text-amber-900">
                    {language === "ar" 
                      ? "سبب تعديل أو إلغاء غرامة الشيك الراجع (إجباري): *" 
                      : "Reason for modifying or cancelling bounced fee (Mandatory): *"}
                  </label>
                  <input
                    type="text"
                    required={bouncedFeeAmount !== 500}
                    value={bouncedFeeReason}
                    onChange={(e) => setBouncedFeeReason(e.target.value)}
                    placeholder={language === "ar" ? "اكتب سبب التعديل أو الاستثناء أو الإلغاء هنا..." : "Enter reason for modification or cancellation..."}
                    className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none font-semibold"
                  />
                </div>
              )}

              <p className="text-[10px] text-slate-500 italic">
                {language === "ar"
                  ? "ملاحظة: يمكنك تعديل المبلغ أو إلغاؤه (وضعه 0). عند التغيير أو الإلغاء، يدخل المبلغ المعدل مباشرة إلى النظام المالي والتقارير."
                  : "Note: You can modify or cancel (set to 0) the fee. Modified or zeroed amounts enter the financial system and reports directly."}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              {language === "ar" ? "اسم القائم بالسداد / الدافع" : "Payer Name"} *
            </label>
            <input
              type="text"
              required
              value={payerName}
              disabled={caseControl.isControlled}
              onChange={(e) => setPayerName(e.target.value)}
              placeholder="Tenant or authorized representative"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              {language === "ar" ? "رقم المرجع / الحوالة البنكية" : "Transaction / Wire Reference #"}
            </label>
            <input
              type="text"
              value={transactionReference}
              disabled={caseControl.isControlled}
              onChange={(e) => setTransactionReference(e.target.value)}
              placeholder="FT2408129384"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono disabled:opacity-50"
            />
          </div>
          {isCardPayment(paymentMethod) && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {language === "ar" ? "رمز الموافقة البنكي" : "Bank Approval Code"} *
              </label>
              <input
                type="text"
                required
                value={approvalCode}
                disabled={caseControl.isControlled}
                onChange={(e) => setApprovalCode(e.target.value)}
                placeholder="ABC-123456"
                className="w-full px-3 py-2 text-xs bg-white border-2 border-emerald-300 rounded-xl font-mono disabled:opacity-50 focus:border-emerald-500"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">
            {language === "ar" ? "ملاحظات التحصيل وسند القبض" : "Collection & Receipt Notes"}
          </label>
          <textarea
            rows={2}
            value={notes}
            disabled={caseControl.isControlled}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Partial recovery / full settlement agreement..."
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl disabled:opacity-50"
          />
        </div>

        {/* Live Calculation & Financial Split Preview */}
        <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
          <div className="grid grid-cols-3 gap-2 pb-3 border-b border-slate-800 text-center">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">
                {language === "ar" ? "تسديد الشيك (للصالح المالك)" : "Rent Recovery"}
              </span>
              <span className="font-bold text-emerald-400 font-mono text-xs sm:text-sm">
                AED {appliedAmount.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-indigo-300 block uppercase">
                {language === "ar" ? "غرامة الشيك (لصالح المكتب)" : "Office Penalty"}
              </span>
              <span className="font-bold text-indigo-300 font-mono text-xs sm:text-sm">
                AED {finalBouncedFee.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-amber-400 block uppercase">
                {language === "ar" ? "إجمالي المستلم من المستأجر" : "Total Collected"}
              </span>
              <span className="font-bold text-amber-300 font-mono text-xs sm:text-sm">
                AED {totalAmountCollected.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              {language === "ar" ? "الرصيد المتبقي على الشيك:" : "Remaining Cheque Outstanding:"}
            </span>
            <span
              className={`font-bold font-mono ${
                remainingAfterPayment === 0 ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {remainingAfterPayment === 0 ? "FULLY SETTLED (0 AED)" : `AED ${remainingAfterPayment.toLocaleString()}`}
            </span>
          </div>
        </div>

        {/* Iframe-Safe Confirmation Step */}
        {showConfirmStep && (
          <div className="p-3.5 bg-emerald-50 border-2 border-emerald-300 rounded-2xl space-y-1.5 text-emerald-900">
            <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 animate-pulse" />
              <span>
                {language === "ar"
                  ? "خطوة التأكيد النهائي - يرجى المراجعة"
                  : "Final Confirmation - Please Review"}
              </span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              {language === "ar"
                ? `سيتم حفظ وتأكيد استلام (AED ${amountEntered.toLocaleString()}) للشيك رقم #${cheque.chequeNumber}. لا يمكن تعديل السند بعد تأكيد الحفظ.`
                : `This will authorize and save a payment of AED ${amountEntered.toLocaleString()} against Cheque #${cheque.chequeNumber}. This cannot be edited once saved.`}
            </p>
          </div>
        )}

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              if (showConfirmStep) {
                setShowConfirmStep(false);
              } else {
                onClose();
              }
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            {showConfirmStep ? (language === "ar" ? "تعديل البيانات" : "Go Back & Edit") : t("cancel")}
          </button>
          <button
            type="submit"
            disabled={caseControl.isControlled}
            className={`inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-colors ${
              caseControl.isControlled
                ? "bg-slate-400 cursor-not-allowed opacity-50"
                : showConfirmStep 
                  ? "bg-amber-600 hover:bg-amber-700 animate-bounce cursor-pointer" 
                  : "bg-emerald-700 hover:bg-emerald-800 cursor-pointer"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {showConfirmStep
                ? (language === "ar" ? "تأكيد نهائي وإصدار السند" : "Authorize & Commit Collection")
                : (language === "ar" ? "اعتماد القبض وإصدار السند" : "Commit Collection & Issue Voucher")}
            </span>
          </button>
        </div>
      </form>

      <SmartDocumentCaptureModal
        isOpen={isSmartCaptureOpen}
        onClose={() => setIsSmartCaptureOpen(false)}
        documentType="CHEQUE"
        onApprove={(result) => {
          setIsSmartCaptureOpen(false);
          if (result.chequeNumber?.value) {
            setTransactionReference(`Replacement Chq #${result.chequeNumber.value}`);
          }
          if (result.amountNumeric?.value || result.amount?.value) {
            setAmountEntered(result.amountNumeric?.value || Number(result.amount?.value) || amountEntered);
          }
          if (result.bankName?.value) {
            setNotes(prev => `${prev ? prev + '\n' : ''}Bank: ${result.bankName?.value}`);
          }
        }}
      />
    </Modal>
  );
};
