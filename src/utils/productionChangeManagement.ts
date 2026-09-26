
/**
 * PRODUCTION CONTROLLED CHANGE MANAGEMENT
 * Tracks production-sensitive changes and operational incidents.
 */

export interface ProductionChange {
  id: string;
  timestamp: string;
  user: string;
  module: string;
  category: "FINANCIAL" | "SECURITY" | "DATABASE" | "UI" | "REPORTING" | "INTEGRATION" | "CONFIGURATION";
  reason: string;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface OperationalIncident {
  id: string;
  timestamp: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  module: string;
  description: string;
  status: "OPEN" | "INVESTIGATING" | "MITIGATED" | "RESOLVED" | "CLOSED";
}

// Simulated persistence (in a real app, this would be in Firestore)
const mockChanges: ProductionChange[] = [
  {
    id: "CHG-20260819-001",
    timestamp: "2026-08-19T22:30:00Z",
    user: "Admin",
    module: "Financial Engine",
    category: "FINANCIAL",
    reason: "Phase 32 FIN-001 remediation to unify financial calculations.",
    risk: "CRITICAL"
  },
  {
    id: "CHG-20260819-002",
    timestamp: "2026-08-19T23:50:00Z",
    user: "Admin",
    module: "Security",
    category: "SECURITY",
    reason: "Phase 34 security hardening and session monitoring.",
    risk: "HIGH"
  }
];

const mockIncidents: OperationalIncident[] = [
  {
    id: "INC-20260820-001",
    timestamp: "2026-08-20T06:00:00Z",
    severity: "LOW",
    module: "Dashboard",
    description: "Minor visual glitch in chart resizing observed in Safari.",
    status: "CLOSED"
  }
];

export function getProductionChanges(): ProductionChange[] {
  return mockChanges;
}

export function getOperationalIncidents(): OperationalIncident[] {
  return mockIncidents;
}
