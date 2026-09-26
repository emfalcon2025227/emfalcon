import { ForensicValidationMatrix } from "./phase57H8ForensicValidation";
import { Phase57H11ForensicValidationMatrix } from "./phase57H11ForensicValidation";
import { Phase57H19TransportValidationMatrix } from "./phase57H19TransportValidation";
import { runPhase1_1AdminFeeSettlementTests } from "./phase1_1AdminFeeSettlementTests";

async function main() {
  console.log("\n================================================================================");
  console.log("EXECUTING COMPREHENSIVE FORENSIC VALIDATION SUITES (H.8, H.11, H.19 & PHASE 1.1)");
  console.log("================================================================================");

  const runnerH8 = new ForensicValidationMatrix();
  const summaryH8 = await runnerH8.runAllTests();

  const runnerH11 = new Phase57H11ForensicValidationMatrix();
  const summaryH11 = await runnerH11.runAllTests();

  const runnerH19 = new Phase57H19TransportValidationMatrix();
  const summaryH19 = await runnerH19.runAllTests();

  const summaryP11 = runPhase1_1AdminFeeSettlementTests();

  console.log("\n================================================================================");
  const h19First = summaryH19.results[0]?.id || "TEST-A";
  const h19Last = summaryH19.results[summaryH19.results.length - 1]?.id || "TEST-I";
  console.log(`PHASE 57-H.19 TRANSPORT & ROUTING RESULTS (${h19First} to ${h19Last}):`);
  console.log("================================================================================");

  summaryH19.results.forEach((r) => {
    const statusTag = r.passed ? "[PASS]" : "[FAIL]";
    console.log(`${statusTag} ${r.id}: ${r.name} (${r.durationMs}ms)`);
    console.log(`       Category: ${r.category} | Details: ${r.details}`);
  });

  console.log("\n================================================================================");
  console.log("PHASE 1.1 ADMINISTRATIVE FEE & DEPOSIT SUITE (TEST-01 to TEST-12):");
  console.log("================================================================================");

  summaryP11.results.forEach((r) => {
    const statusTag = r.passed ? "[PASS]" : "[FAIL]";
    console.log(`${statusTag} ${r.testKey}: ${r.name}`);
    console.log(`       Arabic: ${r.nameAr} | Details: ${r.details}`);
  });

  console.log("\n================================================================================");
  console.log("PHASE 57-H.11 DETAILED RESULTS (TEST-01 to TEST-40):");
  console.log("================================================================================");

  summaryH11.results.forEach((r) => {
    const statusTag = r.passed ? "[PASS]" : "[FAIL]";
    console.log(`${statusTag} ${r.id}: ${r.name} (${r.durationMs}ms)`);
    console.log(`       Category: ${r.category} | Details: ${r.details}`);
    if (r.metrics) {
      console.log(`       Metrics: ${JSON.stringify(r.metrics)}`);
    }
  });

  const totalTests = summaryH8.total + summaryH11.total + summaryH19.total + summaryP11.total;
  const totalFailed = summaryH8.failed + summaryH11.failed + summaryH19.failed + summaryP11.failed;

  console.log("\n================================================================================");
  if (totalFailed === 0) {
    console.log(`ALL ${totalTests} FORENSIC TESTS (${summaryH8.total} H.8 + ${summaryH11.total} H.11 + ${summaryH19.total} H.19 + ${summaryP11.total} Phase 1.1) COMPLETED WITH 100% PASS RATE.`);
    process.exit(0);
  } else {
    console.error(`VALIDATION FAILED: ${totalFailed} tests failed out of ${totalTests}.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Forensic runner encountered fatal error:", err);
  process.exit(1);
});
