import React, { useState, useMemo } from "react";
import {
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  FileText,
  CreditCard,
  RotateCcw,
  WalletCards,
  ArrowDownLeft,
} from "lucide-react";
import { Modal } from "../common/Modal";
import { Lease, PaymentMethod, CollectionRecord, PaymentAllocationTargetType, DocumentOptimizationResult } from "../../types";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { SearchableSelect } from "../common/SearchableSelect";
import { DocumentUpload } from "../common/DocumentUpload";
import { isCardPayment } from "../../utils/paymentUtils";

interface ContractPaymentCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  lease: Lease | null;
}

export const ContractPaymentCenterModal: React.FC<ContractPaymentCenterModalProps> = ({
  isOpen,
  onClose,
  lease,
}) => {
  const { t, language } = useLanguage();
  const {
    properties,
    tenants,
    collections,
    cheques,
    commissions,
    paymentAllocations,
    financialReversals,
    recordLeasePayment,
    liquidateUnallocatedAdvance,
    reversePaymentReceipt,
  } = useData();

  const [activeTab, setActiveTab] = useState<"RECORD" | "HISTORY" | "SCHEDULE" | "ADVANCES">("RECORD");

  // Payment Form State
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [payerName, setPayerName] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [allocations, setAllocations] = useState<
    Array<{ targetType: PaymentAllocationTargetType; targetId: string; amount: number; max: number; desc: string }>
  >([]);

  const [chequeNumber, setChequeNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().split("T")[0]);
  const [attachmentResult, setAttachmentResult] = useState<DocumentOptimizationResult | null>(null);

  // Advance Liquidation State
  const [advanceAllocations, setAdvanceAllocations] = useState<
    Array<{ targetType: PaymentAllocationTargetType; targetId: string; amount: number; max: number; desc: string }>
  >([]);
  const [advanceSuccessMsg, setAdvanceSuccessMsg] = useState("");

  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [approvalCode, setApprovalCode] = useState("");

  const tenant = useMemo(() => (lease ? tenants.find((t) => t.id === lease.tenantId) : null), [lease, tenants]);
  const property = useMemo(() => (lease ? properties.find((p) => p.id === lease.propertyId) : null), [lease, properties]);

  // Calculate unallocated advance balance for this lease
  const totalUnallocatedAdvance = useMemo(() => {
    if (!lease) return 0;
    const leaseCols = collections.filter(
      (c) =>
        c.tenantId === lease.tenantId &&
        !financialReversals.some((r) => r.targetId === c.id && r.targetType === "COLLECTION")
    );
    return leaseCols.reduce((sum, col) => {
      const activeAllocs = paymentAllocations
        .filter((pa) => pa.collectionId === col.id && pa.status === "ACTIVE")
        .reduce((paSum, pa) => paSum + pa.allocatedAmount, 0);
      return sum + Math.max(0, col.amountEntered - activeAllocs);
    }, 0);
  }, [lease, collections, paymentAllocations, financialReversals]);

  React.useEffect(() => {
    if (lease && isOpen && tenant) {
      setPayerName(language === "ar" ? tenant.nameAr : tenant.nameEn);
      setAmount(0);
      setAllocations([]);
      setAdvanceAllocations([]);
      setAttachmentResult(null);
      setApprovalCode("");
      setShowConfirm(false);
      setErrorMsg("");
      setAdvanceSuccessMsg("");
      setActiveTab("RECORD");
    }
  }, [lease, isOpen, tenant, language]);

  if (!lease) return null;

  // Gather possible targets for this lease
  const availableInstallments = (lease.installments || []).filter(
    (inst) => inst.status !== "COLLECTED" && inst.status !== "WAIVED"
  );
  const outstandingCheques = cheques.filter((c) => c.leaseId === lease.id && c.outstanding > 0);
  const leaseCommissions = commissions.filter((c) => c.leaseId === lease.id && c.outstandingBalance > 0);

  const handleAddAllocation = (
    targetType: PaymentAllocationTargetType,
    targetId: string,
    maxAmount: number,
    desc: string
  ) => {
    if (allocations.find((a) => a.targetId === targetId)) return;
    setAllocations((prev) => [...prev, { targetType, targetId, amount: 0, max: maxAmount, desc }]);
  };

  const handleAllocationAmountChange = (targetId: string, val: number) => {
    setAllocations((prev) => prev.map((a) => (a.targetId === targetId ? { ...a, amount: val } : a)));
  };

  const removeAllocation = (targetId: string) => {
    setAllocations((prev) => prev.filter((a) => a.targetId !== targetId));
  };

  const totalAllocated = allocations.reduce((sum, a) => sum + (a.amount || 0), 0);
  const unallocated = amount - totalAllocated;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (isCardPayment(paymentMethod) && !approvalCode.trim()) {
      setErrorMsg(
        language === "ar"
          ? "يجب إدخال رقم الموافقة (Approval Code) عند الدفع بالبطاقات البنكية (فيزا / ماستركارد / بطاقة ائتمان)."
          : "Approval Code is mandatory for card payments (VISA / MasterCard / Credit Card)."
      );
      return;
    }

    if (totalAllocated > amount + 0.01) {
      setErrorMsg(
        language === "ar" ? "إجمالي التوزيعات يتجاوز مبلغ الدفعة" : "Total allocations exceed payment amount"
      );
      return;
    }

    const alreadyCollectedRent = paymentAllocations
      .filter(a => (a.targetType === "LEASE_INSTALLMENT" && a.targetId.startsWith(lease.id + ":")) || (a.targetType === "CHEQUE" && cheques.find(c => c.id === a.targetId)?.leaseId === lease.id))
      .reduce((sum, a) => sum + (a.allocatedAmount || 0), 0);

    const currentRentAllocations = allocations
      .filter(a => a.targetType === "LEASE_INSTALLMENT" || a.targetType === "CHEQUE")
      .reduce((sum, a) => sum + (a.amount || 0), 0);

    if (alreadyCollectedRent + currentRentAllocations > (Number(lease.annualRent) || 0) + 0.01) {
      setErrorMsg(
        language === "ar" 
          ? `⚠️ خطأ إداري: إجمالي التحصيلات الإيجارية (${(alreadyCollectedRent + currentRentAllocations).toLocaleString()} د.إ) يتجاوز قيمة الإيجار السنوي (${lease.annualRent} د.إ).` 
          : `⚠️ Error: Total rent collections (${alreadyCollectedRent + currentRentAllocations} AED) exceed the annual rent (${lease.annualRent} AED).`
      );
      return;
    }

    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    const res = await recordLeasePayment({
      leaseId: lease.id,
      amount,
      paymentMethod,
      payerName,
      paymentDate,
      referenceNumber,
      approvalCode: isCardPayment(paymentMethod) ? approvalCode.trim() : undefined,
      notes,
      allocations: allocations.map((a) => ({
        targetType: a.targetType,
        targetId: a.targetId,
        amount: a.amount,
        targetDescription: a.desc,
      })),
      chequeDetails:
        paymentMethod === "CHEQUE"
          ? {
              chequeNumber,
              bankName,
              chequeDate,
            }
          : undefined,
      attachment: attachmentResult
        ? {
            fileName: attachmentResult.optimizedFileName || attachmentResult.originalFileName,
            driveWebViewLink: attachmentResult.dataUrl,
          }
        : undefined,
    });

    if (res.success) {
      setShowConfirm(false);
      setActiveTab("HISTORY");
      setAmount(0);
      setAllocations([]);
      setAttachmentResult(null);
    } else {
      setErrorMsg(res.error || "Failed to record payment");
      setShowConfirm(false);
    }
  };

  // Advance Liquidation Handlers
  const handleAddAdvanceAllocation = (
    targetType: PaymentAllocationTargetType,
    targetId: string,
    maxAmount: number,
    desc: string
  ) => {
    if (advanceAllocations.find((a) => a.targetId === targetId)) return;
    setAdvanceAllocations((prev) => [...prev, { targetType, targetId, amount: 0, max: maxAmount, desc }]);
  };

  const handleAdvanceAmountChange = (targetId: string, val: number) => {
    setAdvanceAllocations((prev) => prev.map((a) => (a.targetId === targetId ? { ...a, amount: val } : a)));
  };

  const removeAdvanceAllocation = (targetId: string) => {
    setAdvanceAllocations((prev) => prev.filter((a) => a.targetId !== targetId));
  };

  const totalAdvanceToAllocate = advanceAllocations.reduce((sum, a) => sum + (a.amount || 0), 0);

  const handleLiquidateAdvance = async () => {
    setErrorMsg("");
    setAdvanceSuccessMsg("");

    if (totalAdvanceToAllocate <= 0) {
      setErrorMsg(language === "ar" ? "يرجى تحديد مبلغ للتوزيع" : "Please specify amount to allocate");
      return;
    }

    if (totalAdvanceToAllocate > totalUnallocatedAdvance + 0.01) {
      setErrorMsg(
        language === "ar"
          ? "المبلغ المطلوب توزيعه يتجاوز رصيد الدفعات المقدمة المتاح"
          : "Requested allocation exceeds available advance balance"
      );
      return;
    }

    const res = await liquidateUnallocatedAdvance({
      leaseId: lease.id,
      allocations: advanceAllocations.map((a) => ({
        targetType: a.targetType,
        targetId: a.targetId,
        amount: a.amount,
        targetDescription: a.desc,
      })),
    });

    if (res.success) {
      setAdvanceSuccessMsg(
        language === "ar"
          ? `تم تسوية وتوزيع ${totalAdvanceToAllocate.toLocaleString()} درهم بنجاح!`
          : `Successfully liquidated and allocated ${totalAdvanceToAllocate.toLocaleString()} AED!`
      );
      setAdvanceAllocations([]);
    } else {
      setErrorMsg(res.error || "Failed to allocate advance");
    }
  };

  const leaseCollections = collections
    .filter(
      (c) =>
        c.tenantId === lease.tenantId &&
        (c.chequeId === "DIRECT_COLLECTIONS" || cheques.find((chq) => chq.id === c.chequeId)?.leaseId === lease.id)
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((c) => ({
      ...c,
      isReversed: financialReversals.some((r) => r.targetId === c.id && r.targetType === "COLLECTION"),
    }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={language === "ar" ? "مركز المدفوعات المالي للعقد" : "Contract Payment Center"}
      subtitle={`${language === "ar" ? "عقد رقم:" : "Lease #:"} ${lease.leaseNumber} — ${language === "ar" ? "الرصيد السنوي:" : "Annual Rent:"} AED ${Number(lease.annualRent || 0).toLocaleString()}`}
      icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
      maxWidth="4xl"
    >
      <div className="flex items-center gap-2 border-b border-slate-200 mb-4 pb-0">
        <button
          onClick={() => setActiveTab("RECORD")}
          className={`px-4 py-2 font-bold text-xs border-b-2 transition-colors ${
            activeTab === "RECORD" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          {language === "ar" ? "تسجيل دفعة جديدة" : "Record Payment"}
        </button>
        <button
          onClick={() => setActiveTab("ADVANCES")}
          className={`px-4 py-2 font-bold text-xs border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "ADVANCES" ? "border-amber-600 text-amber-700" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <WalletCards className="w-3.5 h-3.5" />
          {language === "ar" ? "رصيد الدفعات المقدمة" : "Unallocated Advances"}
          {totalUnallocatedAdvance > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-mono font-bold">
              {totalUnallocatedAdvance.toLocaleString()}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("SCHEDULE")}
          className={`px-4 py-2 font-bold text-xs border-b-2 transition-colors ${
            activeTab === "SCHEDULE" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          {language === "ar" ? "جدول الدفعات" : "Installment Schedule"}
        </button>
        <button
          onClick={() => setActiveTab("HISTORY")}
          className={`px-4 py-2 font-bold text-xs border-b-2 transition-colors ${
            activeTab === "HISTORY" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          {language === "ar" ? "سجل المدفوعات" : "Payment History"}
        </button>
      </div>

      {activeTab === "RECORD" && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-bold border border-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                {language === "ar" ? "تفاصيل الدفعة" : "Payment Details"}
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    {language === "ar" ? "المبلغ المستلم (درهم)" : "Amount (AED)"} *
                  </label>
                  <input
                    type="number"
                    required
                    min={0.01}
                    step={0.01}
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    {language === "ar" ? "تاريخ التحصيل" : "Payment Date"} *
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <SearchableSelect
                  label={language === "ar" ? "طريقة السداد" : "Payment Method"}
                  required
                  options={[
                    { id: "BANK_TRANSFER", label: "تحويل بنكي", subLabel: "Bank Transfer" },
                    { id: "CASH", label: "نقداً", subLabel: "Cash" },
                    { id: "CHEQUE", label: "شيك", subLabel: "Cheque" },
                    { id: "CREDIT_CARD", label: "بطاقة ائتمان", subLabel: "Credit Card" },
                    { id: "VISA", label: "فيزا", subLabel: "VISA Card" },
                    { id: "MASTERCARD", label: "ماستركارد", subLabel: "MasterCard" },
                  ]}
                  value={paymentMethod}
                  onChange={(v) => setPaymentMethod(v as PaymentMethod)}
                />
              </div>

              {isCardPayment(paymentMethod) && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                  <label className="block text-[10px] font-bold text-emerald-900 uppercase">
                    {language === "ar" ? "رمز الموافقة البنكي (Approval Code) *" : "Bank Approval Code *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={approvalCode}
                    onChange={(e) => setApprovalCode(e.target.value)}
                    placeholder="e.g. APP-894201"
                    className="w-full px-3 py-2 bg-white border-2 border-emerald-400 rounded-lg text-xs font-mono font-bold text-emerald-950 focus:border-emerald-600 focus:outline-none"
                  />
                  <p className="text-[10px] text-emerald-700 font-medium">
                    {language === "ar"
                      ? "إلزامي لجميع المعاملات بالبطاقات البنكية (فيزا / ماستركارد / ائتمان)"
                      : "Mandatory for all card transactions (VISA / MasterCard / Credit Card)"}
                  </p>
                </div>
              )}

              {paymentMethod === "CHEQUE" && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      {language === "ar" ? "رقم الشيك *" : "Cheque Number *"}
                    </label>
                    <input
                      type="text"
                      required
                      value={chequeNumber}
                      onChange={(e) => setChequeNumber(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      {language === "ar" ? "اسم البنك *" : "Bank Name *"}
                    </label>
                    <input
                      type="text"
                      required
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      {language === "ar" ? "تاريخ استحقاق الشيك *" : "Cheque Date *"}
                    </label>
                    <input
                      type="date"
                      required
                      value={chequeDate}
                      onChange={(e) => setChequeDate(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  {language === "ar" ? "رقم المرجع (اختياري)" : "Reference #"}
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* Integrated Document Upload Pipeline */}
              <DocumentUpload
                label={language === "ar" ? "مستند الدفعة المرفق (شيك / إيصال)" : "Payment Attachment (Cheque/Receipt)"}
                defaultProfile={paymentMethod === "CHEQUE" ? "CHEQUE" : "RECEIPT"}
                onOptimized={setAttachmentResult}
              />
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <h3 className="font-bold text-slate-800 text-sm flex items-center justify-between mb-3">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {language === "ar" ? "توزيع الدفعة" : "Allocations"}
                  </span>
                  <span
                    className={`text-xs font-mono px-2 py-1 rounded-md ${
                      unallocated === 0
                        ? "bg-emerald-100 text-emerald-700"
                        : unallocated < 0
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {language === "ar" ? "غير موزع: " : "Unallocated: "} {unallocated.toLocaleString()} AED
                  </span>
                </h3>

                <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-1">
                  {allocations.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-slate-500 truncate">{a.desc}</div>
                        <div className="text-[9px] text-slate-400">Max: {a.max.toLocaleString()}</div>
                      </div>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={a.amount}
                        onChange={(e) => handleAllocationAmountChange(a.targetId, parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 text-xs border border-slate-300 rounded text-right font-mono font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => removeAllocation(a.targetId)}
                        className="text-red-400 hover:text-red-600 p-1 font-bold"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  {allocations.length === 0 && (
                    <div className="text-xs text-slate-400 text-center py-4 italic">
                      {language === "ar"
                        ? "لم يتم اختيار التوزيعات. سيتم حفظ الدفعة كرصيد مقدم غير موزع."
                        : "No allocations selected. Payment will be saved as unallocated advance."}
                    </div>
                  )}
                </div>

                <div className="text-xs space-y-1">
                  <div className="font-bold text-slate-700 mb-2">
                    {language === "ar" ? "الالتزامات المتاحة للتوزيع:" : "Available Targets:"}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {availableInstallments.map((inst) => {
                      const linkedCheque = outstandingCheques.find(
                        (c) => c.id === inst.chequeId || (inst.chequeNumber && c.chequeNumber === inst.chequeNumber)
                      );
                      return (
                        <button
                          key={inst.installmentNumber}
                          type="button"
                          onClick={() => {
                            if (linkedCheque) {
                              handleAddAllocation(
                                "CHEQUE",
                                linkedCheque.id,
                                linkedCheque.outstanding,
                                `Chq ${linkedCheque.chequeNumber}`
                              );
                            } else {
                              handleAddAllocation(
                                "LEASE_INSTALLMENT",
                                `${lease.id}:${inst.installmentNumber}`,
                                inst.amount,
                                `Inst #${inst.installmentNumber}`
                              );
                            }
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-bold ${
                            linkedCheque
                              ? "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300"
                              : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                          }`}
                        >
                          + Inst #{inst.installmentNumber} ({inst.amount.toLocaleString()})
                          {linkedCheque && ` [شيك #${linkedCheque.chequeNumber}]`}
                        </button>
                      );
                    })}
                    {outstandingCheques.map((chq) => (
                      <button
                        key={chq.id}
                        type="button"
                        onClick={() =>
                          handleAddAllocation("CHEQUE", chq.id, chq.outstanding, `Chq ${chq.chequeNumber}`)
                        }
                        className="px-2 py-1 bg-amber-100 hover:bg-amber-200 rounded text-[10px] font-bold text-amber-800"
                      >
                        + Chq {chq.chequeNumber} ({chq.outstanding.toLocaleString()})
                      </button>
                    ))}
                    {leaseCommissions.map((comm) => (
                      <button
                        key={comm.id}
                        type="button"
                        onClick={() =>
                          handleAddAllocation("COMMISSION", comm.id, comm.outstandingBalance, `Admin Fee (${comm.partyType})`)
                        }
                        className="px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded text-[10px] font-bold text-blue-800"
                      >
                        + Fee {comm.partyType} ({comm.outstandingBalance.toLocaleString()})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={amount <= 0 || unallocated < -0.01}
              className={`px-6 py-2.5 rounded-xl font-bold text-white transition-colors flex items-center gap-2 ${
                amount > 0 && unallocated >= -0.01
                  ? showConfirm
                    ? "bg-amber-600 hover:bg-amber-700 animate-pulse"
                    : "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-slate-300 cursor-not-allowed"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {showConfirm
                ? language === "ar"
                  ? "تأكيد وتسجيل الدفعة"
                  : "Confirm & Record Payment"
                : language === "ar"
                ? "تسجيل الدفعة"
                : "Record Payment"}
            </button>
          </div>
        </form>
      )}

      {activeTab === "ADVANCES" && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center">
                <WalletCards className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-amber-900 uppercase">
                  {language === "ar" ? "رصيد الدفعات المقدمة غير الموزعة" : "Available Unallocated Advance Balance"}
                </div>
                <div className="text-xl font-bold font-mono text-amber-800">
                  AED {totalUnallocatedAdvance.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {advanceSuccessMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {advanceSuccessMsg}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-bold border border-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {totalUnallocatedAdvance > 0 ? (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800">
                {language === "ar"
                  ? "تسوية وتوزيع الرصيد المقدم على الالتزامات:"
                  : "Liquidate & Allocate Advance Balance to Targets:"}
              </h4>

              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {advanceAllocations.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-slate-500 truncate">{a.desc}</div>
                      <div className="text-[9px] text-slate-400">Max: {a.max.toLocaleString()}</div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={Math.min(a.max, totalUnallocatedAdvance)}
                      step={0.01}
                      value={a.amount}
                      onChange={(e) => handleAdvanceAmountChange(a.targetId, parseFloat(e.target.value) || 0)}
                      className="w-24 px-2 py-1 text-xs border border-slate-300 rounded text-right font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => removeAdvanceAllocation(a.targetId)}
                      className="text-red-400 hover:text-red-600 p-1 font-bold"
                    >
                      &times;
                    </button>
                  </div>
                ))}

                {advanceAllocations.length === 0 && (
                  <div className="text-xs text-slate-400 text-center py-4 italic">
                    {language === "ar"
                      ? "اختر التزامات من القائمة أدناه لتطبيق الرصيد المقدم عليها."
                      : "Select targets from below to apply the advance balance."}
                  </div>
                )}
              </div>

              <div className="text-xs space-y-1 pt-2 border-t border-slate-200">
                <div className="font-bold text-slate-700 mb-1">
                  {language === "ar" ? "الالتزامات المستحقة:" : "Eligible Obligations:"}
                </div>
                <div className="flex flex-wrap gap-1">
                  {availableInstallments.map((inst) => (
                    <button
                      key={inst.installmentNumber}
                      type="button"
                      onClick={() =>
                        handleAddAdvanceAllocation(
                          "LEASE_INSTALLMENT",
                          `${lease.id}:${inst.installmentNumber}`,
                          inst.amount,
                          `Inst #${inst.installmentNumber}`
                        )
                      }
                      className="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded text-[10px] font-bold text-slate-700"
                    >
                      + Inst #{inst.installmentNumber} ({inst.amount.toLocaleString()})
                    </button>
                  ))}
                  {outstandingCheques.map((chq) => (
                    <button
                      key={chq.id}
                      type="button"
                      onClick={() =>
                        handleAddAdvanceAllocation("CHEQUE", chq.id, chq.outstanding, `Chq ${chq.chequeNumber}`)
                      }
                      className="px-2 py-1 bg-amber-100 hover:bg-amber-200 rounded text-[10px] font-bold text-amber-800"
                    >
                      + Chq {chq.chequeNumber} ({chq.outstanding.toLocaleString()})
                    </button>
                  ))}
                  {leaseCommissions.map((comm) => (
                    <button
                      key={comm.id}
                      type="button"
                      onClick={() =>
                        handleAddAdvanceAllocation(
                          "COMMISSION",
                          comm.id,
                          comm.outstandingBalance,
                          `Comm (${comm.partyType})`
                        )
                      }
                      className="px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded text-[10px] font-bold text-blue-800"
                    >
                      + Comm {comm.partyType} ({comm.outstandingBalance.toLocaleString()})
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={handleLiquidateAdvance}
                  disabled={totalAdvanceToAllocate <= 0 || totalAdvanceToAllocate > totalUnallocatedAdvance}
                  className={`px-5 py-2 rounded-xl font-bold text-white text-xs flex items-center gap-2 ${
                    totalAdvanceToAllocate > 0 && totalAdvanceToAllocate <= totalUnallocatedAdvance
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-slate-300 cursor-not-allowed"
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  {language === "ar" ? "تأكيد توزيع الرصيد المقدم" : "Confirm Advance Liquidation"}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-xs italic">
              {language === "ar"
                ? "لا توجد دفعات مقدمة غير موزعة على هذا العقد."
                : "No unallocated advance payments on this lease."}
            </div>
          )}
        </div>
      )}

      {activeTab === "HISTORY" && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {leaseCollections.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm italic">
              {language === "ar" ? "لا توجد مدفوعات مسجلة بعد." : "No collections recorded yet."}
            </div>
          ) : (
            leaseCollections.map((col) => (
              <div
                key={col.id}
                className={`p-3 rounded-xl border ${
                  col.isReversed ? "bg-red-50 border-red-100" : "bg-white border-slate-200"
                } flex items-center justify-between`}
              >
                <div>
                  <div className="font-bold text-slate-800 text-sm">{col.receiptNumber}</div>
                  <div className="text-xs text-slate-500">
                    {col.paymentDate} &bull; {col.paymentMethod}
                    {col.approvalCode && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                        Appr: {col.approvalCode}
                      </span>
                    )}
                  </div>
                  {col.isReversed && (
                    <div className="text-[10px] font-bold text-red-600 mt-1 uppercase">
                      {language === "ar" ? "ملغى / مسترد" : "Reversed"}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div
                    className={`font-mono font-bold ${
                      col.isReversed ? "text-slate-400 line-through" : "text-emerald-600"
                    }`}
                  >
                    AED {col.amountEntered.toLocaleString()}
                  </div>
                  {!col.isReversed && (
                    <button
                      onClick={() => {
                        const reason = window.prompt(
                          language === "ar" ? "سبب إلغاء / استرداد الدفعة؟" : "Reason for reversal?"
                        );
                        if (reason) reversePaymentReceipt(col.id, reason);
                      }}
                      className="text-[10px] text-red-500 hover:text-red-700 underline mt-1"
                    >
                      {language === "ar" ? "إلغاء واسترداد" : "Reverse"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "SCHEDULE" && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {(lease.installments || []).map((inst) => (
            <div
              key={inst.installmentNumber}
              className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl"
            >
              <div>
                <span className="font-bold text-slate-800">
                  {language === "ar" ? "الدفعة #" : "Installment #"}
                  {inst.installmentNumber}
                </span>
                <div className="text-xs text-slate-500">
                  {language === "ar" ? "تاريخ الاستحقاق: " : "Due: "}
                  {inst.dueDate}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-slate-700">AED {inst.amount.toLocaleString()}</div>
                <div
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                    inst.status === "COLLECTED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {inst.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

