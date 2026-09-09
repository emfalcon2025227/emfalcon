/**
 * OCR V2 Smart Retry & Escalation Strategy
 * Emirates Falcon ERP — Phase 57-H.12
 */

import { OCRV2FieldMetadata } from "./OCRV2Types";

export class OCRV2Retry {
  static shouldRetry(status: string, fields: Record<string, OCRV2FieldMetadata>, attempt: number, maxAttempts: number = 2): boolean {
    if (attempt >= maxAttempts) return false;
    if (status === "FAILED" || status === "NEEDS_REVIEW") {
      return true;
    }
    // Check if any required field is missing or has low confidence
    const hasLowConfidence = Object.values(fields).some(f => f.confidence < 70);
    return hasLowConfidence;
  }
}
