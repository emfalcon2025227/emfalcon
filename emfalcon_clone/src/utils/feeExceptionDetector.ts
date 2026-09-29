/**
 * PHASE 8 — ADMINISTRATIVE FEE EXCEPTION DETECTOR & MONITORING MODEL
 * Emirates Falcon ERP
 *
 * Single source of truth for detecting, classifying, and reporting
 * all Administrative Fee deviations and exemptions from standard policy.
 *
 * READ-ONLY DERIVED MONITORING LAYER:
 * - Does NOT alter underlying financial records.
 * - Does NOT alter VAT equations or calculations.
 * - Does NOT confuse partial collections with fee reductions.
 * - Excludes non-administrative fees (Rent, Maintenance, Legal, Cheques).
 */

import {
  CommissionObligation,
  Lease,
  Owner,
  Tenant,
  Property,
  FinancialCommissionSettings,
  VatRateRecord,
  FinancialReversalRecord,
  AdminFeeExemptionPolicy,
} from "../types";
import {
  DEFAULT_COMMISSION_SETTINGS,
  getApplicableVatRate,
} from "../services/financialEngine";

export type AdminFeeExceptionType =
  | "FULL_EXEMPTION"
  | "PARTY_RATE_REDUCTION"
  | "MANUAL_REDUCTION"
  | "MANUAL_AMOUNT_BELOW_EXPECTED"
  | "PENDING_APPROVAL"
  | "REJECTED_EXCEPTION"
  | "NORMAL"
  | "REVERSED_RECORD";

export type AdminFeeExceptionWorkflowStatus =
  | "REQUIRES_REVIEW"
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "NOT_APPLICABLE";

export interface AdminFeeExceptionRecord {
  id: string; // Unique identifier for table/export
  commissionId?: string;
  leaseId: string;
  leaseNumber: string;
  ownerId: string;
  ownerName: string;
  tenantId: string;
  tenantName: string;
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitNumber: string;
  partyType: "OWNER" | "TENANT";
  
  // Exception Classification
  exceptionType: AdminFeeExceptionType;
  isException: boolean;
  requiresAttention: boolean;
  
  // Rates & Financials
  expectedRate: number; // e.g. 5%
  appliedRate: number;  // e.g. 3% or 0%
  baseAmount: number;   // e.g. Annual Rent
  
  expectedAmount: number;    // What standard policy would mandate
  actualAmount: number;      // Stored obligation amount
  reductionAmount: number;   // expectedAmount - actualAmount
  
  // VAT Reporting Figures (Informational only, derived from VAT logic)
  expectedVat: number;
  actualVat: number;
  vatDifference: number;     // expectedVat - actualVat
  
  // Net Revenue
  expectedNetRevenue: number;
  actualNetRevenue: number;
  
  // Exemption / Policy Metadata
  policySource: "SYSTEM_DEFAULT" | "PARTY_OVERRIDE" | "CONTRACT_EXEMPTION" | "MANUAL";
  reason: string;
  notes: string;
  approvalStatus: AdminFeeExceptionWorkflowStatus;
  approvedBy?: string;
  approvedAt?: string;
  requestedBy?: string;
  requestedAt?: string;
  
  // Collection & Reversal Context
  collectionStatus: "PENDING" | "PARTIAL" | "COLLECTED" | "WAIVED" | "REVERSED" | "CANCELLED";
  collectedAmount: number;
  outstandingBalance: number;
  transactionDate: string;
  isReversed: boolean;
}

export interface AdminFeeExceptionSummary {
  totalActiveExceptions: number;
  totalExceptionsCount: number;
  totalExpectedFees: number;
  totalAppliedFees: number;
  totalReductionAmount: number;
  totalExpectedVat: number;
  totalActualVat: number;
  totalVatDifference: number;
  totalFullExemptions: number;
  totalPartyRateReductions: number;
  totalManualReductions: number;
  totalPendingApprovals: number;
  totalRejectedExceptions: number;
}

export interface DetectAdminFeeExceptionsOptions {
  commissions: CommissionObligation[];
  leases: Lease[];
  owners: Owner[];
  tenants: Tenant[];
  properties: Property[];
  financialReversals?: FinancialReversalRecord[];
  settings?: FinancialCommissionSettings;
  vatRateHistory?: VatRateRecord[];
}

/**
 * Derives all Administrative Fee Exception records and summary metrics.
 * Operates purely in-memory as a read-only projection.
 */
export function detectAdminFeeExceptions(
  options: DetectAdminFeeExceptionsOptions
): {
  records: AdminFeeExceptionRecord[];
  summary: AdminFeeExceptionSummary;
} {
  const {
    commissions = [],
    leases = [],
    owners = [],
    tenants = [],
    properties = [],
    financialReversals = [],
    settings = DEFAULT_COMMISSION_SETTINGS,
    vatRateHistory = [],
  } = options;

  const records: AdminFeeExceptionRecord[] = [];
  const processedKeys = new Set<string>();

  // 1. Process all existing ADMIN_FEE CommissionObligations
  commissions.forEach((c) => {
    // Scope Boundary: MUST be ADMIN_FEE only
    if (c.commissionType !== "ADMIN_FEE") return;

    const lease = leases.find((l) => l.id === c.leaseId);
    const owner = owners.find((o) => o.id === (c.ownerId || lease?.ownerId));
    const tenant = tenants.find((t) => t.id === (c.tenantId || lease?.tenantId));
    const property = properties.find((p) => p.id === (c.propertyId || lease?.propertyId));

    const ownerName =
      (owner as any)?.nameAr ||
      (owner as any)?.nameEn ||
      (owner as any)?.name ||
      (lease as any)?.ownerName ||
      "Unknown Owner";
    const tenantName =
      (tenant as any)?.nameAr ||
      (tenant as any)?.nameEn ||
      (tenant as any)?.name ||
      (lease as any)?.tenantName ||
      "Unknown Tenant";
    const propertyName =
      (property as any)?.nameAr ||
      (property as any)?.nameEn ||
      (property as any)?.name ||
      (lease as any)?.propertyName ||
      "Unknown Property";
    const unitNumber = (lease as any)?.unitNumber || "N/A";

    const isReversed =
      c.status === "REVERSED" ||
      c.status === "CANCELLED" ||
      financialReversals.some((r) => r.targetType === "COMMISSION" && r.targetId === c.id);

    const standardRate =
      c.partyType === "OWNER"
        ? settings.defaultOwnerCommissionRate
        : settings.defaultTenantCommissionRate;

    const baseAmount = c.baseAmount || lease?.annualRent || 0;
    const effectiveDate = c.createdAt || c.dueDate || new Date().toISOString();
    const vatRate = getApplicableVatRate(effectiveDate, vatRateHistory, "ADMIN_FEE");

    // Standard Expected Amount (at default policy rate)
    const expectedAmount =
      baseAmount > 0
        ? Math.round(((baseAmount * standardRate) / 100) * 100) / 100
        : c.totalCommissionAmount;

    // Standard Expected VAT
    const expectedVat =
      expectedAmount > 0 && vatRate > 0
        ? Math.round(((expectedAmount * vatRate) / (100 + vatRate)) * 100) / 100
        : 0;
    const expectedNetRevenue = Math.round((expectedAmount - expectedVat) * 100) / 100;

    const actualAmount = c.totalCommissionAmount || 0;
    const actualVat = c.vatAmount || 0;
    const actualNetRevenue =
      c.netRevenueAmount || Math.round((actualAmount - actualVat) * 100) / 100;

    const appliedRate =
      typeof c.ratePercentage === "number"
        ? c.ratePercentage
        : baseAmount > 0
        ? Math.round(((actualAmount / baseAmount) * 100) * 100) / 100
        : standardRate;

    // Contract policy check
    const leasePolicyObj =
      c.partyType === "OWNER" ? lease?.adminFeePolicy?.owner : lease?.adminFeePolicy?.tenant;
    const isExempt = c.isExempt || leasePolicyObj?.isExempt || false;
    const exemptionReason =
      c.exemptionReason || leasePolicyObj?.exemptionReason || "MANAGEMENT_DECISION";
    const exemptionNote = leasePolicyObj?.exemptionNote || c.notes || "";
    const rawApprovalStatus =
      leasePolicyObj?.approvalStatus || (c.approvalStatus as any) || (isExempt ? "APPROVED" : "NOT_APPLICABLE");
    const approvedBy = leasePolicyObj?.approvedBy || c.approvedBy || "";
    const approvedAt = leasePolicyObj?.approvedAt || c.createdAt || "";

    // Party-specific rate check
    const partySpecialRate =
      c.partyType === "OWNER" ? owner?.specialAdminFeeRate : tenant?.specialAdminFeeRate;
    const hasPartyRateReduction =
      typeof partySpecialRate === "number" && partySpecialRate < standardRate;

    let exceptionType: AdminFeeExceptionType = "NORMAL";
    let isException = false;
    let requiresAttention = false;
    let policySource: "SYSTEM_DEFAULT" | "PARTY_OVERRIDE" | "CONTRACT_EXEMPTION" | "MANUAL" =
      "SYSTEM_DEFAULT";
    let approvalStatus: AdminFeeExceptionWorkflowStatus = "NOT_APPLICABLE";

    if (isReversed) {
      exceptionType = "REVERSED_RECORD";
      isException = false;
      requiresAttention = false;
    } else if (isExempt || rawApprovalStatus === "PENDING" || rawApprovalStatus === "REJECTED") {
      policySource = "CONTRACT_EXEMPTION";
      if (rawApprovalStatus === "PENDING") {
        exceptionType = "PENDING_APPROVAL";
        isException = true;
        requiresAttention = true;
        approvalStatus = "PENDING";
      } else if (rawApprovalStatus === "REJECTED") {
        exceptionType = "REJECTED_EXCEPTION";
        isException = true;
        requiresAttention = false;
        approvalStatus = "REJECTED";
      } else {
        exceptionType = "FULL_EXEMPTION";
        isException = true;
        requiresAttention = true;
        approvalStatus = "APPROVED";
      }
    } else if (hasPartyRateReduction) {
      policySource = "PARTY_OVERRIDE";
      exceptionType = "PARTY_RATE_REDUCTION";
      isException = true;
      requiresAttention = true;
      approvalStatus = "APPROVED";
    } else if (actualAmount < expectedAmount - 0.01 && expectedAmount > 0) {
      policySource = "MANUAL";
      if (c.isOverride || c.overrideReason) {
        exceptionType = "MANUAL_REDUCTION";
      } else {
        exceptionType = "MANUAL_AMOUNT_BELOW_EXPECTED";
      }
      isException = true;
      requiresAttention = true;
      approvalStatus = "REQUIRES_REVIEW";
    }

    const reductionAmount = isException
      ? Math.max(0, Math.round((expectedAmount - actualAmount) * 100) / 100)
      : 0;
    const vatDifference = isException
      ? Math.max(0, Math.round((expectedVat - actualVat) * 100) / 100)
      : 0;

    let collectionStatus: "PENDING" | "PARTIAL" | "COLLECTED" | "WAIVED" | "REVERSED" | "CANCELLED" =
      "PENDING";
    if (isReversed) {
      collectionStatus = "REVERSED";
    } else if (isExempt && actualAmount === 0) {
      collectionStatus = "WAIVED";
    } else if (c.collectedAmount >= actualAmount && actualAmount > 0) {
      collectionStatus = "COLLECTED";
    } else if (c.collectedAmount > 0 && c.collectedAmount < actualAmount) {
      collectionStatus = "PARTIAL";
    } else {
      collectionStatus = "PENDING";
    }

    const recKey = `${c.leaseId}-${c.partyType}`;
    processedKeys.add(recKey);

    records.push({
      id: c.id,
      commissionId: c.id,
      leaseId: c.leaseId,
      leaseNumber: lease?.leaseNumber || "N/A",
      ownerId: c.ownerId || lease?.ownerId || "",
      ownerName,
      tenantId: c.tenantId || lease?.tenantId || "",
      tenantName,
      propertyId: c.propertyId || lease?.propertyId || "",
      propertyName,
      unitId: c.unitId || lease?.unitId || "",
      unitNumber,
      partyType: c.partyType === "TENANT" ? "TENANT" : "OWNER",
      exceptionType,
      isException,
      requiresAttention,
      expectedRate: standardRate,
      appliedRate,
      baseAmount,
      expectedAmount,
      actualAmount,
      reductionAmount,
      expectedVat,
      actualVat,
      vatDifference,
      expectedNetRevenue,
      actualNetRevenue,
      policySource,
      reason: isExempt
        ? exemptionReason
        : hasPartyRateReduction
        ? `Party Rate Override (${appliedRate}%)`
        : c.overrideReason || c.notes || "Standard Policy",
      notes: exemptionNote || c.notes || "",
      approvalStatus,
      approvedBy,
      approvedAt,
      requestedBy: c.createdByName || c.createdById || "",
      requestedAt: c.createdAt || "",
      collectionStatus,
      collectedAmount: c.collectedAmount || 0,
      outstandingBalance: c.outstandingBalance || Math.max(0, actualAmount - (c.collectedAmount || 0)),
      transactionDate: c.dueDate || c.createdAt || new Date().toISOString(),
      isReversed,
    });
  });

  // 2. Scan Leases for contract exemptions that might not have a commission record yet
  leases.forEach((lease) => {
    (["OWNER", "TENANT"] as const).forEach((partyType) => {
      const recKey = `${lease.id}-${partyType}`;
      if (processedKeys.has(recKey)) return;

      const policy =
        partyType === "OWNER" ? lease.adminFeePolicy?.owner : lease.adminFeePolicy?.tenant;
      if (!policy || !policy.isExempt) return;

      const owner = owners.find((o) => o.id === lease.ownerId);
      const tenant = tenants.find((t) => t.id === lease.tenantId);
      const property = properties.find((p) => p.id === lease.propertyId);

      const standardRate =
        partyType === "OWNER"
          ? settings.defaultOwnerCommissionRate
          : settings.defaultTenantCommissionRate;

      const baseAmount = lease.annualRent || 0;
      const expectedAmount = Math.round(((baseAmount * standardRate) / 100) * 100) / 100;
      const vatRate = getApplicableVatRate(lease.startDate, vatRateHistory, "ADMIN_FEE");
      const expectedVat =
        expectedAmount > 0 && vatRate > 0
          ? Math.round(((expectedAmount * vatRate) / (100 + vatRate)) * 100) / 100
          : 0;
      const expectedNetRevenue = Math.round((expectedAmount - expectedVat) * 100) / 100;

      const rawApproval = policy.approvalStatus || "PENDING";
      let exceptionType: AdminFeeExceptionType = "FULL_EXEMPTION";
      let requiresAttention = true;
      let approvalStatus: AdminFeeExceptionWorkflowStatus = "APPROVED";

      if (rawApproval === "PENDING") {
        exceptionType = "PENDING_APPROVAL";
        approvalStatus = "PENDING";
      } else if (rawApproval === "REJECTED") {
        exceptionType = "REJECTED_EXCEPTION";
        requiresAttention = false;
        approvalStatus = "REJECTED";
      }

      processedKeys.add(recKey);

      records.push({
        id: `lease-exempt-${lease.id}-${partyType}`,
        leaseId: lease.id,
        leaseNumber: lease.leaseNumber || "N/A",
        ownerId: lease.ownerId,
        ownerName:
          (owner as any)?.nameAr ||
          (owner as any)?.nameEn ||
          (owner as any)?.name ||
          (lease as any)?.ownerName ||
          "Unknown Owner",
        tenantId: lease.tenantId,
        tenantName:
          (tenant as any)?.nameAr ||
          (tenant as any)?.nameEn ||
          (tenant as any)?.name ||
          (lease as any)?.tenantName ||
          "Unknown Tenant",
        propertyId: lease.propertyId,
        propertyName:
          (property as any)?.nameAr ||
          (property as any)?.nameEn ||
          (property as any)?.name ||
          (lease as any)?.propertyName ||
          "Unknown Property",
        unitId: lease.unitId,
        unitNumber: "N/A",
        partyType,
        exceptionType,
        isException: true,
        requiresAttention,
        expectedRate: standardRate,
        appliedRate: 0,
        baseAmount,
        expectedAmount,
        actualAmount: 0,
        reductionAmount: expectedAmount,
        expectedVat,
        actualVat: 0,
        vatDifference: expectedVat,
        expectedNetRevenue,
        actualNetRevenue: 0,
        policySource: "CONTRACT_EXEMPTION",
        reason: policy.exemptionReason || "SPECIAL_CONTRACT_AGREEMENT",
        notes: policy.exemptionNote || "",
        approvalStatus,
        approvedBy: policy.approvedBy || "",
        approvedAt: policy.approvedAt || "",
        requestedBy: "System / Lease Editor",
        requestedAt: lease.createdAt || "",
        collectionStatus: "WAIVED",
        collectedAmount: 0,
        outstandingBalance: 0,
        transactionDate: lease.startDate || new Date().toISOString(),
        isReversed: false,
      });
    });
  });

  // Calculate summary metrics
  const exceptionOnly = records.filter((r) => r.isException && !r.isReversed);

  const summary: AdminFeeExceptionSummary = {
    totalActiveExceptions: exceptionOnly.filter((r) => r.requiresAttention).length,
    totalExceptionsCount: exceptionOnly.length,
    totalExpectedFees: exceptionOnly.reduce((sum, r) => sum + r.expectedAmount, 0),
    totalAppliedFees: exceptionOnly.reduce((sum, r) => sum + r.actualAmount, 0),
    totalReductionAmount: exceptionOnly.reduce((sum, r) => sum + r.reductionAmount, 0),
    totalExpectedVat: exceptionOnly.reduce((sum, r) => sum + r.expectedVat, 0),
    totalActualVat: exceptionOnly.reduce((sum, r) => sum + r.actualVat, 0),
    totalVatDifference: exceptionOnly.reduce((sum, r) => sum + r.vatDifference, 0),
    totalFullExemptions: exceptionOnly.filter((r) => r.exceptionType === "FULL_EXEMPTION").length,
    totalPartyRateReductions: exceptionOnly.filter(
      (r) => r.exceptionType === "PARTY_RATE_REDUCTION"
    ).length,
    totalManualReductions: exceptionOnly.filter(
      (r) =>
        r.exceptionType === "MANUAL_REDUCTION" ||
        r.exceptionType === "MANUAL_AMOUNT_BELOW_EXPECTED"
    ).length,
    totalPendingApprovals: exceptionOnly.filter((r) => r.exceptionType === "PENDING_APPROVAL").length,
    totalRejectedExceptions: records.filter((r) => r.exceptionType === "REJECTED_EXCEPTION").length,
  };

  return { records, summary };
}
