import { computeOwnerPayableDetails } from "../services/financialEngine";
import { runContinuousFinancialHealthScan } from "./continuousFinancialIntegrityMonitor";

/**
 * RECOVERY FINANCIAL INTEGRITY VERIFIER
 * Validates recovered financial data against authoritative engine logic.
 */

export interface FinancialRecoveryValidation {
  isValid: boolean;
  varianceDetected: number;
  criticalIssues: string[];
  status: "PASS" | "FAIL" | "WARNING";
}

export function verifyFinancialRecoveryIntegrity(recoveredData: any): FinancialRecoveryValidation {
  // Use the continuous monitor logic which already uses computeOwnerPayableDetails
  const scan = runContinuousFinancialHealthScan(recoveredData);
  
  const criticalDrifts = scan.drifts.filter(d => d.severity === "CRITICAL");
  
  return {
    isValid: criticalDrifts.length === 0,
    varianceDetected: 0,
    criticalIssues: criticalDrifts.map(d => d.description),
    status: scan.status === "CRITICAL" ? "FAIL" : scan.status === "WARNING" ? "WARNING" : "PASS"
  };
}
