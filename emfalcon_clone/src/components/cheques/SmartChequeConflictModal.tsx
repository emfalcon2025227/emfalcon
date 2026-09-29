import React, { useState } from "react";
import {
  AlertTriangle,
  Sparkles,
  Check,
  X,
  Edit3,
  Calendar,
  Building,
  User,
  CreditCard,
  Layers,
} from "lucide-react";
import { Modal } from "../common/Modal";
import { useLanguage } from "../../context/LanguageContext";

export interface ChequeConflictData {
  field: "amount" | "dueDate" | "bankName" | "chequeNumber" | "drawerName" | "all";
  original: {
    amount?: number;
    dueDate?: string;
    bankName?: string;
    chequeNumber?: string;
    drawerName?: string;
  };
  extracted: {
    amount?: number;
    dueDate?: string;
    bankName?: string;
    chequeNumber?: string;
    drawerName?: string;
  };
  rowId?: string;
  contextTitle?: string;
}

interface SmartChequeConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflict: ChequeConflictData;
  onUseOcr: (resolvedData: {
    amount: number;
    dueDate: string;
    bankName: string;
    chequeNumber: string;
    drawerName: string;
  }) => void;
  onKeepOriginal: (resolvedData: {
    amount: number;
    dueDate: string;
    bankName: string;
    chequeNumber: string;
    drawerName: string;
  }) => void;
  onManualEditApply?: (manualData: {
    amount: number;
    dueDate: string;
    bankName: string;
    chequeNumber: string;
    drawerName: string;
  }) => void;
}

export const SmartChequeConflictModal: React.FC<SmartChequeConflictModalProps> = ({
  isOpen,
  onClose,
  conflict,
  onUseOcr,
  onKeepOriginal,
  onManualEditApply,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const originalAmount = conflict.original.amount ?? 0;
  const extractedAmount = conflict.extracted.amount ?? 0;
  const amountDiff = Math.abs(originalAmount - extractedAmount);

  const hasAmountMismatch =
    originalAmount > 0 &&
    extractedAmount > 0 &&
    amountDiff > 0.01;

  const hasDateMismatch =
    Boolean(conflict.original.dueDate) &&
    Boolean(conflict.extracted.dueDate) &&
    conflict.original.dueDate !== conflict.extracted.dueDate;

  const hasBankMismatch =
    Boolean(conflict.original.bankName) &&
    Boolean(conflict.extracted.bankName) &&
    conflict.original.bankName !== conflict.extracted.bankName;

  const hasDrawerMismatch =
    Boolean(conflict.original.drawerName) &&
    Boolean(conflict.extracted.drawerName) &&
    conflict.original.drawerName !== conflict.extracted.drawerName;

  const [isManualEditing, setIsManualEditing] = useState(false);
  const [manualAmount, setManualAmount] = useState<number>(
    extractedAmount > 0 ? extractedAmount : originalAmount
  );
  const [manualDate, setManualDate] = useState<string>(
    conflict.extracted.dueDate || conflict.original.dueDate || ""
  );
  const [manualBank, setManualBank] = useState<string>(
    conflict.extracted.bankName || conflict.original.bankName || ""
  );
  const [manualNumber, setManualNumber] = useState<string>(
    conflict.extracted.chequeNumber || conflict.original.chequeNumber || ""
  );
  const [manualDrawer, setManualDrawer] = useState<string>(
    conflict.extracted.drawerName || conflict.original.drawerName || ""
  );

  const handleApplyManual = () => {
    if (onManualEditApply) {
      onManualEditApply({
        amount: manualAmount,
        dueDate: manualDate,
        bankName: manualBank,
        chequeNumber: manualNumber,
        drawerName: manualDrawer,
      });
    } else {
      onUseOcr({
        amount: manualAmount,
        dueDate: manualDate,
        bankName: manualBank,
        chequeNumber: manualNumber,
        drawerName: manualDrawer,
      });
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isAr
          ? "مقارنة ومطابقة بيانات الشيك (المسح الذكي Smart OCR)"
          : "AI Cheque Data Conflict Resolution"
      }
      subtitle={
        conflict.contextTitle ||
        (isAr
          ? "تم اكتشاف اختلاف بين البيانات المسجلة بنموذج الإدخال والبيانات المقروءة بالمسح الذكي"
          : "Discrepancy detected between form inputs and AI-scanned cheque data")
      }
      icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Main Banner */}
        <div className="p-4 bg-amber-50/90 border border-amber-300/80 rounded-2xl space-y-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2 text-amber-950 font-bold">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              {isAr
                ? "يرجى مراجعة المقارنة التالية وتحديد القيمة المعتمدة لكل حقل. لن يتم حفظ أي تغيير في النظام أو السجلات المالية إلا بعد تأكيدك النهائي."
                : "Please review the comparison and select the authoritative values. No changes will be committed to the financial engine until your final save."}
            </span>
          </div>

          {/* Comparison Card */}
          <div className="bg-white/95 p-3.5 rounded-xl border border-amber-200 divide-y divide-slate-100 text-slate-800 space-y-2.5">
            {/* Amount Row */}
            {hasAmountMismatch && (
              <div className="pb-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-amber-600" />
                    {isAr ? "مبلغ الشيك / القسط (Amount):" : "Cheque / Installment Amount:"}
                  </span>
                  <span className="text-rose-600 text-[11px] font-mono">
                    {isAr ? "فرق المبلغ:" : "Difference:"} {amountDiff.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                      {isAr ? "القيمة الحالية بالنموذج (Original):" : "Form Value (Original):"}
                    </span>
                    <span className="font-mono font-black text-slate-900 text-sm">
                      {originalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-300">
                    <span className="block text-[10px] text-amber-800 font-semibold mb-0.5 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      {isAr ? "المقروء بالذكاء الاصطناعي (AI OCR):" : "AI Scanned Value (OCR):"}
                    </span>
                    <span className="font-mono font-black text-amber-950 text-sm">
                      {extractedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Due Date Row */}
            {hasDateMismatch && (
              <div className="py-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    {isAr ? "تاريخ الاستحقاق (Due Date):" : "Due Date / Cheque Date:"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="block text-[10px] text-slate-500 font-semibold">
                      {isAr ? "تاريخ النموذج الحالي:" : "Current Form Date:"}
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      {conflict.original.dueDate || "—"}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-indigo-50/80 border border-indigo-200">
                    <span className="block text-[10px] text-indigo-800 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-600" />
                      {isAr ? "تاريخ الشيك المقروء (AI):" : "Scanned Cheque Date (AI):"}
                    </span>
                    <span className="font-mono font-bold text-indigo-950 text-xs">
                      {conflict.extracted.dueDate || "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Bank Row */}
            {hasBankMismatch && (
              <div className="py-2 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Building className="w-4 h-4 text-emerald-600" />
                  <span>{isAr ? "اسم البنك (Bank Name):" : "Bank Name:"}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="block text-[10px] text-slate-500">{isAr ? "بالنموذج:" : "In Form:"}</span>
                    <span className="font-bold text-slate-800">{conflict.original.bankName || "—"}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-200">
                    <span className="block text-[10px] text-emerald-800">{isAr ? "المقروء (AI):" : "Scanned (AI):"}</span>
                    <span className="font-bold text-emerald-950">{conflict.extracted.bankName || "—"}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Drawer Row */}
            {hasDrawerMismatch && (
              <div className="pt-2 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <User className="w-4 h-4 text-cyan-600" />
                  <span>{isAr ? "اسم الساحب / كاتب الشيك (Drawer):" : "Drawer / Writer Name:"}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="block text-[10px] text-slate-500">{isAr ? "بالنموذج:" : "In Form:"}</span>
                    <span className="font-bold text-slate-800">{conflict.original.drawerName || "—"}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-cyan-50/80 border border-cyan-200">
                    <span className="block text-[10px] text-cyan-800">{isAr ? "المقروء (AI):" : "Scanned (AI):"}</span>
                    <span className="font-bold text-cyan-950">{conflict.extracted.drawerName || "—"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="text-slate-600 text-[11px] leading-relaxed">
            {isAr
              ? "اختر اعتماد بيانات المسح الذكي لتحديث النموذج، أو الاحتفاظ بالبيانات الأصلية المدخلة، أو التعديل اليدوي المباشر."
              : "Choose to adopt the AI-scanned values, keep the original form values, or edit the values manually."}
          </p>
        </div>

        {/* In-Modal Manual Edit Drawer */}
        {isManualEditing ? (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-300 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-amber-600" />
                {isAr ? "تعديل يدوي مباشر وتخصيص القيم:" : "Direct Manual Value Editing:"}
              </span>
              <button
                type="button"
                onClick={() => setIsManualEditing(false)}
                className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                {isAr ? "إلغاء التعديل اليدوي" : "Cancel Manual Edit"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isAr ? "المبلغ المعتمد (درهم):" : "Authoritative Amount (AED):"}
                </label>
                <input
                  type="number"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isAr ? "تاريخ الاستحقاق:" : "Due Date:"}
                </label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isAr ? "رقم الشيك:" : "Cheque Number:"}
                </label>
                <input
                  type="text"
                  value={manualNumber}
                  onChange={(e) => setManualNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isAr ? "اسم البنك:" : "Bank Name:"}
                </label>
                <input
                  type="text"
                  value={manualBank}
                  onChange={(e) => setManualBank(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:border-amber-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isAr ? "اسم كاتب الشيك / الساحب:" : "Drawer Name:"}
                </label>
                <input
                  type="text"
                  value={manualDrawer}
                  onChange={(e) => setManualDrawer(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleApplyManual}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isAr ? "اعتماد وتطبيق القيم المعدلة يدوياً" : "Apply Manual Edits to Form"}</span>
            </button>
          </div>
        ) : null}

        {/* Action Buttons */}
        {!isManualEditing && (
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            {/* Option A: Use OCR */}
            <button
              type="button"
              onClick={() => {
                onUseOcr({
                  amount: extractedAmount > 0 ? extractedAmount : originalAmount,
                  dueDate: conflict.extracted.dueDate || conflict.original.dueDate || "",
                  bankName: conflict.extracted.bankName || conflict.original.bankName || "",
                  chequeNumber: conflict.extracted.chequeNumber || conflict.original.chequeNumber || "",
                  drawerName: conflict.extracted.drawerName || conflict.original.drawerName || "",
                });
                onClose();
              }}
              className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-bold text-xs shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 text-slate-950" />
              <span>
                {isAr
                  ? `استخدام بيانات المسح الذكي (${extractedAmount > 0 ? extractedAmount.toLocaleString() + " درهم" : "OCR"})`
                  : `Use OCR Data (${extractedAmount > 0 ? extractedAmount.toLocaleString() + " AED" : "OCR"})`}
              </span>
            </button>

            {/* Option B: Keep Original */}
            <button
              type="button"
              onClick={() => {
                onKeepOriginal({
                  amount: originalAmount,
                  dueDate: conflict.original.dueDate || "",
                  bankName: conflict.original.bankName || "",
                  chequeNumber: conflict.original.chequeNumber || "",
                  drawerName: conflict.original.drawerName || "",
                });
                onClose();
              }}
              className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs border border-slate-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <X className="w-4 h-4 text-slate-600" />
              <span>
                {isAr
                  ? `الاحتفاظ بالبيانات الأصلية (${originalAmount.toLocaleString()} درهم)`
                  : `Keep Original Data (${originalAmount.toLocaleString()} AED)`}
              </span>
            </button>

            {/* Option C: Manual Edit */}
            <button
              type="button"
              onClick={() => setIsManualEditing(true)}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Edit3 className="w-4 h-4 text-amber-400" />
              <span>{isAr ? "تعديل يدوي" : "Edit Manually"}</span>
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
