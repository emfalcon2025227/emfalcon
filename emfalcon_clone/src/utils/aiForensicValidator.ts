import { ExtractionField, SystemVerificationStatus, VerificationStatus } from "../types/documentIntelligence";

/**
 * AI Forensic Validator
 * 
 * Provides production-grade verification of AI-extracted data against
 * system business rules and format standards.
 */
export const AIForensicValidator = {
  /**
   * Calculates a system-level confidence score based on format and business logic
   */
  calculateSystemScore: (key: string, value: any, aiConfidence: number): number => {
    if (value === null || value === undefined || value === "") return 0;

    let score = aiConfidence;

    // Rule 1: Emirates ID Format
    if (key === "emiratesIdNumber") {
      const cleanVal = String(value).trim();
      const digitsOnly = cleanVal.replace(/\D/g, "");
      const eIdRegex = /^784-\d{4}-\d{7}-\d{1}$/;
      if (eIdRegex.test(cleanVal) || (digitsOnly.length === 15 && digitsOnly.startsWith("784"))) {
        score = Math.max(score, 0.96);
      } else {
        score *= 0.4;
      }
    }

    // Rule 2: Cheque Number Length
    if (key === "chequeNumber") {
      const num = String(value).replace(/\D/g, "");
      if (num.length >= 6 && num.length <= 12) score = Math.max(score, 0.95);
      else score *= 0.6;
    }

    // Rule 3: Date Validity
    if (key.toLowerCase().includes("date") || key === "dateOfBirth") {
      const strVal = String(value).trim();
      const date = new Date(strVal);
      if (isNaN(date.getTime())) {
        score = 0;
      } else {
        // Future dates are okay for cheques and expiry, but DOB must be in past
        if (key === "dateOfBirth" && date > new Date()) score = 0;
        else score = Math.max(score, 0.92);
      }
    }

    // Rule 4: Amount sanity
    if (key === "amount" || key === "amountNumeric") {
      const val = Number(value);
      if (isNaN(val) || val <= 0) score = 0;
      else if (val > 10000000) score *= 0.8; // High value needs extra review
      else score = Math.max(score, 0.95);
    }

    // Rule 5: Names & Nationality
    if (key === "arabicName" || key === "englishName" || key === "fullName" || key === "nationality") {
      if (String(value).trim().length >= 2) score = Math.max(score, 0.92);
    }

    return Math.min(1, score);
  },

  /**
   * Determines the verification status for a field
   */
  getSystemStatus: (score: number): SystemVerificationStatus => {
    if (score >= 0.9) return "HIGH_CONFIDENCE";
    if (score >= 0.7) return "REVIEW_REQUIRED";
    if (score > 0) return "LOW_CONFIDENCE";
    return "INVALID";
  },

  /**
   * Maps score to UI verification status
   */
  getVerificationStatus: (score: number): VerificationStatus => {
    if (score >= 0.9) return "SYSTEM_VALIDATED";
    if (score >= 0.7) return "AI_EXTRACTED";
    if (score > 0) return "REVIEW_REQUIRED";
    return "INVALID";
  },

  /**
   * Validates a full extraction result
   */
  validateResult: (data: any, aiConfidence: number): Record<string, ExtractionField<any>> => {
    const validated: Record<string, ExtractionField<any>> = {};

    for (const key of Object.keys(data)) {
      if (key === "confidence" || key === "rawNotes") continue;

      const value = data[key];
      const systemScore = AIForensicValidator.calculateSystemScore(key, value, aiConfidence);
      const systemStatus = AIForensicValidator.getSystemStatus(systemScore);
      
      validated[key] = {
        value,
        confidence: aiConfidence,
        systemScore,
        source: "AI",
        verificationStatus: AIForensicValidator.getVerificationStatus(systemScore),
        systemStatus,
        originalAiValue: value,
        reason: systemStatus === "HIGH_CONFIDENCE" ? "" : `System validation score: ${Math.round(systemScore * 100)}%`
      };
    }

    return validated;
  }
};
