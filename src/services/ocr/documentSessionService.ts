// src/services/ocr/documentSessionService.ts
/**
 * Authoritative Document Processing Session & Ingestion Pipeline
 * Guarantees determinism across single scans, batch uploads, PDF pages, and modal reopen cycles.
 */

import { OCRService, OcrExtractionResult } from "./ocrEngine";
import { ImageProcessor, OcrPreprocessOptions } from "./imageProcessor";
import { normalizeChequeOCR, NormalizedChequeOCRResult } from "../../utils/ocrChequeMapper";
import { Cheque } from "../../types";

export type DocumentSourceType = "HARDWARE_SCANNER" | "FILE_UPLOAD" | "PDF_PAGE" | "SINGLE_RESCAN";

export interface DocumentProcessingInput {
  temporaryId?: string;
  sourceType: DocumentSourceType;
  fileName: string;
  mimeType: string;
  imageBase64: string; // Clean or DataURL
  originalSourceDataUrl?: string;
  sourcePdfId?: string;
  pageNumber?: number;
  croppedRegion?: { x: number; y: number; width: number; height: number };
  existingCorrections?: Partial<NormalizedChequeOCRResult>;
  isManuallyEdited?: boolean;
}

export type ValidationStatus =
  | "VALID"
  | "AMOUNT_MISMATCH"
  | "DATE_MISMATCH"
  | "DUPLICATE"
  | "MISSING_INFO"
  | "NEEDS_REVIEW";

export type DuplicateLevel = "EXACT" | "PROBABLE" | "POSSIBLE" | "NONE";

export interface ProcessedDocumentItem {
  temporaryId: string;
  sequence: number;
  sourceFileName: string;
  sourceMimeType: string;
  sourcePdfId?: string;
  pageNumber?: number;
  croppedRegion?: { x: number; y: number; width: number; height: number };
  processingStatus: "PENDING" | "PROCESSING" | "COMPLETED" | "REVIEW_REQUIRED" | "FAILED";
  retryCount: number;
  ocrAttempt: number;
  validationStatus: ValidationStatus;
  validationNotes?: string;
  duplicateLevel: DuplicateLevel;
  confidence: number;
  error?: string;
  rawOcrData?: any;
  normalizedData: NormalizedChequeOCRResult;
  originalOcrData?: NormalizedChequeOCRResult;
  isManuallyEdited: boolean;
  manualCorrections?: Partial<NormalizedChequeOCRResult>;
  imagePreview: string;
  originalImage?: string;
  workingOcrImage?: string;
  processedAt: string;
}

export interface DocumentProcessingSession {
  sessionId: string;
  batchId: string;
  createdAt: string;
  sourceType: DocumentSourceType;
  contractId?: string;
  renewalId?: string;
  createdBy: string;
  status: "INITIALIZING" | "PROCESSING" | "STAGED" | "COMMITTED" | "CANCELLED" | "FAILED";
  items: ProcessedDocumentItem[];
}

export interface SingleDocumentProcessingResult {
  success: boolean;
  item: ProcessedDocumentItem;
  error?: string;
}

export interface BatchProcessingResult {
  success: boolean;
  session: DocumentProcessingSession;
  items: ProcessedDocumentItem[];
  totalProcessed: number;
  totalSuccess: number;
  totalReviewRequired: number;
  totalFailed: number;
}

/**
 * Validates a single cheque against existing system cheques and against other items in the batch
 */
export function validateChequeItem(
  item: ProcessedDocumentItem,
  otherBatchItems: ProcessedDocumentItem[] = [],
  existingSystemCheques: Cheque[] = [],
  targetInstallment?: { amount?: number; dueDate?: string }
): { status: ValidationStatus; notes?: string; duplicateLevel: DuplicateLevel } {
  const norm = item.normalizedData;
  const num = (norm.chequeNumber || "").trim();

  // 1. Missing Cheque Number
  if (!num) {
    return {
      status: "MISSING_INFO",
      notes: "رقم الشيك مفقود أو غير مقروء بوضوح",
      duplicateLevel: "NONE",
    };
  }

  // 2. Missing or zero amount
  if (!norm.amount || norm.amount <= 0) {
    return {
      status: "NEEDS_REVIEW",
      notes: "مبلغ الشيك مفقود أو غير مقروء",
      duplicateLevel: "NONE",
    };
  }

  // 3. Exact duplicate in system
  const exactInSystem = existingSystemCheques.find(
    (c) =>
      c.chequeNumber.trim() === num &&
      (c.bankName === norm.bankName || (c.drawerName && c.drawerName === norm.drawerName))
  );
  if (exactInSystem) {
    return {
      status: "DUPLICATE",
      notes: `الشيك مسجل مسبقاً بالنظام مطابقة تامة (#${num})`,
      duplicateLevel: "EXACT",
    };
  }

  // 4. Cheque number matches in system with different bank/drawer
  const numInSystem = existingSystemCheques.find((c) => c.chequeNumber.trim() === num);
  if (numInSystem) {
    return {
      status: "DUPLICATE",
      notes: `رقم الشيك مسجل مسبقاً لدى بنك/ساحب آخر بالنظام (#${num})`,
      duplicateLevel: "PROBABLE",
    };
  }

  // 5. Duplicate within same batch
  const dupInBatch = otherBatchItems.filter(
    (other) =>
      other.temporaryId !== item.temporaryId &&
      other.normalizedData.chequeNumber &&
      other.normalizedData.chequeNumber.trim() === num
  );
  if (dupInBatch.length > 0) {
    return {
      status: "DUPLICATE",
      notes: "رقم الشيك مكرر داخل نفس المجموعة الممسوحة",
      duplicateLevel: "EXACT",
    };
  }

  // 6. Amount mismatch with target installment
  if (
    targetInstallment &&
    targetInstallment.amount !== undefined &&
    targetInstallment.amount > 0 &&
    norm.amount > 0 &&
    Math.abs(norm.amount - targetInstallment.amount) > 0.01
  ) {
    return {
      status: "AMOUNT_MISMATCH",
      notes: `المبلغ المقروء (${norm.amount.toLocaleString()}) يختلف عن مبلغ القسط المحدد (${targetInstallment.amount.toLocaleString()})`,
      duplicateLevel: "NONE",
    };
  }

  // 7. Date mismatch with target installment
  if (
    targetInstallment &&
    targetInstallment.dueDate &&
    norm.dueDate &&
    norm.dueDate !== targetInstallment.dueDate
  ) {
    return {
      status: "DATE_MISMATCH",
      notes: `تاريخ استحقاق الشيك (${norm.dueDate}) يختلف عن موعد القسط (${targetInstallment.dueDate})`,
      duplicateLevel: "NONE",
    };
  }

  // 8. Missing bank name or due date
  if (!norm.bankName || !norm.dueDate) {
    return {
      status: "NEEDS_REVIEW",
      notes: "بيانات بنك السحب أو تاريخ الاستحقاق تحتاج إلى مراجعة وتأكيد",
      duplicateLevel: "NONE",
    };
  }

  return { status: "VALID", duplicateLevel: "NONE" };
}

export class DocumentSessionService {
  /**
   * Creates a fresh document processing session.
   */
  static createSession(params: {
    sourceType: DocumentSourceType;
    contractId?: string;
    renewalId?: string;
    createdBy?: string;
  }): DocumentProcessingSession {
    const timestamp = Date.now();
    const randomSuffix = crypto.randomUUID().split("-")[0];
    return {
      sessionId: `sess-${timestamp}-${randomSuffix}`,
      batchId: `batch-${timestamp}-${randomSuffix}`,
      createdAt: new Date().toISOString(),
      sourceType: params.sourceType,
      contractId: params.contractId,
      renewalId: params.renewalId,
      createdBy: params.createdBy || "system",
      status: "INITIALIZING",
      items: [],
    };
  }

  /**
   * One Authoritative Single-Document Pipeline:
   * Input -> Decode -> Normalize -> Preprocess -> OCR -> Normalize OCR -> Validate -> Return Result
   */
  static async processSingleDocument(
    input: DocumentProcessingInput,
    session?: DocumentProcessingSession,
    existingItemsInBatch: ProcessedDocumentItem[] = [],
    existingSystemCheques: Cheque[] = [],
    targetInstallment?: { amount?: number; dueDate?: string }
  ): Promise<SingleDocumentProcessingResult> {
    const temporaryId = input.temporaryId || `doc-item-${Date.now()}-${crypto.randomUUID().split("-")[0]}`;
    const now = new Date().toISOString();

    try {
      // 1. Decode & clean base64
      let cleanBase64 = input.imageBase64.trim();
      let dataUrlPrefix = "";
      if (cleanBase64.startsWith("data:")) {
        const parts = cleanBase64.split(",");
        dataUrlPrefix = parts[0] + ",";
        cleanBase64 = parts[1] || "";
      }
      cleanBase64 = cleanBase64.replace(/[\r\n\s]/g, "");

      if (!cleanBase64) {
        throw new Error("بيانات الصورة فارغة أو غير صالحة للمسح.");
      }

      const fullDataUrl = dataUrlPrefix ? `${dataUrlPrefix}${cleanBase64}` : `data:${input.mimeType || "image/jpeg"};base64,${cleanBase64}`;

      // 2. Preprocess & Normalize Image (Standardized Single-Document Rules)
      let workingOcrBase64 = cleanBase64;
      try {
        const preprocessOptions: OcrPreprocessOptions = {
          applyContrast: true,
          applyNormalization: true,
          applySharpening: true,
          convertToGrayscale: true,
          minWidth: 1600,
        };
        const processed = await ImageProcessor.process(fullDataUrl, preprocessOptions);
        if (processed.includes("base64,")) {
          workingOcrBase64 = processed.split("base64,")[1].replace(/[\r\n\s]/g, "");
        } else {
          workingOcrBase64 = processed;
        }
      } catch (prepErr) {
        console.warn("[DocumentSessionService] Image preprocessing fallback:", prepErr);
      }

      // 3. OCR Request via Authoritative Engine (CHEQUE Profile with Forensic Precision)
      const ocrResult: OcrExtractionResult = await OCRService.extractCheque(
        workingOcrBase64,
        "image/jpeg"
      );

      // 4. Normalize Raw OCR Data
      const rawExtracted = ocrResult.data || {};
      const normalized = normalizeChequeOCR(ocrResult, "ar");

      // 5. Preserve any user-approved manual corrections
      let finalNormalized = { ...normalized };
      if (input.isManuallyEdited && input.existingCorrections) {
        finalNormalized = {
          ...finalNormalized,
          ...input.existingCorrections,
        };
      }

      // 6. Build Staged Document Item
      const documentItem: ProcessedDocumentItem = {
        temporaryId,
        sequence: existingItemsInBatch.length + 1,
        sourceFileName: input.fileName,
        sourceMimeType: input.mimeType,
        sourcePdfId: input.sourcePdfId,
        pageNumber: input.pageNumber,
        croppedRegion: input.croppedRegion,
        processingStatus: ocrResult.success ? "COMPLETED" : "REVIEW_REQUIRED",
        retryCount: 0,
        ocrAttempt: 1,
        validationStatus: "VALID",
        duplicateLevel: "NONE",
        confidence: ocrResult.metadata?.overallConfidence ? ocrResult.metadata.overallConfidence / 100 : 0.85,
        rawOcrData: rawExtracted,
        normalizedData: finalNormalized,
        originalOcrData: normalized,
        isManuallyEdited: Boolean(input.isManuallyEdited),
        manualCorrections: input.existingCorrections,
        imagePreview: fullDataUrl,
        originalImage: input.originalSourceDataUrl || fullDataUrl,
        workingOcrImage: `data:image/jpeg;base64,${workingOcrBase64}`,
        processedAt: now,
      };

      // 7. Validate Staged Item
      const validation = validateChequeItem(
        documentItem,
        existingItemsInBatch,
        existingSystemCheques,
        targetInstallment
      );

      documentItem.validationStatus = validation.status;
      documentItem.validationNotes = validation.notes;
      documentItem.duplicateLevel = validation.duplicateLevel;

      if (!ocrResult.success || validation.status === "NEEDS_REVIEW" || validation.status === "MISSING_INFO") {
        documentItem.processingStatus = "REVIEW_REQUIRED";
      }

      return {
        success: ocrResult.success,
        item: documentItem,
      };
    } catch (err: any) {
      console.error("[DocumentSessionService] Single document processing failed:", err);

      const failedItem: ProcessedDocumentItem = {
        temporaryId,
        sequence: existingItemsInBatch.length + 1,
        sourceFileName: input.fileName,
        sourceMimeType: input.mimeType,
        sourcePdfId: input.sourcePdfId,
        pageNumber: input.pageNumber,
        croppedRegion: input.croppedRegion,
        processingStatus: "FAILED",
        retryCount: 0,
        ocrAttempt: 1,
        validationStatus: "MISSING_INFO",
        validationNotes: err.message || "فشلت قراءة المستند",
        duplicateLevel: "NONE",
        confidence: 0,
        error: err.message || "Failed to process document",
        normalizedData: {
          chequeNumber: "",
          bankName: "",
          amount: 0,
          dueDate: "",
          drawerName: "",
          accountNumber: "",
        },
        isManuallyEdited: false,
        imagePreview: input.imageBase64.startsWith("data:")
          ? input.imageBase64
          : `data:${input.mimeType || "image/jpeg"};base64,${input.imageBase64}`,
        processedAt: now,
      };

      return {
        success: false,
        item: failedItem,
        error: err.message || "Failed to process document",
      };
    }
  }

  /**
   * Process a batch of documents sequentially using the single-document primitive.
   */
  static async processBatch(
    documents: DocumentProcessingInput[],
    session?: DocumentProcessingSession,
    existingSystemCheques: Cheque[] = [],
    targetInstallments: Array<{ amount?: number; dueDate?: string }> = [],
    onProgress?: (progressText: string, current: number, total: number) => void
  ): Promise<BatchProcessingResult> {
    const currentSession = session || this.createSession({ sourceType: "FILE_UPLOAD" });
    currentSession.status = "PROCESSING";

    const stagedItems: ProcessedDocumentItem[] = [];

    for (let i = 0; i < documents.length; i++) {
      const docInput = documents[i];
      const targetInst = targetInstallments[i];

      if (onProgress) {
        onProgress(
          `معالجة المستند (${i + 1}/${documents.length}): ${docInput.fileName}...`,
          i + 1,
          documents.length
        );
      }

      const res = await this.processSingleDocument(
        docInput,
        currentSession,
        stagedItems,
        existingSystemCheques,
        targetInst
      );

      stagedItems.push(res.item);
    }

    currentSession.items = stagedItems;
    currentSession.status = "STAGED";

    const totalSuccess = stagedItems.filter((it) => it.processingStatus === "COMPLETED" && it.validationStatus === "VALID").length;
    const totalReview = stagedItems.filter((it) => it.processingStatus === "REVIEW_REQUIRED").length;
    const totalFailed = stagedItems.filter((it) => it.processingStatus === "FAILED").length;

    return {
      success: totalFailed === 0,
      session: currentSession,
      items: stagedItems,
      totalProcessed: stagedItems.length,
      totalSuccess,
      totalReviewRequired: totalReview,
      totalFailed,
    };
  }

  /**
   * Preserves manual user corrections and protects them from background overwrites.
   */
  static applyManualCorrection(
    session: DocumentProcessingSession,
    temporaryId: string,
    corrections: Partial<NormalizedChequeOCRResult>,
    existingSystemCheques: Cheque[] = [],
    targetInstallments: Array<{ id: string; amount?: number; dueDate?: string }> = []
  ): DocumentProcessingSession {
    const updatedItems = session.items.map((item, idx) => {
      if (item.temporaryId === temporaryId) {
        const updatedNorm: NormalizedChequeOCRResult = {
          ...item.normalizedData,
          ...corrections,
        };

        const updatedItem: ProcessedDocumentItem = {
          ...item,
          normalizedData: updatedNorm,
          isManuallyEdited: true,
          manualCorrections: {
            ...(item.manualCorrections || {}),
            ...corrections,
          },
        };

        const targetInst = targetInstallments[idx];
        const val = validateChequeItem(
          updatedItem,
          session.items.filter((o) => o.temporaryId !== temporaryId),
          existingSystemCheques,
          targetInst
        );

        updatedItem.validationStatus = val.status;
        updatedItem.validationNotes = val.notes;
        updatedItem.duplicateLevel = val.duplicateLevel;
        if (val.status === "VALID") {
          updatedItem.processingStatus = "COMPLETED";
        }
        return updatedItem;
      }
      return item;
    });

    return {
      ...session,
      items: updatedItems,
    };
  }

  /**
   * Retries an item preserving its temporaryId and any manual edits.
   */
  static async retryDocumentItem(
    session: DocumentProcessingSession,
    temporaryId: string,
    existingSystemCheques: Cheque[] = [],
    targetInstallment?: { amount?: number; dueDate?: string }
  ): Promise<SingleDocumentProcessingResult> {
    const existing = session.items.find((it) => it.temporaryId === temporaryId);
    if (!existing) {
      throw new Error(`Item ${temporaryId} not found in current session.`);
    }

    const input: DocumentProcessingInput = {
      temporaryId: existing.temporaryId,
      sourceType: session.sourceType,
      fileName: existing.sourceFileName,
      mimeType: existing.sourceMimeType,
      imageBase64: existing.originalImage || existing.imagePreview,
      originalSourceDataUrl: existing.originalImage,
      sourcePdfId: existing.sourcePdfId,
      pageNumber: existing.pageNumber,
      croppedRegion: existing.croppedRegion,
      existingCorrections: existing.manualCorrections,
      isManuallyEdited: existing.isManuallyEdited,
    };

    const otherItems = session.items.filter((it) => it.temporaryId !== temporaryId);
    const result = await this.processSingleDocument(
      input,
      session,
      otherItems,
      existingSystemCheques,
      targetInstallment
    );

    result.item.retryCount = existing.retryCount + 1;
    result.item.ocrAttempt = existing.ocrAttempt + 1;

    // Update in session
    session.items = session.items.map((it) => (it.temporaryId === temporaryId ? result.item : it));

    return result;
  }
}
