/**
 * OCR V2 Confidence Engine
 * Emirates Falcon ERP — Phase 57-H.12
 */

import { OCRV2FieldMetadata } from "./OCRV2Types";

export class OCRV2Confidence {
  static evaluate(fields: Record<string, OCRV2FieldMetadata>): { overallConfidence: number; status: "SUCCESS" | "PARTIAL" | "NEEDS_REVIEW" | "FAILED" } {
    const entries = Object.values(fields);
    if (entries.length === 0) {
      return { overallConfidence: 0, status: "FAILED" };
    }

    let totalConfidence = 0;
    let validCount = 0;
    let missingRequiredCount = 0;

    for (const field of entries) {
      totalConfidence += field.confidence;
      if (field.validationStatus === "VALID") {
        validCount++;
      }
      if (field.flags.includes("REQUIRED_FIELD_MISSING")) {
        missingRequiredCount++;
      }
    }

    const overallConfidence = Math.round(totalConfidence / entries.length);

    let status: "SUCCESS" | "PARTIAL" | "NEEDS_REVIEW" | "FAILED" = "SUCCESS";
    if (missingRequiredCount > 0) {
      status = "NEEDS_REVIEW";
    } else if (overallConfidence < 70 || entries.some(f => f.validationStatus === "UNCERTAIN")) {
      status = "PARTIAL";
    }

    return { overallConfidence, status };
  }
}
