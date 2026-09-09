/**
 * OCR V2 Model Router & Hierarchy
 * Emirates Falcon ERP — Phase 57-H.12
 */

import { OCRModelLevel, OCRProfileKey } from "./OCRV2Types";
import { OCR_V2_PROFILES } from "./OCRV2Profiles";

export class OCRV2ModelRouter {
  static getModelSequence(profileKey: OCRProfileKey, modelLevel?: OCRModelLevel): string[] {
    const profile = OCR_V2_PROFILES[profileKey] || OCR_V2_PROFILES.GENERAL_DOCUMENT;
    const level = modelLevel || profile.recommendedModel;

    if (level === "forensic" || profileKey === "CHEQUE") {
      return ["gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview"];
    }
    if (level === "fast") {
      return ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.1-pro-preview"];
    }
    // Default accurate
    return ["gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview"];
  }

  static getPromptForProfile(profileKey: OCRProfileKey): string {
    switch (profileKey) {
      case "EMIRATES_ID":
        return `Extract Emirates ID document fields accurately in JSON format with keys: emiratesIdNumber, fullName, arabicName, englishName, dateOfBirth, gender, nationality, issueDate, expiryDate, cardNumber, documentSide. Normalize Emirates ID number to 784-YYYY-XXXXXXX-X format. Return valid JSON only without markdown explanation.`;
      case "CHEQUE":
        return `Extract UAE Bank Cheque fields accurately in JSON format with keys: chequeNumber, amount, amountInWords, bankName, drawerName, date, dueDate, accountNumber, isBounced. Preserve leading zeros in cheque numbers. Return valid JSON only without markdown explanation.`;
      case "LEASE_AGREEMENT":
        return `Extract Tenancy Contract / Lease Agreement fields in JSON format with keys: tenantName, ownerName, contractNumber, propertyName, unitNumber, startDate, endDate, annualRent, installmentCount. Normalize dates to YYYY-MM-DD. Return valid JSON only without markdown explanation.`;
      case "INVOICE":
        return `Extract Invoice fields in JSON format with keys: invoiceNumber, vendorName, date, totalAmount, taxAmount. Return valid JSON only.`;
      case "RECEIPT":
        return `Extract Receipt fields in JSON format with keys: receiptNumber, merchantName, date, totalAmount. Return valid JSON only.`;
      default:
        return `Extract document text and structured key-value fields in JSON format. Return valid JSON only.`;
    }
  }
}
