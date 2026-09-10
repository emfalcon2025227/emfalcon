import React, { useState, useMemo } from "react";
import {
  Wallet,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Plus,
  Upload,
  FileText,
  Lock,
  X,
  Printer,
  FileSpreadsheet,
  Check,
  Building2,
  ArrowUpRight,
  ShieldAlert,
  RotateCcw,
  Eye,
  ExternalLink,
  ShieldCheck,
  DollarSign,
  Layers,
  Bot,
  UserCheck,
  AlertCircle,
  Info,
  FileCheck,
  FileWarning
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { OwnerTransferRecord, OwnerTransferStatus, PaymentMethod, ElectronicArchiveItem, PropertyExpenseRecord } from "../../types";
import { SearchableSelect } from "../common/SearchableSelect";
import { OfficePrintHeader } from "../common/OfficePrintHeader";
import { OCRService } from "../../services/ocr/ocrEngine";
import { verifyFinancialProof, FinancialProofVerification } from "../../services/financialEngine";
import { DocumentStorageService } from "../../services/documentStorageService";
import {
  FinancialVerificationStatus,
  VerificationMethod,
  VerificationOverrideType,
  isStandardOverrideAuthorized,
  isHighLevelOverrideAuthorized,
  evaluateSettlementGate,
  PRODUCTION_REALITY_RULE_AR,
  PRODUCTION_REALITY_RULE_EN,
} from "../../services/verificationPolicyService";

export type DepositType = "ADMINISTRATIVE_FEE" | "BOUNCED_PENALTY" | "CLEANING_FEE" | "SECURITY_FEE" | "OWNER_TRANSFER" | "SECURITY_DEPOSIT";
export type FundCategory = "OFFICE" | "OWNER" | "SECURITY_DEPOSIT";

export interface UnifiedDepositItem {
  id: string;
  sourceId: string;
  transactionNumber: string;
  type: DepositType;
  fundCategory: FundCategory;
  amount: number;
  date: string;
  status: string; // PENDING, APPROVED, PAID, BATCHED, RECONCILED
  relatedParty: string;
  ownerId?: string;
  ownerName: string;
  propertyId?: string;
  propertyName?: string;
  unitId?: string;
  unitNumber?: string;
  leaseId?: string;
  leaseNumber?: string;
  isVatInclusive?: boolean;
  batchId?: string;
  batchName?: string;
  proofDocumentId?: string;
  archiveProof?: ElectronicArchiveItem;
  originalRecord: any;
  isOverdue: boolean;
  daysPending: number;
  verificationStatus?: FinancialVerificationStatus;
  verificationMethod?: VerificationMethod;
  overrideReason?: string;
  overrideType?: string;
  verifiedByName?: string;
  verifiedAt?: string;
}

export const DailyDepositsView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentUser, hasPermission } = useAuth();
  const {
    owners,
    properties,
    units,
    leases,
    tenants,
    commissions,
    propertyExpenses,
    ownerTransfers,
    addOwnerTransfer,
    updateOwnerTransfer,
    updateOwnerTransferStatus,
    settleOwnerTransfer,
    settleAdministrativeFee,
    settlePropertyExpense,
    settleSecurityDeposit,
    cancelOwnerTransfer,
    reverseOwnerTransfer,
    getOwnerPayable,
    archive,
    addArchiveItem,
    getNextDepositBatchNumber,
    createDepositBatch,
    depositBatches,
  } = useData();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL");
  const [selectedFundCategoryFilter, setSelectedFundCategoryFilter] = useState<FundCategory | "ALL">("ALL");
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Selection state for Batching
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
   

  // Proof Upload & AI/OCR Modal State
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [targetItem, setTargetItem] = useState<UnifiedDepositItem | null>(null);
  const [targetBatch, setTargetBatch] = useState<any | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofBase64, setProofBase64] = useState<string>("");
  const [proofFileName, setProofFileName] = useState<string>("");
  const [proofNotes, setProofNotes] = useState<string>("");
  const [proofError, setProofError] = useState<string>("");

  // AI/OCR State
  const [isOcrAnalyzing, setIsOcrAnalyzing] = useState(false);
  const [ocrResult, setOcrResult] = useState<FinancialProofVerification | null>(null);

  // AI Verification & Manual Override State (Production Reality Policy)
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideType, setOverrideType] = useState<VerificationOverrideType>("OCR_FAILED");
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [mismatchJustification, setMismatchJustification] = useState("");
  const [mismatchConfirmed, setMismatchConfirmed] = useState(false);

  // View Proof Modal State (Read-Only)
  const [isViewProofModalOpen, setIsViewProofModalOpen] = useState(false);
  const [viewProofItem, setViewProofItem] = useState<UnifiedDepositItem | null>(null);

  // Smart Preview on Hover State
  const [hoveredItem, setHoveredItem] = useState<UnifiedDepositItem | null>(null);

  // New Transfer Preparation Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState("");
  const [newAmount, setNewAmount] = useState<number | "">("");
  const [newPaymentMethod, setNewPaymentMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [newBankName, setNewBankName] = useState("");
  const [newIban, setNewIban] = useState("");
  const [newRefNo, setNewRefNo] = useState("");
  const todayStr = new Date().toISOString().split("T")[0];
  const [newTransferDate, setNewTransferDate] = useState(todayStr);
  const [newNotes, setNewNotes] = useState("");
  const [createError, setCreateError] = useState("");
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  const [showOnlyOverdue, setShowOnlyOverdue] = useState(false);

  // Compile Unified Deposit Items from Owner Transfers and Property Expenses
  const unifiedDepositItems = useMemo(() => {
    const items: UnifiedDepositItem[] = [];

    // 1. Owner Transfers (Owner Payables)
    ownerTransfers.forEach((t) => {
      const transferDateObj = new Date(t.transferDate);
      const todayObj = new Date(todayStr);
      const diffDays = Math.floor((todayObj.getTime() - transferDateObj.getTime()) / (1000 * 60 * 60 * 24));
      const daysPending = diffDays > 0 ? diffDays : 0;
      const isOverdue = (t.status === "APPROVED" || t.status === "PENDING_APPROVAL" || t.status === "DRAFT") && t.transferDate < todayStr;
      const owner = owners.find((o) => o.id === t.ownerId);
      const archiveProof = archive.find((a) => a.entityId === t.id || a.recordId === t.id || a.id === t.proofDocumentId);

      items.push({
        id: `ot-${t.id}`,
        sourceId: t.id,
        transactionNumber: t.transferNumber,
        type: "OWNER_TRANSFER",
        fundCategory: "OWNER",
        amount: t.amount,
        date: t.transferDate,
        status: t.status,
        relatedParty: owner ? (isAr ? owner.nameAr : owner.nameEn) : "Owner Payout",
        ownerId: t.ownerId,
        ownerName: owner ? (isAr ? owner.nameAr : owner.nameEn) : (isAr ? "مالك غير معروف" : "Unknown Owner"),
        propertyId: t.propertyId,
        unitId: t.unitId,
        leaseId: t.leaseId,
        proofDocumentId: t.proofDocumentId,
        archiveProof,
        originalRecord: t,
        isOverdue,
        daysPending,
        verificationStatus: t.verificationStatus,
        verificationMethod: t.verificationMethod,
        overrideReason: t.overrideReason,
        overrideType: t.overrideType,
        verifiedByName: t.verifiedByName,
        verifiedAt: t.verifiedAt,
      });
    });

    // 2. Administrative Fees & Commissions (Authoritative Source: Commission Obligations)
    commissions.forEach((comm) => {
      const prop = properties.find((p) => p.id === comm.propertyId);
      const owner = comm.ownerId ? owners.find((o) => o.id === comm.ownerId) : (prop ? owners.find((o) => o.id === prop.ownerId) : null);
      const archiveProof = archive.find((a) => a.entityId === comm.id || a.recordId === comm.id || (comm.proofDocumentId && a.id === comm.proofDocumentId));
      
      const isCollected = comm.status === "COLLECTED" || comm.status === "FULLY_COLLECTED";
      const isCancelled = comm.status === "CANCELLED" || comm.status === "REVERSED" || comm.status === "WAIVED";
      const isOverdue = !isCollected && !isCancelled && Boolean(comm.dueDate && comm.dueDate < todayStr);
      
      const itemStatus = isCollected ? "PAID" : isCancelled ? "CANCELLED" : "APPROVED";
      const displayAmount = isCollected 
        ? (comm.collectedAmount || comm.totalCommissionAmount || 0)
        : (comm.outstandingBalance ?? (comm.totalCommissionAmount - (comm.collectedAmount || 0)));

      items.push({
        id: `comm-${comm.id}`,
        sourceId: comm.id,
        transactionNumber: `FEE-${comm.id.slice(-6)}`,
        type: "ADMINISTRATIVE_FEE",
        fundCategory: "OFFICE",
        amount: displayAmount,
        date: comm.dueDate || todayStr,
        status: itemStatus,
        relatedParty: isAr ? (comm.partyType === "TENANT" ? "رسوم إدارية (مستأجر)" : "رسوم إدارية (مالك)") : `Administrative Fee (${comm.partyType})`,
        ownerId: owner?.id,
        ownerName: owner ? (isAr ? owner.nameAr : owner.nameEn) : (isAr ? "صقر الإمارات للعقارات" : "Emirates Falcon Office"),
        propertyId: comm.propertyId,
        propertyName: prop ? (isAr ? prop.nameAr : prop.nameEn) : undefined,
        unitId: comm.unitId,
        leaseId: comm.leaseId,
        archiveProof,
        originalRecord: comm,
        isOverdue,
        daysPending: 0,
        verificationStatus: (comm.verificationStatus as FinancialVerificationStatus) || undefined,
        verifiedAt: comm.verifiedAt,
      });
    });

    // 3. Property Operational Expenses (Cleaning, Security, Maintenance)
    propertyExpenses.forEach((exp) => {
      const isCleaning = exp.category === "CLEANING";
      const isSecurity = exp.category === "SECURITY";
      const type: DepositType = isCleaning ? "CLEANING_FEE" : isSecurity ? "SECURITY_FEE" : "CLEANING_FEE";
      const prop = properties.find((p) => p.id === exp.propertyId);
      const owner = prop ? owners.find((o) => o.id === prop.ownerId) : null;
      const archiveProof = archive.find((a) => a.entityId === exp.id || a.recordId === exp.id);
      const isOverdue = exp.status !== "PAID" && exp.expenseDate < todayStr;

      items.push({
        id: `exp-${exp.id}`,
        sourceId: exp.id,
        transactionNumber: exp.expenseNumber || `EXP-${exp.id.slice(-6)}`,
        type,
        fundCategory: "OFFICE",
        amount: exp.amount,
        date: exp.expenseDate || todayStr,
        status: exp.status === "PAID" ? "PAID" : "APPROVED",
        relatedParty: exp.description || "Office Property Expense",
        ownerId: owner?.id,
        ownerName: owner ? (isAr ? owner.nameAr : owner.nameEn) : (isAr ? "صقر الإمارات للعقارات" : "Emirates Falcon Office"),
        propertyId: exp.propertyId,
        propertyName: prop ? (isAr ? prop.nameAr : prop.nameEn) : undefined,
        unitId: exp.unitId,
        archiveProof,
        originalRecord: exp,
        isOverdue,
        daysPending: 0,
      });
    });

    // 4. Tenant Security Deposits (Tenant Liability - Account 2020)
    leases.forEach((lease) => {
      const depositAmount = lease.securityDeposit || 0;
      if (depositAmount <= 0) return;

      // Don't include carried-forward previous contracts as new deposits to be banked
      if (lease.securityDepositStatus === "CARRIED_FORWARD") return;

      const tenant = tenants.find((t) => t.id === lease.tenantId);
      const owner = owners.find((o) => o.id === lease.ownerId);
      const prop = properties.find((p) => p.id === lease.propertyId);
      const archiveProof = archive.find((a) => a.entityId === lease.id || a.recordId === lease.id || (lease.securityDepositProofDocId && a.id === lease.securityDepositProofDocId));

      const isCollected = Boolean(lease.securityDepositReceiptNumber || lease.securityDepositStatus === "HELD" || lease.securityDepositStatus === "SETTLED" || lease.securityDepositStatus === "REFUNDED");
      const isSettled = lease.securityDepositStatus === "SETTLED" || lease.securityDepositStatus === "REFUNDED";
      const isOverdue = !isCollected && lease.startDate < todayStr;

      let derivedStatus: "APPROVED" | "PENDING_APPROVAL" | "DRAFT" | "PAID" | "CANCELLED" = "APPROVED";
      if (isSettled) {
        derivedStatus = "PAID";
      } else if (isCollected) {
        if (lease.securityDepositPaymentMethod === "CASH") {
          derivedStatus = lease.securityDepositVerificationStatus === "VERIFIED" ? "PAID" : "APPROVED";
        } else {
          // Bank transfers, cards, and cheques are considered settled/paid in the context of the physical bank deposit run
          derivedStatus = "PAID";
        }
      } else {
        derivedStatus = "APPROVED"; // Pending collection
      }

      items.push({
        id: `sd-${lease.id}`,
        sourceId: lease.id,
        transactionNumber: lease.securityDepositReceiptNumber || `DEP-CON-${lease.leaseNumber.slice(-6)}`,
        type: "SECURITY_DEPOSIT",
        fundCategory: "SECURITY_DEPOSIT",
        amount: depositAmount,
        date: lease.securityDepositCollectedDate || lease.startDate || todayStr,
        status: derivedStatus,
        relatedParty: tenant ? (isAr ? `${tenant.nameAr} (أمانات تأمين مستأجر)` : `${tenant.nameEn} (Tenant Security Deposit)`) : (isAr ? "تأمين صيانة مستأجر" : "Tenant Security Deposit"),
        ownerId: lease.ownerId,
        ownerName: owner ? (isAr ? owner.nameAr : owner.nameEn) : (isAr ? "أمانات مستأجرين (2020)" : "Tenant Security Liability"),
        propertyId: lease.propertyId,
        propertyName: prop ? (isAr ? prop.nameAr : prop.nameEn) : undefined,
        unitId: lease.unitId,
        leaseId: lease.id,
        proofDocumentId: lease.securityDepositProofDocId,
        archiveProof,
        originalRecord: lease,
        isOverdue,
        daysPending: 0,
        verificationStatus: lease.securityDepositVerificationStatus as any,
      });
    });

    return items;
  }, [ownerTransfers, commissions, propertyExpenses, leases, tenants, owners, properties, archive, todayStr, isAr]);

  // Grouping automatic owner payables if multiple on same day for same owner
  const autoGroupedOwnerBatches = useMemo(() => {
    const ownerMap: Record<string, UnifiedDepositItem[]> = {};
    unifiedDepositItems.forEach((item) => {
      if (item.fundCategory === "OWNER" && item.status !== "PAID" && item.status !== "CANCELLED") {
        const key = `${item.ownerId}-${item.date}`;
        if (!ownerMap[key]) ownerMap[key] = [];
        ownerMap[key].push(item);
      }
    });

    const groups: Array<{ key: string; ownerName: string; date: string; items: UnifiedDepositItem[]; total: number }> = [];
    Object.entries(ownerMap).forEach(([key, groupItems]) => {
      if (groupItems.length > 1) {
        groups.push({
          key,
          ownerName: groupItems[0].ownerName,
          date: groupItems[0].date,
          items: groupItems,
          total: groupItems.reduce((sum, i) => sum + i.amount, 0),
        });
      }
    });
    return groups;
  }, [unifiedDepositItems]);

  // Authoritative Metrics
  const metrics = useMemo(() => {
    let officeTotal = 0;
    let ownerTotal = 0;
    let depositTotal = 0;
    let overdueCount = 0;
    let pendingCount = 0;

    unifiedDepositItems.forEach((item) => {
      if (item.fundCategory === "OFFICE") officeTotal += item.amount;
      if (item.fundCategory === "OWNER") ownerTotal += item.amount;
      if (item.fundCategory === "SECURITY_DEPOSIT") depositTotal += item.amount;
      if (item.isOverdue) overdueCount++;
      if (item.status === "APPROVED" || item.status === "PENDING" || item.status === "DRAFT") pendingCount++;
    });

    return { officeTotal, ownerTotal, depositTotal, overdueCount, pendingCount };
  }, [unifiedDepositItems]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return unifiedDepositItems.filter((item) => {
      if (showOnlyOverdue && !item.isOverdue) return false;
      if (selectedFundCategoryFilter !== "ALL" && item.fundCategory !== selectedFundCategoryFilter) return false;
      if (selectedTypeFilter !== "ALL" && item.type !== selectedTypeFilter) return false;
      if (selectedStatusFilter !== "ALL" && item.status !== selectedStatusFilter) return false;
      if (selectedOwnerFilter !== "ALL" && item.ownerId !== selectedOwnerFilter) return false;

      if (dateFrom && item.date < dateFrom) return false;
      if (dateTo && item.date > dateTo) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.transactionNumber.toLowerCase().includes(q) ||
          item.ownerName.toLowerCase().includes(q) ||
          item.relatedParty.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [unifiedDepositItems, showOnlyOverdue, selectedFundCategoryFilter, selectedTypeFilter, selectedStatusFilter, selectedOwnerFilter, dateFrom, dateTo, searchQuery]);

  // Selection toggle
  const handleToggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectedItemIds.length === filteredItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(filteredItems.map((i) => i.id));
    }
  };

  // Create Deposit Batch (حافظة إيداع)
  const handleCreateOfficeBatch = () => {
    if (selectedItemIds.length === 0) return;

    const selectedObjs = unifiedDepositItems.filter((i) => selectedItemIds.includes(i.id));
    const hasOwnerFunds = selectedObjs.some((i) => i.fundCategory === "OWNER");
    const hasSecurityDeposits = selectedObjs.some((i) => i.fundCategory === "SECURITY_DEPOSIT");
    const hasOfficeFunds = selectedObjs.some((i) => i.fundCategory === "OFFICE");

    const categoriesCount = [hasOwnerFunds, hasSecurityDeposits, hasOfficeFunds].filter(Boolean).length;
    if (categoriesCount > 1) {
      alert(
        isAr
          ? "خطأ محاسبي رقابي: لا يمكن خلط أموال المكتب أو أموال الملاك أو أمانات التأمين (حساب 2020) في حافظة إيداع واحدة مطلقاً."
          : "Accounting Rule Violation: Never mix Office funds, Owner funds, and Security Deposits in the same deposit batch."
      );
      return;
    }

    const totalAmount = selectedObjs.reduce((sum, i) => sum + i.amount, 0);
    const batchId = getNextDepositBatchNumber();
    const batchCategory: FundCategory = hasSecurityDeposits ? "SECURITY_DEPOSIT" : hasOfficeFunds ? "OFFICE" : "OWNER";
    const batchName = hasSecurityDeposits
      ? (isAr ? `حافظة إيداع أمانات تأمين (2020) رقم ${batchId}` : `Security Deposit Batch (2020) #${batchId}`)
      : hasOfficeFunds
      ? (isAr ? `حافظة إيداع مكتب رقم ${batchId}` : `Office Deposit Batch #${batchId}`)
      : (isAr ? `حافظة تحويلات ملاك رقم ${batchId}` : `Owner Payout Batch #${batchId}`);

    const newBatch = {
      id: batchId,
      name: batchName,
      fundCategory: batchCategory,
      itemIds: selectedItemIds,
      totalAmount,
      createdAt: new Date().toISOString(),
      status: "PENDING_PROOF",
    };

    createDepositBatch(newBatch as any);
    setSelectedItemIds([]);
    alert(
      isAr
        ? `تم إنشاء الحافظة بنجاح برقم: ${batchId} بإجمالي AED ${totalAmount.toLocaleString()}`
        : `Batch created successfully: ${batchId}, Total: AED ${totalAmount.toLocaleString()}`
    );
  };

  const handleOpenProofModal = (item: UnifiedDepositItem) => {
    setTargetItem(item);
    setTargetBatch(null);
    setProofFile(null);
    setProofBase64("");
    setProofFileName("");
    setProofNotes("");
    setProofError("");
    setOcrResult(null);
    setOverrideReason("");
    setOverrideType("OCR_FAILED");
    setOverrideConfirmed(false);
    setMismatchJustification("");
    setMismatchConfirmed(false);
    setIsProofModalOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    setProofFileName(file.name);
    setProofError("");

    const reader = new FileReader();
    reader.onload = async (uploadEvent) => {
      const b64 = uploadEvent.target?.result as string || "";
      setProofBase64(b64);

      if (!targetItem) return;

      // Real AI/OCR Receipt Extraction
      setIsOcrAnalyzing(true);
      try {
        const ocrRes = await OCRService.extractReceipt(b64, file.type);
        if (ocrRes.success && ocrRes.data) {
          let expectedBankName: string | undefined = undefined;
          let expectedAccountNumber: string | undefined = undefined;
          let expectedReference: string | undefined = undefined;

          if (targetItem.type === "ADMINISTRATIVE_FEE") {
            expectedBankName = targetItem.originalRecord?.bankNameSnapshot || targetItem.originalRecord?.bankName || undefined;
            expectedAccountNumber = targetItem.originalRecord?.accountNumberSnapshot || targetItem.originalRecord?.accountNumber || undefined;
            expectedReference = targetItem.originalRecord?.transactionReference || targetItem.originalRecord?.referenceNumber || undefined;
          } else if (targetItem.type === "OWNER_TRANSFER") {
            expectedBankName = targetItem.originalRecord?.beneficiaryBankName || (targetItem.originalRecord as any)?.bankName || undefined;
            expectedAccountNumber = targetItem.originalRecord?.beneficiaryIban || targetItem.originalRecord?.beneficiaryAccountNumber || undefined;
            expectedReference = targetItem.originalRecord?.transactionReferenceNumber || undefined;
          }

          const expected = {
            amount: targetItem.amount,
            bankName: expectedBankName,
            referenceNumber: expectedReference,
            date: targetItem.date || targetItem.originalRecord?.transferDate || targetItem.originalRecord?.dueDate || targetItem.originalRecord?.expenseDate || undefined,
            accountNumber: expectedAccountNumber,
          };
          const verification = verifyFinancialProof(expected, ocrRes.data);
          setOcrResult(verification);
        } else {
          setOcrResult({
            overallStatus: "FAILED",
            failureReason: ocrRes.error || "OCR extraction failed.",
            amount: { status: "NOT_AVAILABLE", expected: targetItem.amount.toString(), extracted: "" },
            bank: { status: "NOT_AVAILABLE", expected: "", extracted: "" },
            reference: { status: "NOT_AVAILABLE", expected: "", extracted: "" },
            date: { status: "NOT_AVAILABLE", expected: "", extracted: "" },
            account: { status: "NOT_AVAILABLE", expected: "", extracted: "" },
          });
        }
      } catch (err) {
        setOcrResult({
          overallStatus: "FAILED",
          failureReason: "System error during OCR.",
          amount: { status: "NOT_AVAILABLE", expected: targetItem.amount.toString(), extracted: "" },
          bank: { status: "NOT_AVAILABLE", expected: "", extracted: "" },
          reference: { status: "NOT_AVAILABLE", expected: "", extracted: "" },
          date: { status: "NOT_AVAILABLE", expected: "", extracted: "" },
          account: { status: "NOT_AVAILABLE", expected: "", extracted: "" },
        });
      } finally {
        setIsOcrAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVerifyAndSettleItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetItem) return;

    // Check if proof document actually exists in memory or archive
    const resolvedProofDoc = targetItem.archiveProof || (targetItem.proofDocumentId ? archive.find(a => a.id === targetItem.proofDocumentId && (a.entityId === targetItem.sourceId || a.recordId === targetItem.sourceId)) : null);
    const hasValidProofDocument = Boolean(proofBase64 || resolvedProofDoc);

    if (!hasValidProofDocument) {
      setProofError(isAr ? "يرجى إرفاق إثبات الإيداع البنكي أو السند المالي الفعلي (المستند إلزامي للتسوية ولا يكفي رقم المرجع)." : "Please attach bank deposit proof or receipt document (An actual document is mandatory; reference number alone is not sufficient).");
      return;
    }

    if (isOcrAnalyzing) {
      setProofError(isAr ? "يرجى الانتظار حتى تكتمل عملية التحليل (OCR)." : "Please wait for OCR analysis to complete.");
      return;
    }

    // Determine verification status according to the two official policy paths
    let verificationStatus: FinancialVerificationStatus = "UNVERIFIED";
    let verificationMethod: VerificationMethod = "AI_AUTOMATED";
    let finalOverrideReason: string | undefined = undefined;
    let finalOverrideType: VerificationOverrideType | undefined = undefined;

    const aiStatus = ocrResult?.overallStatus || "FAILED";

    if (aiStatus === "MATCH") {
      // Path 1: AI Verification
      verificationStatus = "AI_VERIFIED";
      verificationMethod = "AI_AUTOMATED";
    } else if (aiStatus === "MISMATCH") {
      // Path 2b: Escalated High-Level Mismatch Override
      if (!isHighLevelOverrideAuthorized(currentUser?.role)) {
        setProofError(
          isAr
            ? "حظر أمني: تم رصد عدم تطابق (MISMATCH) بين الإثبات والسجل. اعتماد التجاوز مقتصر على المشرف العام أو مدير النظام فقط."
            : "Security Lock: Discrepancy (MISMATCH) detected. High-level override requires Super Admin or System Owner authorization."
        );
        return;
      }
      if (!mismatchJustification.trim()) {
        setProofError(
          isAr
            ? "يجب كتابة التبرير الإداري الإلزامي لتجاوز عدم التطابق (إجباري)."
            : "Mandatory justification reason is required to override AI mismatch."
        );
        return;
      }
      if (!mismatchConfirmed) {
        setProofError(
          isAr
            ? "يجب تأكيد إقرار المسؤولية الرقابية لاعتماد تجاوز عدم التطابق."
            : "You must confirm executive authorization to override AI mismatch."
        );
        return;
      }
      verificationStatus = "OVERRIDDEN";
      verificationMethod = "MISMATCH_OVERRIDE";
      finalOverrideReason = mismatchJustification.trim();
      finalOverrideType = "MANUAL_REVIEW_AFTER_MISMATCH";
    } else {
      // Path 2a: Standard Manual Verification on AI Failure / Unavailability
      if (!isStandardOverrideAuthorized(currentUser?.role)) {
        setProofError(
          isAr
            ? "فشل التحقق الآلي. الاعتماد والتحقق اليدوي يتطلب صلاحية موظف مالي أو مدير مخول."
            : "AI verification unavailable/failed. Manual verification requires Finance or Manager role."
        );
        return;
      }
      if (!overrideReason.trim()) {
        setProofError(
          isAr
            ? "يجب كتابة سبب الاعتماد اليدوي ومطابقة المستند يدويًا (إجباري)."
            : "Mandatory override reason is required for manual verification."
        );
        return;
      }
      if (!overrideConfirmed) {
        setProofError(
          isAr
            ? "يرجى تأكيد إقرار مطابقة المستند يدويًا والتأكد من صحة البيانات."
            : "Please check the confirmation box verifying the document was manually inspected."
        );
        return;
      }
      verificationStatus = "MANUALLY_VERIFIED";
      verificationMethod = "MANUAL_OVERRIDE";
      finalOverrideReason = overrideReason.trim();
      finalOverrideType = overrideType;
    }

    // Deterministic Settlement Gate Check
    const gateCheck = evaluateSettlementGate({
      verificationStatus,
      hasProof: hasValidProofDocument,
      hasValidProofDocument,
      isProofResolved: targetItem.proofDocumentId ? Boolean(resolvedProofDoc) : undefined,
      proofRequired: true,
      overrideReason: finalOverrideReason,
      overrideType: finalOverrideType,
      originalAiStatus: aiStatus,
      userRole: currentUser?.role,
      isMismatch: aiStatus === "MISMATCH",
    });

    if (!gateCheck.allowed) {
      setProofError(isAr ? gateCheck.reasonAr : gateCheck.reasonEn);
      return;
    }

    if (targetItem.type === "OWNER_TRANSFER") {
      const res = await settleOwnerTransfer({
        transferId: targetItem.sourceId,
        proofBase64,
        proofFileName,
        proofFileType: proofFile?.type,
        proofFileSize: proofFile?.size,
        notes: proofNotes ? (isAr ? `إيداع وتسوية: ${proofNotes}` : `Deposit settlement: ${proofNotes}`) : undefined,
        verificationStatus,
        verificationMethod,
        overrideReason: finalOverrideReason,
        overrideType: finalOverrideType,
        aiVerificationDetails: {
          aiStatus,
          failureReason: ocrResult?.failureReason,
          extractedValues: {
            amount: ocrResult?.amount?.extracted,
            bankName: ocrResult?.bank?.extracted,
            referenceNumber: ocrResult?.reference?.extracted,
            date: ocrResult?.date?.extracted,
          },
          expectedValues: {
            amount: targetItem.amount,
            bankName: targetItem.originalRecord?.beneficiaryBankName || (targetItem.originalRecord as any)?.bankName || undefined,
            referenceNumber: targetItem.originalRecord?.transactionReferenceNumber || undefined,
            date: targetItem.date || targetItem.originalRecord?.transferDate || targetItem.originalRecord?.expenseDate || undefined,
            accountNumber: targetItem.originalRecord?.beneficiaryIban || targetItem.originalRecord?.beneficiaryAccountNumber || undefined,
          },
          comparisonResults: {
            amountMatch: ocrResult?.amount?.status === "MATCH",
            bankMatch: ocrResult?.bank?.status === "MATCH",
            referenceMatch: ocrResult?.reference?.status === "MATCH",
            dateMatch: ocrResult?.date?.status === "MATCH",
            accountMatch: ocrResult?.account?.status === "MATCH",
          },
          analyzedAt: new Date().toISOString(),
        },
      });

      if (res.success) {
        setIsProofModalOpen(false);
        setTargetItem(null);
      } else {
        setProofError(res.error || (isAr ? "فشلت عملية التسوية المعتمدة." : "Failed to settle transfer"));
      }
    } else if (targetItem.type === "ADMINISTRATIVE_FEE") {
      const res = await settleAdministrativeFee({
        commissionId: targetItem.sourceId,
        proofBase64,
        proofFileName,
        proofFileType: proofFile?.type,
        proofFileSize: proofFile?.size,
        notes: proofNotes ? (isAr ? `إيداع وتسوية رسوم: ${proofNotes}` : `Fee deposit settlement: ${proofNotes}`) : undefined,
        verificationStatus,
        verificationMethod,
        overrideReason: finalOverrideReason,
        overrideType: finalOverrideType,
        aiVerificationDetails: {
          aiStatus,
          failureReason: ocrResult?.failureReason,
          extractedValues: {
            amount: ocrResult?.amount?.extracted,
            bankName: ocrResult?.bank?.extracted,
            referenceNumber: ocrResult?.reference?.extracted,
            date: ocrResult?.date?.extracted,
          },
          expectedValues: {
            amount: targetItem.amount,
            bankName: targetItem.originalRecord?.bankNameSnapshot || targetItem.originalRecord?.bankName || undefined,
            referenceNumber: targetItem.originalRecord?.transactionReference || targetItem.originalRecord?.referenceNumber || undefined,
            date: targetItem.date || targetItem.originalRecord?.dueDate || undefined,
            accountNumber: targetItem.originalRecord?.accountNumberSnapshot || targetItem.originalRecord?.accountNumber || undefined,
          },
          comparisonResults: {
            amountMatch: ocrResult?.amount?.status === "MATCH",
            bankMatch: ocrResult?.bank?.status === "MATCH",
            referenceMatch: ocrResult?.reference?.status === "MATCH",
            dateMatch: ocrResult?.date?.status === "MATCH",
            accountMatch: ocrResult?.account?.status === "MATCH",
          },
          analyzedAt: new Date().toISOString(),
        },
      });

      if (res.success) {
        setIsProofModalOpen(false);
        setTargetItem(null);
      } else {
        setProofError(res.error || (isAr ? "فشلت عملية تسوية الرسوم الإدارية." : "Failed to settle administrative fee"));
      }
    } else if (targetItem.type === "CLEANING_FEE" || targetItem.type === "SECURITY_FEE") {
      const res = await settlePropertyExpense({
        expenseId: targetItem.sourceId,
        proofBase64,
        proofFileName,
        proofFileType: proofFile?.type,
        proofFileSize: proofFile?.size,
        notes: proofNotes ? (isAr ? `تسوية مصروف: ${proofNotes}` : `Expense settlement: ${proofNotes}`) : undefined,
        verificationStatus,
        verificationMethod,
        overrideReason: finalOverrideReason,
        overrideType: finalOverrideType,
        aiVerificationDetails: {
          aiStatus,
          failureReason: ocrResult?.failureReason,
          extractedValues: {
            amount: ocrResult?.amount?.extracted,
            bankName: ocrResult?.bank?.extracted,
            referenceNumber: ocrResult?.reference?.extracted,
            date: ocrResult?.date?.extracted,
          },
          expectedValues: {
            amount: targetItem.amount,
            bankName: undefined,
            referenceNumber: undefined,
            date: targetItem.date,
          },
          comparisonResults: {
            amountMatch: ocrResult?.amount?.status === "MATCH",
          },
          analyzedAt: new Date().toISOString(),
        },
      });

      if (res.success) {
        setIsProofModalOpen(false);
        setTargetItem(null);
      } else {
        setProofError(res.error || (isAr ? "فشلت عملية تسوية المصروف." : "Failed to settle expense"));
      }
    } else if (targetItem.type === "SECURITY_DEPOSIT") {
      const res = await settleSecurityDeposit({
        leaseId: targetItem.sourceId,
        proofBase64,
        proofFileName,
        proofFileType: proofFile?.type,
        proofFileSize: proofFile?.size,
        notes: proofNotes ? (isAr ? `إيداع وتسوية تأمين: ${proofNotes}` : `Security deposit settlement: ${proofNotes}`) : undefined,
        verificationStatus,
        verificationMethod,
        overrideReason: finalOverrideReason,
        overrideType: finalOverrideType,
        aiVerificationDetails: {
          aiStatus,
          failureReason: ocrResult?.failureReason,
          extractedValues: {
            amount: ocrResult?.amount?.extracted,
            bankName: ocrResult?.bank?.extracted,
            referenceNumber: ocrResult?.reference?.extracted,
            date: ocrResult?.date?.extracted,
          },
          expectedValues: {
            amount: targetItem.amount,
            bankName: targetItem.originalRecord?.securityDepositBankName || undefined,
            referenceNumber: targetItem.originalRecord?.securityDepositChequeNumber || undefined,
            date: targetItem.date,
          },
          comparisonResults: {
            amountMatch: ocrResult?.amount?.status === "MATCH",
            bankMatch: ocrResult?.bank?.status === "MATCH",
            referenceMatch: ocrResult?.reference?.status === "MATCH",
            dateMatch: ocrResult?.date?.status === "MATCH",
          },
          analyzedAt: new Date().toISOString(),
        },
      });

      if (res.success) {
        setIsProofModalOpen(false);
        setTargetItem(null);
      } else {
        setProofError(res.error || (isAr ? "فشلت عملية تسوية وإيداع التأمين." : "Failed to settle security deposit"));
      }
    } else {
      setProofError(isAr ? "نوع المعاملة غير مدعوم للتسوية." : "Transaction type not supported for settlement.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Printable Header with Office Logo and Name */}
      <OfficePrintHeader
        titleAr="تقرير مركز الإيداعات اليومية الموحد"
        titleEn="UNIFIED DAILY DEPOSITS REPORT"
        hideOnScreen={true}
      />

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-teal-500/25 relative overflow-hidden print:hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-semibold">
              <Layers className="w-4 h-4" />
              <span>{isAr ? "مركز الإيداعات اليومية الموحد" : "Unified Daily Deposits Center"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {isAr ? "مركز الإيداعات اليومية (Office & Owner Deposits)" : "Daily Deposits & Batch Management"}
            </h1>
            <p className="text-xs text-slate-300 max-w-xl">
              {isAr
                ? "إدارة الإيداعات اليومية للرسوم، النظافة والحراسة، ومستحقات الملاك، مع إنشاء حافظات الإيداع، ربط مستندات الإثبات بمدقق AI/OCR، وقفل الحسابات مالياً."
                : "Manage daily deposits for fees, cleaning/security, and owner payables with batching, AI/OCR proof verification, and financial locking."}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => {
                setCreateError("");
                setIsCreateModalOpen(true);
              }}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-lg shadow-teal-600/30 transition flex items-center gap-2 text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{isAr ? "إعداد أمر تحويل مالك جديد" : "Prepare Owner Transfer"}</span>
            </button>
            {selectedItemIds.length > 0 && (
              <button
                onClick={handleCreateOfficeBatch}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 text-xs"
              >
                <Layers className="w-4 h-4" />
                <span>{isAr ? `إنشاء حافظة إيداع مكتب (${selectedItemIds.length})` : `Create Office Batch (${selectedItemIds.length})`}</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
              title={isAr ? "طباعة التقرير" : "Print Report"}
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Auto-Grouped Owner Deposits Notice */}
      {autoGroupedOwnerBatches.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between text-amber-900 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {isAr
                ? `تجميع تلقائي لإيداعات الملاك: يوجد ${autoGroupedOwnerBatches.length} مجموعات لملاك تكررت دفعاتهم في نفس اليوم.`
                : `Automatic Owner Batching: ${autoGroupedOwnerBatches.length} owner payables grouped for same-day deposits.`}
            </span>
          </div>
          <span className="font-mono font-bold">
            AED {autoGroupedOwnerBatches.reduce((sum, g) => sum + g.total, 0).toLocaleString()}
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-emerald-800 uppercase flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5 text-emerald-600" />
            {isAr ? "إجمالي إيداعات المكتب" : "Total Office Deposits"}
          </span>
          <div className="text-xl font-black text-emerald-950 font-mono">
            AED {metrics.officeTotal.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-700 font-semibold">
            {isAr ? "رسوم، نظافة وحراسة" : "Fees, cleaning & security"}
          </div>
        </div>

        <div className="bg-teal-50/80 p-4 rounded-2xl border border-teal-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-teal-800 uppercase flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-teal-600" />
            {isAr ? "مستحقات الملاك" : "Total Owner Payouts"}
          </span>
          <div className="text-xl font-black text-teal-950 font-mono">
            AED {metrics.ownerTotal.toLocaleString()}
          </div>
          <div className="text-[10px] text-teal-700 font-semibold">
            {isAr ? "مفصول تماماً عن المكتب" : "Strictly separated from office"}
          </div>
        </div>

        <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-amber-800 uppercase flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            {isAr ? "أمانات التأمين (حساب 2020)" : "Security Deposits (2020)"}
          </span>
          <div className="text-xl font-black text-amber-950 font-mono">
            AED {metrics.depositTotal.toLocaleString()}
          </div>
          <div className="text-[10px] text-amber-700 font-semibold">
            {isAr ? "التزام أمانات مستأجرين" : "Tenant-owned liabilities"}
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            {isAr ? "قيد الاعتماد / الإيداع" : "Pending Deposits"}
          </span>
          <div className="text-xl font-black text-slate-900 font-mono">
            {metrics.pendingCount} {isAr ? "عملية" : "items"}
          </div>
          <div className="text-[10px] text-slate-500 font-semibold">
            {isAr ? "تنتظر رفع الإثبات والاعتماد" : "Awaiting proof & settlement"}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-rose-600 uppercase flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            {isAr ? "الإيداعات المتأخرة" : "Overdue Deposits"}
          </span>
          <div className="text-xl font-black text-rose-600 font-mono">
            {metrics.overdueCount} {isAr ? "متأخر" : "overdue"}
          </div>
          <div className="text-[10px] text-slate-500 font-semibold">
            {isAr ? "تتطلب متابعة فورية" : "Requires immediate attention"}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? "بحث برقم المعاملة، اسم المالك، أو الطرف..." : "Search tx #, owner, party..."}
              className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            {/* Fund Category Filter */}
            <select
              value={selectedFundCategoryFilter}
              onChange={(e) => setSelectedFundCategoryFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
            >
              <option value="ALL">{isAr ? "جميع الأموال (All Categories)" : "All Funds"}</option>
              <option value="OFFICE">{isAr ? "أموال المكتب فقط (Office Funds)" : "Office Funds Only"}</option>
              <option value="OWNER">{isAr ? "أموال الملاك فقط (Owner Funds)" : "Owner Funds Only"}</option>
              <option value="SECURITY_DEPOSIT">{isAr ? "أمانات التأمين فقط (حساب 2020)" : "Security Deposits Only (Acc 2020)"}</option>
            </select>

            {/* Type Filter */}
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
            >
              <option value="ALL">{isAr ? "جميع أنواع المعاملات" : "All Types"}</option>
              <option value="ADMINISTRATIVE_FEE">{isAr ? "رسوم ومصروفات إدارية" : "Admin Fees & Expenses"}</option>
              <option value="CLEANING_FEE">{isAr ? "رسوم نظافة (Cleaning Fees)" : "Cleaning Fees"}</option>
              <option value="SECURITY_FEE">{isAr ? "رسوم حراسة وأمن (Security Fees)" : "Security Fees"}</option>
              <option value="OWNER_TRANSFER">{isAr ? "مستحقات وتحويلات الملاك (Owner Payables)" : "Owner Payables"}</option>
              <option value="SECURITY_DEPOSIT">{isAr ? "أمانات تأمين صيانة مستأجر (حساب 2020)" : "Security Deposits (Acc 2020)"}</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
            >
              <option value="ALL">{isAr ? "جميع الحالات" : "All Statuses"}</option>
              <option value="APPROVED">{isAr ? "معتمد / قيد الإيداع (Approved / Held)" : "Approved / Held"}</option>
              <option value="PAID">{isAr ? "مسدد ومكتمل (Paid / Settled)" : "Paid & Settled"}</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <span className="font-bold text-slate-500">{isAr ? "تصفية بالتاريخ:" : "Date Filter:"}</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-1.5 border rounded-xl font-mono text-xs"
          />
          <span className="text-slate-400">إلى</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-1.5 border rounded-xl font-mono text-xs"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-teal-600 font-bold hover:underline"
            >
              {isAr ? "إعادة ضبط التاريخ" : "Reset Dates"}
            </button>
          )}
        </div>
      </div>

      {/* Deposits Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-teal-600" />
            <h2 className="font-bold text-slate-900 text-sm">
              {isAr ? "سجل المعاملات والإيداعات اليومية" : "Daily Deposits & Transactions Ledger"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAllFiltered}
              className="text-xs font-bold text-teal-700 hover:text-teal-800 bg-teal-50 px-3 py-1 rounded-lg border border-teal-200"
            >
              {selectedItemIds.length === filteredItems.length ? (isAr ? "إلغاء تحديد الكل" : "Deselect All") : (isAr ? "تحديد الكل (Select All)" : "Select All")}
            </button>
            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
              {filteredItems.length} {isAr ? "سجل" : "records"}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-3 text-center w-10">
                  <span className="sr-only">Select</span>
                </th>
                <th className="py-3 px-4">{isAr ? "رقم المعاملة والتاريخ" : "Transaction # & Date"}</th>
                <th className="py-3 px-4">{isAr ? "نوع المعاملة والفئة" : "Type & Fund Category"}</th>
                <th className="py-3 px-4">{isAr ? "المالك / الطرف المرتبط" : "Owner / Related Party"}</th>
                <th className="py-3 px-4">{isAr ? "الحالة" : "Status"}</th>
                <th className="py-3 px-4">{isAr ? "إثبات الإيداع" : "Deposit Proof"}</th>
                <th className="py-3 px-4 text-left">{isAr ? "المبلغ (درهم)" : "Amount (AED)"}</th>
                <th className="py-3 px-4 text-center">{isAr ? "الإجراءات والتحقق" : "Actions & Verification"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    {isAr ? "لا توجد معاملات مطابقة لمعايير البحث الحالية." : "No transactions match your criteria."}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr
                    key={`${item.id}-${idx}`}
                    className={`hover:bg-slate-50/80 transition ${item.isOverdue ? "bg-rose-50/40" : ""}`}
                    onMouseEnter={() => setHoveredItem(item)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.includes(item.id)}
                        onChange={() => handleToggleSelectItem(item.id)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="relative group">
                        <span className="font-mono font-bold text-slate-900 block cursor-pointer hover:text-teal-600 transition">
                          {item.transactionNumber}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{item.date}</span>

                        {/* Smart Preview on Hover */}
                        <div className="absolute hidden group-hover:block z-30 bottom-full right-0 mb-2 w-72 bg-slate-900 text-white p-3 rounded-2xl shadow-xl text-[11px] space-y-1">
                          <div className="font-bold border-b border-slate-700 pb-1 text-teal-400">
                            {isAr ? "معاينة ذكية للمعاملة الأصلية" : "Smart Preview"}
                          </div>
                          <div><span className="text-slate-400">Type:</span> {item.type}</div>
                          <div><span className="text-slate-400">Owner:</span> {item.ownerName}</div>
                          <div><span className="text-slate-400">Amount:</span> AED {item.amount.toLocaleString()}</div>
                          <div><span className="text-slate-400">Party:</span> {item.relatedParty}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${
                          item.fundCategory === "OFFICE"
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            : item.fundCategory === "SECURITY_DEPOSIT"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-teal-50 text-teal-700 border border-teal-200"
                        }`}>
                          {item.fundCategory === "OFFICE"
                            ? (isAr ? "أموال المكتب (Office)" : "Office Fund")
                            : item.fundCategory === "SECURITY_DEPOSIT"
                            ? (isAr ? "أمانات تأمين (2020)" : "Security Deposit (2020)")
                            : (isAr ? "أموال الملاك (Owner)" : "Owner Fund")}
                        </span>
                        <span className="block text-[11px] font-semibold text-slate-700">
                          {item.type === "ADMINISTRATIVE_FEE" ? (isAr ? "رسوم إدارية" : "Admin Fee")
                            : item.type === "CLEANING_FEE" ? (isAr ? "رسوم نظافة" : "Cleaning Fee")
                            : item.type === "SECURITY_FEE" ? (isAr ? "رسوم حراسة وأمن" : "Security Fee")
                            : item.type === "SECURITY_DEPOSIT" ? (isAr ? "أمانات تأمين صيانة (2020)" : "Security Deposit (2020)")
                            : (isAr ? "تحويل مستحقات مالك" : "Owner Transfer")}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-800 block">{item.ownerName}</span>
                      <span className="text-[10px] text-slate-500">{item.relatedParty}</span>
                    </td>
                    <td className="py-3 px-4">
                      {item.status === "PAID" || item.status === "RECONCILED" || item.status === "COMPLETED" ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {isAr ? "مكتمل ومقفل مالياً" : "Locked & Settled"}
                          </span>
                          {item.verificationStatus === "AI_VERIFIED" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 block w-fit" title="Deterministic AI match verified">
                              <Bot className="w-2.5 h-2.5 text-emerald-600" />
                              AI VERIFIED
                            </span>
                          )}
                          {item.verificationStatus === "MANUALLY_VERIFIED" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-300 block w-fit" title={item.overrideReason || "Manually verified by authorized staff"}>
                              <UserCheck className="w-2.5 h-2.5 text-blue-600" />
                              MANUALLY VERIFIED
                            </span>
                          )}
                          {item.verificationStatus === "OVERRIDDEN" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-300 block w-fit" title={item.overrideReason || "Escalated mismatch override"}>
                              <ShieldAlert className="w-2.5 h-2.5 text-purple-600" />
                              OVERRIDDEN
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Lock className="w-3 h-3 text-amber-600" />
                          {isAr ? "معلق (Pending Deposit)" : "Pending Deposit"}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {item.archiveProof ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          <FileText className="w-3 h-3" />
                          {isAr ? "مرفق بالأرشيف" : "Archived Proof"}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          {isAr ? "لا يوجد إثبات" : "No Proof"}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-left font-mono font-black text-sm text-slate-900">
                      AED {item.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.status === "PAID" ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setViewProofItem(item);
                              setIsViewProofModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-600" />
                            <span>{isAr ? "معاينة القفل" : "View Record"}</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenProofModal(item)}
                            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1 text-xs"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{isAr ? "إرفاق إثبات واعتماد" : "Upload & Settle"}</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Proof Upload & AI/OCR Modal */}
      {isProofModalOpen && targetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-teal-600" />
                <h3 className="font-black text-slate-900 text-base">
                  {isAr ? `إثبات الإيداع وقراءة AI/OCR (${targetItem.transactionNumber})` : `Deposit Proof & AI/OCR Verification`}
                </h3>
              </div>
              <button onClick={() => setIsProofModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">{isAr ? "نوع المعاملة والفئة:" : "Type & Fund:"}</span>
                <strong className="text-slate-900">{targetItem.type} ({targetItem.fundCategory})</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{isAr ? "المبلغ المستهدف:" : "Target Amount:"}</span>
                <strong className="text-teal-600 font-mono text-sm">AED {targetItem.amount.toLocaleString()}</strong>
              </div>
            </div>

            {proofError && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl font-semibold border border-rose-200">
                {proofError}
              </div>
            )}

            <form onSubmit={handleVerifyAndSettleItem} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isAr ? "رفع صورة إيصال الإيداع / ملف PDF *" : "Upload Bank Deposit Receipt / PDF *"}
                </label>
                <div className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-2xl p-4 text-center cursor-pointer transition bg-slate-50">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept="image/*,application/pdf"
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                  />
                  {proofFileName && (
                    <div className="mt-2 text-teal-600 font-bold text-[11px] flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{proofFileName}</span>
                    </div>
                  )}
                </div>
              </div>

              {isOcrAnalyzing && (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-2xl text-teal-800 text-xs flex items-center gap-2 animate-pulse">
                  <div className="w-4 h-4 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
                  <span>{isAr ? "جاري قراءة وتحليل الإيصال بواسطة AI/OCR..." : "Analyzing receipt with AI/OCR..."}</span>
                </div>
              )}

              {ocrResult && (
                <div className={`p-4 border rounded-2xl space-y-3 text-xs ${
                  ocrResult.overallStatus === "MATCH"
                    ? "bg-emerald-50/70 border-emerald-300"
                    : ocrResult.overallStatus === "MISMATCH"
                    ? "bg-rose-50/80 border-rose-300"
                    : "bg-amber-50/70 border-amber-300"
                }`}>
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <span className={`font-bold flex items-center gap-1.5 ${
                      ocrResult.overallStatus === "MATCH"
                        ? "text-emerald-900"
                        : ocrResult.overallStatus === "MISMATCH"
                        ? "text-rose-900"
                        : "text-amber-900"
                    }`}>
                      <ShieldCheck className="w-4 h-4" />
                      {isAr ? "نتيجة مطابقة AI/OCR:" : "AI/OCR Extraction Result:"} 
                      <span className="font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded text-[11px] bg-white border shadow-2xs">
                        [{ocrResult.overallStatus}]
                      </span>
                    </span>
                    {ocrResult.overallStatus === "MATCH" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <Bot className="w-3 h-3 text-emerald-600" />
                        {isAr ? "المسار الأول: معتمد آلياً" : "Path 1: AI Verified"}
                      </span>
                    )}
                  </div>
                  
                  {ocrResult.overallStatus === "FAILED" ? (
                    <div className="text-rose-700 font-medium py-1">
                      {ocrResult.failureReason || (isAr ? "تعذر استخراج بيانات الإيصال آلياً." : "OCR extraction failed.")}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-700 font-mono">
                      <div className={`p-2 rounded-xl border ${ocrResult.amount.status === "MATCH" ? "bg-emerald-100/60 border-emerald-300 text-emerald-900" : ocrResult.amount.status === "MISMATCH" ? "bg-rose-100/70 border-rose-300 text-rose-900" : "bg-white border-slate-200"}`}>
                        <span className="text-[10px] text-slate-500 block">المبلغ المستخرج (Amount):</span>
                        <strong className="text-sm">{ocrResult.amount.extracted ? `AED ${ocrResult.amount.extracted}` : "N/A"}</strong>
                        {ocrResult.amount.status === "MISMATCH" && (
                          <div className="text-[10px] text-rose-700 font-bold mt-0.5">
                            المطلوب (Expected): AED {ocrResult.amount.expected}
                          </div>
                        )}
                      </div>
                      <div className={`p-2 rounded-xl border ${ocrResult.bank.status === "MATCH" ? "bg-emerald-100/60 border-emerald-300 text-emerald-900" : ocrResult.bank.status === "MISMATCH" ? "bg-rose-100/70 border-rose-300 text-rose-900" : "bg-white border-slate-200"}`}>
                        <span className="text-[10px] text-slate-500 block">البنك المستخرج (Bank):</span>
                        <strong>{ocrResult.bank.extracted || "N/A"}</strong>
                      </div>
                      <div className={`col-span-1 md:col-span-2 p-2 rounded-xl border ${ocrResult.reference.status === "MATCH" ? "bg-emerald-100/60 border-emerald-300 text-emerald-900" : ocrResult.reference.status === "MISMATCH" ? "bg-rose-100/70 border-rose-300 text-rose-900" : "bg-white border-slate-200"}`}>
                        <span className="text-[10px] text-slate-500 block">رقم المرجع البنكي (Ref #):</span>
                        <strong>{ocrResult.reference.extracted || "N/A"}</strong>
                      </div>
                      {ocrResult.date && ocrResult.date.extracted && (
                        <div className={`p-2 rounded-xl border ${ocrResult.date.status === "MATCH" ? "bg-emerald-100/60 border-emerald-300 text-emerald-900" : ocrResult.date.status === "MISMATCH" ? "bg-rose-100/70 border-rose-300 text-rose-900" : "bg-white border-slate-200"}`}>
                          <span className="text-[10px] text-slate-500 block">تاريخ الإيداع المستخرج (Date):</span>
                          <strong>{ocrResult.date.extracted}</strong>
                          {ocrResult.date.status === "MISMATCH" && (
                            <div className="text-[10px] text-rose-700 font-bold mt-0.5">
                              المتوقع: {ocrResult.date.expected}
                            </div>
                          )}
                        </div>
                      )}
                      {ocrResult.account && ocrResult.account.extracted && (
                        <div className={`p-2 rounded-xl border ${ocrResult.account.status === "MATCH" ? "bg-emerald-100/60 border-emerald-300 text-emerald-900" : ocrResult.account.status === "MISMATCH" ? "bg-rose-100/70 border-rose-300 text-rose-900" : "bg-white border-slate-200"}`}>
                          <span className="text-[10px] text-slate-500 block">رقم الحساب المستخرج (Account/IBAN):</span>
                          <strong className="text-xs">{ocrResult.account.extracted}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Path 1: Match Message */}
                  {ocrResult.overallStatus === "MATCH" && (
                    <div className="text-xs text-emerald-800 font-semibold bg-emerald-100/50 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{isAr ? "تم التحقق الآلي بنجاح والمطابقة مؤكدة. المعاملة جاهزة للاعتماد والتسوية فوراً." : "Deterministic AI match verified. Ready for automated settlement."}</span>
                    </div>
                  )}

                  {/* Path 2a: Manual Override Panel on OCR Failure or Needs Review */}
                  {(ocrResult.overallStatus === "FAILED" || ocrResult.overallStatus === "NEEDS_REVIEW") && (
                    <div className="bg-white p-3.5 rounded-2xl border border-amber-300 space-y-3 mt-2 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-amber-100 pb-2">
                        <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                          <UserCheck className="w-4 h-4 text-amber-700" />
                          <span>{isAr ? "المسار الثاني — الاعتماد اليدوي المخول (Manual Override)" : "Path 2 — Manual Override Policy"}</span>
                        </div>
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-200">
                          {isAr ? "سياسة استمرارية العمل" : "Production Reality Policy"}
                        </span>
                      </div>

                      <p className="text-[11px] text-amber-800 leading-relaxed bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/70">
                        {isAr
                          ? "الـAI/OCR هو أداة تحقق ومطابقة، لكنه ليس نقطة فشل مطلقة تمنع الموظف المخول من إكمال العمل عند تعذر القراءة الآلية. يمكنك المراجعة والاعتماد يدوياً مع ذكر السبب الإلزامي."
                          : "AI/OCR is a verification tool, not a single point of failure that prevents an authorized employee from completing work. You may review and manually verify with a mandatory reason."}
                      </p>

                      {isStandardOverrideAuthorized(currentUser?.role) ? (
                        <div className="space-y-3 pt-1">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">
                                {isAr ? "نوع حالة التجاوز *" : "Override Type *"}
                              </label>
                              <select
                                value={overrideType}
                                onChange={(e) => setOverrideType(e.target.value as VerificationOverrideType)}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                              >
                                <option value="OCR_FAILED">{isAr ? "فشل استخراج OCR (OCR Failed)" : "OCR Failed"}</option>
                                <option value="AI_UNAVAILABLE">{isAr ? "خدمة الذكاء الاصطناعي غير متاحة (AI Unavailable)" : "AI Unavailable"}</option>
                                <option value="DOCUMENT_UNREADABLE">{isAr ? "مستند غير مقروء آلياً (Document Unreadable)" : "Document Unreadable"}</option>
                                <option value="SERVICE_ERROR">{isAr ? "خطأ في الخدمة السحابية (Service Error)" : "Service Error"}</option>
                                <option value="OTHER">{isAr ? "سبب تشغيلي آخر (Other Reason)" : "Other Reason"}</option>
                              </select>
                            </div>
                            <div className="flex items-end">
                              <span className="text-[10px] text-slate-500 pb-2">
                                {isAr ? `المخول بالاعتماد: ${currentUser?.nameAr || currentUser?.nameEn || "المستخدم الحالي"}` : `Authorized: ${currentUser?.nameEn || "Current User"}`}
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="block font-bold text-slate-700 mb-1">
                              {isAr ? "سبب الاعتماد اليدوي الإلزامي *" : "Mandatory Override Reason *"}
                            </label>
                            <textarea
                              value={overrideReason}
                              onChange={(e) => setOverrideReason(e.target.value)}
                              rows={2}
                              placeholder={isAr ? "اذكر سبب الاعتماد اليدوي وتأكيد مطابقة الإيصال ومبلغ الحساب..." : "Enter mandatory reason for manual verification..."}
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500"
                              required
                            />
                          </div>

                          <label className="flex items-start gap-2 text-slate-700 cursor-pointer text-[11px] font-semibold bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                            <input
                              type="checkbox"
                              checked={overrideConfirmed}
                              onChange={(e) => setOverrideConfirmed(e.target.checked)}
                              className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                            />
                            <span>
                              {isAr
                                ? "أقر بمطابقة الإثبات المرفق يدويًا والتأكد التام من صحة المستند والمبلغ المستحق، وسيتم توثيق هذا الإجراء رسميًا في سجل التدقيق."
                                : "I confirm that I manually verified the attached proof and matched the amount, and this action will be logged in the audit trail."}
                            </span>
                          </label>
                        </div>
                      ) : (
                        <div className="p-3 bg-rose-50 text-rose-800 rounded-xl border border-rose-200 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>{isAr ? "تنبيه رقابي: يتطلب الاعتماد اليدوي صلاحية موظف مالي أو مدير مخول (Finance / Manager / Super Admin)." : "Permission required: Manual verification requires Finance or Manager role."}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Path 2b: Escalated Mismatch Override Panel */}
                  {ocrResult.overallStatus === "MISMATCH" && (
                    <div className="bg-white p-3.5 rounded-2xl border border-rose-300 space-y-3 mt-2 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-rose-100 pb-2">
                        <div className="flex items-center gap-1.5 text-rose-900 font-bold">
                          <ShieldAlert className="w-4 h-4 text-rose-700" />
                          <span>{isAr ? "حظر رقابي: رصد عدم تطابق مالي (MISMATCH DETECTED)" : "Security Lock: Financial Mismatch Detected"}</span>
                        </div>
                        <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded border border-rose-200">
                          {isAr ? "مراجعة استثنائية" : "High-Level Escalation"}
                        </span>
                      </div>

                      <p className="text-[11px] text-rose-800 leading-relaxed bg-rose-50/60 p-2.5 rounded-xl border border-rose-200/70">
                        {isAr
                          ? "حظر رقابي صارم: يمنع الاعتماد اليدوي العادي عند وجود عدم تطابق في المبالغ أو البنك. يتطلب تجاوز عدم التطابق تدخلاً استثنائياً مصرحاً به حصراً للمشرف العام أو مدير النظام مع التوثيق الجنائي."
                          : "Strict Policy: Normal manual override is blocked when data mismatches. Overriding a mismatch requires high-level executive authorization (Super Admin / System Owner) and full forensic audit logging."}
                      </p>

                      {isHighLevelOverrideAuthorized(currentUser?.role) ? (
                        <div className="space-y-3 pt-1 border-t border-purple-100">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-purple-900 flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
                              {isAr ? "نموذج التجاوز الإداري الاستثنائي (Executive Mismatch Override)" : "Executive Mismatch Override Form"}
                            </span>
                            <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded border border-purple-200">
                              صلاحية إدارية عليا
                            </span>
                          </div>

                          <div>
                            <label className="block font-bold text-slate-700 mb-1">
                              {isAr ? "التبرير الإداري الإلزامي لتجاوز عدم التطابق *" : "Mandatory High-Level Justification *"}
                            </label>
                            <textarea
                              value={mismatchJustification}
                              onChange={(e) => setMismatchJustification(e.target.value)}
                              rows={2}
                              placeholder={isAr ? "اكتب تفصيلاً سبب تجاوز عدم التطابق المالي ومسوغات الاعتماد الرقابي..." : "Enter detailed high-level justification for overriding this mismatch..."}
                              className="w-full px-3 py-2 border border-purple-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500"
                              required
                            />
                          </div>

                          <label className="flex items-start gap-2 text-slate-700 cursor-pointer text-[11px] font-semibold bg-purple-50/50 p-2.5 rounded-xl border border-purple-200">
                            <input
                              type="checkbox"
                              checked={mismatchConfirmed}
                              onChange={(e) => setMismatchConfirmed(e.target.checked)}
                              className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                            />
                            <span>
                              {isAr
                                ? "أقر بصفتي الإدارية العليا بتحمل المسؤولية الرقابية الكاملة عن اعتماد هذا التجاوز المالي، وسيتم تسجيل الواقعة بالكامل في سجل التدقيق الجنائي."
                                : "I confirm as an executive that I assume full audit responsibility for overriding this mismatch, and this event will be permanently recorded in the forensic audit ledger."}
                            </span>
                          </label>
                        </div>
                      ) : (
                        <div className="p-3 bg-rose-100/70 text-rose-900 rounded-xl border border-rose-300 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                          <span>{isAr ? "التسوية محظورة: لا تملك الصلاحية الإدارية العليا لتجاوز عدم التطابق (مقتصر على المشرف العام ومدير النظام). يرجى إرفاق إيصال صحيح." : "Settlement blocked: You do not possess executive authority to override an AI mismatch. Please attach the correct receipt."}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">{isAr ? "ملاحظات التدقيق المالي والإداري" : "Financial Audit Notes"}</label>
                <textarea
                  value={proofNotes}
                  onChange={(e) => setProofNotes(e.target.value)}
                  rows={2}
                  placeholder={isAr ? "اكتب ملاحظات الاعتماد والقفل المالي..." : "Enter audit locking notes..."}
                  className="w-full px-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsProofModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition"
                >
                  {isAr ? "إغلاق" : "Cancel"}
                </button>

                {/* Conditional Submit Button Based on Verification Path */}
                {ocrResult?.overallStatus === "MATCH" && (
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md flex items-center gap-1.5 transition"
                  >
                    <Bot className="w-4 h-4" />
                    <span>{isAr ? "اعتماد وتوثيق آلي (AI Verified - Post)" : "Approve & Post (AI Verified)"}</span>
                  </button>
                )}

                {(ocrResult?.overallStatus === "FAILED" || ocrResult?.overallStatus === "NEEDS_REVIEW") && (
                  <button
                    type="submit"
                    disabled={!overrideReason.trim() || !overrideConfirmed || !isStandardOverrideAuthorized(currentUser?.role)}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-md flex items-center gap-1.5 transition cursor-pointer disabled:cursor-not-allowed"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>{isAr ? "اعتماد وتسوية يدوية (Manually Verify & Settle)" : "Manually Verify & Settle"}</span>
                  </button>
                )}

                {ocrResult?.overallStatus === "MISMATCH" && (
                  <button
                    type="submit"
                    disabled={!mismatchJustification.trim() || !mismatchConfirmed || !isHighLevelOverrideAuthorized(currentUser?.role)}
                    className="px-5 py-2 bg-purple-700 hover:bg-purple-600 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-md flex items-center gap-1.5 transition cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>{isAr ? "اعتماد استثنائي لتجاوز عدم التطابق (Override Mismatch)" : "Approve High-Level Mismatch Override"}</span>
                  </button>
                )}

                {!ocrResult && (
                  <button
                    type="submit"
                    disabled={isOcrAnalyzing}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-md flex items-center gap-1.5 transition"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isAr ? "اعتماد، إرفاق وقفل المعاملة (Lock & Post)" : "Approve, Lock & Post"}</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Read-Only View Proof Modal */}
      {isViewProofModalOpen && viewProofItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-slate-900 text-base">
                  {isAr ? `سجل المعاملة المقفلة مالياً (${viewProofItem.transactionNumber})` : `Locked Transaction Record`}
                </h3>
              </div>
              <button onClick={() => setIsViewProofModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 text-xs space-y-2.5">
              <div className="flex justify-between">
                <span className="text-slate-500">{isAr ? "نوع المعاملة:" : "Type:"}</span>
                <strong className="text-slate-900">{viewProofItem.type}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{isAr ? "المبلغ المقفل:" : "Locked Amount:"}</span>
                <strong className="text-emerald-700 font-mono text-base font-black">AED {viewProofItem.amount.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{isAr ? "حالة التحقق:" : "Verification Status:"}</span>
                <div>
                  {viewProofItem.verificationStatus === "AI_VERIFIED" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <Bot className="w-3 h-3 text-emerald-600" />
                      AI VERIFIED
                    </span>
                  )}
                  {viewProofItem.verificationStatus === "MANUALLY_VERIFIED" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                      <UserCheck className="w-3 h-3 text-blue-600" />
                      MANUALLY VERIFIED
                    </span>
                  )}
                  {viewProofItem.verificationStatus === "OVERRIDDEN" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                      <ShieldAlert className="w-3 h-3 text-purple-600" />
                      OVERRIDDEN
                    </span>
                  )}
                  {(!viewProofItem.verificationStatus || viewProofItem.verificationStatus === "UNVERIFIED") && (
                    <span className="text-slate-600 font-semibold">{isAr ? "موثق بالإثبات" : "Proof Attached"}</span>
                  )}
                </div>
              </div>
              {viewProofItem.overrideReason && (
                <div className="pt-2 border-t border-emerald-200/60">
                  <span className="text-slate-500 block text-[10px] font-bold">{isAr ? "سبب الاعتماد اليدوي / التجاوز:" : "Override Reason:"}</span>
                  <p className="text-slate-800 font-medium text-[11px] bg-white p-2 rounded-lg border border-emerald-200 mt-1">
                    {viewProofItem.overrideReason}
                  </p>
                </div>
              )}
              {viewProofItem.verifiedByName && (
                <div className="flex justify-between pt-1 text-[11px]">
                  <span className="text-slate-500">{isAr ? "المعتمد:" : "Verified By:"}</span>
                  <span className="font-bold text-slate-800">{viewProofItem.verifiedByName}</span>
                </div>
              )}
            </div>

            {(viewProofItem.archiveProof?.previewUrl || viewProofItem.archiveProof?.driveWebViewLink || (viewProofItem.archiveProof as any)?.fileUrl) && (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">{isAr ? "مستند الإثبات المؤرشف:" : "Archived Proof Document:"}</span>
                <a
                  href={viewProofItem.archiveProof.previewUrl || viewProofItem.archiveProof.driveWebViewLink || (viewProofItem.archiveProof as any).fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 rounded-lg font-bold flex items-center gap-1 transition"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>{isAr ? "عرض المستند" : "View File"}</span>
                </a>
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-[11px] text-slate-600">
              {isAr ? "ملاحظة الرقابة المالية: لا يمكن تعديل أو حذف أي معاملة مالية بعد قفلها. أي تصحيح يتم حصراً عبر قيد عكسي (Reversal / Adjustment)." : "Financial Control: Saved financial records are immutable. Corrections require formal Reversal / Adjustment."}
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setIsViewProofModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                {isAr ? "إغلاق" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
