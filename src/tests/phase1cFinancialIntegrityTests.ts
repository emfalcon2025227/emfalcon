import {
  validateTransactionPeriod,
  validateChequeComponents
} from "../services/financialEngine";
import {
  validateJournalEntry,
  postAuthoritativeJournalEntry
} from "../services/journalEngine";
import { FinancialPeriod, ChequeComponentItem, JournalEntryRecord } from "../types";

export async function runPhase1cFinancialIntegrityTests() {
  console.log("================================================================================");
  console.log("STARTING PHASE 1C FINANCIAL INTEGRITY HARDENING TEST SUITE");
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

  // Base valid journal entry
  const createSampleJournal = (id: string, sourceType: string, sourceId: string): JournalEntryRecord => ({
    id,
    entryNumber: "JE-2026-0001",
    transactionDate: "2026-02-15",
    postingDate: "2026-02-15",
    reference: "REF-123",
    sourceType: sourceType as any,
    sourceId,
    description: "Payment Receipt / إيصال استلام",
    lines: [
      { id: "jl-1", accountId: "1010", accountCode: "1010", accountNameAr: "الصندوق", accountNameEn: "Cash", debit: 5000, credit: 0 },
      { id: "jl-2", accountId: "4010", accountCode: "4010", accountNameAr: "إيراد إيجار", accountNameEn: "Rent Revenue", debit: 0, credit: 5000 }
    ],
    totalDebit: 5000,
    totalCredit: 5000,
    status: "POSTED",
    createdBy: "Admin",
    createdAt: "2026-02-15T00:00:00Z"
  });

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

  // Test 4: Missing/Null Financial Periods -> Fails Closed (G1)
  const resNull = await postAuthoritativeJournalEntry({
    entry: createSampleJournal("je-null", "RENT_COLLECTION", "PAY-NULL"),
    financialPeriods: null as any
  });
  report("TEST-1C-G1", "Missing/Null financial periods rejected by postAuthoritativeJournalEntry (Fail-Closed)", resNull.isValid === false, `Rejected null periods: ${resNull.error}`);

  // Test 5: Empty Financial Periods List -> Fails Closed (G2)
  const resEmpty = await postAuthoritativeJournalEntry({
    entry: createSampleJournal("je-empty", "RENT_COLLECTION", "PAY-EMPTY"),
    financialPeriods: []
  });
  report("TEST-1C-G2", "Empty financial periods list rejected by postAuthoritativeJournalEntry (Fail-Closed)", resEmpty.isValid === false, `Rejected empty periods: ${resEmpty.error}`);

  // Test 6: Locked period rejected by postAuthoritativeJournalEntry (G3)
  const resLockedEntry = await postAuthoritativeJournalEntry({
    entry: createSampleJournal("je-locked", "RENT_COLLECTION", "PAY-LOCKED"),
    financialPeriods: lockedPeriods
  });
  report("TEST-1C-G3", "Locked financial period rejected by postAuthoritativeJournalEntry", resLockedEntry.isValid === false, `Rejected locked period: ${resLockedEntry.error}`);

  // Test 7: Unbalanced journal rejected (G4)
  const unbalancedJournal = createSampleJournal("je-unbalanced", "RENT_COLLECTION", "PAY-UNBAL");
  unbalancedJournal.lines[1].credit = 4500;
  unbalancedJournal.totalCredit = 4500;
  const resUnbalanced = await postAuthoritativeJournalEntry({
    entry: unbalancedJournal,
    financialPeriods: openPeriods
  });
  report("TEST-1C-G4", "Unbalanced journal entry rejected by postAuthoritativeJournalEntry", resUnbalanced.isValid === false, `Rejected unbalanced journal: ${resUnbalanced.error}`);

  // Test 8: Missing sourceType/sourceId rejected (G5)
  const missingSourceJournal = createSampleJournal("je-nosource", "", "");
  const resMissingSource = await postAuthoritativeJournalEntry({
    entry: missingSourceJournal,
    financialPeriods: openPeriods
  });
  report("TEST-1C-G5", "Missing sourceType/sourceId rejected by postAuthoritativeJournalEntry", resMissingSource.isValid === false, `Rejected missing source: ${resMissingSource.error}`);

  // --- 2. TRANSACTION MOCKING FOR FIRESTORE ATOMICITY TESTS (G6, G7, G8, G9) ---
  const firestoreStore = new Map<string, any>();

  const createMockTransaction = (): any => {
    return {
      get: async (ref: any) => {
        const path = ref.path || (ref._key?.path?.segments ? ref._key.path.segments.slice(1).join("/") : ref.id);
        const data = firestoreStore.get(path);
        return {
          exists: () => !!data,
          data: () => data,
          id: ref.id
        };
      },
      set: (ref: any, data: any, options?: any) => {
        const path = ref.path || (ref._key?.path?.segments ? ref._key.path.segments.slice(1).join("/") : ref.id);
        if (options?.merge && firestoreStore.has(path)) {
          firestoreStore.set(path, { ...firestoreStore.get(path), ...data });
        } else {
          firestoreStore.set(path, data);
        }
        return createMockTransaction();
      },
      update: (ref: any, data: any) => {
        const path = ref.path || (ref._key?.path?.segments ? ref._key.path.segments.slice(1).join("/") : ref.id);
        firestoreStore.set(path, { ...(firestoreStore.get(path) || {}), ...data });
        return createMockTransaction();
      },
      delete: (ref: any) => {
        const path = ref.path || (ref._key?.path?.segments ? ref._key.path.segments.slice(1).join("/") : ref.id);
        firestoreStore.delete(path);
        return createMockTransaction();
      }
    };
  };

  // Test 9: Successful journal creates 1 event key and 1 journal entry (G7)
  const mockTx1 = createMockTransaction();
  const sample1 = createSampleJournal("je-atom-1", "RENT_COLLECTION", "PAY-ATOM-001");
  const resPost1 = await postAuthoritativeJournalEntry({
    entry: sample1,
    financialPeriods: openPeriods,
    transaction: mockTx1
  });
  const eventKeyDoc1 = firestoreStore.get("journal_event_keys/RENT_COLLECTION_PAY-ATOM-001");
  const journalDoc1 = firestoreStore.get("journal_entries/je-atom-1");
  report(
    "TEST-1C-G7",
    "Successful journal creates exactly one event key and one journal entry",
    resPost1.isValid === true && !!eventKeyDoc1 && !!journalDoc1 && eventKeyDoc1.journalId === "je-atom-1",
    "Verified journal_event_keys/RENT_COLLECTION_PAY-ATOM-001 and journal_entries/je-atom-1 created in transaction."
  );

  // Test 10: Duplicate event key in Firestore rejected (G6 / G8)
  const mockTx2 = createMockTransaction();
  const sample2 = createSampleJournal("je-atom-2", "RENT_COLLECTION", "PAY-ATOM-001"); // same sourceType and sourceId
  const resPost2 = await postAuthoritativeJournalEntry({
    entry: sample2,
    financialPeriods: openPeriods,
    transaction: mockTx2
  });
  report(
    "TEST-1C-G6_G8",
    "Second attempt using same sourceType/sourceId is rejected by event key duplicate check",
    resPost2.isValid === false && (resPost2.error?.includes("تم تسجيل قيد محاسبي لهذا الحدث المالي") ?? false),
    `Rejected second attempt: ${resPost2.error}`
  );

  // Test 11: Original journal remains immutable during reversal except approved status/reference metadata (G9)
  const originalLinesSnapshot = JSON.stringify(journalDoc1.lines);
  const mockTxRev = createMockTransaction();
  const reversalEntry = createSampleJournal("je-rev-1", "JOURNAL_REVERSAL", "je-atom-1");
  reversalEntry.description = "Reversal of je-atom-1";
  reversalEntry.lines = [
    { id: "jl-rev-1", accountId: "1010", accountCode: "1010", accountNameAr: "الصندوق", accountNameEn: "Cash", debit: 0, credit: 5000 },
    { id: "jl-rev-2", accountId: "4010", accountCode: "4010", accountNameAr: "إيراد إيجار", accountNameEn: "Rent Revenue", debit: 5000, credit: 0 }
  ];
  const resRev = await postAuthoritativeJournalEntry({
    entry: reversalEntry,
    financialPeriods: openPeriods,
    transaction: mockTxRev,
    originalJournalToReverse: journalDoc1
  });
  const updatedOriginal = firestoreStore.get("journal_entries/je-atom-1");
  const reversalDoc = firestoreStore.get("journal_entries/je-rev-1");
  const linesRemainedImmutable = JSON.stringify(updatedOriginal.lines) === originalLinesSnapshot;
  const statusUpdated = updatedOriginal.status === "REVERSED" && updatedOriginal.reversalEntryId === "je-rev-1";
  report(
    "TEST-1C-G9",
    "Original journal remains immutable during reversal except status and reversalEntryId metadata",
    resRev.isValid === true && linesRemainedImmutable && statusUpdated && !!reversalDoc,
    `Original status: ${updatedOriginal.status}, lines unmodified: ${linesRemainedImmutable}, reversal document created: ${!!reversalDoc}`
  );

  // --- 3. CHEQUE COMPONENT RECONCILIATION TESTS ---

  // Test 12: Undefined / Null / Empty Components -> Rejected
  const valUndefined = validateChequeComponents(5000, undefined);
  const valEmpty = validateChequeComponents(5000, []);
  report("TEST-1C-11", "Undefined or empty cheque components rejected", valUndefined.isValid === false && valEmpty.isValid === false, "Missing or empty components rejected before settlement.");

  // Test 13: Equal Cheque Components -> Allowed
  const matchingComponents: ChequeComponentItem[] = [
    { id: "c1", type: "RENT", obligationRefId: "obl-1", amount: 4000, descriptionAr: "إيجار", descriptionEn: "Rent" },
    { id: "c2", type: "TENANT_ADMIN_FEE", obligationRefId: "obl-2", amount: 1000, descriptionAr: "رسوم إدارية", descriptionEn: "Admin Fee" }
  ];
  const valChequeEqual = validateChequeComponents(5000, matchingComponents);
  report("TEST-1C-12", "Matching cheque component total allowed", valChequeEqual.isValid === true && valChequeEqual.difference === 0, "Components (4000 + 1000) equal Cheque amount (5000).");

  // Test 14: Mismatched Cheque Components (Lower Total) -> Rejected
  const lowerComponents: ChequeComponentItem[] = [
    { id: "c1", type: "RENT", obligationRefId: "obl-1", amount: 3500, descriptionAr: "إيجار", descriptionEn: "Rent" }
  ];
  const valChequeLower = validateChequeComponents(5000, lowerComponents);
  report("TEST-1C-13", "Cheque components sum less than cheque total rejected", valChequeLower.isValid === false, `Difference of ${valChequeLower.difference} detected: ${valChequeLower.errorEn}`);

  // Test 15: Mismatched Cheque Components (Higher Total) -> Rejected
  const higherComponents: ChequeComponentItem[] = [
    { id: "c1", type: "RENT", obligationRefId: "obl-1", amount: 6000, descriptionAr: "إيجار", descriptionEn: "Rent" }
  ];
  const valChequeHigher = validateChequeComponents(5000, higherComponents);
  report("TEST-1C-14", "Cheque components sum greater than cheque total rejected", valChequeHigher.isValid === false, `Difference of ${valChequeHigher.difference} detected: ${valChequeHigher.errorEn}`);

  // Test 16: Negative Component Amount -> Rejected
  const negativeComponents: ChequeComponentItem[] = [
    { id: "c1", type: "RENT", obligationRefId: "obl-1", amount: 5500, descriptionAr: "إيجار", descriptionEn: "Rent" },
    { id: "c2", type: "OTHER", obligationRefId: "obl-2", amount: -500, descriptionAr: "خصم", descriptionEn: "Discount" }
  ];
  const valChequeNegative = validateChequeComponents(5000, negativeComponents);
  report("TEST-1C-15", "Negative cheque component amount rejected", valChequeNegative.isValid === false, `Rejected negative amount: ${valChequeNegative.errorEn}`);

  // --- SUMMARY ---
  console.log("\n================================================================================");
  console.log(`PHASE 1C TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("================================================================================\n");

  if (failed > 0) {
    throw new Error(`Phase 1C tests failed with ${failed} failure(s).`);
  }
}

// Execute if run directly
if (typeof process !== "undefined" && process.argv && process.argv[1]?.includes("phase1cFinancialIntegrityTests")) {
  runPhase1cFinancialIntegrityTests();
}
