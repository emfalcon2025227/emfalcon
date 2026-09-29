export type DocumentType = "CHEQUE" | "EMIRATES_ID" | "PASSPORT" | "TRADE_LICENSE" | "OTHER";
export type CaptureSource = "FILE" | "CAMERA" | "SCANNER";
export type VerificationStatus = "UNVERIFIED" | "AI_EXTRACTED" | "REVIEW_REQUIRED" | "USER_REVIEWED" | "USER_APPROVED" | "SYSTEM_VALIDATED" | "INVALID";
export type DocumentCaptureState = "IDLE" | "CAPTURING" | "PREVIEW" | "QUALITY_CHECK" | "WARNING" | "PROCESSING" | "EXTRACTED" | "VALIDATING" | "REVIEW" | "APPROVED" | "COMMITTED" | "ERROR";

export type SystemVerificationStatus = "HIGH_CONFIDENCE" | "REVIEW_REQUIRED" | "LOW_CONFIDENCE" | "INVALID" | "UNREADABLE";

export interface ExtractionField<T> {
  value: T | null;
  confidence: number;
  systemScore: number; // Independent verification score (0-1)
  source: "AI" | "USER" | "SYSTEM";
  verificationStatus: VerificationStatus;
  systemStatus: SystemVerificationStatus;
  originalAiValue?: T | null;
  reason?: string;
}

export interface ImageQualityResult {
  isAcceptable: boolean;
  score: number;
  issues: string[]; // ["TOO_DARK", "BLURRY", etc]
  resolution?: { width: number; height: number };
}

export interface ExtractionResult {
  documentType: DocumentType;
  capturedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  sourceDocumentId?: string;
  confidenceThresholdMet: boolean;
  rawNotes?: string;

  // Cheque Fields
  chequeNumber?: ExtractionField<string>;
  bankName?: ExtractionField<string>;
  amountNumeric?: ExtractionField<number>;
  amountInWords?: ExtractionField<string>;
  chequeDate?: ExtractionField<string>;
  dueDate?: ExtractionField<string>;
  payee?: ExtractionField<string>;
  drawer?: ExtractionField<string>;
  accountNumber?: ExtractionField<string>;
  currency?: ExtractionField<string>;
  isBounced?: ExtractionField<boolean>;
  returnReason?: ExtractionField<string>;

  // Identity Fields
  emiratesIdNumber?: ExtractionField<string>;
  fullName?: ExtractionField<string>;
  arabicName?: ExtractionField<string>;
  englishName?: ExtractionField<string>;
  nationality?: ExtractionField<string>;
  dateOfBirth?: ExtractionField<string>;
  gender?: ExtractionField<string>;
  cardNumber?: ExtractionField<string>;
  issueDate?: ExtractionField<string>;
  expiryDate?: ExtractionField<string>;

  // Index signature
  [key: string]: any;
}

export interface ChequeExtractionResult extends ExtractionResult {
  documentType: "CHEQUE";
  chequeNumber: ExtractionField<string>;
  bankName: ExtractionField<string>;
  amountNumeric: ExtractionField<number>;
  amountInWords: ExtractionField<string>;
  chequeDate: ExtractionField<string>;
  dueDate: ExtractionField<string>;
  payee: ExtractionField<string>;
  drawer: ExtractionField<string>;
  accountNumber: ExtractionField<string>;
  currency: ExtractionField<string>;
  isBounced: ExtractionField<boolean>;
  returnReason: ExtractionField<string>;
}

export interface IdentityExtractionResult extends ExtractionResult {
  documentType: "EMIRATES_ID";
  emiratesIdNumber: ExtractionField<string>;
  fullName: ExtractionField<string>;
  arabicName: ExtractionField<string>;
  englishName: ExtractionField<string>;
  nationality: ExtractionField<string>;
  dateOfBirth: ExtractionField<string>;
  gender: ExtractionField<string>;
  cardNumber: ExtractionField<string>;
  issueDate: ExtractionField<string>;
  expiryDate: ExtractionField<string>;
}
