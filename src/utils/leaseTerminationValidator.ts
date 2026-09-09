/**
 * EMIRATES FALCON ERP — LEASE TERMINATION & EARLY TERMINATION GOVERNANCE
 * Centralized Validation, Clearance Enforcement, and 30% Early Termination Fee Calculator
 */

import {
  Lease,
  Cheque,
  CollectionRecord,
  PropertyExpenseRecord,
  ElectronicArchiveItem,
} from "../types";

export interface LeaseTerminationValidationOptions {
  lease: Lease;
  effectiveTerminationDate: string;
  cheques: Cheque[];
  collections?: CollectionRecord[];
  propertyExpenses?: PropertyExpenseRecord[];
  archive?: ElectronicArchiveItem[];
  waiveEarlyTerminationFee?: boolean;
  isAuthorizedToWaive?: boolean;
  waiverReason?: string;
}

export interface TerminationObligationItem {
  id: string;
  type: "BOUNCED_CHEQUE" | "DUE_CHEQUE" | "OVERDUE_CHEQUE" | "UNPAID_MAINTENANCE" | "OTHER_DEBT";
  titleAr: string;
  titleEn: string;
  amount: number;
  details: string;
}

export interface LeaseTerminationValidationResult {
  isEligibleForTermination: boolean;
  blockReasonsAr: string[];
  blockReasonsEn: string[];
  isEarlyTermination: boolean;
  daysRemainingInContract: number;
  scheduledEndDate: string;
  effectiveTerminationDate: string;
  
  // Future Contract Value & 30% Fee
  remainingFutureContractValue: number;
  earlyTerminationFeeRate: number; // 0.30 (30%)
  calculatedEarlyTerminationFee: number;
  appliedEarlyTerminationFee: number;
  isFeeWaived: boolean;
  waiverReason?: string;
  
  // Clearances
  electricityClearanceAttached: boolean;
  electricityClearanceItem?: ElectronicArchiveItem | null;
  municipalityClearanceAttached: boolean;
  municipalityClearanceItem?: ElectronicArchiveItem | null;
  
  // Outstanding Financial Obligations
  outstandingObligations: TerminationObligationItem[];
  totalOutstandingObligations: number;
}

/**
 * Calculates remaining future contract rent strictly from future contractual rent
 * remaining after the effective termination date.
 */
export function calculateRemainingFutureContractValue(
  lease: Lease,
  effectiveTerminationDate: string,
  cheques: Cheque[] = []
): number {
  if (!lease) return 0;
  
  const termDate = new Date(effectiveTerminationDate);
  const endDate = new Date(lease.endDate);
  
  if (isNaN(termDate.getTime()) || isNaN(endDate.getTime()) || termDate >= endDate) {
    return 0; // Natural expiry or past end date
  }

  // Method 1: If installment schedule exists, sum installments with due dates strictly after termination date
  if (lease.installments && lease.installments.length > 0) {
    const futureInstallments = lease.installments.filter((inst) => {
      const instDate = new Date(inst.dueDate);
      return !isNaN(instDate.getTime()) && instDate > termDate && inst.status !== "COLLECTED" && inst.status !== "WAIVED";
    });

    if (futureInstallments.length > 0) {
      return futureInstallments.reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0);
    }
  }

  // Method 2: If cheques exist linked to lease, sum post-dated cheques after termination date
  const leaseCheques = cheques.filter((c) => c.leaseId === lease.id && c.status !== "CANCELLED" && c.status !== "REPLACED");
  const futureCheques = leaseCheques.filter((c) => {
    const chqDate = new Date(c.dueDate || c.chequeDate);
    return !isNaN(chqDate.getTime()) && chqDate > termDate && c.status !== "COLLECTED";
  });

  if (futureCheques.length > 0) {
    return futureCheques.reduce((sum, c) => sum + (Number(c.outstanding ?? c.amount) || 0), 0);
  }

  // Method 3: Pro-rata calculation based on remaining days of annual rent / contract duration
  const startDate = new Date(lease.startDate);
  const totalDurationMs = endDate.getTime() - startDate.getTime();
  const remainingDurationMs = endDate.getTime() - termDate.getTime();

  if (totalDurationMs > 0 && remainingDurationMs > 0) {
    const ratio = Math.min(1, Math.max(0, remainingDurationMs / totalDurationMs));
    const totalContractRent = lease.annualRent || 0;
    return Math.round(totalContractRent * ratio);
  }

  return 0;
}

/**
 * Validates whether a lease can be terminated based on:
 * 1. Absence of unpaid/bounced/overdue cheques or actual unpaid tenant obligations.
 * 2. Presence of Electricity Clearance & Municipality Clearance.
 * 3. 30% Early Termination Fee calculation (Locked rule: 30% on remaining future contract value).
 */
export function validateLeaseTermination(
  options: LeaseTerminationValidationOptions
): LeaseTerminationValidationResult {
  const {
    lease,
    effectiveTerminationDate,
    cheques = [],
    propertyExpenses = [],
    archive = [],
    waiveEarlyTerminationFee = false,
    isAuthorizedToWaive = false,
    waiverReason = "",
  } = options;

  const blockReasonsAr: string[] = [];
  const blockReasonsEn: string[] = [];
  const outstandingObligations: TerminationObligationItem[] = [];

  const termDate = new Date(effectiveTerminationDate);
  const endDate = new Date(lease.endDate);
  const isEarlyTermination = !isNaN(termDate.getTime()) && !isNaN(endDate.getTime()) && termDate < endDate;
  const daysRemainingInContract = isEarlyTermination
    ? Math.max(0, Math.ceil((endDate.getTime() - termDate.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  // 1. Check for Bounced Cheques
  const leaseCheques = cheques.filter((c) => c.leaseId === lease.id);
  const bouncedCheques = leaseCheques.filter(
    (c) => c.status === "BOUNCED" && (c.outstanding === undefined || c.outstanding > 0)
  );

  bouncedCheques.forEach((c) => {
    const amount = c.outstanding !== undefined ? c.outstanding : c.amount;
    outstandingObligations.push({
      id: c.id,
      type: "BOUNCED_CHEQUE",
      titleAr: `شيك مرتجع #${c.chequeNumber}`,
      titleEn: `Bounced Cheque #${c.chequeNumber}`,
      amount,
      details: `البنك: ${c.bankName || "N/A"} | تاريخ الاستحقاق: ${c.dueDate || c.chequeDate}`,
    });
    blockReasonsAr.push(`يوجد شيك مرتجع غير مسدد #${c.chequeNumber} بمبلغ ${amount.toLocaleString()} د.إ.`);
    blockReasonsEn.push(`Unsettled bounced cheque #${c.chequeNumber} for AED ${amount.toLocaleString()}.`);
  });

  // 2. Check for Overdue / Due Cheques prior to or on termination date that are not collected or cancelled
  const overdueCheques = leaseCheques.filter((c) => {
    if (c.status === "COLLECTED" || c.status === "CANCELLED" || c.status === "REPLACED" || c.status === "BOUNCED") {
      return false;
    }
    const chqDueDate = new Date(c.dueDate || c.chequeDate);
    return !isNaN(chqDueDate.getTime()) && chqDueDate <= termDate;
  });

  overdueCheques.forEach((c) => {
    const amount = c.outstanding !== undefined ? c.outstanding : c.amount;
    outstandingObligations.push({
      id: c.id,
      type: "OVERDUE_CHEQUE",
      titleAr: `شيك مستحق غير محصل #${c.chequeNumber}`,
      titleEn: `Uncollected Due Cheque #${c.chequeNumber}`,
      amount,
      details: `تاريخ الاستحقاق: ${c.dueDate || c.chequeDate}`,
    });
    blockReasonsAr.push(`يوجد شيك مستحق قبل تاريخ الفسخ غير محصل #${c.chequeNumber} بمبلغ ${amount.toLocaleString()} د.إ.`);
    blockReasonsEn.push(`Uncollected due cheque before termination date #${c.chequeNumber} for AED ${amount.toLocaleString()}.`);
  });

  // 3. Check for Actual Approved Unpaid Tenant Maintenance Expenses (NOT estimated costs!)
  const tenantMaintenanceExpenses = propertyExpenses.filter(
    (exp) =>
      exp.leaseId === lease.id &&
      exp.costBearer === "TENANT" &&
      exp.status !== "PAID" &&
      exp.status !== "CANCELLED"
  );

  tenantMaintenanceExpenses.forEach((exp) => {
    const expenseNum = (exp as any).invoiceNumber || exp.expenseNumber || exp.id;
    outstandingObligations.push({
      id: exp.id,
      type: "UNPAID_MAINTENANCE",
      titleAr: `فاتورة صيانة فعلية على المستأجر #${expenseNum}`,
      titleEn: `Unpaid Actual Tenant Maintenance #${expenseNum}`,
      amount: exp.totalAmount || exp.amount,
      details: exp.description || "مصروف صيانة معتمد",
    });
    blockReasonsAr.push(`توجد فاتورة صيانة فعلية معتمدة على المستأجر غير مسددة بمبلغ ${(exp.totalAmount || exp.amount).toLocaleString()} د.إ.`);
    blockReasonsEn.push(`Unpaid approved actual tenant maintenance invoice for AED ${(exp.totalAmount || exp.amount).toLocaleString()}.`);
  });

  // 4. Check Clearance Documents in Electronic Archive
  const leaseArchive = archive.filter(
    (item) => item.entityId === lease.id || item.recordId === lease.id || item.tags?.includes(lease.id) || item.tags?.includes(lease.leaseNumber)
  );

  const electricityDoc = leaseArchive.find(
    (item) =>
      item.tags?.includes("ELECTRICITY_CLEARANCE") ||
      item.fileName?.includes("كهرباء") ||
      item.recordTitle?.includes("كهرباء") ||
      item.fileName?.toLowerCase().includes("sewa") ||
      item.fileName?.toLowerCase().includes("dewa") ||
      item.fileName?.toLowerCase().includes("fewa") ||
      item.fileName?.toLowerCase().includes("electricity") ||
      item.recordTitle?.toLowerCase().includes("electricity") ||
      (item as any).title?.includes("كهرباء")
  );

  const municipalityDoc = leaseArchive.find(
    (item) =>
      item.tags?.includes("MUNICIPALITY_CLEARANCE") ||
      item.fileName?.includes("بلدية") ||
      item.fileName?.includes("توثيق") ||
      item.fileName?.includes("إيجاري") ||
      item.recordTitle?.includes("بلدية") ||
      item.recordTitle?.includes("توثيق") ||
      item.recordTitle?.includes("إيجاري") ||
      item.fileName?.toLowerCase().includes("municipality") ||
      item.fileName?.toLowerCase().includes("ejari") ||
      item.recordTitle?.toLowerCase().includes("municipality") ||
      (item as any).title?.includes("بلدية")
  );

  const electricityClearanceAttached = !!electricityDoc;
  const municipalityClearanceAttached = !!municipalityDoc;

  if (!electricityClearanceAttached) {
    blockReasonsAr.push("شهادة براءة ذمة هيئة الكهرباء والمياه (SEWA / DEWA / FEWA) غير مرفقة.");
    blockReasonsEn.push("Electricity & Water Authority clearance certificate is missing.");
  }

  if (!municipalityClearanceAttached) {
    blockReasonsAr.push("شهادة براءة ذمة البلدية / إلغاء التوثيق أو إيجاري غير مرفقة.");
    blockReasonsEn.push("Municipality / Ejari lease cancellation clearance certificate is missing.");
  }

  // 5. Early Termination Fee Calculation (Strict 30% locked rule)
  const remainingFutureContractValue = isEarlyTermination
    ? calculateRemainingFutureContractValue(lease, effectiveTerminationDate, cheques)
    : 0;

  const earlyTerminationFeeRate = 0.30; // Strictly 30%
  const calculatedEarlyTerminationFee = isEarlyTermination
    ? Math.round(remainingFutureContractValue * earlyTerminationFeeRate * 100) / 100
    : 0;

  let appliedEarlyTerminationFee = calculatedEarlyTerminationFee;
  let isFeeWaived = false;

  if (isEarlyTermination && waiveEarlyTerminationFee) {
    if (isAuthorizedToWaive) {
      appliedEarlyTerminationFee = 0;
      isFeeWaived = true;
    } else {
      blockReasonsAr.push("غير مصرح لك بإعفاء غرامة الفسخ المبكر (30%). تتطلب صلاحية إدارة معتمدة مع بيان السبب.");
      blockReasonsEn.push("Unauthorized to waive 30% early termination fee. Management approval & reason required.");
    }
  }

  const totalOutstandingObligations = outstandingObligations.reduce((sum, item) => sum + item.amount, 0);
  const isEligibleForTermination = blockReasonsAr.length === 0;

  return {
    isEligibleForTermination,
    blockReasonsAr,
    blockReasonsEn,
    isEarlyTermination,
    daysRemainingInContract,
    scheduledEndDate: lease.endDate,
    effectiveTerminationDate,
    remainingFutureContractValue,
    earlyTerminationFeeRate,
    calculatedEarlyTerminationFee,
    appliedEarlyTerminationFee,
    isFeeWaived,
    waiverReason: isFeeWaived ? waiverReason : undefined,
    electricityClearanceAttached,
    electricityClearanceItem: electricityDoc || null,
    municipalityClearanceAttached,
    municipalityClearanceItem: municipalityDoc || null,
    outstandingObligations,
    totalOutstandingObligations,
  };
}
