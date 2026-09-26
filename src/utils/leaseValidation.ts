export interface LeaseChequeScheduleValidationResult {
  valid: boolean;
  requiredRent: number;
  totalValidCheques: number;
  difference: number;
  missingInstallments: any[];
  unassignedCheques: any[];
  duplicateCheques: any[];
  amountMismatches: any[];
  needsReview: any[];
  invalidCheques: any[];
  blockingIssues: string[];
  warnings: string[];
}

export function validateLeaseChequeSchedule(
  installments: Array<{
    amount: number;
    chequeNumber?: string;
    bankName?: string;
    dueDate?: string;
    status?: string;
    paymentMethod?: string;
  }>,
  annualRent: number,
  language: "ar" | "en" = "ar"
): LeaseChequeScheduleValidationResult {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const missingInstallments: any[] = [];
  const unassignedCheques: any[] = [];
  const amountMismatches: any[] = [];
  const needsReview: any[] = [];
  const invalidCheques: any[] = [];

  let totalValidCheques = 0;

  installments.forEach((inst, idx) => {
    const isCheque = !inst.paymentMethod || inst.paymentMethod === "CHEQUE";
    if (isCheque) {
      if (!inst.chequeNumber || inst.chequeNumber.trim() === "") {
        missingInstallments.push({ index: idx + 1, dueDate: inst.dueDate, amount: inst.amount });
        blockingIssues.push(
          language === "ar"
            ? `الدفعة رقم #${idx + 1} مفقود بيانات شيكها أو رقم الشيك فارغ.`
            : `Installment #${idx + 1} is missing cheque details or cheque number is empty.`
        );
      } else if (!inst.bankName || inst.bankName.trim() === "") {
        needsReview.push({ index: idx + 1, issue: "Missing bank name" });
      }
    }

    if (inst.amount <= 0) {
      invalidCheques.push({ index: idx + 1, reason: "Zero or negative amount" });
      blockingIssues.push(
        language === "ar"
          ? `الدفعة رقم #${idx + 1} لها مبلغ غير صالح (${inst.amount}).`
          : `Installment #${idx + 1} has invalid amount (${inst.amount}).`
      );
    } else {
      totalValidCheques += Number(inst.amount) || 0;
    }
  });

  const difference = Math.round((totalValidCheques - annualRent) * 100) / 100;

  if (Math.abs(difference) > 0.01) {
    if (totalValidCheques < annualRent) {
      blockingIssues.push(
        language === "ar"
          ? `إجمالي مبالغ الشيكات (${totalValidCheques.toLocaleString()} AED) أقل من إجمالي الإيجار السنوي المعتمد (${annualRent.toLocaleString()} AED) بمبلغ ${Math.abs(difference).toLocaleString()} AED.`
          : `Total cheques amount (${totalValidCheques.toLocaleString()} AED) is less than annual rent (${annualRent.toLocaleString()} AED) by ${Math.abs(difference).toLocaleString()} AED.`
      );
    } else {
      blockingIssues.push(
        language === "ar"
          ? `إجمالي مبالغ الشيكات (${totalValidCheques.toLocaleString()} AED) يتجاوز إجمالي الإيجار السنوي المعتمد (${annualRent.toLocaleString()} AED) بمبلغ ${Math.abs(difference).toLocaleString()} AED.`
          : `Total cheques amount (${totalValidCheques.toLocaleString()} AED) exceeds annual rent (${annualRent.toLocaleString()} AED) by ${Math.abs(difference).toLocaleString()} AED.`
      );
    }
  }

  const valid = blockingIssues.length === 0;

  return {
    valid,
    requiredRent: annualRent,
    totalValidCheques,
    difference,
    missingInstallments,
    unassignedCheques,
    duplicateCheques: [],
    amountMismatches,
    needsReview,
    invalidCheques,
    blockingIssues,
    warnings,
  };
}
