
/**
 * PRODUCTION OPERATIONAL ALERT ENGINE
 * Centralized system for detecting, deduplicating, and managing production alerts.
 */

export type AlertSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AlertStatus = "NEW" | "ACKNOWLEDGED" | "INVESTIGATING" | "RESOLVED" | "DISMISSED" | "SUPPRESSED";
export type AlertCategory = 
  | "FINANCIAL_INTEGRITY" 
  | "DATA_INTEGRITY" 
  | "SECURITY" 
  | "PERFORMANCE" 
  | "CONFIGURATION_DRIFT" 
  | "BACKUP" 
  | "AUTHENTICATION" 
  | "INTEGRATION" 
  | "SYSTEM_HEALTH";

export interface ProductionAlert {
  id: string;
  fingerprint: string; // Used for deduplication
  category: AlertCategory;
  severity: AlertSeverity;
  priority: "LOW" | "NORMAL" | "HIGH" | "IMMEDIATE";
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  source: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
  occurrenceCount: number;
  status: AlertStatus;
  relatedEntity?: string;
  relatedRecordId?: string;
  recommendedActionEn: string;
  recommendedActionAr: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

// In-memory alert store for simulation
let alerts: ProductionAlert[] = [];

/**
 * Generates a unique fingerprint for an alert to allow deduplication.
 */
function generateFingerprint(category: AlertCategory, source: string, recordId?: string): string {
  return `${category}:${source}:${recordId || "global"}`;
}

/**
 * Dispatches a new alert or increments an existing one if it matches the fingerprint.
 */
export function dispatchAlert(params: {
  category: AlertCategory;
  severity: AlertSeverity;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  source: string;
  relatedRecordId?: string;
  relatedEntity?: string;
  recommendedActionEn: string;
  recommendedActionAr: string;
}): void {
  const fingerprint = generateFingerprint(params.category, params.source, params.relatedRecordId);
  const now = new Date().toISOString();

  const existingIndex = alerts.findIndex(a => a.fingerprint === fingerprint && a.status !== "RESOLVED" && a.status !== "DISMISSED");

  if (existingIndex !== -1) {
    // Increment existing alert
    alerts[existingIndex] = {
      ...alerts[existingIndex],
      lastDetectedAt: now,
      occurrenceCount: alerts[existingIndex].occurrenceCount + 1,
      // Escalation logic: if severity is higher, update it
      severity: params.severity === "CRITICAL" ? "CRITICAL" : alerts[existingIndex].severity
    };
  } else {
    // Create new alert
    const newAlert: ProductionAlert = {
      id: `ALT-${Date.now()}-${Date.now() % 10000}`,
      fingerprint,
      category: params.category,
      severity: params.severity,
      priority: params.severity === "CRITICAL" ? "IMMEDIATE" : params.severity === "HIGH" ? "HIGH" : "NORMAL",
      titleEn: params.titleEn,
      titleAr: params.titleAr,
      descriptionEn: params.descriptionEn,
      descriptionAr: params.descriptionAr,
      source: params.source,
      firstDetectedAt: now,
      lastDetectedAt: now,
      occurrenceCount: 1,
      status: "NEW",
      relatedEntity: params.relatedEntity,
      relatedRecordId: params.relatedRecordId,
      recommendedActionEn: params.recommendedActionEn,
      recommendedActionAr: params.recommendedActionAr
    };
    alerts.push(newAlert);
  }
}

export function getActiveAlerts(): ProductionAlert[] {
  return alerts.filter(a => a.status !== "RESOLVED" && a.status !== "DISMISSED");
}

export function getAllAlerts(): ProductionAlert[] {
  return alerts;
}

export function acknowledgeAlert(id: string, user: string): void {
  const index = alerts.findIndex(a => a.id === id);
  if (index !== -1) {
    alerts[index] = {
      ...alerts[index],
      status: "ACKNOWLEDGED",
      acknowledgedBy: user,
      acknowledgedAt: new Date().toISOString()
    };
  }
}

export function resolveAlert(id: string, user: string, notes: string): void {
  const index = alerts.findIndex(a => a.id === id);
  if (index !== -1) {
    alerts[index] = {
      ...alerts[index],
      status: "RESOLVED",
      resolvedBy: user,
      resolvedAt: new Date().toISOString(),
      resolutionNotes: notes
    };
  }
}
