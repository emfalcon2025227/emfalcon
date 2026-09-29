/**
 * OCR V2 Profiles & Schema Definitions
 * Emirates Falcon ERP — Phase 57-H.12
 */

import { OCRProfileKey, OCRV2ProfileConfig } from "./OCRV2Types";

export const OCR_V2_PROFILES: Record<OCRProfileKey, OCRV2ProfileConfig> = {
  EMIRATES_ID: {
    documentType: "EMIRATES_ID",
    recommendedModel: "accurate",
    fallbackModel: "forensic",
    preprocessingOptions: {
      minWidth: 1400,
      applyContrast: true,
      applyNormalization: true,
      applySharpening: true,
      convertToGrayscale: false,
      variant: "enhanced"
    },
    schemaRules: {
      emiratesIdNumber: {
        type: "string",
        required: true,
        minConfidenceThreshold: 85,
        validationRegex: /^784-\d{4}-\d{7}-\d{1}$/
      },
      englishName: { type: "string", required: true, minConfidenceThreshold: 75 },
      arabicName: { type: "string", required: false, minConfidenceThreshold: 70 },
      dateOfBirth: { type: "date", required: false, validationRegex: /^\d{4}-\d{2}-\d{2}$/ },
      gender: { type: "string", required: false, options: ["M", "F", "MALE", "FEMALE", "ذكر", "أنثى"] },
      nationality: { type: "string", required: false },
      issueDate: { type: "date", required: false },
      expiryDate: { type: "date", required: true, validationRegex: /^\d{4}-\d{2}-\d{2}$/ },
      cardNumber: { type: "string", required: false },
      documentSide: { type: "enum", required: false, options: ["FRONT", "BACK", "BOTH", "DIGITAL_ID"] }
    },
    backendEndpoint: "/api/ocr/v2/extract",
    enableSmartRetry: true
  },
  CHEQUE: {
    documentType: "CHEQUE",
    recommendedModel: "forensic",
    fallbackModel: "accurate",
    preprocessingOptions: {
      minWidth: 1600,
      applyContrast: true,
      applyNormalization: true,
      applySharpening: true,
      convertToGrayscale: false,
      variant: "high_contrast"
    },
    schemaRules: {
      chequeNumber: { type: "string", required: true, minConfidenceThreshold: 80, validationRegex: /^\d{4,10}$/ },
      amount: { type: "number", required: true, minConfidenceThreshold: 85 },
      amountInWords: { type: "string", required: false, minConfidenceThreshold: 60 },
      bankName: { type: "string", required: true, minConfidenceThreshold: 75 },
      drawerName: { type: "string", required: false, minConfidenceThreshold: 70 },
      date: { type: "date", required: true },
      dueDate: { type: "date", required: false },
      accountNumber: { type: "string", required: false },
      isBounced: { type: "boolean", required: false }
    },
    backendEndpoint: "/api/ocr/v2/extract",
    enableSmartRetry: true
  },
  BANK_DEPOSIT_PROOF: {
    documentType: "BANK_DEPOSIT_PROOF",
    recommendedModel: "accurate",
    fallbackModel: "forensic",
    preprocessingOptions: {
      minWidth: 1400,
      applyContrast: true,
      applyNormalization: true,
      applySharpening: true,
      convertToGrayscale: false,
      variant: "high_contrast"
    },
    schemaRules: {
      bankName: { type: "string", required: true, minConfidenceThreshold: 70 },
      depositAmount: { type: "number", required: true, minConfidenceThreshold: 80 },
      depositDate: { type: "date", required: true, minConfidenceThreshold: 75 },
      referenceNumber: { type: "string", required: false, minConfidenceThreshold: 65 },
      accountNumber: { type: "string", required: false, minConfidenceThreshold: 60 },
      documentClassification: { type: "string", required: false }
    },
    backendEndpoint: "/api/ocr/v2/extract",
    enableSmartRetry: true
  },
  LEASE_AGREEMENT: {
    documentType: "LEASE_AGREEMENT",
    recommendedModel: "accurate",
    fallbackModel: "forensic",
    preprocessingOptions: {
      minWidth: 1500,
      applyContrast: true,
      applyNormalization: true,
      applySharpening: false,
      convertToGrayscale: false,
      variant: "enhanced"
    },
    schemaRules: {
      tenantName: { type: "string", required: true, minConfidenceThreshold: 80 },
      ownerName: { type: "string", required: false, minConfidenceThreshold: 75 },
      contractNumber: { type: "string", required: false },
      propertyName: { type: "string", required: false },
      unitNumber: { type: "string", required: false },
      startDate: { type: "date", required: true, validationRegex: /^\d{4}-\d{2}-\d{2}$/ },
      endDate: { type: "date", required: true, validationRegex: /^\d{4}-\d{2}-\d{2}$/ },
      annualRent: { type: "number", required: true, minConfidenceThreshold: 85 },
      installmentCount: { type: "number", required: false }
    },
    backendEndpoint: "/api/ocr/v2/extract",
    enableSmartRetry: true
  },
  INVOICE: {
    documentType: "INVOICE",
    recommendedModel: "fast",
    fallbackModel: "accurate",
    preprocessingOptions: {
      minWidth: 1200,
      applyContrast: true,
      applyNormalization: true,
      applySharpening: false,
      convertToGrayscale: false,
      variant: "normalized"
    },
    schemaRules: {
      invoiceNumber: { type: "string", required: false },
      vendorName: { type: "string", required: true },
      date: { type: "date", required: false },
      totalAmount: { type: "number", required: true },
      taxAmount: { type: "number", required: false }
    },
    backendEndpoint: "/api/ocr/v2/extract",
    enableSmartRetry: false
  },
  RECEIPT: {
    documentType: "RECEIPT",
    recommendedModel: "fast",
    fallbackModel: "accurate",
    preprocessingOptions: {
      minWidth: 1000,
      applyContrast: true,
      applyNormalization: true,
      applySharpening: false,
      convertToGrayscale: false,
      variant: "normalized"
    },
    schemaRules: {
      receiptNumber: { type: "string", required: false },
      merchantName: { type: "string", required: false },
      date: { type: "date", required: false },
      totalAmount: { type: "number", required: true }
    },
    backendEndpoint: "/api/ocr/v2/extract",
    enableSmartRetry: false
  },
  GENERAL_DOCUMENT: {
    documentType: "GENERAL_DOCUMENT",
    recommendedModel: "fast",
    fallbackModel: "accurate",
    preprocessingOptions: {
      minWidth: 1200,
      applyContrast: true,
      applyNormalization: true,
      applySharpening: false,
      convertToGrayscale: false,
      variant: "normalized"
    },
    schemaRules: {
      title: { type: "string", required: false },
      summary: { type: "string", required: false },
      documentDate: { type: "date", required: false }
    },
    backendEndpoint: "/api/ocr/v2/extract",
    enableSmartRetry: false
  }
};
