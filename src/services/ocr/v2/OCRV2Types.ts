/**
 * OCR V2 Types & Interfaces
 * Emirates Falcon ERP — Phase 57-H.12
 */

export type OCRProfileKey = 
  | "EMIRATES_ID"
  | "CHEQUE"
  | "BANK_DEPOSIT_PROOF"
  | "LEASE_AGREEMENT"
  | "INVOICE"
  | "RECEIPT"
  | "GENERAL_DOCUMENT";

export type OCRModelLevel = "fast" | "accurate" | "forensic";

export type ImageVariant = 
  | "original" 
  | "normalized" 
  | "enhanced" 
  | "high_contrast" 
  | "low_light" 
  | "sharpened";

export interface OCRV2FieldMetadata {
  value: unknown;
  confidence: number; // 0 to 100
  source: string;
  validationStatus: "VALID" | "UNCERTAIN" | "INVALID" | "MISSING";
  flags: string[];
}

export interface OCRV2Result<T = Record<string, any>> {
  success: boolean;
  status: "SUCCESS" | "PARTIAL" | "NEEDS_REVIEW" | "FAILED";
  profile: OCRProfileKey;
  data: T;
  fields: Record<string, OCRV2FieldMetadata>;
  diagnostics: {
    traceId: string;
    model: string;
    attempts: number;
    processingMs: number;
    imageVariant: ImageVariant;
    errorCode?: string;
    errorMsg?: string;
    checkpoints: Array<{
      id: string;
      name: string;
      status: "PASS" | "FAIL" | "SKIPPED";
      latencyMs: number;
      details?: string;
    }>;
  };
  warnings?: string[];
  errors?: string[];
}

export interface OCRV2PreprocessOptions {
  minWidth?: number;
  maxWidth?: number;
  applyContrast?: boolean;
  applyNormalization?: boolean;
  applySharpening?: boolean;
  convertToGrayscale?: boolean;
  variant?: ImageVariant;
}

export interface OCRV2FieldDefinition {
  type: "string" | "number" | "date" | "boolean" | "enum";
  required: boolean;
  minConfidenceThreshold?: number;
  validationRegex?: RegExp;
  options?: string[];
}

export interface OCRV2ProfileConfig {
  documentType: OCRProfileKey;
  recommendedModel: OCRModelLevel;
  fallbackModel: OCRModelLevel;
  preprocessingOptions: OCRV2PreprocessOptions;
  schemaRules: Record<string, OCRV2FieldDefinition>;
  backendEndpoint: string;
  enableSmartRetry: boolean;
}
