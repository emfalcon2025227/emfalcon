import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  CreditCard,
  FolderKey,
  ShieldCheck,
  Building,
  User,
  Calendar,
  DollarSign,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Plus,
  Trash2,
  ExternalLink,
  X,
  Scan,
  Search,
  RefreshCw,
  Check,
  ChevronRight,
  Eye,
  Lock,
  UserCheck,
  Sparkles,
} from "lucide-react";
import { DocumentPreviewModal, PreviewableDocument } from "../common/DocumentPreviewModal";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import {
  isOccupyingLeaseStatus,
  validateUnitAvailabilityForLease,
  getUnitEffectiveOccupancy
} from "../../utils/unitOccupancyGovernance";
import { useAuth } from "../../context/AuthContext";
import { 
  calculateCommissionAmount, 
  generateCommissionBusinessKey, 
  resolveAdministrativeFeePolicy,
  DEFAULT_COMMISSION_SETTINGS
} from "../../services/financialEngine";
import { 
  Lease, 
  LeaseExpenseItem, 
  PaymentMethod, 
  Tenant,
  AdminFeeExemptionPolicy 
} from "../../types";
import { Modal } from "../common/Modal";
import { Badge } from "../common/Badge";
import { SearchableSelect } from "../common/SearchableSelect";
import { getPropertyTypeLabel } from "../../data/propertyOptions";
import { optimizeDocument } from "../../services/documentOptimizer";
import { ScannerModal } from "../cheques/ScannerModal";
import { AddBankModal } from "../cheques/AddBankModal";
import { getAllUaeBanks, saveCustomBank } from "../../utils/bankUtils";
import { normalizeChequeOCR } from "../../utils/ocrChequeMapper";
import { UaeBank } from "../../data/uaeBanks";
import { SmartDocumentCaptureModal } from "../ai/SmartDocumentCaptureModal";
import { ExtractionResult } from "../../types/documentIntelligence";
import { DocumentStorageService } from "../../services/documentStorageService";
import { SmartChequeConflictModal, ChequeConflictData } from "../cheques/SmartChequeConflictModal";
import { BatchChequeOcrModal, StagedBatchCheque } from "../cheques/BatchChequeOcrModal";
import { validateLeaseChequeSchedule } from "../../utils/leaseValidation";

interface LeaseInstallmentFormRow {
  id: string;
  installmentIndex: number;
  dueDate: string;
  amount: number;
  paymentMethod: "CHEQUE" | "CASH" | "BANK_TRANSFER" | "CARD";
  chequeNumber: string;
  bankName: string;
  drawerName?: string;
  chequeImage?: string;
  status: "ACTIVE" | "PAID";
  sourcePdfId?: string;
  sourcePdfFileName?: string;
  sourcePdfPageNumber?: number;
  sourceCroppedRegion?: { x: number; y: number; width: number; height: number };
  ingestionSessionId?: string;
}

interface OcrWarningState {
  rowId: string;
  extractedNum: string;
  extractedBank: string;
  extractedDate: string;
  extractedDrawer: string;
  extractedAmount: number;
  currentAmount: number;
  base64: string;
}

interface LeaseEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingLease: Lease | null;
  isRenewal?: boolean;
  renewalSourceLease?: Lease | null;
}

const UAE_BANKS = [
  "بنك الإمارات دبي الوطني (Emirates NBD)",
  "بنك أبوظبي الأول (FAB)",
  "بنك دبي الإسلامي (DIB)",
  "بنك أبوظبي التجاري (ADCB)",
  "بنك المشرق (Mashreq Bank)",
  "مصرف أبوظبي الإسلامي (ADIB)",
  "بنك الشارقة الإسلامي (SIB)",
  "بنك رأس الخيمة الوطني (RAKBANK)",
  "بنك دبي التجاري (CBD)",
  "مصرف عجمان (Ajman Bank)",
  "بنك أم القيوين الوطني (NBQ)",
  "بنك آخر (Other Bank)"
];

const DOCUMENT_CATEGORIES = [
  { id: "EMIRATES_ID", labelAr: "صورة بطاقة الهوية", labelEn: "Emirates ID Copy", target: "TENANT" },
  { id: "PASSPORT", labelAr: "صورة جواز السفر", labelEn: "Passport Copy", target: "TENANT" },
  { id: "TITLE_DEED", labelAr: "صورة سند الملكية", labelEn: "Title Deed Copy", target: "PROPERTY" },
  { id: "SITE_PLAN", labelAr: "صورة الخريطة", labelEn: "Site Plan Copy", target: "PROPERTY" },
  { id: "NATIONALITY", labelAr: "صورة الجنسية / خلاصة القيد", labelEn: "Family Book / Nationality Copy", target: "OWNER" },
  { id: "TEMP_CONTRACT", labelAr: "عقد الإيجار المؤقت", labelEn: "Temporary Lease Draft", target: "LEASE" },
  { id: "AUTHENTICATED_EJARI", labelAr: "العقد الموثق (إيجاري / توثيق)", labelEn: "Authenticated Ejari Document", target: "LEASE" },
  { id: "OTHER", labelAr: "وثيقة أخرى", labelEn: "Other Document", target: "LEASE" }
];

export const LeaseEditorModal: React.FC<LeaseEditorModalProps> = ({
  isOpen,
  onClose,
  editingLease,
  isRenewal,
  renewalSourceLease
}) => {
  const { t, language } = useLanguage();
  const {
    leases,
    properties,
    units,
    tenants,
    owners,
    archive,
    addLease,
    updateLease,
    updateOwner,
    updateTenant,
    addCheque,
    cheques,
    addArchiveItem,
    deleteArchiveItem,
    extractChequeOCR,
    addNotification,
    addCommissionObligation,
    collectAdministrativeFee,
    collectSecurityDeposit,
    commissions,
    vatRates,
    getNextLeaseNumber
  } = useData();
  const { currentUser, hasPermission } = useAuth();
  const canEditFinancials = hasPermission("EDIT_SAVED_FINANCIAL_RECORDS");

  // Tab navigation: 1 = Basic, 2 = Installments & Cheques, 3 = Archive, 4 = Approval & Summary
  const [activeTab, setActiveTab] = useState<1 | 2 | 3 | 4>(1);

  // Form Basic Fields
  const [leaseNumber, setLeaseNumber] = useState("");
  const [ejariNumber, setEjariNumber] = useState("");
  const [contractType, setContractType] = useState<"RESIDENTIAL" | "COMMERCIAL">("RESIDENTIAL");
  const [tenantId, setTenantId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [annualRent, setAnnualRent] = useState<number | string>("");
  const [paymentFrequency, setPaymentFrequency] = useState<Lease["paymentFrequency"]>("QUARTERLY_4_CHEQUES");
  const [securityDeposit, setSecurityDeposit] = useState<number | string>("");
  const [securityDepositPaymentMethod, setSecurityDepositPaymentMethod] = useState<PaymentMethod | "">("");
  const [securityDepositBankName, setSecurityDepositBankName] = useState("");
  const [securityDepositChequeNumber, setSecurityDepositChequeNumber] = useState("");
  const [securityDepositIsUndatedCheque, setSecurityDepositIsUndatedCheque] = useState(false);
  const [securityDepositTransactionRef, setSecurityDepositTransactionRef] = useState("");

  const [contractStatus, setContractStatus] = useState<Lease["contractStatus"]>("ACTIVE");
  const [customInstallmentsCount, setCustomInstallmentsCount] = useState<number>(5);

  // Temporary record ID for attachments when creating a new lease
  const [tempRecordId, setTempRecordId] = useState("");
  const currentRecordId = editingLease ? editingLease.id : tempRecordId;

  // Installments and Cheques Schedule State
  const [installments, setInstallments] = useState<LeaseInstallmentFormRow[]>([]);
  const [leaseExpenses, setLeaseExpenses] = useState<LeaseExpenseItem[]>([]);
  const [scanningRowId, setScanningRowId] = useState<string | null>(null);
  const [ocrWarning, setOcrWarning] = useState<OcrWarningState | null>(null);
  const [conflictModalState, setConflictModalState] = useState<{
    rowId: string;
    conflictData: ChequeConflictData;
    base64: string;
  } | null>(null);
  const [isBatchOcrModalOpen, setIsBatchOcrModalOpen] = useState(false);
  const [scannerRowTargetId, setScannerRowTargetId] = useState<string | null>(null);
  const [isAddBankModalOpen, setIsAddBankModalOpen] = useState(false);
  const [activeBankRowId, setActiveBankRowId] = useState<string | null>(null);

  // AI Document Capture State
  const [isAiCaptureOpen, setIsAiCaptureOpen] = useState(false);
  const [aiCaptureTargetId, setAiCaptureTargetId] = useState<string | null>(null);

  const handleAiCaptureApprove = (
    result: any,
    imageBase64: string,
    mimeType: string,
    saveToArchive: boolean
  ) => {
    if (!aiCaptureTargetId) return;

    const targetRow = installments.find((r) => r.id === aiCaptureTargetId);
    const normalized = normalizeChequeOCR(result, language);

    const chequeNum = normalized.chequeNumber || targetRow?.chequeNumber || "";
    const bank = normalized.bankName || targetRow?.bankName || "";
    const extractedAmount = normalized.amount;
    const currentAmount = targetRow ? targetRow.amount : 0;
    const date = normalized.dueDate || targetRow?.dueDate || "";
    const drawer = normalized.drawerName || result.accountHolder?.value || result.drawer?.value || targetRow?.drawerName || "";

    if (extractedAmount > 0 && Math.abs(extractedAmount - currentAmount) > 0.01) {
      setConflictModalState({
        rowId: aiCaptureTargetId,
        conflictData: {
          field: "amount",
          original: {
            amount: currentAmount,
            dueDate: targetRow?.dueDate,
            bankName: targetRow?.bankName,
            chequeNumber: targetRow?.chequeNumber,
            drawerName: targetRow?.drawerName,
          },
          extracted: {
            amount: extractedAmount,
            dueDate: date,
            bankName: bank,
            chequeNumber: chequeNum,
            drawerName: drawer,
          },
        },
        base64: imageBase64,
      });
    } else {
      setInstallments((prev) =>
        prev.map((r) => {
          if (r.id !== aiCaptureTargetId) return r;
          return {
            ...r,
            chequeNumber: chequeNum,
            bankName: bank,
            amount: extractedAmount > 0 ? extractedAmount : currentAmount,
            dueDate: date,
            drawerName: drawer,
            chequeImage: imageBase64,
          };
        })
      );
    }
    
    setIsAiCaptureOpen(false);
    setAiCaptureTargetId(null);
  };
  const [bankList, setBankList] = useState<UaeBank[]>([]);

  useEffect(() => {
    if (isOpen) {
      setBankList(getAllUaeBanks());
    }
  }, [isOpen]);

  // Archive & Attachment Upload State
  const [selectedDocCategory, setSelectedDocCategory] = useState("EMIRATES_ID");
  const [selectedTargetEntity, setSelectedTargetEntity] = useState<"TENANT" | "OWNER" | "PROPERTY" | "LEASE">("TENANT");
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<PreviewableDocument | null>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const tempContractInputRef = useRef<HTMLInputElement>(null);
  const ejariContractInputRef = useRef<HTMLInputElement>(null);
  const ownerDocInputRef = useRef<HTMLInputElement>(null);
  const tenantDocInputRef = useRef<HTMLInputElement>(null);
  const propertyDocInputRef = useRef<HTMLInputElement>(null);

  const handlePreviewDoc = (doc: any) => {
    if (!doc) return;
    setPreviewDocument({
      id: doc.id,
      fileName: doc.fileName || doc.title || "document.pdf",
      title: doc.fileName || doc.title,
      category: doc.category,
      fileType: doc.fileType || doc.mimeType,
      mimeType: doc.fileType || doc.mimeType,
      fileSize: doc.fileSize,
      previewUrl: doc.previewUrl,
      driveFileId: doc.driveFileId,
      driveWebViewLink: doc.driveWebViewLink,
      fileHash: doc.fileHash,
    });
  };

  const handleDownloadDoc = async (doc: any) => {
    if (!doc) return;
    await DocumentStorageService.downloadArchiveItem({
      id: doc.id,
      fileName: doc.fileName,
      fileHash: doc.fileHash,
      previewUrl: doc.previewUrl,
      driveFileId: doc.driveFileId,
      driveWebViewLink: doc.driveWebViewLink,
      fileType: doc.fileType,
    });
  };

  // Pre-submission confirmation
  const [isVerified, setIsVerified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Optional Office Commission / Administrative Fees
  const [includeAdminFees, setIncludeAdminFees] = useState(false);
  const [ownerFeeEnabled, setOwnerFeeEnabled] = useState(true);
  const [ownerFeeBasis, setOwnerFeeBasis] = useState<"PERCENTAGE_OF_RENT" | "FIXED_AMOUNT">("PERCENTAGE_OF_RENT");
  const [ownerFeeRate, setOwnerFeeRate] = useState<number | string>(5.0);
  const [ownerFeeFixed, setOwnerFeeFixed] = useState<number | string>("");
  const [ownerFeeDueDate, setOwnerFeeDueDate] = useState("");
  const [ownerFeeImmediateCollection, setOwnerFeeImmediateCollection] = useState(false);
  const [ownerFeePaymentMethod, setOwnerFeePaymentMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [ownerFeeReference, setOwnerFeeReference] = useState("");

  const [tenantFeeEnabled, setTenantFeeEnabled] = useState(true);
  const [tenantFeeBasis, setTenantFeeBasis] = useState<"PERCENTAGE_OF_RENT" | "FIXED_AMOUNT">("PERCENTAGE_OF_RENT");
  const [tenantFeeRate, setTenantFeeRate] = useState<number | string>(5.0);
  const [tenantFeeFixed, setTenantFeeFixed] = useState<number | string>("");
  const [tenantFeeDueDate, setTenantFeeDueDate] = useState("");
  const [tenantFeeImmediateCollection, setTenantFeeImmediateCollection] = useState(false);
  const [tenantFeePaymentMethod, setTenantFeePaymentMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [tenantFeeReference, setTenantFeeReference] = useState("");

  // Phase 5.3: Admin Fee Exemption States
  const [ownerAdminFeeExempt, setOwnerAdminFeeExempt] = useState(false);
  const [ownerAdminFeeExemptionReason, setOwnerAdminFeeExemptReason] = useState<AdminFeeExemptionPolicy["exemptionReason"]>("MANAGEMENT_DECISION");
  const [ownerAdminFeeExemptionNote, setOwnerAdminFeeExemptNote] = useState("");
  const [ownerAdminFeeApproved, setOwnerAdminFeeApproved] = useState(false);

  const [tenantAdminFeeExempt, setTenantAdminFeeExempt] = useState(false);
  const [tenantAdminFeeExemptionReason, setTenantAdminFeeExemptReason] = useState<AdminFeeExemptionPolicy["exemptionReason"]>("MANAGEMENT_DECISION");
  const [tenantAdminFeeExemptionNote, setTenantAdminFeeExemptNote] = useState("");
  const [tenantAdminFeeApproved, setTenantAdminFeeApproved] = useState(false);

  const canApproveExemption = true;

  // Update fee due dates when startDate changes
  useEffect(() => {
    if (startDate) {
      setOwnerFeeDueDate(startDate);
      setTenantFeeDueDate(startDate);
    }
  }, [startDate]);

  // Initialize or reset form when modal opens or editingLease/renewalSourceLease changes
  useEffect(() => {
    if (!isOpen) return;

    setActiveTab(1);
    setIsVerified(false);
    setIsSubmitting(false);

    const leaseToLoad = isRenewal ? renewalSourceLease : editingLease;

    if (leaseToLoad) {
      setIncludeAdminFees(false);
      setOwnerFeeEnabled(true);
      setOwnerFeeBasis("PERCENTAGE_OF_RENT");
      
      const ownerPolicy = resolveAdministrativeFeePolicy("OWNER", leaseToLoad.ownerId, !isRenewal ? leaseToLoad.adminFeePolicy : undefined, DEFAULT_COMMISSION_SETTINGS, owners, tenants);
      setOwnerFeeRate(ownerPolicy.rate);
      
      setOwnerFeeFixed("");
      setTenantFeeEnabled(true);
      setTenantFeeBasis("PERCENTAGE_OF_RENT");
      
      const tenantPolicy = resolveAdministrativeFeePolicy("TENANT", leaseToLoad.tenantId, !isRenewal ? leaseToLoad.adminFeePolicy : undefined, DEFAULT_COMMISSION_SETTINGS, owners, tenants);
      setTenantFeeRate(tenantPolicy.rate);
      
      setTenantFeeFixed("");

      // Phase 5.3: Load Exemption Policy
      if (leaseToLoad.adminFeePolicy && !isRenewal) {
        if (leaseToLoad.adminFeePolicy.owner) {
          setOwnerAdminFeeExempt(leaseToLoad.adminFeePolicy.owner.isExempt);
          setOwnerAdminFeeExemptReason(leaseToLoad.adminFeePolicy.owner.exemptionReason || "MANAGEMENT_DECISION");
          setOwnerAdminFeeExemptNote(leaseToLoad.adminFeePolicy.owner.exemptionNote || "");
          setOwnerAdminFeeApproved(leaseToLoad.adminFeePolicy.owner.approvalStatus === "APPROVED");
        }
        if (leaseToLoad.adminFeePolicy.tenant) {
          setTenantAdminFeeExempt(leaseToLoad.adminFeePolicy.tenant.isExempt);
          setTenantAdminFeeExemptReason(leaseToLoad.adminFeePolicy.tenant.exemptionReason || "MANAGEMENT_DECISION");
          setTenantAdminFeeExemptNote(leaseToLoad.adminFeePolicy.tenant.exemptionNote || "");
          setTenantAdminFeeApproved(leaseToLoad.adminFeePolicy.tenant.approvalStatus === "APPROVED");
        }
      } else {
        // Renewal Safety: Reset exemptions on renewal
        setOwnerAdminFeeExempt(false);
        setTenantAdminFeeExempt(false);
        setOwnerAdminFeeApproved(false);
        setTenantAdminFeeApproved(false);
      }

      setLeaseNumber(isRenewal ? getNextLeaseNumber() : (leaseToLoad.leaseNumber || "")); // Generate sequential number for renewal
      setEjariNumber(isRenewal ? "" : (leaseToLoad.ejariNumber || ""));
      setTempRecordId(isRenewal ? `temp-lease-${Date.now()}` : leaseToLoad.id);
      setPropertyId(leaseToLoad.propertyId || "");
      setUnitId(leaseToLoad.unitId || "");
      setTenantId(leaseToLoad.tenantId || "");
      let renewalStart = "";
      if (isRenewal && leaseToLoad.endDate) {
        const nextDay = new Date(leaseToLoad.endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        renewalStart = nextDay.toISOString().split("T")[0];
      }

      setStartDate(isRenewal ? renewalStart : (leaseToLoad.startDate || ""));
      
      let renewalEnd = "";
      if (isRenewal && renewalStart) {
        const nextYear = new Date(renewalStart);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        nextYear.setDate(nextYear.getDate() - 1);
        renewalEnd = nextYear.toISOString().split("T")[0];
      }
      setEndDate(isRenewal ? renewalEnd : (leaseToLoad.endDate || ""));
      setAnnualRent(leaseToLoad.annualRent !== undefined ? leaseToLoad.annualRent : "");
      
      const rawFreq = (leaseToLoad.paymentFrequency as any) || "QUARTERLY_4_CHEQUES";
      setPaymentFrequency(rawFreq);
      setSecurityDeposit(leaseToLoad.securityDeposit !== undefined ? leaseToLoad.securityDeposit : "");
      setSecurityDepositPaymentMethod(leaseToLoad.securityDepositPaymentMethod || "");
      setSecurityDepositBankName(leaseToLoad.securityDepositBankName || "");
      setSecurityDepositChequeNumber(leaseToLoad.securityDepositChequeNumber || "");
      setSecurityDepositIsUndatedCheque(leaseToLoad.securityDepositIsUndatedCheque || false);
      setSecurityDepositTransactionRef(leaseToLoad.securityDepositReceiptNumber || "");
      setContractStatus(isRenewal ? "ACTIVE" : (leaseToLoad.contractStatus || "ACTIVE"));
      setLeaseExpenses(isRenewal ? [] : (leaseToLoad.leaseExpenses || []));

      // Load existing cheques for this lease
      const existingCheques = cheques.filter((c) => c.leaseId === leaseToLoad.id);
      if (existingCheques.length > 0 && !isRenewal) {
        setInstallments(
          existingCheques.map((c, idx) => ({
            id: c.id,
            installmentIndex: idx + 1,
            dueDate: c.dueDate || c.chequeDate || leaseToLoad.startDate,
            amount: c.amount || 0,
            paymentMethod: "CHEQUE",
            chequeNumber: c.chequeNumber || "",
            bankName: c.bankName || "",
            drawerName: c.drawerName || "",
            status: c.status === "COLLECTED" || c.status === "CLEARED" ? "PAID" : "ACTIVE"
          }))
        );
        if (!["ONE_CHEQUE", "TWO_CHEQUES", "THREE_CHEQUES", "QUARTERLY_4_CHEQUES", "FIVE_CHEQUES", "BI_MONTHLY_6_CHEQUES", "SEVEN_CHEQUES", "EIGHT_CHEQUES", "NINE_CHEQUES", "TEN_CHEQUES", "ELEVEN_CHEQUES", "MONTHLY_12_CHEQUES"].includes(rawFreq)) {
          setCustomInstallmentsCount(existingCheques.length || 5);
        }
      } else {
        generateDefaultInstallments(
          leaseToLoad.annualRent || 0,
          leaseToLoad.paymentFrequency || "QUARTERLY_4_CHEQUES",
          leaseToLoad.startDate || new Date().toISOString().split("T")[0]
        );
      }
    } else {
      setIncludeAdminFees(false);
      setOwnerFeeEnabled(true);
      setOwnerFeeBasis("PERCENTAGE_OF_RENT");
      
      const ownerPolicy = resolveAdministrativeFeePolicy("OWNER", undefined, undefined, DEFAULT_COMMISSION_SETTINGS, owners, tenants);
      setOwnerFeeRate(ownerPolicy.rate);
      
      setOwnerFeeFixed("");
      setTenantFeeEnabled(true);
      setTenantFeeBasis("PERCENTAGE_OF_RENT");
      
      const tenantPolicy = resolveAdministrativeFeePolicy("TENANT", undefined, undefined, DEFAULT_COMMISSION_SETTINGS, owners, tenants);
      setTenantFeeRate(tenantPolicy.rate);
      
      setTenantFeeFixed("");

      // Phase 5.3: Reset Exemption states for new lease
      setOwnerAdminFeeExempt(false);
      setOwnerAdminFeeApproved(false);
      setOwnerAdminFeeExemptNote("");
      setTenantAdminFeeExempt(false);
      setTenantAdminFeeApproved(false);
      setTenantAdminFeeExemptNote("");

      setLeaseNumber(getNextLeaseNumber());
      setTempRecordId(`temp-lease-${Date.now()}`);
      setEjariNumber("");
      setPropertyId("");
      setUnitId("");
      setTenantId("");
      const today = new Date().toISOString().split("T")[0];
      setStartDate(today);
      const nextY = new Date();
      nextY.setFullYear(nextY.getFullYear() + 1);
      nextY.setDate(nextY.getDate() - 1);
      setEndDate(nextY.toISOString().split("T")[0]);
      setAnnualRent("");
      setPaymentFrequency("QUARTERLY_4_CHEQUES");
      setCustomInstallmentsCount(5);
      setSecurityDeposit("");
      setSecurityDepositPaymentMethod("");
      setSecurityDepositBankName("");
      setSecurityDepositChequeNumber("");
      setSecurityDepositIsUndatedCheque(false);
      setSecurityDepositTransactionRef("");
      setContractStatus("PENDING_AUDIT");
      setInstallments([]);
      setLeaseExpenses([]);
    }
  }, [isOpen, editingLease, renewalSourceLease, isRenewal]);

  // Helper to parse payment count for standard and custom frequencies
  const getInstallmentCount = (freqVal: string, customVal?: number): number => {
    if (freqVal === "ONE_CHEQUE") return 1;
    if (freqVal === "TWO_CHEQUES") return 2;
    if (freqVal === "THREE_CHEQUES") return 3;
    if (freqVal === "QUARTERLY_4_CHEQUES") return 4;
    if (freqVal === "FIVE_CHEQUES") return 5;
    if (freqVal === "BI_MONTHLY_6_CHEQUES") return 6;
    if (freqVal === "SEVEN_CHEQUES") return 7;
    if (freqVal === "EIGHT_CHEQUES") return 8;
    if (freqVal === "NINE_CHEQUES") return 9;
    if (freqVal === "TEN_CHEQUES") return 10;
    if (freqVal === "ELEVEN_CHEQUES") return 11;
    if (freqVal === "MONTHLY_12_CHEQUES") return 12;
    if (freqVal === "CUSTOM_COUNT") return customVal && customVal > 0 ? customVal : (customInstallmentsCount || 5);

    if (freqVal && freqVal.startsWith("CUSTOM_")) {
      const parsed = parseInt(freqVal.replace("CUSTOM_", ""), 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    const parsed = parseInt(freqVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;

    return 4;
  };

  // Generate Default Installment Rows when Rent or Frequency or Start Date changes
  const generateDefaultInstallments = (
    rentVal: number,
    freqVal: string,
    startVal: string,
    customCountVal?: number
  ) => {
    if (!rentVal || rentVal <= 0 || !startVal) {
      setInstallments([]);
      return;
    }

    const count = getInstallmentCount(freqVal, customCountVal !== undefined ? customCountVal : customInstallmentsCount);
    const installmentAmount = Math.round((rentVal / count) * 100) / 100;

    const prevBank = editingLease ? (cheques.find((c) => c.leaseId === editingLease.id && c.bankName)?.bankName || "") : "";

    const rows: LeaseInstallmentFormRow[] = [];
    const baseDate = new Date(startVal);

    const endD = endDate ? new Date(endDate) : new Date(baseDate.getTime() + 365 * 24 * 60 * 60 * 1000);
    const totalDays = Math.max(1, Math.round((endD.getTime() - baseDate.getTime()) / (1000 * 3600 * 24)));
    const stepDays = totalDays / count;

    for (let i = 0; i < count; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + Math.round(i * stepDays));
      const dateStr = d.toISOString().split("T")[0];

      rows.push({
        id: `inst-${i + 1}-${Date.now()}-${crypto.randomUUID().split("-")[0]}`,
        installmentIndex: i + 1,
        dueDate: dateStr,
        amount: installmentAmount,
        paymentMethod: "CHEQUE",
        chequeNumber: "",
        bankName: prevBank,
        drawerName: "",
        status: "ACTIVE"
      });
    }

    setInstallments(rows);
  };

  // Re-generate if user alters Rent or Frequency or Start Date while in Basic tab
  const handleRentOrFreqChange = (
    newRent: number | string,
    newFreq: string,
    newStart: string,
    customVal?: number
  ) => {
    const rentNum = typeof newRent === "number" ? newRent : parseFloat(newRent) || 0;
    if (rentNum > 0 && newStart) {
      generateDefaultInstallments(rentNum, newFreq, newStart, customVal);
    }
  };

  // Quick Duration Setter (1Y, 2Y, 3Y)
  const applyDurationYears = (years: number) => {
    const base = startDate ? new Date(startDate) : new Date();
    const startStr = base.toISOString().split("T")[0];
    setStartDate(startStr);

    const endD = new Date(base);
    endD.setFullYear(endD.getFullYear() + years);
    endD.setDate(endD.getDate() - 1);
    const endStr = endD.toISOString().split("T")[0];
    setEndDate(endStr);

    const rentNum = typeof annualRent === "number" ? annualRent : parseFloat(annualRent as string) || 0;
    if (rentNum > 0) {
      generateDefaultInstallments(rentNum, paymentFrequency || "QUARTERLY_4_CHEQUES", startStr);
    }
  };

  // Policy Resolver for Modal - Updates rates dynamically when party or property changes
  useEffect(() => {
    if (isOpen) {
      const prop = properties.find(p => p.id === propertyId);
      const oId = prop?.ownerId;
      
      const leasePolicy = {
        owner: ownerAdminFeeExempt ? {
          isExempt: ownerAdminFeeExempt,
          exemptionReason: ownerAdminFeeExemptionReason,
          exemptionNote: ownerAdminFeeExemptionNote,
          approvalStatus: ownerAdminFeeApproved ? "APPROVED" as const : "PENDING" as const,
        } : undefined,
        tenant: tenantAdminFeeExempt ? {
          isExempt: tenantAdminFeeExempt,
          exemptionReason: tenantAdminFeeExemptionReason,
          exemptionNote: tenantAdminFeeExemptionNote,
          approvalStatus: tenantAdminFeeApproved ? "APPROVED" as const : "PENDING" as const,
        } : undefined
      };

      const ownerPolicy = resolveAdministrativeFeePolicy("OWNER", oId, leasePolicy, DEFAULT_COMMISSION_SETTINGS, owners, tenants);
      setOwnerFeeRate(ownerPolicy.rate);

      const tenantPolicy = resolveAdministrativeFeePolicy("TENANT", tenantId, leasePolicy, DEFAULT_COMMISSION_SETTINGS, owners, tenants);
      setTenantFeeRate(tenantPolicy.rate);
    }
  }, [isOpen, propertyId, tenantId, owners, tenants, ownerAdminFeeExempt, ownerAdminFeeApproved, tenantAdminFeeExempt, tenantAdminFeeApproved]);

  // Validation function: require Property, Unit, Owner, and Tenant before accepting uploads
  const checkRequiredEntitiesSelected = (): boolean => {
    const prop = properties.find((p) => p.id === propertyId);
    const owner = owners.find((o) => o.id === prop?.ownerId);
    const tenant = tenants.find((t) => t.id === tenantId);
    const unit = units.find((u) => u.id === unitId);

    const missing: string[] = [];
    if (!tenantId || !tenant) missing.push(language === "ar" ? "المستأجر" : "Tenant");
    if (!propertyId || !prop) missing.push(language === "ar" ? "العقار" : "Property");
    if (!unitId || !unit) missing.push(language === "ar" ? "الوحدة الإيجارية" : "Rental Unit");
    if (!prop?.ownerId || !owner) missing.push(language === "ar" ? "مالك العقار" : "Property Owner");

    if (missing.length > 0) {
      const missingStr = missing.join("، ");
      addNotification({
        channel: "PORTAL",
        recipient: "User",
        recipientName: "System",
        tenantId: tenantId || "sys",
        status: "DELIVERED",
        content: language === "ar"
          ? `⚠️ يرجى استكمال بيانات العقد أولاً قبل رفع المستندات! العناصر المفقودة: [ ${missingStr} ]`
          : `⚠️ Complete Contract Info First! Missing: [ ${missingStr} ]`,
        attemptCount: 1,
        sentAt: new Date().toISOString()
      });
      return false;
    }
    return true;
  };

  // Allow tab changes freely so users can inspect and fill tabs
  const validateTabBeforeChange = (targetTab: number): boolean => {
    return true;
  };

  const handleTabChange = (targetTab: 1 | 2 | 3 | 4) => {
    if (targetTab > 2) {
      const parsedRent = typeof annualRent === "number" ? annualRent : parseFloat(annualRent as string) || 0;
      const scheduleValidation = validateLeaseChequeSchedule(installments, parsedRent, language as any);
      if (!scheduleValidation.valid) {
        alert(scheduleValidation.blockingIssues[0] || (language === "ar" ? "يرجى مطابقة إجمالي مبالغ الشيكات مع إجمالي الإيجار السنوي" : "Please match total cheques with annual rent"));
        setActiveTab(2);
        return;
      }
    }
    setActiveTab(targetTab);
  };

  // File Upload Handlers for Archive Tab
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    customCategory?: string,
    targetOverride?: "TENANT" | "OWNER" | "PROPERTY" | "LEASE"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!checkRequiredEntitiesSelected()) {
      if (e.target) e.target.value = "";
      return;
    }

    setIsUploadingDoc(true);

    try {
      const cat = customCategory || selectedDocCategory;
      const catObj = DOCUMENT_CATEGORIES.find((c) => c.id === cat);
      const catNameAr = catObj?.labelAr || "وثيقة رسمية";

      const prop = properties.find((p) => p.id === propertyId);
      const owner = owners.find((o) => o.id === prop?.ownerId);
      const tenant = tenants.find((t) => t.id === tenantId);
      const unit = units.find((u) => u.id === unitId);

      let targetEntity: "TENANT" | "OWNER" | "PROPERTY" | "LEASE" =
        targetOverride || selectedTargetEntity || (catObj?.target as any) || "LEASE";

      let targetEntityId = currentRecordId;
      let archiveCategory: any = "LEASES";

      const tenantName = tenant?.nameAr || tenant?.nameEn || "المستأجر";
      const ownerName = owner?.nameAr || owner?.nameEn || "مالك العقار";
      const propertyName = prop?.nameAr || prop?.nameEn || "العقار";
      const unitName = unit?.unitNumber ? `وحدة ${unit.unitNumber}` : "";

      let entityContext = "";
      if (targetEntity === "TENANT" && tenantId) {
        targetEntityId = tenantId;
        archiveCategory = "TENANTS";
        entityContext = `${tenantName} (المستأجر)`;
      } else if (targetEntity === "OWNER" && prop?.ownerId) {
        targetEntityId = prop.ownerId;
        archiveCategory = "OWNERS";
        entityContext = `${ownerName} (المالك)`;
      } else if (targetEntity === "PROPERTY" && propertyId) {
        targetEntityId = propertyId;
        archiveCategory = "PROPERTIES";
        entityContext = `${propertyName} ${unitName ? `[${unitName}]` : ""}`;
      } else {
        entityContext = `${tenantName} - ${propertyName} ${unitName ? `[${unitName}]` : ""} (عقد #${leaseNumber || "جديد"})`;
      }

      const fullDocTitle = `${catNameAr} - ${entityContext}`;
      const ext = file.name.includes(".") ? file.name.substring(file.name.lastIndexOf(".")) : "";
      const customFileName = `${fullDocTitle}${ext}`;

      // Upload and archive via canonical gateway
      await DocumentStorageService.uploadAndArchive(file, {
        category: archiveCategory,
        entityType: targetEntity,
        entityId: targetEntityId,
        fileName: customFileName,
        mimeType: file.type || "application/pdf",
        description: fullDocTitle,
        tags: [cat.toLowerCase(), targetEntity.toLowerCase(), "official_doc"],
        uploadedByUserId: currentUser?.id || "u-1",
        uploadedByName: currentUser?.nameAr || currentUser?.username || "المسؤول",
      });

      // SYNC AUTOMATICALLY WITH OWNER PROFILE OR TENANT PROFILE TO PREVENT DUPLICATES
      if (targetEntity === "OWNER" && prop?.ownerId) {
        const timestamp = new Date().toLocaleDateString("ar-EG");
        const docNote = `[وثيقة أرشيف موحد - ${timestamp}]: ${fullDocTitle}`;
        updateOwner(prop.ownerId, {
          notes: owner?.notes ? `${owner.notes}\n${docNote}` : docNote
        });
        addNotification({
          channel: "SMS",
          recipient: owner?.phone || owner?.email || "Owner",
          recipientName: owner?.nameAr || owner?.nameEn || "المالك",
          tenantId: tenantId || "sys",
          status: "DELIVERED",
          attemptCount: 1,
          content: `تم رفع الوثيقة وتسميتها أوتوماتيكياً: (${fullDocTitle}) ومزامنتها برقم سجل المالك.`
        });
      } else if (targetEntity === "TENANT" && tenantId) {
        const timestamp = new Date().toLocaleDateString("ar-EG");
        const docNote = `[وثيقة أرشيف موحد - ${timestamp}]: ${fullDocTitle}`;
        const patch: Partial<Tenant> = {
          notes: tenant?.notes ? `${tenant.notes}\n${docNote}` : docNote
        };
        updateTenant(tenantId, patch);
        addNotification({
          channel: "SMS",
          recipient: tenant?.phone || tenant?.email || "Tenant",
          recipientName: tenant?.nameAr || tenant?.nameEn || "المستأجر",
          tenantId: tenantId,
          status: "DELIVERED",
          attemptCount: 1,
          content: `تم رفع الوثيقة وتسميتها أوتوماتيكياً: (${fullDocTitle}) ومزامنتها بملف المستأجر.`
        });
      } else {
        addNotification({
          channel: "SMS",
          recipient: "System",
          recipientName: "مسؤول النظام",
          tenantId: tenantId || "sys",
          status: "DELIVERED",
          attemptCount: 1,
          content: `تم حفظ الوثيقة باسم: (${fullDocTitle}) بنجاح.`
        });
      }
    } catch (err: any) {
      console.error("Error optimizing/uploading document:", err);
      alert(language === "ar" ? "فشل رفع الملف المضغوط" : "Failed to upload optimized file");
    } finally {
      setIsUploadingDoc(false);
      if (e.target) e.target.value = "";
    }
  };

  // OCR Process base64 directly from hardware scanner or upload
  const processOCRBase64Row = async (rowId: string, base64: string, mimeType: string, fileName?: string) => {
    setScanningRowId(rowId);
    try {
      let extractedNum = "";
      let extractedBank = "";
      let extractedAmount = 0;
      let extractedDate = "";
      let extractedDrawer = "";

      try {
        const ocrResult = await extractChequeOCR(base64, mimeType);
        
        const normalized = normalizeChequeOCR(ocrResult, language);
        
        extractedNum = normalized.chequeNumber;
        extractedBank = normalized.bankName;
        extractedAmount = normalized.amount;
        extractedDate = normalized.dueDate;
        extractedDrawer = normalized.drawerName;

      } catch (err: any) {
        console.warn("OCR AI extraction quota/error handled gracefully:", err?.message || err);
      }

      const targetRow = installments.find((r) => r.id === rowId);
      const currentAmount = targetRow ? targetRow.amount : 0;

      if (extractedAmount <= 0 || Math.abs(extractedAmount - currentAmount) > 0.01) {
        setConflictModalState({
          rowId,
          conflictData: {
            field: "amount",
            original: {
              amount: currentAmount,
              dueDate: targetRow?.dueDate,
              bankName: targetRow?.bankName,
              chequeNumber: targetRow?.chequeNumber,
              drawerName: targetRow?.drawerName,
            },
            extracted: {
              amount: extractedAmount > 0 ? extractedAmount : 0,
              dueDate: extractedDate || targetRow?.dueDate,
              bankName: extractedBank || targetRow?.bankName,
              chequeNumber: extractedNum || targetRow?.chequeNumber,
              drawerName: extractedDrawer || targetRow?.drawerName,
            },
            contextTitle: extractedAmount <= 0 ? (language === "ar" ? "تعذر قراءة مبلغ الشيك بدقة - يلزم المراجعة اليدوية" : "Unable to reliably read cheque amount - manual review required") : undefined
          },
          base64,
        });
      } else {
        setInstallments((prev) => prev.map((row) => {
          if (row.id === rowId) {
            return {
              ...row,
              chequeNumber: extractedNum || row.chequeNumber,
              bankName: extractedBank || row.bankName,
              amount: extractedAmount,
              dueDate: extractedDate || row.dueDate,
              drawerName: extractedDrawer || row.drawerName || "",
              chequeImage: base64
            };
          }
          return row;
        }));
      }

      // Add to archive automatically using canonical gateway
      const docTitle = language === "ar" ? `شيك مسح ضوئي ${extractedNum || rowId} - العقد ${leaseNumber}` : `Scanned Cheque ${extractedNum || rowId} - Lease ${leaseNumber}`;
      
      await DocumentStorageService.uploadAndArchive(base64, {
        category: "CHEQUES",
        entityType: propertyId ? "PROPERTY" : "TENANT",
        entityId: propertyId || tenantId || "sys",
        fileName: fileName || `scanned-cheque-${rowId}.jpg`,
        mimeType: mimeType || "image/jpeg",
        description: docTitle,
        uploadedByUserId: currentUser?.id || "u-1",
        uploadedByName: currentUser?.nameAr || currentUser?.username || "المسؤول",
        tags: ["cheque", "ocr_scan", "financial"]
      });

    } finally {
      setScanningRowId(null);
    }
  };

  // OCR Scan / Trigger for Installment Cheque with archive sync
  const handleScanChequeRow = async (rowId: string, file: File) => {
    setScanningRowId(rowId);
    try {
      const optResult = await optimizeDocument(file, "CHEQUE");
      await processOCRBase64Row(rowId, optResult.dataUrl, optResult.optimizedMimeType || file.type, file.name);
      alert(language === "ar" ? "تم مسح الشيك بالماسح الضوئي وقراءة البيانات وتحميل الصورة إلى الأرشيف بنجاح!" : "Cheque scanned via OCR, data read, and image uploaded to archive successfully!");
    } catch (err) {
      console.error("Scan cheque failed:", err);
      alert(language === "ar" ? "فشل مسح الشيك" : "Failed to scan cheque");
    } finally {
      setScanningRowId(null);
    }
  };

  const handleManualUploadCheque = async (rowId: string, file: File) => {
    try {
      const optResult = await optimizeDocument(file, "CHEQUE");
      const base64 = optResult.dataUrl;

      setInstallments((prev) =>
        prev.map((row) => {
          if (row.id === rowId) {
            return {
              ...row,
              chequeImage: base64
            };
          }
          return row;
        })
      );

      const instRow = installments.find(r => r.id === rowId);
      const docTitle = language === "ar" ? `شيك تحميل يدوي رقم ${instRow?.chequeNumber || rowId} - العقد ${leaseNumber}` : `Manual Cheque #${instRow?.chequeNumber || rowId} - Lease ${leaseNumber}`;
      await DocumentStorageService.uploadAndArchive(base64, {
        fileName: file.name || `cheque-${rowId}.jpg`,
        category: "CHEQUES",
        entityType: propertyId ? "PROPERTY" : "TENANT",
        entityId: propertyId || tenantId || "sys",
        mimeType: optResult.optimizedMimeType || file.type || "image/jpeg",
        description: docTitle,
        uploadedByUserId: currentUser?.id || "u-1",
        uploadedByName: currentUser?.nameAr || currentUser?.username || "المسؤول",
        tags: ["cheque", "manual_upload", "financial"]
      });

      alert(language === "ar" ? "تم تحميل صورة الشيك وإضافتها إلى الأرشيف الموحد بنجاح!" : "Cheque image uploaded and added to unified archive successfully!");
    } catch (err) {
      console.error("Manual cheque upload failed:", err);
      alert(language === "ar" ? "فشل رفع الشيك" : "Failed to upload cheque");
    }
  };

  // Save Lease Submission
  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !propertyId || !unitId || !annualRent || !startDate || !endDate) {
      addNotification({
        channel: "PORTAL",
        recipient: "User",
        recipientName: "System",
        tenantId: tenantId || "sys",
        status: "DELIVERED",
        content: language === "ar"
          ? "⚠️ يرجى استكمال جميع الحقول الإلزامية في تبويب بيانات العقد الأساسية."
          : "⚠️ Please fill in all mandatory fields in the basic info tab.",
        attemptCount: 1,
        sentAt: new Date().toISOString()
      });
      setActiveTab(1);
      return;
    }

    setIsSubmitting(true);

    // OCCUPANCY GOVERNANCE: Validate unit availability before submitting
    const unitValidation = validateUnitAvailabilityForLease({
      unitId,
      targetLeaseId: editingLease?.id,
      units,
      leases,
      language: (language as any) || "ar",
    });

    if (!unitValidation.isAvailable) {
      const errReason = language === "ar" ? unitValidation.blockReasonAr : unitValidation.blockReasonEn;
      alert(errReason);
      addNotification({
        channel: "PORTAL",
        recipient: "User",
        recipientName: "System",
        tenantId: tenantId || "sys",
        status: "DELIVERED",
        content: `🚨 ${errReason}`,
        attemptCount: 1,
        sentAt: new Date().toISOString()
      });
      setIsSubmitting(false);
      setActiveTab(1);
      return;
    }

    const prop = properties.find((p) => p.id === propertyId);
    const parsedRent = typeof annualRent === "number" ? annualRent : parseFloat(annualRent as string) || 0;
    
    const scheduleValidation = validateLeaseChequeSchedule(installments, parsedRent, language as any);
    if (!scheduleValidation.valid) {
      const errText = scheduleValidation.blockingIssues[0] || (language === "ar" ? "خطأ في مطابقة الشيكات مع الإيجار السنوي" : "Cheque schedule validation failed");
      addNotification({
        channel: "PORTAL",
        recipient: "User",
        recipientName: "System",
        tenantId: tenantId || "sys",
        status: "DELIVERED",
        content: `🚨 ${errText}`,
        attemptCount: 1,
        sentAt: new Date().toISOString()
      });
      alert(errText);
      setIsSubmitting(false);
      setActiveTab(2);
      return;
    }

    const parsedDeposit = typeof securityDeposit === "number" ? securityDeposit : parseFloat(securityDeposit as string) || 0;

    const finalStatus = contractStatus || "ACTIVE";

    const adminFeePolicy = {
      owner: ownerAdminFeeExempt ? {
        isExempt: ownerAdminFeeExempt,
        exemptionReason: ownerAdminFeeExemptionReason,
        exemptionNote: ownerAdminFeeExemptionNote,
        approvalStatus: ownerAdminFeeApproved ? "APPROVED" as const : "PENDING" as const,
        approvedBy: ownerAdminFeeApproved ? (currentUser?.username || "Admin") : undefined,
        approvedAt: ownerAdminFeeApproved ? new Date().toISOString() : undefined
      } : undefined,
      tenant: tenantAdminFeeExempt ? {
        isExempt: tenantAdminFeeExempt,
        exemptionReason: tenantAdminFeeExemptionReason,
        exemptionNote: tenantAdminFeeExemptionNote,
        approvalStatus: tenantAdminFeeApproved ? "APPROVED" as const : "PENDING" as const,
        approvedBy: tenantAdminFeeApproved ? (currentUser?.username || "Admin") : undefined,
        approvedAt: tenantAdminFeeApproved ? new Date().toISOString() : undefined
      } : undefined
    };

    let savedLeaseId = currentRecordId;

    if (editingLease) {
      updateLease(editingLease.id, {
        leaseNumber,
        tenantId,
        ownerId: prop?.ownerId || editingLease.ownerId || "ow-01",
        propertyId,
        unitId,
        startDate,
        endDate,
        annualRent: parsedRent,
        paymentFrequency,
        chequesCount: installments.length || 4,
        installmentsCount: installments.length || 4,
        securityDeposit: parsedDeposit,
        ejariNumber: ejariNumber.trim(),
        contractStatus: finalStatus as any,
        leaseExpenses: leaseExpenses,
        adminFeePolicy: adminFeePolicy
      });
      savedLeaseId = editingLease.id;
    } else {
      const created = addLease({
        leaseNumber,
        tenantId,
        ownerId: prop?.ownerId || "ow-01",
        propertyId,
        unitId,
        startDate,
        endDate,
        annualRent: parsedRent,
        paymentFrequency,
        chequesCount: installments.length || 4,
        securityDeposit: parsedDeposit,
        securityDepositPaymentMethod: securityDepositPaymentMethod as any || undefined,
        securityDepositBankName: securityDepositBankName || undefined,
        securityDepositChequeNumber: securityDepositChequeNumber || undefined,
        securityDepositIsUndatedCheque: securityDepositIsUndatedCheque,
        carriedForwardFromLeaseId: isRenewal ? renewalSourceLease?.id : undefined,
        ejariNumber: ejariNumber.trim(),
        installmentsCount: installments.length || 4,
        installments: installments.map((inst, idx) => ({
          installmentNumber: idx + 1,
          dueDate: inst.dueDate,
          amount: inst.amount,
          chequeNumber: inst.chequeNumber,
          status: "PENDING"
        })),
        contractStatus: finalStatus as any,
        leaseExpenses: leaseExpenses,
        adminFeePolicy: adminFeePolicy
      });
      savedLeaseId = created.id;

      // Auto-collect security deposit if provided for a NEW lease (not renewal)
      if (!isRenewal && parsedDeposit > 0 && securityDepositPaymentMethod) {
        collectSecurityDeposit({
          leaseId: savedLeaseId,
          amount: parsedDeposit,
          paymentMethod: securityDepositPaymentMethod as any,
          payerName: tenants.find(t => t.id === tenantId)?.nameAr || "",
          chequeNumber: securityDepositChequeNumber || undefined,
          bankName: securityDepositBankName || undefined,
          isUndatedCheque: securityDepositIsUndatedCheque,
          transactionReference: securityDepositTransactionRef || undefined,
          notes: "Collected on lease creation / دفعة تأمين مقبوضة عند إنشاء العقد"
        }).catch(err => {
          console.error("Failed to collect security deposit:", err);
        });
      }
    }

    // Save Cheque records for installments marked as CHEQUE
    installments.forEach((inst) => {
      if (inst.paymentMethod === "CHEQUE" && inst.chequeNumber) {
        addCheque({
          chequeNumber: inst.chequeNumber,
          bankName: inst.bankName || "",
          amount: inst.amount,
          chequeDate: inst.dueDate,
          dueDate: inst.dueDate,
          ownerId: prop?.ownerId || "ow-01",
          tenantId,
          propertyId,
          unitId,
          leaseId: savedLeaseId,
          status: "POST_DATED",
          originalStatus: "NORMAL",
          collectionStatus: "NOT_COLLECTED",
          drawerName: inst.drawerName || undefined,
          imageUrl: inst.chequeImage,
          sourcePdfId: inst.sourcePdfId,
          sourcePdfFileName: inst.sourcePdfFileName,
          sourcePdfPageNumber: inst.sourcePdfPageNumber,
          sourceCroppedRegion: inst.sourceCroppedRegion,
          ingestionSessionId: inst.ingestionSessionId,
          sourceDocumentId: inst.sourcePdfId,
        });
      }
    });

    // Record optional commission/admin fees from inputs
    if (includeAdminFees) {
      const currentCommissionYear = new Date(startDate).getFullYear().toString();
      
      if (ownerFeeEnabled) {
        const ownerFeeAmount = ownerFeeBasis === "PERCENTAGE_OF_RENT"
          ? Math.round((parsedRent * Number(ownerFeeRate || 0)) / 100)
          : Number(ownerFeeFixed || 0);

        if (ownerFeeAmount > 0) {
          const ownerRes = addCommissionObligation({
            leaseId: savedLeaseId,
            businessKeySequence: "PRIMARY_OWNER",
            ownerId: prop?.ownerId || "ow-01",
            propertyId: propertyId,
            unitId: unitId,
            partyType: "OWNER",
            commissionType: "ADMIN_FEE",
            calculationBasis: ownerFeeBasis,
            baseAmount: parsedRent,
            ratePercentage: ownerFeeBasis === "PERCENTAGE_OF_RENT" ? Number(ownerFeeRate) : undefined,
            fixedAmount: ownerFeeBasis === "FIXED_AMOUNT" ? Number(ownerFeeFixed) : undefined,
            totalCommissionAmount: ownerFeeAmount,
            dueDate: ownerFeeDueDate || startDate,
            notes: language === "ar"
              ? `الرسوم الإدارية السنوية للمكتب من المالك للعام ${currentCommissionYear}`
              : `Annual Administrative Fees for Owner for ${currentCommissionYear}`,
            contractualCommissionYear: currentCommissionYear,
            renewalSequence: 1,
            isOverride: false,
            // Pass exemption metadata
            isExempt: ownerAdminFeeExempt && ownerAdminFeeApproved,
            exemptionSource: ownerAdminFeeExempt && ownerAdminFeeApproved ? "CONTRACT_EXEMPTION" : undefined,
            exemptionReason: ownerAdminFeeExempt && ownerAdminFeeApproved ? ownerAdminFeeExemptionReason : undefined,
            approvalStatus: ownerAdminFeeExempt ? (ownerAdminFeeApproved ? "APPROVED" : "PENDING") : undefined,
            approvedBy: ownerAdminFeeApproved ? (currentUser?.username || "Admin") : undefined,
          });

          if (ownerRes.success && ownerRes.commission && ownerFeeImmediateCollection) {
            collectAdministrativeFee(
              ownerRes.commission.id,
              ownerFeeAmount,
              ownerFeePaymentMethod,
              ownerFeeReference,
              language === "ar" ? `تحصيل فوري للرسوم الإدارية من المالك عند إصدار العقد #${leaseNumber}` : `Immediate admin fee collection from Owner on lease #${leaseNumber}`
            );
          }
        }
      }

      if (tenantFeeEnabled) {
        const tenantFeeAmount = tenantFeeBasis === "PERCENTAGE_OF_RENT"
          ? Math.round((parsedRent * Number(tenantFeeRate || 0)) / 100)
          : Number(tenantFeeFixed || 0);

        if (tenantFeeAmount > 0) {
          const tenantRes = addCommissionObligation({
            leaseId: savedLeaseId,
            businessKeySequence: "PRIMARY_TENANT",
            tenantId: tenantId,
            propertyId: propertyId,
            unitId: unitId,
            partyType: "TENANT",
            commissionType: "ADMIN_FEE",
            calculationBasis: tenantFeeBasis,
            baseAmount: parsedRent,
            ratePercentage: tenantFeeBasis === "PERCENTAGE_OF_RENT" ? Number(tenantFeeRate) : undefined,
            fixedAmount: tenantFeeBasis === "FIXED_AMOUNT" ? Number(tenantFeeFixed) : undefined,
            totalCommissionAmount: tenantFeeAmount,
            dueDate: tenantFeeDueDate || startDate,
            notes: language === "ar"
              ? `الرسوم الإدارية السنوية للمكتب من المستأجر للعام ${currentCommissionYear}`
              : `Annual Administrative Fees for Tenant for ${currentCommissionYear}`,
            contractualCommissionYear: currentCommissionYear,
            renewalSequence: 1,
            isOverride: false,
            // Pass exemption metadata
            isExempt: tenantAdminFeeExempt && tenantAdminFeeApproved,
            exemptionSource: tenantAdminFeeExempt && tenantAdminFeeApproved ? "CONTRACT_EXEMPTION" : undefined,
            exemptionReason: tenantAdminFeeExempt && tenantAdminFeeApproved ? tenantAdminFeeExemptionReason : undefined,
            approvalStatus: tenantAdminFeeExempt ? (tenantAdminFeeApproved ? "APPROVED" : "PENDING") : undefined,
            approvedBy: tenantAdminFeeApproved ? (currentUser?.username || "Admin") : undefined,
          });

          if (tenantRes.success && tenantRes.commission && tenantFeeImmediateCollection) {
            collectAdministrativeFee(
              tenantRes.commission.id,
              tenantFeeAmount,
              tenantFeePaymentMethod,
              tenantFeeReference,
              language === "ar" ? `تحصيل فوري للرسوم الإدارية من المستأجر عند إصدار العقد #${leaseNumber}` : `Immediate admin fee collection from Tenant on lease #${leaseNumber}`
            );
          }
        }
      }
    }

    // Notify Administrator & trigger floating notification
    const targetUnit = units.find((u) => u.id === unitId);
    const targetTenant = tenants.find((t) => t.id === tenantId);

    addNotification({
      channel: "SMS",
      recipient: "Manager",
      recipientName: language === "ar" ? "مسؤول النظام والاعتمادات" : "System Administrator",
      tenantId: tenantId || "sys",
      status: "DELIVERED",
      content: language === "ar"
        ? `🔔 تنبيه اعتماد وجوبي: تم حفظ عقد الإيجار رقم (${leaseNumber}) للوحدة (${targetUnit?.unitNumber || ""}) والمستأجر (${targetTenant?.nameAr || targetTenant?.nameEn || ""}) وتحويل حالة الوحدة تلقائياً من (شاغرة) إلى (مؤجرة OCCUPIED). يرجى الاطلاع والاعتماد الإداري.`
        : `🔔 Approval Alert: Lease #${leaseNumber} saved for Unit #${targetUnit?.unitNumber || ""}. Unit status automatically updated to OCCUPIED. Mandatory approval required.`,
      attemptCount: 1,
      sentAt: new Date().toISOString()
    });

    window.dispatchEvent(
      new CustomEvent("show-manager-floating-toast", {
        detail: {
          leaseNumber,
          unitNumber: targetUnit?.unitNumber || ""
        }
      })
    );

    setIsSubmitting(false);
    onClose();
  };

  // Helper selectors for existing attached documents across Tenant, Owner, Property, and Lease
  const selectedTenant = tenants.find((t) => t.id === tenantId);
  const selectedProperty = properties.find((p) => p.id === propertyId);
  const selectedOwner = owners.find((o) => o.id === selectedProperty?.ownerId);
  const selectedUnit = units.find((u) => u.id === unitId);

  const tenantDocs = archive.filter((a) => tenantId && (a.recordId === tenantId || a.entityId === tenantId));
  const ownerDocs = archive.filter((a) => selectedProperty?.ownerId && (a.recordId === selectedProperty.ownerId || a.entityId === selectedProperty.ownerId));
  const propertyDocs = archive.filter((a) => propertyId && (a.recordId === propertyId || a.entityId === propertyId));
  const leaseDocs = archive.filter((a) => a.recordId === currentRecordId || a.entityId === currentRecordId);

  const tempContractDoc = leaseDocs.find((a) => a.tags?.includes("temp_contract") || a.fileName.toLowerCase().includes("temp"));
  const ejariContractDoc = leaseDocs.find((a) => a.tags?.includes("authenticated_ejari") || a.fileName.toLowerCase().includes("ejari"));

  return (
    <>
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isRenewal
          ? language === "ar"
            ? "تجديد عقد الإيجار الشامل"
            : "Renew Comprehensive Lease"
          : editingLease
            ? language === "ar"
              ? "تعديل عقد الإيجار الشامل"
              : "Edit Lease Agreement"
            : language === "ar"
              ? "تحرير عقد إيجار جديد شامل"
              : "Create New Comprehensive Lease Agreement"
      }
      subtitle={
        language === "ar"
          ? "إدارة أطراف العقد، العين المؤجرة، جدول الدفعات الشيكات، والأرشيف الإلكتروني الموحد"
          : "Full contract parameters, unit status, payment schedule, and shared documents archive"
      }
      icon={<FileSpreadsheet className="w-5 h-5 text-amber-700" />}
      maxWidth="6xl"
    >
      {/* Modern Unified Stepper Header with enlarged elements */}
      <div className="bg-slate-50/90 p-2 rounded-2xl mb-5 border border-slate-200/90 shadow-2xs">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => handleTabChange(1)}
            className={`flex items-center justify-between p-3.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer text-start ${
              activeTab === 1
                ? "bg-white text-amber-900 shadow-sm border border-amber-200/80 ring-1 ring-amber-500/20"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className={`p-2 rounded-xl ${activeTab === 1 ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600"}`}>
                <FileText className="w-4 h-4 sm:w-5 h-5" />
              </div>
              <div className="truncate">
                <div className="text-[11px] text-slate-400 font-semibold">{language === "ar" ? "الخطوة الأولى" : "Step 1"}</div>
                <div className="truncate text-xs sm:text-sm font-black">{language === "ar" ? "1. البيانات والعين المؤجرة" : "1. Basic Details"}</div>
              </div>
            </div>
            {tenantId && propertyId && unitId && annualRent ? (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 ml-1"></span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange(2)}
            className={`flex items-center justify-between p-3.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer text-start ${
              activeTab === 2
                ? "bg-white text-amber-900 shadow-sm border border-amber-200/80 ring-1 ring-amber-500/20"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className={`p-2 rounded-xl ${activeTab === 2 ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600"}`}>
                <CreditCard className="w-4 h-4 sm:w-5 h-5" />
              </div>
              <div className="truncate">
                <div className="text-[11px] text-slate-400 font-semibold">{language === "ar" ? "الخطوة الثانية" : "Step 2"}</div>
                <div className="truncate text-xs sm:text-sm font-black">{language === "ar" ? "2. جدول الدفعات" : "2. Payment Schedule"}</div>
              </div>
            </div>
            {installments.length > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-lg font-mono font-black shrink-0">
                {installments.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange(3)}
            className={`flex items-center justify-between p-3.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer text-start ${
              activeTab === 3
                ? "bg-white text-amber-900 shadow-sm border border-amber-200/80 ring-1 ring-amber-500/20"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className={`p-2 rounded-xl ${activeTab === 3 ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600"}`}>
                <FolderKey className="w-4 h-4 sm:w-5 h-5" />
              </div>
              <div className="truncate">
                <div className="text-[11px] text-slate-400 font-semibold">{language === "ar" ? "الخطوة الثالثة" : "Step 3"}</div>
                <div className="truncate text-xs sm:text-sm font-black">{language === "ar" ? "3. الأرشيف والمستندات" : "3. Shared Docs"}</div>
              </div>
            </div>
            {(tenantDocs.length + ownerDocs.length + leaseDocs.length) > 0 && (
              <span className="px-2 py-0.5 bg-slate-200 text-slate-800 text-xs rounded-lg font-mono font-bold shrink-0">
                {tenantDocs.length + ownerDocs.length + leaseDocs.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange(4)}
            className={`flex items-center justify-between p-3.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer text-start ${
              activeTab === 4
                ? "bg-white text-amber-900 shadow-sm border border-amber-200/80 ring-1 ring-amber-500/20"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className={`p-2 rounded-xl ${activeTab === 4 ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600"}`}>
                <ShieldCheck className="w-4 h-4 sm:w-5 h-5" />
              </div>
              <div className="truncate">
                <div className="text-[11px] text-slate-400 font-semibold">{language === "ar" ? "الخطوة الرابعة" : "Step 4"}</div>
                <div className="truncate text-xs sm:text-sm font-black">{language === "ar" ? "4. المعاينة والاعتماد" : "4. Review & Submit"}</div>
              </div>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 ml-1"></span>
          </button>
        </div>
      </div>

      <form onSubmit={handleFinalSubmit} className="space-y-6">
        {/* ================= TAB 1: BASIC DETAILS & UNIT ================= */}
        {activeTab === 1 && (
          <div className="flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              {/* Live Information Text Display Card (تيكست عرض المعلومات المتكاملة للعقد) */}
              {(selectedTenant || selectedProperty || selectedUnit || annualRent) && (
                <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50/90 via-amber-50/40 to-slate-50 border-2 border-amber-200/90 rounded-2xl shadow-xs">
                  <div className="flex items-center justify-between border-b border-amber-200/80 pb-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center font-black text-xs shadow-2xs">
                        i
                      </div>
                      <h4 className="text-xs sm:text-sm font-black text-amber-950">
                        {language === "ar" ? "لوحة عرض وتلخيص بيانات العقد الحالية" : "Live Contract Summary & Information Banner"}
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-bold px-2.5 py-1 bg-white border border-amber-200 text-amber-900 rounded-lg shadow-2xs">
                      {leaseNumber || "NEW-LEASE"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs sm:text-sm">
                    {/* Tenant Info Box */}
                    <div className="p-3 bg-white/90 border border-amber-100 rounded-xl space-y-1">
                      <div className="text-[11px] font-bold text-slate-400">{language === "ar" ? "المستأجر (الطرف الثاني)" : "Tenant (2nd Party)"}</div>
                      <div className="font-extrabold text-slate-900 truncate">
                        {selectedTenant ? (language === "ar" ? selectedTenant.nameAr : selectedTenant.nameEn) : (language === "ar" ? "لم يتم التحديد بعد" : "Not selected")}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {selectedTenant?.phone ? `📞 ${selectedTenant.phone}` : ""} {selectedTenant?.code ? `• ${selectedTenant.code}` : ""}
                      </div>
                    </div>

                    {/* Property & Owner Info Box */}
                    <div className="p-3 bg-white/90 border border-amber-100 rounded-xl space-y-1">
                      <div className="text-[11px] font-bold text-slate-400">{language === "ar" ? "العقار والمالك (الطرف الأول)" : "Property & Owner"}</div>
                      <div className="font-extrabold text-slate-900 truncate">
                        {selectedProperty ? (language === "ar" ? selectedProperty.nameAr : selectedProperty.nameEn) : (language === "ar" ? "لم يتم تحديد العقار" : "No property")}
                      </div>
                      <div className="text-xs text-slate-600 font-medium truncate">
                        {selectedOwner ? `${language === "ar" ? "المالك:" : "Owner:"} ${language === "ar" ? selectedOwner.nameAr : selectedOwner.nameEn}` : ""}
                      </div>
                    </div>

                    {/* Unit Info Box */}
                    <div className="p-3 bg-white/90 border border-amber-100 rounded-xl space-y-1">
                      <div className="text-[11px] font-bold text-slate-400">{language === "ar" ? "العين المؤجرة (الوحدة)" : "Rental Unit"}</div>
                      <div className="font-extrabold text-emerald-800">
                        {selectedUnit ? `${language === "ar" ? "الوحدة رقم" : "Unit #"} ${selectedUnit.unitNumber}` : (language === "ar" ? "لم يتم اختيار الوحدة" : "No unit")}
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        {selectedUnit ? `${(selectedUnit.unitType || selectedUnit.type || "").replace(/_/g, " ")} • ${selectedUnit.status}` : ""}
                      </div>
                    </div>

                    {/* Financial & Duration Box */}
                    <div className="p-3 bg-white/90 border border-amber-100 rounded-xl space-y-1">
                      <div className="text-[11px] font-bold text-slate-400">{language === "ar" ? "القيمة والمدة الإيجارية" : "Rent & Duration"}</div>
                      <div className="font-black text-amber-800 font-mono">
                        AED {Number(annualRent || 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        {startDate && endDate ? `${startDate} ⇄ ${endDate}` : (language === "ar" ? "حدد التواريخ" : "Dates pending")}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 1: Contract Reference & Category */}
              <div className="p-4 sm:p-5 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-4 shadow-2xs">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm font-black text-slate-800 border-b border-slate-200/60 pb-2.5">
                  <FileSpreadsheet className="w-4 h-4 sm:w-5 h-5 text-amber-700" />
                  <span>{language === "ar" ? "البيانات الأساسية وتصنيف العقد" : "Contract Classification & Reference"}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs sm:text-sm font-bold text-slate-800">{language === "ar" ? "رقم العقد الداخلي" : "Lease Reference #"} *</label>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-200">
                        <Lock className="w-3 h-3 text-amber-700" />
                        {language === "ar" ? "مسلسل تلقائي (محمي)" : "Auto-Locked"}
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      readOnly
                      disabled
                      value={leaseNumber}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-100 border border-slate-300 rounded-xl font-mono font-bold text-slate-700 cursor-not-allowed select-none shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">{language === "ar" ? "رقم إيجاري / توثيق" : "Ejari / Tawtheeq #"}</label>
                    <input
                      type="text"
                      value={ejariNumber}
                      onChange={(e) => setEjariNumber(e.target.value)}
                      placeholder={language === "ar" ? "مثال: EJ-293847 (اختياري)" : "e.g., EJ-293847 (Optional)"}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">{language === "ar" ? "نوع العقد والمتعاقد" : "Contract Category"} *</label>
                    <select
                      value={contractType}
                      onChange={(e) => setContractType(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
                    >
                      <option value="RESIDENTIAL">{language === "ar" ? "عقد سكني فردي (Residential Tenant)" : "Residential Individual"}</option>
                      <option value="COMMERCIAL">{language === "ar" ? "عقد مسجل باسم شركة (Corporate / Commercial)" : "Commercial Corporate"}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Parties & Rental Unit */}
              <div className="p-4 sm:p-5 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-4 shadow-2xs">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm font-black text-slate-800 border-b border-slate-200/60 pb-2.5">
                  <UserCheck className="w-4 h-4 sm:w-5 h-5 text-amber-700" />
                  <span>{language === "ar" ? "أطراف التعاقد والعين المؤجرة" : "Contract Parties & Unit"}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <SearchableSelect
                    label={language === "ar" ? "المستأجر" : "Tenant"}
                    required
                    options={tenants.map((t) => ({
                      id: t.id,
                      label: language === "ar" ? t.nameAr : t.nameEn,
                      subLabel: `${t.code} • ${t.phone || ""}`,
                      badge: t.riskLevel ? `${t.riskLevel} Risk` : undefined
                    }))}
                    value={tenantId}
                    onChange={(val) => setTenantId(val)}
                    placeholder={language === "ar" ? "-- ابحث واختر المستأجر --" : "-- Select Tenant --"}
                    searchPlaceholder={language === "ar" ? "ابحث بالاسم أو الكود..." : "Search tenant..."}
                  />

                  <SearchableSelect
                    label={language === "ar" ? "العقار / البرج" : "Property"}
                    required
                    options={properties.map((p) => {
                      const ow = owners.find((o) => o.id === p.ownerId);
                      return {
                        id: p.id,
                        label: language === "ar" ? p.nameAr : p.nameEn,
                        subLabel: `${language === "ar" ? "المالك:" : "Owner:"} ${ow ? (language === "ar" ? ow.nameAr : ow.nameEn) : "N/A"}`,
                        badge: getPropertyTypeLabel(p.type, language)
                      };
                    })}
                    value={propertyId}
                    onChange={(val) => {
                      setPropertyId(val);
                      if (unitId) {
                        const currentUnit = units.find((u) => u.id === unitId);
                        if (currentUnit && currentUnit.propertyId !== val) {
                          setUnitId("");
                        }
                      }
                    }}
                    placeholder={language === "ar" ? "-- ابحث واختر العقار --" : "-- Select Property --"}
                    searchPlaceholder={language === "ar" ? "ابحث بـ اسم العقار أو المالك..." : "Search property..."}
                  />

                  <SearchableSelect
                    label={language === "ar" ? (editingLease ? "الوحدة العقارية للعقد" : "الوحدة العقارية (الشاغرة فقط)") : (editingLease ? "Contract Unit" : "Unit (Vacant Only)")}
                    required
                    options={(propertyId ? units.filter((u) => u.propertyId === propertyId) : units)
                      .filter((u) => {
                        const val = validateUnitAvailabilityForLease({
                          unitId: u.id,
                          targetLeaseId: editingLease?.id,
                          units,
                          leases,
                          language: (language as any) || "ar",
                        });
                        return val.isAvailable || (editingLease && u.id === editingLease.unitId);
                      })
                      .map((u) => {
                        const prop = properties.find((p) => p.id === u.propertyId);
                        const isCurrentContractUnit = Boolean(editingLease && u.id === editingLease.unitId);
                        const occSummary = getUnitEffectiveOccupancy(u.id, u, leases);
                        
                        let badgeText = language === "ar" ? "🟢 شاغرة/خالية" : "🟢 VACANT";
                        if (isCurrentContractUnit) {
                          badgeText = language === "ar" ? "🔴 مؤجرة (الوحدة الحالية للعقد)" : "🔴 OCCUPIED (Current Unit)";
                        } else if (u.status === "MAINTENANCE") {
                          badgeText = language === "ar" ? "🟡 صيانة" : "🟡 MAINTENANCE";
                        } else if (occSummary.effectiveStatus === "OCCUPIED") {
                          badgeText = language === "ar" ? "🔴 مؤجرة" : "🔴 OCCUPIED";
                        }

                        return {
                          id: u.id,
                          label: `${language === "ar" ? "الوحدة" : "Unit"} ${u.unitNumber} ${!propertyId && prop ? `(${language === "ar" ? prop.nameAr : prop.nameEn})` : ""}`,
                          subLabel: `${(u.unitType || u.type || "").replace(/_/g, " ")} • AED ${u.annualRent?.toLocaleString() || 0}${isCurrentContractUnit ? ` • ${language === "ar" ? "الوحدة المرتبطة بهذا العقد" : "Linked to this lease"}` : ""}`,
                          badge: badgeText
                        };
                      })}
                    value={unitId}
                    onChange={(val) => {
                      setUnitId(val);
                      const uObj = units.find((u) => u.id === val);
                      if (uObj) {
                        if (uObj.propertyId && !propertyId) {
                          setPropertyId(uObj.propertyId);
                        }
                        if (!annualRent && uObj.annualRent) {
                          setAnnualRent(uObj.annualRent);
                          handleRentOrFreqChange(uObj.annualRent, paymentFrequency || "QUARTERLY_4_CHEQUES", startDate);
                        }
                      }
                    }}
                    placeholder={language === "ar" ? (editingLease ? "-- اختر الوحدة العقارية للعقد --" : "-- ابحث واختر الوحدة الخالية --") : (editingLease ? "-- Select Contract Unit --" : "-- Select Vacant Unit --")}
                    searchPlaceholder={language === "ar" ? "ابحث برقم الوحدة..." : "Search unit..."}
                  />
                </div>
              </div>

              {/* Section 3: Dates, Rent & Payment Terms */}
              <div className="p-4 sm:p-5 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-4 shadow-2xs">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm font-black text-slate-800 border-b border-slate-200/60 pb-2.5">
                  <CreditCard className="w-4 h-4 sm:w-5 h-5 text-amber-700" />
                  <span>{language === "ar" ? "المدد الزمنية والشروط المالية" : "Financial Terms & Duration"}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs sm:text-sm font-bold text-slate-800">{language === "ar" ? "تاريخ بدء العقد" : "Start Date"} *</label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => applyDurationYears(1)}
                          className="px-2 py-0.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-md font-bold transition-colors cursor-pointer"
                        >
                          {language === "ar" ? "سنة" : "1Y"}
                        </button>
                        <button
                          type="button"
                          onClick={() => applyDurationYears(2)}
                          className="px-2 py-0.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-md font-bold transition-colors cursor-pointer"
                        >
                          {language === "ar" ? "سنتان" : "2Y"}
                        </button>
                        <button
                          type="button"
                          onClick={() => applyDurationYears(3)}
                          className="px-2 py-0.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-md font-bold transition-colors cursor-pointer"
                        >
                          {language === "ar" ? "3 سنوات" : "3Y"}
                        </button>
                      </div>
                    </div>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        handleRentOrFreqChange(annualRent, paymentFrequency || "QUARTERLY_4_CHEQUES", e.target.value);
                      }}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">{language === "ar" ? "تاريخ انتهاء العقد" : "End Date"} *</label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">{language === "ar" ? "حالة العقد" : "Contract Status"} *</label>
                    <SearchableSelect
                      options={[
                        { id: "PENDING_AUDIT", label: language === "ar" ? "PENDING_AUDIT (قيد التدقيق)" : "PENDING_AUDIT (Pending Audit)" },
                        { id: "PENDING_APPROVAL", label: language === "ar" ? "PENDING_APPROVAL (قيد الاعتماد)" : "PENDING_APPROVAL (Pending Approval)" },
                        { id: "ACTIVE", label: language === "ar" ? "ACTIVE (ساري / نشط)" : "ACTIVE" },
                        { id: "RENEWED", label: language === "ar" ? "RENEWED (مجدد)" : "RENEWED" },
                        { id: "EXPIRED", label: language === "ar" ? "EXPIRED (منتهي)" : "EXPIRED" },
                        { id: "TERMINATED", label: language === "ar" ? "TERMINATED (مفسوخ)" : "TERMINATED" },
                        { id: "CANCELLED", label: language === "ar" ? "CANCELLED (ملغى)" : "CANCELLED" }
                      ]}
                      value={contractStatus}
                      onChange={(val) => setContractStatus(val as any)}
                      placeholder={language === "ar" ? "اختر حالة العقد..." : "Select status..."}
                      searchPlaceholder={language === "ar" ? "ابحث بالحالة..." : "Search status..."}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">{language === "ar" ? "قيمة الإيجار السنوي (درهم)" : "Annual Rent (AED)"} *</label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={annualRent}
                      onChange={(e) => {
                        const val = e.target.value === "" ? "" : parseFloat(e.target.value) || 0;
                        setAnnualRent(val);
                        handleRentOrFreqChange(val, paymentFrequency || "QUARTERLY_4_CHEQUES", startDate);
                      }}
                      placeholder="0"
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl font-mono font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">{language === "ar" ? "توزيع الدفعات والشيكات" : "Payment Frequency"} *</label>
                    <SearchableSelect
                      options={[
                        { id: "ONE_CHEQUE", label: language === "ar" ? "1 Cheque (دفعة واحدة)" : "1 Cheque (Single Payment)" },
                        { id: "TWO_CHEQUES", label: language === "ar" ? "2 Cheques (دفعتين)" : "2 Cheques (Semi-Annual)" },
                        { id: "THREE_CHEQUES", label: language === "ar" ? "3 Cheques (3 دفعات)" : "3 Cheques (Tri-Annual)" },
                        { id: "QUARTERLY_4_CHEQUES", label: language === "ar" ? "4 Cheques (4 دفعات ربع سنوية)" : "4 Cheques (Quarterly)" },
                        { id: "FIVE_CHEQUES", label: language === "ar" ? "5 Cheques (5 دفعات)" : "5 Cheques (5 Payments)" },
                        { id: "BI_MONTHLY_6_CHEQUES", label: language === "ar" ? "6 Cheques (6 دفعات كل شهرين)" : "6 Cheques (Bi-Monthly)" },
                        { id: "SEVEN_CHEQUES", label: language === "ar" ? "7 Cheques (7 دفعات)" : "7 Cheques (7 Payments)" },
                        { id: "EIGHT_CHEQUES", label: language === "ar" ? "8 Cheques (8 دفعات)" : "8 Cheques (8 Payments)" },
                        { id: "NINE_CHEQUES", label: language === "ar" ? "9 Cheques (9 دفعات)" : "9 Cheques (9 Payments)" },
                        { id: "TEN_CHEQUES", label: language === "ar" ? "10 Cheques (10 دفعات)" : "10 Cheques (10 Payments)" },
                        { id: "ELEVEN_CHEQUES", label: language === "ar" ? "11 Cheques (11 دفعة)" : "11 Cheques (11 Payments)" },
                        { id: "MONTHLY_12_CHEQUES", label: language === "ar" ? "12 Cheques (12 دفعة شهرية)" : "12 Cheques (Monthly)" },
                        { id: "CUSTOM_COUNT", label: language === "ar" ? "⚙️ عدد دفعات مخصص (Custom Count...)" : "⚙️ Custom Count..." }
                      ]}
                      value={paymentFrequency || ""}
                      onChange={(val) => {
                        setPaymentFrequency(val as any);
                        handleRentOrFreqChange(annualRent, val, startDate);
                      }}
                      placeholder={language === "ar" ? "توزيع الدفعات..." : "Payment frequency..."}
                      searchPlaceholder={language === "ar" ? "ابحث بالنظام..." : "Search frequency..."}
                    />

                    {paymentFrequency === "CUSTOM_COUNT" && (
                      <div className="mt-2.5 p-3 bg-amber-50/90 border border-amber-300 rounded-xl space-y-1.5 shadow-2xs">
                        <label className="block text-xs font-bold text-amber-950">
                          {language === "ar" ? "أدخل عدد الدفعات المخصص (مثل 5 أو 7 أو غير ذلك):" : "Specify Custom Number of Installments:"}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={36}
                            value={customInstallmentsCount}
                            onChange={(e) => {
                              const countVal = Math.max(1, parseInt(e.target.value) || 1);
                              setCustomInstallmentsCount(countVal);
                              handleRentOrFreqChange(annualRent, "CUSTOM_COUNT", startDate, countVal);
                            }}
                            className="w-28 px-3 py-1.5 text-xs sm:text-sm bg-white border border-amber-400 rounded-lg font-mono font-black text-amber-900 focus:ring-2 focus:ring-amber-500 outline-none"
                          />
                          <span className="text-xs sm:text-sm text-amber-900 font-bold">
                            {language === "ar"
                              ? `دفعات (قيمة كل دفعة: AED ${annualRent ? Math.round((Number(annualRent) / (customInstallmentsCount || 1)) * 100) / 100 : 0})`
                              : `installments`}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">{language === "ar" ? "مبلغ تأمين الصيانة (درهم)" : "Security Deposit (AED)"}</label>
                    <input
                      type="number"
                      min={0}
                      value={securityDeposit}
                      onChange={(e) => {
                        const val = e.target.value === "" ? "" : parseFloat(e.target.value) || 0;
                        setSecurityDeposit(val);
                        if (!val) setSecurityDepositPaymentMethod("");
                      }}
                      placeholder="0"
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
                    />
                  </div>
                  
                  {((typeof securityDeposit === "number" && securityDeposit > 0) || (typeof securityDeposit === "string" && parseFloat(securityDeposit) > 0)) && (
                    <div className="col-span-1 sm:col-span-2 lg:col-span-4 mt-2 p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 mb-3 border-b border-slate-200 pb-2">
                        {language === "ar" ? "تفاصيل دفع مبلغ التأمين" : "Security Deposit Payment Details"}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">{language === "ar" ? "طريقة الدفع" : "Payment Method"}</label>
                          <select
                            value={securityDepositPaymentMethod}
                            onChange={(e) => setSecurityDepositPaymentMethod(e.target.value as PaymentMethod)}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none"
                          >
                            <option value="">{language === "ar" ? "اختر طريقة الدفع..." : "Select payment method..."}</option>
                            <option value="CASH">{language === "ar" ? "نقداً (Cash)" : "Cash"}</option>
                            <option value="BANK_TRANSFER">{language === "ar" ? "تحويل بنكي (Bank Transfer)" : "Bank Transfer"}</option>
                            <option value="CREDIT_CARD">{language === "ar" ? "بطاقة ائتمان (Credit Card)" : "Credit Card"}</option>
                            <option value="CHEQUE">{language === "ar" ? "شيك تأمين (Security Cheque)" : "Security Cheque"}</option>
                          </select>
                        </div>
                        
                        {securityDepositPaymentMethod === "CHEQUE" && (
                          <>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">{language === "ar" ? "رقم الشيك" : "Cheque Number"}</label>
                              <input
                                type="text"
                                value={securityDepositChequeNumber}
                                onChange={(e) => setSecurityDepositChequeNumber(e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none font-mono"
                                placeholder={language === "ar" ? "رقم الشيك" : "Cheque #"}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">{language === "ar" ? "البنك المسحوب عليه" : "Bank Name"}</label>
                              <input
                                type="text"
                                value={securityDepositBankName}
                                onChange={(e) => setSecurityDepositBankName(e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none"
                                placeholder={language === "ar" ? "اسم البنك" : "Bank Name"}
                              />
                            </div>
                            <div className="col-span-1 sm:col-span-3 flex items-center gap-2 mt-1">
                              <input
                                type="checkbox"
                                id="securityDepositIsUndatedCheque"
                                checked={securityDepositIsUndatedCheque}
                                onChange={(e) => setSecurityDepositIsUndatedCheque(e.target.checked)}
                                className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                              />
                              <label htmlFor="securityDepositIsUndatedCheque" className="text-xs font-bold text-amber-900">
                                {language === "ar" ? "شيك بدون تاريخ (Undated Cheque)" : "Undated Cheque"}
                              </label>
                            </div>
                          </>
                        )}
                        
                        {(securityDepositPaymentMethod === "BANK_TRANSFER" || securityDepositPaymentMethod === "CREDIT_CARD") && (
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              {securityDepositPaymentMethod === "CREDIT_CARD" 
                                ? (language === "ar" ? "رمز الموافقة (Approval Code)" : "Approval Code")
                                : (language === "ar" ? "الرقم المرجعي للتحويل (Reference)" : "Transfer Reference")}
                            </label>
                            <input
                              type="text"
                              value={securityDepositTransactionRef}
                              onChange={(e) => setSecurityDepositTransactionRef(e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none font-mono"
                              placeholder={language === "ar" ? "الرقم المرجعي" : "Reference"}
                            />
                          </div>
                        )}
                        {securityDepositPaymentMethod === "BANK_TRANSFER" && (
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">{language === "ar" ? "البنك المحول إليه" : "Destination Bank"}</label>
                            <input
                              type="text"
                              value={securityDepositBankName}
                              onChange={(e) => setSecurityDepositBankName(e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none"
                              placeholder={language === "ar" ? "اسم البنك" : "Bank Name"}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-200/80 shrink-0">
              <div className="text-xs sm:text-sm text-slate-500 font-medium">
                {language === "ar" ? "الخطوة 1 من 4: البيانات الأساسية" : "Step 1 of 4: Basic Info"}
              </div>
              <button
                type="button"
                onClick={() => handleTabChange(2)}
                className="px-6 py-3 bg-amber-700 hover:bg-amber-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all"
              >
                <span>{language === "ar" ? "الانتقال لجدول الدفعات والشيكات" : "Next: Payment Schedule"}</span>
                <ChevronRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB 2: PAYMENT & CHEQUE SCHEDULE ================= */}
        {activeTab === 2 && (
          <div className="flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <div className="p-4 sm:p-5 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs sm:text-sm font-black text-amber-950">
                      {language === "ar" ? "مولّد جدولة الدفعات والشيكات المدمج" : "Integrated Installment & Cheque Schedule Generator"}
                    </div>
                    <div className="text-xs text-amber-800 font-medium mt-0.5">
                      {language === "ar"
                        ? `إجمالي قيمة العقد: AED ${Number(annualRent || 0).toLocaleString()} • عدد الدفعات الحالي: ${installments.length}`
                        : `Total Rent: AED ${Number(annualRent || 0).toLocaleString()} • Current Count: ${installments.length}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsBatchOcrModalOpen(true)}
                      className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                    >
                      <Sparkles className="w-4 h-4 text-purple-200" />
                      <span>{language === "ar" ? "المسح الذكي لكافة الشيكات (Batch OCR)" : "Multi-Cheque Batch OCR"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRentOrFreqChange(annualRent, paymentFrequency || "QUARTERLY_4_CHEQUES", startDate)}
                      className="px-4 py-2 bg-white text-amber-900 border border-amber-300 rounded-xl text-xs sm:text-sm font-bold hover:bg-amber-100 flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>{language === "ar" ? "إعادة حساب وتقسيم الدفعات" : "Recalculate Schedule"}</span>
                    </button>
                  </div>
                </div>

                {/* Quick Division Preset Chips */}
                <div className="flex items-center gap-2 pt-2.5 border-t border-amber-200/80 overflow-x-auto pb-1">
                  <span className="text-xs font-bold text-amber-950 shrink-0">
                    {language === "ar" ? "تقسيم سريع:" : "Quick Division:"}
                  </span>
                  {[
                    { key: "ONE_CHEQUE", count: 1, label: "1" },
                    { key: "TWO_CHEQUES", count: 2, label: "2" },
                    { key: "THREE_CHEQUES", count: 3, label: "3" },
                    { key: "QUARTERLY_4_CHEQUES", count: 4, label: "4" },
                    { key: "FIVE_CHEQUES", count: 5, label: "5" },
                    { key: "BI_MONTHLY_6_CHEQUES", count: 6, label: "6" },
                    { key: "SEVEN_CHEQUES", count: 7, label: "7" },
                    { key: "EIGHT_CHEQUES", count: 8, label: "8" },
                    { key: "NINE_CHEQUES", count: 9, label: "9" },
                    { key: "TEN_CHEQUES", count: 10, label: "10" },
                    { key: "MONTHLY_12_CHEQUES", count: 12, label: "12" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setPaymentFrequency(item.key as any);
                        handleRentOrFreqChange(annualRent, item.key, startDate);
                      }}
                      className={`px-3 py-1.5 text-xs sm:text-sm rounded-xl font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                        installments.length === item.count
                          ? "bg-amber-800 text-white shadow-xs scale-105"
                          : "bg-white text-amber-900 border border-amber-300 hover:bg-amber-100"
                      }`}
                    >
                      {item.label} {language === "ar" ? "دفعات" : "Pay"}
                    </button>
                  ))}

                  <div className="flex items-center gap-1.5 bg-white border border-amber-300 px-3 py-1 rounded-xl shrink-0">
                    <span className="text-xs font-bold text-amber-900">
                      {language === "ar" ? "مخصص:" : "Custom:"}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={36}
                      value={customInstallmentsCount}
                      onChange={(e) => {
                        const countVal = Math.max(1, parseInt(e.target.value) || 1);
                        setCustomInstallmentsCount(countVal);
                        setPaymentFrequency("CUSTOM_COUNT");
                        handleRentOrFreqChange(annualRent, "CUSTOM_COUNT", startDate, countVal);
                      }}
                      className="w-12 text-center text-xs sm:text-sm font-mono font-black text-amber-900 bg-amber-50 rounded-lg outline-none"
                    />
                  </div>
                </div>
              </div>

              {installments.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-xs sm:text-sm text-slate-500 space-y-3">
                  <CreditCard className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="font-medium">{language === "ar" ? "يرجى تحديد قيمة الإيجار وتاريخ بدء العقد في التبويب الأول لتوليد الدفعات." : "Set annual rent and start date to generate installments."}</p>
                  <button
                    type="button"
                    onClick={() => handleTabChange(1)}
                    className="px-4 py-2 bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer hover:bg-amber-800"
                  >
                    {language === "ar" ? "العودة للبيانات الأساسية" : "Go to Basic Details"}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {installments.map((inst) => (
                    <div key={inst.id} className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-xl bg-amber-100 text-amber-900 font-mono font-black text-xs sm:text-sm flex items-center justify-center shadow-2xs">
                            {inst.installmentIndex}
                          </span>
                          <span className="text-xs sm:text-sm font-black text-slate-900">
                            {language === "ar" ? `الدفعة رقم ${inst.installmentIndex}` : `Installment #${inst.installmentIndex}`}
                          </span>
                          <Badge variant="neutral" size="sm">
                            {inst.status === "PAID" ? "PAID (مُحصلة)" : "ACTIVE (نشطة/بانتظار الاستحقاق)"}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-slate-600">{language === "ar" ? "طريقة الدفع:" : "Method:"}</label>
                          <select
                            value={inst.paymentMethod}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              setInstallments((prev) =>
                                prev.map((r) => (r.id === inst.id ? { ...r, paymentMethod: val } : r))
                              );
                            }}
                            className="px-3 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                          >
                            <option value="CHEQUE">{language === "ar" ? "شيك" : "Cheque"}</option>
                            <option value="CASH">{language === "ar" ? "نقداً (Cash)" : "Cash"}</option>
                            <option value="BANK_TRANSFER">{language === "ar" ? "تحويل بنكي (Bank Transfer)" : "Bank Transfer"}</option>
                            <option value="CARD">{language === "ar" ? "بطاقة ائتمانية (Card)" : "Card"}</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs sm:text-sm">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">{language === "ar" ? "تاريخ الاستحقاق" : "Due Date"}</label>
                          <input
                            type="date"
                            value={inst.dueDate}
                            onChange={(e) => {
                              const val = e.target.value;
                              setInstallments((prev) => prev.map((r) => (r.id === inst.id ? { ...r, dueDate: val } : r)));
                            }}
                            className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">{language === "ar" ? "المبلغ المستحق (درهم)" : "Amount (AED)"}</label>
                          <input
                            type="number"
                            value={inst.amount}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setInstallments((prev) => prev.map((r) => (r.id === inst.id ? { ...r, amount: val } : r)));
                            }}
                            className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono font-black text-amber-800 outline-none"
                          />
                        </div>

                        {inst.paymentMethod === "CHEQUE" ? (
                          <>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1.5">{language === "ar" ? "رقم الشيك" : "Cheque #"}</label>
                              <input
                                type="text"
                                value={inst.chequeNumber}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setInstallments((prev) => prev.map((r) => (r.id === inst.id ? { ...r, chequeNumber: val } : r)));
                                }}
                                placeholder="123456"
                                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1.5">{language === "ar" ? "اسم صاحب الشيك" : "Drawer Name"}</label>
                              <input
                                type="text"
                                value={inst.drawerName || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setInstallments((prev) => prev.map((r) => (r.id === inst.id ? { ...r, drawerName: val } : r)));
                                }}
                                placeholder={language === "ar" ? "اسم صاحب الحساب / الشيك" : "Drawer Name"}
                                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none"
                              />
                            </div>

                            <div className="col-span-1 sm:col-span-4">
                              <label className="block text-xs font-bold text-slate-700 mb-1.5">{language === "ar" ? "اسم البنك" : "Bank Name"}</label>
                              <SearchableSelect
                                options={[
                                  ...bankList.map((b) => ({
                                    id: language === "ar" ? b.nameAr : b.nameEn,
                                    label: language === "ar" ? `${b.nameAr} (${b.nameEn})` : `${b.nameEn} (${b.nameAr})`,
                                  })),
                                  {
                                    id: "ADD_NEW_BANK_ACTION",
                                    label: language === "ar" ? "+ إضافة بنك جديد" : "+ Add New Bank",
                                  },
                                ]}
                                value={inst.bankName}
                                onChange={(val) => {
                                  if (val === "ADD_NEW_BANK_ACTION") {
                                    setActiveBankRowId(inst.id);
                                    setIsAddBankModalOpen(true);
                                  } else {
                                    setInstallments((prev) => prev.map((r) => (r.id === inst.id ? { ...r, bankName: val } : r)));
                                  }
                                }}
                                placeholder={language === "ar" ? "-- اختر البنك --" : "-- Select Bank --"}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="col-span-1 sm:col-span-2 flex items-center justify-center bg-slate-50 p-3 rounded-xl text-xs text-slate-500 italic border border-slate-200/60">
                            {language === "ar"
                              ? `تحصيل عادي بواسطة (${inst.paymentMethod}) - لا يتطلب رقم شيك`
                              : `Direct Payment via (${inst.paymentMethod})`}
                          </div>
                        )}
                      </div>

                      {inst.paymentMethod === "CHEQUE" && (
                        <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-100 text-xs gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setAiCaptureTargetId(inst.id);
                                setIsAiCaptureOpen(true);
                              }}
                              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                            >
                              <Search className="w-4 h-4" />
                              <span>{language === "ar" ? "🤖 قراءة ذكية (AI)" : "🤖 Smart Read (AI)"}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setScannerRowTargetId(inst.id)}
                              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                            >
                              <Scan className="w-4 h-4" />
                              <span>{language === "ar" ? "📷 مسح" : "📷 Scan"}</span>
                            </button>

                            {inst.chequeImage && (
                              <span className="text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                <Check className="w-4 h-4 text-emerald-600" />
                                {language === "ar" ? "تم رفع الصورة والأرشيف" : "Image attached & archived"}
                              </span>
                            )}
                          </div>

                          <span className="text-slate-400 font-mono text-xs">Status: ACTIVE</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Additional Lease Expenses Section */}
              <div className="bg-slate-50/80 border border-slate-200/80 p-4 sm:p-5 rounded-2xl space-y-4 shadow-2xs">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                  <div className="flex items-center gap-2 font-black text-xs sm:text-sm text-slate-800">
                    <Plus className="w-4 h-4 sm:w-5 h-5 text-amber-700" />
                    <span>{language === "ar" ? "المصاريف الإيجارية الإضافية (رسوم البلدية، خدمات، إلخ)" : "Additional Lease Expenses"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newExp: LeaseExpenseItem = {
                        id: `exp-${Date.now()}`,
                        category: "MUNICIPALITY_FEES",
                        description: "",
                        amount: 0,
                        totalAmount: 0,
                        dueDate: startDate,
                        costBearer: "TENANT",
                        status: "PENDING",
                      };
                      setLeaseExpenses([...leaseExpenses, newExp]);
                    }}
                    className="px-3 py-1.5 bg-amber-100 text-amber-900 rounded-xl text-xs font-bold hover:bg-amber-200 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {language === "ar" ? "إضافة مصروف" : "Add Expense"}
                  </button>
                </div>

                {leaseExpenses.length === 0 ? (
                  <div className="text-center py-5 text-slate-400 text-xs">
                    {language === "ar" ? "لا توجد مصاريف إضافية مضافة حالياً" : "No additional expenses added yet"}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leaseExpenses.map((exp, idx) => (
                      <div key={exp.id} className="grid grid-cols-1 sm:grid-cols-6 gap-3 p-3.5 bg-white border border-slate-200 rounded-xl items-end shadow-2xs">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-slate-600 mb-1">{language === "ar" ? "نوع المصروف" : "Category"}</label>
                          <select
                            value={exp.category}
                            onChange={(e) => {
                              const updated = [...leaseExpenses];
                              updated[idx].category = e.target.value as any;
                              setLeaseExpenses(updated);
                            }}
                            className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg font-semibold outline-none"
                          >
                            <option value="MUNICIPALITY_FEES">{language === "ar" ? "رسوم البلدية" : "Municipality Fees"}</option>
                            <option value="SERVICE_CHARGES">{language === "ar" ? "رسوم الخدمات" : "Service Charges"}</option>
                            <option value="UTILITIES">{language === "ar" ? "كهرباء ومياه" : "Utilities"}</option>
                            <option value="LEGAL_FEES">{language === "ar" ? "رسوم قانونية" : "Legal Fees"}</option>
                            <option value="OTHER">{language === "ar" ? "أخرى" : "Other"}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">{language === "ar" ? "المبلغ" : "Amount"}</label>
                          <input
                            type="number"
                            value={exp.amount || ""}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const updated = [...leaseExpenses];
                              updated[idx].amount = val;
                              updated[idx].totalAmount = val;
                              setLeaseExpenses(updated);
                            }}
                            className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-amber-800 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">{language === "ar" ? "يتحملها" : "Cost Bearer"}</label>
                          <select
                            value={exp.costBearer}
                            onChange={(e) => {
                              const updated = [...leaseExpenses];
                              updated[idx].costBearer = e.target.value as any;
                              setLeaseExpenses(updated);
                            }}
                            className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg font-semibold outline-none"
                          >
                            <option value="TENANT">{language === "ar" ? "المستأجر" : "Tenant"}</option>
                            <option value="OWNER">{language === "ar" ? "المالك" : "Owner"}</option>
                            <option value="OFFICE">{language === "ar" ? "المكتب" : "Office"}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">{language === "ar" ? "تاريخ الاستحقاق" : "Due Date"}</label>
                          <input
                            type="date"
                            value={exp.dueDate}
                            onChange={(e) => {
                              const updated = [...leaseExpenses];
                              updated[idx].dueDate = e.target.value;
                              setLeaseExpenses(updated);
                            }}
                            className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono outline-none"
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setLeaseExpenses(leaseExpenses.filter((_, i) => i !== idx))}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="sm:col-span-6 mt-1">
                          <input
                            type="text"
                            value={exp.description}
                            onChange={(e) => {
                              const updated = [...leaseExpenses];
                              updated[idx].description = e.target.value;
                              setLeaseExpenses(updated);
                            }}
                            placeholder={language === "ar" ? "وصف المصروف..." : "Description..."}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg italic outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-200/80 shrink-0">
              <button
                type="button"
                onClick={() => handleTabChange(1)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl cursor-pointer transition-colors"
              >
                {language === "ar" ? "السابق: البيانات الأساسية" : "Back: Basic Details"}
              </button>

              <button
                type="button"
                onClick={() => handleTabChange(3)}
                className="px-6 py-3 bg-amber-700 hover:bg-amber-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all"
              >
                <span>{language === "ar" ? "الانتقال للأرشيف والمستندات الموحدة" : "Next: Shared Archive"}</span>
                <ChevronRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB 3: UNIFIED ARCHIVE & DOCUMENTS ================= */}
        {activeTab === 3 && (
          <div className="flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              {/* Mandatory Requirement Alert Banner */}
              {(!selectedTenant || !selectedProperty || !selectedUnit || !selectedOwner) && (
                <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start gap-3 shadow-2xs">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1.5">
                    <div className="font-black text-amber-950">
                      {language === "ar"
                        ? "⚠️ تنبيه إداري: يُحظر إرفاق الوثائق والصور قبل استكمال تحديد أطراف العقد"
                        : "⚠️ Mandatory Notice: Complete contract selection required before attaching documents"}
                    </div>
                    <div className="text-amber-800 leading-relaxed font-medium">
                      {language === "ar"
                        ? "لضمان أرشفة الملفات وحفظها في السجلات الصحيحة وتسميتها أوتوماتيكياً باسم المستند والطرف المعني دون تكرار، يجب اختيار (المستأجر، المالك، العقار، والوحدة) من تبويب بيانات العقد أولاً."
                        : "To ensure proper archiving and prevent duplicate files, you must select the Tenant, Owner, Property, and Rental Unit first."}
                    </div>
                    <div className="pt-1 flex flex-wrap gap-2 text-[11px] font-bold">
                      <span className={`px-2 py-0.5 rounded-md ${selectedTenant ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                        {selectedTenant ? `✓ المستأجر: ${selectedTenant.nameAr || selectedTenant.nameEn}` : "✕ المستأجر: غير محدد"}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md ${selectedProperty ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                        {selectedProperty ? `✓ العقار: ${selectedProperty.nameAr || selectedProperty.nameEn}` : "✕ العقار: غير محدد"}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md ${selectedUnit ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                        {selectedUnit ? `✓ الوحدة: ${selectedUnit.unitNumber}` : "✕ الوحدة: غير محدد"}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md ${selectedOwner ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                        {selectedOwner ? `✓ المالك: ${selectedOwner.nameAr || selectedOwner.nameEn}` : "✕ المالك: غير محدد"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 1. Existing Shared Documents Banner (Prevents Duplicate Uploads) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderKey className="w-4 h-4 text-amber-700" />
                    <h4 className="text-xs font-black text-slate-800">
                      {language === "ar" ? "الوثائق القائمة المخزنة مسبقاً (ربط أوتوماتيكي لمنع التكرار)" : "Linked Entity Documents (Auto-Shared)"}
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {language === "ar" ? "تعرض المستندات الموجودة في أرشيف المالك والمستأجر والعقار" : "Auto-retrieved from Owner, Tenant & Property archive"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Tenant Docs */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between shadow-2xs">
                    <div>
                      <div className="flex items-center justify-between font-bold text-slate-800 border-b border-slate-100 pb-1.5 mb-2">
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                          {language === "ar" ? "وثائق المستأجر" : "Tenant Docs"}
                        </span>
                        <span className="text-[10px] bg-blue-50 text-blue-800 px-2 py-0.5 rounded font-mono font-bold">{tenantDocs.length}</span>
                      </div>
                      {tenantDocs.length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic py-2 text-center">{language === "ar" ? "لا توجد وثائق مخزنة للمستأجر" : "No tenant files stored"}</p>
                      ) : (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                          {tenantDocs.map((doc, idx) => (
                            <div key={`${doc.id}-${idx}`} className="flex items-center justify-between text-[11px] bg-slate-50 hover:bg-slate-100/80 p-2 rounded-lg border border-slate-200/80 transition-colors">
                              <div className="flex items-center gap-1.5 overflow-hidden flex-1 mr-1 rtl:ml-1 rtl:mr-0">
                                <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span className="truncate font-semibold text-slate-700" title={doc.fileName}>{doc.fileName}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handlePreviewDoc(doc)}
                                  className="p-1 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                                  title={language === "ar" ? "معاينة الملف" : "Preview"}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadDoc(doc)}
                                  className="p-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                                  title={language === "ar" ? "تنزيل الملف كملف حقيقي" : "Download"}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(language === "ar" ? "هل أنت متأكد من حذف هذه الوثيقة من الأرشيف؟" : "Delete this document?")) {
                                      deleteArchiveItem(doc.id);
                                    }
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title={language === "ar" ? "حذف الوثيقة" : "Delete"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        ref={tenantDocInputRef}
                        onChange={(e) => handleFileUpload(e, "EMIRATES_ID", "TENANT")}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!checkRequiredEntitiesSelected()) return;
                          tenantDocInputRef.current?.click();
                        }}
                        className="w-full mt-2 py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Upload className="w-3 h-3 text-blue-600" />
                        <span>{language === "ar" ? "تحميل وثائق المستأجر" : "Upload Tenant Docs"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Owner Docs */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between shadow-2xs">
                    <div>
                      <div className="flex items-center justify-between font-bold text-slate-800 border-b border-slate-100 pb-1.5 mb-2">
                        <span className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-emerald-600" />
                          {language === "ar" ? "وثائق المالك" : "Owner Docs"}
                        </span>
                        <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">{ownerDocs.length}</span>
                      </div>
                      {ownerDocs.length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic py-2 text-center">{language === "ar" ? "لا توجد وثائق مخزنة للمالك" : "No owner files stored"}</p>
                      ) : (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                          {ownerDocs.map((doc, idx) => (
                            <div key={`${doc.id}-${idx}`} className="flex items-center justify-between text-[11px] bg-slate-50 hover:bg-slate-100/80 p-2 rounded-lg border border-slate-200/80 transition-colors">
                              <div className="flex items-center gap-1.5 overflow-hidden flex-1 mr-1 rtl:ml-1 rtl:mr-0">
                                <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate font-semibold text-slate-700" title={doc.fileName}>{doc.fileName}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handlePreviewDoc(doc)}
                                  className="p-1 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                                  title={language === "ar" ? "معاينة الملف" : "Preview"}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadDoc(doc)}
                                  className="p-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                                  title={language === "ar" ? "تنزيل الملف كملف حقيقي" : "Download"}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(language === "ar" ? "هل أنت متأكد من حذف هذه الوثيقة من الأرشيف؟" : "Delete this document?")) {
                                      deleteArchiveItem(doc.id);
                                    }
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title={language === "ar" ? "حذف الوثيقة" : "Delete"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        ref={ownerDocInputRef}
                        onChange={(e) => handleFileUpload(e, "NATIONALITY", "OWNER")}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!checkRequiredEntitiesSelected()) return;
                          ownerDocInputRef.current?.click();
                        }}
                        className="w-full mt-2 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Upload className="w-3 h-3 text-emerald-600" />
                        <span>{language === "ar" ? "تحميل وثائق المالك" : "Upload Owner Docs"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Property Docs */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between shadow-2xs">
                    <div>
                      <div className="flex items-center justify-between font-bold text-slate-800 border-b border-slate-100 pb-1.5 mb-2">
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-amber-600" />
                          {language === "ar" ? "وثائق العقار والوحدة" : "Property Docs"}
                        </span>
                        <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-mono font-bold">{propertyDocs.length}</span>
                      </div>
                      {propertyDocs.length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic py-2 text-center">{language === "ar" ? "لا توجد وثائق مخصصة للعقار" : "No property files stored"}</p>
                      ) : (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                          {propertyDocs.map((doc, idx) => (
                            <div key={`${doc.id}-${idx}`} className="flex items-center justify-between text-[11px] bg-slate-50 hover:bg-slate-100/80 p-2 rounded-lg border border-slate-200/80 transition-colors">
                              <div className="flex items-center gap-1.5 overflow-hidden flex-1 mr-1 rtl:ml-1 rtl:mr-0">
                                <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span className="truncate font-semibold text-slate-700" title={doc.fileName}>{doc.fileName}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handlePreviewDoc(doc)}
                                  className="p-1 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                                  title={language === "ar" ? "معاينة الملف" : "Preview"}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadDoc(doc)}
                                  className="p-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                                  title={language === "ar" ? "تنزيل الملف كملف حقيقي" : "Download"}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(language === "ar" ? "هل أنت متأكد من حذف هذه الوثيقة من الأرشيف؟" : "Delete this document?")) {
                                      deleteArchiveItem(doc.id);
                                    }
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title={language === "ar" ? "حذف الوثيقة" : "Delete"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        ref={propertyDocInputRef}
                        onChange={(e) => handleFileUpload(e, "TITLE_DEED", "PROPERTY")}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!checkRequiredEntitiesSelected()) return;
                          propertyDocInputRef.current?.click();
                        }}
                        className="w-full mt-2 py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Upload className="w-3 h-3 text-amber-600" />
                        <span>{language === "ar" ? "تحميل وثائق العقار" : "Upload Property Docs"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Specific Contract Uploads (Temporary vs Authenticated Ejari) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Temporary Contract Card */}
                <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-amber-700" />
                      {language === "ar" ? "العقد المؤقت (Temporary Draft Contract)" : "Temporary Draft Contract"}
                    </span>
                    {tempContractDoc ? (
                      <Badge variant="success" size="sm">✓ {language === "ar" ? "مرفوع" : "Uploaded"}</Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">{language === "ar" ? "غير مرفوع" : "Not Attached"}</Badge>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={tempContractInputRef}
                    onChange={(e) => handleFileUpload(e, "TEMP_CONTRACT", "LEASE")}
                    className="hidden"
                  />

                  {tempContractDoc ? (
                    <div className="p-2.5 bg-white border border-amber-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 truncate" title={tempContractDoc.fileName}>
                          {tempContractDoc.fileName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {Math.round((tempContractDoc.fileSize || 0) / 1024)} KB
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handlePreviewDoc(tempContractDoc)}
                          className="flex-1 py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{language === "ar" ? "معاينة" : "Preview"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadDoc(tempContractDoc)}
                          className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{language === "ar" ? "تحميل الملف" : "Download"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => tempContractInputRef.current?.click()}
                          className="py-1.5 px-2.5 bg-white border border-amber-300 hover:bg-amber-50 text-amber-900 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          title={language === "ar" ? "استبدال / إعادة رفع" : "Replace"}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{language === "ar" ? "استبدال" : "Replace"}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!checkRequiredEntitiesSelected()) return;
                        tempContractInputRef.current?.click();
                      }}
                      className="w-full py-2.5 bg-white hover:bg-amber-100/70 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Upload className="w-4 h-4 text-amber-700" />
                      <span>{language === "ar" ? "تحميل صورة العقد المؤقت" : "Upload Draft Contract"}</span>
                    </button>
                  )}
                </div>

                {/* Authenticated Ejari Contract Card */}
                <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      {language === "ar" ? "العقد الموثق (إيجاري / البلدية)" : "Authenticated Ejari Contract"}
                    </span>
                    {ejariContractDoc ? (
                      <Badge variant="success" size="sm">✓ {language === "ar" ? "موثق" : "Attached"}</Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">{language === "ar" ? "غير مرفوع" : "Not Attached"}</Badge>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={ejariContractInputRef}
                    onChange={(e) => handleFileUpload(e, "AUTHENTICATED_EJARI", "LEASE")}
                    className="hidden"
                  />

                  {ejariContractDoc ? (
                    <div className="p-2.5 bg-white border border-emerald-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 truncate" title={ejariContractDoc.fileName}>
                          {ejariContractDoc.fileName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {Math.round((ejariContractDoc.fileSize || 0) / 1024)} KB
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handlePreviewDoc(ejariContractDoc)}
                          className="flex-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{language === "ar" ? "معاينة" : "Preview"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadDoc(ejariContractDoc)}
                          className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{language === "ar" ? "تحميل الملف" : "Download"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => ejariContractInputRef.current?.click()}
                          className="py-1.5 px-2.5 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-900 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          title={language === "ar" ? "استبدال / إعادة رفع" : "Replace"}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{language === "ar" ? "استبدال" : "Replace"}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!checkRequiredEntitiesSelected()) return;
                        ejariContractInputRef.current?.click();
                      }}
                      className="w-full py-2.5 bg-white hover:bg-emerald-100/70 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Upload className="w-4 h-4 text-emerald-700" />
                      <span>{language === "ar" ? "تحميل العقد الموثق من إيجاري" : "Upload Authenticated Ejari"}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 3. Categorized Document Upload */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3.5 shadow-xs">
                <h4 className="text-xs font-black text-slate-800">{language === "ar" ? "إدراج وثيقة جديدة وتصنيفها في الأرشيف الموحد" : "Upload Classified Document"}</h4>

                {/* Target Entity Selector */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700">
                    {language === "ar" ? "ربط الوثيقة بحساب وقاعدة بيانات:" : "Link Document To Record:"}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTargetEntity("TENANT")}
                      className={`p-2 rounded-xl border text-xs font-bold text-right flex items-center gap-1.5 transition-all cursor-pointer ${
                        selectedTargetEntity === "TENANT"
                          ? "bg-blue-50 border-blue-500 text-blue-900 ring-1 ring-blue-500"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <div className="truncate">
                        <div className="font-extrabold">{language === "ar" ? "المستأجر" : "Tenant"}</div>
                        <div className="text-[10px] text-slate-500 font-normal truncate">{selectedTenant?.nameAr || selectedTenant?.nameEn || "غير محدد"}</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedTargetEntity("OWNER")}
                      className={`p-2 rounded-xl border text-xs font-bold text-right flex items-center gap-1.5 transition-all cursor-pointer ${
                        selectedTargetEntity === "OWNER"
                          ? "bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <Building className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <div className="truncate">
                        <div className="font-extrabold">{language === "ar" ? "المالك" : "Owner"}</div>
                        <div className="text-[10px] text-slate-500 font-normal truncate">{selectedOwner?.nameAr || selectedOwner?.nameEn || "غير محدد"}</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedTargetEntity("PROPERTY")}
                      className={`p-2 rounded-xl border text-xs font-bold text-right flex items-center gap-1.5 transition-all cursor-pointer ${
                        selectedTargetEntity === "PROPERTY"
                          ? "bg-amber-50 border-amber-500 text-amber-900 ring-1 ring-amber-500"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <div className="truncate">
                        <div className="font-extrabold">{language === "ar" ? "العقار" : "Property"}</div>
                        <div className="text-[10px] text-slate-500 font-normal truncate">{selectedProperty?.nameAr || selectedProperty?.nameEn || "غير محدد"}</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedTargetEntity("LEASE")}
                      className={`p-2 rounded-xl border text-xs font-bold text-right flex items-center gap-1.5 transition-all cursor-pointer ${
                        selectedTargetEntity === "LEASE"
                          ? "bg-purple-50 border-purple-500 text-purple-900 ring-1 ring-purple-500"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <FolderKey className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <div className="truncate">
                        <div className="font-extrabold">{language === "ar" ? "العقد الحالي" : "Current Lease"}</div>
                        <div className="text-[10px] text-slate-500 font-normal truncate">#{leaseNumber || "جديد"}</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">{language === "ar" ? "اختر اسم/تصنيف الوثيقة" : "Select Document Type"}</label>
                    <select
                      value={selectedDocCategory}
                      onChange={(e) => setSelectedDocCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                    >
                      {DOCUMENT_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {language === "ar" ? cat.labelAr : cat.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <input
                      type="file"
                      ref={docFileInputRef}
                      onChange={(e) => handleFileUpload(e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!checkRequiredEntitiesSelected()) return;
                        docFileInputRef.current?.click();
                      }}
                      disabled={isUploadingDoc}
                      className="w-full py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingDoc ? (language === "ar" ? "جاري الرفع..." : "Uploading...") : language === "ar" ? "تحميل وإرفاق الملف" : "Upload Document"}</span>
                    </button>
                  </div>
                </div>

                {/* Uploaded Lease Docs List */}
                {leaseDocs.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="text-[11px] font-bold text-slate-700">{language === "ar" ? "المرفقات المرفوعة الخاصة بهذا العقد:" : "Current Lease Files:"}</div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                      {leaseDocs.map((doc, idx) => (
                        <div key={`${doc.id}-${idx}`} className="flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 p-2.5 rounded-xl border border-slate-200 text-xs transition-colors">
                          <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2 rtl:ml-2 rtl:mr-0">
                            <FileText className="w-4 h-4 text-amber-700 shrink-0" />
                            <div className="overflow-hidden">
                              <span className="font-bold text-slate-800 truncate block" title={doc.fileName}>{doc.fileName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">({Math.round((doc.fileSize || 0) / 1024)} KB) • {doc.category || "LEASES"}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handlePreviewDoc(doc)}
                              className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              title={language === "ar" ? "معاينة الملف" : "Preview"}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadDoc(doc)}
                              className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title={language === "ar" ? "تنزيل الملف كملف حقيقي" : "Download"}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(language === "ar" ? "هل أنت متأكد من حذف هذا الملف من العقد والأرشيف؟" : "Delete this file from lease archive?")) {
                                  deleteArchiveItem(doc.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title={language === "ar" ? "حذف الملف" : "Delete"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => handleTabChange(2)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                {language === "ar" ? "السابق: جدولة الدفعات" : "Back: Schedule"}
              </button>

              <button
                type="button"
                onClick={() => handleTabChange(4)}
                className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <span>{language === "ar" ? "الانتقال للمعاينة والاعتماد الإداري" : "Next: Review & Submit"}</span>
                <ChevronRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB 4: REVIEW & APPROVAL SUBMISSION ================= */}
        {activeTab === 4 && (
          <div className="flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              {/* Summary Review Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-xs">
                <div className="flex items-center justify-between font-black text-slate-900 border-b border-slate-200 pb-2">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {language === "ar" ? "ملخص بيانات العقد قبل الاعتماد والتفعيل" : "Lease Summary Review"}
                  </span>
                  <span className="font-mono text-amber-800">{leaseNumber}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200">
                    <div className="flex justify-between">
                      <span className="text-slate-500">{language === "ar" ? "المستأجر:" : "Tenant:"}</span>
                      <span className="font-bold text-slate-900">{selectedTenant ? (language === "ar" ? selectedTenant.nameAr : selectedTenant.nameEn) : "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{language === "ar" ? "المالك والعقار:" : "Owner & Prop:"}</span>
                      <span className="font-bold text-slate-900">
                        {selectedOwner ? (language === "ar" ? selectedOwner.nameAr : selectedOwner.nameEn) : "N/A"} • {selectedProperty ? (language === "ar" ? selectedProperty.nameAr : selectedProperty.nameEn) : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{language === "ar" ? "رقم الوحدة:" : "Unit #:"}</span>
                      <span className="font-bold text-emerald-700">{selectedUnit ? `Unit #${selectedUnit.unitNumber}` : "N/A"}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">{language === "ar" ? "الفترة الزمنيّة:" : "Period:"}</span>
                      <span className="font-bold text-slate-900">{startDate} → {endDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{language === "ar" ? "الإيجار السنوي:" : "Rent:"}</span>
                      <span className="font-black text-amber-800">AED {Number(annualRent || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{language === "ar" ? "عدد الدفعات والمرفقات:" : "Cheques & Files:"}</span>
                      <span className="font-bold text-slate-900">{installments.length} Cheques • {leaseDocs.length} Documents</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Review Installments & Payment Details Container */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-amber-700" />
                    <h4 className="text-xs font-black text-slate-900">
                      {language === "ar" ? "جدول بيانات الدفعات والشيكات للتأكد قبل الاعتماد" : "Payment & Installments Schedule Verification"}
                    </h4>
                  </div>
                  <span className="text-[11px] bg-amber-50 text-amber-900 px-2 py-0.5 rounded-lg border border-amber-200 font-mono font-bold">
                    {installments.length} {language === "ar" ? "دفعات" : "Installments"} • AED {installments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0).toLocaleString()}
                  </span>
                </div>

                {installments.length === 0 && (
                  <div className="p-4 text-center text-slate-500 text-xs bg-slate-50 rounded-xl">
                    {language === "ar" ? "لا توجد دفعات محددة بعد." : "No installments specified yet."}
                  </div>
                )}

                                <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4 shadow-2xs">
                  <label htmlFor="include-admin-fees-checkbox" className="text-sm font-black text-amber-900 cursor-pointer select-none w-full flex items-center justify-between">
                    <span>{language === "ar" ? "إدراج الرسوم الإدارية / عمولة المكتب لهذا العقد (اختياري)" : "Include Administrative Fees / Office Commission (Optional)"}</span>
                    <input
                      type="checkbox"
                      id="include-admin-fees-checkbox"
                      checked={includeAdminFees}
                      onChange={(e) => setIncludeAdminFees(e.target.checked)}
                      className="w-5 h-5 rounded-md text-blue-600 border-amber-300 focus:ring-blue-500 cursor-pointer"
                    />
                  </label>
                </div>

                {includeAdminFees && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-amber-200/50">
                                        {/* OWNER COMMISSION COLUMN */}
                    <div className="flex flex-col justify-between p-3 bg-white border border-slate-200 rounded-xl space-y-2.5">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <label className="flex items-center justify-between w-full text-xs font-bold text-slate-900 cursor-pointer select-none">
                            <span>{language === "ar" ? "تحصيل الرسوم من المالك" : "Collect Fee from Owner"}</span>
                            <input
                              type="checkbox"
                              id="owner-fee-enabled"
                              checked={ownerFeeEnabled}
                              onChange={(e) => setOwnerFeeEnabled(e.target.checked)}
                              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                            />
                          </label>
                        </div>

                        {ownerFeeEnabled && (() => {
                          const total = ownerFeeBasis === "PERCENTAGE_OF_RENT"
                            ? Math.round((Number(annualRent || 0) * Number(ownerFeeRate || 0)) / 100)
                            : Number(ownerFeeFixed || 0);
                            
                          const currentPolicy = {
                            owner: {
                              isExempt: ownerAdminFeeExempt,
                              exemptionReason: ownerAdminFeeExemptionReason,
                              exemptionNote: ownerAdminFeeExemptionNote,
                              approvalStatus: ownerAdminFeeApproved ? ("APPROVED" as const) : ("PENDING" as const)
                            }
                          };

                          const summary = calculateCommissionAmount(
                            ownerFeeBasis === "PERCENTAGE_OF_RENT" ? Number(annualRent || 0) : total * 100 / (Number(ownerFeeRate) || 5),
                            "OWNER",
                            ownerFeeBasis === "PERCENTAGE_OF_RENT" ? Number(ownerFeeRate) : (total / (Number(annualRent) || 1) * 100),
                            DEFAULT_COMMISSION_SETTINGS,
                            "ADMIN_FEE",
                            startDate || new Date().toISOString(),
                            vatRates,
                            owners,
                            tenants,
                            selectedProperty?.ownerId,
                            currentPolicy
                          );

                          return (
                            <div className="space-y-3 pt-1 text-xs">
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{language === "ar" ? "طريقة الاحتساب" : "Calculation Method"}</label>
                                  <select
                                    value={ownerFeeBasis}
                                    onChange={(e) => setOwnerFeeBasis(e.target.value as any)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                                  >
                                    <option value="PERCENTAGE_OF_RENT">{language === "ar" ? "نسبة مئوية من الإيجار (%)" : "Percentage of Rent (%)"}</option>
                                    <option value="FIXED_AMOUNT">{language === "ar" ? "مبلغ ثابت (درهم)" : "Fixed Amount (AED)"}</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{language === "ar" ? "النسبة المئوية (%)" : "Percentage (%)"}</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={ownerFeeBasis === "PERCENTAGE_OF_RENT" ? ownerFeeRate : ownerFeeFixed}
                                    onChange={(e) => ownerFeeBasis === "PERCENTAGE_OF_RENT" ? setOwnerFeeRate(e.target.value) : setOwnerFeeFixed(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{language === "ar" ? "تاريخ الاستحقاق" : "Due Date"}</label>
                                  <input
                                    type="date"
                                    value={ownerFeeDueDate || startDate || ""}
                                    onChange={(e) => setOwnerFeeDueDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none text-slate-700"
                                  />
                                </div>
                              </div>

                              {ownerAdminFeeExempt && (
                                <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-amber-800 uppercase tracking-tight">{language === "ar" ? "تفاصيل الإعفاء" : "Exemption Details"}</span>
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="checkbox"
                                        id="owner-exemption-approved-tab4"
                                        disabled={!canApproveExemption}
                                        checked={ownerAdminFeeApproved}
                                        onChange={(e) => setOwnerAdminFeeApproved(e.target.checked)}
                                        className="w-3 h-3 rounded text-amber-600 border-amber-300"
                                      />
                                      <label htmlFor="owner-exemption-approved-tab4" className="text-[9px] font-bold text-amber-900 cursor-pointer">{language === "ar" ? "اعتماد" : "Approve"}</label>
                                    </div>
                                  </div>
                                  <select
                                    value={ownerAdminFeeExemptionReason}
                                    onChange={(e) => setOwnerAdminFeeExemptReason(e.target.value as any)}
                                    className="w-full px-2 py-1 text-[10px] bg-white border border-amber-200 rounded-lg font-bold outline-none"
                                  >
                                    <option value="MANAGEMENT_DECISION">{language === "ar" ? "قرار إداري" : "Management Decision"}</option>
                                    <option value="SPECIAL_CONTRACT_AGREEMENT">{language === "ar" ? "اتفاقية خاصة" : "Special Agreement"}</option>
                                    <option value="PROMOTIONAL_EXEMPTION">{language === "ar" ? "إعفاء ترويجي" : "Promotional"}</option>
                                    <option value="RENEWAL_INCENTIVE">{language === "ar" ? "حافز تجديد" : "Renewal Incentive"}</option>
                                    <option value="OTHER">{language === "ar" ? "أسباب أخرى" : "Other Reasons"}</option>
                                  </select>
                                  <textarea
                                    value={ownerAdminFeeExemptionNote}
                                    onChange={(e) => setOwnerAdminFeeExemptNote(e.target.value)}
                                    rows={2}
                                    className="w-full px-2 py-1.5 text-[10px] bg-white border border-amber-200 rounded-lg font-bold outline-none resize-none"
                                    placeholder={language === "ar" ? "تفاصيل الإعفاء..." : "Exemption details..."}
                                  />
                                </div>
                              )}

                              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs space-y-2 mt-4">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-slate-700">{language === "ar" ? "إجمالي الرسوم المحتسبة:" : "Total Fees:"}</span>
                                  <span className="font-bold text-emerald-800">AED {summary.amount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-amber-700">{language === "ar" ? `الضريبة المستقطعة (${summary.vatRate}%):` : `VAT (${summary.vatRate}%):`}</span>
                                  <span className="font-bold text-amber-800">AED {summary.vatAmount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-emerald-200/50">
                                  <span className="font-bold text-emerald-800">{language === "ar" ? "المبلغ الخاضع للضريبة:" : "Amount Subject to VAT:"}</span>
                                  <span className="font-black text-emerald-900">AED {summary.netRevenue.toLocaleString()}</span>
                                </div>
                              </div>

                              <div className="pt-2">
                                <label className="flex items-center justify-between w-full cursor-pointer select-none">
                                  <span className="text-[11px] font-bold text-slate-700">{language === "ar" ? "تحصيل الرسوم فوراً عند إصدار العقد" : "Collect Fee Immediately"}</span>
                                  <input
                                    type="checkbox"
                                    checked={ownerFeeImmediateCollection}
                                    onChange={(e) => setOwnerFeeImmediateCollection(e.target.checked)}
                                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                                  />
                                </label>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                          <ShieldCheck className="w-4 h-4 text-slate-400" />
                          <span>{language === "ar" ? "إعفاء من الرسوم" : "Exempt from Fees"}</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ownerAdminFeeExempt}
                            onChange={(e) => setOwnerAdminFeeExempt(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>

                    {/* TENANT COMMISSION COLUMN */}
                    <div className="flex flex-col justify-between p-3 bg-white border border-slate-200 rounded-xl space-y-2.5">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <label className="flex items-center justify-between w-full text-xs font-bold text-slate-900 cursor-pointer select-none">
                            <span>{language === "ar" ? "تحصيل الرسوم من المستأجر" : "Collect Fee from Tenant"}</span>
                            <input
                              type="checkbox"
                              id="tenant-fee-enabled"
                              checked={tenantFeeEnabled}
                              onChange={(e) => setTenantFeeEnabled(e.target.checked)}
                              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                            />
                          </label>
                        </div>

                        {tenantFeeEnabled && (() => {
                          const total = tenantFeeBasis === "PERCENTAGE_OF_RENT"
                            ? Math.round((Number(annualRent || 0) * Number(tenantFeeRate || 0)) / 100)
                            : Number(tenantFeeFixed || 0);
                            
                          const currentPolicy = {
                            tenant: {
                              isExempt: tenantAdminFeeExempt,
                              exemptionReason: tenantAdminFeeExemptionReason,
                              exemptionNote: tenantAdminFeeExemptionNote,
                              approvalStatus: tenantAdminFeeApproved ? ("APPROVED" as const) : ("PENDING" as const)
                            }
                          };

                          const summary = calculateCommissionAmount(
                            tenantFeeBasis === "PERCENTAGE_OF_RENT" ? Number(annualRent || 0) : total * 100 / (Number(tenantFeeRate) || 5),
                            "TENANT",
                            tenantFeeBasis === "PERCENTAGE_OF_RENT" ? Number(tenantFeeRate) : (total / (Number(annualRent) || 1) * 100),
                            DEFAULT_COMMISSION_SETTINGS,
                            "ADMIN_FEE",
                            startDate || new Date().toISOString(),
                            vatRates,
                            owners,
                            tenants,
                            selectedProperty?.ownerId,
                            currentPolicy
                          );

                          return (
                            <div className="space-y-3 pt-1 text-xs">
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{language === "ar" ? "طريقة الاحتساب" : "Calculation Method"}</label>
                                  <select
                                    value={tenantFeeBasis}
                                    onChange={(e) => setTenantFeeBasis(e.target.value as any)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                                  >
                                    <option value="PERCENTAGE_OF_RENT">{language === "ar" ? "نسبة مئوية من الإيجار (%)" : "Percentage of Rent (%)"}</option>
                                    <option value="FIXED_AMOUNT">{language === "ar" ? "مبلغ ثابت (درهم)" : "Fixed Amount (AED)"}</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{language === "ar" ? "النسبة المئوية (%)" : "Percentage (%)"}</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={tenantFeeBasis === "PERCENTAGE_OF_RENT" ? tenantFeeRate : tenantFeeFixed}
                                    onChange={(e) => tenantFeeBasis === "PERCENTAGE_OF_RENT" ? setTenantFeeRate(e.target.value) : setTenantFeeFixed(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{language === "ar" ? "تاريخ الاستحقاق" : "Due Date"}</label>
                                  <input
                                    type="date"
                                    value={tenantFeeDueDate || startDate || ""}
                                    onChange={(e) => setTenantFeeDueDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none text-slate-700"
                                  />
                                </div>
                              </div>

                              {tenantAdminFeeExempt && (
                                <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-amber-800 uppercase tracking-tight">{language === "ar" ? "تفاصيل الإعفاء" : "Exemption Details"}</span>
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="checkbox"
                                        id="tenant-exemption-approved-tab4"
                                        disabled={!canApproveExemption}
                                        checked={tenantAdminFeeApproved}
                                        onChange={(e) => setTenantAdminFeeApproved(e.target.checked)}
                                        className="w-3 h-3 rounded text-amber-600 border-amber-300"
                                      />
                                      <label htmlFor="tenant-exemption-approved-tab4" className="text-[9px] font-bold text-amber-900 cursor-pointer">{language === "ar" ? "اعتماد" : "Approve"}</label>
                                    </div>
                                  </div>
                                  <select
                                    value={tenantAdminFeeExemptionReason}
                                    onChange={(e) => setTenantAdminFeeExemptReason(e.target.value as any)}
                                    className="w-full px-2 py-1 text-[10px] bg-white border border-amber-200 rounded-lg font-bold outline-none"
                                  >
                                    <option value="MANAGEMENT_DECISION">{language === "ar" ? "قرار إداري" : "Management Decision"}</option>
                                    <option value="SPECIAL_CONTRACT_AGREEMENT">{language === "ar" ? "اتفاقية خاصة" : "Special Agreement"}</option>
                                    <option value="PROMOTIONAL_EXEMPTION">{language === "ar" ? "إعفاء ترويجي" : "Promotional"}</option>
                                    <option value="RENEWAL_INCENTIVE">{language === "ar" ? "حافز تجديد" : "Renewal Incentive"}</option>
                                    <option value="OTHER">{language === "ar" ? "أسباب أخرى" : "Other Reasons"}</option>
                                  </select>
                                  <textarea
                                    value={tenantAdminFeeExemptionNote}
                                    onChange={(e) => setTenantAdminFeeExemptNote(e.target.value)}
                                    rows={2}
                                    className="w-full px-2 py-1.5 text-[10px] bg-white border border-amber-200 rounded-lg font-bold outline-none resize-none"
                                    placeholder={language === "ar" ? "تفاصيل الإعفاء..." : "Exemption details..."}
                                  />
                                </div>
                              )}

                              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs space-y-2 mt-4">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-slate-700">{language === "ar" ? "إجمالي الرسوم المحتسبة:" : "Total Fees:"}</span>
                                  <span className="font-bold text-emerald-800">AED {summary.amount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-amber-700">{language === "ar" ? `الضريبة المستقطعة (${summary.vatRate}%):` : `VAT (${summary.vatRate}%):`}</span>
                                  <span className="font-bold text-amber-800">AED {summary.vatAmount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-emerald-200/50">
                                  <span className="font-bold text-emerald-800">{language === "ar" ? "المبلغ الخاضع للضريبة:" : "Amount Subject to VAT:"}</span>
                                  <span className="font-black text-emerald-900">AED {summary.netRevenue.toLocaleString()}</span>
                                </div>
                              </div>

                              <div className="pt-2">
                                <label className="flex items-center justify-between w-full cursor-pointer select-none">
                                  <span className="text-[11px] font-bold text-slate-700">{language === "ar" ? "تحصيل الرسوم فوراً عند إصدار العقد" : "Collect Fee Immediately"}</span>
                                  <input
                                    type="checkbox"
                                    checked={tenantFeeImmediateCollection}
                                    onChange={(e) => setTenantFeeImmediateCollection(e.target.checked)}
                                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                                  />
                                </label>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                          <ShieldCheck className="w-4 h-4 text-slate-400" />
                          <span>{language === "ar" ? "إعفاء من الرسوم" : "Exempt from Fees"}</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={tenantAdminFeeExempt}
                            onChange={(e) => setTenantAdminFeeExempt(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pre-Flight Contract Readiness Check Card */}
                {(() => {
                  const isTenantReady = Boolean(tenantId);
                  const isUnitReady = Boolean(propertyId && unitId);
                  const isDatesReady = Boolean(startDate && endDate);
                  const isRentReady = Boolean(annualRent && Number(annualRent) > 0);
                  const isAllReady = isTenantReady && isUnitReady && isDatesReady && isRentReady && isVerified;

                  return (
                    <div className={`p-3.5 rounded-2xl border transition-all ${
                      isAllReady
                        ? "bg-emerald-50/70 border-emerald-200/80"
                        : "bg-amber-50/60 border-amber-200/80"
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className={`w-4 h-4 ${isAllReady ? "text-emerald-700" : "text-amber-700"}`} />
                          <span className={`text-xs font-black ${isAllReady ? "text-emerald-900" : "text-amber-950"}`}>
                            {language === "ar" ? "فحص جاهزية العقد للاعتماد والحفظ" : "Contract Pre-Flight Verification"}
                          </span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          isAllReady
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : "bg-amber-100 text-amber-900 border border-amber-300"
                        }`}>
                          {isAllReady
                            ? (language === "ar" ? "جاهز للاعتماد ✓" : "Ready for Approval ✓")
                            : (language === "ar" ? "يرجى استكمال الحقول" : "Action Required")}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${isTenantReady ? "bg-white border-emerald-100 text-emerald-800" : "bg-white border-amber-200 text-amber-800"}`}>
                          {isTenantReady ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border border-amber-400 flex items-center justify-center text-[9px] font-bold text-amber-700 shrink-0">!</span>}
                          <span className="truncate font-semibold">{language === "ar" ? "المستأجر" : "Tenant"}</span>
                        </div>

                        <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${isUnitReady ? "bg-white border-emerald-100 text-emerald-800" : "bg-white border-amber-200 text-amber-800"}`}>
                          {isUnitReady ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border border-amber-400 flex items-center justify-center text-[9px] font-bold text-amber-700 shrink-0">!</span>}
                          <span className="truncate font-semibold">{language === "ar" ? "العقار والوحدة" : "Property & Unit"}</span>
                        </div>

                        <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${isDatesReady && isRentReady ? "bg-white border-emerald-100 text-emerald-800" : "bg-white border-amber-200 text-amber-800"}`}>
                          {isDatesReady && isRentReady ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border border-amber-400 flex items-center justify-center text-[9px] font-bold text-amber-700 shrink-0">!</span>}
                          <span className="truncate font-semibold">{language === "ar" ? "المدة والإيجار" : "Dates & Rent"}</span>
                        </div>

                        <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${isVerified ? "bg-white border-emerald-100 text-emerald-800" : "bg-white border-amber-200 text-amber-800"}`}>
                          {isVerified ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border border-amber-400 flex items-center justify-center text-[9px] font-bold text-amber-700 shrink-0">!</span>}
                          <span className="truncate font-semibold">{language === "ar" ? "الإقرار الإداري" : "Declaration"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Administrative Declaration Checkbox */}
                <div className="p-4 bg-slate-100/80 border border-slate-200/90 rounded-2xl space-y-2">
                  <label className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      id="declaration-checkbox"
                      checked={isVerified}
                      onChange={(e) => setIsVerified(e.target.checked)}
                      className="w-4 h-4 mt-1 rounded text-amber-700 border-slate-300 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="font-semibold leading-relaxed">
                      {language === "ar"
                        ? "أقر بأنني قمت بمراجعة وتأكيد كافة البيانات المدخلة وبنود العقد وجدول الدفعات المذكورة أعلاه، وأتحمل المسؤولية الإدارية والمالية الكاملة عن صحتها."
                        : "I declare that I have reviewed and verified all the entered contract clauses and payment schedule above, and accept full administrative and financial responsibility."}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-200/80 shrink-0">
              <button
                type="button"
                onClick={() => handleTabChange(3)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl cursor-pointer transition-colors"
              >
                {language === "ar" ? "السابق: الأرشيف والمستندات" : "Back: Archive"}
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                >
                  {t("cancel")}
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  onClick={() => {
                    if (!isVerified) {
                      setIsVerified(true);
                    }
                  }}
                  className={`px-8 py-3 text-xs sm:text-sm font-black text-white rounded-xl shadow-md cursor-pointer flex items-center gap-2 transition-all ${
                    isSubmitting
                      ? "bg-slate-400 cursor-not-allowed opacity-60"
                      : "bg-amber-700 hover:bg-amber-800 active:scale-[0.98] shadow-amber-900/10 hover:shadow-lg"
                  }`}
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  )}
                  <span>
                    {isSubmitting
                      ? language === "ar"
                        ? "جاري الحفظ والاعتماد..."
                        : "Saving..."
                      : editingLease
                      ? language === "ar"
                        ? "حفظ وتحديث التعديلات"
                        : "Save & Update Lease"
                      : language === "ar"
                      ? "حفظ وإرسال للاعتماد"
                      : "Save & Submit Lease"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </Modal>

    {/* Smart Cheque Conflict Resolution Modal */}
    {conflictModalState && (
      <SmartChequeConflictModal
        isOpen={!!conflictModalState}
        onClose={() => setConflictModalState(null)}
        conflict={conflictModalState.conflictData}
        onUseOcr={(resolvedData) => {
          const { rowId, base64 } = conflictModalState;
          setInstallments((prev) =>
            prev.map((row) => {
              if (row.id === rowId) {
                return {
                  ...row,
                  chequeNumber: resolvedData.chequeNumber || row.chequeNumber,
                  bankName: resolvedData.bankName || row.bankName,
                  amount: resolvedData.amount > 0 ? resolvedData.amount : row.amount,
                  dueDate: resolvedData.dueDate || row.dueDate,
                  drawerName: resolvedData.drawerName || row.drawerName,
                  chequeImage: base64 || row.chequeImage,
                };
              }
              return row;
            })
          );
          setConflictModalState(null);
        }}
        onKeepOriginal={(resolvedData) => {
          const { rowId, conflictData, base64 } = conflictModalState;
          setInstallments((prev) =>
            prev.map((row) => {
              if (row.id === rowId) {
                return {
                  ...row,
                  chequeNumber: resolvedData.chequeNumber || row.chequeNumber,
                  bankName: resolvedData.bankName || row.bankName,
                  amount: conflictData.original.amount ?? row.amount, // Keep original installment amount intact
                  dueDate: resolvedData.dueDate || row.dueDate,
                  drawerName: resolvedData.drawerName || row.drawerName,
                  chequeImage: base64 || row.chequeImage,
                };
              }
              return row;
            })
          );
          setConflictModalState(null);
        }}
        onManualEditApply={(customData) => {
          const { rowId, base64 } = conflictModalState;
          setInstallments((prev) =>
            prev.map((row) => {
              if (row.id === rowId) {
                return {
                  ...row,
                  chequeNumber: customData.chequeNumber || row.chequeNumber,
                  bankName: customData.bankName || row.bankName,
                  amount: customData.amount > 0 ? customData.amount : row.amount,
                  dueDate: customData.dueDate || row.dueDate,
                  drawerName: customData.drawerName || row.drawerName,
                  chequeImage: base64 || row.chequeImage,
                };
              }
              return row;
            })
          );
          setConflictModalState(null);
        }}
      />
    )}

    {/* Multi-Cheque Batch OCR Modal for Lease Installments */}
    <BatchChequeOcrModal
      isOpen={isBatchOcrModalOpen}
      onClose={() => setIsBatchOcrModalOpen(false)}
      leaseId={editingLease?.id || tempRecordId}
      tenantId={tenantId}
      propertyId={propertyId}
      unitId={unitId}
      defaultDrawerName={tenants.find((t) => t.id === tenantId)?.nameAr}
      targetInstallments={installments.map((inst) => ({
        id: inst.id,
        installmentNumber: inst.installmentIndex,
        amount: inst.amount,
        dueDate: inst.dueDate,
        chequeNumber: inst.chequeNumber,
        bankName: inst.bankName,
        drawerName: inst.drawerName,
        paymentMethod: inst.paymentMethod,
        status: inst.status,
      }))}
      onApproveBatch={(stagedCheques) => {
        setInstallments((prev) => {
          const updated = [...prev];
          stagedCheques.forEach((staged) => {
            if (staged.installmentId) {
              const idx = updated.findIndex((r) => r.id === staged.installmentId);
              if (idx !== -1) {
                updated[idx] = {
                  ...updated[idx],
                  chequeNumber: staged.chequeNumber,
                  bankName: staged.bankName,
                  amount: staged.amount,
                  dueDate: staged.dueDate,
                  drawerName: staged.drawerName,
                  chequeImage: staged.imagePreview,
                  sourcePdfId: staged.sourcePdfId,
                  sourcePdfFileName: staged.sourcePdfFileName,
                  sourcePdfPageNumber: staged.pageNumber,
                  sourceCroppedRegion: staged.croppedRegion,
                  ingestionSessionId: staged.sessionId,
                };
              }
            }
          });
          return updated;
        });
        setIsBatchOcrModalOpen(false);
      }}
    />

    {/* Scanner Hardware Modal */}
    <ScannerModal documentType="LEASE"
      isOpen={!!scannerRowTargetId}
      onClose={() => setScannerRowTargetId(null)}
      onScanComplete={(base64, mimeType) => {
        if (scannerRowTargetId) {
          processOCRBase64Row(scannerRowTargetId, base64, mimeType);
        }
      }}
    />

    {/* Add New Bank Modal */}
    <AddBankModal
      isOpen={isAddBankModalOpen}
      onClose={() => {
        setIsAddBankModalOpen(false);
        setActiveBankRowId(null);
      }}
      onBankAdded={(newBank) => {
        const updated = getAllUaeBanks();
        setBankList(updated);
        if (activeBankRowId) {
          setInstallments((prev) =>
            prev.map((r) =>
              r.id === activeBankRowId
                ? { ...r, bankName: language === "ar" ? newBank.nameAr : newBank.nameEn }
                : r
            )
          );
        }
      }}
    />

    <SmartDocumentCaptureModal
      isOpen={isAiCaptureOpen}
      onClose={() => setIsAiCaptureOpen(false)}
      documentType="CHEQUE"
      onApprove={handleAiCaptureApprove}
    />

    {previewDocument && (
      <DocumentPreviewModal
        isOpen={Boolean(previewDocument)}
        onClose={() => setPreviewDocument(null)}
        document={previewDocument}
      />
    )}
  </>
);
};
