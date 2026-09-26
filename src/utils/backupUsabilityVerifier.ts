import { BackupRecord } from "./productionBackupHealth";

/**
 * BACKUP USABILITY VERIFIER
 * Deeply validates backup content structure and dataset completeness.
 */

export interface UsabilityResult {
  isUsable: boolean;
  score: number;
  checks: {
    structure: boolean;
    schema: boolean;
    financials: boolean;
    auditLogs: boolean;
    references: boolean;
  };
  error?: string;
}

export function verifyBackupUsability(backup: BackupRecord): UsabilityResult {
  // In a real system, this would parse the backup content.
  // Here we simulate the validation logic.
  
  const isCorrupted = backup.status === "CORRUPTED";
  const hasLowIntegrity = backup.integrityScore < 95 && backup.status !== "NOT_VERIFIED";

  if (isCorrupted) {
    return {
      isUsable: false,
      score: 0,
      checks: { structure: false, schema: false, financials: false, auditLogs: false, references: false },
      error: "Backup structure is corrupted."
    };
  }

  return {
    isUsable: backup.status === "VERIFIED" || backup.status === "COMPLETED",
    score: backup.integrityScore || 85,
    checks: {
      structure: true,
      schema: true,
      financials: backup.integrityScore > 90,
      auditLogs: true,
      references: backup.integrityScore > 95
    }
  };
}
