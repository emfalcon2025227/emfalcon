import { getAllUaeBanks } from "./bankUtils";

export interface NormalizedChequeOCRResult {
  chequeNumber: string;
  bankName: string;
  amount: number;
  dueDate: string;
  drawerName: string;
  accountNumber: string;
}

export function normalizeChequeOCR(ocrResult: any, language: "ar" | "en" = "ar"): NormalizedChequeOCRResult {
  const d = ocrResult?.data || ocrResult?.extracted || ocrResult;
  const fields = ocrResult?.fields || {};

  const getVal = (key: string) => {
    if (d && d[key] !== undefined && d[key] !== null) {
      const v = d[key];
      return typeof v === "object" && v !== null && "value" in v ? v.value : v;
    }
    if (fields && fields[key] !== undefined && fields[key] !== null) {
      const v = fields[key];
      return typeof v === "object" && v !== null && "value" in v ? v.value : v;
    }
    return "";
  };

  const extractedNum = String(getVal("chequeNumber") || getVal("chequeNo") || ocrResult?.chequeNumber || "").replace(/\D/g, "");
  const rawBank = String(getVal("bankName") || getVal("bank") || ocrResult?.bankName || "");
  const rawAmount = String(getVal("amount") || getVal("amountNumeric") || ocrResult?.amount || 0);
  const extractedAmount = parseFloat(rawAmount.replace(/[^0-9.]/g, "")) || 0;
  const extractedDate = String(getVal("dueDate") || getVal("chequeDate") || getVal("date") || ocrResult?.date || "");
  const extractedDrawer = String(getVal("drawerName") || getVal("payeeName") || ocrResult?.drawerName || "");
  const extractedAccount = String(getVal("accountNumber") || getVal("iban") || ocrResult?.accountNumber || "");

  let extractedBank = "";
  if (rawBank) {
    const searchBank = String(rawBank)
      .toLowerCase()
      .trim()
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[ًٌٍَُِّْ]/g, "");
    
    const banks = getAllUaeBanks();
    const matchedBank = banks.find((b) => {
      const enName = (b.nameEn || "").toLowerCase();
      const arName = (b.nameAr || "")
        .replace(/[أإآ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه")
        .replace(/[ًٌٍَُِّْ]/g, "");
      const code = (b.code || "").toLowerCase();
      return (
        enName.includes(searchBank) ||
        arName.includes(searchBank) ||
        searchBank.includes(enName) ||
        searchBank.includes(arName) ||
        code === searchBank
      );
    });
    
    if (matchedBank) {
      extractedBank = language === "ar" ? matchedBank.nameAr : matchedBank.nameEn;
    } else {
      extractedBank = String(rawBank);
    }
  }

  return {
    chequeNumber: extractedNum,
    bankName: extractedBank,
    amount: extractedAmount,
    dueDate: extractedDate,
    drawerName: extractedDrawer,
    accountNumber: extractedAccount
  };
}
