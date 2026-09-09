import { ForensicValidationMatrix } from "./phase57H8ForensicValidation";
import { Phase57H11ForensicValidationMatrix } from "./phase57H11ForensicValidation";

async function main() {
  console.log("\n================================================================================");
  console.log("EXECUTING COMPREHENSIVE FORENSIC VALIDATION SUITES (H.8 & H.11)");
  console.log("================================================================================");

  const runnerH8 = new ForensicValidationMatrix();
  const summaryH8 = await runnerH8.runAllTests();

  const runnerH11 = new Phase57H11ForensicValidationMatrix();
  const summaryH11 = await runnerH11.runAllTests();

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

  const totalTests = summaryH8.total + summaryH11.total;
  const totalFailed = summaryH8.failed + summaryH11.failed;

  console.log("\n================================================================================");
  if (totalFailed === 0) {
    console.log(`ALL ${totalTests} FORENSIC TESTS (${summaryH8.total} H.8 + ${summaryH11.total} H.11) COMPLETED WITH 100% PASS RATE.`);
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
