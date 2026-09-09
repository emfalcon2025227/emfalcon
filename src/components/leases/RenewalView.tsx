import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Building,
  User,
  DollarSign,
  Calendar,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Clock,
  Percent,
  Plus,
  Trash2,
  Send,
  CreditCard,
  Building2,
  Info,
  Check,
  ChevronDown,
  ChevronUp,
  Upload,
  ExternalLink,
  Printer,
  Sparkles,
  Search,
  Lock,
  FileCheck,
  XCircle,
  ShieldCheck,
  Scan,
  X,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { DocumentStorageService } from "../../services/documentStorageService";
import { optimizeDocument } from "../../services/documentOptimizer";
import { ScannerModal } from "../cheques/ScannerModal";
import { SmartDocumentCaptureModal } from "../ai/SmartDocumentCaptureModal";
import {
  calculateCommissionAmount,
  resolveAdministrativeFeePolicy,
  DEFAULT_COMMISSION_SETTINGS
} from "../../services/financialEngine";
import {
  Lease,
  LeaseRenewalRecord,
  RenewalDurationOption,
  RenewalPaymentItem,
  PaymentMethod,
  AdminFeeExemptionPolicy,
} from "../../types";
import { Badge } from "../common/Badge";
import { SearchableSelect, SearchableOption } from "../common/SearchableSelect";
import { Modal } from "../common/Modal";
import { CloseBackButton } from "../common/CloseBackButton";
import { UAE_BANKS, UaeBank } from "../../data/uaeBanks";
import { getAllUaeBanks } from "../../utils/bankUtils";
import { normalizeChequeOCR } from "../../utils/ocrChequeMapper";
import { getLeaseRenewalEligibility } from "../../utils/leaseRenewalRules";

interface RenewalViewProps {
  lease?: Lease | null;
  onBack?: () => void;
  onComplete?: (renewal: LeaseRenewalRecord) => void;
}

export const RenewalView: React.FC<RenewalViewProps> = ({
  lease: initialLease,
  onBack,
  onComplete,
}) => {
  const { t, language } = useLanguage();
  const isRtl = language === "ar";
  const {
    leases,
    properties,
    units,
    tenants,
    owners,
    cheques,
    createLeaseRenewal,
    approveLeaseRenewal,
    dispatchRenewalNotification,
    addArchiveItem,
    addCommissionObligation,
    collectAdministrativeFee,
    extractChequeOCR,
  } = useData();
  const { currentUser, hasPermission } = useAuth();

  const [scanningRowId, setScanningRowId] = useState<string | null>(null);
  const [scannerRowTargetId, setScannerRowTargetId] = useState<string | null>(null);
  const [isAiCaptureOpen, setIsAiCaptureOpen] = useState(false);
  const [aiCaptureTargetId, setAiCaptureTargetId] = useState<string | null>(null);
  const [bankList, setBankList] = useState<UaeBank[]>([]);
  const [ocrWarning, setOcrWarning] = useState<{
    rowId: string;
    extractedNum: string;
    extractedBank: string;
    extractedAmount: number;
    currentAmount: number;
    extractedDate: string;
    extractedDrawer: string;
    base64: string;
    fileName?: string;
  } | null>(null);

  useEffect(() => {
    setBankList(getAllUaeBanks());
  }, []);

  const applyChequeDataToScheduleRow = async (
    rowId: string,
    finalAmount: number,
    extractedNum: string,
    extractedBank: string,
    extractedDate: string,
    extractedDrawer: string,
    base64: string,
    fileName?: string
  ) => {
    setSchedule((prev) =>
      prev.map((row) => {
        if (row.id === rowId) {
          const currentDetails = row.chequeDetails || {
            chequeNumber: "",
            bankName: "",
            amount: finalAmount,
            chequeDate: row.dueDate,
            dueDate: row.dueDate,
            drawerName: "",
          };
          return {
            ...row,
            amount: finalAmount,
            dueDate: extractedDate || row.dueDate,
            chequeDetails: {
              ...currentDetails,
              chequeNumber: extractedNum || currentDetails.chequeNumber,
              bankName: extractedBank || currentDetails.bankName,
              amount: finalAmount,
              chequeDate: extractedDate || currentDetails.chequeDate,
              dueDate: extractedDate || currentDetails.dueDate,
              drawerName: extractedDrawer || currentDetails.drawerName || "",
              imageBase64: base64,
            },
          };
        }
        return row;
      })
    );

    const docTitle = isRtl
      ? `شيك مسح ضوئي ${extractedNum || rowId} - تجديد العقد`
      : `Scanned Cheque ${extractedNum || rowId} - Lease Renewal`;
    await DocumentStorageService.uploadAndArchive(base64, {
      category: "CHEQUES",
      entityType: activeLease?.propertyId ? "PROPERTY" : "TENANT",
      entityId: activeLease?.propertyId || activeLease?.tenantId || "sys",
      fileName: fileName || `scanned-cheque-${rowId}.jpg`,
      mimeType: "image/jpeg",
      description: docTitle,
      uploadedByUserId: currentUser?.id || "u-1",
      uploadedByName: currentUser?.nameAr || currentUser?.username || "المسؤول",
      tags: ["cheque", "ocr_scan", "financial"],
    });
  };

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
        
        const normalized = normalizeChequeOCR(ocrResult, isRtl ? "ar" : "en");
        
        extractedNum = normalized.chequeNumber;
        extractedBank = normalized.bankName;
        extractedAmount = normalized.amount;
        extractedDate = normalized.dueDate;
        extractedDrawer = normalized.drawerName;

      } catch (err: any) {
        console.warn("OCR AI extraction quota/error handled gracefully:", err?.message || err);
      }

      const targetRow = schedule.find((r) => r.id === rowId);
      const currentAmount = targetRow ? targetRow.amount : 0;

      if (extractedAmount <= 0 || (currentAmount > 0 && Math.abs(extractedAmount - currentAmount) > 0.01)) {
        setOcrWarning({
          rowId,
          extractedNum,
          extractedBank,
          extractedAmount: extractedAmount > 0 ? extractedAmount : 0,
          currentAmount,
          extractedDate,
          extractedDrawer,
          base64,
          fileName,
        });
      } else {
        const finalAmount = extractedAmount;
        await applyChequeDataToScheduleRow(
          rowId,
          finalAmount,
          extractedNum,
          extractedBank,
          extractedDate,
          extractedDrawer,
          base64,
          fileName
        );
      }
    } finally {
      setScanningRowId(null);
    }
  };

  const handleAiCaptureApprove = (
    result: any,
    imageBase64: string,
    mimeType: string,
    saveToArchive: boolean
  ) => {
    if (!aiCaptureTargetId) return;
    processOCRBase64Row(aiCaptureTargetId, imageBase64, mimeType, "smart-capture-cheque.jpg");
    setIsAiCaptureOpen(false);
    setAiCaptureTargetId(null);
  };

  // Selected lease state (if not passed as prop or to switch contract)
  const [selectedLeaseId, setSelectedLeaseId] = useState<string>(
    initialLease?.id || (leases.length > 0 ? leases[0].id : "")
  );

  const activeLease: Lease | undefined = useMemo(() => {
    return initialLease && initialLease.id === selectedLeaseId
      ? initialLease
      : leases.find((l) => l.id === selectedLeaseId) || initialLease || undefined;
  }, [initialLease, selectedLeaseId, leases]);

  const selectedTenant = useMemo(
    () => tenants.find((t) => t.id === activeLease?.tenantId),
    [tenants, activeLease?.tenantId]
  );
  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === activeLease?.propertyId),
    [properties, activeLease?.propertyId]
  );
  const selectedUnit = useMemo(
    () => units.find((u) => u.id === activeLease?.unitId),
    [units, activeLease?.unitId]
  );
  const selectedOwner = useMemo(
    () => owners.find((o) => o.id === activeLease?.ownerId),
    [owners, activeLease?.ownerId]
  );

  // Permissions check
  const isExecutiveAdmin =
    currentUser?.role === "SYSTEM_OWNER" || currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "MANAGER";
  const canCreateRenewal =
    isExecutiveAdmin ||
    currentUser?.role === "FINANCE" ||
    currentUser?.role === "PROPERTY_MANAGER" ||
    currentUser?.role === "DATA_ENTRY" ||
    hasPermission("EDIT_SAVED_FINANCIAL_RECORDS");
  const canDirectApprove =
    isExecutiveAdmin || hasPermission("EDIT_SAVED_FINANCIAL_RECORDS");

  // Renewal Eligibility Check (30-day window or expired rule)
  const renewalEligibility = useMemo(() => {
    return activeLease ? getLeaseRenewalEligibility(activeLease, isRtl ? "ar" : "en") : null;
  }, [activeLease, isRtl]);

  // Form State: Dates & Duration
  const [durationPreset, setDurationPreset] = useState<RenewalDurationOption>("1_YEAR");
  const [newStartDate, setNewStartDate] = useState<string>("");
  const [newEndDate, setNewEndDate] = useState<string>("");

  // Form State: Financials
  const [newAnnualRent, setNewAnnualRent] = useState<number>(0);
  const [rentIncreaseType, setRentIncreaseType] = useState<"NONE" | "PERCENT" | "AMOUNT" | "CUSTOM">("NONE");
  const [rentIncreaseValue, setRentIncreaseValue] = useState<number>(0);
  const [increaseReason, setIncreaseReason] = useState<string>("");
  const [securityDeposit, setSecurityDeposit] = useState<number>(0);
  const [ejariNumber, setEjariNumber] = useState<string>("");

  // Form State: Installments & Payment Schedule
  const [installmentsCount, setInstallmentsCount] = useState<number>(4);
  const [paymentFrequency, setPaymentFrequency] = useState<string>("QUARTERLY_4_CHEQUES");
  const [schedule, setSchedule] = useState<RenewalPaymentItem[]>([]);
  const [expandedItemIndex, setExpandedItemIndex] = useState<number | null>(0);

  // Form State: Approvals, Risk Override & Notifications
  const [riskOverrideReason, setRiskOverrideReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [directApprove, setDirectApprove] = useState<boolean>(isExecutiveAdmin);
  const [sendWhatsAppAlert, setSendWhatsAppAlert] = useState<boolean>(true);

  // Form State: Attachments
  const [attachedFiles, setAttachedFiles] = useState<
    Array<{ id: string; name: string; size: number; type: string; dataUrl: string }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI Flow & Validation States
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);

  // Form State: Administrative Fees / Commission
  const [includeAdminFees, setIncludeAdminFees] = useState<boolean>(false);
  
  // Tenant Fee State
  const [tenantFeeEnabled, setTenantFeeEnabled] = useState<boolean>(true);
  const [tenantFeeBasis, setTenantFeeBasis] = useState<"PERCENTAGE_OF_RENT" | "FIXED_AMOUNT">("PERCENTAGE_OF_RENT");
  const [tenantFeeRate, setTenantFeeRate] = useState<number | "">(5); // Will be updated by effect
  const [tenantFeeFixed, setTenantFeeFixed] = useState<number | "">("");
  const [tenantFeeDueDate, setTenantFeeDueDate] = useState<string>("");
  const [tenantFeeImmediateCollection, setTenantFeeImmediateCollection] = useState<boolean>(false);

  // Owner Fee State
  const [ownerFeeEnabled, setOwnerFeeEnabled] = useState<boolean>(true);
  const [ownerFeeBasis, setOwnerFeeBasis] = useState<"PERCENTAGE_OF_RENT" | "FIXED_AMOUNT">("PERCENTAGE_OF_RENT");
  const [ownerFeeRate, setOwnerFeeRate] = useState<number | "">(5); // Will be updated by effect
  const [ownerFeeFixed, setOwnerFeeFixed] = useState<number | "">("");
  const [ownerFeeDueDate, setOwnerFeeDueDate] = useState<string>("");
  const [ownerFeeImmediateCollection, setOwnerFeeImmediateCollection] = useState<boolean>(false);

  // Phase 5.3: Admin Fee Exemption States
  const [ownerAdminFeeExempt, setOwnerAdminFeeExempt] = useState(false);
  const [ownerAdminFeeExemptionReason, setOwnerAdminFeeExemptReason] = useState<AdminFeeExemptionPolicy["exemptionReason"]>("MANAGEMENT_DECISION");
  const [ownerAdminFeeExemptionNote, setOwnerAdminFeeExemptNote] = useState("");
  const [ownerAdminFeeApproved, setOwnerAdminFeeApproved] = useState(false);

  const [tenantAdminFeeExempt, setTenantAdminFeeExempt] = useState(false);
  const [tenantAdminFeeExemptionReason, setTenantAdminFeeExemptReason] = useState<AdminFeeExemptionPolicy["exemptionReason"]>("MANAGEMENT_DECISION");
  const [tenantAdminFeeExemptionNote, setTenantAdminFeeExemptNote] = useState("");
  const [tenantAdminFeeApproved, setTenantAdminFeeApproved] = useState(false);

  const canApproveExemption = hasPermission("APPROVE_FINANCIAL_EXEMPTIONS") || hasPermission("EDIT_SAVED_FINANCIAL_RECORDS");

  // Risk evaluation for selected tenant
  const isHighRiskTenant =
    selectedTenant &&
    (selectedTenant.riskLevel === "HIGH" ||
      selectedTenant.riskLevel === "MEDIUM" ||
      (selectedTenant.bouncedChequesCount && selectedTenant.bouncedChequesCount > 0));

  // Initialize values when active lease changes
  useEffect(() => {
    if (activeLease) {
      let nextStart = "";
      let nextEnd = "";

      if (activeLease.endDate) {
        const oldEnd = new Date(activeLease.endDate);
        if (!isNaN(oldEnd.getTime())) {
          const s = new Date(oldEnd);
          s.setDate(s.getDate() + 1);
          nextStart = s.toISOString().split("T")[0];

          const e = new Date(s);
          e.setFullYear(e.getFullYear() + 1);
          e.setDate(e.getDate() - 1);
          nextEnd = e.toISOString().split("T")[0];
        }
      } else {
        const today = new Date();
        nextStart = today.toISOString().split("T")[0];
        const nextYear = new Date(today);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        nextEnd = nextYear.toISOString().split("T")[0];
      }

      setNewStartDate(nextStart);
      setNewEndDate(nextEnd);
      setDurationPreset("1_YEAR");

      const baseRent = activeLease.annualRent || 0;
      setNewAnnualRent(baseRent);
      setRentIncreaseType("NONE");
      setRentIncreaseValue(0);
      setIncreaseReason("");

      const count = activeLease.installmentsCount || activeLease.chequesCount || 4;
      setInstallmentsCount(count);
      setPaymentFrequency(activeLease.paymentFrequency || "QUARTERLY_4_CHEQUES");
      setSecurityDeposit(activeLease.securityDeposit || 0);
      setEjariNumber(activeLease.ejariNumber || "");
      setNotes("");
      setRiskOverrideReason("");
      setErrorMsg("");

      setTenantFeeDueDate(nextStart);
      setOwnerFeeDueDate(nextStart);

      // Phase 5.3: Renewal Safety - Reset exemptions on renewal
      setOwnerAdminFeeExempt(false);
      setTenantAdminFeeExempt(false);
      setOwnerAdminFeeApproved(false);
      setTenantAdminFeeApproved(false);

      // Auto-generate initial schedule
      generateInstallmentsSchedule(baseRent, count, nextStart);
    }
  }, [activeLease?.id]);

  // Handle Preset Duration changes
  const handleDurationPresetChange = (preset: RenewalDurationOption) => {
    setDurationPreset(preset);
    if (!newStartDate) return;

    const s = new Date(newStartDate);
    if (isNaN(s.getTime())) return;

    const e = new Date(s);
    let years = 1;
    if (preset === "1_YEAR") {
      years = 1;
      e.setFullYear(e.getFullYear() + 1);
      e.setDate(e.getDate() - 1);
      setNewEndDate(e.toISOString().split("T")[0]);
    } else if (preset === "2_YEARS") {
      years = 2;
      e.setFullYear(e.getFullYear() + 2);
      e.setDate(e.getDate() - 1);
      setNewEndDate(e.toISOString().split("T")[0]);
    } else if (preset === "3_YEARS") {
      years = 3;
      e.setFullYear(e.getFullYear() + 3);
      e.setDate(e.getDate() - 1);
      setNewEndDate(e.toISOString().split("T")[0]);
    }

    // Regenerate installments matching the full duration total contract value
    generateInstallmentsSchedule(newAnnualRent, installmentsCount, newStartDate, years);
  };

  // Compute duration in years
  const durationYears = useMemo(() => {
    if (durationPreset === "1_YEAR") return 1;
    if (durationPreset === "2_YEARS") return 2;
    if (durationPreset === "3_YEARS") return 3;
    if (newStartDate && newEndDate) {
      const s = new Date(newStartDate).getTime();
      const e = new Date(newEndDate).getTime();
      if (e > s) {
        const days = (e - s) / (1000 * 60 * 60 * 24);
        return Math.max(1, Math.round(days / 365.25));
      }
    }
    return 1;
  }, [durationPreset, newStartDate, newEndDate]);

  // Total Contract Value for the full lease period
  const totalContractValue = useMemo(() => {
    return (Number(newAnnualRent) || 0) * durationYears;
  }, [newAnnualRent, durationYears]);

  // Update rates dynamically based on party policies
  useEffect(() => {
    if (activeLease) {
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

      const ownerPolicy = resolveAdministrativeFeePolicy("OWNER", activeLease.ownerId, leasePolicy, DEFAULT_COMMISSION_SETTINGS, owners, tenants);
      setOwnerFeeRate(ownerPolicy.rate);

      const tenantPolicy = resolveAdministrativeFeePolicy("TENANT", activeLease.tenantId, leasePolicy, DEFAULT_COMMISSION_SETTINGS, owners, tenants);
      setTenantFeeRate(tenantPolicy.rate);
    }
  }, [activeLease?.id, owners, tenants, ownerAdminFeeExempt, ownerAdminFeeApproved, tenantAdminFeeExempt, tenantAdminFeeApproved]);

  // Helper to generate installments schedule covering the full duration
  const generateInstallmentsSchedule = (
    annualRentVal: number,
    count: number,
    start: string,
    years: number = durationYears
  ) => {
    const totalRent = (annualRentVal || 0) * years;
    if (!totalRent || count <= 0 || !start) return;

    const baseAmount = Math.floor(totalRent / count);
    const remainder = totalRent - baseAmount * count;

    const totalMonths = years * 12;
    const monthsInterval = totalMonths / count;
    const startDateObj = new Date(start);

    const items: RenewalPaymentItem[] = [];
    for (let i = 0; i < count; i++) {
      const dueDateObj = new Date(startDateObj);
      const addedMonths = Math.round(i * monthsInterval);
      dueDateObj.setMonth(dueDateObj.getMonth() + addedMonths);
      const dueDateStr = !isNaN(dueDateObj.getTime())
        ? dueDateObj.toISOString().split("T")[0]
        : start;

      const itemAmount = i === 0 ? baseAmount + remainder : baseAmount;

      const prevBank = activeLease ? (cheques.find((c) => c.leaseId === activeLease.id && c.bankName)?.bankName || "") : "";

      items.push({
        id: `inst-${Date.now()}-${i}`,
        installmentNumber: i + 1,
        amount: itemAmount,
        dueDate: dueDateStr,
        paymentMethod: "CHEQUE",
        isAdvance: i === 0,
        status: "PENDING",
        chequeDetails: {
          chequeNumber: "",
          bankName: prevBank,
          amount: itemAmount,
          chequeDate: dueDateStr,
          dueDate: dueDateStr,
          drawerName: "",
        },
      });
    }

    setSchedule(items);
  };

  // When Annual Rent adjustment strategy changes
  const applyRentIncrease = (
    type: "NONE" | "PERCENT" | "AMOUNT" | "CUSTOM",
    val: number
  ) => {
    const baseRent = activeLease?.annualRent || 0;
    setRentIncreaseType(type);
    setRentIncreaseValue(val);

    let calculatedRent = baseRent;
    if (type === "NONE") {
      calculatedRent = baseRent;
    } else if (type === "PERCENT") {
      calculatedRent = Math.round(baseRent + (baseRent * val) / 100);
    } else if (type === "AMOUNT") {
      calculatedRent = Math.round(baseRent + val);
    } else if (type === "CUSTOM") {
      calculatedRent = val;
    }

    setNewAnnualRent(calculatedRent);
    generateInstallmentsSchedule(calculatedRent, installmentsCount, newStartDate);
  };

  const handleInstallmentsCountChange = (count: number) => {
    setInstallmentsCount(count);
    const freq =
      count === 1
        ? "ONE_CHEQUE"
        : count === 2
        ? "TWO_CHEQUES"
        : count === 4
        ? "QUARTERLY_4_CHEQUES"
        : count === 6
        ? "BI_MONTHLY_6_CHEQUES"
        : "MONTHLY_12_CHEQUES";
    setPaymentFrequency(freq);
    generateInstallmentsSchedule(newAnnualRent, count, newStartDate);
  };

  // Schedule item editor
  const updateScheduleItem = (
    index: number,
    patch: Partial<RenewalPaymentItem>
  ) => {
    setSchedule((prev) => {
      const updated = [...prev];
      const current = updated[index];
      const newItem = { ...current, ...patch };

      if (patch.paymentMethod === "DEFERRED") {
        newItem.deferredDetails = {
          deferredAmount: newItem.amount || current.amount,
          expectedDueDate:
            current.deferredDetails?.expectedDueDate || current.dueDate,
          deferralReason:
            current.deferredDetails?.deferralReason ||
            "دفعة مؤجلة عند تجديد العقد",
          responsiblePerson:
            current.deferredDetails?.responsiblePerson ||
            (currentUser?.nameAr ||
              currentUser?.nameEn ||
              "مسؤول التحصيل المالي"),
          responsibleUserId:
            current.deferredDetails?.responsibleUserId || currentUser?.id,
          allowedDays: current.deferredDetails?.allowedDays || 30,
          followUpDate:
            current.deferredDetails?.followUpDate || current.dueDate,
        };
      }

      if (patch.paymentMethod === "CHEQUE" && !newItem.chequeDetails) {
        const prevBank = activeLease ? (cheques.find((c) => c.leaseId === activeLease.id && c.bankName)?.bankName || "") : "";
        newItem.chequeDetails = {
          chequeNumber: "",
          bankName: prevBank,
          amount: newItem.amount || 0,
          chequeDate: newItem.dueDate,
          dueDate: newItem.dueDate,
          drawerName: "",
        };
      }

      updated[index] = newItem;
      return updated;
    });
  };

  const addCustomInstallmentRow = () => {
    const nextNum = schedule.length + 1;
    const lastDate = schedule.length > 0 ? schedule[schedule.length - 1].dueDate : newStartDate;
    const d = new Date(lastDate);
    d.setMonth(d.getMonth() + 1);
    const nextDateStr = !isNaN(d.getTime()) ? d.toISOString().split("T")[0] : newStartDate;

    setSchedule((prev) => [
      ...prev,
      {
        id: `inst-${Date.now()}-${nextNum}`,
        installmentNumber: nextNum,
        amount: 0,
        dueDate: nextDateStr,
        paymentMethod: "CHEQUE",
        status: "PENDING",
        chequeDetails: {
          chequeNumber: "",
          bankName: activeLease ? (cheques.find((c) => c.leaseId === activeLease.id && c.bankName)?.bankName || "") : "",
          amount: 0,
          chequeDate: nextDateStr,
          dueDate: nextDateStr,
          drawerName: "",
        },
      },
    ]);
    setInstallmentsCount(nextNum);
  };

  const removeInstallmentRow = (index: number) => {
    if (schedule.length <= 1) return;
    const filtered = schedule.filter((_, idx) => idx !== index);
    const reindexed = filtered.map((item, idx) => ({
      ...item,
      installmentNumber: idx + 1,
    }));
    setSchedule(reindexed);
    setInstallmentsCount(reindexed.length);
  };

  // Schedule Total calculations
  const scheduleTotal = schedule.reduce((sum, item) => sum + (item.amount || 0), 0);
  const isScheduleBalanced = Math.abs(scheduleTotal - totalContractValue) < 1;
  const rentDifference = newAnnualRent - (activeLease?.annualRent || 0);
  const rentPercentageDiff = activeLease?.annualRent
    ? ((rentDifference / activeLease.annualRent) * 100).toFixed(2)
    : "0.00";

  // File Upload Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const dataUrl = loadEvt.target?.result as string;
        setAttachedFiles((prev) => [
          ...prev,
          {
            id: `att-${Date.now()}-${crypto.randomUUID().split("-")[0]}`,
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachedFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Submission validation
  const validateForm = (): boolean => {
    setErrorMsg("");

    if (!activeLease) {
      setErrorMsg(
        isRtl
          ? "يرجى اختيار عقد إيجار صالح لتجديده"
          : "Please select a valid lease contract to renew"
      );
      return false;
    }

    if (!newStartDate || !newEndDate) {
      setErrorMsg(
        isRtl
          ? "يرجى تحديد تاريخ بداية ونهاية العقد المجدد بشكل صحيح"
          : "Please specify valid renewal start and end dates"
      );
      return false;
    }

    if (new Date(newEndDate) <= new Date(newStartDate)) {
      setErrorMsg(
        isRtl
          ? "تاريخ انتهاء العقد يجب أن يكون لاحقاً لتاريخ البداية"
          : "End date must be after start date"
      );
      return false;
    }

    if (newAnnualRent <= 0) {
      setErrorMsg(
        isRtl
          ? "قيمة الإيجار السنوي يجب أن تكون أكبر من الصفر"
          : "Annual rent must be greater than zero"
      );
      return false;
    }

    if (schedule.length === 0) {
      setErrorMsg(
        isRtl
          ? "يرجى تحديد دفعة واحدة على الأقل في جدول السداد"
          : "Please add at least one installment in payment schedule"
      );
      return false;
    }

    if (!isScheduleBalanced) {
      setErrorMsg(
        isRtl
          ? `مجموع الدفعات (${scheduleTotal.toLocaleString()} درهم) لا يطابق إجمالي قيمة العقد الجديد (${Number(totalContractValue || 0).toLocaleString()} درهم) لمدة ${durationYears} ${durationYears === 1 ? "سنة" : "سنوات"}. الفارق: ${(totalContractValue - scheduleTotal).toLocaleString()} درهم`
          : `Schedule sum (${scheduleTotal.toLocaleString()} AED) does not match total contract value (${Number(totalContractValue || 0).toLocaleString()} AED) for ${durationYears} year(s). Difference: ${(totalContractValue - scheduleTotal).toLocaleString()} AED`
      );
      return false;
    }

    // Check mandatory expected due date on all DEFERRED items
    for (let i = 0; i < schedule.length; i++) {
      const item = schedule[i];
      if (item.paymentMethod === "DEFERRED") {
        if (
          !item.deferredDetails?.expectedDueDate ||
          item.deferredDetails.expectedDueDate.trim() === ""
        ) {
          setErrorMsg(
            isRtl
              ? `الدفعة رقم ${item.installmentNumber} (مؤجلة): تاريخ الاستحقاق المتوقع إلزامي!`
              : `Installment #${item.installmentNumber} (Deferred): Expected due date is mandatory!`
          );
          setExpandedItemIndex(i);
          return false;
        }
      }
    }

    // Lease Renewal Governance Rule Check
    if (renewalEligibility && !renewalEligibility.isEligible) {
      setErrorMsg(renewalEligibility.message);
      return false;
    }

    // High risk justification
    if (isHighRiskTenant && (!riskOverrideReason || riskOverrideReason.trim().length < 5)) {
      setErrorMsg(
        isRtl
          ? "المستأجر مصنف عالي/متوسط المخاطر! يجب إدخال سبب التجاوز والموافقة الإدارية بشكل إلزامي."
          : "Tenant is high/medium risk! Executive override justification is strictly required."
      );
      return false;
    }

    return true;
  };

  const handleOpenConfirmModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setIsConfirmModalOpen(true);
    }
  };

  // Final Execution Submission
  const handleExecuteRenewal = async () => {
    if (!activeLease) return;
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      // 1. Prepare attached document IDs and archive them
      const documentIds: string[] = [];
      for (const file of attachedFiles) {
        const archiveItem = await DocumentStorageService.uploadAndArchive(file.dataUrl, {
          category: "LEASES",
          entityType: "LEASE_RENEWAL",
          entityId: activeLease.id,
          fileName: file.name,
          mimeType: file.type,
          description: `تجديد عقد #${activeLease.leaseNumber} - ${file.name}`,
          uploadedByUserId: currentUser?.id,
          uploadedByName:
            currentUser?.nameAr || currentUser?.nameEn || "مسؤول النظام",
          tags: ["RENEWAL"],
        });
        documentIds.push(archiveItem.id);
      }

      // 2. Call createLeaseRenewal
      const res = createLeaseRenewal({
        originalLeaseId: activeLease.id,
        originalLeaseNumber: activeLease.leaseNumber,
        ownerId: activeLease.ownerId,
        ownerNameAr: selectedOwner?.nameAr,
        ownerNameEn: selectedOwner?.nameEn,
        propertyId: activeLease.propertyId,
        propertyNameAr: selectedProperty?.nameAr,
        propertyNameEn: selectedProperty?.nameEn,
        unitId: activeLease.unitId,
        unitNumber: selectedUnit?.unitNumber,
        tenantId: activeLease.tenantId,
        tenantNameAr: selectedTenant?.nameAr,
        tenantNameEn: selectedTenant?.nameEn,
        currentAnnualRent: activeLease.annualRent,
        newAnnualRent,
        increaseAmount: rentDifference,
        increasePercentage: parseFloat(rentPercentageDiff),
        increaseReason: increaseReason || undefined,
        durationOption: durationPreset,
        originalStartDate: activeLease.startDate,
        originalEndDate: activeLease.endDate,
        newStartDate,
        newEndDate,
        installmentsCount,
        paymentFrequency,
        paymentSchedule: schedule,
        securityDeposit,
        ejariNumber,
        notes: notes
          ? isHighRiskTenant
            ? `[تجاوز إداري للمخاطر: ${riskOverrideReason}] - ${notes}`
            : notes
          : isHighRiskTenant
          ? `[تجاوز إداري للمخاطر: ${riskOverrideReason}]`
          : undefined,
        attachedDocumentIds: documentIds,
        adminFeePolicy: {
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
        }
      });

      if (!res.success || !res.renewal) {
        setErrorMsg(res.error || "Failed to create lease renewal record");
        setIsSubmitting(false);
        setIsConfirmModalOpen(false);
        return;
      }

      let finalRenewal = res.renewal;

      // 3. Direct Approve if selected and authorized
      if (directApprove && canDirectApprove) {
        const approveRes = approveLeaseRenewal(
          res.renewal.id,
          isHighRiskTenant
            ? `اعتماد وتفعيل مباشر مع تجاوز المخاطر: ${riskOverrideReason}`
            : "اعتماد وتفعيل مباشر للعقد المجدد"
        );
        if (approveRes.success && approveRes.renewal) {
          finalRenewal = approveRes.renewal;
        }
      }

      // 3.5 Record Administrative Fees if enabled and lease exists
      if (includeAdminFees && finalRenewal.newLeaseId) {
        const commissionYear = new Date(newStartDate).getFullYear().toString();
        
        if (ownerFeeEnabled) {
          const amount = ownerFeeBasis === "PERCENTAGE_OF_RENT"
            ? Math.round((newAnnualRent * Number(ownerFeeRate || 0)) / 100)
            : Number(ownerFeeFixed || 0);

          if (amount > 0) {
            const cRes = addCommissionObligation({
              leaseId: finalRenewal.newLeaseId,
              businessKeySequence: "RENEWAL_OWNER",
              ownerId: activeLease.ownerId,
              propertyId: activeLease.propertyId,
              unitId: activeLease.unitId,
              partyType: "OWNER",
              commissionType: "ADMIN_FEE",
              calculationBasis: ownerFeeBasis,
              baseAmount: newAnnualRent,
              ratePercentage: ownerFeeBasis === "PERCENTAGE_OF_RENT" ? Number(ownerFeeRate) : undefined,
              fixedAmount: ownerFeeBasis === "FIXED_AMOUNT" ? Number(ownerFeeFixed) : undefined,
              totalCommissionAmount: amount,
              dueDate: ownerFeeDueDate || newStartDate,
              notes: isRtl
                ? `رسوم إدارية لتجديد العقد #${activeLease.leaseNumber} للعام ${commissionYear}`
                : `Admin fees for renewal of #${activeLease.leaseNumber} for ${commissionYear}`,
              contractualCommissionYear: commissionYear,
              renewalSequence: 1,
              isOverride: false,
              // Exemption Metadata
              isExempt: ownerAdminFeeExempt && ownerAdminFeeApproved,
              exemptionSource: ownerAdminFeeExempt && ownerAdminFeeApproved ? "CONTRACT_EXEMPTION" : undefined,
              exemptionReason: ownerAdminFeeExempt && ownerAdminFeeApproved ? ownerAdminFeeExemptionReason : undefined,
              approvalStatus: ownerAdminFeeExempt ? (ownerAdminFeeApproved ? "APPROVED" : "PENDING") : undefined,
              approvedBy: ownerAdminFeeApproved ? (currentUser?.username || "Admin") : undefined,
            });

            if (cRes.success && cRes.commission && ownerFeeImmediateCollection) {
              collectAdministrativeFee(cRes.commission.id, amount, "CASH", "IMMEDIATE", isRtl ? "تحصيل فوري عند التجديد" : "Immediate collection on renewal");
            }
          }
        }

        if (tenantFeeEnabled) {
          const amount = tenantFeeBasis === "PERCENTAGE_OF_RENT"
            ? Math.round((newAnnualRent * Number(tenantFeeRate || 0)) / 100)
            : Number(tenantFeeFixed || 0);

          if (amount > 0) {
            const cRes = addCommissionObligation({
              leaseId: finalRenewal.newLeaseId,
              businessKeySequence: "RENEWAL_TENANT",
              tenantId: activeLease.tenantId,
              propertyId: activeLease.propertyId,
              unitId: activeLease.unitId,
              partyType: "TENANT",
              commissionType: "ADMIN_FEE",
              calculationBasis: tenantFeeBasis,
              baseAmount: newAnnualRent,
              ratePercentage: tenantFeeBasis === "PERCENTAGE_OF_RENT" ? Number(tenantFeeRate) : undefined,
              fixedAmount: tenantFeeBasis === "FIXED_AMOUNT" ? Number(tenantFeeFixed) : undefined,
              totalCommissionAmount: amount,
              dueDate: tenantFeeDueDate || newStartDate,
              notes: isRtl
                ? `رسوم إدارية لتجديد العقد #${activeLease.leaseNumber} للعام ${commissionYear}`
                : `Admin fees for renewal of #${activeLease.leaseNumber} for ${commissionYear}`,
              contractualCommissionYear: commissionYear,
              renewalSequence: 1,
              isOverride: false,
              // Exemption Metadata
              isExempt: tenantAdminFeeExempt && tenantAdminFeeApproved,
              exemptionSource: tenantAdminFeeExempt && tenantAdminFeeApproved ? "CONTRACT_EXEMPTION" : undefined,
              exemptionReason: tenantAdminFeeExempt && tenantAdminFeeApproved ? tenantAdminFeeExemptionReason : undefined,
              approvalStatus: tenantAdminFeeExempt ? (tenantAdminFeeApproved ? "APPROVED" : "PENDING") : undefined,
              approvedBy: tenantAdminFeeApproved ? (currentUser?.username || "Admin") : undefined,
            });

            if (cRes.success && cRes.commission && tenantFeeImmediateCollection) {
              collectAdministrativeFee(cRes.commission.id, amount, "CASH", "IMMEDIATE", isRtl ? "تحصيل فوري عند التجديد" : "Immediate collection on renewal");
            }
          }
        }
      }

      // 4. Send WhatsApp Notification if toggled
      if (sendWhatsAppAlert) {
        dispatchRenewalNotification(finalRenewal.id, "WHATSAPP");
      }

      setIsConfirmModalOpen(false);
      setSuccessMsg(
        isRtl
          ? `تم إنجاز تجديد عقد الإيجار بنجاح! رقم طلب التجديد: #${finalRenewal.renewalNumber}`
          : `Lease renewal completed successfully! Request #${finalRenewal.renewalNumber}`
      );

      // Trigger callbacks
      if (onComplete) {
        onComplete(finalRenewal);
      } else if (onBack) {
        setTimeout(() => onBack(), 1200);
      }
    } catch (err: any) {
      console.error("Renewal execution error:", err);
      setErrorMsg(err.message || "An unexpected error occurred during renewal");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Lease options for searchable combobox if user wishes to change active lease
  const leaseOptions: SearchableOption[] = useMemo(() => {
    return leases.map((l) => {
      const t = tenants.find((item) => item.id === l.tenantId);
      const p = properties.find((item) => item.id === l.propertyId);
      const u = units.find((item) => item.id === l.unitId);
      const o = owners.find((item) => item.id === l.ownerId);

      return {
        id: l.id,
        value: l.id,
        label: `${l.leaseNumber} — ${t ? (isRtl ? t.nameAr : t.nameEn) : ""}`,
        subLabel: `${p ? (isRtl ? p.nameAr : p.nameEn) : ""} | الوحدة: ${u?.unitNumber || ""} | المالك: ${o ? (isRtl ? o.nameAr : o.nameEn) : ""}`,
        badge: l.contractStatus,
      };
    });
  }, [leases, tenants, properties, units, owners, isRtl]);

  return (
    <div className="min-h-screen bg-slate-50/80 pb-16">
      {/* Top Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="w-full px-3 sm:px-5 lg:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CloseBackButton onClose={onBack} />
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-700 text-white flex items-center justify-center shadow-xs">
                <RotateCw className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  {isRtl ? "تجديد عقد الإيجار (صفحة متكاملة)" : "Lease Renewal Full Page"}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeLease
                    ? `${activeLease.leaseNumber} • ${selectedTenant ? (isRtl ? selectedTenant.nameAr : selectedTenant.nameEn) : ""}`
                    : isRtl
                    ? "اختر العقد المراد تجديده واستيراد بياناته"
                    : "Select contract to renew"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer"
              >
                {t("cancel")}
              </button>
            )}
            <button
              type="button"
              onClick={handleOpenConfirmModal}
              disabled={!canCreateRenewal || isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {directApprove && canDirectApprove
                  ? isRtl
                    ? "اعتماد وتفعيل العقد مباشرة"
                    : "Direct Approve & Activate"
                  : isRtl
                  ? "إرسال طلب التجديد للاعتماد"
                  : "Submit for Approval"}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="w-full px-3 sm:px-5 lg:px-6 mt-6 space-y-6">
        {/* Security / Permission Banner */}
        {!canCreateRenewal ? (
          <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-bold">
            <Lock className="w-5 h-5 shrink-0 text-rose-600" />
            <span>
              {isRtl
                ? "تنبيه الصلاحيات: ليس لديك صلاحية تجديد العقود. هذا الإجراء مقتصر على الإدارة والمالية."
                : "Security Notice: You do not have permission to renew tenancy contracts."}
            </span>
          </div>
        ) : isExecutiveAdmin ? (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-emerald-900 text-xs">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                {isRtl
                  ? "أنت مسجل بصلاحية إدارة عليا (Super Admin / Manager) — يمكنك تفعيل العقد المجدد وتوليد الدفعات فوراً."
                  : "You are logged in with Executive Management rights — Direct approval & activation enabled."}
              </span>
            </div>
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-lg uppercase">
              {currentUser?.role}
            </span>
          </div>
        ) : null}

        {/* Global Messages */}
        {errorMsg && (
          <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-bold">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
            <span className="flex-1">{errorMsg}</span>
            <button
              onClick={() => setErrorMsg("")}
              className="text-rose-500 hover:text-rose-800 text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-bold">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            <span className="flex-1">{successMsg}</span>
          </div>
        )}

        {/* Section 1: Active Contract Selector & Context Summary Cards */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-700" />
                <span>{isRtl ? "بيانات العقد الحالي المستوردة" : "Imported Lease Contract Details"}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isRtl
                  ? "يتم جلب بيانات المالك، المستأجر، العقار، والوحدة تلقائياً من قاعدة البيانات"
                  : "Owner, Tenant, Property, and Unit details are imported automatically"}
              </p>
            </div>

            <div className="w-full sm:w-80">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                {isRtl ? "تبديل / اختيار عقد آخر" : "Switch / Select Lease"}
              </label>
              <SearchableSelect
                options={leaseOptions}
                value={selectedLeaseId}
                onChange={(val) => setSelectedLeaseId(val)}
                placeholder={isRtl ? "ابحث برقم العقد أو المستأجر..." : "Search lease..."}
              />
            </div>
          </div>

          {/* 4 Multi-Context Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Contract Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-700" />
                  {isRtl ? "العقد الحالي" : "Current Lease"}
                </span>
                <Badge variant={activeLease?.contractStatus === "ACTIVE" ? "success" : "neutral"}>
                  {activeLease?.contractStatus || "N/A"}
                </Badge>
              </div>
              <div className="text-xs font-black text-slate-900 font-mono">
                {activeLease?.leaseNumber || "—"}
              </div>
              <div className="text-[11px] text-slate-600 space-y-0.5">
                <div>{isRtl ? "الفترة:" : "Period:"} {activeLease?.startDate} إلى {activeLease?.endDate}</div>
                <div className="font-bold text-slate-800">
                  {isRtl ? "الإيجار السابق:" : "Prev Rent:"}{" "}
                  <span className="font-mono text-amber-900">
                    {(activeLease?.annualRent || 0).toLocaleString()} AED
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Tenant Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  {isRtl ? "المستأجر" : "Tenant"}
                </span>
                {selectedTenant?.riskLevel && (
                  <Badge
                    variant={
                      selectedTenant.riskLevel === "HIGH"
                        ? "danger"
                        : selectedTenant.riskLevel === "MEDIUM"
                        ? "warning"
                        : "success"
                    }
                  >
                    {isRtl
                      ? `مخاطر ${selectedTenant.riskLevel}`
                      : `${selectedTenant.riskLevel} Risk`}
                  </Badge>
                )}
              </div>
              <div className="text-xs font-black text-slate-900 truncate">
                {selectedTenant ? (isRtl ? selectedTenant.nameAr : selectedTenant.nameEn) : "—"}
              </div>
              <div className="text-[11px] text-slate-600 space-y-0.5">
                <div>{isRtl ? "الهاتف:" : "Phone:"} {selectedTenant?.phone || "—"}</div>
                <div>{isRtl ? "الهوية/الجواز:" : "ID/Passport:"} {selectedTenant?.emiratesId || selectedTenant?.passportNumber || "—"}</div>
              </div>
            </div>

            {/* Card 3: Property & Unit Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-indigo-600" />
                  {isRtl ? "العقار والوحدة" : "Property & Unit"}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md">
                  {selectedUnit?.type || "Unit"}
                </span>
              </div>
              <div className="text-xs font-black text-slate-900 truncate">
                {selectedProperty ? (isRtl ? selectedProperty.nameAr : selectedProperty.nameEn) : "—"}
              </div>
              <div className="text-[11px] text-slate-600 space-y-0.5">
                <div>{isRtl ? "الوحدة:" : "Unit #:"} <span className="font-bold text-slate-900">{selectedUnit?.unitNumber || "—"}</span> ({selectedProperty?.emirate || "الإمارات"})</div>
                <div>{isRtl ? "المساحة:" : "Area:"} {selectedUnit?.areaSqFt ? `${selectedUnit.areaSqFt} sqft` : "—"}</div>
              </div>
            </div>

            {/* Card 4: Owner Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  {isRtl ? "المالك" : "Owner"}
                </span>
                <span className="text-[10px] font-mono text-slate-500">{selectedOwner?.code || ""}</span>
              </div>
              <div className="text-xs font-black text-slate-900 truncate">
                {selectedOwner ? (isRtl ? selectedOwner.nameAr : selectedOwner.nameEn) : "—"}
              </div>
              <div className="text-[11px] text-slate-600 space-y-0.5">
                <div>{isRtl ? "الهاتف:" : "Phone:"} {selectedOwner?.phone || "—"}</div>
                <div>{isRtl ? "الحساب البنكي:" : "Bank:"} {selectedOwner?.bankName || "—"}</div>
              </div>
            </div>
          </div>

          {/* High Risk Tenant Warning Banner */}
          {isHighRiskTenant && (
            <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl space-y-2.5 animate-pulse">
              <div className="flex items-center gap-2 text-rose-900 font-black text-xs">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                <span>
                  {isRtl
                    ? "تحذير رقابي حرج: المستأجر مصنف عالي أو متوسط المخاطر!"
                    : "CRITICAL COMPLIANCE WARNING: Tenant is High/Medium Risk!"}
                </span>
              </div>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                {isRtl
                  ? `المستأجر لديه سجل شيكات مرتجعة (${selectedTenant?.bouncedChequesCount || 0} شيك) أو قضايا نزاع إيجاري نشطة (درجة المخاطر: ${selectedTenant?.riskScore || 0}/100). يتطلب النظام إدخال سبب التجاوز والموافقة الإدارية لتسجيلها في سجل التدقيق المالي والإداري.`
                  : `Tenant has bounced cheques or active rental disputes (Risk Score: ${selectedTenant?.riskScore || 0}/100). Mandatory executive override justification is required.`}
              </p>
            </div>
          )}
        </div>

        <form onSubmit={handleOpenConfirmModal} className="space-y-6">
          {/* Section 2: Duration & Dates Configuration */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-700" />
                <span>{isRtl ? "مدة وفترة العقد المجدد" : "Renewal Term & Dates"}</span>
              </h2>
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                {(["1_YEAR", "2_YEARS", "3_YEARS", "CUSTOM"] as RenewalDurationOption[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleDurationPresetChange(preset)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      durationPreset === preset
                        ? "bg-white text-amber-800 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {preset === "1_YEAR"
                      ? isRtl ? "سنة كاملة (+1)" : "1 Year"
                      : preset === "2_YEARS"
                      ? isRtl ? "سنتان (+2)" : "2 Years"
                      : preset === "3_YEARS"
                      ? isRtl ? "3 سنوات" : "3 Years"
                      : isRtl ? "مخصص" : "Custom"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {isRtl ? "تاريخ بداية العقد الجديد" : "New Start Date"} *
                </label>
                <input
                  type="date"
                  required
                  value={newStartDate}
                  onChange={(e) => {
                    setNewStartDate(e.target.value);
                    if (durationPreset !== "CUSTOM") {
                      const s = new Date(e.target.value);
                      if (!isNaN(s.getTime())) {
                        const years = durationPreset === "1_YEAR" ? 1 : durationPreset === "2_YEARS" ? 2 : 3;
                        const endObj = new Date(s);
                        endObj.setFullYear(endObj.getFullYear() + years);
                        endObj.setDate(endObj.getDate() - 1);
                        setNewEndDate(endObj.toISOString().split("T")[0]);
                      }
                    }
                  }}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-700 font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {isRtl ? "تم ضبطه تلقائياً لليوم التالي لانتهاء العقد السابق" : "Auto-set to day after old contract end"}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {isRtl ? "تاريخ انتهاء العقد الجديد" : "New End Date"} *
                </label>
                <input
                  type="date"
                  required
                  value={newEndDate}
                  onChange={(e) => {
                    setNewEndDate(e.target.value);
                    setDurationPreset("CUSTOM");
                  }}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-700 font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {isRtl ? "تاريخ انتهاء العقد بعد التجديد" : "End date of renewed lease"}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Financial Valuation & Rent Adjustment Engine */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-700" />
                <span>{isRtl ? "القيمة الإيجارية والزيادات السنوية" : "Annual Rent & Increment Calculator"}</span>
              </h2>
              <div className="text-xs text-slate-500 font-semibold">
                {isRtl ? "الإيجار السابق:" : "Previous Rent:"}{" "}
                <span className="font-mono font-bold text-slate-800">
                  {(activeLease?.annualRent || 0).toLocaleString()} AED
                </span>
              </div>
            </div>

            {/* Rent Adjustment Strategy Controls */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                {isRtl ? "طريقة تعديل الإيجار السنوي" : "Rent Adjustment Method"}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => applyRentIncrease("NONE", 0)}
                  className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                    rentIncreaseType === "NONE"
                      ? "bg-amber-50/80 border-amber-500 text-amber-900 shadow-2xs"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div>{isRtl ? "تجديد بنفس القيمة" : "Same Rent"}</div>
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">(0% زيادة)</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyRentIncrease("PERCENT", 5)}
                  className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                    rentIncreaseType === "PERCENT"
                      ? "bg-amber-50/80 border-amber-500 text-amber-900 shadow-2xs"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div>{isRtl ? "زيادة بالنسبة المئوية (%)" : "Percentage (%)"}</div>
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">{isRtl ? "حسب مؤشر ريرا/السوق" : "Market/RERA Index"}</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyRentIncrease("AMOUNT", 5000)}
                  className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                    rentIncreaseType === "AMOUNT"
                      ? "bg-amber-50/80 border-amber-500 text-amber-900 shadow-2xs"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div>{isRtl ? "زيادة بمبلغ مقطوع (درهم)" : "Fixed Amount (AED)"}</div>
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">{isRtl ? "إضافة مبلغ محدد" : "Add fixed sum"}</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyRentIncrease("CUSTOM", newAnnualRent)}
                  className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                    rentIncreaseType === "CUSTOM"
                      ? "bg-amber-50/80 border-amber-500 text-amber-900 shadow-2xs"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div>{isRtl ? "تحديد يدوي مباشر" : "Direct Manual Rent"}</div>
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">{isRtl ? "إدخال القيمة الإجمالية" : "Custom input"}</div>
                </button>
              </div>

              {/* Sub-controls for percentage or amount */}
              {rentIncreaseType === "PERCENT" && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-wrap items-center gap-3">
                  <span className="text-xs font-bold text-slate-700">{isRtl ? "اختر النسبة:" : "Select %:"}</span>
                  {[5, 7, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => applyRentIncrease("PERCENT", pct)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                        rentIncreaseValue === pct
                          ? "bg-amber-700 text-white border-amber-700 shadow-2xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      +{pct}%
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 ms-auto">
                    <span className="text-xs text-slate-500">{isRtl ? "أو نسبة أخرى:" : "or custom %:"}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={rentIncreaseValue}
                      onChange={(e) => applyRentIncrease("PERCENT", parseFloat(e.target.value) || 0)}
                      className="w-20 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg font-mono font-bold text-center"
                    />
                    <span className="text-xs font-bold text-slate-700">%</span>
                  </div>
                </div>
              )}

              {rentIncreaseType === "AMOUNT" && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-wrap items-center gap-3">
                  <span className="text-xs font-bold text-slate-700">{isRtl ? "اختر المبلغ:" : "Select AED:"}</span>
                  {[2000, 5000, 10000, 15000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => applyRentIncrease("AMOUNT", amt)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                        rentIncreaseValue === amt
                          ? "bg-amber-700 text-white border-amber-700 shadow-2xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      +{amt.toLocaleString()} AED
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 ms-auto">
                    <span className="text-xs text-slate-500">{isRtl ? "أو مبلغ آخر:" : "or amount:"}</span>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={rentIncreaseValue}
                      onChange={(e) => applyRentIncrease("AMOUNT", parseFloat(e.target.value) || 0)}
                      className="w-28 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg font-mono font-bold text-center"
                    />
                    <span className="text-xs font-bold text-slate-700">AED</span>
                  </div>
                </div>
              )}
            </div>

            {/* Rent Comparison Display & Direct Input */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {isRtl ? "الإيجار السنوي المجدد (درهم)" : "Renewed Annual Rent (AED)"} *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1000}
                    required
                    value={newAnnualRent}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setNewAnnualRent(val);
                      setRentIncreaseType("CUSTOM");
                      generateInstallmentsSchedule(val, installmentsCount, newStartDate);
                    }}
                    className="w-full px-3.5 py-2.5 text-base sm:text-lg bg-slate-800 border border-slate-700 rounded-xl focus:border-amber-400 font-mono font-black text-amber-300"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-slate-400 font-bold">{isRtl ? "الفارق والمقارنة" : "Difference & Variance"}</div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-sm font-black ${
                      rentDifference > 0
                        ? "text-emerald-400"
                        : rentDifference < 0
                        ? "text-rose-400"
                        : "text-slate-300"
                    }`}
                  >
                    {rentDifference > 0 ? "+" : ""}
                    {rentDifference.toLocaleString()} AED
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-md font-bold font-mono ${
                      rentDifference > 0
                        ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                        : rentDifference < 0
                        ? "bg-rose-950/80 text-rose-300 border border-rose-800"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {rentDifference > 0 ? "+" : ""}
                    {rentPercentageDiff}%
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {isRtl ? "سبب الزيادة / مبرر التعديل" : "Increase Justification"}
                </label>
                <input
                  type="text"
                  value={increaseReason}
                  onChange={(e) => setIncreaseReason(e.target.value)}
                  placeholder={isRtl ? "مثال: تحديث حسب مؤشر ريرا..." : "e.g. RERA Index update..."}
                  className="w-full px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500"
                />
              </div>
            </div>

            {/* Deposit & Ejari */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {isRtl ? "مبلغ التأمين (درهم)" : "Security Deposit (AED)"}
                </label>
                <input
                  type="number"
                  min={0}
                  value={securityDeposit}
                  onChange={(e) => setSecurityDeposit(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {isRtl ? "رقم شهادة التوثيق / إيجاري" : "Ejari / Attestation Certificate #"}
                </label>
                <input
                  type="text"
                  value={ejariNumber}
                  onChange={(e) => setEjariNumber(e.target.value)}
                  placeholder="e.g., EJR-2026-987654"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 3.5: Administrative Fees / Office Commission */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center gap-3 bg-amber-50/50 p-3 rounded-2xl border border-amber-200 mb-2 transition-all hover:bg-amber-50">
              <input
                type="checkbox"
                id="include-admin-fees-checkbox"
                checked={includeAdminFees}
                onChange={(e) => setIncludeAdminFees(e.target.checked)}
                className="w-5 h-5 rounded-md border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <label htmlFor="include-admin-fees-checkbox" className="text-sm font-black text-amber-900 cursor-pointer select-none">
                {isRtl ? "إدراج الرسوم الإدارية / عمولة المكتب لهذا العقد (اختياري)" : "Include Administrative Fees / Office Commission (Optional)"}
              </label>
            </div>

            {includeAdminFees && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                {/* TENANT FEE CARD */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4 hover:border-amber-300 transition-colors">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="tenant-fee-enabled"
                        checked={tenantFeeEnabled}
                        onChange={(e) => setTenantFeeEnabled(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <label htmlFor="tenant-fee-enabled" className="text-sm font-bold text-slate-800 cursor-pointer">
                        {isRtl ? "تحصيل الرسوم من المستأجر" : "Collect fees from Tenant"}
                      </label>
                    </div>
                  </div>

                  {tenantFeeEnabled && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">{isRtl ? "طريقة الاحتساب" : "Calculation Method"}</label>
                        <select
                          value={tenantFeeBasis}
                          onChange={(e) => setTenantFeeBasis(e.target.value as any)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white outline-none"
                        >
                          <option value="PERCENTAGE_OF_RENT">{isRtl ? "نسبة مئوية من الإيجار (%)" : "Percentage of Rent (%)"}</option>
                          <option value="FIXED_AMOUNT">{isRtl ? "مبلغ ثابت (درهم)" : "Fixed Amount (AED)"}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">
                          {tenantFeeBasis === "PERCENTAGE_OF_RENT" ? (isRtl ? "النسبة المئوية (%)" : "Percentage (%)") : (isRtl ? "المبلغ الثابت" : "Fixed Amount")}
                        </label>
                        <input
                          type="number"
                          value={tenantFeeBasis === "PERCENTAGE_OF_RENT" ? tenantFeeRate : tenantFeeFixed}
                          onChange={(e) => {
                            if (tenantFeeBasis === "PERCENTAGE_OF_RENT") setTenantFeeRate(e.target.value === "" ? "" : parseFloat(e.target.value));
                            else setTenantFeeFixed(e.target.value === "" ? "" : parseFloat(e.target.value));
                          }}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:bg-white outline-none text-right rtl:text-left"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">{isRtl ? "تاريخ الاستحقاق" : "Due Date"}</label>
                        <input
                          type="date"
                          value={tenantFeeDueDate}
                          onChange={(e) => setTenantFeeDueDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
                        />
                      </div>

                      {/* Calculation Summary Box */}
                      {(() => {
                        const total = tenantFeeBasis === "PERCENTAGE_OF_RENT"
                          ? Math.round((Number(newAnnualRent || 0) * Number(tenantFeeRate || 0)) / 100)
                          : Number(tenantFeeFixed || 0);
                        
                        // Use centralized engine for summary
                        const summary = calculateCommissionAmount(
                          tenantFeeBasis === "PERCENTAGE_OF_RENT" ? Number(newAnnualRent || 0) : total * 100 / (Number(tenantFeeRate) || 5),
                          "TENANT",
                          tenantFeeBasis === "PERCENTAGE_OF_RENT" ? Number(tenantFeeRate) : (total / (Number(newAnnualRent) || 1) * 100),
                          DEFAULT_COMMISSION_SETTINGS,
                          "ADMIN_FEE"
                        );

                        const finalTotal = total;
                        const finalVat = tenantFeeBasis === "FIXED_AMOUNT" 
                          ? Math.round((total * summary.vatRate / (100 + summary.vatRate)) * 100) / 100
                          : summary.vatAmount;
                        const finalNet = Math.round((finalTotal - finalVat) * 100) / 100;

                        return (
                          <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-3 space-y-1.5">
                            <div className="flex justify-between text-[11px] font-bold text-slate-600">
                              <span>{isRtl ? "إجمالي الرسوم المحتسبة:" : "Total Calculated Fees:"}</span>
                              <span className="font-mono text-emerald-900">AED {finalTotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-[11px] font-bold text-amber-700">
                              <span>{isRtl ? `الضريبة المستقطعة (${summary.vatRate}%):` : `Deducted Tax (${summary.vatRate}%):`}</span>
                              <span className="font-mono text-amber-900">AED {finalVat.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-[11px] font-bold text-emerald-800 border-t border-emerald-100/50 pt-1.5">
                              <span>{isRtl ? "المبلغ الخاضع للضريبة:" : "Taxable Amount:"}</span>
                              <span className="font-mono text-emerald-900">AED {finalNet.toLocaleString()}</span>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="checkbox"
                          id="tenant-immediate-collection"
                          checked={tenantFeeImmediateCollection}
                          onChange={(e) => setTenantFeeImmediateCollection(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <label htmlFor="tenant-immediate-collection" className="text-[11px] font-bold text-slate-700 cursor-pointer">
                          {isRtl ? "تحصيل الرسوم فوراً عند إصدار العقد" : "Collect fees immediately on issuance"}
                        </label>
                      </div>

                      {/* EXEMPTION SECTION (Phase 5.3) */}
                      <div className="pt-2 border-t border-slate-100 mt-2">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className={`w-4 h-4 ${tenantAdminFeeExempt ? 'text-amber-600' : 'text-slate-400'}`} />
                            <span className="text-xs font-bold text-slate-700">{isRtl ? "إعفاء من الرسوم" : "Fee Exemption"}</span>
                          </div>
                          <div 
                            onClick={() => setTenantAdminFeeExempt(!tenantAdminFeeExempt)}
                            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors duration-200 ${tenantAdminFeeExempt ? 'bg-amber-500' : 'bg-slate-200'}`}
                          >
                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-200 ${tenantAdminFeeExempt ? 'left-6' : 'left-1'}`} />
                          </div>
                        </div>

                        {tenantAdminFeeExempt && (
                          <div className="space-y-3 bg-amber-50/50 p-3 rounded-xl border border-amber-100 animate-in fade-in zoom-in-95 duration-200">
                            <div>
                              <label className="block text-[10px] font-black text-amber-800 mb-1 uppercase tracking-wider">{isRtl ? "سبب الإعفاء (إلزامي)" : "Exemption Reason (Required)"}</label>
                              <select
                                value={tenantAdminFeeExemptionReason}
                                onChange={(e) => setTenantAdminFeeExemptReason(e.target.value as any)}
                                className="w-full px-2 py-1.5 text-[11px] bg-white border border-amber-200 rounded-lg font-bold focus:ring-1 focus:ring-amber-500 outline-none"
                              >
                                <option value="MANAGEMENT_DECISION">{isRtl ? "قرار إداري" : "Management Decision"}</option>
                                <option value="SPECIAL_CONTRACT_AGREEMENT">{isRtl ? "اتفاقية عقد خاصة" : "Special Contract Agreement"}</option>
                                <option value="PROMOTIONAL_EXEMPTION">{isRtl ? "إعفاء ترويجي" : "Promotional Exemption"}</option>
                                <option value="RENEWAL_INCENTIVE">{isRtl ? "حافز تجديد" : "Renewal Incentive"}</option>
                                <option value="OTHER">{isRtl ? "أسباب أخرى" : "Other Reasons"}</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-amber-800 mb-1 uppercase tracking-wider">{isRtl ? "ملاحظات الإعفاء" : "Exemption Notes"}</label>
                              <textarea
                                value={tenantAdminFeeExemptionNote}
                                onChange={(e) => setTenantAdminFeeExemptNote(e.target.value)}
                                rows={2}
                                className="w-full px-2 py-1.5 text-[11px] bg-white border border-amber-200 rounded-lg font-bold focus:ring-1 focus:ring-amber-500 outline-none resize-none"
                                placeholder={isRtl ? "اكتب تفاصيل الإعفاء هنا..." : "Enter exemption details..."}
                              />
                            </div>
                            
                            {/* Approval Toggle (Only for Authorized Users) */}
                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="checkbox"
                                id="tenant-exemption-approved"
                                disabled={!canApproveExemption}
                                checked={tenantAdminFeeApproved}
                                onChange={(e) => setTenantAdminFeeApproved(e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <label htmlFor="tenant-exemption-approved" className={`text-[10px] font-black cursor-pointer ${tenantAdminFeeApproved ? 'text-emerald-700' : 'text-amber-800'}`}>
                                {isRtl ? "اعتماد الإعفاء (صلاحية إدارية)" : "Approve Exemption (Manager Permission)"}
                              </label>
                            </div>
                            {!tenantAdminFeeApproved && (
                              <p className="text-[9px] font-bold text-amber-600 italic">
                                {isRtl ? "* لن يتم تطبيق الإعفاء حتى يتم اعتماده إدارياً." : "* Exemption won't apply until manager approval."}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* OWNER FEE CARD */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4 hover:border-amber-300 transition-colors">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="owner-fee-enabled"
                        checked={ownerFeeEnabled}
                        onChange={(e) => setOwnerFeeEnabled(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <label htmlFor="owner-fee-enabled" className="text-sm font-bold text-slate-800 cursor-pointer">
                        {isRtl ? "تحصيل الرسوم من المالك" : "Collect fees from Owner"}
                      </label>
                    </div>
                  </div>

                  {ownerFeeEnabled && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">{isRtl ? "طريقة الاحتساب" : "Calculation Method"}</label>
                        <select
                          value={ownerFeeBasis}
                          onChange={(e) => setOwnerFeeBasis(e.target.value as any)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white outline-none"
                        >
                          <option value="PERCENTAGE_OF_RENT">{isRtl ? "نسبة مئوية من الإيجار (%)" : "Percentage of Rent (%)"}</option>
                          <option value="FIXED_AMOUNT">{isRtl ? "مبلغ ثابت (درهم)" : "Fixed Amount (AED)"}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">
                          {ownerFeeBasis === "PERCENTAGE_OF_RENT" ? (isRtl ? "النسبة المئوية (%)" : "Percentage (%)") : (isRtl ? "المبلغ الثابت" : "Fixed Amount")}
                        </label>
                        <input
                          type="number"
                          value={ownerFeeBasis === "PERCENTAGE_OF_RENT" ? ownerFeeRate : ownerFeeFixed}
                          onChange={(e) => {
                            if (ownerFeeBasis === "PERCENTAGE_OF_RENT") setOwnerFeeRate(e.target.value === "" ? "" : parseFloat(e.target.value));
                            else setOwnerFeeFixed(e.target.value === "" ? "" : parseFloat(e.target.value));
                          }}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:bg-white outline-none text-right rtl:text-left"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">{isRtl ? "تاريخ الاستحقاق" : "Due Date"}</label>
                        <input
                          type="date"
                          value={ownerFeeDueDate}
                          onChange={(e) => setOwnerFeeDueDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
                        />
                      </div>

                      {/* Calculation Summary Box */}
                      {(() => {
                        const total = ownerFeeBasis === "PERCENTAGE_OF_RENT"
                          ? Math.round((Number(newAnnualRent || 0) * Number(ownerFeeRate || 0)) / 100)
                          : Number(ownerFeeFixed || 0);
                        
                        // Use centralized engine for summary
                        const summary = calculateCommissionAmount(
                          ownerFeeBasis === "PERCENTAGE_OF_RENT" ? Number(newAnnualRent || 0) : total * 100 / (Number(ownerFeeRate) || 5),
                          "OWNER",
                          ownerFeeBasis === "PERCENTAGE_OF_RENT" ? Number(ownerFeeRate) : (total / (Number(newAnnualRent) || 1) * 100),
                          DEFAULT_COMMISSION_SETTINGS,
                          "ADMIN_FEE"
                        );

                        const finalTotal = total;
                        const finalVat = ownerFeeBasis === "FIXED_AMOUNT" 
                          ? Math.round((total * summary.vatRate / (100 + summary.vatRate)) * 100) / 100
                          : summary.vatAmount;
                        const finalNet = Math.round((finalTotal - finalVat) * 100) / 100;

                        return (
                          <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-3 space-y-1.5">
                            <div className="flex justify-between text-[11px] font-bold text-slate-600">
                              <span>{isRtl ? "إجمالي الرسوم المحتسبة:" : "Total Calculated Fees:"}</span>
                              <span className="font-mono text-emerald-900">AED {finalTotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-[11px] font-bold text-amber-700">
                              <span>{isRtl ? `الضريبة المستقطعة (${summary.vatRate}%):` : `Deducted Tax (${summary.vatRate}%):`}</span>
                              <span className="font-mono text-amber-900">AED {finalVat.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-[11px] font-bold text-emerald-800 border-t border-emerald-100/50 pt-1.5">
                              <span>{isRtl ? "المبلغ الخاضع للضريبة:" : "Taxable Amount:"}</span>
                              <span className="font-mono text-emerald-900">AED {finalNet.toLocaleString()}</span>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="checkbox"
                          id="owner-immediate-collection"
                          checked={ownerFeeImmediateCollection}
                          onChange={(e) => setOwnerFeeImmediateCollection(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <label htmlFor="owner-immediate-collection" className="text-[11px] font-bold text-slate-700 cursor-pointer">
                          {isRtl ? "تحصيل الرسوم فوراً عند إصدار العقد" : "Collect fees immediately on issuance"}
                        </label>
                      </div>

                      {/* EXEMPTION SECTION (Phase 5.3) */}
                      <div className="pt-2 border-t border-slate-100 mt-2">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className={`w-4 h-4 ${ownerAdminFeeExempt ? 'text-amber-600' : 'text-slate-400'}`} />
                            <span className="text-xs font-bold text-slate-700">{isRtl ? "إعفاء من الرسوم" : "Fee Exemption"}</span>
                          </div>
                          <div 
                            onClick={() => setOwnerAdminFeeExempt(!ownerAdminFeeExempt)}
                            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors duration-200 ${ownerAdminFeeExempt ? 'bg-amber-500' : 'bg-slate-200'}`}
                          >
                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-200 ${ownerAdminFeeExempt ? 'left-6' : 'left-1'}`} />
                          </div>
                        </div>

                        {ownerAdminFeeExempt && (
                          <div className="space-y-3 bg-amber-50/50 p-3 rounded-xl border border-amber-100 animate-in fade-in zoom-in-95 duration-200">
                            <div>
                              <label className="block text-[10px] font-black text-amber-800 mb-1 uppercase tracking-wider">{isRtl ? "سبب الإعفاء (إلزامي)" : "Exemption Reason (Required)"}</label>
                              <select
                                value={ownerAdminFeeExemptionReason}
                                onChange={(e) => setOwnerAdminFeeExemptReason(e.target.value as any)}
                                className="w-full px-2 py-1.5 text-[11px] bg-white border border-amber-200 rounded-lg font-bold focus:ring-1 focus:ring-amber-500 outline-none"
                              >
                                <option value="MANAGEMENT_DECISION">{isRtl ? "قرار إداري" : "Management Decision"}</option>
                                <option value="SPECIAL_CONTRACT_AGREEMENT">{isRtl ? "اتفاقية عقد خاصة" : "Special Contract Agreement"}</option>
                                <option value="PROMOTIONAL_EXEMPTION">{isRtl ? "إعفاء ترويجي" : "Promotional Exemption"}</option>
                                <option value="RENEWAL_INCENTIVE">{isRtl ? "حافز تجديد" : "Renewal Incentive"}</option>
                                <option value="OTHER">{isRtl ? "أسباب أخرى" : "Other Reasons"}</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-amber-800 mb-1 uppercase tracking-wider">{isRtl ? "ملاحظات الإعفاء" : "Exemption Notes"}</label>
                              <textarea
                                value={ownerAdminFeeExemptionNote}
                                onChange={(e) => setOwnerAdminFeeExemptNote(e.target.value)}
                                rows={2}
                                className="w-full px-2 py-1.5 text-[11px] bg-white border border-amber-200 rounded-lg font-bold focus:ring-1 focus:ring-amber-500 outline-none resize-none"
                                placeholder={isRtl ? "اكتب تفاصيل الإعفاء هنا..." : "Enter exemption details..."}
                              />
                            </div>
                            
                            {/* Approval Toggle (Only for Authorized Users) */}
                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="checkbox"
                                id="owner-exemption-approved"
                                disabled={!canApproveExemption}
                                checked={ownerAdminFeeApproved}
                                onChange={(e) => setOwnerAdminFeeApproved(e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <label htmlFor="owner-exemption-approved" className={`text-[10px] font-black cursor-pointer ${ownerAdminFeeApproved ? 'text-emerald-700' : 'text-amber-800'}`}>
                                {isRtl ? "اعتماد الإعفاء (صلاحية إدارية)" : "Approve Exemption (Manager Permission)"}
                              </label>
                            </div>
                            {!ownerAdminFeeApproved && (
                              <p className="text-[9px] font-bold text-amber-600 italic">
                                {isRtl ? "* لن يتم تطبيق الإعفاء حتى يتم اعتماده إدارياً." : "* Exemption won't apply until manager approval."}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Smart Payment Schedule & Installments Manager */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-700" />
                  <span>{isRtl ? "جدول الدفعات وطرق السداد" : "Payment Schedule & Installments"}</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isRtl
                    ? "يدعم الشيكات البنكية، التحويلات، والدفعات المؤجلة (Deferred) مع تاريخ استحقاق إلزامي"
                    : "Supports Cheques, Transfers, and Deferred Payments with mandatory due date"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">{isRtl ? "عدد الدفعات:" : "Cheques:"}</span>
                {[1, 2, 4, 6, 12].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => handleInstallmentsCountChange(cnt)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-colors cursor-pointer border ${
                      installmentsCount === cnt
                        ? "bg-amber-700 text-white border-amber-700 shadow-2xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={addCustomInstallmentRow}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1 border border-slate-200 cursor-pointer"
                  title={isRtl ? "إضافة دفعة إضافية" : "Add custom installment"}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isRtl ? "دفعة +" : "+ Row"}</span>
                </button>
              </div>
            </div>

            {/* Schedule Items List */}
            <div className="space-y-3">
              {schedule.map((item, idx) => {
                const isExpanded = expandedItemIndex === idx;
                const isDeferred = item.paymentMethod === "DEFERRED";
                const isCheque = item.paymentMethod === "CHEQUE";

                return (
                  <div
                    key={item.id || idx}
                    className={`rounded-xl border transition-all ${
                      isDeferred
                        ? "bg-amber-50/40 border-amber-300"
                        : isExpanded
                        ? "bg-slate-50/70 border-slate-300 shadow-2xs"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    {/* Item Summary Row */}
                    <div className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center font-mono">
                          {item.installmentNumber}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                            <span>{isRtl ? `الدفعة ${item.installmentNumber}` : `Installment #${item.installmentNumber}`}</span>
                            {item.isAdvance && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                                {isRtl ? "دفعة مقدمة" : "Advance"}
                              </span>
                            )}
                            {isDeferred && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {isRtl ? "دفعة مؤجلة" : "Deferred"}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {isRtl ? "الاستحقاق:" : "Due:"} {item.dueDate}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 ms-auto">
                        {/* Amount */}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            required
                            value={item.amount}
                            onChange={(e) =>
                              updateScheduleItem(idx, {
                                amount: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-28 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-900 text-end"
                          />
                          <span className="text-[11px] font-bold text-slate-500">AED</span>
                        </div>

                        {/* Payment Method */}
                        <select
                          value={item.paymentMethod}
                          onChange={(e) =>
                            updateScheduleItem(idx, {
                              paymentMethod: e.target.value as PaymentMethod | "DEFERRED",
                            })
                          }
                          className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-semibold text-slate-800"
                        >
                          <option value="CHEQUE">{isRtl ? "شيك بنكي" : "Bank Cheque"}</option>
                          <option value="BANK_TRANSFER">{isRtl ? "تحويل بنكي" : "Bank Transfer"}</option>
                          <option value="CASH">{isRtl ? "نقداً" : "Cash"}</option>
                          <option value="CREDIT_CARD">{isRtl ? "بطاقة ائتمان" : "Credit Card"}</option>
                          <option value="DEFERRED">{isRtl ? "دفعة مؤجلة (Deferred)" : "Deferred Payment"}</option>
                        </select>

                        {/* Expand Details Toggle */}
                        <button
                          type="button"
                          onClick={() => setExpandedItemIndex(isExpanded ? null : idx)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>

                        {/* Remove Row */}
                        {schedule.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeInstallmentRow(idx)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title={isRtl ? "حذف الدفعة" : "Remove row"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Details Container */}
                    {isExpanded && (
                      <div className="p-4 border-t border-slate-200/80 bg-white rounded-b-xl space-y-3">
                        {/* If CHEQUE */}
                        {isCheque && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                  {isRtl ? "رقم الشيك" : "Cheque Number"} *
                                </label>
                                <input
                                  type="text"
                                  value={item.chequeDetails?.chequeNumber || ""}
                                  onChange={(e) =>
                                    updateScheduleItem(idx, {
                                      chequeDetails: {
                                        ...item.chequeDetails!,
                                        chequeNumber: e.target.value,
                                      },
                                    })
                                  }
                                  placeholder="000123"
                                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                  {isRtl ? "البنك المسحوب عليه" : "Bank Name"}
                                </label>
                                <select
                                  value={item.chequeDetails?.bankName || ""}
                                  onChange={(e) =>
                                    updateScheduleItem(idx, {
                                      chequeDetails: {
                                        ...item.chequeDetails!,
                                        bankName: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                                >
                                  {UAE_BANKS.map((b) => (
                                    <option key={b.id || b.nameEn} value={b.nameEn}>
                                      {isRtl ? b.nameAr : b.nameEn}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                  {isRtl ? "تاريخ استحقاق الشيك" : "Cheque Date"}
                                </label>
                                <input
                                  type="date"
                                  value={item.chequeDetails?.chequeDate || item.dueDate}
                                  onChange={(e) =>
                                    updateScheduleItem(idx, {
                                      dueDate: e.target.value,
                                      chequeDetails: {
                                        ...item.chequeDetails!,
                                        chequeDate: e.target.value,
                                        dueDate: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                  {isRtl ? "اسم الساحب" : "Drawer Name"}
                                </label>
                                <input
                                  type="text"
                                  value={item.chequeDetails?.drawerName || ""}
                                  onChange={(e) =>
                                    updateScheduleItem(idx, {
                                      chequeDetails: {
                                        ...item.chequeDetails!,
                                        drawerName: e.target.value,
                                      },
                                    })
                                  }
                                  placeholder={selectedTenant?.nameAr || "اسم المستأجر"}
                                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAiCaptureTargetId(item.id);
                                    setIsAiCaptureOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                                >
                                  <Search className="w-3.5 h-3.5" />
                                  <span>{isRtl ? "🤖 قراءة ذكية (AI)" : "🤖 Smart Read (AI)"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setScannerRowTargetId(item.id)}
                                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Scan className="w-3.5 h-3.5" />
                                  <span>{isRtl ? "📷 مسح" : "📷 Scan"}</span>
                                </button>
                                {item.chequeDetails?.imageBase64 && (
                                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    {isRtl ? "تم رفع الصورة والأرشيف" : "Image attached & archived"}
                                  </span>
                                )}
                              </div>
                              <span className="text-slate-400 font-mono text-[10px]">Status: PENDING</span>
                            </div>
                          </div>
                        )}

                        {/* If DEFERRED */}
                        {isDeferred && (
                          <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-300 space-y-3">
                            <div className="flex items-center gap-2 text-amber-900 font-black text-xs">
                              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                              <span>
                                {isRtl
                                  ? "تفاصيل تأجيل الدفعة والتحكم المالي (تاريخ الاستحقاق إلزامي)"
                                  : "Deferred Payment Financial Control (Due Date is Mandatory)"}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold text-amber-950 mb-1">
                                  {isRtl ? "تاريخ الاستحقاق المتوقع (إلزامي)" : "Expected Due Date (Mandatory)"} *
                                </label>
                                <input
                                  type="date"
                                  required
                                  value={item.deferredDetails?.expectedDueDate || ""}
                                  onChange={(e) =>
                                    updateScheduleItem(idx, {
                                      dueDate: e.target.value,
                                      deferredDetails: {
                                        ...item.deferredDetails!,
                                        expectedDueDate: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-2.5 py-1.5 text-xs bg-white border-2 border-amber-400 rounded-lg font-mono font-bold text-amber-950"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-amber-950 mb-1">
                                  {isRtl ? "سبب التأجيل" : "Deferral Reason"}
                                </label>
                                <input
                                  type="text"
                                  value={item.deferredDetails?.deferralReason || ""}
                                  onChange={(e) =>
                                    updateScheduleItem(idx, {
                                      deferredDetails: {
                                        ...item.deferredDetails!,
                                        deferralReason: e.target.value,
                                      },
                                    })
                                  }
                                  placeholder={isRtl ? "تأجيل حتى صدور الشيكات..." : "Reason..."}
                                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-amber-200 rounded-lg"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-amber-950 mb-1">
                                  {isRtl ? "المسؤول عن المتابعة" : "Responsible Person"}
                                </label>
                                <input
                                  type="text"
                                  value={item.deferredDetails?.responsiblePerson || ""}
                                  onChange={(e) =>
                                    updateScheduleItem(idx, {
                                      deferredDetails: {
                                        ...item.deferredDetails!,
                                        responsiblePerson: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-amber-200 rounded-lg"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Schedule Balance Validation Footer */}
            <div
              className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs font-bold ${
                isScheduleBalanced
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-rose-50 border-rose-300 text-rose-900"
              }`}
            >
              <div className="flex items-center gap-2">
                {isScheduleBalanced ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>
                  {isScheduleBalanced
                    ? isRtl
                      ? `مجموع الدفعات يطابق إجمالي قيمة العقد (${totalContractValue.toLocaleString()} درهم) لمدة ${durationYears} ${durationYears === 1 ? "سنة" : "سنوات"}`
                      : `Schedule matches total contract value (${totalContractValue.toLocaleString()} AED) for ${durationYears} year(s)`
                    : isRtl
                    ? `تنبيه: مجموع الدفعات (${scheduleTotal.toLocaleString()} درهم) لا يطابق إجمالي قيمة العقد (${totalContractValue.toLocaleString()} درهم) لمدة ${durationYears} ${durationYears === 1 ? "سنة" : "سنوات"}`
                    : `Warning: Installments (${scheduleTotal.toLocaleString()} AED) do not match total contract value (${totalContractValue.toLocaleString()} AED)`}
                </span>
              </div>
              <div className="font-mono flex items-center gap-2">
                <span>
                  {isRtl ? "المجموع الحالي:" : "Current Total:"}{" "}
                  <span className="font-black">{scheduleTotal.toLocaleString()} AED</span>
                </span>
                {durationYears > 1 && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                    {isRtl ? `السنوي: ${newAnnualRent.toLocaleString()} د.إ` : `Annual: ${newAnnualRent.toLocaleString()} AED`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section 5: High Risk Override & Administrative Notes */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
              <span>{isRtl ? "الموافقة الإدارية والتجاوز الرقابي" : "Executive Override & Administrative Notes"}</span>
            </h2>

            {isHighRiskTenant && (
              <div>
                <label className="block text-xs font-bold text-rose-900 mb-1.5">
                  {isRtl ? "سبب التجاوز والموافقة الإدارية (إلزامي)" : "Executive Override Justification (Mandatory)"} *
                </label>
                <textarea
                  required
                  rows={3}
                  value={riskOverrideReason}
                  onChange={(e) => setRiskOverrideReason(e.target.value)}
                  placeholder={
                    isRtl
                      ? "مثال: وافق المالك خطياً على استبدال الشيكات بدفعة نقدية مقدمة وضمان بنكي معتمد..."
                      : "e.g., Owner approved renewal based on cash advance and verified bank guarantee..."
                  }
                  className="w-full px-3.5 py-2.5 text-xs bg-rose-50/50 border-2 border-rose-300 rounded-xl focus:bg-white focus:border-rose-600 text-slate-900 placeholder-rose-400"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isRtl ? "ملاحظات إضافية على العقد المجدد" : "Additional Administrative Remarks"}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isRtl ? "أي شروط أو بنود خاصة بالتجديد..." : "Any special renewal terms..."}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-700 text-slate-800"
              />
            </div>

            {/* Document Attachments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700">
                  {isRtl ? "مستندات التجديد والأرشيف الإلكتروني" : "Attached Renewal Documents"}
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isRtl ? "رفع مستند / عقد" : "Upload File"}</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  multiple
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                />
              </div>

              {attachedFiles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attachedFiles.map((file, idx) => (
                    <div
                      key={`${file.id}-${idx}`}
                      className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 text-amber-700 shrink-0" />
                        <span className="truncate font-semibold text-slate-800">{file.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          ({(file.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachedFile(file.id)}
                        className="text-rose-500 hover:text-rose-700 p-1 rounded-md hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-400">
                  {isRtl
                    ? "لا توجد مستندات مرفقة حالياً. يمكنك إرفاق نسخة العقد الموقع أو صور الشيكات."
                    : "No attached documents yet. You can upload scanned contract or cheques."}
                </div>
              )}
            </div>

            {/* Workflow Toggles: Direct Approve & WhatsApp Alert */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              {canDirectApprove && (
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-800 select-none">
                  <input
                    type="checkbox"
                    checked={directApprove}
                    onChange={(e) => setDirectApprove(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-700 focus:ring-amber-600 border-slate-300"
                  />
                  <span>
                    {isRtl
                      ? "اعتماد وتفعيل العقد مباشرة وتحديث حالة الوحدة (بدون الحاجة لخطوة اعتماد إضافية)"
                      : "Directly Approve & Activate renewed lease immediately"}
                  </span>
                </label>
              )}

              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={sendWhatsAppAlert}
                  onChange={(e) => setSendWhatsAppAlert(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
                <span>
                  {isRtl
                    ? "إرسال إشعار فوري عبر الواتساب للمستأجر والمالك ببيانات التجديد"
                    : "Send automated WhatsApp notification to tenant and owner"}
                </span>
              </label>
            </div>
          </div>

          {/* Action Footer */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 cursor-pointer"
              >
                {t("cancel")}
              </button>
            )}

            <div className="flex items-center gap-3 ms-auto">
              <button
                type="submit"
                disabled={!canCreateRenewal || isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {directApprove && canDirectApprove
                    ? isRtl
                      ? "تأكيد واعتماد تجديد العقد"
                      : "Confirm & Activate Renewal"
                    : isRtl
                    ? "إرسال طلب التجديد للاعتماد"
                    : "Submit Renewal Request"}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Confirmation & Summary Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title={isRtl ? "مراجعة وتأكيد تجديد العقد" : "Review & Confirm Lease Renewal"}
        subtitle={activeLease?.leaseNumber || ""}
        icon={<RotateCw className="w-5 h-5 text-amber-700" />}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2.5">
            <div className="grid grid-cols-2 gap-2 text-slate-700">
              <div>
                <span className="text-slate-400 block">{isRtl ? "المستأجر:" : "Tenant:"}</span>
                <span className="font-bold text-slate-900">
                  {selectedTenant ? (isRtl ? selectedTenant.nameAr : selectedTenant.nameEn) : "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">{isRtl ? "العقار والوحدة:" : "Property & Unit:"}</span>
                <span className="font-bold text-slate-900">
                  {selectedProperty ? (isRtl ? selectedProperty.nameAr : selectedProperty.nameEn) : "—"} (الوحدة: {selectedUnit?.unitNumber || "—"})
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">{isRtl ? "الفترة المجددة:" : "Renewed Period:"}</span>
                <span className="font-bold font-mono text-slate-900">
                  {newStartDate} {isRtl ? "إلى" : "to"} {newEndDate}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">{isRtl ? "الإيجار السنوي الجديد:" : "New Annual Rent:"}</span>
                <span className="font-bold font-mono text-amber-900 text-sm">
                  {Number(newAnnualRent || 0).toLocaleString()} AED
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
              <div>
                {isRtl ? "عدد الدفعات:" : "Cheques/Installments:"}{" "}
                <span className="font-bold text-slate-800">{schedule.length}</span>
              </div>
              <div>
                {isRtl ? "حالة الاعتماد:" : "Approval Mode:"}{" "}
                <span className="font-bold text-amber-800">
                  {directApprove && canDirectApprove
                    ? isRtl
                      ? "اعتماد وتفعيل مباشر"
                      : "Direct Activation"
                    : isRtl
                    ? "طلب معلق للاعتماد"
                    : "Pending Approval"}
                </span>
              </div>
            </div>
          </div>

          {isHighRiskTenant && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold space-y-1">
              <div>{isRtl ? "تجاوز رقابي للمخاطر:" : "Risk Override Justification:"}</div>
              <div className="text-[11px] font-normal text-rose-700 bg-white/60 p-2 rounded-lg border border-rose-200">
                {riskOverrideReason}
              </div>
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsConfirmModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleExecuteRenewal}
              className="px-5 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>{isRtl ? "جاري الحفظ..." : "Processing..."}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isRtl ? "تأكيد وتنفيذ التجديد" : "Confirm & Execute"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

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
      <SmartDocumentCaptureModal
        isOpen={isAiCaptureOpen}
        onClose={() => setIsAiCaptureOpen(false)}
        documentType="CHEQUE"
        onApprove={handleAiCaptureApprove}
      />

      {/* OCR Warning Modal for Amount Discrepancies */}
      {ocrWarning && (
        <Modal
          isOpen={true}
          onClose={() => setOcrWarning(null)}
          title={isRtl ? "مقارنة ومطابقة مبلغ الشيك (المسح الذكي)" : "AI Cheque Amount Verification & Choice"}
          icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
        >
          <div className="space-y-4">
            <div className="p-4 bg-amber-50/90 border border-amber-300/80 rounded-2xl space-y-3.5 text-xs shadow-2xs">
              <div className="flex items-center gap-2 text-amber-950 font-bold">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>
                  {isRtl 
                    ? "تم اكتشاف اختلاف بين مبلغ الشيك المقروء بالذكاء الاصطناعي وقيمة القسط المسجلة بالجدول." 
                    : "A discrepancy was detected between the AI-scanned cheque amount and the installment amount."}
                </span>
              </div>

              <div className="bg-white/90 p-3.5 rounded-xl border border-amber-200/80 divide-y divide-slate-100 text-slate-800 space-y-2">
                <div className="flex items-center justify-between pb-2 text-xs">
                  <span className="text-slate-500 font-semibold">
                    {isRtl ? "قيمة القسط بالجدول (الأصلية):" : "Original Installment Amount:"}
                  </span>
                  <span className="font-mono font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                    {ocrWarning.currentAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 text-xs">
                  <span className="text-amber-800 font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    {isRtl ? "مبلغ الشيك المقروء بالمسح الذكي (AI):" : "AI Scanned Cheque Amount:"}
                  </span>
                  <span className="font-mono font-black text-amber-800 bg-amber-100/90 px-2.5 py-1 rounded-lg border border-amber-300">
                    {ocrWarning.extractedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} AED
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 text-xs">
                  <span className="text-rose-600 font-bold">
                    {isRtl ? "فرق المبلغ:" : "Difference:"}
                  </span>
                  <span className="font-mono font-black text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                    {Math.abs(ocrWarning.currentAmount - ocrWarning.extractedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} AED
                  </span>
                </div>
              </div>

              <p className="text-slate-600 text-[11px] leading-relaxed">
                {isRtl 
                  ? "يرجى اختيار ما إذا كنت ترغب باعتماد مبلغ الشيك المقروء وتحديث القسط، أم تفضل تجاهل المبلغ المقروء والإبقاء على قيمة القسط الأصلية." 
                  : "Please choose whether to adopt the scanned cheque amount and update the installment, or keep the original installment amount."}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={async () => {
                  const warning = ocrWarning;
                  setOcrWarning(null);
                  await applyChequeDataToScheduleRow(
                    warning.rowId,
                    warning.extractedAmount,
                    warning.extractedNum,
                    warning.extractedBank,
                    warning.extractedDate,
                    warning.extractedDrawer,
                    warning.base64,
                    warning.fileName
                  );
                }}
                className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-bold text-xs shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4 text-slate-950" />
                <span>
                  {isRtl 
                    ? `استخدام مبلغ الشيك (${ocrWarning.extractedAmount.toLocaleString()} درهم)` 
                    : `Use Scanned Amount (${ocrWarning.extractedAmount.toLocaleString()} AED)`}
                </span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  const warning = ocrWarning;
                  setOcrWarning(null);
                  await applyChequeDataToScheduleRow(
                    warning.rowId,
                    warning.currentAmount,
                    warning.extractedNum,
                    warning.extractedBank,
                    warning.extractedDate,
                    warning.extractedDrawer,
                    warning.base64,
                    warning.fileName
                  );
                }}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs border border-slate-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-600" />
                <span>
                  {isRtl 
                    ? `الاحتفاظ بقيمة القسط (${ocrWarning.currentAmount.toLocaleString()} درهم)` 
                    : `Keep Installment Amount (${ocrWarning.currentAmount.toLocaleString()} AED)`}
                </span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
