import React, { useState, useMemo, useRef } from "react";
import {
  Calendar,
  CreditCard,
  Building,
  Search,
  AlertCircle,
  CheckCircle2,
  Receipt,
  Printer,
  RotateCcw,
  Coins,
  FileSpreadsheet,
  Building2,
  User,
  Hash,
  Filter,
  Check,
  X,
  Clock,
  AlertTriangle,
  FileCheck,
  Scale,
  ExternalLink,
  ArrowRightLeft,
  Ban,
  Info,
  Layers,
  Sparkles,
  FileText,
  Upload,
  Eye,
  History,
  Paperclip,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import {
  Cheque,
  ChequeStatus,
  ReturnReason,
  CollectionRecord,
  ChequeAuditEntry,
} from "../../types";
import { Badge } from "../common/Badge";
import { SearchableSelect, SearchableOption } from "../common/SearchableSelect";
import { RecordPaymentModal } from "../collections/RecordPaymentModal";
import { ReceiptVoucherModal } from "../collections/ReceiptVoucherModal";
import { Modal } from "../common/Modal";
import { ReplaceChequeModal } from "./ReplaceChequeModal";

// Helper: Start and End date of current month (YYYY-MM-DD)
const getCurrentMonthStartEnd = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  return {
    start: format(start),
    end: format(end),
  };
};

export type PDCOperationType = "DEPOSIT" | "CLEAR" | "BOUNCED" | "COLLECT";

interface PDCChequesViewProps {
  onNavigateToReturnedCheques?: () => void;
  onNavigateToAllCheques?: () => void;
}

export const PDCChequesView: React.FC<PDCChequesViewProps> = ({
  onNavigateToReturnedCheques,
  onNavigateToAllCheques,
}) => {
  const { language, t } = useLanguage();
  const isAr = language === "ar";

  const {
    cheques,
    tenants,
    properties,
    units,
    owners,
    leases,
    cases,
    updateChequeStatus,
    depositCheque,
    clearCheque,
    companyProfile,
  } = useData();

  const { currentUser } = useAuth();

  // 1. Initial State: "Empty on Open" requirement (shows search prompt until user searches)
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // 2. Default Month Dates
  const currentMonth = useMemo(() => getCurrentMonthStartEnd(), []);
  const [fromDate, setFromDate] = useState<string>(currentMonth.start);
  const [toDate, setToDate] = useState<string>(currentMonth.end);

  // 3. Filter States
  const [contractFilter, setContractFilter] = useState<string>("");
  const [ownerFilter, setOwnerFilter] = useState<string>("ALL");
  const [tenantFilter, setTenantFilter] = useState<string>("ALL");
  const [propertyFilter, setPropertyFilter] = useState<string>("ALL");
  const [unitFilter, setUnitFilter] = useState<string>("ALL");
  const [bankFilter, setBankFilter] = useState<string>("");
  const [chequeNoFilter, setChequeNoFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // UI States
  const [actionNotice, setActionNotice] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Modal State for Cheque Operations (Deposit, Clear, Return)
  const [selectedChequeForOp, setSelectedChequeForOp] = useState<Cheque | null>(null);
  const [activeOperation, setActiveOperation] = useState<PDCOperationType | null>(null);
  const [opReference, setOpReference] = useState("");
  const [opBankName, setOpBankName] = useState("");
  const [opDate, setOpDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [opNotes, setOpNotes] = useState("");
  const [opReturnReason, setOpReturnReason] = useState<ReturnReason>("INSUFFICIENT_FUNDS");
  const [opProofUrl, setOpProofUrl] = useState<string>("");
  const [opProofFileName, setOpProofFileName] = useState<string>("");
  const [isSubmittingOp, setIsSubmittingOp] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Modal for Viewing Attachments/Proofs
  const [viewingProof, setViewingProof] = useState<{
    title: string;
    url: string;
    fileName?: string;
  } | null>(null);

  // Modal for Viewing Cheque Audit History
  const [viewingAuditCheque, setViewingAuditCheque] = useState<Cheque | null>(null);

  // Modal State for Collection (Receipt)
  const [collectionCheque, setCollectionCheque] = useState<Cheque | null>(null);
  const [issuedReceipt, setIssuedReceipt] = useState<CollectionRecord | null>(null);

  // Modal for Replacement
  const [replacingCheque, setReplacingCheque] = useState<Cheque | null>(null);

  // Modal for Replacement Info
  const [replacementInfoCheque, setReplacementInfoCheque] = useState<Cheque | null>(null);

  // Helper to check active legal case protection
  const checkCaseControl = (
    cheque: Cheque
  ): { isControlled: boolean; caseNumber?: string } => {
    if (!cheque.convertedToCaseId) return { isControlled: false };
    const linkedCase = cases.find((c) => c.id === cheque.convertedToCaseId);
    if (!linkedCase) return { isControlled: false };
    const isControlled =
      linkedCase.status !== "CLOSED" && linkedCase.status !== "ARCHIVED";
    return {
      isControlled,
      caseNumber: linkedCase.caseNumber,
    };
  };

  // Format Date for UI (DD/MM/YYYY)
  const formatDateForUI = (dateStr?: string) => {
    if (!dateStr) return "—";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Format Currency (AED)
  const formatAED = (amount: number) => {
    return `${(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${isAr ? "د.إ" : "AED"}`;
  };

  // Trigger Current Month quick button
  const handleSetCurrentMonth = () => {
    const dates = getCurrentMonthStartEnd();
    setFromDate(dates.start);
    setToDate(dates.end);
    setHasSearched(true);
  };

  // Reset Filters to Current Month & ALL, clear search
  const handleResetFilters = () => {
    const defaultDates = getCurrentMonthStartEnd();
    setFromDate(defaultDates.start);
    setToDate(defaultDates.end);
    setContractFilter("");
    setOwnerFilter("ALL");
    setTenantFilter("ALL");
    setPropertyFilter("ALL");
    setUnitFilter("ALL");
    setBankFilter("");
    setChequeNoFilter("");
    setStatusFilter("ALL");
    setHasSearched(false);
  };

  // Trigger search
  const handleSearch = () => {
    setHasSearched(true);
  };

  // 3. Searchable Options for Filters
  const ownerOptions: SearchableOption[] = useMemo(() => {
    const list: SearchableOption[] = [
      {
        id: "ALL",
        label: isAr ? "جميع الملاك" : "All Property Owners",
      },
    ];
    owners.forEach((o) => {
      list.push({
        id: o.id,
        label: isAr ? o.nameAr : o.nameEn,
        subLabel: `${isAr ? "الهاتف" : "Phone"}: ${o.phone || "—"} | ${isAr ? "الهوية" : "ID"}: ${o.emiratesId || "—"}`,
        extraInfo: o.email,
      });
    });
    return list;
  }, [owners, isAr]);

  const tenantOptions: SearchableOption[] = useMemo(() => {
    const list: SearchableOption[] = [
      {
        id: "ALL",
        label: isAr ? "جميع المستأجرين" : "All Tenants",
      },
    ];
    tenants.forEach((t) => {
      list.push({
        id: t.id,
        label: isAr ? t.nameAr : t.nameEn,
        subLabel: `${isAr ? "الهاتف" : "Phone"}: ${t.phone || "—"} | ${isAr ? "الهوية" : "Emirates ID"}: ${t.emiratesId || "—"}`,
        extraInfo: t.email,
      });
    });
    return list;
  }, [tenants, isAr]);

  const propertyOptions: SearchableOption[] = useMemo(() => {
    const list: SearchableOption[] = [
      {
        id: "ALL",
        label: isAr ? "جميع العقارات" : "All Properties",
      },
    ];
    properties.forEach((p) => {
      const owner = owners.find((o) => o.id === p.ownerId);
      list.push({
        id: p.id,
        label: isAr ? p.nameAr : p.nameEn,
        subLabel: owner
          ? `${isAr ? "المالك" : "Owner"}: ${isAr ? owner.nameAr : owner.nameEn}`
          : undefined,
      });
    });
    return list;
  }, [properties, owners, isAr]);

  const statusOptions: SearchableOption[] = [
    { id: "ALL", label: isAr ? "جميع الشيكات التشغيلية (الآجلة / المعلقة / المودعة)" : "All Operational PDC Cheques" },
    { id: "POST_DATED", label: isAr ? "شيك آجل (Post-Dated)" : "Post-Dated" },
    { id: "PENDING", label: isAr ? "قيد التحصيل (Pending)" : "Pending" },
    { id: "DEPOSITED", label: isAr ? "مودع بالبنك (Deposited)" : "Deposited" },
  ];

  // 4. Strict Filter Logic over DataContext.cheques for PDC Operational Desk
  // STRICT: Excludes COLLECTED, BOUNCED, CANCELLED, REPLACED, UNDER_LEGAL, and case-controlled cheques.
  const filteredCheques = useMemo(() => {
    if (!hasSearched) return [];

    return cheques.filter((c) => {
      // 4.0 Strict PDC operational status check:
      // PDC Cheques View is strictly for actionable cheques awaiting deposit, clearing, or direct collection
      if (
        c.status !== "POST_DATED" &&
        c.status !== "PENDING" &&
        c.status !== "DEPOSITED"
      ) {
        return false;
      }

      // Outstanding check
      if (c.outstanding <= 0) return false;

      // Legal Case Protection: case-controlled cheques are handled exclusively in the legal desk
      const caseCtrl = checkCaseControl(c);
      if (caseCtrl.isControlled) return false;

      // 4.1 Due Date Range
      if (fromDate && c.dueDate < fromDate) return false;
      if (toDate && c.dueDate > toDate) return false;

      // 4.2 Contract Number
      if (contractFilter.trim()) {
        const query = contractFilter.trim().toLowerCase();
        const lease = leases.find((l) => l.id === c.leaseId);
        const leaseNo = (lease?.leaseNumber || c.leaseId || "").toLowerCase();
        if (!leaseNo.includes(query)) return false;
      }

      // 4.3 Property Owner
      if (ownerFilter !== "ALL" && c.ownerId !== ownerFilter) return false;

      // 4.4 Tenant
      if (tenantFilter !== "ALL" && c.tenantId !== tenantFilter) return false;

      // 4.5 Property
      if (propertyFilter !== "ALL" && c.propertyId !== propertyFilter) return false;

      // 4.6 Unit
      if (unitFilter !== "ALL" && c.unitId !== unitFilter) return false;

      // 4.7 Bank Name
      if (bankFilter.trim()) {
        const query = bankFilter.trim().toLowerCase();
        if (!(c.bankName || "").toLowerCase().includes(query)) return false;
      }

      // 4.8 Cheque Number
      if (chequeNoFilter.trim()) {
        const query = chequeNoFilter.trim().toLowerCase();
        if (!(c.chequeNumber || "").toLowerCase().includes(query)) return false;
      }

      // 4.9 Status
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;

      return true;
    });
  }, [
    hasSearched,
    cheques,
    fromDate,
    toDate,
    contractFilter,
    ownerFilter,
    tenantFilter,
    propertyFilter,
    unitFilter,
    bankFilter,
    chequeNoFilter,
    statusFilter,
    leases,
    cases,
  ]);

  // 5. KPIs Calculations
  const stats = useMemo(() => {
    let totalCount = 0;
    let totalAmount = 0;
    let postDatedCount = 0;
    let postDatedAmount = 0;
    let depositedCount = 0;
    let depositedAmount = 0;
    let pendingCount = 0;
    let pendingAmount = 0;
    let replacementCount = 0;

    filteredCheques.forEach((c) => {
      const amt = Number(c.amount) || 0;
      totalCount++;
      totalAmount += amt;

      if (c.status === "POST_DATED") {
        postDatedCount++;
        postDatedAmount += amt;
      } else if (c.status === "DEPOSITED") {
        depositedCount++;
        depositedAmount += amt;
      } else if (c.status === "PENDING") {
        pendingCount++;
        pendingAmount += amt;
      }

      if (c.isReplacement || c.originalChequeId) {
        replacementCount++;
      }
    });

    return {
      totalCount,
      totalAmount,
      postDatedCount,
      postDatedAmount,
      depositedCount,
      depositedAmount,
      pendingCount,
      pendingAmount,
      replacementCount,
    };
  }, [filteredCheques]);

  // Status Badge Rendering
  const renderStatusBadge = (status: ChequeStatus) => {
    switch (status) {
      case "POST_DATED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3" />
            {isAr ? "شيك آجل" : "Post-Dated"}
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Clock className="w-3 h-3" />
            {isAr ? "قيد التحصيل" : "Pending"}
          </span>
        );
      case "DEPOSITED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            <Coins className="w-3 h-3" />
            {isAr ? "مودع بالبنك" : "Deposited"}
          </span>
        );
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  // Open Operation Modal
  const handleOpenOperation = (cheque: Cheque, op: PDCOperationType) => {
    // 1. Legal case protection check
    const caseCtrl = checkCaseControl(cheque);
    if (caseCtrl.isControlled) {
      alert(
        isAr
          ? `عذراً، هذا الشيك محجوز على ذمة القضية الإيجارية #${caseCtrl.caseNumber}. لا يمكن تنفيذ عمليات يدوية عليه إلا من داخل ملف القضية.`
          : `This cheque is locked under active legal case #${caseCtrl.caseNumber}. Manual operations must be handled from the legal case file.`
      );
      return;
    }

    // 2. Collection Route: use RecordPaymentModal
    if (op === "COLLECT") {
      if (cheque.outstanding <= 0) {
        alert(
          isAr
            ? "تم سداد كامل رصيد هذا الشيك مسبقاً."
            : "This cheque has already been fully paid."
        );
        return;
      }
      setCollectionCheque(cheque);
      return;
    }

    // 3. For Deposit, Clear, Bounce: Open Confirmation Modal
    setSelectedChequeForOp(cheque);
    setActiveOperation(op);
    setOpDate(new Date().toISOString().split("T")[0]);
    setOpBankName(cheque.bankName || "");
    setOpReference(
      op === "DEPOSIT"
        ? cheque.depositSlipNumber || ""
        : op === "CLEAR"
        ? cheque.clearingRef || ""
        : ""
    );
    setOpProofUrl(
      op === "DEPOSIT"
        ? cheque.depositProofUrl || ""
        : op === "CLEAR"
        ? cheque.clearingProofUrl || ""
        : ""
    );
    setOpProofFileName("");
    setOpNotes("");
    setOpReturnReason("INSUFFICIENT_FUNDS");
  };

  // Process uploaded attachment for cheque operation
  const processUploadedFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert(isAr ? "حجم الملف يجب ألا يتجاوز 10 ميجابايت." : "File size must not exceed 10MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setOpProofUrl(reader.result as string);
      setOpProofFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processUploadedFile(file);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processUploadedFile(file);
  };

  // Execute Confirmed Cheque Operation
  const handleConfirmOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChequeForOp || !activeOperation) return;

    setIsSubmittingOp(true);
    try {
      const chequeId = selectedChequeForOp.id;

      if (activeOperation === "DEPOSIT") {
        const res = await depositCheque({
          chequeId,
          depositedDate: opDate,
          depositSlipNumber: opReference.trim() || undefined,
          depositedBankName: opBankName.trim() || selectedChequeForOp.bankName || undefined,
          depositProofUrl: opProofUrl || undefined,
          notes: opNotes.trim() || undefined,
          userId: currentUser?.id,
          userName: currentUser?.nameAr || currentUser?.nameEn,
        });

        if (!res.success) {
          throw new Error(res.error || "Failed to update cheque status to DEPOSITED");
        }

        setActionNotice({
          type: "success",
          message: isAr
            ? `تم بنجاح إيداع الشيك رقم #${selectedChequeForOp.chequeNumber} في البنك وتوثيق حافظة الإيداع.`
            : `Cheque #${selectedChequeForOp.chequeNumber} successfully marked as DEPOSITED in bank.`,
        });
      } else if (activeOperation === "CLEAR") {
        if (!opReference.trim()) {
          throw new Error(
            isAr
              ? "يجب إدخال رقم المرجع المصرفي لعملية المقاصة البنكية."
              : "Bank transaction reference number is required to authorize CLEARED status."
          );
        }
        if (!opProofUrl) {
          throw new Error(
            isAr
              ? "يجب إرفاق إثبات المقاصة / التحصيل البنكي (صورة الإشعار أو الكشف المصرفي) لاعتماد الصرف."
              : "Bank clearing proof (Advice or Bank Statement slip) is strictly required to authorize CLEARED status."
          );
        }

        const res = await clearCheque({
          chequeId,
          clearingDate: opDate,
          clearingRef: opReference.trim() || undefined,
          clearingProofUrl: opProofUrl || undefined,
          notes: opNotes.trim() || undefined,
          userId: currentUser?.id,
          userName: currentUser?.nameAr || currentUser?.nameEn,
        });

        if (!res.success) {
          throw new Error(res.error || "Failed to update cheque status to CLEARED");
        }

        setActionNotice({
          type: "success",
          message: isAr
            ? `تم بنجاح تسجيل صرف وتسوية الشيك رقم #${selectedChequeForOp.chequeNumber} في الحساب البنكي وإقفال ذمته المالية.`
            : `Cheque #${selectedChequeForOp.chequeNumber} successfully CLEARED and lease installment reconciled.`,
        });
      } else if (activeOperation === "BOUNCED") {
        const reasonStr = isAr
          ? `شيك راجع: ${t(`reason_${opReturnReason}` as any) || opReturnReason}${
              opReference ? ` (إشعار الارتجاع: ${opReference})` : ""
            }${opNotes ? ` - ${opNotes}` : ""}`
          : `Bounced cheque: ${opReturnReason}${
              opReference ? ` (Slip: ${opReference})` : ""
            }${opNotes ? ` - ${opNotes}` : ""}`;

        const res = updateChequeStatus(
          chequeId,
          "BOUNCED",
          reasonStr,
          opDate,
          false,
          {
            returnReason: opReturnReason as any,
            bankBounceSlipNumber: opReference.trim() || undefined,
            bounceProofUrl: opProofUrl || undefined,
            reference: opReference.trim() || undefined,
            notes: opNotes.trim() || undefined,
          }
        );
        if (!res.success) {
          throw new Error(res.error || "Failed to mark cheque as BOUNCED");
        }

        setActionNotice({
          type: "success",
          message: isAr
            ? `تم قيد الشيك رقم #${selectedChequeForOp.chequeNumber} كشيك راجع (Bounced) وتمت مزامنة قسط العقد وتحويله لسجل الشيكات المرتجعة بنفس المعرف.`
            : `Cheque #${selectedChequeForOp.chequeNumber} recorded as BOUNCED, lease installment updated, and queued in Returned Cheques under same ID.`,
        });
      }

      // Close modal
      setSelectedChequeForOp(null);
      setActiveOperation(null);
      setOpProofUrl("");
      setOpProofFileName("");
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err: any) {
      alert(err.message || "An error occurred during cheque operation execution");
    } finally {
      setIsSubmittingOp(false);
    }
  };

  // Trigger Print Report
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {actionNotice && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-xs transition-all ${
            actionNotice.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
          }`}
        >
          <div className="flex items-center gap-3">
            {actionNotice.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="text-sm font-semibold">{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {isAr ? "الشيكات الآجلة (PDC Cheques Desk)" : "PDC Cheques Center"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAr
                  ? "مركز العمليات التشغيلية للشيكات الإيجارية المستحقة: الإيداع البنكي، الصرف والتسوية، الإرجاع، والتحصيل المباشر"
                  : "Central operational desk for rental cheques: bank deposits, clearance settlements, bounce logging, and collections"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasSearched && (
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>{isAr ? "طباعة التقرير" : "Print Report"}</span>
            </button>
          )}

          {onNavigateToReturnedCheques && (
            <button
              onClick={onNavigateToReturnedCheques}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{isAr ? "سجل الشيكات المرتجعة" : "Returned Cheques"}</span>
            </button>
          )}

          {onNavigateToAllCheques && (
            <button
              onClick={onNavigateToAllCheques}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Layers className="w-4 h-4 text-slate-500" />
              <span>{isAr ? "الاستعلام الشامل" : "All Cheques"}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Overview (Shown when searched) */}
      {hasSearched && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
          {/* Total Actionable */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {isAr ? "إجمالي الشيكات التشغيلية" : "Total Operational Cheques"}
              </span>
              <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg">
                <Hash className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {stats.totalCount}{" "}
                <span className="text-xs font-normal text-slate-500">
                  {isAr ? "شيك" : "cheques"}
                </span>
              </div>
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                {formatAED(stats.totalAmount)}
              </div>
            </div>
          </div>

          {/* Post-Dated */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                {isAr ? "شيكات آجلة (لم تستحق)" : "Post-Dated Cheques"}
              </span>
              <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-lg">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {stats.postDatedCount}{" "}
                <span className="text-xs font-normal text-slate-500">
                  {isAr ? "شيك" : "cheques"}
                </span>
              </div>
              <div className="text-xs font-semibold text-amber-600 mt-1">
                {formatAED(stats.postDatedAmount)}
              </div>
            </div>
          </div>

          {/* Deposited in Bank */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                {isAr ? "المودعة بالمصرف (مقاصة)" : "Deposited (Under Clearing)"}
              </span>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-lg">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {stats.depositedCount}{" "}
                <span className="text-xs font-normal text-slate-500">
                  {isAr ? "شيك" : "cheques"}
                </span>
              </div>
              <div className="text-xs font-semibold text-indigo-600 mt-1">
                {formatAED(stats.depositedAmount)}
              </div>
            </div>
          </div>

          {/* Replacement Cheques Highlight */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                {isAr ? "شيكات مستبدلة (بديلة)" : "Replacement Cheques"}
              </span>
              <div className="p-2 bg-teal-50 dark:bg-teal-950/40 text-teal-600 rounded-lg">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {stats.replacementCount}{" "}
                <span className="text-xs font-normal text-slate-500">
                  {isAr ? "شيك" : "cheques"}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {isAr ? "تحتوي على رابط بالشيك الأصلي" : "Linked to original bounced/replaced"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Filters Section */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-3">
          <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold text-sm">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>{isAr ? "معايير البحث والتصفية" : "Search & Filter Criteria"}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Action: Current Month Button */}
            <button
              type="button"
              onClick={handleSetCurrentMonth}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{isAr ? "الشهر الحالي" : "Current Month"}</span>
            </button>

            {/* Reset Button */}
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isAr ? "إعادة تعيين" : "Reset"}</span>
            </button>

            {/* Primary Search Button */}
            <button
              type="button"
              onClick={handleSearch}
              className="px-5 py-1.5 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{isAr ? "بحث" : "Search"}</span>
            </button>
          </div>
        </div>

        {/* Row 1: Date Range & Text Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* From Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? "من تاريخ استحقاق" : "Due From Date"}
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 rtl:right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full pl-9 pr-3 rtl:pr-9 rtl:pl-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* To Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? "إلى تاريخ استحقاق" : "Due To Date"}
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 rtl:right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full pl-9 pr-3 rtl:pr-9 rtl:pl-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Contract Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? "رقم العقد (Contract No.)" : "Contract Number"}
            </label>
            <div className="relative">
              <FileSpreadsheet className="w-4 h-4 text-slate-400 absolute left-3 rtl:right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={isAr ? "ابحث برقم العقد..." : "Filter contract no..."}
                value={contractFilter}
                onChange={(e) => setContractFilter(e.target.value)}
                className="w-full pl-9 pr-3 rtl:pr-9 rtl:pl-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Cheque Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? "رقم الشيك (Cheque No.)" : "Cheque Number"}
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 text-slate-400 absolute left-3 rtl:right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={isAr ? "ابحث برقم الشيك..." : "Filter cheque no..."}
                value={chequeNoFilter}
                onChange={(e) => setChequeNoFilter(e.target.value)}
                className="w-full pl-9 pr-3 rtl:pr-9 rtl:pl-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Row 2: Searchable Comboboxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Owner Filter */}
          <div>
            <SearchableSelect
              label={isAr ? "مالك العقار (Property Owner)" : "Property Owner"}
              options={ownerOptions}
              value={ownerFilter}
              onChange={(val) => setOwnerFilter(val)}
              searchPlaceholder={isAr ? "ابحث عن مالك..." : "Search owner..."}
            />
          </div>

          {/* Tenant Filter */}
          <div>
            <SearchableSelect
              label={isAr ? "المستأجر (Tenant)" : "Tenant"}
              options={tenantOptions}
              value={tenantFilter}
              onChange={(val) => setTenantFilter(val)}
              searchPlaceholder={isAr ? "ابحث عن مستأجر..." : "Search tenant..."}
            />
          </div>

          {/* Property */}
          <div>
            <SearchableSelect
              label={isAr ? "العقار (Property)" : "Property"}
              options={propertyOptions}
              value={propertyFilter}
              onChange={(val) => {
                setPropertyFilter(val);
                setUnitFilter("ALL");
              }}
              searchPlaceholder={isAr ? "ابحث عن عقار..." : "Search property..."}
            />
          </div>

          {/* Cheque Status */}
          <div>
            <SearchableSelect
              label={isAr ? "حالة الشيك التشغيلية" : "Operational Status"}
              options={statusOptions}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              searchPlaceholder={isAr ? "اختر الحالة..." : "Select status..."}
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {!hasSearched ? (
        /* Empty State on initial open */
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100 dark:border-emerald-800">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
            {isAr
              ? "ابدأ بتحديد معايير البحث أو عرض شيكات الشهر الحالي"
              : "Specify Search Criteria or View Current Month"}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
            {isAr
              ? "تعرض هذه الشاشة الشيكات الإيجارية الآجلة والمودعة الجاهزة للعمليات المصرفية والتنفيذية. انقر على (الشهر الحالي) أو اضغط (بحث)."
              : "This desk displays actionable rental cheques ready for deposit, clearing, and collection operations."}
          </p>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleSetCurrentMonth}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              <span>{isAr ? "عرض شيكات الشهر الحالي" : "View Current Month Cheques"}</span>
            </button>
            <button
              onClick={handleSearch}
              className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>{isAr ? "بحث بجميع التواريخ" : "Search All Dates"}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Data Grid / Continuous Form Section */
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden print:border-none print:shadow-none">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-slate-900 dark:text-white">
                {isAr ? "جدول الشيكات الآجلة والعمليات" : "PDC Cheques Register"}
              </span>
              <span className="px-2 py-0.5 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-full">
                {filteredCheques.length} {isAr ? "شيك متاح" : "actionable cheques"}
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={isAr ? "بحث سريع باسم البنك..." : "Filter by bank name..."}
                  value={bankFilter}
                  onChange={(e) => setBankFilter(e.target.value)}
                  className="w-full pl-9 pr-3 rtl:pr-9 rtl:pl-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Printable Report Header */}
          <div className="hidden print:block p-6 border-b border-slate-300 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {companyProfile.logoUrl || companyProfile.logoBase64 || companyProfile.logo ? (
                  <div className="w-14 h-14 rounded-xl border border-slate-200 overflow-hidden shrink-0 bg-white flex items-center justify-center p-1 shadow-xs">
                    <img
                      src={companyProfile.logoUrl || companyProfile.logoBase64 || companyProfile.logo}
                      alt="Office Logo"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : null}
                <div>
                  <h1 className="text-xl font-black text-slate-900">
                    {companyProfile.nameAr || "صقر الإمارات للعقارات"}
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {companyProfile.nameEn || "SAQR EMIRATES REAL ESTATE LLC"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    TRN: {companyProfile.vatTrn || "100234567800003"} | {companyProfile.phone || "+971 6 555 1234"}
                  </p>
                </div>
              </div>
              <div className="text-left rtl:text-right shrink-0">
                <h2 className="text-base font-bold text-slate-900">
                  تقرير الشيكات الآجلة والعمليات المصرفية
                </h2>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">
                  PDC Cheques & Operational Clearance Report
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {isAr ? "تاريخ التقرير" : "Report Date"}: {new Date().toLocaleDateString(isAr ? "ar-AE" : "en-GB")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-lg text-xs border border-slate-200">
              <div>
                <span className="font-bold">{isAr ? "الفترة من" : "From"}: </span>
                {formatDateForUI(fromDate)}
              </div>
              <div>
                <span className="font-bold">{isAr ? "إلى" : "To"}: </span>
                {formatDateForUI(toDate)}
              </div>
              <div>
                <span className="font-bold">{isAr ? "إجمالي الشيكات" : "Total Cheques"}: </span>
                {stats.totalCount} ({formatAED(stats.totalAmount)})
              </div>
            </div>
          </div>

          {/* Continuous Form Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "رقم العقد" : "Contract No."}</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "مالك العقار" : "Property Owner"}</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "العقار / الوحدة" : "Property / Unit"}</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "المستأجر" : "Tenant"}</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "بنك الشيك" : "Bank"}</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "رقم الشيك" : "Cheque No."}</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "تاريخ الاستحقاق" : "Due Date"}</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "مبلغ الشيك" : "Amount"}</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "الرصيد المستحق" : "Outstanding"}</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "حالة الشيك" : "Status"}</th>
                  <th className="py-3 px-3.5 whitespace-nowrap text-center print:hidden">{isAr ? "العمليات المصرحة" : "Authorized Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredCheques.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="py-12 text-center text-slate-400 dark:text-slate-500 font-medium"
                    >
                      <CreditCard className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2 stroke-[1.5]" />
                      {isAr
                        ? "لا توجد شيكات آجلة مطابقة لمعايير البحث والتاريخ المحددة."
                        : "No actionable PDC cheques found matching the specified criteria."}
                    </td>
                  </tr>
                ) : (
                  filteredCheques.map((chq) => {
                    const lease = leases.find((l) => l.id === chq.leaseId);
                    const owner = owners.find((o) => o.id === chq.ownerId);
                    const tenant = tenants.find((t) => t.id === chq.tenantId);
                    const prop = properties.find((p) => p.id === chq.propertyId);
                    const unit = units.find((u) => u.id === chq.unitId);

                    const isReplacement = chq.isReplacement || !!chq.originalChequeId;

                    // Allowed operations
                    const isDepositAllowed = chq.status === "POST_DATED" || chq.status === "PENDING";
                    const isClearAllowed = chq.status === "DEPOSITED" || chq.status === "PENDING";
                    const isCollectAllowed = chq.outstanding > 0;
                    const isBounceAllowed = true;

                    return (
                      <tr
                        key={chq.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition"
                      >
                        {/* 1. Contract No. */}
                        <td className="py-3 px-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          <span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md text-xs">
                            {lease?.leaseNumber || chq.leaseId || "—"}
                          </span>
                        </td>

                        {/* 2. Property Owner */}
                        <td className="py-3 px-3.5 text-slate-700 dark:text-slate-200 whitespace-nowrap font-medium">
                          {owner ? (isAr ? owner.nameAr : owner.nameEn) : "—"}
                        </td>

                        {/* 3. Property / Unit */}
                        <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <div className="font-semibold text-slate-800 dark:text-slate-100">
                            {prop ? (isAr ? prop.nameAr : prop.nameEn) : "—"}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {unit
                              ? `${isAr ? "وحدة" : "Unit"} #${unit.unitNumber}`
                              : "—"}
                          </div>
                        </td>

                        {/* 4. Tenant */}
                        <td className="py-3 px-3.5 text-slate-800 dark:text-slate-100 whitespace-nowrap font-semibold">
                          {tenant ? (isAr ? tenant.nameAr : tenant.nameEn) : "—"}
                        </td>

                        {/* 5. Cheque Bank */}
                        <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium">
                          {chq.bankName || "—"}
                        </td>

                        {/* 6. Cheque No. & Replacement Badge */}
                        <td className="py-3 px-3.5 text-slate-900 dark:text-white whitespace-nowrap font-mono font-bold">
                          <div className="flex items-center gap-1.5">
                            <span>#{chq.chequeNumber}</span>
                            {isReplacement && (
                              <button
                                type="button"
                                onClick={() => setReplacementInfoCheque(chq)}
                                title={isAr ? "انقر لعرض بيانات الشيك الأصلي المستبدل" : "Click to view original replaced cheque details"}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-200 transition cursor-pointer"
                              >
                                <ArrowRightLeft className="w-2.5 h-2.5" />
                                <span>{isAr ? "بديل" : "Repl"}</span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 7. Due Date */}
                        <td className="py-3 px-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap font-medium">
                          {formatDateForUI(chq.dueDate)}
                        </td>

                        {/* 8. Cheque Amount */}
                        <td className="py-3 px-3.5 text-slate-900 dark:text-white whitespace-nowrap font-bold font-mono text-xs">
                          {formatAED(chq.amount)}
                        </td>

                        {/* 9. Outstanding */}
                        <td className="py-3 px-3.5 whitespace-nowrap font-bold font-mono text-xs">
                          <span
                            className={
                              (chq.outstanding ?? chq.amount) > 0
                                ? "text-rose-600 dark:text-rose-400 font-bold"
                                : "text-emerald-600 dark:text-emerald-400 font-bold"
                            }
                          >
                            {formatAED(chq.outstanding ?? chq.amount)}
                          </span>
                        </td>

                        {/* 10. Cheque Status */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div>
                            {renderStatusBadge(chq.status)}
                            {chq.status === "DEPOSITED" && (
                              <div className="mt-1 space-y-0.5 text-[10px] text-slate-500">
                                {chq.depositedDate && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                                    <span>{formatDateForUI(chq.depositedDate)}</span>
                                  </div>
                                )}
                                {chq.depositSlipNumber && (
                                  <div className="font-mono font-semibold text-indigo-700 dark:text-indigo-300">
                                    {isAr ? "حافظة:" : "Slip:"} #{chq.depositSlipNumber}
                                  </div>
                                )}
                                {chq.depositProofUrl && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setViewingProof({
                                        title: isAr
                                          ? `حافظة إيداع الشيك #${chq.chequeNumber}`
                                          : `Deposit Slip Proof #${chq.chequeNumber}`,
                                        url: chq.depositProofUrl!,
                                        fileName: `Deposit_Slip_${chq.chequeNumber}.png`,
                                      })
                                    }
                                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-bold hover:underline cursor-pointer pt-0.5"
                                  >
                                    <Eye className="w-2.5 h-2.5" />
                                    <span>{isAr ? "عرض الحافظة" : "View Slip"}</span>
                                  </button>
                                )}
                              </div>
                            )}
                            {chq.status === "CLEARED" && (
                              <div className="mt-1 space-y-0.5 text-[10px] text-slate-500">
                                {chq.clearingDate && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                                    <span>{formatDateForUI(chq.clearingDate)}</span>
                                  </div>
                                )}
                                {chq.clearingRef && (
                                  <div className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                                    {isAr ? "مرجع:" : "Ref:"} {chq.clearingRef}
                                  </div>
                                )}
                                {chq.clearingProofUrl && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setViewingProof({
                                        title: isAr
                                          ? `إشعار مقاصة الشيك #${chq.chequeNumber}`
                                          : `Clearing Settlement Proof #${chq.chequeNumber}`,
                                        url: chq.clearingProofUrl!,
                                        fileName: `Clearing_Proof_${chq.chequeNumber}.png`,
                                      })
                                    }
                                    className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 font-bold hover:underline cursor-pointer pt-0.5"
                                  >
                                    <Eye className="w-2.5 h-2.5" />
                                    <span>{isAr ? "عرض الإشعار" : "View Proof"}</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 10. Action Column */}
                        <td className="py-3 px-3.5 text-center whitespace-nowrap print:hidden">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Deposit Button */}
                            {isDepositAllowed && (
                              <button
                                onClick={() => handleOpenOperation(chq, "DEPOSIT")}
                                title={isAr ? "إيداع الشيك في البنك وتوثيق الحافظة" : "Deposit in Bank & Record Slip"}
                                className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-600 dark:hover:text-white rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-800 transition flex items-center gap-1 cursor-pointer"
                              >
                                <Coins className="w-3 h-3" />
                                <span>{isAr ? "إيداع" : "Deposit"}</span>
                              </button>
                            )}

                            {/* Clear / Cash Button */}
                            {isClearAllowed && (
                              <button
                                onClick={() => handleOpenOperation(chq, "CLEAR")}
                                title={isAr ? "تسوية وصرف الشيك بنكياً وإقفال الذمة" : "Clear in Bank & Reconcile Installment"}
                                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white rounded-lg text-xs font-bold border border-emerald-200 dark:border-emerald-800 transition flex items-center gap-1 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{isAr ? "صرف" : "Clear"}</span>
                              </button>
                            )}

                            {/* Collect Button */}
                            {isCollectAllowed && (
                              <button
                                onClick={() => handleOpenOperation(chq, "COLLECT")}
                                title={isAr ? "تحصيل وإصدار سند قبض" : "Collect with Receipt Voucher"}
                                className="px-2.5 py-1 bg-teal-50 text-teal-700 hover:bg-teal-600 hover:text-white dark:bg-teal-950/50 dark:text-teal-300 dark:hover:bg-teal-600 dark:hover:text-white rounded-lg text-xs font-bold border border-teal-200 dark:border-teal-800 transition flex items-center gap-1 cursor-pointer"
                              >
                                <Receipt className="w-3 h-3" />
                                <span>{isAr ? "تحصيل" : "Collect"}</span>
                              </button>
                            )}

                            {/* Bounce / Return Button */}
                            {isBounceAllowed && (
                              <button
                                onClick={() => handleOpenOperation(chq, "BOUNCED")}
                                title={isAr ? "تسجيل الشيك كراجع (Bounced) ونقله للشيكات المرتجعة" : "Mark as Bounced & Move to Returned"}
                                className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-600 dark:hover:text-white rounded-lg text-xs font-bold border border-rose-200 dark:border-rose-800 transition flex items-center gap-1 cursor-pointer"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                <span>{isAr ? "إرجاع" : "Return"}</span>
                              </button>
                            )}

                            {/* Replace Button */}
                            <button
                              onClick={() => setReplacingCheque(chq)}
                              title={isAr ? "استبدال الشيك بشيك جديد" : "Replace Cheque"}
                              className="p-1 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition cursor-pointer"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>

                            {/* Cheque Audit History */}
                            <button
                              type="button"
                              onClick={() => setViewingAuditCheque(chq)}
                              title={isAr ? "سجل تتبع وتدقيق حركة الشيك" : "View Cheque Audit Trail"}
                              className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition cursor-pointer"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Summary in Print */}
          <div className="hidden print:block p-6 border-t border-slate-300 mt-6">
            <div className="grid grid-cols-2 gap-8 text-xs">
              <div className="space-y-6">
                <div>
                  <span className="font-bold">{isAr ? "المحاسب المسؤول" : "Accountant"}: </span>
                  <span>{currentUser?.nameAr || currentUser?.nameEn || "System Admin"}</span>
                </div>
                <div className="pt-8 border-b border-slate-300 w-48"></div>
                <div className="text-slate-400">{isAr ? "التوقيع والختم" : "Signature"}</div>
              </div>
              <div className="space-y-6 text-left rtl:text-right">
                <div>
                  <span className="font-bold">{isAr ? "اعتماد المدير المالي" : "Finance Manager Approval"}: </span>
                </div>
                <div className="pt-8 border-b border-slate-300 w-48 mr-auto rtl:mr-0 rtl:ml-auto"></div>
                <div className="text-slate-400">{isAr ? "التوقيع والاعتماد" : "Approval Signature"}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Deposit, Clear, Return / Bounce */}
      {selectedChequeForOp && activeOperation && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!isSubmittingOp) {
              setSelectedChequeForOp(null);
              setActiveOperation(null);
            }
          }}
          title={
            activeOperation === "DEPOSIT"
              ? isAr
                ? "إيداع الشيك في البنك (Bank Deposit)"
                : "Bank Deposit Action"
              : activeOperation === "CLEAR"
              ? isAr
                ? "صرف وتسوية الشيك بنكياً (Cheque Clearance)"
                : "Bank Clearance Action"
              : isAr
              ? "تسجيل ارتجاع الشيك (Cheque Return / Bounce)"
              : "Cheque Bounce Logging"
          }
        >
          <form onSubmit={handleConfirmOperation} className="space-y-4">
            {/* Action Banner */}
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                activeOperation === "DEPOSIT"
                  ? "bg-indigo-50 border-indigo-200 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
                  : activeOperation === "CLEAR"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
              }`}
            >
              {activeOperation === "DEPOSIT" ? (
                <Coins className="w-5 h-5 shrink-0 text-indigo-600 mt-0.5" />
              ) : activeOperation === "CLEAR" ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              )}
              <div className="text-xs">
                <div className="font-bold text-sm">
                  {activeOperation === "DEPOSIT"
                    ? isAr
                      ? "عملية إيداع بنكي للشيك"
                      : "Bank Deposit Operation"
                    : activeOperation === "CLEAR"
                    ? isAr
                      ? "عملية صرف وتسوية الشيك في الحساب"
                      : "Bank Clearance & Account Credit"
                    : isAr
                    ? "عملية تسجيل الشيك كشيك مرتجع"
                    : "Cheque Return / Bounce"}
                </div>
                <div className="mt-0.5 opacity-90">
                  {activeOperation === "DEPOSIT"
                    ? isAr
                      ? "سيتم تغيير حالة الشيك إلى (مودع بالبنك DEPOSITED) وإثباته تحت المقاصة البنكية."
                      : "Cheque status will be set to DEPOSITED under bank clearing."
                    : activeOperation === "CLEAR"
                    ? isAr
                      ? "سيتم تغيير حالة الشيك إلى (مصروف CLEARED) وإقفال ذمته المالية وتسوية قسط العقد."
                      : "Cheque status will be set to CLEARED and lease installment reconciled."
                    : isAr
                    ? "سيتم قيد الشيك كمرتجع (BOUNCED)، ومزامنة قسط العقد لمرتجع، وتحويله تلقائياً لسجل الشيكات المرتجعة بنفس المعرف."
                    : "Cheque will be set to BOUNCED, lease installment updated, and queued in Returned Cheques under the exact same ID."}
                </div>
              </div>
            </div>

            {/* Read-only Cheque Details Card */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">
              <div className="font-black text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700/60 pb-2 flex items-center justify-between">
                <span>{isAr ? "بيانات الشيك الأصلي" : "Original Cheque Details"}</span>
                <span className="font-mono text-slate-500">ID: {selectedChequeForOp.id}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <span className="text-slate-500 block">{isAr ? "رقم العقد" : "Contract #"}:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {leases.find((l) => l.id === selectedChequeForOp.leaseId)?.leaseNumber || selectedChequeForOp.leaseId || "—"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">{isAr ? "رقم الشيك" : "Cheque #"}:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                    #{selectedChequeForOp.chequeNumber}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">{isAr ? "المصرف" : "Bank"}:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedChequeForOp.bankName || "—"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">{isAr ? "تاريخ الاستحقاق" : "Due Date"}:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {formatDateForUI(selectedChequeForOp.dueDate)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">{isAr ? "مبلغ الشيك" : "Amount"}:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatAED(selectedChequeForOp.amount)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">{isAr ? "الحالة الحالية" : "Current Status"}:</span>
                  <span className="font-bold">{selectedChequeForOp.status}</span>
                </div>
              </div>
            </div>

            {/* Operation Inputs */}
            <div className="space-y-3">
              {/* Bank Selection / Input for Deposit */}
              {activeOperation === "DEPOSIT" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? "البنك المودع لديه *" : "Deposited Bank Name *"}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isAr ? "مثال: بنك دبي الإسلامي / بنك أبوظبي التجاري" : "e.g. Dubai Islamic Bank / ADCB"}
                    value={opBankName}
                    onChange={(e) => setOpBankName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              )}

              {/* Date Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {activeOperation === "DEPOSIT"
                    ? isAr
                      ? "تاريخ الإيداع البنكي *"
                      : "Bank Deposit Date *"
                    : activeOperation === "CLEAR"
                    ? isAr
                      ? "تاريخ الصرف والتسوية *"
                      : "Clearance Settlement Date *"
                    : isAr
                    ? "تاريخ الارتجاع البنكي *"
                    : "Return Date *"}
                </label>
                <input
                  type="date"
                  required
                  value={opDate}
                  onChange={(e) => setOpDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Bounce Specific: Return Reason Dropdown */}
              {activeOperation === "BOUNCED" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? "سبب الارتجاع البنكي *" : "Bank Return Reason *"}
                  </label>
                  <select
                    required
                    value={opReturnReason}
                    onChange={(e) => setOpReturnReason(e.target.value as ReturnReason)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  >
                    <option value="INSUFFICIENT_FUNDS">
                      {isAr ? "عدم كفاية الرصيد (Insufficient Funds)" : "Insufficient Funds"}
                    </option>
                    <option value="SIGNATURE_MISMATCH">
                      {isAr ? "عدم مطابقة التوقيع (Signature Mismatch)" : "Signature Mismatch"}
                    </option>
                    <option value="ACCOUNT_CLOSED">
                      {isAr ? "الحساب مغلق (Account Closed)" : "Account Closed"}
                    </option>
                    <option value="REFER_TO_DRAWER">
                      {isAr ? "الرجوع للساحب (Refer to Drawer)" : "Refer to Drawer"}
                    </option>
                    <option value="PAYMENT_STOPPED">
                      {isAr ? "إيقاف صرف الشيك (Payment Stopped)" : "Payment Stopped"}
                    </option>
                    <option value="POST_DATED_ERROR">
                      {isAr ? "خطأ في تاريخ الاستحقاق (Post Dated Error)" : "Post Dated Error"}
                    </option>
                    <option value="IRREGULAR_ENDORSEMENT">
                      {isAr ? "تظهير غير نظامي (Irregular Endorsement)" : "Irregular Endorsement"}
                    </option>
                    <option value="OTHER">
                      {isAr ? "أسباب مصرفية أخرى (Other)" : "Other Bank Return Reasons"}
                    </option>
                  </select>
                </div>
              )}

              {/* Reference Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {activeOperation === "DEPOSIT"
                    ? isAr
                      ? "رقم حافظة الإيداع / إشعار البنك"
                      : "Deposit Slip / Bank Receipt No."
                    : activeOperation === "CLEAR"
                    ? isAr
                      ? "رقم المرجع المصرفي لعملية المقاصة"
                      : "Bank Clearing Reference No."
                    : isAr
                    ? "رقم إشعار الارتجاع البنكي"
                    : "Bounce Slip No."}
                </label>
                <input
                  type="text"
                  placeholder={
                    activeOperation === "DEPOSIT"
                      ? isAr
                        ? "مثل: SLIP-2026-8834"
                        : "e.g. SLIP-2026-8834"
                      : activeOperation === "CLEAR"
                      ? isAr
                        ? "مثل: TXN-CLR-992384"
                        : "e.g. TXN-CLR-992384"
                      : isAr
                      ? "اختياري — مثل: BNC-1122"
                      : "Optional — e.g. BNC-1122"
                  }
                  value={opReference}
                  onChange={(e) => setOpReference(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Attachment / Proof of Deposit, Clearance or Bounce */}
              {(activeOperation === "DEPOSIT" || activeOperation === "CLEAR" || activeOperation === "BOUNCED") && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {activeOperation === "DEPOSIT"
                      ? isAr
                        ? "إرفاق صورة إشعار أو حافظة الإيداع البنكي"
                        : "Attach Deposit Slip Proof"
                      : activeOperation === "CLEAR"
                      ? isAr
                        ? "إرفاق إشعار المقاصة البنكية / الكشف *"
                        : "Attach Clearing Proof / Bank Advice *"
                      : isAr
                      ? "إرفاق إشعار أو وثيقة الارتجاع البنكي"
                      : "Attach Bank Bounce Notice / Proof"}
                  </label>

                  {opProofUrl ? (
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="truncate">
                          {opProofFileName || (isAr ? "مرفق العملية الموثق" : "Attached Proof Document")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setViewingProof({
                              title: isAr ? "معاينة المرفق المرفوع" : "Uploaded Proof Preview",
                              url: opProofUrl,
                              fileName: opProofFileName,
                            })
                          }
                          className="p-1 text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 cursor-pointer"
                          title={isAr ? "معاينة" : "Preview"}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpProofUrl("");
                            setOpProofFileName("");
                          }}
                          className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                          title={isAr ? "حذف المرفق" : "Remove"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingFile(true);
                      }}
                      onDragLeave={() => setIsDraggingFile(false)}
                      onDrop={handleFileDrop}
                      className={`border-2 border-dashed rounded-xl p-4 text-center transition cursor-pointer ${
                        isDraggingFile
                          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20"
                          : "border-slate-300 dark:border-slate-700 hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-900/30"
                      }`}
                      onClick={() => {
                        const inputEl = document.getElementById("pdc-proof-upload-input");
                        if (inputEl) inputEl.click();
                      }}
                    >
                      <input
                        id="pdc-proof-upload-input"
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={handleFileInputChange}
                      />
                      <Upload className="w-6 h-6 mx-auto text-slate-400 mb-1" />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {isAr
                          ? "اسحب وأفلت صورة الحافظة هنا، أو انقر للاختيار"
                          : "Drag & drop proof document here, or click to browse"}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {isAr ? "PNG, JPG, PDF (بحد أقصى 10MB)" : "PNG, JPG, PDF (Up to 10MB)"}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "ملاحظات إضافية" : "Additional Notes"}
                </label>
                <textarea
                  rows={2}
                  placeholder={isAr ? "أدخل أي تفاصيل إضافية للتوثيق..." : "Enter documentation notes..."}
                  value={opNotes}
                  onChange={(e) => setOpNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                disabled={isSubmittingOp}
                onClick={() => {
                  setSelectedChequeForOp(null);
                  setActiveOperation(null);
                  setOpProofUrl("");
                  setOpProofFileName("");
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>

              <button
                type="submit"
                disabled={isSubmittingOp}
                className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer ${
                  activeOperation === "DEPOSIT"
                    ? "bg-indigo-600 hover:bg-indigo-700"
                    : activeOperation === "CLEAR"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {isSubmittingOp ? (
                  <span>{isAr ? "جاري الحفظ..." : "Processing..."}</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>
                      {isAr
                        ? "تأكيد وتنفيذ العملية"
                        : "Confirm & Execute Action"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Replacement Cheque Details Popover Modal */}
      {replacementInfoCheque && (
        <Modal
          isOpen={true}
          onClose={() => setReplacementInfoCheque(null)}
          title={isAr ? "تفاصيل الشيك المستبدل (Replacement Link)" : "Replacement Cheque Trail"}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                <ArrowRightLeft className="w-4 h-4" />
                <span>
                  {isAr
                    ? `الشيك البديل رقم #${replacementInfoCheque.chequeNumber}`
                    : `Replacement Cheque #${replacementInfoCheque.chequeNumber}`}
                </span>
              </div>
              <p className="text-amber-700 dark:text-amber-400">
                {isAr
                  ? "تم إصدار هذا الشيك كبديل رسمي لنقل الالتزام المالي دون ازدواجية في مديونية العقد."
                  : "Issued as an authoritative replacement instrument safeguarding lease balance."}
              </p>
            </div>

            {/* Original Cheque Info */}
            {(() => {
              const orig = cheques.find(
                (c) => c.id === replacementInfoCheque.originalChequeId
              );
              return (
                <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block border-b border-slate-200 dark:border-slate-700 pb-1.5">
                    {isAr ? "بيانات الشيك الأصلي الذي تم استبداله:" : "Original Replaced Cheque:"}
                  </span>
                  {orig ? (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-slate-400 block">{isAr ? "رقم الشيك الأصلي" : "Original Cheque #"}:</span>
                        <span className="font-bold font-mono text-slate-800 dark:text-slate-200">#{orig.chequeNumber}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{isAr ? "المصرف" : "Bank"}:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{orig.bankName || "—"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{isAr ? "المبلغ الأصلي" : "Original Amount"}:</span>
                        <span className="font-bold font-mono text-emerald-600">{formatAED(orig.amount)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{isAr ? "حالة الشيك الأصلي" : "Original Status"}:</span>
                        <span className="font-bold">{orig.status}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-500">
                      {isAr ? "معرف الشيك الأصلي:" : "Original Cheque ID:"}{" "}
                      <span className="font-mono">{replacementInfoCheque.originalChequeId || "—"}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Reason & Date */}
            <div className="space-y-2">
              <div>
                <span className="text-slate-400 block">{isAr ? "سبب وتفاصيل الاستبدال" : "Replacement Reason"}:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {replacementInfoCheque.replacementReason || "—"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block">{isAr ? "تاريخ الاستبدال" : "Replacement Date"}:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatDateForUI(replacementInfoCheque.replacementDate)}
                  </span>
                </div>
                {replacementInfoCheque.replacementGroupId && (
                  <div>
                    <span className="text-slate-400 block">{isAr ? "معرف حزمة الاستبدال" : "Replacement Group ID"}:</span>
                    <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                      {replacementInfoCheque.replacementGroupId}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Sibling replacement cheques in the same group */}
            {(() => {
              const siblings = replacementInfoCheque.replacementGroupId
                ? cheques.filter(
                    (c) =>
                      c.replacementGroupId === replacementInfoCheque.replacementGroupId &&
                      c.id !== replacementInfoCheque.id
                  )
                : [];
              if (siblings.length === 0) return null;
              return (
                <div className="bg-indigo-50/50 dark:bg-indigo-950/30 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800/40 space-y-1.5">
                  <span className="font-bold text-xs text-indigo-900 dark:text-indigo-200 block">
                    {isAr ? "الشيكات البديلة الأخرى الصادرة في نفس الحزمة:" : "Other replacement cheques in this group:"}
                  </span>
                  <div className="space-y-1">
                    {siblings.map((sib) => (
                      <div
                        key={sib.id}
                        className="flex items-center justify-between text-xs py-1 px-2 bg-white dark:bg-slate-800 rounded-lg border border-indigo-100 dark:border-indigo-900"
                      >
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          #{sib.chequeNumber}
                        </span>
                        <span className="font-mono font-bold text-emerald-600">
                          {formatAED(sib.amount)}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          {formatDateForUI(sib.dueDate)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                type="button"
                onClick={() => setReplacementInfoCheque(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-xl text-slate-700 dark:text-slate-200 font-bold"
              >
                {isAr ? "إغلاق" : "Close"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Replace Cheque Modal */}
      {replacingCheque && (
        <ReplaceChequeModal
          originalCheque={replacingCheque}
          isOpen={true}
          onClose={() => setReplacingCheque(null)}
          onSuccess={() => {
            setActionNotice({
              type: "success",
              message: isAr
                ? "تم بنجاح استبدال الشيك وإنشاء الشيكات البديلة الجديدة."
                : "Cheque successfully replaced and new replacement cheque(s) created.",
            });
          }}
        />
      )}

      {/* Cross-View Record Payment Modal for PDC Collection */}
      <RecordPaymentModal
        isOpen={!!collectionCheque}
        onClose={() => setCollectionCheque(null)}
        cheque={collectionCheque}
        onPaymentSuccess={(rcp) => {
          setCollectionCheque(null);
          setIssuedReceipt(rcp);
          setActionNotice({
            type: "success",
            message: isAr
              ? `تم بنجاح تحصيل الشيك وإصدار سند القبض رقم #${rcp.receiptNumber}.`
              : `Cheque collected successfully and receipt voucher #${rcp.receiptNumber} issued.`,
          });
        }}
      />

      {/* Cross-View Receipt Voucher Modal */}
      <ReceiptVoucherModal
        isOpen={!!issuedReceipt}
        onClose={() => setIssuedReceipt(null)}
        receipt={issuedReceipt}
      />

      {/* Attachment / Proof Viewer Modal */}
      {viewingProof && (
        <Modal
          isOpen={true}
          onClose={() => setViewingProof(null)}
          title={viewingProof.title}
        >
          <div className="space-y-4">
            <div className="max-h-[60vh] overflow-auto flex items-center justify-center bg-slate-900/5 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
              {viewingProof.url.startsWith("data:application/pdf") ? (
                <iframe
                  src={viewingProof.url}
                  className="w-full h-96 rounded-lg border-0"
                  title="PDF Document Viewer"
                />
              ) : (
                <img
                  src={viewingProof.url}
                  alt={viewingProof.title}
                  className="max-h-[50vh] max-w-full object-contain rounded-lg shadow-xs"
                />
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
              <a
                href={viewingProof.url}
                download={viewingProof.fileName || "proof-document"}
                className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 rotate-180" />
                <span>{isAr ? "تحميل المرفق" : "Download File"}</span>
              </a>

              <button
                type="button"
                onClick={() => setViewingProof(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                {isAr ? "إغلاق" : "Close"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cheque Lifecycle Audit Trail Modal */}
      {viewingAuditCheque && (
        <Modal
          isOpen={true}
          onClose={() => setViewingAuditCheque(null)}
          title={
            isAr
              ? `سجل التدقيق والتتبع — الشيك #${viewingAuditCheque.chequeNumber}`
              : `Audit Trail — Cheque #${viewingAuditCheque.chequeNumber}`
          }
        >
          <div className="space-y-4 text-xs">
            {/* Header info badge */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-slate-400 block">{isAr ? "معرف الشيك المركزي" : "Central Cheque ID"}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{viewingAuditCheque.id}</span>
              </div>
              <div className="text-right rtl:text-left">
                <span className="text-slate-400 block">{isAr ? "الحالة الحالية" : "Current Status"}</span>
                <span className="font-bold">{renderStatusBadge(viewingAuditCheque.status)}</span>
              </div>
            </div>

            {/* Audit History Timeline */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <History className="w-4 h-4 text-indigo-600" />
                <span>{isAr ? "التسلسل الزمني للعمليات والحركات" : "Operational Timeline"}</span>
              </h4>

              {(!viewingAuditCheque.auditTrail || viewingAuditCheque.auditTrail.length === 0) ? (
                <div className="py-8 text-center text-slate-400">
                  <Clock className="w-8 h-8 mx-auto mb-1 stroke-[1.5]" />
                  <p>{isAr ? "لا توجد سجلات تدقيق سابقة لهذا الشيك بعد." : "No audit entries recorded for this cheque yet."}</p>
                </div>
              ) : (
                <div className="relative border-s-2 border-indigo-200 dark:border-indigo-900 ms-3 space-y-4 py-1">
                  {viewingAuditCheque.auditTrail.map((entry, idx) => (
                    <div key={idx} className="relative ps-4 group">
                      <div className="absolute -start-1.5 top-1 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900" />
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 shadow-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-indigo-700 dark:text-indigo-400">
                            {entry.action}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(entry.timestamp).toLocaleString(isAr ? "ar-AE" : "en-GB")}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                          <span>
                            {isAr ? "الحالة:" : "Status:"}{" "}
                            <strong className="text-slate-800 dark:text-white">
                              {entry.previousStatus || "INIT"} → {entry.newStatus}
                            </strong>
                          </span>
                          {entry.userName && (
                            <span className="text-slate-400">
                              • {isAr ? "بواسطة:" : "By:"} {entry.userName}
                            </span>
                          )}
                        </div>

                        {entry.notes && (
                          <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                            {entry.notes}
                          </div>
                        )}

                        {entry.referenceNumber && (
                          <div className="text-[10px] font-mono text-slate-500">
                            {isAr ? "المرجع:" : "Ref:"} {entry.referenceNumber}
                          </div>
                        )}

                        {entry.proofUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setViewingProof({
                                title: isAr
                                  ? `مرفق عملية (${entry.action}) - شيك #${viewingAuditCheque.chequeNumber}`
                                  : `Proof for ${entry.action} - Cheque #${viewingAuditCheque.chequeNumber}`,
                                url: entry.proofUrl!,
                              })
                            }
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-[11px] font-bold cursor-pointer pt-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>{isAr ? "عرض الوثيقة المرفقة للعملية" : "View Attached Proof"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingAuditCheque(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl font-bold cursor-pointer"
              >
                {isAr ? "إغلاق" : "Close"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
