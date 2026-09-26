
import { runContinuousFinancialHealthScan } from "./continuousFinancialIntegrityMonitor";

/**
 * RECOVERY FINANCIAL INTEGRITY WATCHDOG
 * Ensures that post-recovery data remains consistent with authoritative engine logic.
 */

export function runRecoveryFinancialWatchdog(data: any): { status: "PASS" | "WARNING" | "CRITICAL", message: string } {
  const health = runContinuousFinancialHealthScan(data);
  
  if (health.status === "CRITICAL") {
    return {
      status: "CRITICAL",
      message: "Critical financial discrepancy detected. Recovery integrity is compromised."
    };
  }

  if (health.status === "WARNING") {
    return {
      status: "WARNING",
      message: "Minor financial drifts detected. Please verify reconciliations."
    };
  }

  return {
    status: "PASS",
    message: "Financial integrity verified against authoritative engine."
  };
}
