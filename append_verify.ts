import fs from 'fs';

const code = `
export interface VerificationResult {
  status: "MATCH" | "MISMATCH" | "NEEDS_REVIEW" | "NOT_AVAILABLE";
  expected: string;
  extracted: string;
}

export interface FinancialProofVerification {
  overallStatus: "MATCH" | "MISMATCH" | "NEEDS_REVIEW" | "FAILED";
  amount: VerificationResult;
  bank: VerificationResult;
  reference: VerificationResult;
  date: VerificationResult;
  account: VerificationResult;
  failureReason?: string;
}

export function verifyFinancialProof(
  expected: {
    amount: number;
    bankName?: string;
    referenceNumber?: string;
    date?: string;
    accountNumber?: string;
  },
  extracted: any
): FinancialProofVerification {
  if (!extracted || typeof extracted !== "object") {
    return {
      overallStatus: "FAILED",
      failureReason: "Extracted data is missing or invalid.",
      amount: { status: "NOT_AVAILABLE", expected: expected.amount.toString(), extracted: "" },
      bank: { status: "NOT_AVAILABLE", expected: expected.bankName || "", extracted: "" },
      reference: { status: "NOT_AVAILABLE", expected: expected.referenceNumber || "", extracted: "" },
      date: { status: "NOT_AVAILABLE", expected: expected.date || "", extracted: "" },
      account: { status: "NOT_AVAILABLE", expected: expected.accountNumber || "", extracted: "" },
    };
  }

  const result: FinancialProofVerification = {
    overallStatus: "MATCH",
    amount: { status: "NOT_AVAILABLE", expected: expected.amount.toString(), extracted: "" },
    bank: { status: "NOT_AVAILABLE", expected: expected.bankName || "", extracted: "" },
    reference: { status: "NOT_AVAILABLE", expected: expected.referenceNumber || "", extracted: "" },
    date: { status: "NOT_AVAILABLE", expected: expected.date || "", extracted: "" },
    account: { status: "NOT_AVAILABLE", expected: expected.accountNumber || "", extracted: "" },
  };

  const extractedAmount = extracted.amount || extracted.amountPaid;
  if (extractedAmount !== undefined && extractedAmount !== null) {
    result.amount.extracted = extractedAmount.toString();
    result.amount.status = (Number(extractedAmount) === Number(expected.amount)) ? "MATCH" : "MISMATCH";
  } else {
    result.amount.status = "NOT_AVAILABLE";
  }

  if (expected.bankName) {
    const extBank = extracted.bankName || "";
    result.bank.extracted = extBank;
    if (extBank) {
      result.bank.status = extBank.toLowerCase().includes(expected.bankName.toLowerCase()) ? "MATCH" : "NEEDS_REVIEW";
    } else {
      result.bank.status = "NOT_AVAILABLE";
    }
  }

  if (expected.referenceNumber) {
    const extRef = extracted.referenceNumber || extracted.transactionReference || extracted.receiptNumber || extracted.depositNumber || "";
    result.reference.extracted = extRef;
    if (extRef) {
      result.reference.status = extRef.includes(expected.referenceNumber) ? "MATCH" : "NEEDS_REVIEW";
    } else {
      result.reference.status = "NOT_AVAILABLE";
    }
  }

  if (expected.accountNumber) {
    const extAcc = extracted.accountNumber || extracted.iban || "";
    result.account.extracted = extAcc;
    if (extAcc) {
      result.account.status = extAcc.includes(expected.accountNumber) ? "MATCH" : "MISMATCH";
    } else {
      result.account.status = "NOT_AVAILABLE";
    }
  }

  const statuses = [result.amount.status, result.bank.status, result.reference.status, result.account.status];
  
  if (statuses.includes("MISMATCH")) {
    result.overallStatus = "MISMATCH";
  } else if (statuses.includes("NEEDS_REVIEW") || result.amount.status === "NOT_AVAILABLE") {
    result.overallStatus = "NEEDS_REVIEW";
  } else {
    result.overallStatus = "MATCH";
  }

  return result;
}
`;

fs.appendFileSync('src/services/financialEngine.ts', code);
