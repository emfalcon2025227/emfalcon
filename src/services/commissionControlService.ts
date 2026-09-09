/**
 * EMIRATES FALCON ERP — ANNUAL COMMISSION CONTROL & DUPLICATE PREVENTION SERVICE
 * Authoritative service enforcing one commission per contractual year per party per lease,
 * duplicate prevention, override workflows, and idempotent commission obligations.
 */

import { CommissionObligation, AuditLogEntry, UserRole } from "../types";

export interface CommissionCheckResult {
  allowed: boolean;
  errorCode?: "COMMISSION_ALREADY_CHARGED" | "INVALID_REASON" | "UNAUTHORIZED_OVERRIDE";
  existingCommission?: CommissionObligation;
  businessKey?: string;
  messageAr: string;
  messageEn: string;
}

export function generateCommissionBusinessKey(
  leaseId: string,
  partyType: "OWNER" | "TENANT",
  partyId: string,
  contractualCommissionYear: string | number,
  renewalSequence: number = 0
): string {
  return `COMMISSION:${leaseId}:${partyType}:${partyId}:${contractualCommissionYear}:${renewalSequence}`;
}

export function validateCommissionEligibility(params: {
  leaseId: string;
  partyType: "OWNER" | "TENANT";
  partyId: string;
  contractualCommissionYear: string | number;
  renewalSequence?: number;
  existingCommissions: CommissionObligation[];
  isOverrideRequested?: boolean;
  overrideReason?: string;
  userPermissions: string[];
  userRole: UserRole;
}): CommissionCheckResult {
  const renewalSeq = params.renewalSequence || 0;
  const businessKey = generateCommissionBusinessKey(
    params.leaseId,
    params.partyType,
    params.partyId,
    params.contractualCommissionYear,
    renewalSeq
  );

  // Search authoritative existing commissions
  const existing = params.existingCommissions.find(
    (c) =>
      c.businessKey === businessKey ||
      (c.leaseId === params.leaseId &&
        c.partyType === params.partyType &&
        (c.ownerId === params.partyId || c.tenantId === params.partyId) &&
        String(c.contractualCommissionYear || "YEAR-1") === String(params.contractualCommissionYear) &&
        (c.renewalSequence || 0) === renewalSeq &&
        c.status !== "CANCELLED")
  );

  if (!existing) {
    return {
      allowed: true,
      businessKey,
      messageAr: "الرسوم الإدارية مستحقة ولم يتم تحصيلها مسبقًا لهذه السنة التعاقدية.",
      messageEn: "Administrative fees are eligible and have not been charged for this contractual year.",
    };
  }

  // Duplicate detected
  if (!params.isOverrideRequested) {
    return {
      allowed: false,
      errorCode: "COMMISSION_ALREADY_CHARGED",
      existingCommission: existing,
      businessKey,
      messageAr: "تم أخذ الرسوم الإدارية عن السنة الحالية مسبقًا.",
      messageEn: "Administrative fees for the current contract year have already been charged.",
    };
  }

  // Override requested - verify permission
  const hasOverridePermission =
    params.userPermissions.includes("COMMISSION_OVERRIDE") ||
    params.userPermissions.includes("COMMISSION_DUPLICATE_OVERRIDE") ||
    params.userRole === "SUPER_ADMIN";

  if (!hasOverridePermission) {
    return {
      allowed: false,
      errorCode: "UNAUTHORIZED_OVERRIDE",
      existingCommission: existing,
      businessKey,
      messageAr: "ليس لديك الصلاحية لتجاوز منع تكرار الرسوم الإدارية.",
      messageEn: "You do not have authorization to override duplicate administrative fees protection.",
    };
  }

  // Verify override reason
  if (!params.overrideReason || params.overrideReason.trim().length === 0) {
    return {
      allowed: false,
      errorCode: "INVALID_REASON",
      existingCommission: existing,
      businessKey,
      messageAr: "سبب التجاوز إلزامي ولا يمكن ترك فارغاً.",
      messageEn: "Override reason is mandatory and cannot be left empty.",
    };
  }

  // Override authorized
  return {
    allowed: true,
    businessKey: businessKey + `:OVERRIDE-${Date.now()}`,
    messageAr: "تمت الموافقة على تجاوز تكرار الرسوم الإدارية بواسطة الصلاحية الإدارية.",
    messageEn: "Duplicate administrative fees override authorized by administrator.",
  };
}
