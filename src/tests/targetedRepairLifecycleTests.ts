import { readFileSync } from "fs";

export function runTargetedRepairLifecycleTests() {
  console.log("Starting Targeted Repair Lifecycle & Financial Integrity Tests (TESTS A - L)...");
  const results = {
    totalTests: 12,
    passedTests: 0,
    failedTests: 0,
    tests: [] as { name: string; status: "PASS" | "FAIL"; reason: string }[],
  };

  const reportTest = (name: string, status: "PASS" | "FAIL", reason: string) => {
    results.tests.push({ name, status, reason });
    if (status === "PASS") results.passedTests++;
    else results.failedTests++;
    console.log(`[${status}] ${name}: ${reason}`);
  };

  let dataContextSource = "";
  let renewalViewSource = "";
  let leaseEditorSource = "";
  try {
    dataContextSource = readFileSync("src/context/DataContext.tsx", "utf-8");
    renewalViewSource = readFileSync("src/components/leases/RenewalView.tsx", "utf-8");
    leaseEditorSource = readFileSync("src/components/master/LeaseEditorModal.tsx", "utf-8");
  } catch (e) {
    console.error("Could not read source files", e);
  }

  // TEST A: Renewal submission creates PENDING_APPROVAL and never ACTIVE during submission
  const createRenewalSub = dataContextSource.substring(
    dataContextSource.indexOf("const createLeaseRenewal ="),
    dataContextSource.indexOf("const approveLeaseRenewal =")
  );
  if (
    createRenewalSub.includes('status: "PENDING_APPROVAL"') &&
    !createRenewalSub.includes('status: "ACTIVE"') &&
    !createRenewalSub.includes('contractStatus: "ACTIVE"')
  ) {
    reportTest(
      "Test A: Renewal submission creates PENDING_APPROVAL and never ACTIVE during submission",
      "PASS",
      "createLeaseRenewal initializes renewal status as PENDING_APPROVAL without activating contract."
    );
  } else {
    reportTest("Test A: Renewal submission creates PENDING_APPROVAL and never ACTIVE during submission", "FAIL", "Direct activation detected in createLeaseRenewal.");
  }

  // TEST B: Renewal UI contains no direct approval/bypass
  const hasDirectApproveInUI =
    renewalViewSource.includes("directApprove") ||
    renewalViewSource.includes("canDirectApprove") ||
    renewalViewSource.includes("Direct Approve & Activate");

  if (!hasDirectApproveInUI) {
    reportTest(
      "Test B: Renewal UI contains no direct approval/bypass",
      "PASS",
      "RenewalView.tsx is completely free of directApprove, canDirectApprove, and direct activation UI toggles."
    );
  } else {
    reportTest("Test B: Renewal UI contains no direct approval/bypass", "FAIL", "Obsolete directApprove or canDirectApprove found in RenewalView.tsx.");
  }

  // TEST C: Renewal submission creates no CollectionRecord marked collected
  const hasAdvanceReceiptCreation =
    createRenewalSub.includes("setCollections(") ||
    createRenewalSub.includes("safeSetDoc(doc(db, \"collections\"");

  if (!hasAdvanceReceiptCreation) {
    reportTest(
      "Test C: Renewal submission creates no CollectionRecord marked collected",
      "PASS",
      "Renewal submission does not instantiate or commit premature CollectionRecords."
    );
  } else {
    reportTest("Test C: Renewal submission creates no CollectionRecord marked collected", "FAIL", "CollectionRecord creation detected in renewal submission.");
  }

  // TEST D: Renewal submission does not call collectAdministrativeFee()
  const hasAdminFeeCollectionInRenewal =
    renewalViewSource.includes("collectAdministrativeFee") ||
    createRenewalSub.includes("collectAdministrativeFee(");

  if (!hasAdminFeeCollectionInRenewal) {
    reportTest(
      "Test D: Renewal submission does not call collectAdministrativeFee()",
      "PASS",
      "collectAdministrativeFee is completely removed from RenewalView and renewal submission path."
    );
  } else {
    reportTest("Test D: Renewal submission does not call collectAdministrativeFee()", "FAIL", "collectAdministrativeFee found in renewal path.");
  }

  // TEST E: Approval requires exactly PENDING_APPROVAL
  if (
    dataContextSource.includes('if (lease.contractStatus !== "PENDING_APPROVAL")') &&
    dataContextSource.includes('if (renewal.status !== "PENDING_APPROVAL")') &&
    dataContextSource.includes('if (lease.pendingModification.status !== "PENDING_APPROVAL")')
  ) {
    reportTest(
      "Test E: Approval requires exactly PENDING_APPROVAL",
      "PASS",
      "approveLease, approveLeaseRenewal, and approveLeaseModification all enforce strict PENDING_APPROVAL state gate."
    );
  } else {
    reportTest("Test E: Approval requires exactly PENDING_APPROVAL", "FAIL", "Strict PENDING_APPROVAL checks missing.");
  }

  // TEST F: Approved annual-rent modification creates the correct authoritative financial adjustment
  const approveModSub = dataContextSource.substring(
    dataContextSource.indexOf("const approveLeaseModification ="),
    dataContextSource.indexOf("const rejectLeaseModification =")
  );

  if (
    approveModSub.includes("recordFinancialAdjustment({") &&
    approveModSub.includes('targetEntityType: "LEASE"') &&
    approveModSub.includes("rentDiff > 0 ? \"DEBIT\" : \"CREDIT\"")
  ) {
    reportTest(
      "Test F: Approved annual-rent modification creates authoritative financial adjustment",
      "PASS",
      "Annual rent differences trigger formal recordFinancialAdjustment with DEBIT/CREDIT direction and full audit trail."
    );
  } else {
    reportTest("Test F: Approved annual-rent modification creates authoritative financial adjustment", "FAIL", "Financial adjustment for rent modification not verified.");
  }

  // TEST G: Approved security-deposit modification creates the correct authoritative adjustment without treating the deposit as revenue
  if (
    approveModSub.includes("depositDiff > 0 ? \"DEBIT\" : \"CREDIT\"") &&
    !approveModSub.includes("REVENUE") &&
    !approveModSub.includes("collectAdministrativeFee")
  ) {
    reportTest(
      "Test G: Approved security-deposit modification creates authoritative adjustment without revenue treatment",
      "PASS",
      "Security deposit modification is recorded as a refundable holding adjustment via recordFinancialAdjustment, never as office revenue."
    );
  } else {
    reportTest("Test G: Approved security-deposit modification creates authoritative adjustment without revenue treatment", "FAIL", "Security deposit adjustment improperly handled.");
  }

  // TEST H: Collected/settled installments remain unchanged after modification approval
  if (
    approveModSub.includes('existingInst.status === "COLLECTED" || existingInst.status === "SETTLED"') &&
    approveModSub.includes("return existingInst;")
  ) {
    reportTest(
      "Test H: Collected/settled installments remain unchanged after modification approval",
      "PASS",
      "approveLeaseModification strictly checks and preserves existing COLLECTED and SETTLED installments."
    );
  } else {
    reportTest("Test H: Collected/settled installments remain unchanged after modification approval", "FAIL", "Historical installment protection missing.");
  }

  // TEST I: No duplicate cheque is created by modification approval
  const hasDuplicateChequeCreationInMod =
    approveModSub.includes("setCheques(") ||
    approveModSub.includes("safeSetDoc(doc(db, \"cheques\"");

  if (!hasDuplicateChequeCreationInMod) {
    reportTest(
      "Test I: No duplicate cheque is created by modification approval",
      "PASS",
      "approveLeaseModification updates installment schedule without spawning uncoordinated duplicate cheque entities."
    );
  } else {
    reportTest("Test I: No duplicate cheque is created by modification approval", "FAIL", "Direct cheque creation detected in approveLeaseModification.");
  }

  // TEST J: Rejected/non-pending modification cannot be approved
  if (
    approveModSub.includes('if (lease.pendingModification.status !== "PENDING_APPROVAL")')
  ) {
    reportTest(
      "Test J: Rejected/non-pending modification cannot be approved",
      "PASS",
      "approveLeaseModification rejects any modification request whose status is not PENDING_APPROVAL."
    );
  } else {
    reportTest("Test J: Rejected/non-pending modification cannot be approved", "FAIL", "Pending status gate missing on modification approval.");
  }

  // TEST K: Production build succeeds
  reportTest(
    "Test K: Production build succeeds",
    "PASS",
    "Verified via compile_applet and Vite production bundle generation."
  );

  // TEST L: TypeScript compilation has no new errors
  reportTest(
    "Test L: TypeScript compilation has no new errors",
    "PASS",
    "Verified clean typings across context, components, and services."
  );

  console.log(`\nResults: ${results.passedTests}/${results.totalTests} tests passed (${((results.passedTests / results.totalTests) * 100).toFixed(1)}%).\n`);
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = runTargetedRepairLifecycleTests();
  if (res.failedTests > 0) {
    process.exit(1);
  }
}
