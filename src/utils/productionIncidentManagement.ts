
/**
 * PRODUCTION INCIDENT MANAGEMENT ENGINE
 * Tracks operational incidents, their severity, priority, and resolution lifecycle.
 */

export type IncidentStatus = "OPEN" | "ACKNOWLEDGED" | "INVESTIGATING" | "MITIGATING" | "RESOLVED" | "CLOSED" | "REOPENED";
export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface OperationalIncident {
  id: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  severity: IncidentSeverity;
  priority: "LOW" | "NORMAL" | "HIGH" | "IMMEDIATE";
  status: IncidentStatus;
  category: string;
  sourceAlertId?: string;
  detectedAt: string;
  acknowledgedAt?: string;
  investigationStartedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  assignedUser?: string;
  reporter: string;
  affectedModule: string;
  affectedEntity?: string;
  businessImpactEn: string;
  businessImpactAr: string;
  rootCauseEn?: string;
  rootCauseAr?: string;
  correctiveActionEn?: string;
  correctiveActionAr?: string;
  resolutionNotesEn?: string;
  resolutionNotesAr?: string;
}

let incidents: OperationalIncident[] = [];

export function createIncident(params: Omit<OperationalIncident, "id" | "detectedAt" | "status">): OperationalIncident {
  const newIncident: OperationalIncident = {
    id: `INC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(incidents.length + 1).padStart(3, "0")}`,
    ...params,
    status: "OPEN",
    detectedAt: new Date().toISOString()
  };
  incidents.push(newIncident);
  return newIncident;
}

export function getIncidents(): OperationalIncident[] {
  return incidents;
}

export function updateIncidentStatus(id: string, status: IncidentStatus, user: string, notes?: string): void {
  const index = incidents.findIndex(i => i.id === id);
  if (index !== -1) {
    const now = new Date().toISOString();
    const updated = { ...incidents[index], status };
    
    if (status === "ACKNOWLEDGED") updated.acknowledgedAt = now;
    if (status === "INVESTIGATING") updated.investigationStartedAt = now;
    if (status === "RESOLVED") {
      updated.resolvedAt = now;
      if (notes) updated.resolutionNotesEn = notes;
    }
    if (status === "CLOSED") updated.closedAt = now;
    
    incidents[index] = updated;
  }
}

export function assignIncident(id: string, user: string): void {
  const index = incidents.findIndex(i => i.id === id);
  if (index !== -1) {
    incidents[index].assignedUser = user;
  }
}

/**
 * Automatically creates incidents for critical alerts if they don't already have one.
 */
import { ProductionAlert } from "./productionAlertEngine";

export function processAlertForIncidents(alert: ProductionAlert): void {
  if (alert.severity === "CRITICAL" && alert.status === "NEW") {
    // Check if incident already exists for this alert
    const existing = incidents.find(i => i.sourceAlertId === alert.id);
    if (!existing) {
      createIncident({
        titleEn: `Critical Alert: ${alert.titleEn}`,
        titleAr: `تنبيه حرج: ${alert.titleAr}`,
        descriptionEn: alert.descriptionEn,
        descriptionAr: alert.descriptionAr,
        severity: "CRITICAL",
        priority: "IMMEDIATE",
        category: alert.category,
        sourceAlertId: alert.id,
        reporter: "System Engine",
        affectedModule: alert.source,
        affectedEntity: alert.relatedEntity,
        businessImpactEn: "Potential financial or security risk to production operations.",
        businessImpactAr: "خطر مالي أو أمني محتمل على عمليات الإنتاج."
      });
    }
  }
}
