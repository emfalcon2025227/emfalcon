import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Sparkles,
  Upload,
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  CreditCard,
  Building2,
  User,
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  Camera,
  Check,
  X,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  Lock,
  Scan,
  FileText,
  RotateCcw,
} from "lucide-react";
import { Modal } from "../common/Modal";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { normalizeChequeOCR, NormalizedChequeOCRResult } from "../../utils/ocrChequeMapper";
import { getAllUaeBanks } from "../../utils/bankUtils";
import { Cheque, ChequeStatus } from "../../types";
import { DocumentStorageService } from "../../services/documentStorageService";
import { ScannerModal } from "./ScannerModal";
import {
  DocumentSessionService,
  DocumentProcessingSession,
  ProcessedDocumentItem,
  DocumentProcessingInput,
  validateChequeItem,
} from "../../services/ocr/documentSessionService";
import { PdfIngestionService } from "../../services/pdfIngestionService";
import { MultiChequeSegmenter } from "../../services/ocr/multiChequeSegmenter";

export interface StagedBatchCheque {
  id: string;
  temporaryId: string;
  installmentId?: string;
  installmentIndex?: number;
  chequeNumber: string;
  bankName: string;
  amount: number;
  originalInstallmentAmount?: number;
  chequeDate: string;
  originalInstallmentDueDate?: string;
  dueDate: string;
  drawerName: string;
  accountNumber?: string;
  confidence: number;
  imagePreview?: string;
  originalImage?: string;
  isManuallyEdited?: boolean;
  manualCorrections?: Partial<NormalizedChequeOCRResult>;
  originalOcrAmount?: number;
  originalOcrChequeNumber?: string;
  originalOcrDueDate?: string;
  originalOcrBankName?: string;
  status: ChequeStatus;
  validationStatus: "VALID" | "AMOUNT_MISMATCH" | "DATE_MISMATCH" | "DUPLICATE" | "MISSING_INFO" | "NEEDS_REVIEW";
  validationNotes?: string;
  duplicateLevel?: "EXACT" | "PROBABLE" | "POSSIBLE" | "NONE";
  sourcePdfId?: string;
  sourcePdfFileName?: string;
  pageNumber?: number;
  croppedRegion?: { x: number; y: number; width: number; height: number };
  isPdfSource?: boolean;
  sessionId?: string;
}

export interface BatchInstallmentTarget {
  id: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  chequeNumber?: string;
  bankName?: string;
  drawerName?: string;
  paymentMethod?: string;
  status?: string;
}

interface BatchChequeOcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  leaseId?: string;
  tenantId?: string;
  propertyId?: string;
  unitId?: string;
  ownerId?: string;
  defaultDrawerName?: string;
  targetInstallments?: BatchInstallmentTarget[];
  onApproveBatch: (approvedCheques: StagedBatchCheque[]) => Promise<void> | void;
}

export const BatchChequeOcrModal: React.FC<BatchChequeOcrModalProps> = ({
  isOpen,
  onClose,
  leaseId,
  tenantId,
  propertyId,
  unitId,
  ownerId,
  defaultDrawerName,
  targetInstallments = [],
  onApproveBatch,
}) => {
  const { language } = useLanguage();
  const { currentUser } = useAuth();
  const isAr = language === "ar";
  const { cheques = [] } = useData();

  const [currentSession, setCurrentSession] = useState<DocumentProcessingSession | null>(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrProgressText, setOcrProgressText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFilesCount, setUploadedFilesCount] = useState(0);

  // Hardware Scanner state
  const [isHardwareScannerOpen, setIsHardwareScannerOpen] = useState(false);

  // Staged Cheques
  const [stagedCheques, setStagedCheques] = useState<StagedBatchCheque[]>([]);
  const [unassignedCheques, setUnassignedCheques] = useState<StagedBatchCheque[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [singleScanTargetId, setSingleScanTargetId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const singleFileInputRef = useRef<HTMLInputElement>(null);

  const uaeBanks = useMemo(() => getAllUaeBanks(), []);

  // Compute available / unfilled installments from targetInstallments
  const availableInstallments = useMemo(() => {
    return targetInstallments.filter((inst) => {
      const isChequeMethod = !inst.paymentMethod || inst.paymentMethod === "CHEQUE";
      const isNotPaid = inst.status !== "PAID" && inst.status !== "CLEARED" && inst.status !== "COLLECTED";
      const isUnfilled = !inst.chequeNumber || inst.chequeNumber.trim() === "";
      return isChequeMethod && isNotPaid && isUnfilled;
    });
  }, [targetInstallments]);

  // Clean lifecycle reset on modal Open and Close (Prevents stale state and input caching)
  useEffect(() => {
    if (isOpen) {
      // 1. Reset file inputs
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (singleFileInputRef.current) singleFileInputRef.current.value = "";

      // 2. Initialize fresh authoritative session
      const newSession = DocumentSessionService.createSession({
        sourceType: "FILE_UPLOAD",
        contractId: leaseId,
        createdBy: currentUser?.nameAr || currentUser?.username || "المسؤول",
      });
      setCurrentSession(newSession);

      // 3. Clear transient staging states
      setStagedCheques([]);
      setUnassignedCheques([]);
      setUploadedFilesCount(0);
      setPreviewImage(null);
      setSingleScanTargetId(null);
      setIsProcessingOcr(false);
      setOcrProgressText("");
    } else {
      // Clean up on modal close
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (singleFileInputRef.current) singleFileInputRef.current.value = "";
      setIsProcessingOcr(false);
      setOcrProgressText("");
    }
  }, [isOpen, leaseId, currentUser]);

  // Transform ProcessedDocumentItem array into StagedBatchCheque items mapped to installments
  const stageProcessedItems = (
    processedItems: ProcessedDocumentItem[],
    sourceFileCount: number,
    append: boolean = false
  ) => {
    // 1. Sort chronologically by dueDate ASC
    const sorted = [...processedItems].sort((a, b) => {
      const dateA = a.normalizedData.dueDate || "";
      const dateB = b.normalizedData.dueDate || "";
      if (!dateA) return 1;
      if (!dateB) return -1;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

    const targetSlots = availableInstallments.length > 0 ? availableInstallments : [];
    const newStaged: StagedBatchCheque[] = [];
    const newSurplus: StagedBatchCheque[] = [];

    sorted.forEach((item, idx) => {
      const effectiveIndex = append ? stagedCheques.length + idx : idx;
      const targetSlot = targetSlots[effectiveIndex];
      const chqId = item.temporaryId;

      const stagedItem: StagedBatchCheque = {
        id: chqId,
        temporaryId: item.temporaryId,
        installmentId: targetSlot?.id,
        installmentIndex: targetSlot ? targetSlot.installmentNumber : effectiveIndex + 1,
        chequeNumber: item.normalizedData.chequeNumber || "",
        bankName: item.normalizedData.bankName || "",
        amount:
          item.normalizedData.amount > 0
            ? item.normalizedData.amount
            : (targetSlot?.amount || 0),
        originalInstallmentAmount: targetSlot?.amount,
        chequeDate: item.normalizedData.dueDate || targetSlot?.dueDate || "",
        originalInstallmentDueDate: targetSlot?.dueDate,
        dueDate: item.normalizedData.dueDate || targetSlot?.dueDate || "",
        drawerName: item.normalizedData.drawerName || defaultDrawerName || "",
        accountNumber: item.normalizedData.accountNumber || "",
        confidence: item.confidence,
        imagePreview: item.imagePreview,
        originalImage: item.originalImage,
        isManuallyEdited: item.isManuallyEdited,
        manualCorrections: item.manualCorrections,
        originalOcrAmount: item.originalOcrData?.amount,
        originalOcrChequeNumber: item.originalOcrData?.chequeNumber,
        originalOcrDueDate: item.originalOcrData?.dueDate,
        originalOcrBankName: item.originalOcrData?.bankName,
        status: "POST_DATED",
        validationStatus: item.validationStatus,
        validationNotes: item.validationNotes,
        duplicateLevel: item.duplicateLevel,
        sourcePdfId: item.sourcePdfId,
        sourcePdfFileName: item.sourceFileName,
        pageNumber: item.pageNumber,
        croppedRegion: item.croppedRegion,
        isPdfSource: Boolean(item.sourcePdfId),
        sessionId: currentSession?.sessionId,
      };

      if (targetSlot || targetSlots.length === 0) {
        newStaged.push(stagedItem);
      } else {
        newSurplus.push(stagedItem);
      }
    });

    if (append) {
      setStagedCheques((prev) => [...prev, ...newStaged]);
      setUnassignedCheques((prev) => [...prev, ...newSurplus]);
    } else {
      setStagedCheques(newStaged);
      setUnassignedCheques(newSurplus);
    }
    setUploadedFilesCount((prev) => (append ? prev + sourceFileCount : sourceFileCount));
  };

  // Re-run validation on a cheque item
  const revalidateCheque = (
    chq: StagedBatchCheque,
    allBatch: StagedBatchCheque[]
  ): { status: StagedBatchCheque["validationStatus"]; notes?: string; duplicateLevel: StagedBatchCheque["duplicateLevel"] } => {
    const mappedItem: ProcessedDocumentItem = {
      temporaryId: chq.temporaryId || chq.id,
      sequence: chq.installmentIndex || 1,
      sourceFileName: chq.sourcePdfFileName || "cheque.jpg",
      sourceMimeType: "image/jpeg",
      processingStatus: "COMPLETED",
      retryCount: 0,
      ocrAttempt: 1,
      validationStatus: "VALID",
      duplicateLevel: "NONE",
      confidence: chq.confidence,
      normalizedData: {
        chequeNumber: chq.chequeNumber,
        bankName: chq.bankName,
        amount: chq.amount,
        dueDate: chq.dueDate,
        drawerName: chq.drawerName,
        accountNumber: chq.accountNumber || "",
      },
      isManuallyEdited: Boolean(chq.isManuallyEdited),
      imagePreview: chq.imagePreview || "",
      processedAt: new Date().toISOString(),
    };

    const otherItems: ProcessedDocumentItem[] = allBatch
      .filter((other) => other.id !== chq.id)
      .map((other) => ({
        temporaryId: other.temporaryId || other.id,
        sequence: other.installmentIndex || 1,
        sourceFileName: other.sourcePdfFileName || "cheque.jpg",
        sourceMimeType: "image/jpeg",
        processingStatus: "COMPLETED",
        retryCount: 0,
        ocrAttempt: 1,
        validationStatus: "VALID",
        duplicateLevel: "NONE",
        confidence: other.confidence,
        normalizedData: {
          chequeNumber: other.chequeNumber,
          bankName: other.bankName,
          amount: other.amount,
          dueDate: other.dueDate,
          drawerName: other.drawerName,
          accountNumber: other.accountNumber || "",
        },
        isManuallyEdited: Boolean(other.isManuallyEdited),
        imagePreview: other.imagePreview || "",
        processedAt: new Date().toISOString(),
      }));

    const targetSlot = targetInstallments.find((t) => t.id === chq.installmentId);
    return validateChequeItem(mappedItem, otherItems, cheques, targetSlot);
  };

  // Handle Multi-file, Multi-page PDF, or Multi-cheque Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Reset input immediately so selecting the exact same file in a future click triggers onChange
    e.target.value = "";

    setIsProcessingOcr(true);
    setOcrProgressText(
      isAr
        ? `جاري فحص وتجهيز ${files.length} مستند/ملف...`
        : `Inspecting and preparing ${files.length} document(s)...`
    );

    try {
      const allInputs: DocumentProcessingInput[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

        if (isPdf) {
          setOcrProgressText(
            isAr
              ? `معالجة مستند PDF (${i + 1}/${files.length}): ${file.name}...`
              : `Processing PDF (${i + 1}/${files.length}): ${file.name}...`
          );

          const pdfResult = await PdfIngestionService.ingestPdfForChequeBatch(
            file,
            {
              contractId: leaseId,
              entityType: propertyId ? "PROPERTY" : "LEASE",
              entityId: leaseId || propertyId || "BATCH",
              uploadedBy: currentUser?.nameAr || currentUser?.username,
            },
            (msg) => setOcrProgressText(msg)
          );

          allInputs.push(...pdfResult.documentInputs);
        } else {
          setOcrProgressText(
            isAr
              ? `قراءة وتحليل الصورة (${i + 1}/${files.length}): ${file.name}...`
              : `Reading & segmenting image (${i + 1}/${files.length}): ${file.name}...`
          );

          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          try {
            const segRes = await MultiChequeSegmenter.segmentMultiChequeImage(dataUrl, {
              minChequesExpected: 1,
              maxChequesExpected: 4,
            });

            if (segRes.success && segRes.cheques && segRes.cheques.length > 0) {
              segRes.cheques.forEach((chq, sIdx) => {
                allInputs.push({
                  sourceType: "FILE_UPLOAD",
                  fileName: `${file.name} - شيك ${sIdx + 1}`,
                  mimeType: file.type || "image/jpeg",
                  imageBase64: chq.croppedDataUrl,
                  originalSourceDataUrl: dataUrl,
                  croppedRegion: chq.bounds,
                });
              });
            } else {
              allInputs.push({
                sourceType: "FILE_UPLOAD",
                fileName: file.name,
                mimeType: file.type || "image/jpeg",
                imageBase64: dataUrl,
                originalSourceDataUrl: dataUrl,
              });
            }
          } catch (segErr) {
            console.warn("MultiChequeSegmenter upload fallback:", segErr);
            allInputs.push({
              sourceType: "FILE_UPLOAD",
              fileName: file.name,
              mimeType: file.type || "image/jpeg",
              imageBase64: dataUrl,
              originalSourceDataUrl: dataUrl,
            });
          }
        }
      }

      if (allInputs.length === 0) {
        alert(isAr ? "لم يتم العثور على مستندات صالحة للمسح." : "No valid documents found to scan.");
        return;
      }

      setOcrProgressText(isAr ? `بدء استخراج الشيكات بالذكاء الاصطناعي...` : `Extracting cheques with AI OCR...`);
      const batchRes = await DocumentSessionService.processBatch(
        allInputs,
        currentSession || undefined,
        cheques,
        availableInstallments,
        (msg) => setOcrProgressText(msg)
      );

      if (batchRes.items.length > 0) {
        stageProcessedItems(batchRes.items, files.length, stagedCheques.length > 0);
      } else {
        alert(
          isAr
            ? "تعذر استخراج بيانات الشيكات آلياً. يمكنك إضافة الشيكات يدوياً."
            : "Could not extract cheque data automatically. You can add them manually."
        );
      }
    } catch (err: any) {
      console.error("Batch OCR upload error:", err);
      alert(
        isAr
          ? `حدث خطأ أثناء معالجة المسح: ${err.message || ""}`
          : `Batch OCR processing error: ${err.message || ""}`
      );
    } finally {
      setIsProcessingOcr(false);
      setOcrProgressText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle Hardware Scanner Capture (Single Page)
  const handleHardwareScanComplete = async (imageBase64: string, mimeType: string) => {
    setIsHardwareScannerOpen(false);
    setIsProcessingOcr(true);
    setOcrProgressText(isAr ? "جاري قراءة صورة الماسح الضوئي بالذكاء الاصطناعي..." : "Processing hardware scan with AI OCR...");

    try {
      const input: DocumentProcessingInput = {
        sourceType: "HARDWARE_SCANNER",
        fileName: `scanner-${Date.now()}.jpg`,
        mimeType: mimeType || "image/jpeg",
        imageBase64,
        originalSourceDataUrl: imageBase64,
      };

      const res = await DocumentSessionService.processSingleDocument(
        input,
        currentSession || undefined,
        [],
        cheques,
        availableInstallments[stagedCheques.length]
      );

      if (res.item) {
        stageProcessedItems([res.item], 1, stagedCheques.length > 0);
      }
    } catch (err: any) {
      console.error("Hardware scan OCR error:", err);
      alert(isAr ? `فشل المسح: ${err.message || ""}` : `Scan failed: ${err.message || ""}`);
    } finally {
      setIsProcessingOcr(false);
      setOcrProgressText("");
    }
  };

  // Handle Hardware Scanner ADF Multi-Page Batch Capture
  const handleHardwareBatchScanComplete = async (pages: { imageBase64: string; mimeType: string }[]) => {
    setIsHardwareScannerOpen(false);
    if (!pages || pages.length === 0) return;

    setIsProcessingOcr(true);
    setOcrProgressText(
      isAr
        ? `جاري معالجة ${pages.length} شيكات مسحوبة من وحدة التغذية (ADF) بالذكاء الاصطناعي...`
        : `Processing ${pages.length} cheques scanned from ADF with AI OCR...`
    );

    try {
      const inputs: DocumentProcessingInput[] = pages.map((p, idx) => ({
        sourceType: "HARDWARE_SCANNER",
        fileName: `feeder-scan-${Date.now()}-page-${idx + 1}.jpg`,
        mimeType: p.mimeType || "image/jpeg",
        imageBase64: p.imageBase64,
        originalSourceDataUrl: p.imageBase64,
      }));

      const batchRes = await DocumentSessionService.processBatch(
        inputs,
        currentSession || undefined,
        cheques,
        availableInstallments.slice(stagedCheques.length),
        (msg: string) => setOcrProgressText(msg)
      );

      if (batchRes.items.length > 0) {
        stageProcessedItems(batchRes.items, pages.length, stagedCheques.length > 0);
      }
    } catch (err: any) {
      console.error("Hardware batch scan OCR error:", err);
      alert(isAr ? `فشل مسح الدفعة: ${err.message || ""}` : `Batch scan failed: ${err.message || ""}`);
    } finally {
      setIsProcessingOcr(false);
      setOcrProgressText("");
    }
  };

  // Re-scan individual cheque file replacement
  const handleSingleRescan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !singleScanTargetId) return;

    const file = files[0];
    e.target.value = "";

    setIsProcessingOcr(true);
    setOcrProgressText(isAr ? "جاري إعادة مسح الشيك المحدد..." : "Rescanning selected cheque...");

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const existing = stagedCheques.find((s) => s.id === singleScanTargetId);
      const targetSlot = targetInstallments.find((t) => t.id === existing?.installmentId);

      const input: DocumentProcessingInput = {
        temporaryId: existing?.temporaryId || singleScanTargetId,
        sourceType: "SINGLE_RESCAN",
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        imageBase64: base64,
        originalSourceDataUrl: base64,
        existingCorrections: existing?.manualCorrections,
        isManuallyEdited: existing?.isManuallyEdited,
      };

      const res = await DocumentSessionService.processSingleDocument(
        input,
        currentSession || undefined,
        [],
        cheques,
        targetSlot
      );

      setStagedCheques((prev) =>
        prev.map((item) => {
          if (item.id === singleScanTargetId) {
            const updated: StagedBatchCheque = {
              ...item,
              chequeNumber: res.item.normalizedData.chequeNumber || item.chequeNumber,
              bankName: res.item.normalizedData.bankName || item.bankName,
              amount: res.item.normalizedData.amount > 0 ? res.item.normalizedData.amount : item.amount,
              dueDate: res.item.normalizedData.dueDate || item.dueDate,
              drawerName: res.item.normalizedData.drawerName || item.drawerName,
              imagePreview: base64,
              confidence: res.item.confidence || 0.95,
              originalOcrAmount: res.item.originalOcrData?.amount,
              originalOcrChequeNumber: res.item.originalOcrData?.chequeNumber,
              originalOcrDueDate: res.item.originalOcrData?.dueDate,
              originalOcrBankName: res.item.originalOcrData?.bankName,
            };
            const v = revalidateCheque(updated, prev);
            return {
              ...updated,
              validationStatus: v.status,
              validationNotes: v.notes,
              duplicateLevel: v.duplicateLevel,
            };
          }
          return item;
        })
      );
    } catch (err: any) {
      console.error("Single rescan failed:", err);
      alert(isAr ? "فشل إعادة مسح الشيك" : "Failed to rescan cheque");
    } finally {
      setIsProcessingOcr(false);
      setOcrProgressText("");
      setSingleScanTargetId(null);
      if (singleFileInputRef.current) singleFileInputRef.current.value = "";
    }
  };

  // Manual field edit in staging (Protected from overwrite)
  const handleUpdateStagedField = (
    id: string,
    field: keyof StagedBatchCheque,
    value: any
  ) => {
    setStagedCheques((prev) => {
      const updatedList = prev.map((item) => {
        if (item.id === id) {
          const corrections = {
            ...(item.manualCorrections || {}),
            [field]: value,
          };
          return {
            ...item,
            [field]: value,
            isManuallyEdited: true,
            manualCorrections: corrections,
          };
        }
        return item;
      });

      return updatedList.map((chq) => {
        const v = revalidateCheque(chq, updatedList);
        return {
          ...chq,
          validationStatus: v.status,
          validationNotes: v.notes,
          duplicateLevel: v.duplicateLevel,
        };
      });
    });
  };

  // Handle Installment Assignment Change
  const handleReassignInstallment = (chqId: string, installmentId: string) => {
    const targetInst = targetInstallments.find((t) => t.id === installmentId);
    setStagedCheques((prev) => {
      const updatedList = prev.map((item) => {
        if (item.id === chqId) {
          return {
            ...item,
            installmentId: targetInst?.id,
            installmentIndex: targetInst?.installmentNumber,
            originalInstallmentAmount: targetInst?.amount,
            originalInstallmentDueDate: targetInst?.dueDate,
            isManuallyEdited: true,
          };
        }
        return item;
      });

      return updatedList.map((chq) => {
        const v = revalidateCheque(chq, updatedList);
        return {
          ...chq,
          validationStatus: v.status,
          validationNotes: v.notes,
          duplicateLevel: v.duplicateLevel,
        };
      });
    });
  };

  // Add empty manual cheque row to staging
  const handleAddManualRow = () => {
    const nextIdx = stagedCheques.length + 1;
    const nextInstallment = availableInstallments[stagedCheques.length];
    const newId = `manual-staged-${Date.now()}`;

    const newRow: StagedBatchCheque = {
      id: newId,
      temporaryId: newId,
      installmentId: nextInstallment?.id,
      installmentIndex: nextInstallment ? nextInstallment.installmentNumber : nextIdx,
      chequeNumber: "",
      bankName: "",
      amount: nextInstallment?.amount || 0,
      originalInstallmentAmount: nextInstallment?.amount,
      chequeDate: nextInstallment?.dueDate || new Date().toISOString().split("T")[0],
      originalInstallmentDueDate: nextInstallment?.dueDate,
      dueDate: nextInstallment?.dueDate || new Date().toISOString().split("T")[0],
      drawerName: defaultDrawerName || "",
      confidence: 1.0,
      status: "POST_DATED",
      validationStatus: "MISSING_INFO",
      validationNotes: isAr ? "بانتظار إدخال رقم الشيك والبنك" : "Waiting for cheque number and bank",
      duplicateLevel: "NONE",
      isManuallyEdited: true,
      sessionId: currentSession?.sessionId,
    };

    setStagedCheques((prev) => [...prev, newRow]);
  };

  // Remove row from staging
  const handleRemoveRow = (id: string) => {
    setStagedCheques((prev) => prev.filter((item) => item.id !== id));
  };

  // Move surplus unassigned cheque into active staging
  const handleAssignSurplus = (surplusId: string) => {
    const item = unassignedCheques.find((u) => u.id === surplusId);
    if (!item) return;

    setUnassignedCheques((prev) => prev.filter((u) => u.id !== surplusId));
    setStagedCheques((prev) => [...prev, { ...item, installmentIndex: prev.length + 1 }]);
  };

  // Clear current batch and start completely fresh
  const handleClearBatch = () => {
    if (stagedCheques.length > 0) {
      const confirmClear = confirm(isAr ? "هل ترغب بإعادة تعيين كافة الشيكات الممسوحة والبدء من جديد؟" : "Clear all staged cheques and start over?");
      if (!confirmClear) return;
    }
    setStagedCheques([]);
    setUnassignedCheques([]);
    setUploadedFilesCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (singleFileInputRef.current) singleFileInputRef.current.value = "";
  };

  // Final Commit / Approve (Atomic, with double-submit protection & archive idempotency)
  const handleConfirmAndSave = async () => {
    if (stagedCheques.length === 0) {
      alert(isAr ? "لا توجد شيكات ممسوحة للاعتماد." : "No cheques staged to approve.");
      return;
    }

    const invalidCheques = stagedCheques.filter((c) => c.validationStatus !== "VALID");
    if (invalidCheques.length > 0) {
      const confirmForce = confirm(
        isAr
          ? "توجد شيكات تحتوي على ملاحظات تدقيق أو عدم تطابق تواريخ/مبالغ. هل ترغب بالاستمرار والاعتماد بهذه البيانات المعدلة؟"
          : "Some cheques have validation warnings or date/amount mismatches. Do you wish to proceed and commit with current values?"
      );
      if (!confirmForce) return;
    }

    setIsSubmitting(true);
    try {
      // Archive images safely and idempotently
      for (const chq of stagedCheques) {
        if (chq.imagePreview && chq.imagePreview.startsWith("data:") && !chq.sourcePdfId) {
          try {
            await DocumentStorageService.uploadAndArchive(chq.imagePreview, {
              category: "CHEQUES",
              entityType: propertyId ? "PROPERTY" : "TENANT",
              entityId: propertyId || tenantId || "sys",
              fileName: `batch-cheque-${chq.chequeNumber || chq.id}.jpg`,
              mimeType: "image/jpeg",
              description: isAr
                ? `شيك دفعة ممسوح بالذكاء الاصطناعي #${chq.chequeNumber || chq.id}`
                : `AI Batch Scanned Cheque #${chq.chequeNumber || chq.id}`,
              uploadedByUserId: currentUser?.id || "u-1",
              uploadedByName: currentUser?.nameAr || currentUser?.username || "المسؤول",
              tags: ["cheque", "batch_ocr", "financial"],
            });
          } catch (archiveErr) {
            console.warn("Archive upload notice:", archiveErr);
          }
        }
      }

      await onApproveBatch(stagedCheques);
      onClose();
    } catch (err: any) {
      console.error("Failed to commit batch cheques:", err);
      alert(
        isAr
          ? `فشل اعتماد الشيكات: ${err.message || ""}`
          : `Failed to commit cheques: ${err.message || ""}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const detectedCount = stagedCheques.length + unassignedCheques.length;
  const targetCount = availableInstallments.length > 0 ? availableInstallments.length : detectedCount;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          isAr
            ? "المسح الذكي لمجموعة الشيكات دفعة واحدة (Multi-Check Batch OCR / PDF / Scanner)"
            : "Multi-Check Batch OCR & PDF Auto-Assignment"
        }
        subtitle={
          isAr
            ? "مسح وفصل مجموعة شيكات العقد تلقائياً (صور أو ملف PDF متعدد الصفحات)، والترتيب والتوزيع الذكي"
            : "Automated multi-cheque detection, PDF page rendering, chronological sorting, and installment mapping"
        }
        icon={<Layers className="w-5 h-5 text-purple-600" />}
        maxWidth="5xl"
      >
        <div className="space-y-5 text-xs">
          {/* Hidden File Inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <input
            ref={singleFileInputRef}
            type="file"
            accept="image/*"
            onChange={handleSingleRescan}
            className="hidden"
          />

          {/* Upload & Scanner Header */}
          <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-2xl space-y-3 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-black text-sm text-purple-950">
                  <Sparkles className="w-4 h-4 text-purple-600 animate-pulse" />
                  <span>
                    {isAr ? "مسح وقراءة شيكات الدفعات دفعة واحدة:" : "Scan & Read Cheques Batch:"}
                  </span>
                  {detectedCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-200 text-purple-900 font-mono font-bold text-xs">
                      {isAr ? `تم التعرف: ${detectedCount} / ${targetCount}` : `Detected: ${detectedCount} / ${targetCount}`}
                    </span>
                  )}
                </div>
                <p className="text-purple-900/80 text-[11px] leading-relaxed">
                  {isAr
                    ? "يدعم المسح المباشر من ماسح HP الضوئي، أو رفع ملف PDF متعدد الصفحات، أو صور الشيكات المجمعة. يتم التعرف الذكي عليها وفصل الصفحات وحفظ ملف PDF الأصلي في الأرشيف."
                    : "Supports HP Hardware Scanner (ADF), multi-page PDF documents, or batch cheque images. AI extracts, sorts, maps installments, and preserves original PDF in archive."}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {/* Hardware Scanner Trigger */}
                <button
                  type="button"
                  disabled={isProcessingOcr}
                  onClick={() => setIsHardwareScannerOpen(true)}
                  className="px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Scan className="w-4 h-4" />
                  <span>{isAr ? "📷 مسح من الطابعة (Scanner)" : "📷 Hardware Scan"}</span>
                </button>

                {/* File Upload Trigger */}
                <button
                  type="button"
                  disabled={isProcessingOcr}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>
                    {stagedCheques.length > 0
                      ? (isAr ? "رفع ملفات إضافية / PDF" : "Upload Additional / PDF")
                      : (isAr ? "رفع صور / ملف PDF للشيكات" : "Upload Cheques / PDF")}
                  </span>
                </button>

                {/* Clear / Reset Trigger */}
                {stagedCheques.length > 0 && (
                  <button
                    type="button"
                    disabled={isProcessingOcr}
                    onClick={handleClearBatch}
                    className="px-3 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold flex items-center gap-1 cursor-pointer transition-all"
                    title={isAr ? "إعادة تعيين وبدء مسح جديد" : "Clear & Start Over"}
                  >
                    <RotateCcw className="w-4 h-4 text-slate-600" />
                    <span>{isAr ? "إعادة ضبط" : "Reset"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Loading Indicator */}
            {isProcessingOcr && (
              <div className="p-3 bg-white rounded-xl border border-purple-200 flex items-center gap-2.5 text-purple-950 font-bold animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-purple-700" />
                <span>{ocrProgressText || (isAr ? "جاري المعالجة والتعرف..." : "Processing OCR...")}</span>
              </div>
            )}
          </div>

          {/* Staging Review Table */}
          {stagedCheques.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-slate-700" />
                  <h4 className="font-black text-slate-900 text-sm">
                    {isAr ? "جدول مراجعة وتأكيد الشيكات الممسوحة:" : "Staged Cheques Review Table:"}
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono">
                    ({stagedCheques.length} {isAr ? "شيكات معتمدة" : "cheques"})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddManualRow}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-700" />
                    <span>{isAr ? "+ إضافة شيك يدوياً" : "+ Add Manual Cheque"}</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
                <table className="w-full text-start border-collapse bg-white">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                      <th className="p-2.5 text-center w-16">{isAr ? "الدفعة" : "Inst #"}</th>
                      <th className="p-2.5 text-start">{isAr ? "المصدر" : "Source"}</th>
                      <th className="p-2.5 text-start">{isAr ? "رقم الشيك" : "Cheque #"}</th>
                      <th className="p-2.5 text-start">{isAr ? "اسم البنك" : "Bank"}</th>
                      <th className="p-2.5 text-start">{isAr ? "المبلغ (درهم)" : "Amount (AED)"}</th>
                      <th className="p-2.5 text-start">{isAr ? "تاريخ الاستحقاق" : "Due Date"}</th>
                      <th className="p-2.5 text-start">{isAr ? "اسم الساحب" : "Drawer"}</th>
                      <th className="p-2.5 text-center">{isAr ? "الحالة الفعلية" : "Status"}</th>
                      <th className="p-2.5 text-start">{isAr ? "المطابقة والتحقق" : "Validation"}</th>
                      <th className="p-2.5 text-center w-24">{isAr ? "إجراءات" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {stagedCheques.map((chq, index) => {
                      const isMismatched = chq.validationStatus === "AMOUNT_MISMATCH" || chq.validationStatus === "DATE_MISMATCH";
                      const isDup = chq.validationStatus === "DUPLICATE";
                      const isMissing = chq.validationStatus === "MISSING_INFO";

                      return (
                        <tr
                          key={chq.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isDup
                              ? "bg-rose-50/50"
                              : isMismatched
                              ? "bg-amber-50/40"
                              : isMissing
                              ? "bg-slate-50/60"
                              : ""
                          }`}
                        >
                          {/* Installment Assignment Selector */}
                          <td className="p-2.5 text-center font-mono font-bold text-slate-600">
                            {targetInstallments.length > 0 ? (
                              <select
                                value={chq.installmentId || ""}
                                onChange={(e) => handleReassignInstallment(chq.id, e.target.value)}
                                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                              >
                                <option value="">#{chq.installmentIndex || index + 1}</option>
                                {targetInstallments.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    #{t.installmentNumber} ({t.amount.toLocaleString()} AED)
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-950 inline-flex items-center justify-center">
                                {chq.installmentIndex || index + 1}
                              </span>
                            )}
                          </td>

                          {/* Source Tracing Badge */}
                          <td className="p-2.5">
                            {chq.isPdfSource ? (
                              <span
                                className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 font-mono text-[10px] inline-flex items-center gap-1"
                                title={`PDF: ${chq.sourcePdfFileName || "document.pdf"}`}
                              >
                                <FileText className="w-3 h-3 text-blue-600 shrink-0" />
                                <span>ص {chq.pageNumber || 1}</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] inline-flex items-center gap-1">
                                <Camera className="w-3 h-3 text-slate-500 shrink-0" />
                                <span>{isAr ? "صورة" : "Image"}</span>
                              </span>
                            )}
                          </td>

                          {/* Cheque Number */}
                          <td className="p-2.5">
                            <div className="space-y-0.5">
                              <input
                                type="text"
                                value={chq.chequeNumber}
                                onChange={(e) => handleUpdateStagedField(chq.id, "chequeNumber", e.target.value)}
                                placeholder="000123"
                                className="w-28 px-2 py-1.5 font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-purple-500"
                              />
                              {chq.isManuallyEdited && (
                                <span className="block text-[9px] text-amber-800 font-semibold">
                                  {isAr ? "معدل يدوياً" : "Edited"}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Bank */}
                          <td className="p-2.5 min-w-[170px]">
                            <select
                              value={chq.bankName}
                              onChange={(e) => handleUpdateStagedField(chq.id, "bankName", e.target.value)}
                              className="w-full px-2 py-1.5 font-bold bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-purple-500 text-xs"
                            >
                              <option value="">{isAr ? "-- اختر البنك --" : "-- Select Bank --"}</option>
                              {uaeBanks.map((b) => (
                                <option key={b.code} value={isAr ? b.nameAr : b.nameEn}>
                                  {isAr ? b.nameAr : b.nameEn}
                                </option>
                              ))}
                              {chq.bankName && !uaeBanks.some((b) => b.nameAr === chq.bankName || b.nameEn === chq.bankName) && (
                                <option value={chq.bankName}>{chq.bankName}</option>
                              )}
                            </select>
                          </td>

                          {/* Amount */}
                          <td className="p-2.5">
                            <input
                              type="number"
                              value={chq.amount}
                              onChange={(e) => handleUpdateStagedField(chq.id, "amount", parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1.5 font-mono font-black text-amber-800 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-purple-500"
                            />
                          </td>

                          {/* Due Date */}
                          <td className="p-2.5">
                            <input
                              type="date"
                              value={chq.dueDate}
                              onChange={(e) => handleUpdateStagedField(chq.id, "dueDate", e.target.value)}
                              className="px-2 py-1.5 font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-purple-500"
                            />
                          </td>

                          {/* Drawer Name */}
                          <td className="p-2.5 min-w-[140px]">
                            <input
                              type="text"
                              value={chq.drawerName}
                              onChange={(e) => handleUpdateStagedField(chq.id, "drawerName", e.target.value)}
                              placeholder={isAr ? "اسم الساحب" : "Drawer Name"}
                              className="w-full px-2 py-1.5 font-bold bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-purple-500"
                            />
                          </td>

                          {/* Real System Status */}
                          <td className="p-2.5 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                              POST_DATED
                            </span>
                          </td>

                          {/* Validation Status */}
                          <td className="p-2.5">
                            {chq.validationStatus === "VALID" && (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{isAr ? "مطابق وجاهز" : "Valid"}</span>
                              </span>
                            )}
                            {chq.validationStatus === "AMOUNT_MISMATCH" && (
                              <span className="inline-flex items-center gap-1 text-amber-800 font-bold text-[10px]" title={chq.validationNotes}>
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>{isAr ? "مبلغ مختلف" : "Amount Mismatch"}</span>
                              </span>
                            )}
                            {chq.validationStatus === "DATE_MISMATCH" && (
                              <span className="inline-flex items-center gap-1 text-indigo-800 font-bold text-[10px]" title={chq.validationNotes}>
                                <AlertCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <span>{isAr ? "تاريخ مختلف" : "Date Mismatch"}</span>
                              </span>
                            )}
                            {chq.validationStatus === "DUPLICATE" && (
                              <span className="inline-flex items-center gap-1 text-rose-700 font-bold text-[10px]" title={chq.validationNotes}>
                                <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span>{isAr ? "مشتبه بالتكرار" : "Duplicate"}</span>
                              </span>
                            )}
                            {chq.validationStatus === "MISSING_INFO" && (
                              <span className="inline-flex items-center gap-1 text-slate-600 font-bold text-[10px]" title={chq.validationNotes}>
                                <HelpCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span>{isAr ? "بيانات ناقصة" : "Incomplete"}</span>
                              </span>
                            )}
                            {chq.validationStatus === "NEEDS_REVIEW" && (
                              <span className="inline-flex items-center gap-1 text-orange-700 font-bold text-[10px]" title={chq.validationNotes}>
                                <AlertTriangle className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                                <span>{isAr ? "مراجعة ضرورية" : "Needs Review"}</span>
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Re-scan Single */}
                              <button
                                type="button"
                                title={isAr ? "إعادة مسح هذا الشيك بمفرده" : "Rescan this single cheque"}
                                onClick={() => {
                                  setSingleScanTargetId(chq.id);
                                  singleFileInputRef.current?.click();
                                }}
                                className="p-1 text-slate-600 hover:text-purple-700 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>

                              {/* View image */}
                              {chq.imagePreview && (
                                <button
                                  type="button"
                                  title={isAr ? "عرض صورة الشيك" : "View Cheque Image"}
                                  onClick={() => setPreviewImage(chq.imagePreview || null)}
                                  className="p-1 text-slate-600 hover:text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Delete */}
                              <button
                                type="button"
                                title={isAr ? "حذف من الدفعة" : "Remove from batch"}
                                onClick={() => handleRemoveRow(chq.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Total Summary Bar */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-700">
                <div className="flex items-center gap-3">
                  <span>
                    {isAr ? "إجمالي عدد الشيكات:" : "Total Cheques:"}{" "}
                    <strong className="text-slate-900 font-mono">{stagedCheques.length}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    {isAr ? "إجمالي المبلغ:" : "Total Amount:"}{" "}
                    <strong className="text-amber-900 font-mono">
                      {stagedCheques.reduce((sum, c) => sum + (c.amount || 0), 0).toLocaleString()} AED
                    </strong>
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 font-normal">
                  {isAr
                    ? "✓ كافة التعديلات تبقى محلياً حتى تضغط على زر الاعتماد والحفظ."
                    : "✓ All changes remain in staging until you confirm and commit."}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-300 rounded-2xl space-y-3">
              <Layers className="w-10 h-10 text-purple-400 mx-auto" />
              <div className="text-slate-700 font-bold">
                {isAr ? "لم يتم رفع أو مسح أي شيكات بعد" : "No cheques uploaded or scanned yet"}
              </div>
              <p className="text-slate-500 text-xs max-w-md mx-auto">
                {isAr
                  ? "اضغط على زر (مسح من الطابعة) أو (رفع صور / ملف PDF للشيكات) للبدء في قراءة الشيكات بالذكاء الاصطناعي."
                  : "Click Hardware Scan or Upload Cheques/PDF to start scanning documents with AI OCR."}
              </p>
            </div>
          )}

          {/* Surplus Unassigned Cheques Section (Zero Data Loss) */}
          {unassignedCheques.length > 0 && (
            <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-amber-950 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>
                  {isAr
                    ? `شيكات إضافية غير معينة (${unassignedCheques.length} شيكات زائدة عن عدد الأقساط المتوقعة):`
                    : `Unassigned Surplus Cheques (${unassignedCheques.length} cheques beyond open installments):`}
                </span>
              </div>
              <p className="text-amber-800 text-[11px]">
                {isAr
                  ? "تم اكتشاف شيكات إضافية في الصورة تفوق عدد الأقساط المتاحة. لم يتم فقدان أي نتيجة، يمكنك تعيينها أو ضمها للجدول:"
                  : "Additional cheques were extracted beyond the open slots. No results were lost; you can review or append them:"}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {unassignedCheques.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white rounded-xl border border-amber-200 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div>
                      <div className="font-mono font-bold text-slate-900">
                        #{item.chequeNumber || (isAr ? "بدون رقم" : "No Number")} • {item.amount.toLocaleString()} AED
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {item.bankName} | {item.dueDate}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAssignSurplus(item.id)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] cursor-pointer"
                    >
                      {isAr ? "ضم للجدول" : "Append"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Image Preview Modal inside Batch */}
          {previewImage && (
            <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
              <div className="bg-white rounded-2xl max-w-2xl w-full p-4 space-y-3 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-900">{isAr ? "معاينة صورة الشيك" : "Cheque Image Preview"}</span>
                  <button
                    type="button"
                    onClick={() => setPreviewImage(null)}
                    className="p-1 text-slate-500 hover:text-slate-800 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-950 rounded-xl p-2">
                  <img
                    src={previewImage}
                    alt="Cheque Preview"
                    className="max-h-[65vh] w-auto object-contain rounded-lg"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <div className="text-[11px] text-slate-500">
              {isAr
                ? "🔒 لن يتم إحداث أي قيد مالي أو تعديل في قاعدة البيانات إلا بعد ضغط زر الاعتماد والحفظ."
                : "🔒 No database or financial records are touched until you commit."}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>

              <button
                type="button"
                disabled={isSubmitting || stagedCheques.length === 0}
                onClick={handleConfirmAndSave}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-xl font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{isAr ? "جاري الاعتماد والحفظ..." : "Committing..."}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>
                      {isAr
                        ? `اعتماد وحفظ (${stagedCheques.length}) شيكات الآن`
                        : `Approve & Commit (${stagedCheques.length}) Cheques`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Hardware Scanner Modal embedded */}
      <ScannerModal
        isOpen={isHardwareScannerOpen}
        onClose={() => setIsHardwareScannerOpen(false)}
        onScanComplete={handleHardwareScanComplete}
        onBatchScanComplete={handleHardwareBatchScanComplete}
        documentType="BATCH_CHEQUES"
      />
    </>
  );
};

export default BatchChequeOcrModal;
