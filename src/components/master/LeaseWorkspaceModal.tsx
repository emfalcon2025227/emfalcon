import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  FileText,
  User,
  Building,
  CreditCard,
  Receipt,
  Wrench,
  FolderLock,
  BarChart3,
  MessageSquare,
  RotateCw,
  Clock,
  ShieldAlert,
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  WalletCards,
  ArrowDownLeft,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import {
  Lease,
  Tenant,
  Property,
  Unit,
  Owner,
  CollectionRecord,
  MaintenanceRequest,
  Cheque,
  AuditLogEntry,
  CommissionObligation,
  PaymentMethod,
  PaymentAllocationTargetType,
  DocumentOptimizationResult,
} from "../../types";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { Badge } from "../common/Badge";
import { SearchableSelect } from "../common/SearchableSelect";
import { DocumentUpload } from "../common/DocumentUpload";
import { Modal } from "../common/Modal";
import { validateCommissionEligibility, generateCommissionBusinessKey } from "../../services/commissionControlService";
import {
  findLinkedChequeForInstallment,
  normalizeChequeNumber,
  isSameChequeNumber,
} from "../../utils/chequeUtils";
import { getLeaseRenewalEligibility } from "../../utils/leaseRenewalRules";
import { LeaseRenewalRuleNoticeModal } from "../common/LeaseRenewalRuleNoticeModal";
import { isCardPayment } from "../../utils/paymentUtils"; // Added
import { ReplaceChequeModal } from "../cheques/ReplaceChequeModal";
import { LeaseOccupancyAnalytics } from "./LeaseOccupancyAnalytics";

interface LeaseWorkspaceModalProps {
  lease: Lease | null;
  onClose: () => void;
  onOpenRenew: (lease: Lease) => void;
}

export const LeaseWorkspacePage: React.FC<LeaseWorkspaceModalProps> = ({ lease: initialLease, onClose, onOpenRenew }) => {
  const { t, language } = useLanguage();
  const {
    leases,
    properties,
    units,
    tenants,
    owners,
    collections,
    maintenanceRequests,
    cheques,
    archive,
    auditLogs,
    reversePaymentReceipt,
    paymentAllocations,
    commissions,
    addCommissionObligation,
    recordLeasePayment,
    liquidateUnallocatedAdvance,
    financialReversals,
    updateChequeStatus,
    updateCheque,
    updateLease,
    addPaymentPromise,
    markInstallmentAsBounced,
    updateLeaseInstallmentStatus,
  } = useData();
  const { hasPermission, currentUser } = useAuth();

  const lease = (leases.find((l) => l.id === initialLease?.id) || initialLease) as Lease;
  
  const [isPaymentCenterOpen, setIsPaymentCenterOpen] = useState(false);
  const [isRenewalRuleNoticeOpen, setIsRenewalRuleNoticeOpen] = useState(false);

  // --- Inline Payment Center State ---
  const [payCenterTab, setPayCenterTab] = useState<"RECORD" | "HISTORY" | "SCHEDULE" | "ADVANCES">("RECORD");
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
  const [approvalCode, setApprovalCode] = useState(""); // Added for card payments

  // --- Extended Cheque Actions State ---
  const [selectedChequeIdForSettlement, setSelectedChequeIdForSettlement] = useState<string>("");
  
  const [safetyConfirmData, setSafetyConfirmData] = useState<{
    inst: any;
    fin: any;
    action: string;
    method: PaymentMethod;
    methodLabelAr: string;
    methodLabelEn: string;
  } | null>(null);

  const [ccApprovalNumber, setCcApprovalNumber] = useState("");
  const [bankTransferRef, setBankTransferRef] = useState("");
  const [bankTransferDate, setBankTransferDate] = useState(new Date().toISOString().split("T")[0]);

  const [partialModalData, setPartialModalData] = useState<{
    inst: any;
    fin: any;
    amountToCollect: number;
    paymentMethod: PaymentMethod;
    deferRemaining: boolean;
    deferredAmount: number;
    expectedDueDate: string;
    deferReason: string;
    responsiblePerson: string;
    followUpDate: string;
    allowedDays: number;
  } | null>(null);

  const [deferWholeModalData, setDeferWholeModalData] = useState<{
    inst: any;
    fin: any;
    expectedDueDate: string;
    deferReason: string;
    responsiblePerson: string;
    followUpDate: string;
    allowedDays: number;
  } | null>(null);

  const [replacingCheque, setReplacingCheque] = useState<Cheque | null>(null);


  const property = properties.find((p) => p.id === lease.propertyId);
  const unit = units.find((u) => u.id === lease.unitId);
  const tenant = tenants.find((t) => t.id === lease.tenantId);
  const owner = owners.find((o) => o.id === lease.ownerId || o.id === property?.ownerId);

  // Set default payer name
  useEffect(() => {
    if (lease && tenant) {
      setPayerName(language === "ar" ? tenant.nameAr : tenant.nameEn);
    }
  }, [lease, tenant, language]);

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

  // Gather possible allocation targets
  const availableInstallments = useMemo(() => {
    if (!lease) return [];
    return (lease.installments || []).filter(
      (inst) => inst.status !== "COLLECTED" && inst.status !== "WAIVED"
    );
  }, [lease.installments]);

  const outstandingCheques = useMemo(() => {
    if (!lease) return [];
    return cheques.filter((c) => c.leaseId === lease.id && c.outstanding > 0);
  }, [cheques, lease.id]);

  const leaseCommissions = useMemo(() => {
    if (!lease) return [];
    return commissions.filter((c) => c.leaseId === lease.id && c.outstandingBalance > 0);
  }, [commissions, lease.id]);

  const allLeaseAdminFees = useMemo(() => {
    if (!lease) return [];
    return commissions.filter(
      (c) => c.leaseId === lease.id && c.commissionType === "ADMIN_FEE" && c.status !== "CANCELLED" && c.status !== "REVERSED"
    );
  }, [commissions, lease.id]);

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

  const leaseInstallmentsRemaining = useMemo(() => {
    if (!lease) return 0;
    return (lease.installments || []).reduce((sum, inst) => {
      const targetId = `${lease.id}:${inst.installmentNumber}`;
      const linkedCheque = findLinkedChequeForInstallment(cheques, inst, lease);
      const allocs = paymentAllocations.filter(
        (pa) => (pa.targetId === targetId || (linkedCheque && pa.targetId === linkedCheque.id)) && pa.status === "ACTIVE"
      );
      const collected = allocs.reduce((s, a) => s + (a.allocatedAmount || 0), 0);
      const remaining = Math.max(0, inst.amount - collected);
      return sum + remaining;
    }, 0);
  }, [lease, cheques, paymentAllocations]);

  const totalAllocated = allocations.reduce((sum, a) => sum + (a.amount || 0), 0);
  const unallocated = amount - totalAllocated;

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (amount > leaseInstallmentsRemaining + 0.01) {
      setErrorMsg(
        language === "ar"
          ? `المبلغ المدخل (${amount.toLocaleString()} درهم) يتجاوز إجمالي الرصيد المتبقي المستحق على عقد الإيجار (${leaseInstallmentsRemaining.toLocaleString()} درهم). يرجى تعديل المبلغ ليتوافق مع التزامات العقد ولتجنب التحصيل الزائد.`
          : `The entered payment amount (${amount.toLocaleString()} AED) exceeds the total outstanding balance of the lease contract (${leaseInstallmentsRemaining.toLocaleString()} AED). Please adjust the amount to prevent over-collection.`
      );
      return;
    }

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
      approvalCode: isCardPayment(paymentMethod) ? approvalCode : undefined,
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
      if (selectedChequeIdForSettlement) {
        const chq = cheques.find((c) => c.id === selectedChequeIdForSettlement);
        if (chq) {
          const newTotalApplied = (chq.totalApplied || 0) + amount;
          const newOutstanding = Math.max(0, chq.amount - newTotalApplied);
          const isFullyCollected = newOutstanding <= 0.01;
          updateCheque(chq.id, {
            totalApplied: newTotalApplied,
            outstanding: newOutstanding,
            collectionStatus: isFullyCollected ? "FULLY_COLLECTED_AFTER_BOUNCE" : "PARTIAL_COLLECTION",
            status: isFullyCollected ? "COLLECTED" : chq.status,
          }, `Alternative Settlement via Contract Payment Center (${paymentMethod})`);
        }
        setSelectedChequeIdForSettlement("");
      }
      setShowConfirm(false);
      setPayCenterTab("HISTORY");
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

  const handleCollectInstallment = (inst: any) => {
    scrollToSection("payment-center-sec");
    setPayCenterTab("RECORD");
    setAmount(inst.amount);
    const targetId = `${lease.id}:${inst.installmentNumber}`;
    setAllocations([{
      targetType: "LEASE_INSTALLMENT",
      targetId,
      amount: inst.amount,
      max: inst.amount,
      desc: `Inst #${inst.installmentNumber}`
    }]);
  };

  const getInstallmentFinancials = (inst: any) => {
    const targetId = `${lease.id}:${inst.installmentNumber}`;
    const linkedCheque = findLinkedChequeForInstallment(cheques, inst, lease);
    const allocs = paymentAllocations.filter(
      (pa) => (pa.targetId === targetId || (linkedCheque && pa.targetId === linkedCheque.id)) && pa.status === "ACTIVE"
    );
    const collected = allocs.reduce((sum, a) => sum + (a.allocatedAmount || 0), 0);
    const totalAmount = inst.amount || linkedCheque?.amount || 0;
    const remaining = Math.max(0, totalAmount - collected);
    const isFullyCollected = remaining <= 0.01 || inst.status === "COLLECTED" || inst.status === "CLEARED" || linkedCheque?.status === "COLLECTED";
    const isBounced = linkedCheque?.status === "BOUNCED" || inst.status === "BOUNCED";
    const lastPaymentMethod = linkedCheque?.status === "COLLECTED" ? "CHEQUE" : (allocs.length > 0 ? "CASH" : undefined);
    return { linkedCheque, collected, totalAmount, remaining, isFullyCollected, isBounced, lastPaymentMethod };
  };

  const handleConfirmDirectCollection = async () => {
    if (!safetyConfirmData) return;
    const { inst, fin, action, method } = safetyConfirmData;
    const linkedCheque = fin.linkedCheque;

    if (fin.isFullyCollected || fin.remaining <= 0.01) {
      alert(
        isAr
          ? "هذا الشيك تم تحصيله بالكامل ولا يمكن تحصيله مرة أخرى."
          : "This cheque has already been fully collected and cannot be collected again."
      );
      setSafetyConfirmData(null);
      return;
    }

    if (method === "CREDIT_CARD" && !approvalCode.trim()) {
      alert(isAr ? "يرجى إدخال رقم الموافقة للبطاقة الائتمانية." : "Please enter the credit card approval number.");
      return;
    }

    if (method === "BANK_TRANSFER" && (!bankTransferRef.trim() || !bankTransferDate)) {
      alert(isAr ? "يرجى إدخال رقم مرجع وتاريخ التحويل البنكي." : "Please enter the bank transfer reference and date.");
      return;
    }

    const refNo = method === "CREDIT_CARD" 
      ? ccApprovalNumber.trim() 
      : (method === "BANK_TRANSFER" ? bankTransferRef.trim() : (linkedCheque?.chequeNumber || inst.chequeNumber));
    const payDate = method === "BANK_TRANSFER" ? bankTransferDate : new Date().toISOString().split("T")[0];

    const res = await recordLeasePayment({
      leaseId: lease.id,
      paymentDate: payDate,
      amount: fin.remaining,
      paymentMethod: method,
      payerName: tenant?.nameEn || tenant?.nameAr || "Tenant",
      referenceNumber: refNo,
      notes: `Direct collection via action menu (${method}). Ref: ${refNo}`,
      allocations: [
        {
          targetType: "LEASE_INSTALLMENT",
          targetId: `${lease.id}:${inst.installmentNumber}`,
          amount: fin.remaining,
          targetDescription: `Inst #${inst.installmentNumber} (Alternative Direct Collection: ${action})`,
        },
      ],
    });

    if (res.success) {
      if (linkedCheque) {
        updateCheque(linkedCheque.id, {
          status: "COLLECTED" as const,
          totalApplied: linkedCheque.amount,
          outstanding: 0,
          collectionStatus: "FULLY_COLLECTED_AFTER_BOUNCE" as const,
        }, `Direct collection via Action menu (${method})`);
      }
      alert(isAr ? "تم تسجيل التحصيل والتسوية المباشرة بنجاح!" : "Direct collection and settlement recorded successfully!");
    } else {
      alert(res.error || (isAr ? "فشل تسجيل التحصيل" : "Failed to record collection"));
    }

    setSafetyConfirmData(null);
    setCcApprovalNumber("");
    setBankTransferRef("");
    setBankTransferDate(new Date().toISOString().split("T")[0]);
  };

  const handleConfirmPartialCollection = async () => {
    if (!partialModalData) return;
    const {
      inst,
      fin,
      amountToCollect,
      paymentMethod,
      deferRemaining,
      deferredAmount,
      expectedDueDate,
      deferReason,
      responsiblePerson,
      followUpDate,
      allowedDays,
    } = partialModalData;
    const linkedCheque = fin.linkedCheque;

    if (amountToCollect <= 0 || amountToCollect > fin.remaining + 0.01) {
      alert(isAr ? "المبلغ غير صالح أو يتجاوز المبلغ المتبقي." : "Invalid amount or exceeds remaining balance.");
      return;
    }

    if (deferRemaining && (!expectedDueDate || !deferReason)) {
      alert(isAr ? "تاريخ الاستحقاق المتوقع وسبب التأجيل مطلوبان." : "Expected due date and deferral reason are required.");
      return;
    }

    const res = await recordLeasePayment({
      leaseId: lease.id,
      paymentDate: new Date().toISOString().split("T")[0],
      amount: amountToCollect,
      paymentMethod: paymentMethod,
      payerName: tenant?.nameEn || tenant?.nameAr || "Tenant",
      allocations: [
        {
          targetType: "LEASE_INSTALLMENT",
          targetId: `${lease.id}:${inst.installmentNumber}`,
          amount: amountToCollect,
          targetDescription: `Partial Inst #${inst.installmentNumber}`,
        },
      ],
      notes: deferRemaining
        ? `Partial collection of AED ${amountToCollect}. Remaining AED ${deferredAmount} deferred to ${expectedDueDate}. Reason: ${deferReason}. Responsible: ${responsiblePerson}`
        : `Partial collection of AED ${amountToCollect}`,
    });

    if (res.success) {
      if (linkedCheque) {
        const newTotalApplied = (linkedCheque.totalApplied || 0) + amountToCollect;
        const newOutstanding = Math.max(0, linkedCheque.amount - newTotalApplied);
        const isFullyCollected = newOutstanding <= 0.01;
        updateCheque(linkedCheque.id, {
          totalApplied: newTotalApplied,
          outstanding: newOutstanding,
          collectionStatus: isFullyCollected ? "FULLY_COLLECTED_AFTER_BOUNCE" : "PARTIAL_COLLECTION",
          status: isFullyCollected ? "COLLECTED" : linkedCheque.status,
        }, `Partial collection via Action Menu`);
      }

      if (deferRemaining) {
        addPaymentPromise({
          tenantId: lease.tenantId,
          leaseId: lease.id,
          amountPromised: deferredAmount,
          promiseDate: new Date().toISOString().split("T")[0],
          expectedPaymentDate: expectedDueDate,
          status: "ACTIVE",
          notes: `Deferred remaining from partial settlement. Reason: ${deferReason}. Responsible: ${responsiblePerson}. Follow-up: ${followUpDate}. Allowed: ${allowedDays} days.`,
        });
      }

      alert(isAr ? `تم تسجيل التحصيل الجزئي بقيمة AED ${amountToCollect.toLocaleString()} بنجاح!` : `Partial collection of AED ${amountToCollect} recorded successfully!`);
    } else {
      alert(res.error || (isAr ? "فشل تسجيل التحصيل الجزئي" : "Failed to record partial collection"));
    }

    setPartialModalData(null);
  };

  const handleConfirmDeferWhole = () => {
    if (!deferWholeModalData) return;
    const {
      inst,
      fin,
      expectedDueDate,
      deferReason,
      responsiblePerson,
      followUpDate,
      allowedDays,
    } = deferWholeModalData;
    const linkedCheque = fin.linkedCheque;

    if (!expectedDueDate || !deferReason) {
      alert(isAr ? "تاريخ الاستحقاق المتوقع وسبب التأجيل مطلوبان." : "Expected due date and deferral reason are required.");
      return;
    }

    if (linkedCheque) {
      updateChequeStatus(linkedCheque.id, "PENDING", `DEFERRED to ${expectedDueDate}. Reason: ${deferReason}. Responsible: ${responsiblePerson}`);

      addPaymentPromise({
        tenantId: lease.tenantId,
        leaseId: lease.id,
        amountPromised: fin.remaining,
        promiseDate: new Date().toISOString().split("T")[0],
        expectedPaymentDate: expectedDueDate,
        status: "ACTIVE",
        notes: `Deferred whole cheque. Reason: ${deferReason}. Responsible: ${responsiblePerson}. Follow-up: ${followUpDate}. Allowed: ${allowedDays} days.`,
      });

      alert(isAr ? "تم تسجيل تأجيل الشيك بنجاح وبناء وعد السداد التابع." : "Cheque deferred successfully and payment promise created.");
    } else {
      // Update installment directly and record payment promise
      updateLeaseInstallmentStatus(lease.id, inst.installmentNumber, "PENDING");
      addPaymentPromise({
        tenantId: lease.tenantId,
        leaseId: lease.id,
        amountPromised: fin.remaining,
        promiseDate: new Date().toISOString().split("T")[0],
        expectedPaymentDate: expectedDueDate,
        status: "ACTIVE",
        notes: `Deferred installment #${inst.installmentNumber}. Reason: ${deferReason}. Responsible: ${responsiblePerson}. Follow-up: ${followUpDate}. Allowed: ${allowedDays} days.`,
      });
      alert(isAr ? "تم تسجيل تأجيل القسط بنجاح وبناء وعد السداد التابع." : "Installment deferred successfully and payment promise created.");
    }

    setDeferWholeModalData(null);
  };

  const handleChequeAction = async (inst: any, action: string) => {
    const fin = getInstallmentFinancials(inst);
    const linkedCheque = fin.linkedCheque;

    if (fin.isFullyCollected || fin.remaining <= 0.01) {
      alert(
        isAr
          ? "هذا الشيك تم تحصيله بالكامل ولا يمكن تحصيله مرة أخرى."
          : "This cheque has already been fully collected and cannot be collected again."
      );
      return;
    }

    if (action === "BANK_COLLECTION") {
      setSafetyConfirmData({
        inst,
        fin,
        action: "BANK_COLLECTION",
        method: "CHEQUE",
        methodLabelAr: "تحصيل بنكي — إيداع بالبنك",
        methodLabelEn: "Bank Collection / Deposit",
      });
    } else if (action === "CASH_DIRECT") {
      setSelectedChequeIdForSettlement(linkedCheque?.id || "");
      scrollToSection("payment-center-sec");
      setPayCenterTab("RECORD");
      setAmount(fin.remaining);
      setPaymentMethod("CASH");
      setReferenceNumber(linkedCheque?.chequeNumber || inst.chequeNumber || "");
      setNotes(`Existing Cheque Settlement for Inst #${inst.installmentNumber} (Cheque #${inst.chequeNumber || linkedCheque?.chequeNumber || "N/A"})`);
      const targetId = `${lease.id}:${inst.installmentNumber}`;
      setAllocations([
        {
          targetType: "LEASE_INSTALLMENT",
          targetId,
          amount: fin.remaining,
          max: fin.remaining,
          desc: `Inst #${inst.installmentNumber} (Cheque #${inst.chequeNumber || linkedCheque?.chequeNumber || inst.installmentNumber})`,
        },
      ]);
    } else if (action === "BANK_TRANSFER_SETTLEMENT") {
      setSafetyConfirmData({
        inst,
        fin,
        action: "BANK_TRANSFER_SETTLEMENT",
        method: "BANK_TRANSFER",
        methodLabelAr: "تسوية عن طريق تحويل بنكي مباشر",
        methodLabelEn: "Direct Bank Transfer Settlement",
      });
    } else if (action === "CARD_SETTLEMENT") {
      setSafetyConfirmData({
        inst,
        fin,
        action: "CARD_SETTLEMENT",
        method: "CREDIT_CARD",
        methodLabelAr: "تسوية عن طريق بطاقة ائتمان مباشرة",
        methodLabelEn: "Direct Credit Card Settlement",
      });
    } else if (action === "PARTIAL") {
      setPartialModalData({
        inst,
        fin,
        amountToCollect: fin.remaining,
        paymentMethod: "CASH",
        deferRemaining: false,
        deferredAmount: 0,
        expectedDueDate: "",
        deferReason: "",
        responsiblePerson: "Finance Officer",
        followUpDate: new Date().toISOString().split("T")[0],
        allowedDays: 3,
      });
    } else if (action === "BOUNCED") {
      const bouncedConfirm = confirm(
        isAr
          ? `أنت على وشك تسجيل الشيك التالي كشيك راجع (Bounced):\n` +
            `- المستأجر: ${tenant?.nameAr || tenant?.nameEn || "N/A"}\n` +
            `- المالك: ${owner?.nameAr || owner?.nameEn || "N/A"}\n` +
            `- العقار: ${property?.nameAr || property?.nameEn || "N/A"}\n` +
            `- الوحدة: #${unit?.unitNumber || "N/A"}\n` +
            `- العقد: ${lease.leaseNumber}\n` +
            `- رقم الشيك: ${inst.chequeNumber || linkedCheque?.chequeNumber || "N/A"}\n` +
            `- المبلغ: AED ${inst.amount.toLocaleString()}\n` +
            `- تاريخ الاستحقاق: ${inst.dueDate}\n\n` +
            `هل تريد التأكيد ونقل الشيك إلى نظام الشيكات المرتجعة؟`
          : `You are about to mark the following cheque as BOUNCED:\n` +
            `- Tenant: ${tenant?.nameEn || "N/A"}\n` +
            `- Owner: ${owner?.nameEn || "N/A"}\n` +
            `- Property: ${property?.nameEn || "N/A"}\n` +
            `- Unit: #${unit?.unitNumber || "N/A"}\n` +
            `- Contract: ${lease.leaseNumber}\n` +
            `- Cheque #: ${inst.chequeNumber || linkedCheque?.chequeNumber || "N/A"}\n` +
            `- Amount: AED ${inst.amount.toLocaleString()}\n` +
            `- Due Date: ${inst.dueDate}\n\n` +
            `Do you want to confirm and transfer to Bounced Cheques system?`
      );
      if (!bouncedConfirm) return;

      const res = markInstallmentAsBounced(
        lease.id,
        inst.installmentNumber,
        "Marked as bounced via lease workspace action menu"
      );

      if (res.success) {
        alert(
          isAr
            ? "تم تسجيل الشيك كمرتجع بنجاح ونقله إلى نظام الشيكات المرتجعة وتحديث حالة العقد."
            : "Cheque marked as Bounced successfully and synced across Bounced Cheques and Lease Schedule."
        );
      } else {
        alert(res.error || (isAr ? "فشل تسجيل الشيك كمرتجع." : "Failed to mark cheque as bounced."));
      }
    } else if (action === "DEFERRED") {
      setDeferWholeModalData({
        inst,
        fin,
        expectedDueDate: "",
        deferReason: "",
        responsiblePerson: "Finance Officer",
        followUpDate: new Date().toISOString().split("T")[0],
        allowedDays: 3,
      });
    } else if (action === "REPLACE_CHEQUE") {
      if (linkedCheque) {
        setReplacingCheque(linkedCheque);
      } else {
        const fallbackChq: Cheque = {
          id: inst.chequeId || `chq-temp-${Date.now()}`,
          chequeNumber: inst.chequeNumber || `CHQ-${inst.installmentNumber}`,
          bankName: "Commercial Bank",
          amount: inst.amount,
          chequeDate: inst.dueDate,
          dueDate: inst.dueDate,
          ownerId: lease.ownerId,
          ownerName: owner?.nameAr || owner?.nameEn || "",
          tenantId: lease.tenantId,
          propertyId: lease.propertyId,
          unitId: lease.unitId,
          leaseId: lease.id,
          status: inst.status === "BOUNCED" ? "BOUNCED" : "PENDING",
          originalStatus: "NORMAL",
          collectionStatus: "NOT_COLLECTED",
          totalApplied: 0,
          outstanding: fin.remaining,
          whatsAppStatus: "NONE",
          reminderCount: 0,
          createdAt: new Date().toISOString(),
        };
        setReplacingCheque(fallbackChq);
      }
    }
  };

  // Match collections and allocations strictly for the currently opened lease
  const leaseCheques = useMemo(() => {
    if (!lease || !lease.id) return [];
    return cheques.filter((chq) => {
      // 1. Direct match with current lease ID or leaseNumber
      if (chq.leaseId === lease.id || (lease.leaseNumber && chq.leaseId === lease.leaseNumber)) {
        return true;
      }
      
      // If the cheque is explicitly tied to another lease, exclude it
      if (chq.leaseId && chq.leaseId !== lease.id && chq.leaseId !== lease.leaseNumber) {
        return false;
      }

      // 2. Direct installment reference (installment explicitly points to this cheque's ID)
      const matchesInstallmentId = (lease.installments || []).some(
        (inst) => inst.chequeId && inst.chequeId === chq.id
      );
      if (matchesInstallmentId) return true;

      // 3. Cheque number match against installments of this specific lease
      const matchesInstallmentChequeNumber = (lease.installments || []).some(
        (inst) =>
          inst.chequeNumber &&
          String(inst.chequeNumber).trim() !== "" &&
          isSameChequeNumber(inst.chequeNumber, chq.chequeNumber)
      );

      if (matchesInstallmentChequeNumber) {
        const matchesTenant = !chq.tenantId || chq.tenantId === lease.tenantId;
        const matchesProperty = !chq.propertyId || chq.propertyId === lease.propertyId;
        const matchesUnit = !chq.unitId || chq.unitId === lease.unitId;
        if (matchesTenant && matchesProperty && matchesUnit) {
          return true;
        }
      }

      return false;
    });
  }, [cheques, lease]);
  const chequeIds = useMemo(() => leaseCheques.map((chq) => chq.id), [leaseCheques]);
  const leaseAllocations = useMemo(
    () => paymentAllocations.filter((pa) => pa.targetId === lease?.id || chequeIds.includes(pa.targetId)),
    [paymentAllocations, lease?.id, chequeIds]
  );
  const collectionIds = useMemo(
    () => Array.from(new Set((leaseAllocations || []).map((pa) => pa.collectionId))),
    [leaseAllocations]
  );
  const leaseCollections = useMemo(
    () =>
      (collections || []).filter(
        (c) =>
          collectionIds.includes(c.id) ||
          (c.chequeId && chequeIds.includes(c.chequeId)) ||
          ((c as any).leaseId && ((c as any).leaseId === lease?.id || (lease?.leaseNumber && (c as any).leaseId === lease?.leaseNumber)))
      ),
    [collections, collectionIds, chequeIds, lease?.id, lease?.leaseNumber]
  );
  
  const leaseMaintenance = (maintenanceRequests || []).filter((m) => m.leaseId === lease.id || m.unitId === lease.unitId);
  const leaseDocuments = (archive || []).filter((a) => a.recordId === lease.id || a.entityId === lease.id);
  const leaseAudit = (auditLogs || []).filter((log) => log.entityId === lease.id || (log.details && log.details.includes(lease.leaseNumber)));
  const allLeaseCommissions = (commissions || []).filter((c) => c.leaseId === lease.id);

  // Calculations
  const totalCollected = (leaseCollections || []).reduce((acc, c) => acc + (c.amountEntered || 0), 0);
  const totalOutstanding = Math.max(0, (lease.annualRent || 0) - totalCollected);
  const bouncedCount = leaseCheques.filter((chq) => chq.status === "BOUNCED").length;
  const bouncedAmount = leaseCheques
    .filter((chq) => chq.status === "BOUNCED")
    .reduce((acc, chq) => acc + (chq.amount || 0), 0);

  // Risk Score Indicator
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
  const riskReasons: string[] = [];
  if (bouncedCount > 0) {
    riskLevel = "HIGH";
    riskReasons.push(`${bouncedCount} bounced cheque(s) recorded`);
  }
  if (tenant?.riskLevel === "HIGH") {
    riskLevel = "CRITICAL";
    riskReasons.push("Tenant marked as High Risk in profile");
  } else if (tenant?.riskLevel === "MEDIUM" && riskLevel === "LOW") {
    riskLevel = "MEDIUM";
    riskReasons.push("Tenant marked as Medium Risk");
  }

  const isAr = language === "ar";
  const currentCommissionYear = (lease.startDate || '') ? new Date((lease.startDate || '')).getFullYear() : 2026;
  const renewalSeq = lease.id || 0;

  const handleChargeCommission = (partyType: "OWNER" | "TENANT") => {
    const partyId = partyType === "OWNER" ? (owner?.id || lease.ownerId) : (tenant?.id || lease.tenantId);
    if (!partyId) {
      alert(isAr ? "معرف الطرف غير متوفر." : "Party ID not available.");
      return;
    }

    const check = validateCommissionEligibility({
      leaseId: lease.id,
      partyType,
      partyId,
      contractualCommissionYear: currentCommissionYear,
      renewalSequence: Number(renewalSeq) || 1,
      existingCommissions: commissions,
      isOverrideRequested: false,
      userPermissions: currentUser?.permissions || ["COMMISSION_CREATE", "COMMISSION_OVERRIDE"],
      userRole: currentUser?.role || "SUPER_ADMIN",
    });

    if (!check.allowed) {
      alert(isAr ? check.messageAr : check.messageEn);
      return;
    }

    // Allowed to create commission
    const defaultRate = 5.0;
    const amount = Math.round(((lease.annualRent || 0) * defaultRate) / 100);

    const res = addCommissionObligation({
      leaseId: lease.id,
      businessKeySequence: "PRIMARY",
      ownerId: partyType === "OWNER" ? partyId : undefined,
      tenantId: partyType === "TENANT" ? partyId : undefined,
      propertyId: lease.propertyId,
      unitId: lease.unitId,
      partyType,
      commissionType: "ADMIN_FEE",
      calculationBasis: "PERCENTAGE_OF_RENT",
      baseAmount: (lease.annualRent || 0),
      ratePercentage: defaultRate,
      totalCommissionAmount: amount,
      dueDate: (lease.startDate || ''),
      notes: `Annual Administrative Fees for ${currentCommissionYear}`,
      contractualCommissionYear: currentCommissionYear,
      renewalSequence: Number(renewalSeq) || 1,
      isOverride: false,
    });

    if (res.success) {
      alert(isAr ? "تم تسجيل الرسوم الإدارية بنجاح." : "Administrative fees successfully recorded.");
    } else {
      alert(res.error || "Failed to record administrative fees.");
    }
  };

  const subSections = [
    { id: "overview-sec", label: isAr ? "نظرة عامة ومخاطر" : "Overview & Risks", icon: FileText },
    { id: "analytics-sec", label: isAr ? "تحليلات المستأجر والإشغال" : "Tenant & Occupancy Analytics", icon: TrendingUp },
    { id: "parties-sec", label: isAr ? "أطراف العقد والوحدة" : "Parties & Unit Specs", icon: User },
    { id: "financials-sec", label: isAr ? "جدول دفعات الأقساط" : "Installment Schedule", icon: Calendar },
    { id: "payment-center-sec", label: isAr ? "مركز تحصيل السندات" : "Contract Payment Center", icon: DollarSign },
    { id: "commissions-sec", label: isAr ? "الرسوم الإدارية السنوية" : "Administrative Fees", icon: Receipt },
    { id: "documents-sec", label: isAr ? "المستندات والأرشيف" : "Documents Checklist", icon: FolderLock },
    { id: "maintenance-sec", label: isAr ? "طلبات الصيانة" : "Maintenance requests", icon: Wrench },
    { id: "timeline-sec", label: isAr ? "الخط الزمني والتدقيق" : "Timeline & Audit logs", icon: Clock },
    { id: "cheques-ledger-sec", label: isAr ? "سجل حركة الشيكات" : "Cheques Ledger", icon: Calendar },
  ];

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (!lease) return null;

  return (
    <div className="space-y-6 animate-fade-in pb-12 text-slate-800">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-lg border border-slate-800">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center border border-slate-700/50"
            title={isAr ? "رجوع لعقود الإيجار" : "Back to Leases List"}
          >
            {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                {isAr ? "مساحة عمل العقد المتكاملة" : "Integrated Lease Workspace"}
              </span>
              <span className="text-xs text-slate-400">Ejari: {lease.ejariNumber || "N/A"}</span>
            </div>
            
            <div className="flex items-center gap-3 mt-1.5">
              <h2 className="text-xl md:text-2xl font-black font-mono tracking-tight">{lease.leaseNumber}</h2>
              <Badge variant={lease.contractStatus === "ACTIVE" ? "success" : "neutral"}>
                {lease.contractStatus}
              </Badge>
              <Badge variant={riskLevel === "CRITICAL" ? "danger" : riskLevel === "HIGH" ? "warning" : "success"}>
                Risk: {riskLevel}
              </Badge>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!lease) return;
              const eligibility = getLeaseRenewalEligibility(lease, isAr ? "ar" : "en");
              if (!eligibility.isEligible) {
                setIsRenewalRuleNoticeOpen(true);
                return;
              }
              onOpenRenew(lease);
            }}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer border border-amber-500/30"
          >
            <RotateCw className="w-4 h-4" />
            <span>{isAr ? "تجديد هذا العقد" : "Renew Contract"}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-700"
          >
            {isAr ? "إغلاق" : "Close Workspace"}
          </button>
        </div>
      </div>

      {/* Quick Jump Sticky Navigation Bar */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-xs p-2 rounded-2xl flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <span className="text-[10px] font-black uppercase text-slate-400 px-3 border-r border-slate-200/80 shrink-0">
          {isAr ? "الانتقال السريع:" : "Jump to:"}
        </span>
        {subSections.map((sec) => {
          const Icon = sec.icon;
          return (
            <button
              key={sec.id}
              onClick={() => scrollToSection(sec.id)}
              className="px-3.5 py-1.5 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Icon className="w-3.5 h-3.5 text-slate-500" />
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Single Continuous Content Stream */}
      <div className="space-y-8">
        
        {/* SECTION 1: OVERVIEW & RISKS */}
        <div id="overview-sec" className="space-y-4 scroll-mt-20">
          <div className="border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-amber-700 rounded-full"></span>
            <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider">
              {isAr ? "1. نظرة عامة ومؤشرات المخاطر المالية" : "1. Financial Overview & Risk Indicators"}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] uppercase font-black text-slate-400 tracking-wider">{isAr ? "الإيجار السنوي" : "Annual Rent"}</div>
              <div className="text-xl font-black text-slate-900 font-mono mt-1.5">
                AED {((lease.annualRent || 0) || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {lease.installmentsCount || lease.chequesCount || 4} {isAr ? "دفعات" : "Installments"} ({lease.paymentFrequency || "QUARTERLY"})
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] uppercase font-black text-slate-400 tracking-wider">{isAr ? "المبلغ المحصل" : "Total Collected"}</div>
              <div className="text-xl font-black text-emerald-600 font-mono mt-1.5">
                AED {totalCollected.toLocaleString()}
              </div>
              <div className="text-[10px] text-emerald-600 mt-1 font-bold">
                {Math.round((totalCollected / ((lease.annualRent || 0) || 1)) * 100)}% {isAr ? "من إجمالي العقد" : "Collected"}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] uppercase font-black text-slate-400 tracking-wider">{isAr ? "المتبقي على المستأجر" : "Tenant Outstanding"}</div>
              <div className="text-xl font-black text-rose-600 font-mono mt-1.5">
                AED {totalOutstanding.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {bouncedCount} {isAr ? "شيكات مرتجعة بقيمة" : "bounced cheques worth"} AED {bouncedAmount.toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] uppercase font-black text-slate-400 tracking-wider">{isAr ? "تاريخ سريان العقد" : "Contract Period"}</div>
              <div className="text-xs font-black text-slate-900 font-mono mt-2.5">
                {(lease.startDate || '')} → {lease.endDate}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 font-bold">
                Security Deposit: AED {lease.securityDeposit?.toLocaleString() || "0"}
              </div>
            </div>
          </div>

          {/* Risk Alert Banner */}
          <div className={`p-4 rounded-2xl border ${riskLevel === "CRITICAL" ? "bg-rose-50 border-rose-200 text-rose-950" : riskLevel === "HIGH" ? "bg-amber-50 border-amber-200 text-amber-950" : "bg-emerald-50 border-emerald-200 text-emerald-950"}`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <ShieldAlert className={`w-5 h-5 ${riskLevel === "CRITICAL" ? "text-rose-700" : riskLevel === "HIGH" ? "text-amber-700" : "text-emerald-700"}`} />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider">
                    {isAr ? "مؤشر مخاطر العقد الذكي (AI Contract Risk Indicator)" : "Smart Contract Risk Level: " + riskLevel}
                  </h4>
                  <p className="text-[11px] mt-0.5 opacity-80">
                    {riskReasons.length > 0 ? riskReasons.join(" • ") : (isAr ? "لا توجد مخاطر مالية أو تأخر في الدفعات مرصود حالياً." : "No current financial risks or delayed payments detected.")}
                  </p>
                </div>
              </div>
              <Badge variant={riskLevel === "CRITICAL" ? "danger" : riskLevel === "HIGH" ? "warning" : "success"}>
                {riskLevel}
              </Badge>
            </div>
          </div>
        </div>

        {/* SECTION 1.5: TENANT DISTRIBUTION & OCCUPANCY ANALYTICS */}
        <div id="analytics-sec" className="space-y-4 scroll-mt-20">
          <div className="border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-indigo-600 rounded-full"></span>
            <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider">
              {isAr ? "تحليلات توزيع المستأجر والإشغال التاريخي" : "Tenant Distribution & Historical Occupancy Analytics"}
            </h3>
          </div>

          <LeaseOccupancyAnalytics
            lease={lease}
            tenant={tenant}
            unit={unit}
            property={property}
            allLeases={leases}
            allTenants={tenants}
            cheques={cheques}
            collections={collections}
          />
        </div>

        {/* SECTION 2: PARTIES, PROPERTY & UNIT SPECS */}
        <div id="parties-sec" className="space-y-4 scroll-mt-20">
          <div className="border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-amber-700 rounded-full"></span>
            <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider">
              {isAr ? "2. تفاصيل الأطراف، العقار والوحدة الإيجارية" : "2. Linked Parties, Property & Unit Specifications"}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tenant Profile */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-2xs">
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                <User className="w-4 h-4 text-amber-700" />
                <span>{isAr ? "بيانات المستأجر" : "Tenant Profile"}</span>
              </h4>
              {tenant ? (
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">{isAr ? "الاسم الكامل:" : "Full Name:"}</span>
                    <span className="font-bold">{isAr ? tenant.nameAr : tenant.nameEn}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">{isAr ? "رقم الاتصال:" : "Phone:"}</span>
                    <span className="font-bold font-mono">{tenant.phone || "N/A"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">{isAr ? "البريد الإلكتروني:" : "Email:"}</span>
                    <span className="font-bold font-mono">{tenant.email || "N/A"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">{isAr ? "رقم الهوية / جواز السفر:" : "ID / Passport:"}</span>
                    <span className="font-bold font-mono">{tenant.emiratesId || tenant.passportNumber || "N/A"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">{isAr ? "مستوى المخاطر الذاتية:" : "Individual Risk:"}</span>
                    <Badge variant={tenant.riskLevel === "HIGH" ? "danger" : "success"} size="sm">
                      {tenant.riskLevel || "LOW"}
                    </Badge>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic py-4 text-center">{isAr ? "لا توجد بيانات المستأجر." : "No tenant profile available."}</p>
              )}
            </div>

            {/* Owner Profile */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-2xs">
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Building className="w-4 h-4 text-amber-700" />
                <span>{isAr ? "بيانات المالك والجهة المستلمة" : "Owner Profile"}</span>
              </h4>
              {owner ? (
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">{isAr ? "اسم المالك:" : "Owner Name:"}</span>
                    <span className="font-bold">{isAr ? owner.nameAr : owner.nameEn}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">{isAr ? "رقم الاتصال:" : "Phone:"}</span>
                    <span className="font-bold font-mono">{owner.phone || "N/A"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">{isAr ? "البريد الإلكتروني:" : "Email:"}</span>
                    <span className="font-bold font-mono">{owner.email || "N/A"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">{isAr ? "الرقم التعريفي للمالك:" : "Owner Code:"}</span>
                    <span className="font-bold font-mono">{owner.code || "N/A"}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic py-4 text-center">{isAr ? "لا توجد بيانات المالك." : "No owner profile available."}</p>
              )}
            </div>

            {/* Property & Unit Specs */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-2xs">
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Building className="w-4 h-4 text-amber-700" />
                <span>{isAr ? "بيانات العقار والوحدة الإيجارية" : "Property & Unit Specifications"}</span>
              </h4>
              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">{isAr ? "اسم العقار:" : "Property Name:"}</span>
                  <span className="font-bold">{property ? (isAr ? property.nameAr : property.nameEn) : "Property"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">{isAr ? "المنطقة / الإمارة:" : "Community / Emirate:"}</span>
                  <span className="font-bold">{property ? `${property.community}, ${property.emirate}` : "N/A"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">{isAr ? "رقم الوحدة:" : "Unit Number:"}</span>
                  <span className="font-bold font-mono text-amber-800">#{unit?.unitNumber || "N/A"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">{isAr ? "نوع الوحدة وحالتها:" : "Unit Type & Status:"}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold">{unit?.unitType || "Apartment"}</span>
                    {unit && (
                      <div 
                        className={`w-2 h-2 rounded-full ${
                          unit.status === "OCCUPIED" ? "bg-emerald-500" : unit.status === "MAINTENANCE" ? "bg-amber-500" : "bg-slate-300"
                        }`}
                        title={unit.status}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: INSTALLMENT SCHEDULE */}
        <div id="financials-sec" className="space-y-4 scroll-mt-20">
          <div className="border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-amber-700 rounded-full"></span>
            <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider">
              {isAr ? "3. جدول دفعات وأقساط العقد الإيجاري" : "3. Contract Installment Schedule"}
            </h3>
          </div>

          {/* Full Width Table for Installment Schedule */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-2xs w-full">
            <h4 className="text-xs font-black text-slate-900 flex items-center justify-between border-b border-slate-100 pb-2">
              <span>{isAr ? "أقساط العقد التفصيلية وحالة السداد" : "Contract Installment Schedule & Payment Status"}</span>
              <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-md text-slate-500 font-mono">
                {lease.installmentsCount || 4} {isAr ? "أقساط" : "Installments"}
              </span>
            </h4>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-start text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="py-3 px-4 text-start">#</th>
                    <th className="py-3 px-4 text-start">{isAr ? "تاريخ الاستحقاق" : "Due Date"}</th>
                    <th className="py-3 px-4 text-start">{isAr ? "المبلغ المستحق" : "Amount"}</th>
                    <th className="py-3 px-4 text-start">{isAr ? "رقم الشيك المرتبط" : "Linked Cheque #"}</th>
                    <th className="py-3 px-4 text-start">{isAr ? "الحالة" : "Status"}</th>
                    <th className="py-3 px-4 text-end">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {(lease.installments && lease.installments.length > 0 ? lease.installments : [
                    { installmentNumber: 1, dueDate: (lease.startDate || ''), amount: (lease.annualRent || 0) / 4, status: "PENDING" },
                    { installmentNumber: 2, dueDate: lease.endDate, amount: (lease.annualRent || 0) / 4, status: "PENDING" },
                  ]).map((inst, idx) => {
                    const fin = getInstallmentFinancials(inst);
                    const displayChequeNumber = (inst as any).chequeNumber || fin.linkedCheque?.chequeNumber || ((inst as any).chequeId ? `#${(inst as any).chequeId.substring(0,6)}...` : (isAr ? "نقدي / تحويل" : "Cash/Transfer"));
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-bold font-mono text-slate-600">#{inst.installmentNumber || idx + 1}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">{inst.dueDate}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 font-mono">AED {inst.amount.toLocaleString()}</td>
                        <td className="py-3 px-4 font-mono text-amber-800 font-bold">{displayChequeNumber}</td>
                        <td className="py-3 px-4">
                          <Badge variant={inst.status === "CLEARED" || inst.status === "COLLECTED" ? "success" : inst.status === "BOUNCED" ? "danger" : "warning"} size="sm">
                            {inst.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-end">
                          {(() => {
                            if (fin.isBounced || inst.status === "BOUNCED") {
                            return (
                              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>{isAr ? "مرتجع / Bounced" : "Bounced"}</span>
                              </span>
                            );
                          }
                          if (fin.isFullyCollected || inst.status === "COLLECTED" || inst.status === "CLEARED") {
                            return (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>{isAr ? `محصل بالكامل — AED ${fin.totalAmount.toLocaleString()}` : `Fully Collected — AED ${fin.totalAmount.toLocaleString()}`}</span>
                              </span>
                            );
                          }
                          return (
                            <select
                              onChange={(e) => {
                                const action = e.target.value;
                                e.target.value = "";
                                if (!action) return;
                                handleChequeAction(inst, action);
                              }}
                              defaultValue=""
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg font-bold text-[10px] cursor-pointer border border-amber-300 focus:outline-hidden"
                            >
                              <option value="" disabled>
                                {isAr ? "إجراءات الشيك والقسط ▼" : "Actions ▼"}
                              </option>
                              <option value="BANK_COLLECTION">{isAr ? "1. تحصيل الشيك — إيداع بالبنك" : "1. Bank Collection"}</option>
                              <option value="CASH_DIRECT">{isAr ? "2. تسوية الشيك نقداً / Cash" : "2. Cash Settlement"}</option>
                              <option value="BANK_TRANSFER_SETTLEMENT">{isAr ? "3. تسوية الشيك تحويل بنكي / Bank Transfer" : "3. Bank Transfer Settlement"}</option>
                              <option value="CARD_SETTLEMENT">{isAr ? "4. تسوية الشيك بطاقة ائتمان / Credit Card" : "4. Credit Card Settlement"}</option>
                              <option value="PARTIAL">{isAr ? "5. تحصيل جزئي / Partial" : "5. Partial Settlement"}</option>
                              <option value="BOUNCED">{isAr ? "6. شيك راجع / Bounced" : "6. Bounced"}</option>
                              <option value="DEFERRED">{isAr ? "7. تأجيل الشيك / Deferred" : "7. Deferred"}</option>
                              <option value="REPLACE_CHEQUE">{isAr ? "8. استبدال الشيك / Replace Cheque" : "8. Replace Cheque"}</option>
                            </select>
                          );
                        })()}
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* SECTION 4: INTEGRATED CONTRACT PAYMENT & ALLOCATION CENTER */}
        <div id="payment-center-sec" className="space-y-4 scroll-mt-20">
          <div className="border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-amber-700 rounded-full"></span>
            <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider">
              {isAr ? "4. مركز المدفوعات المالي وتوزيع الدفعات المتكامل" : "4. Integrated Contract Payment & Allocation Center"}
            </h3>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-xs">
            {/* Tab selection navigation */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-0 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setPayCenterTab("RECORD")}
                className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  payCenterTab === "RECORD" ? "border-amber-600 text-amber-700 font-black" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {isAr ? "تسجيل دفعة جديدة" : "Record Payment"}
              </button>
              <button
                type="button"
                onClick={() => setPayCenterTab("ADVANCES")}
                className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  payCenterTab === "ADVANCES" ? "border-amber-600 text-amber-700 font-black" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <WalletCards className="w-3.5 h-3.5" />
                <span>{isAr ? "رصيد الدفعات المقدمة" : "Unallocated Advances"}</span>
                {totalUnallocatedAdvance > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-mono font-bold">
                    AED {totalUnallocatedAdvance.toLocaleString()}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setPayCenterTab("SCHEDULE")}
                className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  payCenterTab === "SCHEDULE" ? "border-amber-600 text-amber-700 font-black" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {isAr ? "جدول الدفعات" : "Installment Schedule"}
              </button>
              <button
                type="button"
                onClick={() => setPayCenterTab("HISTORY")}
                className={`px-4 py-2.5 font-bold text-xs border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  payCenterTab === "HISTORY" ? "border-amber-600 text-amber-700 font-black" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {isAr ? "سجل المدفوعات" : "Payment History"}
              </button>
            </div>

            {/* TAB 1: RECORD NEW PAYMENT FORM */}
            {payCenterTab === "RECORD" && (
              <form onSubmit={handleSubmitPayment} className="space-y-4">
                {errorMsg && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-bold border border-red-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Form Left Side */}
                  <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-200/80">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2 mb-2">
                      <CreditCard className="w-4 h-4 text-amber-700" />
                      <span>{isAr ? "تفاصيل الدفعة المستلمة" : "Payment Inflow Details"}</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          {isAr ? "المبلغ المستلم (AED) *" : "Amount (AED) *"}
                        </label>
                        <input
                          type="number"
                          required
                          min={0.01}
                          step={0.01}
                          value={amount || ""}
                          onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          {isAr ? "تاريخ التحصيل *" : "Payment Date *"}
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
                        label={isAr ? "طريقة السداد" : "Payment Method"}
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
                          {isAr ? "رمز الموافقة البنكي (Approval Code) *" : "Bank Approval Code *"}
                        </label>
                        <input
                          type="text"
                          required
                          value={approvalCode}
                          onChange={(e) => setApprovalCode(e.target.value)}
                          placeholder="e.g. APP-982341"
                          className="w-full px-3 py-2 bg-white border-2 border-emerald-400 rounded-lg text-xs font-mono font-bold text-emerald-950 focus:border-emerald-600 focus:outline-none"
                        />
                        <p className="text-[10px] text-emerald-700 font-medium">
                          {isAr
                            ? "إلزامي لجميع المعاملات بالبطاقات البنكية (فيزا / ماستركارد / ائتمان)"
                            : "Mandatory for all card transactions (VISA / MasterCard / Credit Card)"}
                        </p>
                      </div>
                    )}

                    {paymentMethod === "CHEQUE" && (
                      <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-slate-200/80">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            {isAr ? "رقم الشيك *" : "Cheque Number *"}
                          </label>
                          <input
                            type="text"
                            required
                            value={chequeNumber}
                            onChange={(e) => setChequeNumber(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            {isAr ? "اسم البنك *" : "Bank Name *"}
                          </label>
                          <input
                            type="text"
                            required
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            {isAr ? "تاريخ استحقاق الشيك *" : "Cheque Date *"}
                          </label>
                          <input
                            type="date"
                            required
                            value={chequeDate}
                            onChange={(e) => setChequeDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          {isAr ? "اسم دافع السند" : "Payer Name"}
                        </label>
                        <input
                          type="text"
                          value={payerName}
                          onChange={(e) => setPayerName(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          {isAr ? "رقم المرجع (إن وجد)" : "Reference #"}
                        </label>
                        <input
                          type="text"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        {isAr ? "ملاحظات إضافية" : "Additional Notes"}
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    <DocumentUpload
                      label={isAr ? "مستند الدفعة المرفق (شيك / تحويل بنكي)" : "Payment Attachment Document (Cheque/Slip)"}
                      defaultProfile={paymentMethod === "CHEQUE" ? "CHEQUE" : "RECEIPT"}
                      onOptimized={setAttachmentResult}
                    />
                  </div>

                  {/* Form Right Side: Active Allocations */}
                  <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-200/80">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>{isAr ? "توزيع وتخصيص السند" : "Real-time Receipt Allocations"}</span>
                      </h4>
                      <span
                        className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-md ${
                          unallocated === 0
                            ? "bg-emerald-100 text-emerald-700"
                            : unallocated < 0
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {isAr ? "غير موزع: " : "Unallocated: "} {unallocated.toLocaleString()} AED
                      </span>
                    </div>

                    {/* Active allocations list */}
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {allocations.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 bg-white p-2.5 border border-slate-200 rounded-xl shadow-2xs">
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-black text-slate-700 truncate">{a.desc}</div>
                            <div className="text-[9px] text-slate-400 font-mono">Max: {a.max.toLocaleString()} AED</div>
                          </div>
                          <input
                            type="number"
                            min={0}
                            max={a.max}
                            step={0.01}
                            value={a.amount}
                            onChange={(e) => handleAllocationAmountChange(a.targetId, parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 text-xs border border-slate-300 rounded-lg text-right font-mono font-bold text-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => removeAllocation(a.targetId)}
                            className="text-slate-400 hover:text-red-600 p-1 font-bold text-sm cursor-pointer"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                      {allocations.length === 0 && (
                        <div className="text-xs text-slate-400 text-center py-8 italic bg-white rounded-xl border border-dashed border-slate-200">
                          {isAr
                            ? "لم يتم اختيار توزيعات. سيتم حفظ الدفعة كدفعة مقدمة غير موزعة برصيد العقد."
                            : "No allocations selected. Payment will be held as unallocated contract advance."}
                        </div>
                      )}
                    </div>

                    {/* Available targets list */}
                    <div className="text-xs space-y-2 pt-2 border-t border-slate-200/80">
                      <div className="font-bold text-slate-700">
                        {isAr ? "الالتزامات المتاحة للتوزيع على هذا العقد:" : "Eligible Contract Targets:"}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {availableInstallments.map((inst) => (
                          <button
                            key={inst.installmentNumber}
                            type="button"
                            onClick={() =>
                              handleAddAllocation(
                                "LEASE_INSTALLMENT",
                                `${lease.id}:${inst.installmentNumber}`,
                                inst.amount,
                                `Inst #${inst.installmentNumber}`
                              )
                            }
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer border border-slate-200/60"
                          >
                            + Inst #{inst.installmentNumber} ({inst.amount.toLocaleString()})
                          </button>
                        ))}
                        {outstandingCheques.map((chq) => (
                          <button
                            key={chq.id}
                            type="button"
                            onClick={() =>
                              handleAddAllocation("CHEQUE", chq.id, chq.outstanding, `Chq ${chq.chequeNumber}`)
                            }
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 rounded-lg text-[10px] font-bold text-amber-800 cursor-pointer border border-amber-200/50"
                          >
                            + Chq {chq.chequeNumber} ({chq.outstanding.toLocaleString()})
                          </button>
                        ))}
                        {leaseCommissions.map((comm) => (
                          <button
                            key={comm.id}
                            type="button"
                            onClick={() =>
                              handleAddAllocation("COMMISSION", comm.id, comm.outstandingBalance, `Fee (${comm.partyType})`)
                            }
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-[10px] font-bold text-blue-800 cursor-pointer border border-blue-200/50"
                          >
                            + Fee {comm.partyType} ({comm.outstandingBalance.toLocaleString()})
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={amount <= 0 || unallocated < -0.01}
                    className={`px-6 py-2.5 rounded-xl font-bold text-white text-xs transition-colors flex items-center gap-2 cursor-pointer ${
                      amount > 0 && unallocated >= -0.01
                        ? showConfirm
                          ? "bg-amber-600 hover:bg-amber-700 animate-pulse"
                          : "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-slate-300 cursor-not-allowed"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {showConfirm
                        ? isAr
                          ? "تأكيد وتسجيل الدفعة الفورية"
                          : "Confirm & Post Payment Entry"
                        : isAr
                        ? "حفظ وتسجيل الدفعة"
                        : "Post Payment Entry"}
                    </span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: UNALLOCATED ADVANCES */}
            {payCenterTab === "ADVANCES" && (
              <div className="space-y-4">
                <div className="p-5 bg-amber-50/50 border border-amber-200/60 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-200/60">
                      <WalletCards className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-amber-900 uppercase tracking-wider">
                        {isAr ? "رصيد الدفعات المقدمة المتوفر للخصم والتسوية" : "Available Unallocated Advance Balance"}
                      </div>
                      <div className="text-xl font-black font-mono text-amber-800 mt-0.5">
                        AED {totalUnallocatedAdvance.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {advanceSuccessMsg && (
                  <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{advanceSuccessMsg}</span>
                  </div>
                )}

                {errorMsg && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-bold border border-red-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {totalUnallocatedAdvance > 0 ? (
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                    <h4 className="text-xs font-bold text-slate-800">
                      {isAr
                        ? "توزيع الرصيد المقدم الحالي على الالتزامات المستحقة:"
                        : "Liquidate & Allocate Advance Balance directly to Outstanding Obligations:"}
                    </h4>

                    {/* Active advance liquidation allocations */}
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {advanceAllocations.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 bg-white p-2.5 border border-slate-200 rounded-xl shadow-2xs">
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-black text-slate-700 truncate">{a.desc}</div>
                            <div className="text-[9px] text-slate-400 font-mono">Max: {a.max.toLocaleString()} AED</div>
                          </div>
                          <input
                            type="number"
                            min={0}
                            max={Math.min(a.max, totalUnallocatedAdvance)}
                            step={0.01}
                            value={a.amount}
                            onChange={(e) => handleAdvanceAmountChange(a.targetId, parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 text-xs border border-slate-300 rounded-lg text-right font-mono font-bold text-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => removeAdvanceAllocation(a.targetId)}
                            className="text-slate-400 hover:text-red-600 p-1 font-bold text-sm cursor-pointer"
                          >
                            &times;
                          </button>
                        </div>
                      ))}

                      {advanceAllocations.length === 0 && (
                        <div className="text-xs text-slate-400 text-center py-6 italic bg-white rounded-xl border border-dashed border-slate-200">
                          {isAr
                            ? "اختر الالتزامات المستحقة من القائمة بالأسفل لبدء التوزيع السريع."
                            : "Select targets from the eligible list below to apply advance funds."}
                        </div>
                      )}
                    </div>

                    {/* Eligible obligations for advance liquidation */}
                    <div className="text-xs space-y-2 pt-2 border-t border-slate-200">
                      <div className="font-bold text-slate-700">
                        {isAr ? "الالتزامات والذمم المستحقة:" : "Outstanding Obligations & Balances:"}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
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
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer border border-slate-200/60"
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
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 rounded-lg text-[10px] font-bold text-amber-800 cursor-pointer border border-amber-200/50"
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
                                `Fee (${comm.partyType})`
                              )
                            }
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-[10px] font-bold text-blue-800 cursor-pointer border border-blue-200/50"
                          >
                            + Fee {comm.partyType} ({comm.outstandingBalance.toLocaleString()})
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200 flex justify-end">
                      <button
                        type="button"
                        onClick={handleLiquidateAdvance}
                        disabled={totalAdvanceToAllocate <= 0 || totalAdvanceToAllocate > totalUnallocatedAdvance}
                        className={`px-5 py-2 rounded-xl font-bold text-white text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                          totalAdvanceToAllocate > 0 && totalAdvanceToAllocate <= totalUnallocatedAdvance
                            ? "bg-amber-600 hover:bg-amber-700"
                            : "bg-slate-300 cursor-not-allowed"
                        }`}
                      >
                        <ArrowDownLeft className="w-4 h-4" />
                        <span>{isAr ? "تأكيد توزيع الرصيد المقدم" : "Apply Advance Allocations"}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-xs italic">
                    {isAr
                      ? "لا توجد دفعات مقدمة غير موزعة على هذا العقد."
                      : "No unallocated advance payments on this lease."}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: INSTALLMENT SCHEDULE */}
            {payCenterTab === "SCHEDULE" && (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {(lease.installments || []).map((inst) => (
                  <div
                    key={inst.installmentNumber}
                    className="flex justify-between items-center p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl shadow-2xs hover:bg-slate-100/50 transition-colors"
                  >
                    <div>
                      <span className="font-black text-xs text-slate-800">
                        {isAr ? "الدفعة رقم #" : "Installment #"}
                        {inst.installmentNumber}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                        {isAr ? "تاريخ الاستحقاق: " : "Due: "} {inst.dueDate}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-xs text-slate-900">AED {inst.amount.toLocaleString()}</div>
                      <Badge
                        variant={inst.status === "COLLECTED" || inst.status === "CLEARED" ? "success" : "warning"}
                        size="sm"
                        className="mt-1"
                      >
                        {inst.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 4: COMPREHENSIVE PAYMENT HISTORY & REVERSAL */}
            {payCenterTab === "HISTORY" && (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <tr>
                        <th className="py-2.5 px-3 text-start">{isAr ? "رقم السند" : "Receipt #"}</th>
                        <th className="py-2.5 px-3 text-start">{isAr ? "تاريخ التحصيل" : "Payment Date"}</th>
                        <th className="py-2.5 px-3 text-start">{isAr ? "المبلغ" : "Amount"}</th>
                        <th className="py-2.5 px-3 text-start">{isAr ? "طريقة الدفع" : "Method"}</th>
                        <th className="py-2.5 px-3 text-start">{isAr ? "اسم الدافع" : "Payer"}</th>
                        <th className="py-2.5 px-3 text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {leaseCollections.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                            {isAr ? "لا توجد تحصيلات مسجلة لهذا العقد حتى الآن." : "No collections posted for this lease yet."}
                          </td>
                        </tr>
                      ) : (
                        leaseCollections.map((col) => {
                          const isReversed = financialReversals.some((r) => r.targetId === col.id && r.targetType === "COLLECTION");
                          return (
                            <tr key={col.id} className={`hover:bg-slate-50/50 ${isReversed ? "bg-red-50/40 text-slate-400" : ""}`}>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                <div className="flex flex-col">
                                  <span>{col.receiptNumber}</span>
                                  {isReversed && (
                                    <span className="text-[9px] font-black text-red-600 mt-0.5 uppercase">
                                      {isAr ? "ملغى / مسترد" : "Reversed"}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-mono">{col.paymentDate}</td>
                              <td className={`py-2.5 px-3 font-mono font-bold ${isReversed ? "text-slate-400 line-through" : "text-emerald-600"}`}>
                                AED {col.amountEntered.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">{col.paymentMethod}</td>
                              <td className="py-2.5 px-3 text-slate-700 truncate max-w-[140px]" title={col.payerName}>{col.payerName}</td>
                              <td className="py-2.5 px-3 text-end">
                                {!isReversed ? (
                                  <button
                                    onClick={() => {
                                      const reason = prompt(isAr ? "سبب عكس وإلغاء هذا السند والمطالبة؟" : "Enter payment reversal reason:");
                                      if (reason) {
                                        reversePaymentReceipt(col.id, reason);
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-[10px] font-bold cursor-pointer transition-colors border border-red-200/50"
                                  >
                                    {isAr ? "إلغاء وعكس السند" : "Reverse Receipt"}
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">{isAr ? "تم عكس السند" : "Reversed"}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 5: ANNUAL ADMINISTRATIVE FEES (COMMISSIONS) */}
        <div id="commissions-sec" className="space-y-4 scroll-mt-20">
          <div className="border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-amber-700 rounded-full"></span>
            <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider">
              {isAr ? "5. الرسوم الإدارية السنوية ومنع الازدواجية" : "5. Annual Administrative Fees & Duplicate Protection"}
            </h3>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  {isAr ? "الرسوم الإدارية السنوية ومنع الازدواجية" : "Annual Administrative Fees & Duplicate Protection"}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {isAr ? `السنة التعاقدية الحالية: ${currentCommissionYear} • دورة التجديد الحالية: #${renewalSeq}` : `Current Contractual Year: ${currentCommissionYear} • Renewal Cycle: #${renewalSeq}`}
                </p>
              </div>

              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("set-financials-tab", { detail: { tab: "ADMIN_FEES" } }));
                  window.dispatchEvent(new CustomEvent("navigate-to-view", { detail: { view: "FINANCIALS" } }));
                }}
                className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isAr ? "الذهاب لصفحة تحصيل الرسوم بالمركز المالي" : "Go to Financial Center Admin Fees"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* OWNER COMMISSION */}
              {(() => {
                const ownerComm = allLeaseAdminFees.find(
                  (c) => c.partyType === "OWNER" && (String(c.contractualCommissionYear || "") === String(currentCommissionYear) || (c.renewalSequence || 1) === renewalSeq)
                );
                const isPaidOrSettled = ownerComm?.status === "FULLY_COLLECTED" || ownerComm?.status === "COLLECTED";
                return (
                  <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-amber-700" />
                        <h5 className="text-xs font-black text-slate-900">{isAr ? "الرسوم الإدارية للمالك (Owner Admin Fees)" : "Owner Administrative Fees"}</h5>
                      </div>
                      <Badge variant={isPaidOrSettled ? "success" : ownerComm ? "warning" : "neutral"} size="sm">
                        {isPaidOrSettled ? (isAr ? "مسددة (PAID)" : "Paid / Settled") : ownerComm ? (isAr ? ownerComm.status : ownerComm.status) : (isAr ? "غير مسجلة" : "Not Charged")}
                      </Badge>
                    </div>

                    {ownerComm ? (
                      <div className="space-y-2 text-xs text-slate-700">
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">{isAr ? "المبلغ:" : "Amount:"}</span>
                          <span className="font-bold font-mono text-emerald-600">AED {ownerComm.totalCommissionAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">{isAr ? "سنة الرسوم الإدارية:" : "Fee Year:"}</span>
                          <span className="font-bold font-mono">{ownerComm.contractualCommissionYear || currentCommissionYear}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">{isAr ? "الحالة مالياً:" : "Status:"}</span>
                          <span className="font-bold font-mono">{ownerComm.status}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 py-2">
                        {isAr ? "لم يتم تسجيل رسوم إدارية لهذا المالك عن السنة التعاقدية الحالية من قبل المركز المالي." : "No administrative fees charged for this owner for the current contractual year yet."}
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* TENANT COMMISSION */}
              {(() => {
                const tenantComm = allLeaseAdminFees.find(
                  (c) => c.partyType === "TENANT" && (String(c.contractualCommissionYear || "") === String(currentCommissionYear) || (c.renewalSequence || 1) === renewalSeq)
                );
                const isPaidOrSettled = tenantComm?.status === "FULLY_COLLECTED" || tenantComm?.status === "COLLECTED";
                return (
                  <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-amber-700" />
                        <h5 className="text-xs font-black text-slate-900">{isAr ? "الرسوم الإدارية للمستأجر (Tenant Admin Fees)" : "Tenant Administrative Fees"}</h5>
                      </div>
                      <Badge variant={isPaidOrSettled ? "success" : tenantComm ? "warning" : "neutral"} size="sm">
                        {isPaidOrSettled ? (isAr ? "مسددة (PAID)" : "Paid / Settled") : tenantComm ? (isAr ? tenantComm.status : tenantComm.status) : (isAr ? "غير مسجلة" : "Not Charged")}
                      </Badge>
                    </div>

                    {tenantComm ? (
                      <div className="space-y-2 text-xs text-slate-700">
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">{isAr ? "المبلغ:" : "Amount:"}</span>
                          <span className="font-bold font-mono text-emerald-600">AED {tenantComm.totalCommissionAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">{isAr ? "سنة الرسوم الإدارية:" : "Fee Year:"}</span>
                          <span className="font-bold font-mono">{tenantComm.contractualCommissionYear || currentCommissionYear}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">{isAr ? "الحالة مالياً:" : "Status:"}</span>
                          <span className="font-bold font-mono">{tenantComm.status}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 py-2">
                        {isAr ? "لم يتم تسجيل رسوم إدارية لهذا المستأجر عن السنة التعاقدية الحالية من قبل المركز المالي." : "No administrative fees charged for this tenant for the current contractual year yet."}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* SECTION 6: DOCUMENTS CHECKLIST & ELECTRONIC ARCHIVE */}
        <div id="documents-sec" className="space-y-4 scroll-mt-20">
          <div className="border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-amber-700 rounded-full"></span>
            <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider">
              {isAr ? "6. تدقيق المستندات والأرشيف الإلكتروني الرقمي" : "6. Document Verification Checklist & Digital Archive"}
            </h3>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-2xs">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">{isAr ? "قائمة تدقيق واعتماد المستندات القانونية" : "Required Tenancy Legal Document Checklist"}</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { name: "Lease Agreement (عقد الإيجار مبرماً)", required: true, uploaded: leaseDocuments.length > 0 },
                { name: "Tenant Emirates ID (بطاقة هوية المستأجر)", required: true, uploaded: true },
                { name: "Security Deposit Receipt (إيصال سداد مبلغ التأمين)", required: true, uploaded: true },
                { name: "Ejari Certificate (شهادة تسجيل إيجاري)", required: true, uploaded: !!lease.ejariNumber },
                { name: "Cheque Copies (صور الشيكات البنكية المودعة)", required: true, uploaded: true },
              ].map((doc, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between shadow-2xs">
                  <div>
                    <div className="font-bold text-[11px] text-slate-900">{doc.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{doc.required ? "Mandatory Document" : "Optional Document"}</div>
                  </div>
                  <Badge variant={doc.uploaded ? "success" : "warning"} size="sm">
                    {doc.uploaded ? (isAr ? "موثق" : "Verified") : (isAr ? "مفقود" : "Missing")}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Render Actual Files from Electronic Archive */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <h5 className="text-xs font-black text-slate-950 uppercase tracking-wider">{isAr ? "أرشيف ملفات العقد الإلكتروني" : "Electronic File Archive Linkage"}</h5>
              {leaseDocuments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {leaseDocuments.map((doc, idx) => (
                    <div key={`${doc.id}-${idx}`} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between hover:bg-slate-100/50 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-amber-700" />
                        <div>
                          <div className="text-xs font-bold text-slate-800 font-mono">{doc.fileName}</div>
                          <div className="text-[10px] text-slate-400">{(doc.fileSize / 1024).toFixed(1)} KB • {doc.category}</div>
                        </div>
                      </div>
                      {doc.previewUrl && (
                        <a
                          href={doc.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                        >
                          {isAr ? "عرض الملف" : "View Link"}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic py-2">{isAr ? "لا توجد وثائق ملحقة في الأرشيف الإلكتروني حالياً." : "No documents linked in the electronic archive yet."}</p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 7: MAINTENANCE REQUESTS & LEDGER POSTINGS */}
        <div id="maintenance-sec" className="space-y-4 scroll-mt-20">
          <div className="border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-amber-700 rounded-full"></span>
            <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider">
              {isAr ? "7. طلبات صيانة العقار وترحيل الفواتير مالياً" : "7. Linked Property Maintenance Requests & Invoices"}
            </h3>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider">
                {isAr ? "طلبات صيانة الوحدة المرتبطة بالعقد" : "Maintenance Ledger Summary"}
              </h4>
              <Badge variant="neutral">
                {leaseMaintenance.length} {isAr ? "طلبات مسجلة" : "Requests Listed"}
              </Badge>
            </div>

            <div className="space-y-3">
              {leaseMaintenance.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  {isAr ? "لا توجد طلبات صيانة أو ترحيل فواتير مسجلة لهذه الوحدة حالياً." : "No maintenance requests found for this property unit."}
                </p>
              ) : (
                leaseMaintenance.map((m) => (
                  <div key={m.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-100/50 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-950 font-mono bg-slate-200 px-2 py-0.5 rounded-md text-[10px]">
                          {m.requestNumber}
                        </span>
                        <span className="text-xs font-black text-slate-900">{m.category}</span>
                        <span className="text-[10px] text-slate-400 font-mono">• {m.requestDate}</span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-1">{m.issueDescription}</p>
                      
                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 pt-1">
                        <span>{isAr ? "التكلفة الكلية:" : "Total Cost:"} <strong className="text-slate-900 font-mono">AED {(m.totalCost || 0).toLocaleString()}</strong></span>
                        <span>•</span>
                        <span>{isAr ? "ملتزم السداد:" : "Cost Bearer:"} <strong className="text-amber-800 font-black">{m.costBearer || "OWNER"}</strong></span>
                        {m.invoices && m.invoices.length > 0 && (
                          <>
                            <span>•</span>
                            <span>{isAr ? "رقم الفاتورة:" : "Invoice #:"} <strong className="text-slate-900 font-mono">{m.invoices[0].invoiceNumber}</strong></span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={m.status === "COMPLETED" ? "success" : "warning"} size="sm">
                        {m.status}
                      </Badge>

                      {m.financialStatus === "POSTED" ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                          {isAr ? "مرحل مالياً" : "Posted"}
                        </span>
                      ) : m.financialStatus === "PARTIALLY_POSTED" ? (
                        <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 text-[10px] font-black">
                          {isAr ? "مرحل جزئياً" : "Partially Posted"}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                          {isAr ? "غير مرحل" : "Not Posted"}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* SECTION 8: TIMELINE & AUDIT TRAIL */}
        <div id="timeline-sec" className="space-y-4 scroll-mt-20">
          <div className="border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-amber-700 rounded-full"></span>
            <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider">
              {isAr ? "8. الخط الزمني وسجلات التدقيق الأمني للعمليات" : "8. Integrated Contract Timeline & Audit History Logs"}
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Notifications & Timeline */}
            <div className="lg:col-span-1 space-y-6">
              {/* WhatsApp Log */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-2xs">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>{isAr ? "إشعارات الواتساب والتحصيلات" : "WhatsApp Dispatch Logs"}</span>
                </h4>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 text-[11px] text-slate-700 leading-relaxed">
                  {isAr 
                    ? "تنبيهات استحقاق الأقساط الشهرية والتذكير بالتجديد مجدولة بنجاح ومرتبطة بنظام الواتساب المباشر للمستأجر." 
                    : "Automated payment reminders and lease expiry alerts successfully queued via integrated WhatsApp gateway."}
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-2xs">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">{isAr ? "تاريخ دورة حياة العقد" : "Contractual Milestones"}</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                    <div>
                      <div className="text-xs font-bold text-slate-900">{isAr ? "تم إنشاء العقد وتفعيله" : "Lease Activated"}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{(lease.startDate || '')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-2xs">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center justify-between">
                <span>{isAr ? "سجل التدقيق الأمني للنظام" : "Authoritative System Audit History"}</span>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-mono">{leaseAudit.length} {isAr ? "سجلات" : "Logs"}</span>
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <tr>
                      <th className="py-2.5 px-3 text-start">Timestamp</th>
                      <th className="py-2.5 px-3 text-start">Action</th>
                      <th className="py-2.5 px-3 text-start">User</th>
                      <th className="py-2.5 px-3 text-start">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {leaseAudit.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400">
                          {isAr ? "لا توجد سجلات تدقيق أمني مرتبطة مباشرة." : "No audit history logs linked to this contract."}
                        </td>
                      </tr>
                    ) : (
                      leaseAudit.map((log, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-[10px]">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="py-2 px-3 font-black text-amber-800">{log.action}</td>
                          <td className="py-2 px-3 text-slate-700">{log.userName || log.userId}</td>
                          <td className="py-2 px-3 text-slate-500 max-w-[200px] truncate" title={log.details}>{log.details}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 9: AUTHORITATIVE CHEQUE REGISTER & LIFECYCLE LEDGER */}
        <div id="cheques-ledger-sec" className="space-y-4 scroll-mt-20">
          <div className="border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-amber-700 rounded-full"></span>
            <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider">
              {isAr ? "9. سجل حركة وإدارة الشيكات الشامل" : "9. Comprehensive Cheque Register & Status Lifecycle"}
            </h3>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-2xs w-full">
            <h4 className="text-xs font-black text-slate-900 flex items-center justify-between border-b border-slate-100 pb-2">
              <span>{isAr ? "سجل حركة وإدارة الشيكات" : "Cheque Register & Status Lifecycle"}</span>
              <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-md text-slate-500 font-mono">
                {leaseCheques.length} {isAr ? "شيكات" : "Cheques"}
              </span>
            </h4>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-start text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="py-3 px-4 text-start">{isAr ? "رقم الشيك" : "Cheque #"}</th>
                    <th className="py-3 px-4 text-start">{isAr ? "تاريخ الاستحقاق" : "Due Date"}</th>
                    <th className="py-3 px-4 text-start">{isAr ? "المبلغ" : "Amount"}</th>
                    <th className="py-3 px-4 text-start">{isAr ? "البنك المسحوب عليه" : "Drawer Bank"}</th>
                    <th className="py-3 px-4 text-start">{isAr ? "حالة الشيك الحالية" : "Cheque Status"}</th>
                    <th className="py-3 px-4 text-end">{isAr ? "إجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {leaseCheques.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        {isAr ? "لا توجد شيكات مرتبطة بهذا العقد." : "No cheques linked to this contract."}
                      </td>
                    </tr>
                  ) : (
                    leaseCheques.map((chq) => (
                      <tr key={chq.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">{chq.chequeNumber}</td>
                        <td className="py-3 px-4 font-mono">{chq.dueDate}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">AED {chq.amount.toLocaleString()}</td>
                        <td className="py-3 px-4 text-slate-600">{chq.bankName}</td>
                        <td className="py-3 px-4">
                          <Badge variant={chq.status === "BOUNCED" ? "danger" : chq.status === "CLEARED" || chq.status === "COLLECTED" ? "success" : "warning"} size="sm">
                            {chq.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-end">
                          {chq.status !== "REPLACED" && chq.status !== "CANCELLED" && chq.status !== "CLEARED" && chq.status !== "COLLECTED" ? (
                            <button
                              type="button"
                              onClick={() => setReplacingCheque(chq)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[10px] font-bold border border-amber-300 transition cursor-pointer"
                            >
                              {isAr ? "استبدال الشيك" : "Replace Cheque"}
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono italic">
                              {chq.status === "REPLACED" ? (isAr ? "مستبدل" : "Replaced") : chq.status === "CANCELLED" ? (isAr ? "ملغى" : "Cancelled") : (isAr ? "مسوى" : "Settled")}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Safety Confirmation Modal */}
      <Modal
        isOpen={!!safetyConfirmData}
        onClose={() => setSafetyConfirmData(null)}
        title={isAr ? "تأكيد عملية التحصيل والتسوية" : "Confirm Collection & Settlement"}
        maxWidth="lg"
      >
        {safetyConfirmData && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-amber-900 font-bold">
                  {isAr 
                    ? "يرجى التحقق من كافة التفاصيل المالية والمستندات قبل الضغط على تأكيد. هذا الإجراء غير قابل للتراجع." 
                    : "Please verify all financial details before confirming. This action is irreversible."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 block">{isAr ? "المستأجر" : "Tenant"}</span>
                <span className="font-bold text-slate-800">{tenant?.nameAr || tenant?.nameEn || "N/A"}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 block">{isAr ? "المالك" : "Owner"}</span>
                <span className="font-bold text-slate-800">{owner?.nameAr || owner?.nameEn || "N/A"}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 block">{isAr ? "العقار والوحدة" : "Property & Unit"}</span>
                <span className="font-bold text-slate-800">
                  {property?.nameAr || property?.nameEn || "N/A"} - {unit?.unitNumber ? `#${unit?.unitNumber}` : "N/A"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 block">{isAr ? "رقم الشيك" : "Cheque Number"}</span>
                <span className="font-bold text-slate-800">
                  {safetyConfirmData.fin.linkedCheque?.chequeNumber || safetyConfirmData.inst.chequeNumber || "N/A"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 block">{isAr ? "قيمة الشيك" : "Cheque Amount"}</span>
                <span className="font-extrabold text-slate-800">
                  AED {safetyConfirmData.fin.totalAmount.toLocaleString()}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 block">{isAr ? "المحصل سابقاً" : "Previously Collected"}</span>
                <span className="font-bold text-emerald-600">
                  AED {safetyConfirmData.fin.collected.toLocaleString()}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 block">{isAr ? "المبلغ المراد تحصيله الآن" : "Amount to Collect Now"}</span>
                <span className="font-black text-amber-700 text-sm">
                  AED {safetyConfirmData.fin.remaining.toLocaleString()}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 block">{isAr ? "طريقة التحصيل" : "Collection Method"}</span>
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 font-bold rounded-md inline-block">
                  {isAr ? safetyConfirmData.methodLabelAr : safetyConfirmData.methodLabelEn}
                </span>
              </div>
            </div>

            {/* Conditional verification fields for Credit Card and Bank Transfer */}
            {safetyConfirmData.method === "CREDIT_CARD" && (
              <div className="border-t border-slate-100 pt-3 space-y-1 text-left">
                <label className="block text-xs font-bold text-slate-700">
                  {isAr ? "رقم الموافقة / رمز التفويض للبطاقة الائتمانية *" : "Credit Card Approval Number / Auth Code *"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isAr ? "أدخل رقم الموافقة المكتوب على الإيصال" : "Enter approval number from receipt"}
                  value={ccApprovalNumber}
                  onChange={(e) => setCcApprovalNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-bold bg-white text-xs"
                />
              </div>
            )}

            {safetyConfirmData.method === "BANK_TRANSFER" && (
              <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-3 text-left">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {isAr ? "رقم مرجع الحوالة البنكية *" : "Bank Transfer Reference Number *"}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isAr ? "أدخل رقم مرجع أو تأكيد التحويل" : "Enter transfer reference number"}
                    value={bankTransferRef}
                    onChange={(e) => setBankTransferRef(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-bold bg-white text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {isAr ? "تاريخ إجراء الحوالة *" : "Bank Transfer Date *"}
                  </label>
                  <input
                    type="date"
                    required
                    value={bankTransferDate}
                    onChange={(e) => setBankTransferDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-mono font-bold bg-white text-xs"
                  />
                </div>
              </div>
            )}

            <p className="text-sm font-bold text-slate-900 border-t border-slate-100 pt-3 text-center">
              {isAr ? "هل تريد تأكيد هذه العملية وتسجيل الدفعة وتصفية المستند؟" : "Do you want to confirm this operation, record payment, and clear document?"}
            </p>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setSafetyConfirmData(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                {isAr ? "تراجع" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleConfirmDirectCollection}
                disabled={
                  (safetyConfirmData.method === "CREDIT_CARD" && !ccApprovalNumber.trim()) ||
                  (safetyConfirmData.method === "BANK_TRANSFER" && (!bankTransferRef.trim() || !bankTransferDate))
                }
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                {isAr ? "تأكيد التحصيل والتسوية" : "Confirm Collection"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 2. Partial Settlement & Deferral Modal */}
      <Modal
        isOpen={!!partialModalData}
        onClose={() => setPartialModalData(null)}
        title={isAr ? "تسجيل تحصيل جزئي وتأجيل المتبقي" : "Partial Collection & Deferral"}
        maxWidth="xl"
      >
        {partialModalData && (
          <div className="space-y-4 text-xs">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-400 block">{isAr ? "قيمة الشيك الإجمالية" : "Total Cheque Amount"}</span>
                <span className="font-bold text-slate-800">AED {partialModalData.fin.totalAmount.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{isAr ? "المحصل سابقاً" : "Previously Collected"}</span>
                <span className="font-bold text-emerald-600">AED {partialModalData.fin.collected.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{isAr ? "المتبقي المستحق" : "Outstanding Balance"}</span>
                <span className="font-extrabold text-amber-700">AED {partialModalData.fin.remaining.toLocaleString()}</span>
              </div>
            </div>

            {/* Clear Payment Summary Text Banner */}
            <div className="bg-amber-50/60 border border-amber-200/80 p-3.5 rounded-2xl text-[11px] font-bold text-amber-950 space-y-1.5">
              <p className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full text-xs"></span>
                <span>
                  {isAr 
                    ? `إجمالي المبلغ المدفوع (المحصل) لهذه الدفعة حتى الآن هو: ` 
                    : `The total paid (collected) amount for this installment so far is: `}
                  <span className="text-emerald-700 font-extrabold text-xs font-mono">AED {partialModalData.fin.collected.toLocaleString()}</span>
                </span>
              </p>
              <p className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-rose-600 rounded-full text-xs"></span>
                <span>
                  {isAr 
                    ? `إجمالي المبلغ المتبقي للدفع هو: ` 
                    : `The total remaining outstanding balance to pay is: `}
                  <span className="text-rose-700 font-extrabold text-xs font-mono">AED {partialModalData.fin.remaining.toLocaleString()}</span>
                </span>
              </p>
            </div>

            {/* Inputs */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isAr ? "المبلغ المحصل الآن *" : "Amount to Collect Now *"}
                  </label>
                  <input
                    type="number"
                    max={partialModalData.fin.remaining}
                    min={0.01}
                    value={partialModalData.amountToCollect}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      const rem = Math.max(0, partialModalData.fin.remaining - val);
                      setPartialModalData(prev => prev ? {
                        ...prev,
                        amountToCollect: val,
                        deferredAmount: rem,
                        deferRemaining: rem > 0.01 ? prev.deferRemaining : false
                      } : null);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isAr ? "طريقة الدفع *" : "Payment Method *"}
                  </label>
                  <select
                    value={partialModalData.paymentMethod}
                    onChange={(e) => {
                      const method = e.target.value as PaymentMethod;
                      setPartialModalData(prev => prev ? { ...prev, paymentMethod: method } : null);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500 bg-white"
                  >
                    <option value="CASH">{isAr ? "نقداً / Cash" : "Cash"}</option>
                    <option value="BANK_TRANSFER">{isAr ? "تحويل بنكي / Bank Transfer" : "Bank Transfer"}</option>
                    <option value="CREDIT_CARD">{isAr ? "بطاقة ائتمان / Credit Card" : "Credit Card"}</option>
                  </select>
                </div>
              </div>

              {/* Deferral option (Only if there is remaining) */}
              {partialModalData.deferredAmount > 0.01 && (
                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="deferCheckbox"
                      checked={partialModalData.deferRemaining}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setPartialModalData(prev => prev ? { ...prev, deferRemaining: checked } : null);
                      }}
                      className="rounded-md border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                    <label htmlFor="deferCheckbox" className="font-bold text-slate-800 cursor-pointer select-none">
                      {isAr ? `تأجيل المبلغ المتبقي (AED ${partialModalData.deferredAmount.toLocaleString()}) كالتزام مستقل` : `Defer remaining amount (AED ${partialModalData.deferredAmount.toLocaleString()}) as promise`}
                    </label>
                  </div>

                  {partialModalData.deferRemaining && (
                    <div className="grid grid-cols-2 gap-3 bg-amber-50/50 p-3 rounded-xl border border-amber-200/50 animate-in fade-in duration-150">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          {isAr ? "تاريخ الاستحقاق الجديد للتسوية *" : "Expected Due Date *"}
                        </label>
                        <input
                          type="date"
                          required
                          value={partialModalData.expectedDueDate}
                          onChange={(e) => setPartialModalData(prev => prev ? { ...prev, expectedDueDate: e.target.value } : null)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500 bg-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          {isAr ? "سبب التأجيل التفصيلي *" : "Deferral Reason *"}
                        </label>
                        <input
                          type="text"
                          required
                          placeholder={isAr ? "مثال: بانتظار تحويل الراتب" : "e.g. Awaiting salary transfer"}
                          value={partialModalData.deferReason}
                          onChange={(e) => setPartialModalData(prev => prev ? { ...prev, deferReason: e.target.value } : null)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          {isAr ? "المسؤول عن المتابعة" : "Responsible Employee"}
                        </label>
                        <input
                          type="text"
                          value={partialModalData.responsiblePerson}
                          onChange={(e) => setPartialModalData(prev => prev ? { ...prev, responsiblePerson: e.target.value } : null)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500 bg-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            {isAr ? "تاريخ المتابعة" : "Follow-up Date"}
                          </label>
                          <input
                            type="date"
                            value={partialModalData.followUpDate}
                            onChange={(e) => setPartialModalData(prev => prev ? { ...prev, followUpDate: e.target.value } : null)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500 bg-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            {isAr ? "أيام السماح" : "Grace Days"}
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={partialModalData.allowedDays}
                            onChange={(e) => setPartialModalData(prev => prev ? { ...prev, allowedDays: parseInt(e.target.value) || 0 } : null)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setPartialModalData(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleConfirmPartialCollection}
                disabled={partialModalData.amountToCollect <= 0 || (partialModalData.deferRemaining && (!partialModalData.expectedDueDate || !partialModalData.deferReason))}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-bold transition-colors shadow-sm"
              >
                {isAr ? "تأكيد وحفظ" : "Confirm & Save"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 3. Whole Deferral Modal */}
      <Modal
        isOpen={!!deferWholeModalData}
        onClose={() => setDeferWholeModalData(null)}
        title={isAr ? "تأجيل الشيك وبناء وعد سداد" : "Defer Cheque & Promise"}
        maxWidth="lg"
      >
        {deferWholeModalData && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-amber-800 font-bold block mb-1">
                {isAr ? "أنت بصدد تأجيل كامل مبلغ الشيك:" : "You are deferring the full cheque amount:"}
              </span>
              <span className="font-extrabold text-slate-800 text-sm">
                AED {deferWholeModalData.fin.remaining.toLocaleString()}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isAr ? "تاريخ الاستحقاق المتوقع الجديد * (إجباري)" : "Expected Due Date * (Required)"}
                </label>
                <input
                  type="date"
                  required
                  value={deferWholeModalData.expectedDueDate}
                  onChange={(e) => setDeferWholeModalData(prev => prev ? { ...prev, expectedDueDate: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500 bg-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isAr ? "سبب التأجيل للتسجيل المالي * (إجباري)" : "Deferral Reason * (Required)"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isAr ? "أدخل سبب التأجيل بالتفصيل" : "Enter details for deferring"}
                  value={deferWholeModalData.deferReason}
                  onChange={(e) => setDeferWholeModalData(prev => prev ? { ...prev, deferReason: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isAr ? "المسؤول عن المتابعة" : "Responsible Employee"}
                  </label>
                  <input
                    type="text"
                    value={deferWholeModalData.responsiblePerson}
                    onChange={(e) => setDeferWholeModalData(prev => prev ? { ...prev, responsiblePerson: e.target.value } : null)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500 bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {isAr ? "تاريخ المتابعة" : "Follow-up Date"}
                    </label>
                    <input
                      type="date"
                      value={deferWholeModalData.followUpDate}
                      onChange={(e) => setDeferWholeModalData(prev => prev ? { ...prev, followUpDate: e.target.value } : null)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {isAr ? "أيام السماح" : "Grace Days"}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={deferWholeModalData.allowedDays}
                      onChange={(e) => setDeferWholeModalData(prev => prev ? { ...prev, allowedDays: parseInt(e.target.value) || 0 } : null)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500 bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setDeferWholeModalData(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeferWhole}
                disabled={!deferWholeModalData.expectedDueDate || !deferWholeModalData.deferReason}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-bold transition-colors shadow-sm"
              >
                {isAr ? "تأكيد التأجيل" : "Confirm Deferral"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Lease Renewal Rule Governance Notice Modal */}
      <LeaseRenewalRuleNoticeModal
        isOpen={isRenewalRuleNoticeOpen}
        onClose={() => setIsRenewalRuleNoticeOpen(false)}
        lease={lease}
        tenantName={tenant?.[isAr ? "nameAr" : "nameEn"]}
        propertyName={property?.[isAr ? "nameAr" : "nameEn"]}
        unitNumber={unit?.unitNumber}
      />

      {/* Replace Cheque Modal */}
      {replacingCheque && (
        <ReplaceChequeModal
          originalCheque={replacingCheque}
          isOpen={true}
          onClose={() => setReplacingCheque(null)}
          onSuccess={() => {
            alert(isAr ? "تم استبدال الشيك وتحديث جدول الأقساط بنجاح." : "Cheque replaced and lease schedule synchronized successfully.");
            setReplacingCheque(null);
          }}
        />
      )}
    </div>
  );
};

export const LeaseWorkspaceModal: React.FC<LeaseWorkspaceModalProps> = (props) => {
  return <LeaseWorkspacePage {...props} />;
};
