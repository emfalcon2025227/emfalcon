/**
 * PRODUCTION CHANGE GOVERNANCE
 * Manages the lifecycle of system changes to ensure stability.
 */

export type ChangeCategory = 
  | "BUG_FIX" | "FEATURE" | "SECURITY" | "FINANCIAL" 
  | "DATABASE" | "CONFIGURATION" | "PERFORMANCE" 
  | "UI_UX" | "INTEGRATION" | "REPORTING" | "EMERGENCY" | "MAINTENANCE";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ChangeStatus = 
  | "DRAFT" | "REVIEW" | "APPROVED" | "TESTING" 
  | "READY_FOR_RELEASE" | "RELEASED" | "REJECTED" | "ROLLED_BACK" | "FAILED";

export interface ChangeRequest {
  id: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  requestedBy: string;
  requestedAt: string;
  category: ChangeCategory;
  riskLevel: RiskLevel;
  affectedModules: string[];
  financialImpact: boolean;
  securityImpact: boolean;
  approvalStatus: ChangeStatus;
  auditHistory: ChangeAuditRecord[];
}

export interface ChangeAuditRecord {
  user: string;
  role: string;
  timestamp: string;
  fromStatus: ChangeStatus;
  toStatus: ChangeStatus;
  reason: string;
}

const mockChanges: ChangeRequest[] = [
  {
    id: "CHG-20260820-001",
    titleEn: "Enhance Owner Payable Calculation Precision",
    titleAr: "تحسين دقة حساب مستحقات المالك",
    descriptionEn: "Updating the authoritative financial engine to handle multi-decimal precision for large portfolios.",
    descriptionAr: "تحديث المحرك المالي المعتمد للتعامل مع الدقة العشرية المتعددة للمحافظ الكبيرة.",
    requestedBy: "Lead Financial Architect",
    requestedAt: "2026-08-20T08:00:00Z",
    category: "FINANCIAL",
    riskLevel: "HIGH",
    affectedModules: ["FinancialEngine", "OwnerStatement"],
    financialImpact: true,
    securityImpact: false,
    approvalStatus: "TESTING",
    auditHistory: [
      {
        user: "Admin",
        role: "SYSTEM_ADMIN",
        timestamp: "2026-08-20T08:05:00Z",
        fromStatus: "DRAFT",
        toStatus: "REVIEW",
        reason: "Initial review request."
      },
      {
        user: "FinancialController",
        role: "FINANCIAL_MANAGER",
        timestamp: "2026-08-20T09:00:00Z",
        fromStatus: "REVIEW",
        toStatus: "APPROVED",
        reason: "Calculation logic verified."
      }
    ]
  }
];

export function getChangeRequests(): ChangeRequest[] {
  return mockChanges;
}

export function createChangeRequest(request: Omit<ChangeRequest, "id" | "requestedAt" | "approvalStatus" | "auditHistory">): ChangeRequest {
  const newId = `CHG-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(mockChanges.length + 1).padStart(3, '0')}`;
  const newRequest: ChangeRequest = {
    ...request,
    id: newId,
    requestedAt: new Date().toISOString(),
    approvalStatus: "DRAFT",
    auditHistory: []
  };
  mockChanges.push(newRequest);
  return newRequest;
}
