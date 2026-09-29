
/**
 * PRODUCTION BACKUP HEALTH MONITOR
 * Tracks backup status, freshness, and integrity.
 */

export type BackupStatus = "CREATED" | "IN_PROGRESS" | "COMPLETED" | "VERIFIED" | "FAILED" | "CORRUPTED" | "EXPIRED" | "NOT_VERIFIED";

export interface BackupRecord {
  id: string;
  type: "FULL" | "INCREMENTAL";
  timestamp: string;
  completedAt?: string;
  recordCount: number;
  status: BackupStatus;
  integrityScore: number;
  verifiedAt?: string;
}

const mockBackups: BackupRecord[] = [
  {
    id: "BKP-20260819-001",
    type: "FULL",
    timestamp: "2026-08-19T10:00:00Z",
    completedAt: "2026-08-19T10:05:00Z",
    recordCount: 15420,
    status: "VERIFIED",
    integrityScore: 100,
    verifiedAt: "2026-08-19T11:00:00Z"
  },
  {
    id: "BKP-20260820-001",
    type: "FULL",
    timestamp: "2026-08-20T00:00:00Z",
    completedAt: "2026-08-20T00:05:00Z",
    recordCount: 15485,
    status: "COMPLETED",
    integrityScore: 0,
    verifiedAt: undefined
  }
];

export function getBackupHistory(): BackupRecord[] {
  return mockBackups;
}

export function getLatestBackup(): BackupRecord | null {
  return mockBackups.length > 0 ? mockBackups[mockBackups.length - 1] : null;
}

export function getBackupFreshnessStatus(lastBackupAt: string): "HEALTHY" | "WARNING" | "CRITICAL" {
  const lastDate = new Date(lastBackupAt);
  const now = new Date();
  const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);

  if (diffHours < 12) return "HEALTHY";
  if (diffHours < 24) return "WARNING";
  return "CRITICAL";
}
