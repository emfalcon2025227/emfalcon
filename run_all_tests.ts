import { runPhase49FinancialClosingTests } from "./src/utils/phase49FinancialClosingTests";
import { runPhase50PeriodReconciliationTests } from "./src/utils/phase50PeriodReconciliationTests";
import { runPhase51ContinuousFinancialControlTests } from "./src/utils/phase51ContinuousFinancialControlTests";
import { runPhase52DailyDepositsForensicTests } from "./src/utils/phase52DailyDepositsForensicTests";
import { runPhase53DailyRevenueCollectionTests } from "./src/utils/phase53DailyRevenueCollectionTests";
import { runPhase54EndToEndFinancialReconciliationTests } from "./src/utils/phase54EndToEndFinancialReconciliationTests";
import { runPhase55FinancialReportingReconciliationTests } from "./src/utils/phase55FinancialReportingReconciliationTests";
import { runPhase56DepositDelayAlertTests } from "./src/utils/phase56DepositDelayAlertTests";
import { runPhase57ForensicTests } from "./src/utils/phase57DocumentIntelligenceForensicTests";

const mockContext: any = {
  owners: [],
  tenants: [],
  leases: [],
  commissions: [],
  vatRates: [],
  financialPeriods: [],
  ownerTransfers: [],
  journalEntries: [],
  collections: [],
  paymentAllocations: [],
  dailyDepositBatches: [],
  cheques: [],
  properties: [],
  units: [],
};

console.log("Phase 49 Tests available:", typeof runPhase49FinancialClosingTests === "function");
console.log("Phase 50 Tests available:", typeof runPhase50PeriodReconciliationTests === "function");
console.log("Phase 51 Tests available:", typeof runPhase51ContinuousFinancialControlTests === "function");
console.log("Phase 52 Tests available:", typeof runPhase52DailyDepositsForensicTests === "function");
console.log("Phase 53 Tests available:", typeof runPhase53DailyRevenueCollectionTests === "function");
console.log("Phase 54 Tests available:", typeof runPhase54EndToEndFinancialReconciliationTests === "function");
console.log("Phase 55 Tests available:", typeof runPhase55FinancialReportingReconciliationTests === "function");
console.log("Phase 56 Tests available:", typeof runPhase56DepositDelayAlertTests === "function");
console.log("Phase 57 Tests available:", typeof runPhase57ForensicTests === "function");

const phase57Report = runPhase57ForensicTests();
console.log(`\n======================================================`);
console.log(`PHASE 57-D FORENSIC AUDIT REPORT`);
console.log(`======================================================`);
console.log(`Total Forensic Tests: ${phase57Report.totalTests}`);
console.log(`Passed Tests: ${phase57Report.passedTests}`);
console.log(`Failed Tests: ${phase57Report.failedTests}`);
console.log(`Success Rate: ${phase57Report.successRate.toFixed(2)}%`);
console.log(`Checklist 47 Compliance: ${phase57Report.checklist47Evaluation.filter(c => c.compliant).length}/47 Points`);
console.log(`======================================================\n`);


