import {
  validateTransactionPeriod,
  validateChequeComponents
} from "../services/financialEngine";
import {
  validateJournalEntry
} from "../services/journalEngine";
import { FinancialPeriod, ChequeComponentItem } from "../types";

export async function runPhase1cFinancialIntegrityTests() {
  console.log("================================================================================");
  console.log("STARTING PHASE 1C FINANCIAL INTEGRITY HARDENING UNIT TEST SUITE");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function report(testId: string, name: string, isPass: boolean, details: string) {
    if (isPass) {
      passed++;
      console.log(`[PASS] ${testId}: ${name}\n       Details: ${details}`);
    } else {
      failed++;
      console.error(`[FAIL] ${testId}: ${name}\n       Details: ${details}`);
    }
  }

  // Common test periods
  const openPeriods: FinancialPeriod[] = [
    {
      id: "p-2026-01",
      name: "Q1 2026",
      startDate: "2026-01-01",
      endDate: "2026-03-31",
      status: "OPEN",
      openedAt: "2026-01-01T00:00:00Z",
      openedBy: "admin"
    }
  ];

  const closedPeriods: FinancialPeriod[] = [
    {
      id: "p-2026-01",
      name: "Q1 2026",
      startDate: "2026-01-01",
      endDate: "2026-03-31",
      status: "CLOSED",
      openedAt: "2026-01-01T00:00:00Z",
      openedBy: "admin"
    }
  ];

  const lockedPeriods: FinancialPeriod[] = [
    {
      id: "p-2026-01",
      name: "Q1 2026",
      startDate: "2026-01-01",
      endDate: "2026-03-31",
      status: "LOCKED",
      openedAt: "2026-01-01T00:00:00Z",
      openedBy: "admin"
    }
  ];

  // --- 1. FINANCIAL PERIOD FAIL-CLOSED TESTS ---

  // Test 1: OPEN Period -> Allowed
  const resOpen = validateTransactionPeriod("2026-02-15", openPeriods);
  report("TEST-1C-01", "OPEN financial period permits transaction write", resOpen.allowed === true, "Transaction on 2026-02-15 in OPEN period returned allowed: true.");

  // Test 2: CLOSED Period -> Rejected
  const resClosed = validateTransactionPeriod("2026-02-15", closedPeriods);
  report("TEST-1C-02", "CLOSED financial period rejects transaction write", resClosed.allowed === false, `Returned allowed: false with error: ${resClosed.errorEn}`);

  // Test 3: LOCKED Period -> Rejected
  const resLocked = validateTransactionPeriod("2026-02-15", lockedPeriods);
  report("TEST-1C-03", "LOCKED financial period rejects transaction write", resLocked.allowed === false, `Returned allowed: false with error: ${resLocked.errorEn}`);

  // Test 4: Missing/Null Financial Periods -> Fails Closed
  const resNull = validateTransactionPeriod("2026-02-15", null as any);
  report("TEST-1C-04", "Null financial periods list fails closed", resNull.allowed === false, `Blocked: ${resNull.errorEn}`);

  // Test 5: Empty Financial Periods List -> Fails Closed
  const resEmpty = validateTransactionPeriod("2026-02-15", []);
  report("TEST-1C-05", "Empty financial periods list fails closed", resEmpty.allowed === false, `Blocked: ${resEmpty.errorEn}`);

  // Test 6: Balanced Journal Entry -> Valid
  const balancedEntry = {
    lines: [
      { accountId: "1010", debit: 5000, credit: 0 },
      { accountId: "4010", debit: 0, credit: 5000 }
    ]
  };
  const valBalanced = validateJournalEntry(balancedEntry);
  report("TEST-1C-06", "Balanced double-entry journal is valid", valBalanced.isValid === true && valBalanced.totalDebit === 5000, "Debit 5000 equals Credit 5000.");

  // Test 7: Unbalanced Journal Entry -> Rejected
  const unbalancedEntry = {
    lines: [
      { accountId: "1010", debit: 5000, credit: 0 },
      { accountId: "4010", debit: 0, credit: 4500 }
    ]
  };
  const valUnbalanced = validateJournalEntry(unbalancedEntry);
  report("TEST-1C-07", "Unbalanced journal entry rejected", valUnbalanced.isValid === false, `Difference detected: ${valUnbalanced.error}`);

  // --- 2. CHEQUE COMPONENT RECONCILIATION TESTS ---

  // Test 8: Undefined / Null / Empty Components -> Rejected
  const valUndefined = validateChequeComponents(5000, undefined);
  const valEmpty = validateChequeComponents(5000, []);
  report("TEST-1C-08", "Undefined or empty cheque components rejected", valUndefined.isValid === false && valEmpty.isValid === false, "Missing or empty components rejected before settlement.");

  // Test 9: Equal Cheque Components -> Allowed
  const matchingComponents: ChequeComponentItem[] = [
    { id: "c1", type: "RENT", obligationRefId: "obl-1", amount: 4000, descriptionAr: "إيجار", descriptionEn: "Rent" },
    { id: "c2", type: "TENANT_ADMIN_FEE", obligationRefId: "obl-2", amount: 1000, descriptionAr: "رسوم إدارية", descriptionEn: "Admin Fee" }
  ];
  const valChequeEqual = validateChequeComponents(5000, matchingComponents);
  report("TEST-1C-09", "Matching cheque component total allowed", valChequeEqual.isValid === true && valChequeEqual.difference === 0, "Components (4000 + 1000) equal Cheque amount (5000).");

  // Test 10: Mismatched Cheque Components (Lower Total) -> Rejected
  const lowerComponents: ChequeComponentItem[] = [
    { id: "c1", type: "RENT", obligationRefId: "obl-1", amount: 3500, descriptionAr: "إيجار", descriptionEn: "Rent" }
  ];
  const valChequeLower = validateChequeComponents(5000, lowerComponents);
  report("TEST-1C-10", "Cheque components sum less than cheque total rejected", valChequeLower.isValid === false, `Difference of ${valChequeLower.difference} detected: ${valChequeLower.errorEn}`);

  // Test 11: Mismatched Cheque Components (Higher Total) -> Rejected
  const higherComponents: ChequeComponentItem[] = [
    { id: "c1", type: "RENT", obligationRefId: "obl-1", amount: 6000, descriptionAr: "إيجار", descriptionEn: "Rent" }
  ];
  const valChequeHigher = validateChequeComponents(5000, higherComponents);
  report("TEST-1C-11", "Cheque components sum greater than cheque total rejected", valChequeHigher.isValid === false, `Difference of ${valChequeHigher.difference} detected: ${valChequeHigher.errorEn}`);

  // Test 12: Negative Component Amount -> Rejected
  const negativeComponents: ChequeComponentItem[] = [
    { id: "c1", type: "RENT", obligationRefId: "obl-1", amount: 5500, descriptionAr: "إيجار", descriptionEn: "Rent" },
    { id: "c2", type: "OTHER", obligationRefId: "obl-2", amount: -500, descriptionAr: "خصم", descriptionEn: "Discount" }
  ];
  const valChequeNegative = validateChequeComponents(5000, negativeComponents);
  report("TEST-1C-12", "Negative cheque component amount rejected", valChequeNegative.isValid === false, `Rejected negative amount: ${valChequeNegative.errorEn}`);

  // --- SUMMARY ---
  console.log("\n================================================================================");
  console.log(`PHASE 1C UNIT TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("================================================================================\n");

  if (failed > 0) {
    throw new Error(`Phase 1C unit tests failed with ${failed} failure(s).`);
  }
}

// Execute if run directly
if (typeof process !== "undefined" && process.argv && process.argv[1]?.includes("phase1cFinancialIntegrityTests")) {
  runPhase1cFinancialIntegrityTests();
}
