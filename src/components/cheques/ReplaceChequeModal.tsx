import React, { useState, useMemo } from "react";
import {
  X,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Calendar,
  CreditCard,
  AlertCircle,
  Hash,
  Search,
  Check,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { Cheque } from "../../types";

interface ReplaceChequeModalProps {
  originalCheque: Cheque;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newCheques: Cheque[]) => void;
}

interface ReplacementItemInput {
  chequeNumber: string;
  bankName: string;
  amount: number;
  chequeDate: string;
  dueDate: string;
  drawerName?: string;
  accountNumber?: string;
  notes?: string;
  existingChequeId?: string;
}

export const ReplaceChequeModal: React.FC<ReplaceChequeModalProps> = ({
  originalCheque,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const {
    cheques,
    replaceCheque,
    tenants,
    properties,
    leases,
    cases,
    paymentAllocations,
    checkDuplicateCheque,
  } = useData();

  // Mode: "NEW" (issue new cheques) or "EXISTING" (select an existing eligible cheque in the system)
  const [mode, setMode] = useState<"NEW" | "EXISTING">("NEW");
  const [selectedExistingChequeId, setSelectedExistingChequeId] = useState<string>("");
  const [existingSearchQuery, setExistingSearchQuery] = useState<string>("");

  const [reason, setReason] = useState<string>("");
  const [replaceDate, setReplaceDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Target outstanding amount to be covered
  const targetAmount = useMemo(() => {
    return originalCheque.outstanding > 0
      ? originalCheque.outstanding
      : originalCheque.amount;
  }, [originalCheque]);

  const [replacementCheques, setReplacementCheques] = useState<ReplacementItemInput[]>([
    {
      chequeNumber: "",
      bankName: originalCheque.bankName || "",
      amount: targetAmount,
      chequeDate: new Date().toISOString().split("T")[0],
      dueDate: originalCheque.dueDate || new Date().toISOString().split("T")[0],
      drawerName: originalCheque.drawerName || "",
      accountNumber: originalCheque.accountNumber || "",
      notes: "",
    },
  ]);

  const tenant = tenants.find((t) => t.id === originalCheque.tenantId);
  const lease = leases.find((l) => l.id === originalCheque.leaseId);

  // Eligible existing cheques that are not terminal, not the same cheque, not committed to another obligation, and not locked
  const eligibleExistingCheques = useMemo(() => {
    return cheques.filter((c) => {
      if (c.id === originalCheque.id) return false;
      if (
        c.status === "REPLACED" ||
        c.status === "CANCELLED" ||
        c.status === "COLLECTED" ||
        c.status === "CLEARED" ||
        c.status === "BOUNCED"
      ) {
        return false;
      }
      // Check if already allocated or partially collected
      if ((c.totalApplied && c.totalApplied > 0) || (c.outstanding !== undefined && c.outstanding <= 0)) {
        return false;
      }
      const hasActiveAllocations = paymentAllocations.some(
        (pa) => pa.targetId === c.id && pa.status === "ACTIVE" && (pa.allocatedAmount || 0) > 0
      );
      if (hasActiveAllocations) return false;

      // Check if committed to a different lease contract
      if (c.leaseId && originalCheque.leaseId && c.leaseId !== originalCheque.leaseId) {
        return false;
      }

      // Check if committed to an installment in another lease
      const isCommittedToOtherLease = leases.some((l) => {
        if (originalCheque.leaseId && l.id === originalCheque.leaseId) return false;
        return (l.installments || []).some(
          (inst) => inst.chequeId === c.id || (c.chequeNumber && inst.chequeNumber === c.chequeNumber)
        );
      });
      if (isCommittedToOtherLease) return false;

      // Check if locked by case
      const isControlled = cases.some((cs) => {
        if (cs.status === "CLOSED" || cs.status === "ARCHIVED" || cs.status === "SETTLED") return false;
        return (cs as any).chequeId === c.id || (Array.isArray(cs.linkedChequeIds) && cs.linkedChequeIds.includes(c.id));
      });
      return !isControlled;
    });
  }, [cheques, originalCheque.id, originalCheque.leaseId, cases, paymentAllocations, leases]);

  // Filtered existing cheques for search
  const filteredExistingCheques = useMemo(() => {
    const q = existingSearchQuery.toLowerCase().trim();
    if (!q) return eligibleExistingCheques;
    return eligibleExistingCheques.filter((c) => {
      const matchNum = c.chequeNumber?.toLowerCase().includes(q);
      const matchBank = c.bankName?.toLowerCase().includes(q);
      const matchTenant = c.drawerName?.toLowerCase().includes(q) || c.ownerName?.toLowerCase().includes(q);
      const matchAmt = String(c.amount).includes(q);
      return matchNum || matchBank || matchTenant || matchAmt;
    });
  }, [eligibleExistingCheques, existingSearchQuery]);

  // Handle picking an existing cheque
  const handleSelectExistingCheque = (chq: Cheque) => {
    setSelectedExistingChequeId(chq.id);
    setReplacementCheques([
      {
        chequeNumber: chq.chequeNumber,
        bankName: chq.bankName,
        amount: chq.amount,
        chequeDate: chq.chequeDate || new Date().toISOString().split("T")[0],
        dueDate: chq.dueDate || new Date().toISOString().split("T")[0],
        drawerName: chq.drawerName || "",
        accountNumber: chq.accountNumber || "",
        notes: chq.notes || "",
        existingChequeId: chq.id,
      },
    ]);
  };

  const totalReplacementAmount = useMemo(() => {
    return replacementCheques.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [replacementCheques]);

  const amountDifference = useMemo(() => {
    return targetAmount - totalReplacementAmount;
  }, [targetAmount, totalReplacementAmount]);

  const isExactMatch = Math.abs(amountDifference) < 0.01;

  if (!isOpen) return null;

  // Add another replacement cheque line
  const handleAddChequeLine = () => {
    const remainingToAllocate = Math.max(0, amountDifference);
    setReplacementCheques((prev) => [
      ...prev,
      {
        chequeNumber: "",
        bankName: originalCheque.bankName || "",
        amount: remainingToAllocate,
        chequeDate: new Date().toISOString().split("T")[0],
        dueDate: new Date().toISOString().split("T")[0],
        drawerName: originalCheque.drawerName || "",
        accountNumber: originalCheque.accountNumber || "",
        notes: "",
      },
    ]);
  };

  const handleRemoveChequeLine = (index: number) => {
    if (replacementCheques.length <= 1) return;
    setReplacementCheques((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleChequeFieldChange = (
    index: number,
    field: keyof ReplacementItemInput,
    val: any
  ) => {
    setReplacementCheques((prev) =>
      prev.map((item, idx) => {
        if (idx === index) {
          return { ...item, [field]: val };
        }
        return item;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // 1. Legal case check
    const isControlled = cases.some((c) => {
      if (c.status === "CLOSED" || c.status === "ARCHIVED" || c.status === "SETTLED") return false;
      return (c as any).chequeId === originalCheque.id || (Array.isArray(c.linkedChequeIds) && c.linkedChequeIds.includes(originalCheque.id));
    });

    if (isControlled) {
      setErrorMsg(
        isAr
          ? "عذراً، هذا الشيك محجوز على ذمة قضية قانونية مفتوحة ولا يمكن استبداله حالياً."
          : "Sorry, this cheque is locked under an active legal case and cannot be replaced."
      );
      return;
    }

    // 2. Reason validation
    if (!reason.trim()) {
      setErrorMsg(
        isAr
          ? "يرجى كتابة سبب استبدال الشيك بوضوح لتوثيق السجل المالي."
          : "Please specify the replacement reason for the audit trail."
      );
      return;
    }

    // 3. Amount equality check
    if (!isExactMatch) {
      setErrorMsg(
        isAr
          ? `مجموع الشيكات البديلة (${totalReplacementAmount.toLocaleString()} درهم) يجب أن يطابق تماماً رصيد الشيك الأصلي (${targetAmount.toLocaleString()} درهم).`
          : `Total replacement amount (${totalReplacementAmount.toLocaleString()} AED) must exactly match original cheque balance (${targetAmount.toLocaleString()} AED).`
      );
      return;
    }

    // 4. Fields validation on all replacement cheques
    for (let i = 0; i < replacementCheques.length; i++) {
      const chq = replacementCheques[i];
      if (!chq.chequeNumber.trim()) {
        setErrorMsg(
          isAr
            ? `يرجى إدخال رقم الشيك البديل في السطر رقم (${i + 1}).`
            : `Please enter replacement cheque number in line (${i + 1}).`
        );
        return;
      }
      if (!chq.bankName.trim()) {
        setErrorMsg(
          isAr
            ? `يرجى إدخال اسم البنك في السطر رقم (${i + 1}).`
            : `Please enter bank name in line (${i + 1}).`
        );
        return;
      }
      if (chq.amount <= 0) {
        setErrorMsg(
          isAr
            ? `مبلغ الشيك في السطر رقم (${i + 1}) يجب أن يكون أكبر من الصفر.`
            : `Cheque amount in line (${i + 1}) must be greater than zero.`
        );
        return;
      }

      // Check duplicate only for newly created cheques (not for already existing)
      if (!chq.existingChequeId) {
        const dup = checkDuplicateCheque(
          chq.chequeNumber,
          chq.drawerName || originalCheque.drawerName,
          originalCheque.leaseId,
          originalCheque.tenantId
        );
        if (dup && dup.id !== originalCheque.id) {
          setErrorMsg(
            isAr
              ? `تنبيه: رقم الشيك البديل #${chq.chequeNumber} مسجل مسبقاً في النظام لنفس العقد/المستأجر.`
              : `Warning: Replacement cheque #${chq.chequeNumber} is already registered in the system.`
          );
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const res = replaceCheque({
        originalChequeId: originalCheque.id,
        replacementCheques: replacementCheques.map((c) => ({
          ...c,
          amount: Number(c.amount),
        })),
        reason: reason.trim(),
        date: replaceDate,
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to replace cheque");
      }

      if (onSuccess && res.newCheques) {
        onSuccess(res.newCheques);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs">
              <ArrowRightLeft className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">
                {isAr ? "استبدال شيك إيجاري (Replace Cheque)" : "Cheque Replacement Desk"}
              </h3>
              <p className="text-xs text-amber-100 mt-0.5">
                {isAr
                  ? "استبدال ورقة الدفع بأخرى جديدة مع نقل الالتزام وتحديث جدول الأقساط دفترياً"
                  : "Replace payment instrument with new or existing cheque while safeguarding lease schedule"}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Banner */}
          {errorMsg && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-3 text-rose-800 dark:text-rose-300 text-xs font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Original Cheque Summary Box */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-amber-600" />
                {isAr ? "بيانات الشيك الأصلي المستبدل" : "Original Cheque Details"}
              </span>
              <span className="text-xs font-bold font-mono px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-md">
                #{originalCheque.chequeNumber}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">{isAr ? "المستأجر" : "Tenant"}</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">{isAr ? "رقم العقد" : "Contract #"}</span>
                <span className="font-bold font-mono text-slate-800 dark:text-slate-100">
                  {lease?.leaseNumber || originalCheque.leaseId || "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">{isAr ? "البنك الأصلي" : "Bank"}</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {originalCheque.bankName || "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">{isAr ? "الرصيد المطلوب استبداله" : "Required Balance"}</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm font-mono">
                  {targetAmount.toLocaleString()} {isAr ? "د.إ" : "AED"}
                </span>
              </div>
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                setMode("NEW");
                setReplacementCheques([
                  {
                    chequeNumber: "",
                    bankName: originalCheque.bankName || "",
                    amount: targetAmount,
                    chequeDate: new Date().toISOString().split("T")[0],
                    dueDate: originalCheque.dueDate || new Date().toISOString().split("T")[0],
                    drawerName: originalCheque.drawerName || "",
                    accountNumber: originalCheque.accountNumber || "",
                    notes: "",
                  },
                ]);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                mode === "NEW"
                  ? "bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {isAr ? "1. إصدار شيكات بديلة جديدة (New Cheques)" : "1. Issue New Cheques"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("EXISTING");
                setSelectedExistingChequeId("");
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                mode === "EXISTING"
                  ? "bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {isAr ? "2. ربط شيك مسجل مسبقاً (Existing Cheque)" : "2. Link Existing Registered Cheque"}
            </button>
          </div>

          {/* Replacement Meta: Reason & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? "تاريخ عملية الاستبدال *" : "Replacement Date *"}
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 rtl:right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  required
                  value={replaceDate}
                  onChange={(e) => setReplaceDate(e.target.value)}
                  className="w-full pl-9 pr-3 rtl:pr-9 rtl:pl-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 font-semibold"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? "سبب الاستبدال والتوثيق المالي *" : "Replacement Reason & Justification *"}
              </label>
              <input
                type="text"
                required
                placeholder={
                  isAr
                    ? "مثال: استبدال شيك راجع بشيك جديد بناء على طلب المستأجر وموافقة الإدارة..."
                    : "e.g. Replaced bounced cheque with new cheque per tenant request..."
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Mode 1: Dynamic New Cheques Form */}
          {mode === "NEW" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-amber-600" />
                  {isAr ? "بيانات الشيكات البديلة الجديدة" : "New Replacement Cheque(s)"}
                </span>
                <button
                  type="button"
                  onClick={handleAddChequeLine}
                  className="px-3 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 rounded-lg text-xs font-bold border border-amber-200 dark:border-amber-800 transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAr ? "إضافة شيك بديل آخر" : "Add Another Cheque"}</span>
                </button>
              </div>

              <div className="space-y-3">
                {replacementCheques.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2">
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                        {isAr ? `الشيك البديل رقم (${idx + 1})` : `Replacement Cheque #${idx + 1}`}
                      </span>
                      {replacementCheques.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveChequeLine(idx)}
                          className="text-rose-600 hover:text-rose-700 p-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      {/* Cheque Number */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          {isAr ? "رقم الشيك الجديد *" : "Cheque No. *"}
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 100452"
                          value={item.chequeNumber}
                          onChange={(e) =>
                            handleChequeFieldChange(idx, "chequeNumber", e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      {/* Bank Name */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          {isAr ? "اسم البنك *" : "Bank Name *"}
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Emirates NBD"
                          value={item.bankName}
                          onChange={(e) =>
                            handleChequeFieldChange(idx, "bankName", e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      {/* Amount */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          {isAr ? "المبلغ (درهم) *" : "Amount (AED) *"}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="1"
                          required
                          value={item.amount}
                          onChange={(e) =>
                            handleChequeFieldChange(idx, "amount", parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-600 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      {/* Due Date */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          {isAr ? "تاريخ الاستحقاق *" : "Due Date *"}
                        </label>
                        <input
                          type="date"
                          required
                          value={item.dueDate}
                          onChange={(e) =>
                            handleChequeFieldChange(idx, "dueDate", e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mode 2: Existing Eligible Cheques Selector */}
          {mode === "EXISTING" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-amber-600" />
                  {isAr ? "اختر شيكاً مسجلاً في النظام ليكون بديلاً" : "Select an Existing Eligible Cheque"}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {filteredExistingCheques.length} {isAr ? "شيك مؤهل" : "eligible"}
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={isAr ? "بحث برقم الشيك، اسم البنك، أو الساحب..." : "Search by cheque #, bank, or drawer..."}
                  value={existingSearchQuery}
                  onChange={(e) => setExistingSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 rtl:pr-9 rtl:pl-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Cheques Selection List */}
              <div className="max-h-56 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-700 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-900/40">
                {filteredExistingCheques.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 font-bold">
                    {isAr ? "لا توجد شيكات مؤهلة مسجلة مطابقة" : "No eligible registered cheques found"}
                  </div>
                ) : (
                  filteredExistingCheques.map((chq) => {
                    const isSelected = selectedExistingChequeId === chq.id;
                    const isAmtMatch = Math.abs(chq.amount - targetAmount) < 0.01;
                    return (
                      <div
                        key={chq.id}
                        onClick={() => handleSelectExistingCheque(chq)}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? "bg-amber-50 border-amber-400 dark:bg-amber-950/50 dark:border-amber-600"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-amber-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                              isSelected
                                ? "bg-amber-600 border-amber-600 text-white"
                                : "border-slate-300 dark:border-slate-600"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
                                #{chq.chequeNumber}
                              </span>
                              <span className="text-[10px] text-slate-500 font-semibold">
                                ({chq.bankName})
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md">
                                {chq.status}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {isAr ? "الاستحقاق" : "Due"}: {chq.dueDate || "—"} | {isAr ? "الساحب" : "Drawer"}: {chq.drawerName || "—"}
                            </div>
                          </div>
                        </div>

                        <div className="text-end">
                          <div className="font-black font-mono text-emerald-600 dark:text-emerald-400">
                            {chq.amount.toLocaleString()} {isAr ? "د.إ" : "AED"}
                          </div>
                          <span
                            className={`text-[9px] font-bold ${
                              isAmtMatch ? "text-emerald-600" : "text-amber-600"
                            }`}
                          >
                            {isAmtMatch
                              ? isAr
                                ? "مطابق تماماً"
                                : "Exact Match"
                              : isAr
                              ? "فارق في المبلغ"
                              : "Amount Differs"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Mathematical Balance Validation Card */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-xs font-bold ${
              isExactMatch
                ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {isExactMatch ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <div>
                <span>
                  {isExactMatch
                    ? isAr
                      ? "المجموع متطابق تماماً مع رصيد الشيك الأصلي. جاهز للاستبدال."
                      : "Total replacement amount perfectly matches original balance. Ready to replace."
                    : isAr
                    ? `فارق الرصيد: ${amountDifference > 0 ? `متبقي ${amountDifference.toLocaleString()} درهم غير مغطى` : `زيادة ${Math.abs(amountDifference).toLocaleString()} درهم عن المطلوب`}`
                    : `Discrepancy: ${amountDifference.toLocaleString()} AED`}
                </span>
                <div className="text-[11px] font-normal text-slate-600 dark:text-slate-300 mt-0.5">
                  {isAr ? "المجموع الحالي للشيكات البديلة" : "Current total replacement"}:{" "}
                  <span className="font-mono font-bold">{totalReplacementAmount.toLocaleString()} د.إ</span> /{" "}
                  {isAr ? "المطلوب" : "Target"}: <span className="font-mono font-bold">{targetAmount.toLocaleString()} د.إ</span>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={!isExactMatch || isSubmitting}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <span>{isAr ? "جارٍ حفظ الاستبدال..." : "Processing..."}</span>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>{isAr ? "تأكيد استبدال الشيك وحفظ السجل" : "Confirm Cheque Replacement"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
