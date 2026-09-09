/**
 * OCR V2 Field Validator
 * Emirates Falcon ERP — Phase 57-H.12
 */

import { OCRProfileKey, OCRV2FieldMetadata } from "./OCRV2Types";
import { OCR_V2_PROFILES } from "./OCRV2Profiles";

export class OCRV2Validator {
  static validateFields(profileKey: OCRProfileKey, data: Record<string, any>): Record<string, OCRV2FieldMetadata> {
    const profile = OCR_V2_PROFILES[profileKey] || OCR_V2_PROFILES.GENERAL_DOCUMENT;
    const rules = profile.schemaRules;
    const resultFields: Record<string, OCRV2FieldMetadata> = {};

    for (const [fieldName, rule] of Object.entries(rules)) {
      const val = data[fieldName];
      const hasValue = val !== undefined && val !== null && String(val).trim() !== "";
      const flags: string[] = [];

      let validationStatus: "VALID" | "UNCERTAIN" | "INVALID" | "MISSING" = "MISSING";
      let confidence = 0;

      if (!hasValue) {
        if (rule.required) {
          validationStatus = "MISSING";
          flags.push("REQUIRED_FIELD_MISSING");
        } else {
          validationStatus = "VALID";
          confidence = 50; // optional missing
        }
      } else {
        confidence = 90;
        validationStatus = "VALID";

        if (rule.validationRegex) {
          if (rule.validationRegex.test(String(val))) {
            validationStatus = "VALID";
            confidence = 98;
          } else {
            validationStatus = "UNCERTAIN";
            confidence = 60;
            flags.push("REGEX_MISMATCH");
          }
        }
      }

      resultFields[fieldName] = {
        value: hasValue ? val : "",
        confidence,
        source: "ocr-v2-gemini",
        validationStatus,
        flags
      };
    }

    return resultFields;
  }
}
