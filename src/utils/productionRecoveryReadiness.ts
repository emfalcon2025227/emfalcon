
import { getLatestBackup, getBackupFreshnessStatus } from "./productionBackupHealth";
import { runContinuousDataIntegrityScan } from "./continuousDataIntegrityMonitor";
import { runContinuousFinancialHealthScan } from "./continuousFinancialIntegrityMonitor";

/**
 * RECOVERY READINESS ENGINE
 * Evaluates the system's ability to recover from a disaster.
 */

export interface ReadinessReport {
  score: number;
  status: "HEALTHY" | "WARNING" | "CRITICAL" | "NOT_VERIFIED";
  lastVerified: string;
  details: {
    backups: boolean;
    freshness: boolean;
    dataIntegrity: boolean;
    financialIntegrity: boolean;
    auditIntegrity: boolean;
  };
}

export function evaluateRecoveryReadiness(data: any): ReadinessReport {
  const latestBackup = getLatestBackup();
  const dataIntegrity = runContinuousDataIntegrityScan(data);
  const financialHealth = runContinuousFinancialHealthScan(data);

  const hasBackups = latestBackup !== null && latestBackup.status === "VERIFIED";
  const isFresh = latestBackup ? getBackupFreshnessStatus(latestBackup.timestamp) !== "CRITICAL" : false;
  const isDataHealthy = dataIntegrity.status !== "CRITICAL";
  const isFinancialHealthy = financialHealth.status !== "CRITICAL";

  let score = 0;
  if (hasBackups) score += 40;
  if (isFresh) score += 20;
  if (isDataHealthy) score += 20;
  if (isFinancialHealthy) score += 20;

  const status = score > 90 ? "HEALTHY" : score > 70 ? "WARNING" : "CRITICAL";

  return {
    score,
    status,
    lastVerified: new Date().toISOString(),
    details: {
      backups: hasBackups,
      freshness: isFresh,
      dataIntegrity: isDataHealthy,
      financialIntegrity: isFinancialHealthy,
      auditIntegrity: true // Placeholder
    }
  };
}
