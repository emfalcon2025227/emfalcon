/**
 * OCR V2 Field Normalizer
 * Emirates Falcon ERP — Phase 57-H.12
 */

import { OCRProfileKey } from "./OCRV2Types";

export class OCRV2Normalizer {
  static normalizeData(profileKey: OCRProfileKey, data: Record<string, any>): Record<string, any> {
    if (!data || typeof data !== "object") return {};
    const normalized = { ...data };

    if (profileKey === "EMIRATES_ID") {
      // Alias mapping & priority order
      normalized.emiratesIdNumber = normalized.emiratesIdNumber || normalized.idNumber || normalized.cardNumber || normalized.identityNumber || normalized.identityNo || normalized.id_no || "";
      normalized.fullName = normalized.fullName || normalized.name || normalized.full_name || normalized.holderName || "";
      normalized.arabicName = normalized.arabicName || normalized.nameArabic || normalized.arabic_full_name || normalized.fullNameArabic || "";
      normalized.englishName = normalized.englishName || normalized.nameEnglish || normalized.english_full_name || normalized.fullNameEnglish || normalized.fullName || "";
      normalized.dateOfBirth = normalized.dateOfBirth || normalized.dob || normalized.birthDate || normalized.birth_date || "";
      normalized.gender = normalized.gender || normalized.sex || "";
      normalized.nationality = normalized.nationality || normalized.country || normalized.citizenship || "";
      normalized. issueDate = normalized.issueDate || normalized.dateOfIssue || normalized.issuedDate || "";
      normalized.expiryDate = normalized.expiryDate || normalized.dateOfExpiry || normalized.expirationDate || "";

      // Normalize Emirates ID number format 784-YYYY-XXXXXXX-X
      let idNum = String(normalized.emiratesIdNumber || "").trim();
      const digits = idNum.replace(/[^\d]/g, "");
      if (digits.length === 15 && digits.startsWith("784")) {
        normalized.emiratesIdNumber = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 14)}-${digits.slice(14)}`;
      } else if (idNum) {
        normalized.emiratesIdNumber = idNum;
      }

      if (normalized.fullName && !normalized.englishName && /[a-zA-Z]/.test(normalized.fullName)) {
        normalized.englishName = normalized.fullName;
      }
      if (normalized.fullName && !normalized.arabicName && /[\u0600-\u06FF]/.test(normalized.fullName)) {
        normalized.arabicName = normalized.fullName;
      }
      if (!normalized.fullName) {
        normalized.fullName = normalized.englishName || normalized.arabicName || "";
      }
    } else if (profileKey === "CHEQUE") {
      // Normalize cheque number (preserve leading zeros)
      if (normalized.chequeNumber !== undefined && normalized.chequeNumber !== null) {
        let chq = String(normalized.chequeNumber).trim();
        normalized.chequeNumber = chq.replace(/[^\d]/g, "").padStart(6, "0");
      }
      // Normalize amount to float number
      if (normalized.amount !== undefined && normalized.amount !== null) {
        const amtStr = String(normalized.amount).replace(/[^0-9.]/g, "");
        const parsedAmt = parseFloat(amtStr);
        normalized.amount = isNaN(parsedAmt) ? 0 : parsedAmt;
      }
    } else if (profileKey === "LEASE_AGREEMENT") {
      if (normalized.annualRent !== undefined && normalized.annualRent !== null) {
        const rentStr = String(normalized.annualRent).replace(/[^0-9.]/g, "");
        const parsedRent = parseFloat(rentStr);
        normalized.annualRent = isNaN(parsedRent) ? 0 : parsedRent;
      }
    }

    return normalized;
  }
}
