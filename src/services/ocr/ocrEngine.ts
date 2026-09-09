// src/services/ocr/ocrEngine.ts

import { ImageProcessor, OcrPreprocessOptions, ImageQualityMetrics } from "./imageProcessor";
import { safeFetchJson } from "../../utils/safeApiFetch";

// --- Domain Models & Typings ---

export type OcrModelLevel = "fast" | "accurate" | "forensic";

export interface OcrFieldDefinition {
  type: "string" | "number" | "date" | "boolean" | "enum";
  required: boolean;
  validationRegex?: RegExp;
  minConfidenceThreshold?: number; // 0-100
  options?: string[]; // for enums
}

export interface OcrExtractionProfile {
  documentType: string;
  recommendedModel: OcrModelLevel;
  fallbackModel?: OcrModelLevel;
  preprocessingOptions: OcrPreprocessOptions;
  schemaRules: Record<string, OcrFieldDefinition>;
  backendEndpoint: string;
  enableSmartRetry?: boolean;
}

export interface ValidatedOcrField<T = any> {
  value: T | null;
  confidence: number;
  isValid: boolean;
  validationFlags: string[];
}

export interface OcrTraceCheckpoint {
  id: string;
  name: string;
  status: "PASS" | "FAIL" | "SKIPPED";
  latencyMs: number;
  details?: string;
}

export interface OcrExtractionResult {
  success: boolean;
  documentType: string;
  status: "SUCCESS" | "NEEDS_REVIEW" | "FAILED";
  data: Record<string, any>;
  metadata: {
    traceId: string;
    modelLevel: OcrModelLevel;
    processingTimeMs: number;
    overallConfidence: number;
    imageHash?: string;
    source: string;
    cached?: boolean;
    quality?: ImageQualityMetrics;
    checkpoints: OcrTraceCheckpoint[];
    retryAttempted?: boolean;
  };
  fields: Record<string, ValidatedOcrField>;
  rawExtracted?: any;
  warnings?: string[];
  errors?: string[];
  error?: string;
  errorAr?: string;
}

// --- Universal Profiles ---

export const OCR_PROFILES: Record<string, OcrExtractionProfile> = {
  EMIRATES_ID: {
    documentType: "EMIRATES_ID",
    recommendedModel: "accurate",
    fallbackModel: "forensic",
    backendEndpoint: "/api/ocr/extract-document",
    enableSmartRetry: true,
    preprocessingOptions: {
      applyContrast: true,
      applyNormalization: true,
      applySharpening: true,
      convertToGrayscale: true,
      minWidth: 1400,
    },
    schemaRules: {
      emiratesIdNumber: { type: "string", required: true, validationRegex: /^784-\d{4}-\d{7}-\d{1}$/, minConfidenceThreshold: 85 },
      fullName: { type: "string", required: true, minConfidenceThreshold: 70 },
      arabicName: { type: "string", required: false, minConfidenceThreshold: 70 },
      englishName: { type: "string", required: false, minConfidenceThreshold: 70 },
      nationality: { type: "string", required: false, minConfidenceThreshold: 70 },
      dateOfBirth: { type: "date", required: false, minConfidenceThreshold: 75 },
      gender: { type: "enum", required: false, options: ["MALE", "FEMALE"], minConfidenceThreshold: 70 },
      cardNumber: { type: "string", required: false, minConfidenceThreshold: 60 },
      issueDate: { type: "date", required: false, minConfidenceThreshold: 75 },
      expiryDate: { type: "date", required: false, minConfidenceThreshold: 80 },
      documentSide: { type: "enum", required: false, options: ["FRONT", "BACK", "BOTH", "DIGITAL_ID"] },
    },
  },
  CHEQUE: {
    documentType: "CHEQUE",
    recommendedModel: "forensic",
    fallbackModel: "accurate",
    backendEndpoint: "/api/ocr/extract-cheque",
    enableSmartRetry: true,
    preprocessingOptions: {
      applyContrast: true,
      applyNormalization: true,
      applySharpening: true,
      convertToGrayscale: true,
      minWidth: 1600,
    },
    schemaRules: {
      chequeNumber: { type: "string", required: true, validationRegex: /^\d{6,10}$/, minConfidenceThreshold: 85 },
      bankName: { type: "string", required: true, minConfidenceThreshold: 75 },
      amountNumeric: { type: "number", required: true, minConfidenceThreshold: 85 },
      amount: { type: "number", required: false, minConfidenceThreshold: 85 },
      amountInWords: { type: "string", required: false, minConfidenceThreshold: 60 },
      chequeDate: { type: "date", required: true, minConfidenceThreshold: 75 },
      dueDate: { type: "date", required: false, minConfidenceThreshold: 75 },
      payeeName: { type: "string", required: false, minConfidenceThreshold: 60 },
      drawerName: { type: "string", required: false, minConfidenceThreshold: 60 },
      accountNumber: { type: "string", required: false, minConfidenceThreshold: 60 },
      iban: { type: "string", required: false, minConfidenceThreshold: 70 },
      isBounced: { type: "boolean", required: false },
      signatureDetected: { type: "boolean", required: false },
    },
  },
  LEASE_AGREEMENT: {
    documentType: "LEASE_AGREEMENT",
    recommendedModel: "fast",
    fallbackModel: "accurate",
    backendEndpoint: "/api/ocr/extract-document",
    enableSmartRetry: true,
    preprocessingOptions: {
      applyContrast: true,
      applyNormalization: true,
      convertToGrayscale: true,
      applySharpening: false,
      minWidth: 1400,
    },
    schemaRules: {
      tenantName: { type: "string", required: true, minConfidenceThreshold: 70 },
      landlordName: { type: "string", required: false, minConfidenceThreshold: 70 },
      contractNumber: { type: "string", required: false, minConfidenceThreshold: 70 },
      contractStartDate: { type: "date", required: true, minConfidenceThreshold: 75 },
      contractEndDate: { type: "date", required: true, minConfidenceThreshold: 75 },
      totalRent: { type: "number", required: true, minConfidenceThreshold: 80 },
      installmentsCount: { type: "number", required: false, minConfidenceThreshold: 70 },
      unitNumber: { type: "string", required: false, minConfidenceThreshold: 60 },
      buildingName: { type: "string", required: false, minConfidenceThreshold: 60 },
    },
  },
  INVOICE: {
    documentType: "INVOICE",
    recommendedModel: "accurate",
    fallbackModel: "forensic",
    backendEndpoint: "/api/ocr/extract-document",
    enableSmartRetry: true,
    preprocessingOptions: {
      applyContrast: true,
      applyNormalization: true,
      convertToGrayscale: false,
      minWidth: 1400,
    },
    schemaRules: {
      invoiceNumber: { type: "string", required: false, minConfidenceThreshold: 70 },
      vendorName: { type: "string", required: false, minConfidenceThreshold: 70 },
      invoiceDate: { type: "date", required: false, minConfidenceThreshold: 75 },
      totalAmount: { type: "number", required: false, minConfidenceThreshold: 80 },
      vatAmount: { type: "number", required: false, minConfidenceThreshold: 70 },
    },
  },
  RECEIPT: {
    documentType: "RECEIPT",
    recommendedModel: "fast",
    fallbackModel: "accurate",
    backendEndpoint: "/api/ocr/extract-document",
    enableSmartRetry: false,
    preprocessingOptions: {
      applyContrast: true,
      applyNormalization: true,
      convertToGrayscale: false,
      minWidth: 1200,
    },
    schemaRules: {
      receiptNumber: { type: "string", required: false, minConfidenceThreshold: 60 },
      depositNumber: { type: "string", required: false, minConfidenceThreshold: 60 },
      receiptDate: { type: "date", required: false, minConfidenceThreshold: 70 },
      depositDate: { type: "date", required: false, minConfidenceThreshold: 70 },
      amount: { type: "number", required: false, minConfidenceThreshold: 75 },
      amountPaid: { type: "number", required: false, minConfidenceThreshold: 75 },
      bankName: { type: "string", required: false, minConfidenceThreshold: 70 },
      accountName: { type: "string", required: false, minConfidenceThreshold: 70 },
      accountNumber: { type: "string", required: false, minConfidenceThreshold: 70 },
      iban: { type: "string", required: false, minConfidenceThreshold: 70 },
      referenceNumber: { type: "string", required: false, minConfidenceThreshold: 70 },
      transactionReference: { type: "string", required: false, minConfidenceThreshold: 70 },
      beneficiaryName: { type: "string", required: false, minConfidenceThreshold: 70 },
      payeeName: { type: "string", required: false, minConfidenceThreshold: 70 },
    },
  },
  GENERAL_DOCUMENT: {
    documentType: "GENERAL_DOCUMENT",
    recommendedModel: "fast",
    backendEndpoint: "/api/ocr/extract-document",
    enableSmartRetry: false,
    preprocessingOptions: {
      applyContrast: true,
      convertToGrayscale: false,
    },
    schemaRules: {
      title: { type: "string", required: false, minConfidenceThreshold: 50 },
      summary: { type: "string", required: false, minConfidenceThreshold: 50 },
    },
  },
};

// In-Memory Session LRU Cache (Up to 50 documents)
const OCR_CACHE = new Map<string, OcrExtractionResult>();
const MAX_CACHE_SIZE = 50;

// --- Centralized OCR Engine V3 (Phase 57-H.11 Hardened) ---

export class OCRService {
  /**
   * Main entry point to process any document using the universal architecture.
   */
  static async extractDocument(
    base64Image: string,
    profileKey: string = "GENERAL_DOCUMENT",
    customModelPreference?: OcrModelLevel,
    mimeType: string = "image/jpeg"
  ): Promise<OcrExtractionResult> {
    const startTime = Date.now();
    const traceId = `OCR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().split("-")[0].toUpperCase()}`;
    const checkpoints: OcrTraceCheckpoint[] = [];

    const recordCheckpoint = (id: string, name: string, status: "PASS" | "FAIL" | "SKIPPED", tStart: number, details?: string) => {
      checkpoints.push({
        id,
        name,
        status,
        latencyMs: Date.now() - tStart,
        details,
      });
    };

    // CHECKPOINT 01: Image Received
    const t01 = Date.now();
    const normalizedKey = (profileKey || "GENERAL_DOCUMENT").toUpperCase();
    const profile = OCR_PROFILES[normalizedKey] || OCR_PROFILES.GENERAL_DOCUMENT;

    let rawBase64 = (base64Image || "").trim();
    if (rawBase64.includes(",")) {
      rawBase64 = rawBase64.substring(rawBase64.lastIndexOf(",") + 1);
    }
    rawBase64 = rawBase64.replace(/[\r\n\s]/g, "");

    if (!rawBase64) {
      recordCheckpoint("CHECKPOINT_01", "Image Received & Validated", "FAIL", t01, "Empty payload");
      return {
        success: false,
        documentType: profile.documentType,
        status: "FAILED",
        data: {},
        metadata: {
          traceId,
          modelLevel: customModelPreference || profile.recommendedModel,
          processingTimeMs: Date.now() - startTime,
          overallConfidence: 0,
          source: "Input Validation Guard",
          checkpoints,
        },
        fields: {},
        warnings: [],
        errors: ["Missing or invalid image base64 data"],
        error: "Missing or invalid image base64 data",
        errorAr: "بيانات الصورة غير صالحة أو مفقودة.",
      };
    }
    recordCheckpoint("CHECKPOINT_01", "Image Received & Validated", "PASS", t01, `Size: ${Math.round(rawBase64.length / 1024)} KB`);

    // CHECKPOINT 02: Image Hashing & Cache Check
    const t02 = Date.now();
    const imageHash = ImageProcessor.generateImageHash(rawBase64);
    const modelLevel = customModelPreference || profile.recommendedModel;
    const cacheKey = `${profile.documentType}_${imageHash}_${modelLevel}`;

    if (OCR_CACHE.has(cacheKey)) {
      recordCheckpoint("CHECKPOINT_02", "Cache Check (LRU Cache Hit)", "PASS", t02, "Serving cached extraction");
      const cached = OCR_CACHE.get(cacheKey)!;
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          traceId,
          cached: true,
          processingTimeMs: Date.now() - startTime,
          checkpoints: [...cached.metadata.checkpoints, ...checkpoints],
        },
      };
    }
    recordCheckpoint("CHECKPOINT_02", "Image Hashing & Fingerprint", "PASS", t02, `Hash: ${imageHash}`);

    // CHECKPOINT 03: Profile & Router Selection
    const t03 = Date.now();
    recordCheckpoint("CHECKPOINT_03", "Profile & Router Selected", "PASS", t03, `Profile: ${profile.documentType}, Model: ${modelLevel}`);

    // CHECKPOINT 04 & 05: Preprocessing & Quality Assessment
    const t04 = Date.now();
    let qualityMetrics: ImageQualityMetrics | undefined;
    let processedBase64 = rawBase64;
    try {
      qualityMetrics = await ImageProcessor.assessQuality(rawBase64, profile.documentType);
      processedBase64 = await ImageProcessor.process(rawBase64, profile.preprocessingOptions);
      if (processedBase64.includes("base64,")) {
        processedBase64 = processedBase64.split("base64,")[1];
      }
      recordCheckpoint("CHECKPOINT_04", "Image Preprocessing Completed", "PASS", t04, `Contrast/Sharpen applied, Dim: ${qualityMetrics.width}x${qualityMetrics.height}`);
    } catch (e: any) {
      recordCheckpoint("CHECKPOINT_04", "Image Preprocessing Skipped (Fallback to Raw)", "FAIL", t04, e?.message);
    }

    // CHECKPOINT 06 & 07: Backend AI Extraction (Pass 1)
    const t07 = Date.now();
    let backendRes = await this.invokeAIBackend(
      processedBase64 || rawBase64,
      profile,
      modelLevel,
      mimeType
    );
    recordCheckpoint("CHECKPOINT_07", "AI Request & Response Received", backendRes?.success !== false ? "PASS" : "FAIL", t07, `Source: ${backendRes?.source || "Backend API"}`);

    let rawData = backendRes?.data || backendRes || {};
    let validatedFields = this.validateFields(rawData, profile.schemaRules);
    let overallConfidence = this.calculateOverallConfidence(validatedFields, rawData.confidence);
    let retryAttempted = false;

    // CHECKPOINT 08: Smart Retry Evaluation (Pass 2 if needed)
    const t08 = Date.now();
    const hasUncertainCriticalFields = Object.entries(validatedFields).some(([k, f]) => {
      const rule = profile.schemaRules[k];
      return rule?.required && (!f.isValid || f.confidence < (rule.minConfidenceThreshold || 75));
    });

    if (profile.enableSmartRetry && hasUncertainCriticalFields && profile.fallbackModel) {
      retryAttempted = true;
      try {
        // Generate high-contrast variant for Pass 2
        const variantOptions: OcrPreprocessOptions = {
          ...profile.preprocessingOptions,
          applyContrast: true,
          applySharpening: true,
          variant: "high_contrast",
        };
        const variantBase64 = await ImageProcessor.process(rawBase64, variantOptions);
        const cleanVariant = variantBase64.includes("base64,") ? variantBase64.split("base64,")[1] : variantBase64;

        const retryRes = await this.invokeAIBackend(cleanVariant, profile, profile.fallbackModel, mimeType);
        if (retryRes?.success !== false && retryRes?.data) {
          const retryFields = this.validateFields(retryRes.data, profile.schemaRules);
          // Result comparison: Merge stronger fields (never downgrade valid high-confidence field)
          validatedFields = this.mergeStrongerFields(validatedFields, retryFields);
          overallConfidence = this.calculateOverallConfidence(validatedFields, retryRes.data.confidence);
          rawData = { ...rawData, ...retryRes.data };
          recordCheckpoint("CHECKPOINT_08", "Smart Field-Level Retry Succeeded", "PASS", t08, `Escalated to ${profile.fallbackModel} with High-Contrast`);
        } else {
          recordCheckpoint("CHECKPOINT_08", "Smart Field-Level Retry Completed (Retained Pass 1)", "SKIPPED", t08);
        }
      } catch (retryErr: any) {
        recordCheckpoint("CHECKPOINT_08", "Smart Field-Level Retry Failed", "FAIL", t08, retryErr?.message);
      }
    } else {
      recordCheckpoint("CHECKPOINT_08", "Smart Field-Level Retry Check", "SKIPPED", t08, "Pass 1 confidence satisfactory");
    }

    // CHECKPOINT 09: Normalization & Flattening
    const t09 = Date.now();
    const flattenedData: Record<string, any> = { ...rawData };
    const warnings: string[] = [];
    const errors: string[] = [];

    let hasAnyMeaningfulValue = false;
    for (const [k, v] of Object.entries(validatedFields)) {
      if (v.value !== null && v.value !== undefined && v.value !== "") {
        flattenedData[k] = v.value;
        hasAnyMeaningfulValue = true;
      }
      if (!v.isValid && profile.schemaRules[k]?.required) {
        errors.push(`الحقل المطلوب (${k}) غير مكتمل أو غير صالح`);
      } else if (v.validationFlags.includes("LOW_CONFIDENCE")) {
        warnings.push(`الحقل (${k}) يحتاج إلى مراجعة وتأكيد (دقة منخفضة)`);
      }
    }
    flattenedData.confidence = overallConfidence / 100;
    recordCheckpoint("CHECKPOINT_09", "Fields Normalization & Assembly Completed", "PASS", t09);

    // Determine Final Status: Never report SUCCESS for empty extractions!
    let finalStatus: "SUCCESS" | "NEEDS_REVIEW" | "FAILED" = "SUCCESS";
    let isSuccess = Boolean(backendRes?.success !== false && hasAnyMeaningfulValue);

    if (!hasAnyMeaningfulValue) {
      finalStatus = "FAILED";
      isSuccess = false;
    } else if (errors.length > 0 || overallConfidence < 70) {
      finalStatus = "NEEDS_REVIEW";
    }

    const result: OcrExtractionResult = {
      success: isSuccess,
      documentType: profile.documentType,
      status: finalStatus,
      data: flattenedData,
      metadata: {
        traceId,
        modelLevel,
        processingTimeMs: Date.now() - startTime,
        overallConfidence,
        imageHash,
        source: backendRes?.source || "Vision OCR Pipeline",
        cached: false,
        quality: qualityMetrics,
        checkpoints,
        retryAttempted,
      },
      fields: validatedFields,
      rawExtracted: rawData,
      warnings,
      errors,
      error: !isSuccess ? (backendRes?.error || "Failed to extract meaningful document data") : undefined,
      errorAr: !isSuccess ? (backendRes?.errorAr || "تعذر استخراج بيانات ذات مغزى من المستند. يرجى إدخال البيانات يدوياً.") : undefined,
    };

    // Cache successful results
    if (isSuccess && OCR_CACHE.size < MAX_CACHE_SIZE) {
      OCR_CACHE.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Specialized high-performance helper for UAE Cheques
   */
  static async extractCheque(
    base64Image: string,
    mimeType: string = "image/jpeg"
  ): Promise<OcrExtractionResult> {
    return this.extractDocument(base64Image, "CHEQUE", "forensic", mimeType);
  }

  /**
   * Specialized high-performance helper for UAE Emirates ID
   */
  static async extractEmiratesId(
    base64Image: string,
    mimeType: string = "image/jpeg"
  ): Promise<OcrExtractionResult> {
    return this.extractDocument(base64Image, "EMIRATES_ID", "accurate", mimeType);
  }

  /**
   * Specialized helper for Lease Agreements
   */
  static async extractLeaseAgreement(
    base64Image: string,
    mimeType: string = "image/jpeg"
  ): Promise<OcrExtractionResult> {
    return this.extractDocument(base64Image, "LEASE_AGREEMENT", "fast", mimeType);
  }

  /**
   * Specialized helper for Invoices
   */
  static async extractInvoice(
    base64Image: string,
    mimeType: string = "image/jpeg"
  ): Promise<OcrExtractionResult> {
    return this.extractDocument(base64Image, "INVOICE", "accurate", mimeType);
  }

  /**
   * Specialized helper for Receipts
   */
  static async extractReceipt(
    base64Image: string,
    mimeType: string = "image/jpeg"
  ): Promise<OcrExtractionResult> {
    return this.extractDocument(base64Image, "RECEIPT", "fast", mimeType);
  }

  /**
   * Specialized helper for Multi-Cheque Batch Scanning
   */
  static async extractChequeBatch(
    payload: { imageBase64?: string; images?: string[]; mimeType?: string }
  ): Promise<{
    success: boolean;
    data?: {
      totalChequesDetected: number;
      cheques: any[];
      confidence?: number;
    };
    error?: string;
    errorAr?: string;
  }> {
    try {
      const res = await safeFetchJson("/api/ocr/extract-cheque-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: payload.imageBase64,
          images: payload.images,
          mimeType: payload.mimeType || "image/jpeg",
          documentType: "MULTI_CHEQUE",
        }),
      });
      return res;
    } catch (e: any) {
      console.error("[OCRService] extractChequeBatch error:", e);
      return {
        success: false,
        error: e.message || "Failed to process batch cheque OCR",
        errorAr: "فشل معالجة مسح مجموعة الشيكات بالذكاء الاصطناعي.",
      };
    }
  }

  /**
   * Clears the in-memory OCR session cache
   */
  static clearCache(): void {
    OCR_CACHE.clear();
  }

  /**
   * Invokes the backend API safely.
   */
  private static async invokeAIBackend(
    base64: string,
    profile: OcrExtractionProfile,
    modelLevel: OcrModelLevel,
    mimeType: string
  ): Promise<any> {
    try {
      const res = await safeFetchJson(profile.backendEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          documentType: profile.documentType,
          modelLevel,
        }),
      });

      return res;
    } catch (e: any) {
      console.error("[OCRService] Backend extraction error:", e);
      return {
        success: false,
        error: e.message || "Failed to communicate with OCR server",
        errorAr: "فشل الاتصال بخادم المعالجة البصرية.",
      };
    }
  }

  /**
   * Merges two field extraction results, always preferring the higher-confidence valid field.
   */
  private static mergeStrongerFields(
    f1: Record<string, ValidatedOcrField>,
    f2: Record<string, ValidatedOcrField>
  ): Record<string, ValidatedOcrField> {
    const merged: Record<string, ValidatedOcrField> = { ...f1 };
    for (const [key, field2] of Object.entries(f2)) {
      const field1 = f1[key];
      if (!field1 || !field1.value) {
        if (field2.value) merged[key] = field2;
      } else if (field2.value && field2.isValid && (!field1.isValid || field2.confidence > field1.confidence)) {
        merged[key] = field2;
      }
    }
    return merged;
  }

  /**
   * Validates the raw backend response against the strict profile schema.
   */
  private static validateFields(
    rawResponse: any,
    rules: Record<string, OcrFieldDefinition>
  ): Record<string, ValidatedOcrField> {
    const result: Record<string, ValidatedOcrField> = {};

    for (const [fieldName, rule] of Object.entries(rules)) {
      const rawObj = rawResponse[fieldName];
      const isNestedObj = rawObj && typeof rawObj === "object" && !Array.isArray(rawObj) && ("value" in rawObj);
      
      let rawValue = isNestedObj ? rawObj.value : rawObj;
      const explicitConfidence = isNestedObj && typeof rawObj.confidence === "number" ? rawObj.confidence : undefined;

      // Normalization per field type
      if (rule.type === "string" && typeof rawValue === "string") {
        rawValue = rawValue.trim();
        if (fieldName === "emiratesIdNumber") {
          rawValue = this.normalizeEmiratesId(rawValue);
        } else if (fieldName === "chequeNumber") {
          const cleanNum = rawValue.replace(/\D/g, "");
          if (cleanNum) rawValue = cleanNum;
        }
      } else if (rule.type === "number") {
        if (typeof rawValue === "string") {
          const parsed = parseFloat(rawValue.replace(/[^0-9.]/g, ""));
          rawValue = !isNaN(parsed) ? parsed : null;
        }
      } else if (rule.type === "date" && typeof rawValue === "string") {
        rawValue = this.normalizeDate(rawValue);
      }

      const confidence = explicitConfidence !== undefined 
        ? Math.round(explicitConfidence > 1 ? explicitConfidence : explicitConfidence * 100) 
        : this.estimateConfidence(rawValue, rule);

      const validationFlags: string[] = [];
      let isValid = true;

      // 1. Missing Value Check
      if (rule.required && (rawValue === null || rawValue === undefined || rawValue === "")) {
        isValid = false;
        validationFlags.push("MISSING_REQUIRED_FIELD");
      }

      // 2. Regex Pattern Match
      if (rawValue && rule.validationRegex && typeof rawValue === "string") {
        if (!rule.validationRegex.test(rawValue)) {
          isValid = false;
          validationFlags.push("REGEX_MISMATCH");
        }
      }

      // 3. Enum Option Validation
      if (rawValue && rule.type === "enum" && rule.options) {
        const strVal = String(rawValue).toUpperCase();
        if (!rule.options.includes(strVal)) {
          isValid = false;
          validationFlags.push("INVALID_OPTION");
        }
      }

      // 4. Confidence Threshold Guard
      if (rule.minConfidenceThreshold && confidence < rule.minConfidenceThreshold) {
        validationFlags.push("LOW_CONFIDENCE");
      }

      result[fieldName] = {
        value: rawValue !== undefined ? rawValue : null,
        confidence,
        isValid,
        validationFlags,
      };
    }

    return result;
  }

  private static normalizeEmiratesId(idStr: string): string {
    const digits = idStr.replace(/\D/g, "");
    if (digits.length === 15 && digits.startsWith("784")) {
      return `784-${digits.substring(3, 7)}-${digits.substring(7, 14)}-${digits.substring(14, 15)}`;
    }
    return idStr;
  }

  private static normalizeDate(dateStr: string): string {
    if (!dateStr) return "";
    const clean = dateStr.trim();
    // Match DD/MM/YYYY or DD-MM-YYYY
    const dmy = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) {
      const d = dmy[1].padStart(2, "0");
      const m = dmy[2].padStart(2, "0");
      const y = dmy[3];
      return `${y}-${m}-${d}`;
    }
    return clean;
  }

  private static estimateConfidence(value: any, rule: OcrFieldDefinition): number {
    if (value === null || value === undefined || value === "") return 0;

    let baseConfidence = 90;

    if (rule.validationRegex && typeof value === "string") {
      if (rule.validationRegex.test(value)) {
        baseConfidence += 8;
      } else {
        baseConfidence -= 40;
      }
    }

    return Math.min(99, Math.max(10, baseConfidence));
  }

  private static calculateOverallConfidence(
    fields: Record<string, ValidatedOcrField>,
    backendConfidence?: number
  ): number {
    if (typeof backendConfidence === "number") {
      return Math.round(backendConfidence > 1 ? backendConfidence : backendConfidence * 100);
    }

    const values = Object.values(fields).filter(f => f.value !== null && f.value !== "");
    if (values.length === 0) return 0;

    const sum = values.reduce((acc, field) => acc + field.confidence, 0);
    return Math.round(sum / values.length);
  }
}
