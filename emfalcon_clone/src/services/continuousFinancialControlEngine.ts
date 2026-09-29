/**
 * PHASE 51: CONTINUOUS FINANCIAL CONTROL, AUDIT & EXECUTIVE INTEGRITY CENTER
 * Emirates Falcon Real Estate ERP
 * 
 * Strict Read-Only Continuous Control Engine.
 * Evaluates the current financial integrity across all modules without modifying
 * any financial records or balances.
 * 
 * Complies with the Master Financial Invariant:
 * POSTED FINANCIAL TRANSACTIONS ARE IMMUTABLE.
 * NO USER CAN EDIT OR DELETE THEM.
 * CORRECTIONS OCCUR EXCLUSIVELY VIA REVERSAL OR ADJUSTMENT WORKFLOWS.
 */

import {
  FinancialPeriod,
  JournalEntryRecord,
  CollectionRecord,
  OwnerTransferRecord,
  PropertyExpenseRecord,
  Cheque,
  RentalCase,
  FinancialReversalRecord,
  FinancialAdjustmentRecord,
  VatRateRecord,
  Owner,
  Tenant,
  Lease,
  Unit,
  Property,
  PaymentAllocation,
  CommissionObligation,
  AuditLogEntry,
  PeriodReconciliationReport,
  ForensicClosingCertification,
  FinancialIntegrityStatus,
  FinancialControlException,
  ContinuousFinancialControlSummary,
  ContinuousControlForensicSnapshot,
  DailyDepositRecord,
} from "../types";


export interface ContinuousFinancialControlInput {
  financialPeriods?: FinancialPeriod[];
  journalEntries?: JournalEntryRecord[];
  collections?: CollectionRecord[];
  ownerTransfers?: OwnerTransferRecord[];
  propertyExpenses?: PropertyExpenseRecord[];
  dailyDeposits?: DailyDepositRecord[];
  cheques?: Cheque[];
  cases?: RentalCase[];
  financialReversals?: FinancialReversalRecord[];
  financialAdjustments?: FinancialAdjustmentRecord[];
  vatRates?: VatRateRecord[];
  owners?: Owner[];
  tenants?: Tenant[];
  leases?: Lease[];
  units?: Unit[];
  properties?: Property[];
  paymentAllocations?: PaymentAllocation[];
  commissions?: CommissionObligation[];
  auditLogs?: AuditLogEntry[];
  reconciliationReports?: PeriodReconciliationReport[];
  forensicCertifications?: ForensicClosingCertification[];
  currentUserId?: string;
  currentUserName?: string;
}

function roundToTwo(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Generates a deterministic forensic snapshot hash for continuous monitoring.
 */
export function generateContinuousControlSnapshotHash(
  summary: Omit<ContinuousFinancialControlSummary, "snapshotHash">
): string {
  const payload = [
    summary.overallIntegrityStatus,
    summary.totalCollections,
    summary.totalOwnerPayables,
    summary.totalOwnerTransfers,
    summary.totalDailyDeposits,
    summary.outstandingChequesAmount,
    summary.returnedChequesAmount,
    summary.activeLegalCasesAmount,
    summary.vatLiability,
    summary.reversalsCount,
    summary.adjustmentsCount,
    summary.criticalExceptionsCount,
    summary.warningExceptionsCount,
    summary.currentOpenPeriod?.id || "NO_OPEN_PERIOD",
    summary.isLocked ? "LOCKED" : "UNLOCKED",
  ].join("|");

  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `CC-FSH-${Math.abs(hash).toString(16).toUpperCase().padStart(8, "0")}`;
}

/**
 * Verifies if a forensic snapshot hash is valid and untampered.
 */
export function verifyContinuousControlSnapshotHash(snapshot: ContinuousControlForensicSnapshot): boolean {
  if (!snapshot || !snapshot.summary || !snapshot.snapshotHash) {
    return false;
  }
  const expectedHash = generateContinuousControlSnapshotHash(snapshot.summary);
  return snapshot.snapshotHash === expectedHash;
}

/**
 * Main Authoritative Continuous Financial Control Engine.
 * STRICTLY READ-ONLY.
 */
export function evaluateContinuousFinancialControl(
  input: ContinuousFinancialControlInput
): ContinuousFinancialControlSummary {
  const {
    financialPeriods = [],
    journalEntries = [],
    collections = [],
    ownerTransfers = [],
    propertyExpenses = [],
    dailyDeposits = [],
    cheques = [],
    cases = [],
    financialReversals = [],
    financialAdjustments = [],
    vatRates = [],
    owners = [],
    commissions = [],
    reconciliationReports = [],
    forensicCertifications = [],
    currentUserId,
    currentUserName,
  } = input;

  const now = new Date().toISOString();
  const exceptions: FinancialControlException[] = [];

  let moduleGlStatus: "HEALTHY" | "WARNING" | "CRITICAL" = "HEALTHY";
  let moduleColStatus: "HEALTHY" | "WARNING" | "CRITICAL" = "HEALTHY";
  let moduleOwnerStatus: "HEALTHY" | "WARNING" | "CRITICAL" = "HEALTHY";
  let moduleDepositStatus: "HEALTHY" | "WARNING" | "CRITICAL" = "HEALTHY";
  let moduleChequeStatus: "HEALTHY" | "WARNING" | "CRITICAL" = "HEALTHY";
  let moduleVatStatus: "HEALTHY" | "WARNING" | "CRITICAL" = "HEALTHY";
  let modulePeriodStatus: "HEALTHY" | "WARNING" | "CRITICAL" = "HEALTHY";

  // -------------------------------------------------------------
  // 1. GENERAL LEDGER & INDIVIDUAL JOURNAL ENTRIES BALANCE
  // -------------------------------------------------------------
  const postedJournals = journalEntries.filter((j) => j.status === "POSTED");
  let totalGlDebit = 0;
  let totalGlCredit = 0;
  const seenJournalReferences = new Set<string>();

  postedJournals.forEach((j) => {
    totalGlDebit += j.totalDebit || 0;
    totalGlCredit += j.totalCredit || 0;

    // Check individual entry balance
    const diff = roundToTwo(Math.abs((j.totalDebit || 0) - (j.totalCredit || 0)));
    if (diff > 0.01) {
      moduleGlStatus = "CRITICAL";
      exceptions.push({
        id: `exc-gl-unbalanced-${j.id}`,
        category: "UNBALANCED_JOURNAL",
        severity: "CRITICAL",
        detectedAt: now,
        affectedModule: "GENERAL_LEDGER",
        affectedRecordReference: j.entryNumber || j.id,
        financialAmount: diff,
        descriptionAr: `قيد اليومية ${j.entryNumber || j.id} غير متوازن (المدين: ${j.totalDebit}، الدائن: ${j.totalCredit}) بفارق ${diff} درهم`,
        descriptionEn: `Journal entry ${j.entryNumber || j.id} is unbalanced (Debit: ${j.totalDebit}, Credit: ${j.totalCredit}) with difference ${diff} AED`,
        recommendedGovernanceAction: "ADJUSTMENT",
        status: "DETECTED",
      });
    }

    // Check line items match total
    if (j.lines && j.lines.length > 0) {
      const sumLineDebit = roundToTwo(j.lines.reduce((s, l) => s + (l.debit || 0), 0));
      const sumLineCredit = roundToTwo(j.lines.reduce((s, l) => s + (l.credit || 0), 0));
      if (
        Math.abs(sumLineDebit - (j.totalDebit || 0)) > 0.01 ||
        Math.abs(sumLineCredit - (j.totalCredit || 0)) > 0.01
      ) {
        moduleGlStatus = "CRITICAL";
        exceptions.push({
          id: `exc-gl-lines-mismatch-${j.id}`,
          category: "UNBALANCED_JOURNAL",
          severity: "CRITICAL",
          detectedAt: now,
          affectedModule: "GENERAL_LEDGER",
          affectedRecordReference: j.entryNumber || j.id,
          financialAmount: roundToTwo(Math.abs(sumLineDebit - sumLineCredit)),
          descriptionAr: `تفاصيل بنود القيد ${j.entryNumber || j.id} لا تطابق إجمالي القيد`,
          descriptionEn: `Line items sum for journal ${j.entryNumber || j.id} does not match entry totals`,
          recommendedGovernanceAction: "ADJUSTMENT",
          status: "DETECTED",
        });
      }
    }

    // Check duplicate reference numbers
    if (j.reference) {
      if (seenJournalReferences.has(j.reference)) {
        exceptions.push({
          id: `exc-gl-dup-ref-${j.id}`,
          category: "DUPLICATE_RECEIPT",
          severity: "HIGH",
          detectedAt: now,
          affectedModule: "GENERAL_LEDGER",
          affectedRecordReference: j.reference,
          descriptionAr: `تكرار مرجع القيد المحاسبي: ${j.reference}`,
          descriptionEn: `Duplicate journal reference detected: ${j.reference}`,
          recommendedGovernanceAction: "INVESTIGATION",
          status: "DETECTED",
        });
      } else {
        seenJournalReferences.add(j.reference);
      }
    }
  });

  const totalGlDiff = roundToTwo(Math.abs(totalGlDebit - totalGlCredit));
  if (totalGlDiff > 0.01) {
    moduleGlStatus = "CRITICAL";
    exceptions.push({
      id: `exc-gl-total-imbalance`,
      category: "UNBALANCED_JOURNAL",
      severity: "CRITICAL",
      detectedAt: now,
      affectedModule: "GENERAL_LEDGER",
      affectedRecordReference: "GL_MASTER_BALANCE",
      financialAmount: totalGlDiff,
      descriptionAr: `عدم توازن إجمالي دفتر الأستاذ العام بمبلغ ${totalGlDiff} درهم (إجمالي المدين: ${totalGlDebit}، إجمالي الدائن: ${totalGlCredit})`,
      descriptionEn: `General Ledger Master imbalance of ${totalGlDiff} AED (Total Debit: ${totalGlDebit}, Total Credit: ${totalGlCredit})`,
      recommendedGovernanceAction: "ADJUSTMENT",
      status: "DETECTED",
    });
  }

  // -------------------------------------------------------------
  // 2. COLLECTIONS VS JOURNAL ENTRIES & RECEIPT INTEGRITY
  // -------------------------------------------------------------
  let totalCollections = 0;
  const seenReceiptNumbers = new Set<string>();

  collections.forEach((col) => {
    const amount = col.amountEntered || 0;
    const isReversed = col.isReversed || (col as any).status === "REVERSED" || (col as any).status === "CANCELLED";

    if (!isReversed) {
      totalCollections += amount;

      // Check if collection has a corresponding posted journal entry
      const hasJournal = postedJournals.some(
        (j) => (j.sourceId === col.id || j.reference === col.receiptNumber) && j.status === "POSTED"
      );
      if (!hasJournal) {
        if (moduleColStatus !== "CRITICAL") moduleColStatus = "WARNING";
        exceptions.push({
          id: `exc-col-no-journal-${col.id}`,
          category: "ORPHAN_FINANCIAL_RECORD",
          severity: "HIGH",
          detectedAt: now,
          affectedModule: "COLLECTIONS",
          affectedRecordReference: col.receiptNumber || col.id,
          financialAmount: amount,
          descriptionAr: `سند قبض ${col.receiptNumber || col.id} بمبلغ ${amount.toLocaleString()} درهم بدون قيد يومية مرحل`,
          descriptionEn: `Collection ${col.receiptNumber || col.id} of ${amount} AED lacks a posted journal entry`,
          recommendedGovernanceAction: "RECONCILIATION",
          status: "DETECTED",
        });
      }
    }

    // Check duplicate receipts
    if (col.receiptNumber) {
      if (seenReceiptNumbers.has(col.receiptNumber)) {
        moduleColStatus = "CRITICAL";
        exceptions.push({
          id: `exc-col-dup-receipt-${col.id}`,
          category: "DUPLICATE_RECEIPT",
          severity: "CRITICAL",
          detectedAt: now,
          affectedModule: "COLLECTIONS",
          affectedRecordReference: col.receiptNumber,
          financialAmount: amount,
          descriptionAr: `رقم سند القبض مكرر في النظام: ${col.receiptNumber}`,
          descriptionEn: `Duplicate collection receipt number detected: ${col.receiptNumber}`,
          recommendedGovernanceAction: "INVESTIGATION",
          status: "DETECTED",
        });
      } else {
        seenReceiptNumbers.add(col.receiptNumber);
      }
    }

    // Check invalid amount
    if (amount <= 0 && !isReversed) {
      exceptions.push({
        id: `exc-col-invalid-amount-${col.id}`,
        category: "DUPLICATE_COLLECTION",
        severity: "HIGH",
        detectedAt: now,
        affectedModule: "COLLECTIONS",
        affectedRecordReference: col.receiptNumber || col.id,
        financialAmount: amount,
        descriptionAr: `قيمة سند القبض غير صالحة (${amount} درهم)`,
        descriptionEn: `Invalid collection amount (${amount} AED)`,
        recommendedGovernanceAction: "INVESTIGATION",
        status: "DETECTED",
      });
    }
  });

  // -------------------------------------------------------------
  // 3. OWNER PAYABLES & OWNER TRANSFERS
  // -------------------------------------------------------------
  let totalOwnerPayables = 0;
  let totalOwnerTransfers = 0;
  const seenTransferNumbers = new Set<string>();

  // Process Owner Transfers
  ownerTransfers.forEach((tr) => {
    const isPaid = tr.status === "PAID" || tr.status === "COMPLETED";
    if (isPaid) {
      totalOwnerTransfers += tr.amount || 0;

      // Verify owner exists
      if (tr.ownerId && !owners.some((o) => o.id === tr.ownerId)) {
        if (moduleOwnerStatus !== "CRITICAL") moduleOwnerStatus = "WARNING";
        exceptions.push({
          id: `exc-tr-unknown-owner-${tr.id}`,
          category: "OWNER_TRANSFER_MISMATCH",
          severity: "HIGH",
          detectedAt: now,
          affectedModule: "OWNER_TRANSFERS",
          affectedRecordReference: tr.transferNumber || tr.id,
          financialAmount: tr.amount,
          descriptionAr: `تحويل مالك ${tr.transferNumber || tr.id} مرتبط بمالك غير موجود بالنظام`,
          descriptionEn: `Owner transfer ${tr.transferNumber || tr.id} linked to non-existent owner`,
          recommendedGovernanceAction: "INVESTIGATION",
          status: "DETECTED",
        });
      }
    }

    if (tr.transferNumber) {
      if (seenTransferNumbers.has(tr.transferNumber)) {
        moduleOwnerStatus = "CRITICAL";
        exceptions.push({
          id: `exc-tr-dup-number-${tr.id}`,
          category: "OWNER_TRANSFER_MISMATCH",
          severity: "CRITICAL",
          detectedAt: now,
          affectedModule: "OWNER_TRANSFERS",
          affectedRecordReference: tr.transferNumber,
          financialAmount: tr.amount,
          descriptionAr: `تكرار رقم تحويل المالك: ${tr.transferNumber}`,
          descriptionEn: `Duplicate owner transfer number detected: ${tr.transferNumber}`,
          recommendedGovernanceAction: "INVESTIGATION",
          status: "DETECTED",
        });
      } else {
        seenTransferNumbers.add(tr.transferNumber);
      }
    }
  });

  // Calculate Owner Payables across owners
  owners.forEach((owner) => {
    const ownerName = owner.nameAr || owner.nameEn || owner.fullNameAr || owner.code || owner.id;
    const ownerRentCollected = collections
      .filter(
        (c) =>
          c.ownerId === owner.id &&
          !c.isReversed &&
          (c as any).status !== "REVERSED" &&
          (c as any).status !== "CANCELLED"
      )
      .reduce((s, c) => s + (c.amountEntered || 0), 0);

    const ownerExpenses = propertyExpenses
      .filter(
        (e) =>
          e.ownerId === owner.id &&
          (e.costBearer === "OWNER" || !e.costBearer) &&
          (e as any).status !== "REVERSED" &&
          (e as any).status !== "CANCELLED"
      )
      .reduce((s, e) => s + (e.totalAmount || e.amount || 0), 0);

    const ownerAdminFees = commissions
      .filter(
        (m) =>
          m.ownerId === owner.id &&
          (m as any).status !== "CANCELLED" &&
          (m as any).status !== "REVERSED"
      )
      .reduce((s, m) => s + (m.totalCommissionAmount || 0), 0);

    const ownerPaidTransfers = ownerTransfers
      .filter(
        (t) =>
          t.ownerId === owner.id &&
          (t.status === "PAID" || t.status === "COMPLETED")
      )
      .reduce((s, t) => s + (t.amount || 0), 0);

    const computedPayable = roundToTwo(ownerRentCollected - ownerExpenses - ownerAdminFees - ownerPaidTransfers);
    totalOwnerPayables += Math.max(0, computedPayable);

    // If payable is negative with significant discrepancy
    if (computedPayable < -100) {
      if (moduleOwnerStatus !== "CRITICAL") moduleOwnerStatus = "WARNING";
      exceptions.push({
        id: `exc-owner-neg-payable-${owner.id}`,
        category: "OWNER_PAYABLE_MISMATCH",
        severity: "HIGH",
        detectedAt: now,
        affectedModule: "OWNER_ACCOUNTS",
        affectedRecordReference: ownerName,
        financialAmount: Math.abs(computedPayable),
        descriptionAr: `رصيد مستحقات المالك (${ownerName}) بالسالب بمقدار ${Math.abs(computedPayable).toLocaleString()} درهم (تجاوز المدفوع للمستحق)`,
        descriptionEn: `Negative owner payable balance for (${ownerName}) of ${Math.abs(computedPayable)} AED`,
        recommendedGovernanceAction: "INVESTIGATION",
        status: "DETECTED",
      });
    }
  });

  // -------------------------------------------------------------
  // 4. DAILY DEPOSITS INTEGRITY
  // -------------------------------------------------------------
  let totalDailyDeposits = 0;
  const seenDepositReferences = new Set<string>();

  dailyDeposits.forEach((dep) => {
    const isCompleted = dep.status === "VERIFIED" || dep.status === "RECONCILED" || !dep.status;
    if (isCompleted) {
      totalDailyDeposits += dep.amount || 0;
    }

    if (dep.depositReference || dep.depositSlipNumber) {
      const ref = dep.depositReference || dep.depositSlipNumber!;
      if (seenDepositReferences.has(ref)) {
        moduleDepositStatus = "CRITICAL";
        exceptions.push({
          id: `exc-dep-dup-ref-${dep.id || ref}`,
          category: "DAILY_DEPOSIT_MISMATCH",
          severity: "CRITICAL",
          detectedAt: now,
          affectedModule: "DAILY_DEPOSITS",
          affectedRecordReference: ref,
          financialAmount: dep.amount,
          descriptionAr: `تكرار مرجع الإيداع البنكي: ${ref}`,
          descriptionEn: `Duplicate daily deposit reference detected: ${ref}`,
          recommendedGovernanceAction: "INVESTIGATION",
          status: "DETECTED",
        });
      } else {
        seenDepositReferences.add(ref);
      }
    }
  });

  // -------------------------------------------------------------
  // 5. CHEQUES, RETURNED CHEQUES & LEGAL CASES
  // -------------------------------------------------------------
  let outstandingChequesAmount = 0;
  let outstandingChequesCount = 0;
  let returnedChequesAmount = 0;
  let returnedChequesCount = 0;
  let activeLegalCasesAmount = 0;
  let activeLegalCasesCount = 0;

  cheques.forEach((ch) => {
    const isOutstanding =
      ch.status === "PENDING" ||
      ch.status === "POST_DATED" ||
      ch.status === "DEPOSITED" ||
      ch.status === "COLLECTED";

    if (isOutstanding) {
      outstandingChequesAmount += ch.amount || 0;
      outstandingChequesCount++;
    }

    const isReturned =
      ch.status === "BOUNCED" ||
      (ch.status as string) === "RETURNED" ||
      ch.status === "UNDER_LEGAL";

    if (isReturned) {
      returnedChequesAmount += ch.amount || 0;
      returnedChequesCount++;

      // Check if returned cheque has legal case or reversal
      const hasCase = cases.some(
        (cs) => cs.linkedChequeIds && cs.linkedChequeIds.includes(ch.id)
      );
      const hasReversal = financialReversals.some(
        (rev) => rev.targetId === ch.id
      );

      if (!hasCase && !hasReversal && ch.status === "BOUNCED") {
        if (moduleChequeStatus !== "CRITICAL") moduleChequeStatus = "WARNING";
        exceptions.push({
          id: `exc-ch-unresolved-bounce-${ch.id}`,
          category: "RETURNED_CHEQUE_EXCEPTION",
          severity: "MEDIUM",
          detectedAt: now,
          affectedModule: "CHEQUES",
          affectedRecordReference: ch.chequeNumber || ch.id,
          financialAmount: ch.amount,
          descriptionAr: `شيك مرتجع برقم ${ch.chequeNumber} بمبلغ ${ch.amount?.toLocaleString()} درهم غير مربوط بقضية قانونية أو حركة عكس`,
          descriptionEn: `Bounced cheque ${ch.chequeNumber} (${ch.amount} AED) has no linked legal case or financial reversal`,
          recommendedGovernanceAction: "INVESTIGATION",
          status: "DETECTED",
        });
      }
    }
  });

  // Evaluate Legal Cases
  cases.forEach((cs) => {
    const isActive = cs.status !== "CLOSED" && cs.status !== "SETTLED" && cs.status !== "ARCHIVED";
    const outstanding = cs.outstanding !== undefined ? cs.outstanding : (cs.claimAmount || 0) - (cs.totalPaid || 0);

    if (isActive) {
      activeLegalCasesAmount += outstanding;
      activeLegalCasesCount++;
    }

    // Mathematical verification of case balance
    const expectedOutstanding = roundToTwo((cs.claimAmount || 0) - (cs.totalPaid || cs.paidAmount || 0));
    if (Math.abs(expectedOutstanding - (cs.outstanding ?? expectedOutstanding)) > 1) {
      if (moduleChequeStatus !== "CRITICAL") moduleChequeStatus = "WARNING";
      exceptions.push({
        id: `exc-case-balance-mismatch-${cs.id}`,
        category: "LEGAL_CASE_BALANCE_EXCEPTION",
        severity: "HIGH",
        detectedAt: now,
        affectedModule: "LEGAL_CASES",
        affectedRecordReference: cs.caseNumber || cs.id,
        financialAmount: Math.abs(expectedOutstanding - (cs.outstanding || 0)),
        descriptionAr: `عدم تطابق رصيد القضية ${cs.caseNumber || cs.id}: المطالبة (${cs.claimAmount}) - المدفوع (${cs.totalPaid || 0}) لا يساوي المسجل (${cs.outstanding})`,
        descriptionEn: `Balance mismatch in legal case ${cs.caseNumber || cs.id}`,
        recommendedGovernanceAction: "ADJUSTMENT",
        status: "DETECTED",
      });
    }

    // Check closed case with remaining balance
    if ((cs.status === "CLOSED" || cs.status === "SETTLED") && (cs.outstanding || 0) > 1 && !cs.settlement) {
      exceptions.push({
        id: `exc-case-closed-with-balance-${cs.id}`,
        category: "LEGAL_CASE_BALANCE_EXCEPTION",
        severity: "HIGH",
        detectedAt: now,
        affectedModule: "LEGAL_CASES",
        affectedRecordReference: cs.caseNumber || cs.id,
        financialAmount: cs.outstanding,
        descriptionAr: `القضية ${cs.caseNumber || cs.id} مغلقة ولكن لا يزال عليها رصيد مستحق بقيمة ${cs.outstanding} درهم بدون تسوية`,
        descriptionEn: `Legal case ${cs.caseNumber || cs.id} is closed with remaining balance of ${cs.outstanding} AED without settlement`,
        recommendedGovernanceAction: "INVESTIGATION",
        status: "DETECTED",
      });
    }
  });

  // -------------------------------------------------------------
  // 6. VAT & REVENUE CONTROL
  // -------------------------------------------------------------
  let vatLiability = 0;
  const currentVatRate = (vatRates.find((v) => (v as any).isCurrent || (v as any).isActive)?.rate || 5) / 100;

  commissions.forEach((m) => {
    const isCancelled = m.status === "CANCELLED" || (m.status as string) === "REVERSED";
    const totalComm = m.totalCommissionAmount || 0;
    const baseAmt = m.baseAmount || (m.ratePercentage ? (totalComm / (m.ratePercentage / 100)) : totalComm);
    const vat = roundToTwo(totalComm * (currentVatRate / (1 + currentVatRate)));

    if (!isCancelled) {
      vatLiability += vat;
    }
  });

  propertyExpenses.forEach((exp) => {
    const isCancelled = exp.status === "CANCELLED" || exp.status === "REVERSED";
    if (exp.vatAmount && exp.vatAmount > 0 && !isCancelled) {
      const expVat = exp.vatAmount || 0;
      const baseAmount = exp.amount || 0;
      const expectedExpVat = roundToTwo(baseAmount * currentVatRate);
      if (Math.abs(expectedExpVat - expVat) > 0.5) {
        if (moduleVatStatus !== "CRITICAL") moduleVatStatus = "WARNING";
        exceptions.push({
          id: `exc-vat-exp-mismatch-${exp.id}`,
          category: "VAT_RECONCILIATION_EXCEPTION",
          severity: "MEDIUM",
          detectedAt: now,
          affectedModule: "VAT",
          affectedRecordReference: exp.vendorInvoiceNumber || exp.id,
          financialAmount: Math.abs(expectedExpVat - expVat),
          descriptionAr: `عدم تطابق ضريبة المصروف ${exp.vendorInvoiceNumber || exp.id}: المسجلة (${expVat}) مقابل المتوقعة (${expectedExpVat})`,
          descriptionEn: `VAT mismatch for expense ${exp.vendorInvoiceNumber || exp.id}`,
          recommendedGovernanceAction: "INVESTIGATION",
          status: "DETECTED",
        });
      }
    }
  });

  // -------------------------------------------------------------
  // 7. CLOSED-PERIOD ATTEMPTS & PERIOD GOVERNANCE
  // -------------------------------------------------------------
  const closedPeriods = financialPeriods.filter((p) => p.status === "CLOSED");
  const openPeriods = financialPeriods.filter((p) => p.status === "OPEN");
  const currentOpenPeriod = openPeriods.length > 0 ? openPeriods[0] : undefined;

  if (openPeriods.length > 1) {
    modulePeriodStatus = "WARNING";
    exceptions.push({
      id: `exc-period-multiple-open`,
      category: "PERIOD_CERTIFICATION_EXCEPTION",
      severity: "MEDIUM",
      detectedAt: now,
      affectedModule: "PERIOD_GOVERNANCE",
      affectedRecordReference: "MULTIPLE_OPEN_PERIODS",
      descriptionAr: `يوجد أكثر من فترة مالية مفتوحة في نفس الوقت (${openPeriods.length} فترات)`,
      descriptionEn: `Multiple open financial periods detected simultaneously (${openPeriods.length} periods)`,
      recommendedGovernanceAction: "MONITORING",
      status: "DETECTED",
    });
  }

  // Inspect transactions against closed periods
  closedPeriods.forEach((cp) => {
    if (!cp.closedAt) return;
    const closedTime = new Date(cp.closedAt).getTime();

    // Check collections
    collections.forEach((col) => {
      if (col.paymentDate && col.paymentDate >= cp.startDate && col.paymentDate <= cp.endDate) {
        const colCreatedAt = col.createdAt ? new Date(col.createdAt).getTime() : 0;
        if (colCreatedAt > closedTime + 60000) {
          // Created after period was closed!
          modulePeriodStatus = "CRITICAL";
          exceptions.push({
            id: `exc-closed-period-col-${col.id}`,
            category: "CLOSED_PERIOD_ATTEMPT",
            severity: "CRITICAL",
            detectedAt: now,
            affectedModule: "COLLECTIONS",
            affectedRecordReference: col.receiptNumber || col.id,
            financialAmount: col.amountEntered,
            descriptionAr: `محاولة إدخال سند قبض (${col.receiptNumber || col.id}) في فترة مالية مغلقة (${cp.name}) بعد إغلاقها`,
            descriptionEn: `Transaction attempt in closed period (${cp.name}) for collection ${col.receiptNumber || col.id}`,
            recommendedGovernanceAction: "REVERSAL",
            status: "DETECTED",
          });
        }
      }
    });

    // Check journals
    journalEntries.forEach((j) => {
      if (j.transactionDate && j.transactionDate >= cp.startDate && j.transactionDate <= cp.endDate) {
        const jCreatedAt = j.createdAt ? new Date(j.createdAt).getTime() : 0;
        if (jCreatedAt > closedTime + 60000 && j.status === "POSTED") {
          modulePeriodStatus = "CRITICAL";
          exceptions.push({
            id: `exc-closed-period-j-${j.id}`,
            category: "CLOSED_PERIOD_ATTEMPT",
            severity: "CRITICAL",
            detectedAt: now,
            affectedModule: "GENERAL_LEDGER",
            affectedRecordReference: j.entryNumber || j.id,
            financialAmount: j.totalDebit,
            descriptionAr: `محاولة ترحيل قيد يومية (${j.entryNumber || j.id}) في فترة مالية مغلقة (${cp.name})`,
            descriptionEn: `Journal entry posted into closed financial period (${cp.name})`,
            recommendedGovernanceAction: "REVERSAL",
            status: "DETECTED",
          });
        }
      }
    });
  });

  // -------------------------------------------------------------
  // 8. REVERSALS & ADJUSTMENTS GOVERNANCE & IMMUTABILITY
  // -------------------------------------------------------------
  financialReversals.forEach((rev) => {
    if (!rev.targetId) {
      exceptions.push({
        id: `exc-rev-missing-ref-${rev.id}`,
        category: "REVERSAL_EXCEPTION",
        severity: "HIGH",
        detectedAt: now,
        affectedModule: "REVERSALS",
        affectedRecordReference: rev.reversalNumber || rev.id,
        descriptionAr: `حركة عكس مالية بدون مرجع للمعاملة الأصلية: ${rev.reversalNumber || rev.id}`,
        descriptionEn: `Financial reversal lacking reference to original transaction: ${rev.reversalNumber || rev.id}`,
        recommendedGovernanceAction: "INVESTIGATION",
        status: "DETECTED",
      });
    }
  });

  // -------------------------------------------------------------
  // 9. OVERALL INTEGRITY STATUS DETERMINATION
  // -------------------------------------------------------------
  const criticalExceptions = exceptions.filter((e) => e.severity === "CRITICAL");
  const warningExceptions = exceptions.filter((e) => e.severity === "HIGH" || e.severity === "MEDIUM");

  let overallIntegrityStatus: FinancialIntegrityStatus = "HEALTHY";
  let isLocked = false;
  let lockReason: string | undefined = undefined;

  // Determine if a lock condition is triggered
  const hasSevereClosedPeriodViolation = exceptions.some(
    (e) => e.category === "CLOSED_PERIOD_ATTEMPT" && e.severity === "CRITICAL"
  );
  const hasMassiveGlImbalance = totalGlDiff > 10000;

  if (hasSevereClosedPeriodViolation || hasMassiveGlImbalance) {
    overallIntegrityStatus = "LOCKED";
    isLocked = true;
    lockReason = hasSevereClosedPeriodViolation
      ? "انتهاك حرج: محاولة إدخال معاملات في فترة مالية مغلقة تتطلب إيقاف الترحيل"
      : `عدم توازن حرج في دفتر الأستاذ العام بمبلغ ${totalGlDiff.toLocaleString()} درهم يتطلب قفل الترحيل`;
  } else if (criticalExceptions.length > 0) {
    overallIntegrityStatus = "CRITICAL";
  } else if (warningExceptions.length > 0) {
    overallIntegrityStatus = "WARNING";
  } else {
    overallIntegrityStatus = "HEALTHY";
  }

  // Get last reconciliation & certification
  const lastReconciliation = reconciliationReports.length > 0
    ? reconciliationReports[reconciliationReports.length - 1]
    : undefined;

  const lastForensicCertification = forensicCertifications.length > 0
    ? forensicCertifications[forensicCertifications.length - 1]
    : undefined;

  const summaryWithoutHash: Omit<ContinuousFinancialControlSummary, "snapshotHash"> = {
    overallIntegrityStatus,
    evaluatedAt: now,
    evaluatedByUserId: currentUserId,
    evaluatedByUserName: currentUserName,
    currentOpenPeriod,
    lastReconciliation,
    lastForensicCertification,
    totalCollections: roundToTwo(totalCollections),
    totalOwnerPayables: roundToTwo(totalOwnerPayables),
    totalOwnerTransfers: roundToTwo(totalOwnerTransfers),
    totalDailyDeposits: roundToTwo(totalDailyDeposits),
    outstandingChequesAmount: roundToTwo(outstandingChequesAmount),
    outstandingChequesCount,
    returnedChequesAmount: roundToTwo(returnedChequesAmount),
    returnedChequesCount,
    activeLegalCasesAmount: roundToTwo(activeLegalCasesAmount),
    activeLegalCasesCount,
    vatLiability: roundToTwo(vatLiability),
    reversalsCount: financialReversals.length,
    adjustmentsCount: financialAdjustments.length,
    criticalExceptionsCount: criticalExceptions.length,
    warningExceptionsCount: warningExceptions.length,
    exceptions,
    isLocked,
    lockReason,
    modulesHealth: {
      generalLedger: moduleGlStatus,
      collections: moduleColStatus,
      ownerAccounts: moduleOwnerStatus,
      dailyDeposits: moduleDepositStatus,
      chequesAndLegal: moduleChequeStatus,
      vatAndTax: moduleVatStatus,
      periodGovernance: modulePeriodStatus,
    },
  };

  const snapshotHash = generateContinuousControlSnapshotHash(summaryWithoutHash);

  return {
    ...summaryWithoutHash,
    snapshotHash,
  };
}

/**
 * Creates a frozen Continuous Control Forensic Snapshot with hash.
 */
export function createContinuousControlSnapshot(
  summary: ContinuousFinancialControlSummary,
  userId: string = "system",
  userName: string = "System Auditor"
): ContinuousControlForensicSnapshot {
  const timestamp = new Date().toISOString();
  const randomSuffix = Date.now() % 10000;
  const snapshotNumber = `SNAP-CC-${new Date().getFullYear()}-${randomSuffix}`;
  const snapshotHash = generateContinuousControlSnapshotHash(summary);

  return {
    id: `SNAP-${Date.now()}-${randomSuffix}`,
    snapshotNumber,
    timestamp,
    evaluatedByUserId: userId,
    evaluatedByUserName: userName,
    integrityStatus: summary.overallIntegrityStatus,
    summary,
    snapshotHash,
    createdAt: timestamp,
  };
}

/**
 * Generates audit log entries for a continuous control evaluation.
 * Does not write directly to DB; returns records for appending.
 */
export function generateContinuousControlAuditLogs(
  summary: ContinuousFinancialControlSummary,
  userId: string = "system",
  userName: string = "System Auditor"
): AuditLogEntry[] {
  const logs: AuditLogEntry[] = [];
  const now = new Date().toISOString();

  // Scan Completed Log
  logs.push({
    id: `log-cc-completed-${Date.now()}`,
    action: "FINANCIAL_CONTROL_SCAN_COMPLETED",
    entityType: "FINANCIAL_PERIOD",
    entityId: summary.currentOpenPeriod?.id || "ALL_PERIODS",
    entityName: `Continuous Financial Control Scan - Status: ${summary.overallIntegrityStatus}`,
    userId,
    userName,
    userRole: "SUPER_ADMIN",
    timestamp: now,
    details: `Financial scan completed with status ${summary.overallIntegrityStatus}. Exceptions: ${summary.exceptions.length} (Critical: ${summary.criticalExceptionsCount}, Warnings: ${summary.warningExceptionsCount}). Hash: ${summary.snapshotHash}`,
  });

  // Critical exceptions logs if any
  if (summary.criticalExceptionsCount > 0) {
    logs.push({
      id: `log-cc-crit-${Date.now()}`,
      action: "FINANCIAL_CRITICAL_EXCEPTION_DETECTED",
      entityType: "FINANCIAL_PERIOD",
      entityId: summary.currentOpenPeriod?.id || "ALL_PERIODS",
      entityName: `Critical Financial Exceptions Detected (${summary.criticalExceptionsCount})`,
      userId,
      userName,
      userRole: "SUPER_ADMIN",
      timestamp: now,
      details: `Detected ${summary.criticalExceptionsCount} critical financial exceptions requiring immediate reversal/adjustment governance.`,
    });
  }

  return logs;
}
