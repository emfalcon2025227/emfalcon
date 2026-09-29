import { verifyFinancialRecoveryIntegrity } from "./recoveryFinancialIntegrityVerifier";
import { runContinuousDataIntegrityScan } from "./continuousDataIntegrityMonitor";

/**
 * POST-RECOVERY VALIDATION
 * Comprehensive checks to be performed after a recovery operation.
 */

export interface PostRecoveryReport {
  timestamp: string;
  applicationHealth: "PASS" | "FAIL";
  dataIntegrity: "PASS" | "FAIL" | "WARNING";
  financialIntegrity: "PASS" | "FAIL" | "WARNING";
  securityRBAC: "PASS" | "FAIL";
  overallStatus: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";
}

export function runPostRecoveryValidation(data: any): PostRecoveryReport {
  const financial = verifyFinancialRecoveryIntegrity(data);
  const dataIntegrity = runContinuousDataIntegrityScan(data);
  
  const applicationHealthy = true; // Simulated
  const securityHealthy = true;    // Simulated

  let overallStatus: PostRecoveryReport["overallStatus"] = "SUCCESS";
  if (financial.status === "FAIL" || dataIntegrity.status === "CRITICAL") {
    overallStatus = "FAILED";
  } else if (financial.status === "WARNING" || dataIntegrity.status === "WARNING") {
    overallStatus = "PARTIAL_SUCCESS";
  }

  return {
    timestamp: new Date().toISOString(),
    applicationHealth: applicationHealthy ? "PASS" : "FAIL",
    dataIntegrity: dataIntegrity.status === "CRITICAL" ? "FAIL" : dataIntegrity.status === "WARNING" ? "WARNING" : "PASS",
    financialIntegrity: financial.status,
    securityRBAC: securityHealthy ? "PASS" : "FAIL",
    overallStatus
  };
}
