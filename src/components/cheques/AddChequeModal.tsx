import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  Camera,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  CreditCard,
  Building,
  User,
  Calendar,
  FileSpreadsheet,
  Zap,
  Image as ImageIcon,
  Check,
  RefreshCw,
  Edit3,
  Lock,
  Plus,
  X,
} from "lucide-react";
import { Modal } from "../common/Modal";
import { SearchableSelect, SearchableOption } from "../common/SearchableSelect";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { normalizeChequeOCR } from "../../utils/ocrChequeMapper";
import { useAuth } from "../../context/AuthContext";
import { Cheque, ChequeStatus, ReturnReason } from "../../types";
import { DuplicateWarningModal } from "./DuplicateWarningModal";
import { getPropertyTypeLabel } from "../../data/propertyOptions";

import { SmartDocumentCaptureModal } from "../ai/SmartDocumentCaptureModal";
import { ExtractionResult, ChequeExtractionResult } from "../../types/documentIntelligence";

import { ScannerModal } from "./ScannerModal";
import { AddBankModal } from "./AddBankModal";
import { getAllUaeBanks, saveCustomBank, isDuplicateBank } from "../../utils/bankUtils";
import { UaeBank } from "../../data/uaeBanks";
import { SmartChequeConflictModal, ChequeConflictData } from "./SmartChequeConflictModal";
import { BatchChequeOcrModal, StagedBatchCheque } from "./BatchChequeOcrModal";

interface AddChequeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStatus?: ChequeStatus;
  editingCheque?: Cheque | null;
  initialTenantId?: string;
  initialPropertyId?: string;
  initialUnitId?: string;
  initialLeaseId?: string;
  initialOwnerId?: string;
  linkToCaseId?: string;
  autoTriggerCapture?: boolean;
}

export const AddChequeModal: React.FC<AddChequeModalProps> = ({
  isOpen,
  onClose,
  initialStatus = "PENDING",
  editingCheque = null,
  initialTenantId,
  initialPropertyId,
  initialUnitId,
  initialLeaseId,
  initialOwnerId,
  linkToCaseId,
  autoTriggerCapture = false,
}) => {
  const { t, language, formatAED } = useLanguage();
  const {
    tenants,
    owners,
    properties,
    units,
    leases,
    addCheque,
    updateCheque,
    updateChequeStatus,
    checkDuplicateCheque,
    extractChequeOCR,
    linkChequesToCase,
    uploadAndArchiveDocument,
  } = useData();
  const { hasPermission } = useAuth();

  const [modificationReason, setModificationReason] = useState("");
  const hasEditSavedPermission = hasPermission("EDIT_SAVED_FINANCIAL_RECORDS");
  const isReadOnly = !!editingCheque && !hasEditSavedPermission;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Form Mode: MANUAL, OCR, or BATCH_AI
  const [entryMode, setEntryMode] = useState<"MANUAL" | "OCR" | "BATCH_AI">("OCR");

  // Smart Capture Archive storage
  const [smartCaptureArchiveDoc, setSmartCaptureArchiveDoc] = useState<{ base64: string; mime: string } | null>(null);
  const [isSubmittingCheque, setIsSubmittingCheque] = useState(false);

  // Form Fields - initialized cleanly and empty
  const [chequeNumber, setChequeNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [tenantId, setTenantId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [leaseId, setLeaseId] = useState("");
  const [drawerName, setDrawerName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [status, setStatus] = useState<ChequeStatus | "">(initialStatus);
  const [returnReason, setReturnReason] = useState<ReturnReason | "">("INSUFFICIENT_FUNDS");
  const [returnedDate, setReturnedDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  // OCR state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrImagePreview, setOcrImagePreview] = useState<string | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [ocrFeedback, setOcrFeedback] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [ocrAmountMismatchWarning, setOcrAmountMismatchWarning] = useState<{
    extractedAmount: number;
    currentAmount: number;
  } | null>(null);

  // Multi-Cheque Batch OCR Modal
  const [isBatchOcrOpen, setIsBatchOcrOpen] = useState(false);
  const [conflictModalData, setConflictModalData] = useState<ChequeConflictData | null>(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);

  // Batch AI state
  const [batchCount, setBatchCount] = useState(3);
  const [batchCreatedNotice, setBatchCreatedNotice] = useState<string | null>(null);

  // Duplicate Check
  const [duplicateCandidate, setDuplicateCandidate] = useState<Cheque | null>(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  // Scanner & Bank Modals
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);

  const [isSmartCaptureOpen, setIsSmartCaptureOpen] = useState(false);

  useEffect(() => {
    if (isOpen && autoTriggerCapture && !editingCheque) {
      setIsSmartCaptureOpen(true);
    }
  }, [isOpen, autoTriggerCapture, editingCheque]);

  const [isAddBankModalOpen, setIsAddBankModalOpen] = useState(false);
  const [bankList, setBankList] = useState<UaeBank[]>([]);

  useEffect(() => {
    if (isOpen) {
      setBankList(getAllUaeBanks());
    }
  }, [isOpen]);

  // Reset or populate fields whenever modal opens or editingCheque changes
  useEffect(() => {
    if (isOpen) {
      if (editingCheque) {
        // Edit mode: populate existing cheque details
        setEntryMode("MANUAL");
        setChequeNumber(editingCheque.chequeNumber || "");
        setBankName(editingCheque.bankName || "");
        setAmount(editingCheque.amount || 0);
        setTenantId(editingCheque.tenantId || "");
        setPropertyId(editingCheque.propertyId || "");
        setUnitId(editingCheque.unitId || "");
        setLeaseId(editingCheque.leaseId || "");
        setDrawerName(editingCheque.drawerName || "");
        setBankAccountNumber(editingCheque.bankAccountNumber || "");
        setStatus(editingCheque.status || "PENDING");
        setReturnReason(editingCheque.returnReason || "");
        setChequeDate(editingCheque.chequeDate || editingCheque.dueDate || new Date().toISOString().split("T")[0]);
        setDueDate(editingCheque.dueDate || new Date().toISOString().split("T")[0]);
        setReturnedDate(editingCheque.returnedDate || "");
        setNotes(editingCheque.notes || "");
        setOcrImagePreview(editingCheque.imageUrl || null);
        setOcrConfidence(null);
        setOcrFeedback(null);
        setBatchCreatedNotice(null);
        setDuplicateCandidate(null);
        setIsDuplicateModalOpen(false);
      } else {
        // Add mode: clean fields or pre-populate from props
        setEntryMode(linkToCaseId ? "MANUAL" : "OCR");
        setChequeNumber("");
        setBankName("");
        setAmount(0);
        setTenantId(initialTenantId || "");
        setPropertyId(initialPropertyId || "");
        setUnitId(initialUnitId || "");
        setLeaseId(initialLeaseId || "");
        setDrawerName("");
        setBankAccountNumber("");
        setStatus(linkToCaseId ? "BOUNCED" : initialStatus);
        setReturnReason("INSUFFICIENT_FUNDS");
        setChequeDate(new Date().toISOString().split("T")[0]);
        setDueDate(new Date().toISOString().split("T")[0]);
        setReturnedDate(new Date().toISOString().split("T")[0]);
        setNotes(linkToCaseId ? `Added directly to legal case` : "");
        setOcrImagePreview(null);
        setOcrConfidence(null);
        setOcrFeedback(null);
        setBatchCreatedNotice(null);
        setDuplicateCandidate(null);
        setIsDuplicateModalOpen(false);
      }
    }
  }, [isOpen, initialStatus, editingCheque, initialTenantId, initialPropertyId, initialUnitId, initialLeaseId, linkToCaseId]);

  // When tenant changes, auto-link their active property and lease
  const handleTenantChange = (tId: string) => {
    setTenantId(tId);
    if (!tId) {
      setLeaseId("");
      setPropertyId("");
      setUnitId("");
      return;
    }

    const tenantLease =
      leases.find((l) => l.tenantId === tId && l.contractStatus === "ACTIVE") ||
      leases.find((l) => l.tenantId === tId);

    if (tenantLease) {
      setLeaseId(tenantLease.id);
      setPropertyId(tenantLease.propertyId);
      setUnitId(tenantLease.unitId);
    }
  };

  // When lease changes, auto-link tenant, property and unit
  const handleLeaseChange = (lId: string) => {
    setLeaseId(lId);
    if (!lId) return;

    const leaseObj = leases.find((l) => l.id === lId);
    if (leaseObj) {
      setPropertyId(leaseObj.propertyId);
      setUnitId(leaseObj.unitId);
      if (!tenantId || tenantId !== leaseObj.tenantId) {
        setTenantId(leaseObj.tenantId);
      }
    }
  };

  // When property changes directly
  const handlePropertyChange = (pId: string) => {
    setPropertyId(pId);
    const pUnits = units.filter((u) => u.propertyId === pId);
    if (pUnits.length > 0) {
      setUnitId(pUnits[0].id);
    } else {
      setUnitId("");
    }
  };

  // When unit changes directly
  const handleUnitChange = (uId: string) => {
    setUnitId(uId);
    if (!uId) return;
    const uObj = units.find((u) => u.id === uId);
    if (uObj && uObj.propertyId) {
      setPropertyId(uObj.propertyId);
    }
  };

  // Prepare searchable options
  const tenantOptions: SearchableOption[] = tenants.map((t) => ({
    id: t.id,
    label: language === "ar" ? t.nameAr : t.nameEn,
    subLabel: `${t.code} • ${t.phone || t.email || ""}`,
    badge: t.type === "INDIVIDUAL" ? (language === "ar" ? "فرد" : "Individual") : (language === "ar" ? "شركة" : "Corporate"),
  }));

  const leaseOptions: SearchableOption[] = (tenantId ? leases.filter((l) => l.tenantId === tenantId) : leases).map((l) => {
    const prop = properties.find((p) => p.id === l.propertyId);
    const ten = tenants.find((t) => t.id === l.tenantId);
    return {
      id: l.id,
      label: l.leaseNumber,
      subLabel: `${ten ? (language === "ar" ? ten.nameAr : ten.nameEn) : ""} ${prop ? `• ${language === "ar" ? prop.nameAr : prop.nameEn}` : ""}`,
      badge: l.contractStatus,
    };
  });

  const propertyOptions: SearchableOption[] = properties.map((p) => {
    const ow = owners.find((o) => o.id === p.ownerId);
    return {
      id: p.id,
      label: language === "ar" ? p.nameAr : p.nameEn,
      subLabel: p.community ? `${p.community} (${ow ? (language === "ar" ? ow.nameAr : ow.nameEn) : p.emirate})` : (ow ? (language === "ar" ? ow.nameAr : ow.nameEn) : p.emirate),
      badge: getPropertyTypeLabel(p.type, language),
    };
  });

  const unitOptions: SearchableOption[] = (propertyId ? units.filter((u) => u.propertyId === propertyId) : units).map((u) => {
    const prop = properties.find((p) => p.id === u.propertyId);
    const activeLease = leases.find((l) => l.unitId === u.id && l.contractStatus === "ACTIVE");
    const activeTenant = activeLease ? tenants.find((t) => t.id === activeLease.tenantId) : null;
    const tenantName = activeTenant ? (language === "ar" ? activeTenant.nameAr : activeTenant.nameEn) : "";
    return {
      id: u.id,
      label: `${language === "ar" ? "الوحدة" : "Unit"} ${u.unitNumber}`,
      subLabel: `${tenantName ? `المستأجر: ${tenantName} • ` : ""}${prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : ""}`,
      badge: u.status,
    };
  });

  const processOCRImage = async (base64String: string, mimeType = "image/jpeg") => {
    setOcrImagePreview(base64String);
    setOcrLoading(true);
    setOcrFeedback(null);

    try {
      const result = await extractChequeOCR(base64String, mimeType);
      setOcrLoading(false);

      if (!result.success) {
        setOcrFeedback(result.errorAr || result.error || (language === "ar" ? "فشل استخراج بيانات الشيك" : "Cheque Extraction failed"));
        return;
      }

      const d = result?.data || result?.extracted;
      
      const normalized = normalizeChequeOCR(result, language);
      
      if (normalized.chequeNumber) {
        setChequeNumber(normalized.chequeNumber);
      }
      if (normalized.bankName) {
        setBankName(normalized.bankName);
      }
      if (normalized.drawerName) {
        setDrawerName(normalized.drawerName);
      }
      if (normalized.dueDate) {
        setChequeDate(normalized.dueDate);
        setDueDate(normalized.dueDate);
        // Intelligent matching with existing tenants in the system
        const searchDrawer = (normalized.drawerName || "").toLowerCase().trim();
        if (searchDrawer) {
          const matchedTenant = tenants.find((t) => {
            const arName = (t.nameAr || "").toLowerCase().trim();
            const enName = (t.nameEn || "").toLowerCase().trim();
            return (
              arName.includes(searchDrawer) ||
              searchDrawer.includes(arName) ||
              enName.includes(searchDrawer) ||
              searchDrawer.includes(enName)
            );
          });
          if (matchedTenant && !tenantId) {
            handleTenantChange(matchedTenant.id);
          }
        }
      }

      if (normalized.accountNumber) setBankAccountNumber(normalized.accountNumber);

      // Check if user already entered an amount in form that differs from scanned amount
      if (amount > 0 && normalized.amount > 0 && Math.abs(normalized.amount - amount) > 0.01) {
        setConflictModalData({
          field: "amount",
          original: {
            amount: amount,
            dueDate: chequeDate || dueDate,
            bankName: bankName,
            chequeNumber: chequeNumber,
            drawerName: drawerName,
          },
          extracted: {
            amount: normalized.amount,
            dueDate: normalized.dueDate,
            bankName: normalized.bankName,
            chequeNumber: normalized.chequeNumber,
            drawerName: normalized.drawerName,
          },
        });
        setIsConflictModalOpen(true);
      } else if (normalized.amount > 0) {
        setAmount(normalized.amount);
      }

      // If OCR detected a bounce stamp or return reason
      if (d?.isBounced || d?.returnReason) {
        setStatus("BOUNCED");
        if (d?.returnReason) {
          const reasonStr = String(d.returnReason).toUpperCase();
          if (reasonStr.includes("SIGNATURE")) setReturnReason("SIGNATURE_MISMATCH");
          else if (reasonStr.includes("CLOSED")) setReturnReason("ACCOUNT_CLOSED");
          else if (reasonStr.includes("POST")) setReturnReason("POST_DATED_ERROR");
          else if (reasonStr.includes("STOP")) setReturnReason("PAYMENT_STOPPED");
          else setReturnReason("");
        }
      }

      const conf = typeof d?.confidence === "number" ? d.confidence : 0.95;
      setOcrConfidence(conf);
      setOcrFeedback(
        language === "ar"
          ? `تم استخراج بيانات الشيك بنجاح (شيك رقم #${normalized.chequeNumber || chequeNumber || "..."} - ${normalized.bankName || bankName || "البنك"})`
          : `Extracted successfully (Cheque #${normalized.chequeNumber || chequeNumber || "..."} - ${normalized.bankName || bankName || "Bank"})`
      );

    } catch (err: any) {
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const mimeType = file.type || "image/jpeg";
      processOCRImage(base64String, mimeType);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const mimeType = file.type || "image/jpeg";
      processOCRImage(base64String, mimeType);
    };
    reader.readAsDataURL(file);
  };

  // Sample Cheque Quick Loaders for instantaneous testing
  const loadSampleCheque = (type: "ADCB" | "ENBD" | "FAB") => {
    setOcrLoading(true);
    setOcrFeedback(null);

    setTimeout(() => {
      setOcrLoading(false);
      if (type === "ADCB") {
        setChequeNumber("440912");
        setBankName("Abu Dhabi Commercial Bank (ADCB)");
        setAmount(42500);
        setChequeDate(new Date().toISOString().split("T")[0]);
        setDueDate(new Date().toISOString().split("T")[0]);
        setDrawerName("Al Futtaim Contracting LLC");
        setBankAccountNumber("AE440030000123456789012");
        setOcrConfidence(0.98);
        setOcrFeedback(
          language === "ar"
            ? "تم تحميل وقراءة نموذج شيك (بنك أبوظبي التجاري - ADCB) بدقة 98%"
            : "Loaded & extracted ADCB UAE sample cheque (98% confidence)"
        );
      } else if (type === "ENBD") {
        setChequeNumber("889341");
        setBankName("Emirates NBD");
        setAmount(65000);
        setChequeDate(new Date().toISOString().split("T")[0]);
        setDueDate(new Date().toISOString().split("T")[0]);
        setDrawerName("Emaar Hospitality Group LLC");
        setBankAccountNumber("AE030260000987654321098");
        setOcrConfidence(0.96);
        setOcrFeedback(
          language === "ar"
            ? "تم تحميل وقراءة نموذج شيك (بنك الإمارات دبي الوطني - Emirates NBD) بدقة 96%"
            : "Loaded & extracted Emirates NBD sample cheque (96% confidence)"
        );
      } else {
        setChequeNumber("312055");
        setBankName("First Abu Dhabi Bank (FAB)");
        setAmount(28000);
        setChequeDate(new Date().toISOString().split("T")[0]);
        setDueDate(new Date().toISOString().split("T")[0]);
        setDrawerName("Gulf General Trading Co.");
        setBankAccountNumber("AE190350000554433221100");
        setOcrConfidence(0.95);
        setOcrFeedback(
          language === "ar"
            ? "تم تحميل وقراءة نموذج شيك (بنك أبوظبي الأول - FAB) بدقة 95%"
            : "Loaded & extracted FAB sample cheque (95% confidence)"
        );
      }
    }, 400);
  };

  // AI Batch Cheque Generator for multi-cheque contracts
  const handleGenerateBatchCheques = () => {
    const prop = properties.find((p) => p.id === propertyId);
    const tObj = tenants.find((t) => t.id === tenantId);
    const baseNum = parseInt(chequeNumber.replace(/\D/g, "")) || 500100;
    const startDt = new Date(dueDate || new Date());
    const singleAmount = Math.round(amount / (batchCount || 1));

    for (let i = 0; i < batchCount; i++) {
      const curDue = new Date(startDt);
      curDue.setMonth(curDue.getMonth() + i * (12 / batchCount));
      const dueStr = curDue.toISOString().split("T")[0];

      addCheque({
        chequeNumber: String(baseNum + i),
        bankName,
        amount: singleAmount,
        chequeDate: new Date().toISOString().split("T")[0],
        dueDate: dueStr,
        ownerId: prop?.ownerId || owners[0]?.id || "ow-01",
        tenantId,
        propertyId,
        unitId,
        leaseId,
        drawerName: drawerName || (tObj ? (language === "ar" ? tObj.nameAr : tObj.nameEn) : undefined),
        bankAccountNumber: bankAccountNumber || undefined,
        status: i === 0 && status === "BOUNCED" ? "BOUNCED" : "PENDING",
        originalStatus: i === 0 && status === "BOUNCED" ? "BOUNCED" : "NORMAL",
        returnReason: i === 0 && status === "BOUNCED" ? (returnReason || undefined) : undefined,
        returnedDate: i === 0 && status === "BOUNCED" ? returnedDate : undefined,
        collectionStatus: "NOT_COLLECTED",
        notes: `AI Generated Installment (${i + 1}/${batchCount})`,
      });
    }

    setBatchCreatedNotice(
      language === "ar"
        ? `تم بنجاح إدراج وقيد ${batchCount} شيكات إيجارية بدفعات متتالية`
        : `Successfully registered ${batchCount} consecutive rental cheques`
    );

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  // Multi-Cheque Batch OCR Approval Handler
  const handleApproveBatchCheques = async (approvedCheques: StagedBatchCheque[]) => {
    const prop = properties.find((p) => p.id === propertyId);
    const tObj = tenants.find((t) => t.id === tenantId);

    for (const chq of approvedCheques) {
      addCheque({
        chequeNumber: chq.chequeNumber,
        bankName: chq.bankName,
        amount: chq.amount,
        chequeDate: chq.chequeDate || chq.dueDate,
        dueDate: chq.dueDate,
        ownerId: prop?.ownerId || owners[0]?.id || "ow-01",
        tenantId: tenantId || (tenants[0]?.id || "ten-01"),
        propertyId: propertyId || (properties[0]?.id || "prop-01"),
        unitId: unitId || (units[0]?.id || "unit-01"),
        leaseId: leaseId || "",
        drawerName: chq.drawerName || drawerName || (tObj ? (language === "ar" ? tObj.nameAr : tObj.nameEn) : undefined),
        bankAccountNumber: chq.accountNumber || bankAccountNumber || undefined,
        imageUrl: chq.imagePreview || undefined,
        status: "PENDING",
        originalStatus: "NORMAL",
        collectionStatus: "NOT_COLLECTED",
        notes: `Batch OCR Scanned Cheque (#${chq.chequeNumber})`,
        sourcePdfId: chq.sourcePdfId,
        sourcePdfFileName: chq.sourcePdfFileName,
        sourcePdfPageNumber: chq.pageNumber,
        sourceCroppedRegion: chq.croppedRegion,
        ingestionSessionId: chq.sessionId,
        sourceDocumentId: chq.sourcePdfId,
      });
    }

    setBatchCreatedNotice(
      language === "ar"
        ? `تم بنجاح إدراج وقيد ${approvedCheques.length} شيكات عبر المسح الذكي للمجموعة`
        : `Successfully registered ${approvedCheques.length} cheques via Multi-Check Batch OCR`
    );

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  
  const handleSmartCaptureApprove = (result: any, imageBase64: string, mimeType: string, saveToArchive: boolean) => {
    setIsSmartCaptureOpen(false);
    
    // Set preview and diagnostic metadata
    setOcrImagePreview(imageBase64);
    
    // Use the lowest field score as the representative confidence or the global one
    const globalConfidence = result.confidenceThresholdMet ? 0.95 : 0.7;
    setOcrConfidence(globalConfidence);
    
    setOcrFeedback(
      language === "ar" 
        ? "تم التحقق من صحة البيانات والموافقة عليها بواسطة المستخدم" 
        : "Data verified and approved by user"
    );
    
    // Populate form fields using the enhanced schema
    const normalized = normalizeChequeOCR(result, language);

    if (normalized.chequeNumber) setChequeNumber(normalized.chequeNumber);
    if (normalized.bankName) setBankName(normalized.bankName);
    if (normalized.dueDate) {
      setChequeDate(normalized.dueDate);
      setDueDate(normalized.dueDate);
    }
    
    // 5. Drawer / Holder
    if (result.drawerName?.value) setDrawerName(result.drawerName.value);
    else if (result.accountHolder?.value) setDrawerName(result.accountHolder.value);
    else if (result.drawer?.value) setDrawerName(result.drawer.value);
    else if (normalized.drawerName) setDrawerName(normalized.drawerName);
    
    // 6. Bank Account details
    if (result.accountNumber?.value) setBankAccountNumber(result.accountNumber.value);
    if (result.iban?.value && !result.accountNumber?.value) setBankAccountNumber(result.iban.value);
    
    // Check if user already entered an amount in form that differs from scanned amount
    if (amount > 0 && normalized.amount > 0 && Math.abs(normalized.amount - amount) > 0.01) {
      setConflictModalData({
        field: "amount",
        original: {
          amount: amount,
          dueDate: chequeDate || dueDate,
          bankName: bankName,
          chequeNumber: chequeNumber,
          drawerName: drawerName,
        },
        extracted: {
          amount: normalized.amount,
          dueDate: normalized.dueDate,
          bankName: normalized.bankName,
          chequeNumber: normalized.chequeNumber,
          drawerName: normalized.drawerName,
        },
      });
      setIsConflictModalOpen(true);
    } else if (normalized.amount > 0) {
      setAmount(normalized.amount);
    }

    // 7. Bounce Status
    if (result.isBounced?.value) {
      setStatus("BOUNCED");
      if (result.returnReason?.value) setReturnReason(result.returnReason.value as any);
    }
    
    // Store archival metadata
    if (imageBase64) {
      setSmartCaptureArchiveDoc({ base64: imageBase64, mime: mimeType || "image/jpeg" });
    }

    // Force entry mode to MANUAL so user can see the populated form
    setEntryMode("MANUAL");
  };

  const handleSaveAttempt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (status === "BOUNCED") {
      if (!returnReason) {
        alert(language === "ar" ? "الرجاء اختيار سبب الإرجاع المصرفي." : "Please select a return reason.");
        return;
      }
      if (!returnedDate) {
        alert(language === "ar" ? "الرجاء إدخال تاريخ الإرجاع المصرفي." : "Please enter the return date.");
        return;
      }
    }

    // If editing existing cheque, skip duplicate check and save directly
    if (editingCheque) {
      commitSave();
      return;
    }

    // Check duplicate with Cheque Number, Drawer Name, and Lease Contract
    const duplicate = checkDuplicateCheque(
      chequeNumber,
      drawerName,
      leaseId,
      tenantId,
      amount
    );
    if (duplicate) {
      setDuplicateCandidate(duplicate);
      setIsDuplicateModalOpen(true);
      return;
    }

    commitSave();
  };

  const commitSave = async () => {
    if (isSubmittingCheque) return;

    setIsSubmittingCheque(true);
    try {
      const prop = properties.find((p) => p.id === propertyId);
      const isBounced = status === "BOUNCED";

      if (editingCheque) {
        // Update existing cheque
        let finalImageUrl = editingCheque.imageUrl;
        
        // If a new image was captured/uploaded (is a Base64 string, not a Drive link)
        if (ocrImagePreview && ocrImagePreview.startsWith("data:") && ocrImagePreview !== editingCheque.imageUrl) {
          try {
            const archiveItem = await uploadAndArchiveDocument(ocrImagePreview, {
              category: "CHEQUE",
              entityType: "CHEQUE",
              entityId: editingCheque.id,
              fileName: `CHEQUE_${chequeNumber}`,
              mimeType: "image/jpeg",
              description: `Updated Cheque #${chequeNumber}`,
              tags: ["CHEQUE", "OCR", "SMART_CAPTURE"]
            });
            finalImageUrl = archiveItem.driveWebViewLink;
          } catch (err) {
            console.error("Failed to upload updated cheque image to Drive", err);
            alert(language === "ar" ? "فشل رفع صورة الشيك إلى Drive" : "Failed to upload cheque image to Drive");
          }
        }

        const result = updateCheque(editingCheque.id, {
          chequeNumber,
          bankName,
          amount,
          chequeDate,
          dueDate,
          ownerId: prop?.ownerId || owners[0]?.id || editingCheque.ownerId,
          tenantId: tenantId || editingCheque.tenantId,
          propertyId: propertyId || editingCheque.propertyId,
          unitId: unitId || editingCheque.unitId,
          leaseId: leaseId || undefined,
          drawerName: drawerName || undefined,
          bankAccountNumber: bankAccountNumber || undefined,
          imageUrl: finalImageUrl,
          status: status || editingCheque.status || "PENDING",
          originalStatus: isBounced ? "BOUNCED" : editingCheque.originalStatus,
          returnReason: isBounced ? (returnReason || undefined) : undefined,
          returnedDate: isBounced ? returnedDate : undefined,
          notes: notes || undefined,
        }, modificationReason);

        if (!result.success) {
          alert(result.error);
          return;
        }

        const finalStatus = status || editingCheque.status || "PENDING";
        if (editingCheque.status !== finalStatus || (isBounced && editingCheque.returnReason !== returnReason)) {
          const statusResult = updateChequeStatus(editingCheque.id, finalStatus, modificationReason, isBounced ? returnedDate : undefined);
          if (!statusResult.success) {
             alert(statusResult.error);
          }
        }

        setSmartCaptureArchiveDoc(null);
        setOcrImagePreview(null);
        onClose();
        return;
      }

      const newChq = addCheque({
        chequeNumber,
        bankName,
        amount,
        chequeDate,
        dueDate,
        ownerId: prop?.ownerId || owners[0]?.id || "ow-01",
        tenantId: tenantId || (tenants[0]?.id || "ten-01"),
        propertyId: propertyId || (properties[0]?.id || "prop-01"),
        unitId: unitId || (units[0]?.id || "unit-01"),
        leaseId: leaseId || "",
        drawerName: drawerName || undefined,
        bankAccountNumber: bankAccountNumber || undefined,
        imageUrl: ocrImagePreview || undefined,
        status: linkToCaseId ? "UNDER_LEGAL" : (status || "PENDING"),
        originalStatus: isBounced || linkToCaseId ? "BOUNCED" : "NORMAL",
        returnReason: isBounced || linkToCaseId ? (returnReason || undefined) : undefined,
        returnedDate: isBounced || linkToCaseId ? returnedDate : undefined,
        collectionStatus: "NOT_COLLECTED",
        notes: notes ? notes + (ocrConfidence ? ` [OCR Confidence: ${Math.round(ocrConfidence * 100)}%]` : "") : undefined,
      });

      if (newChq && smartCaptureArchiveDoc && uploadAndArchiveDocument) {
        await uploadAndArchiveDocument(smartCaptureArchiveDoc.base64, {
          fileName: `CHEQUE_${newChq.chequeNumber}`,
          category: "CHEQUE",
          entityType: "CHEQUE",
          entityId: newChq.id,
          mimeType: smartCaptureArchiveDoc.mime,
          description: `Cheque #${newChq.chequeNumber}`,
          tags: ["CHEQUE", "OCR", "SMART_CAPTURE"]
        });
      }

      if (linkToCaseId && newChq && linkChequesToCase) {
        linkChequesToCase(linkToCaseId, [newChq.id], "Added directly inside case management modal");
      }

      setSmartCaptureArchiveDoc(null);
      setOcrImagePreview(null);
      setIsDuplicateModalOpen(false);
      onClose();
    } catch (saveErr) {
      console.error("Failed to commit cheque save:", saveErr);
      alert(language === "ar" ? "حدث خطأ أثناء حفظ بيانات الشيك." : "Error occurred while saving cheque record.");
    } finally {
      setIsSubmittingCheque(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          editingCheque
            ? language === "ar"
              ? `تعديل بيانات الشيك #${editingCheque.chequeNumber}`
              : `Edit Cheque #${editingCheque.chequeNumber}`
            : language === "ar"
            ? "إضافة وقيد شيك في النظام"
            : "Register Cheque Entry"
        }
        subtitle={
          editingCheque
            ? language === "ar"
              ? "تعديل تفاصيل الشيك، الساحب، المبالغ، التواريخ، وحالة الإرجاع المصرفي"
              : "Update cheque details, drawer, dates, amounts, and bank return specifications"
            : language === "ar"
            ? "تسجيل شيك إيجاري يدوي أو باستخدام المسح الذكي بالذكاء الاصطناعي"
            : "Cheque registration with automated AI OCR extraction and duplicate verification"
        }
        icon={
          editingCheque ? (
            <Edit3 className="w-5 h-5 text-amber-700" />
          ) : (
            <CreditCard className="w-5 h-5 text-amber-700" />
          )
        }
        maxWidth="4xl"
      >
        {/* Entry Mode Switcher */}
        {!editingCheque && (
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl mb-4">
            <button
              type="button"
              onClick={() => setEntryMode("OCR")}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                entryMode === "OCR"
                  ? "bg-amber-700 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{language === "ar" ? "المسح الذكي (AI OCR)" : "AI Smart OCR"}</span>
            </button>

            <button
              type="button"
              onClick={() => setEntryMode("BATCH_AI")}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                entryMode === "BATCH_AI"
                  ? "bg-purple-700 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{language === "ar" ? "إدراج شيكات متعددة (دفعات عقد)" : "AI Multi-Cheque Batch"}</span>
            </button>

            <button
              type="button"
              onClick={() => setEntryMode("MANUAL")}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                entryMode === "MANUAL"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {language === "ar" ? "الإدخال اليدوي" : "Manual Form"}
            </button>
          </div>
        )}

        {/* BATCH AI MODE */}
        {entryMode === "BATCH_AI" && (
          <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl mb-4 space-y-3">
            <div className="flex items-center gap-2 text-purple-950 font-bold text-xs">
              <Zap className="w-4 h-4 text-purple-700" />
              <span>
                {language === "ar"
                  ? "توليد وقيد شيكات عقد الإيجار تلقائياً (1 إلى 12 دفعة)"
                  : "Auto-Generate Lease Cheque Installments"}
              </span>
            </div>
            <p className="text-[11px] text-purple-800/80">
              {language === "ar"
                ? "حدد إجمالي قيمة الإيجار السنوي وعدد الدفعات، وسيقوم النظام بحساب مبالغ الشيكات وتواريخ استحقاقها وقيدها في السجل دفعة واحدة."
                : "Enter annual contract value and payments count. The engine computes installment amounts, dates, and saves batch entries."}
            </p>

            <div className="flex items-center gap-3 pt-2">
              <span className="text-xs font-bold text-purple-950">
                {language === "ar" ? "عدد الشيكات:" : "Cheques Count:"}
              </span>
              {[1, 2, 4, 6, 12].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setBatchCount(num)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    batchCount === num
                      ? "bg-purple-700 text-white shadow-xs"
                      : "bg-white text-purple-900 border border-purple-200 hover:bg-purple-100"
                  }`}
                >
                  {num} {language === "ar" ? "شيكات" : "Cheques"}
                </button>
              ))}
            </div>

            {/* Direct Multi-Cheque Batch OCR Button */}
            <div className="pt-2 border-t border-purple-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-[11px] text-purple-900">
                {language === "ar"
                  ? "أو قم برفع صورة مجمعة تحتوي على كافة الشيكات للمسح والفرز الآلي المباشر:"
                  : "Or upload a sheet containing all physical cheques for automated batch extraction:"}
              </div>
              <button
                type="button"
                onClick={() => setIsBatchOcrOpen(true)}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
              >
                <Sparkles className="w-4 h-4 text-purple-200" />
                <span>
                  {language === "ar"
                    ? "المسح الذكي لمجموعة الشيكات (Multi-Check Batch OCR)"
                    : "Multi-Check Batch OCR"}
                </span>
              </button>
            </div>

            {batchCreatedNotice && (
              <div className="p-2.5 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-700" />
                <span>{batchCreatedNotice}</span>
              </div>
            )}
          </div>
        )}

        {/* OCR Upload Card */}
        {entryMode === "OCR" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`p-4 rounded-2xl mb-4 space-y-3 transition-all ${
              isDragOver
                ? "bg-amber-100/70 border-2 border-dashed border-amber-500 scale-[1.01]"
                : "bg-amber-50/50 border-2 border-dashed border-amber-300"
            }`}
          >
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-2xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="text-xs font-bold text-amber-950">
                {language === "ar"
                  ? "ارفع صورة الشيك أو اسحب الملف هنا للمسح الذكي"
                  : "Upload / Drag & Drop Cheque Image for AI OCR"}
              </h4>
              <p className="text-[11px] text-amber-800/80 max-w-lg mx-auto">
                {language === "ar"
                  ? "يقوم محرك الذكاء الاصطناعي بقراءة أرقام الشيكات، اسم البنك، الحساب، المبالغ وتواريخ الاستحقاق تلقائياً."
                  : "Gemini AI reads UAE cheque numbers, bank, IBAN, amounts, drawer signature line, and due dates automatically."}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsSmartCaptureOpen(true)}
                disabled={ocrLoading}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-bold shadow-sm transition-colors cursor-pointer w-full max-w-sm justify-center"
              >
                <Sparkles className="w-5 h-5" />
                <span>{language === "ar" ? "✨ مسح باستخدام الالتقاط الذكي" : "✨ Scan with Smart Capture"}</span>
              </button>
            </div>

            {/* Quick Sample Cheque Fillers */}
            <div className="pt-2 border-t border-amber-200/60 flex flex-wrap items-center justify-center gap-2">
              <span className="text-[10px] font-bold text-amber-900/70">
                {language === "ar" ? "أو جرّب نماذج بنوك الإمارات فورياً:" : "Or test with UAE bank templates:"}
              </span>
              <button
                type="button"
                onClick={() => loadSampleCheque("ADCB")}
                className="px-2.5 py-1 text-[10px] font-bold bg-white text-amber-900 hover:bg-amber-100/60 border border-amber-200 rounded-lg transition-colors cursor-pointer"
              >
                أبوظبي التجاري (ADCB)
              </button>
              <button
                type="button"
                onClick={() => loadSampleCheque("ENBD")}
                className="px-2.5 py-1 text-[10px] font-bold bg-white text-amber-900 hover:bg-amber-100/60 border border-amber-200 rounded-lg transition-colors cursor-pointer"
              >
                الإمارات دبي الوطني (ENBD)
              </button>
              <button
                type="button"
                onClick={() => loadSampleCheque("FAB")}
                className="px-2.5 py-1 text-[10px] font-bold bg-white text-amber-900 hover:bg-amber-100/60 border border-amber-200 rounded-lg transition-colors cursor-pointer"
              >
                أبوظبي الأول (FAB)
              </button>
            </div>

            {/* Uploaded Cheque Image Preview */}
            {ocrImagePreview && (
              <div className="p-3 bg-white rounded-xl border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-12 rounded-lg border border-slate-200 overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
                    <img
                      src={ocrImagePreview}
                      alt="Scanned Cheque"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      {language === "ar" ? "صورة الشيك الممسوح ضوئياً" : "Scanned Cheque Image"}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold block">
                      {language === "ar"
                        ? "✓ تم التعرف على البيانات ومطابقتها مع الحقول أدناه"
                        : "✓ Details extracted and mapped to form fields below"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setOcrImagePreview(null);
                    setOcrFeedback(null);
                  }}
                  className="text-[11px] text-rose-600 hover:text-rose-800 font-bold px-2 py-1 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  {language === "ar" ? "إزالة الصورة" : "Remove Image"}
                </button>
              </div>
            )}

            {ocrLoading && (
              <div className="py-4 text-center space-y-2">
                <div className="inline-block w-6 h-6 border-3 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-bold text-amber-900 animate-pulse">
                  {language === "ar"
                    ? "جارٍ تحليل واستخراج بيانات الشيك بالذكاء الاصطناعي (Gemini 3.7 Flash)..."
                    : "Analyzing Cheque with Gemini 3.7 Flash OCR Engine..."}
                </p>
              </div>
            )}

            {ocrFeedback && !ocrLoading && (
              <div className="p-3 bg-white/90 border border-emerald-200 rounded-xl text-xs flex items-center justify-between text-slate-800 font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold text-emerald-950">{ocrFeedback}</span>
                </div>
                {ocrConfidence && (
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    {Math.round(ocrConfidence * 100)}% Confidence
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Cheque Form */}
        <form onSubmit={handleSaveAttempt} className="space-y-4">
          {/* Live Compiled Cheque Information Text Box */}
          {(() => {
            const selectedTenant = tenants.find((t) => t.id === tenantId);
            const selectedProp = properties.find((p) => p.id === propertyId);
            const selectedUnit = units.find((u) => u.id === unitId);
            const selectedLease = leases.find((l) => l.id === leaseId);
            const tenantDisplayName = selectedTenant ? (language === "ar" ? selectedTenant.nameAr : selectedTenant.nameEn) : "";
            const propDisplayName = selectedProp ? (language === "ar" ? selectedProp.nameAr : selectedProp.nameEn) : "";

            const getStatusBadge = (s: string) => {
              switch (s) {
                case "CLEARED":
                  return { label: language === "ar" ? "محصل / مدفوع" : "Cleared", bg: "bg-emerald-100 text-emerald-800" };
                case "BOUNCED":
                  return { label: language === "ar" ? "شيك راجع (مرتجع)" : "Bounced", bg: "bg-rose-100 text-rose-800 font-bold" };
                case "DEPOSITED":
                  return { label: language === "ar" ? "مودع للتحصيل" : "Deposited", bg: "bg-blue-100 text-blue-800" };
                case "SETTLED_CASH":
                  return { label: language === "ar" ? "تسوية كاش" : "Cash Settled", bg: "bg-teal-100 text-teal-800" };
                case "REPLACED":
                  return { label: language === "ar" ? "مستبدل" : "Replaced", bg: "bg-purple-100 text-purple-800" };
                case "UNDER_LEGAL_CASE":
                  return { label: language === "ar" ? "قضية إيجارية" : "Under Case", bg: "bg-amber-100 text-amber-900" };
                default:
                  return { label: language === "ar" ? "قيد الانتظار" : "Pending", bg: "bg-slate-100 text-slate-800" };
              }
            };
            const stInfo = getStatusBadge(status);

            return (
              <div className="p-4 bg-amber-50/80 border-2 border-amber-300/80 rounded-2xl space-y-2.5 shadow-xs">
                <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
                  <CreditCard className="w-4 h-4 text-amber-700" />
                  <span>
                    {language === "ar"
                      ? "📋 معلومات مجمعة عن الشيك (معاينة فورية للبيانات المدخلة):"
                      : "📋 Compiled Cheque Summary & Live Preview:"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs text-amber-950 bg-white p-3.5 rounded-xl border border-amber-200">
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "رقم الشيك:" : "Cheque #:"}</span>
                    <strong className="font-mono text-amber-950">{chequeNumber || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "البنك المسحوب عليه:" : "Bank:"}</span>
                    <strong className="text-amber-950 truncate block" title={bankName || "—"}>{bankName || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "مبلغ الشيك:" : "Amount:"}</span>
                    <strong className="font-mono text-emerald-950 text-sm font-black">{amount > 0 ? formatAED(amount) : "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "تاريخ الاستحقاق:" : "Due Date:"}</span>
                    <strong className="font-mono text-amber-950">{dueDate || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "المستأجر:" : "Tenant:"}</span>
                    <strong className="text-amber-950 truncate block" title={tenantDisplayName || "—"}>{tenantDisplayName || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "العقار والوحدة:" : "Property & Unit:"}</span>
                    <strong className="text-amber-950 truncate block">
                      {propDisplayName || "—"} {selectedUnit ? `• وحدة ${selectedUnit.unitNumber}` : ""}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "رقم العقد الإيجاري:" : "Lease #:"}</span>
                    <strong className="font-mono text-amber-950">{selectedLease?.leaseNumber || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "اسم الساحب:" : "Drawer:"}</span>
                    <strong className="text-amber-950 truncate block" title={drawerName || "—"}>{drawerName || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "حساب الساحب:" : "A/C #:"}</span>
                    <strong className="font-mono text-amber-950 truncate block">{bankAccountNumber || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "حالة الشيك:" : "Status:"}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${stInfo.bg}`}>
                      {stInfo.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "رقم الشيك" : "Cheque Number"} *
              </label>
              <input
                type="text"
                required
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                placeholder={language === "ar" ? "أدخل رقم الشيك (مثال: 000123)" : "e.g. 000123"}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  {t("bankName")} *
                </label>
                {bankName && !isDuplicateBank(bankList, bankName) && (
                  <button
                    type="button"
                    onClick={() => {
                      const newB = saveCustomBank(bankName);
                      setBankList(getAllUaeBanks());
                      setBankName(newB.nameAr);
                      alert(language === "ar" ? "تمت إضافة البنك إلى قائمة البنوك بنجاح" : "Bank added to list successfully");
                    }}
                    className="text-[10px] text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{language === "ar" ? "إضافة للقائمة" : "Add to List"}</span>
                  </button>
                )}
              </div>
              <SearchableSelect
                required
                options={[
                  ...bankList.map((b) => ({
                    id: language === "ar" ? b.nameAr : b.nameEn,
                    label: language === "ar" ? `${b.nameAr} (${b.nameEn})` : `${b.nameEn} (${b.nameAr})`,
                    subLabel: b.code || "",
                  })),
                  {
                    id: "ADD_NEW_BANK_ACTION",
                    label: language === "ar" ? "+ إضافة بنك جديد (Add New Bank)" : "+ Add New Bank",
                    badge: "جديد",
                  },
                ]}
                value={bankName}
                onChange={(val) => {
                  if (val === "ADD_NEW_BANK_ACTION") {
                    setIsAddBankModalOpen(true);
                  } else {
                    setBankName(val);
                  }
                }}
                placeholder={language === "ar" ? "-- اختر البنك --" : "-- Select Bank --"}
                searchPlaceholder={language === "ar" ? "ابحث باسم البنك..." : "Search bank name..."}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "مبلغ الشيك (درهم)" : "Amount (AED)"} *
              </label>
              <input
                type="number"
                min={1}
                required
                value={amount === 0 ? "" : amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder={language === "ar" ? "المبلغ بالدرهم الإماراتي" : "Amount in AED"}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SearchableSelect
              label={language === "ar" ? "المستأجر" : "Tenant"}
              required
              options={tenantOptions}
              value={tenantId}
              onChange={(val) => handleTenantChange(val)}
              placeholder={language === "ar" ? "-- ابحث واختر المستأجر --" : "-- Select Tenant --"}
              searchPlaceholder={language === "ar" ? "ابحث بالاسم أو الكود..." : "Search name or code..."}
            />

            <SearchableSelect
              label={language === "ar" ? "عقد الإيجار المرتبط" : "Lease Contract"}
              options={leaseOptions}
              value={leaseId}
              onChange={(val) => handleLeaseChange(val)}
              placeholder={language === "ar" ? "-- ابحث واختر العقد --" : "-- Select Lease --"}
              searchPlaceholder={language === "ar" ? "ابحث برقم العقد..." : "Search contract no..."}
            />

            <SearchableSelect
              label={t("navProperties")}
              required
              options={propertyOptions}
              value={propertyId}
              onChange={(val) => handlePropertyChange(val)}
              placeholder={language === "ar" ? "-- ابحث واختر العقار --" : "-- Select Property --"}
              searchPlaceholder={language === "ar" ? "ابحث بأسماء العقارات..." : "Search property..."}
            />

            <SearchableSelect
              label={t("navUnits")}
              required
              options={unitOptions}
              value={unitId}
              onChange={(val) => handleUnitChange(val)}
              placeholder={language === "ar" ? "-- ابحث واختر الوحدة --" : "-- Select Unit --"}
              searchPlaceholder={language === "ar" ? "ابحث برقم الوحدة..." : "Search unit no..."}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "تاريخ تحرير الشيك" : "Cheque Date"} *
              </label>
              <input
                type="date"
                required
                value={chequeDate}
                onChange={(e) => setChequeDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "تاريخ الاستحقاق" : "Due Date"} *
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "حالة الشيك" : "Cheque Status"} *
              </label>
              <SearchableSelect
                options={[
                  { id: "PENDING", label: "PENDING (معلق / تحت التحصيل)" },
                  { id: "DEPOSITED", label: "DEPOSITED (تم الإيداع)" },
                  { id: "BOUNCED", label: "BOUNCED (مرتجع)" },
                  { id: "CLEARED", label: "CLEARED (تم الصرف)" },
                ]}
                value={status}
                onChange={(val) => setStatus(val as any)}
                placeholder={language === "ar" ? "اختر حالة الشيك..." : "Select status..."}
                searchPlaceholder={language === "ar" ? "ابحث عن حالة..." : "Search status..."}
              />
            </div>
          </div>

          {/* Additional details: Drawer & Account */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "اسم كاتب الشيك / الساحب" : "Cheque Drawer / Writer Name"}
              </label>
              <input
                type="text"
                value={drawerName}
                onChange={(e) => setDrawerName(e.target.value)}
                placeholder={language === "ar" ? "الاسم المكتوب على الشيك (مثال: شركة الفطيم للمقاولات)" : "Name written on cheque"}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "رقم الحساب أو الآيبان (IBAN)" : "Bank Account / IBAN"}
              </label>
              <input
                type="text"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder="AE440030000123456789012"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white"
              />
            </div>
          </div>

          {/* Conditional Bounced Fields */}
          {status === "BOUNCED" && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>{language === "ar" ? "بيانات الإرجاع المصرفي للشيك" : "Bank Bounce & Return Specification"}</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {language === "ar" ? "سبب الإرجاع المصرفي" : "Return Reason"} *
                  </label>
                  <SearchableSelect
                    options={[
                      { id: "INSUFFICIENT_FUNDS", label: "عدم كفاية الرصيد (Insufficient Funds)" },
                      { id: "SIGNATURE_MISMATCH", label: "عدم مطابقة التوقيع (Signature Mismatch)" },
                      { id: "ACCOUNT_CLOSED", label: "الحساب مغلق (Account Closed)" },
                      { id: "POST_DATED_ERROR", label: "شيك مؤجل التاريخ (Post-Dated Cheque)" },
                      { id: "PAYMENT_STOPPED", label: "أمر إيقاف صرف (Stopped Payment)" },
                      { id: "TECHNICAL_ERROR", label: "خطأ تقني / بنكي (Technical Error)" },
                    ]}
                    value={returnReason}
                    onChange={(val) => setReturnReason(val as any)}
                    placeholder={language === "ar" ? "اختر سبب الإرجاع..." : "Select reason..."}
                    searchPlaceholder={language === "ar" ? "ابحث عن سبب..." : "Search reason..."}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {language === "ar" ? "تاريخ الإرجاع المصرفي" : "Return Date"} *
                  </label>
                  <input
                    type="date"
                    required
                    value={returnedDate}
                    onChange={(e) => setReturnedDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Modification Reason - Mandatory when editing */}
          {editingCheque && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 mt-4">
              <label className="block text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-amber-600" />
                <span>{language === "ar" ? "سبب تعديل السجل المالي" : "Financial Record Modification Reason"} *</span>
              </label>
              <textarea
                value={modificationReason}
                onChange={(e) => setModificationReason(e.target.value)}
                required
                placeholder={language === "ar" ? "يجب إدخال سبب التعديل ليتم حفظ السجل في سجل التدقيق..." : "You must provide a reason for this modification for the audit log..."}
                className="w-full px-3 py-2 text-xs bg-white border border-amber-200 rounded-xl focus:border-amber-500 focus:ring-1 focus:ring-amber-500 min-h-[60px]"
              />
              <p className="text-[10px] text-amber-700 italic">
                {language === "ar" 
                  ? "سيتم تسجيل هذا التعديل مع اسمك والبيانات السابقة في سجل التدقيق."
                  : "This modification will be logged with your name and previous values in the audit trail."}
              </p>
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              {t("cancel")}
            </button>

            {entryMode === "BATCH_AI" ? (
              <button
                type="button"
                onClick={handleGenerateBatchCheques}
                className="px-5 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>
                  {language === "ar"
                    ? `توليد وقيد (${batchCount}) شيكات الآن`
                    : `Generate (${batchCount}) Cheques Now`}
                </span>
              </button>
            ) : isReadOnly ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold border border-slate-200">
                <Lock className="w-3.5 h-3.5" />
                <span>{language === "ar" ? "السجل مقفل" : "Record Locked"}</span>
              </div>
            ) : (
              <button
                type="submit"
                disabled={isSubmittingCheque}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-50 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isSubmittingCheque ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{language === "ar" ? "جاري الحفظ والتكامل..." : "Saving..."}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>
                      {editingCheque
                        ? language === "ar"
                          ? "حفظ التعديلات"
                          : "Save Changes"
                        : t("save")}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </Modal>

      {/* Smart Capture Modal */}
      <SmartDocumentCaptureModal
        isOpen={isSmartCaptureOpen}
        onClose={() => setIsSmartCaptureOpen(false)}
        documentType="CHEQUE"
        onApprove={handleSmartCaptureApprove}
      />


      {/* Scanner Hardware Modal */}
      <ScannerModal documentType="CHEQUE"
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        onScanComplete={(base64, mimeType) => {
          processOCRImage(base64, mimeType);
        }}
      />

      {/* Add New Bank Modal */}
      <AddBankModal
        isOpen={isAddBankModalOpen}
        onClose={() => setIsAddBankModalOpen(false)}
        onBankAdded={(newBank) => {
          const updated = getAllUaeBanks();
          setBankList(updated);
          setBankName(language === "ar" ? newBank.nameAr : newBank.nameEn);
        }}
      />

      {/* Smart Cheque Conflict Resolution Modal */}
      {conflictModalData && (
        <SmartChequeConflictModal
          isOpen={isConflictModalOpen}
          onClose={() => {
            setIsConflictModalOpen(false);
            setConflictModalData(null);
          }}
          conflict={conflictModalData}
          onUseOcr={(resolvedData) => {
            if (resolvedData.amount) {
              setAmount(resolvedData.amount);
            }
            if (resolvedData.dueDate) {
              setDueDate(resolvedData.dueDate);
              setChequeDate(resolvedData.dueDate);
            }
            if (resolvedData.bankName) {
              setBankName(resolvedData.bankName);
            }
            if (resolvedData.chequeNumber) {
              setChequeNumber(resolvedData.chequeNumber);
            }
            if (resolvedData.drawerName) {
              setDrawerName(resolvedData.drawerName);
            }
            setIsConflictModalOpen(false);
            setConflictModalData(null);
          }}
          onKeepOriginal={(resolvedData) => {
            // Keep original form amount, optionally update rest
            if (resolvedData.dueDate) {
              setDueDate(resolvedData.dueDate);
              setChequeDate(resolvedData.dueDate);
            }
            if (resolvedData.bankName) {
              setBankName(resolvedData.bankName);
            }
            if (resolvedData.chequeNumber) {
              setChequeNumber(resolvedData.chequeNumber);
            }
            if (resolvedData.drawerName) {
              setDrawerName(resolvedData.drawerName);
            }
            setIsConflictModalOpen(false);
            setConflictModalData(null);
          }}
          onManualEditApply={(customData) => {
            if (customData.amount !== undefined) setAmount(customData.amount);
            if (customData.dueDate) {
              setDueDate(customData.dueDate);
              setChequeDate(customData.dueDate);
            }
            if (customData.bankName) setBankName(customData.bankName);
            if (customData.chequeNumber) setChequeNumber(customData.chequeNumber);
            if (customData.drawerName) setDrawerName(customData.drawerName);
            setIsConflictModalOpen(false);
            setConflictModalData(null);
          }}
        />
      )}

      {/* Multi-Cheque Batch OCR Modal */}
      <BatchChequeOcrModal
        isOpen={isBatchOcrOpen}
        onClose={() => setIsBatchOcrOpen(false)}
        leaseId={leaseId}
        tenantId={tenantId}
        propertyId={propertyId}
        unitId={unitId}
        defaultDrawerName={drawerName}
        onApproveBatch={handleApproveBatchCheques}
      />

      {/* Duplicate Warning Modal */}
      {duplicateCandidate && (
        <DuplicateWarningModal
          isOpen={isDuplicateModalOpen}
          onClose={() => setIsDuplicateModalOpen(false)}
          onConfirmOverride={commitSave}
          existingCheque={duplicateCandidate}
          newChequeData={{
            chequeNumber,
            bankName,
            amount,
            drawerName,
            leaseId,
            tenantId,
            chequeDate,
            dueDate,
          }}
        />
      )}
    </>
  );
};
