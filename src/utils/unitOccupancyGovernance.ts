import { Unit, Lease } from "../types";

/**
 * EMIRATES FALCON ERP — AUTHORITATIVE UNIT OCCUPANCY & LEASE STATUS GOVERNANCE
 *
 * Core Business Invariant:
 * The contractual occupancy state is authoritative for determining whether a unit may be leased again.
 * A lease does not cease to occupy a unit merely because its end date has passed.
 * The unit becomes available only when the contractual relationship has been formally CANCELLED or TERMINATED,
 * or when no lease relationship exists according to the system's business rules.
 *
 * CONTRACT EXPIRED ≠ UNIT VACANT
 * CONTRACT EXPIRED + NOT CANCELLED + NOT TERMINATED = UNIT REMAINS RENTED/OCCUPIED
 */

export const OCCUPYING_LEASE_STATUSES: Array<Lease["contractStatus"]> = [
  "ACTIVE",
  "EXPIRED",
  "RENEWED",
  "UNDER_RENEWAL",
  "PENDING_APPROVAL",
  "PENDING",
  "DRAFT",
  "PENDING_AUDIT",
];

export const NON_OCCUPYING_LEASE_STATUSES: Array<Lease["contractStatus"]> = [
  "TERMINATED",
  "CANCELLED",
];

/**
 * Checks if a given lease contract status prevents the unit from being vacant.
 * Expired leases that have not been cancelled or terminated STILL HOLD OCCUPANCY.
 */
export function isOccupyingLeaseStatus(status?: string): boolean {
  if (!status) return true;
  const upper = status.toUpperCase();
  return upper !== "TERMINATED" && upper !== "CANCELLED";
}

/**
 * Retrieves all leases holding occupancy for a specific unit.
 * Sorted by startDate descending (newest first).
 */
export function getUnitOccupyingLeases(unitId: string, leases: Lease[]): Lease[] {
  if (!unitId || !leases || leases.length === 0) return [];
  return leases
    .filter((l) => l.unitId === unitId && isOccupyingLeaseStatus(l.contractStatus))
    .sort((a, b) => new Date(b.startDate || b.createdAt || 0).getTime() - new Date(a.startDate || a.createdAt || 0).getTime());
}

export interface UnitOccupancySummary {
  unitId: string;
  effectiveStatus: Unit["status"];
  storedStatus: Unit["status"];
  occupyingLeases: Lease[];
  activeLease?: Lease;
  currentTenantId?: string;
  currentLeaseId?: string;
  isMismatch: boolean;
  mismatchType?:
    | "STORED_VACANT_BUT_LEASE_EXISTS"
    | "STORED_OCCUPIED_BUT_NO_LEASE"
    | "MULTIPLE_OCCUPYING_LEASES"
    | "TENANT_MISMATCH";
  reasonAr?: string;
  reasonEn?: string;
}

/**
 * Single source of truth to compute authoritative unit occupancy status.
 */
export function getUnitEffectiveOccupancy(
  unitId: string,
  unit: Unit | undefined,
  leases: Lease[]
): UnitOccupancySummary {
  const occupyingLeases = getUnitOccupyingLeases(unitId, leases);
  const storedStatus = unit?.status || "VACANT";

  if (occupyingLeases.length > 0) {
    const activeLease = occupyingLeases[0];
    const isMultiple = occupyingLeases.length > 1;
    const isStoredVacant = storedStatus !== "OCCUPIED";
    const isTenantMismatch = Boolean(
      unit?.currentTenantId &&
      activeLease.tenantId &&
      unit.currentTenantId !== activeLease.tenantId
    );

    let mismatchType: UnitOccupancySummary["mismatchType"];
    let reasonAr: string | undefined;
    let reasonEn: string | undefined;

    if (isMultiple) {
      mismatchType = "MULTIPLE_OCCUPYING_LEASES";
      reasonAr = `يوجد (${occupyingLeases.length}) عقود إيجار قائمة لنفس الوحدة لم يتم إلغاؤها أو فسخها (أرقام العقود: ${occupyingLeases.map((l) => `#${l.leaseNumber}`).join("، ")}).`;
      reasonEn = `Multiple (${occupyingLeases.length}) occupying leases exist for this unit without cancellation/termination (Leases: ${occupyingLeases.map((l) => `#${l.leaseNumber}`).join(", ")}).`;
    } else if (isStoredVacant) {
      mismatchType = "STORED_VACANT_BUT_LEASE_EXISTS";
      reasonAr = `الوحدة مسجلة بحالة (${storedStatus}) في سجل الوحدات بينما يوجد عقد إيجار قائم #${activeLease.leaseNumber} بحالة (${activeLease.contractStatus}) لم يتم إلغاؤه أو فسخه.`;
      reasonEn = `Unit stored as (${storedStatus}) in registry while an occupying lease #${activeLease.leaseNumber} with status (${activeLease.contractStatus}) exists.`;
    } else if (isTenantMismatch) {
      mismatchType = "TENANT_MISMATCH";
      reasonAr = `عدم تطابق في هوية المستأجر الحالي المرتبط بالوحدة مع العقد الساري #${activeLease.leaseNumber}.`;
      reasonEn = `Tenant mismatch between stored unit profile and occupying lease #${activeLease.leaseNumber}.`;
    }

    return {
      unitId,
      effectiveStatus: "OCCUPIED",
      storedStatus,
      occupyingLeases,
      activeLease,
      currentTenantId: activeLease.tenantId,
      currentLeaseId: activeLease.id,
      isMismatch: isMultiple || isStoredVacant || isTenantMismatch,
      mismatchType,
      reasonAr,
      reasonEn,
    };
  }

  // No occupying lease exists
  const isStoredOccupied = storedStatus === "OCCUPIED";
  const effectiveStatus: Unit["status"] =
    unit?.status === "MAINTENANCE"
      ? "MAINTENANCE"
      : unit?.status === "RESERVED"
      ? "RESERVED"
      : "VACANT";

  return {
    unitId,
    effectiveStatus,
    storedStatus,
    occupyingLeases: [],
    activeLease: undefined,
    currentTenantId: undefined,
    currentLeaseId: undefined,
    isMismatch: isStoredOccupied,
    mismatchType: isStoredOccupied ? "STORED_OCCUPIED_BUT_NO_LEASE" : undefined,
    reasonAr: isStoredOccupied
      ? "الوحدة مسجلة بحالة مؤجرة (OCCUPIED) ولكن لا يوجد أي عقد إيجار سارٍ أو غير مفسوخ مرتبط بها."
      : undefined,
    reasonEn: isStoredOccupied
      ? "Unit stored as OCCUPIED but has no active or uncancelled lease attached."
      : undefined,
  };
}

export interface UnitAvailabilityValidationResult {
  isAvailable: boolean;
  blockReasonAr: string;
  blockReasonEn: string;
  conflictingLease?: Lease;
  isIntegrityMismatch?: boolean;
  mismatchDetails?: string;
}

/**
 * Validates whether a unit is available for lease creation, editing, or renewal.
 * Enforces duplicate lease prevention and expiry occupancy invariant.
 */
export function validateUnitAvailabilityForLease(params: {
  unitId: string;
  targetLeaseId?: string;
  renewalOriginalLeaseId?: string;
  isRenewal?: boolean;
  units: Unit[];
  leases: Lease[];
  language?: "ar" | "en";
}): UnitAvailabilityValidationResult {
  const {
    unitId,
    targetLeaseId,
    renewalOriginalLeaseId,
    isRenewal,
    units,
    leases,
  } = params;

  if (!unitId) {
    return {
      isAvailable: false,
      blockReasonAr: "يرجى تحديد الوحدة العقارية أولاً.",
      blockReasonEn: "Please select a rental unit first.",
    };
  }

  const unit = units.find((u) => u.id === unitId);
  if (!unit) {
    return {
      isAvailable: false,
      blockReasonAr: "الوحدة العقارية المحددة غير موجودة في النظام.",
      blockReasonEn: "The selected rental unit was not found.",
    };
  }

  // Find all occupying leases for this unit
  const occupyingLeases = getUnitOccupyingLeases(unitId, leases);

  // Filter out the lease currently being edited (if any)
  const conflictingLeases = occupyingLeases.filter((l) => {
    if (targetLeaseId && l.id === targetLeaseId) return false;
    if (isRenewal && renewalOriginalLeaseId && l.id === renewalOriginalLeaseId) return false;
    return true;
  });

  if (conflictingLeases.length > 0) {
    const conflict = conflictingLeases[0];
    const isConflictExpired = conflict.contractStatus === "EXPIRED" || (conflict.endDate && new Date(conflict.endDate).getTime() < Date.now());
    
    let blockReasonAr = `⚠️ حظر تأجير الوحدة: الوحدة (رقم ${unit.unitNumber}) مرتبطة حالياً بعقد إيجار قائم #${conflict.leaseNumber} بحالة [${conflict.contractStatus}].`;
    let blockReasonEn = `⚠️ Blocked: Unit #${unit.unitNumber} is currently occupied under lease #${conflict.leaseNumber} with status [${conflict.contractStatus}].`;

    if (isConflictExpired) {
      blockReasonAr += ` انتهاء مدة العقد لا يجعل الوحدة شاغرة تلقائياً. يجب أولاً فسخ العقد (TERMINATED) أو إلغاؤه (CANCELLED) رسمياً وفق الإجراءات المعتمدة قبل إعادة التأجير.`;
      blockReasonEn += ` Contract expiration alone does not vacate the unit. The existing lease must be formally terminated or cancelled before re-leasing.`;
    } else {
      blockReasonAr += ` لا يمكن إنشاء عقد مكرر لوحدة مؤجرة بالفعل.`;
      blockReasonEn += ` Duplicate lease creation on an occupied unit is strictly blocked.`;
    }

    const isIntegrityMismatch = unit.status !== "OCCUPIED";

    return {
      isAvailable: false,
      blockReasonAr,
      blockReasonEn,
      conflictingLease: conflict,
      isIntegrityMismatch,
      mismatchDetails: isIntegrityMismatch
        ? `Unit registry shows status "${unit.status}" but lease #${conflict.leaseNumber} is occupying the unit.`
        : undefined,
    };
  }

  return {
    isAvailable: true,
    blockReasonAr: "",
    blockReasonEn: "",
  };
}

export interface UnitReconciliationMismatch {
  unitId: string;
  unitNumber: string;
  oldStatus: string;
  newStatus: string;
  reasonAr: string;
  reasonEn: string;
  leaseNumber?: string;
  type: "RECONCILED_TO_OCCUPIED" | "RECONCILED_TO_VACANT" | "MULTIPLE_LEASES_CONFLICT" | "TENANT_SYNCED";
}

/**
 * Reconciles the full units inventory against contractual reality.
 * Does NOT delete historical data or leases.
 */
export function reconcileAllUnitsOccupancy(
  units: Unit[],
  leases: Lease[]
): {
  reconciledUnits: Unit[];
  mismatches: UnitReconciliationMismatch[];
} {
  const mismatches: UnitReconciliationMismatch[] = [];

  const reconciledUnits = units.map((u) => {
    const summary = getUnitEffectiveOccupancy(u.id, u, leases);

    if (summary.isMismatch) {
      if (summary.mismatchType === "STORED_VACANT_BUT_LEASE_EXISTS" && summary.activeLease) {
        mismatches.push({
          unitId: u.id,
          unitNumber: u.unitNumber,
          oldStatus: u.status,
          newStatus: "OCCUPIED",
          reasonAr: `تمت مواءمة حالة الوحدة من (${u.status}) إلى (OCCUPIED) لوجود عقد إيجار قائم #${summary.activeLease.leaseNumber}.`,
          reasonEn: `Reconciled unit status from (${u.status}) to (OCCUPIED) due to existing lease #${summary.activeLease.leaseNumber}.`,
          leaseNumber: summary.activeLease.leaseNumber,
          type: "RECONCILED_TO_OCCUPIED",
        });

        return {
          ...u,
          status: "OCCUPIED" as const,
          previousStatus: u.status !== "OCCUPIED" ? u.status : (u.previousStatus || "VACANT"),
          currentTenantId: summary.currentTenantId,
          currentLeaseId: summary.currentLeaseId,
        };
      }

      if (summary.mismatchType === "STORED_OCCUPIED_BUT_NO_LEASE") {
        const targetStatus = u.previousStatus && u.previousStatus !== "OCCUPIED" ? u.previousStatus : "VACANT";
        mismatches.push({
          unitId: u.id,
          unitNumber: u.unitNumber,
          oldStatus: u.status,
          newStatus: targetStatus,
          reasonAr: `تمت مواءمة حالة الوحدة من (OCCUPIED) إلى (${targetStatus}) لعدم وجود أي عقد إيجار سارٍ أو غير مفسوخ.`,
          reasonEn: `Reconciled unit status from (OCCUPIED) to (${targetStatus}) because no active lease exists.`,
          type: "RECONCILED_TO_VACANT",
        });

        return {
          ...u,
          status: targetStatus,
          currentTenantId: undefined,
          currentLeaseId: undefined,
        };
      }

      if (summary.mismatchType === "MULTIPLE_OCCUPYING_LEASES" && summary.activeLease) {
        mismatches.push({
          unitId: u.id,
          unitNumber: u.unitNumber,
          oldStatus: u.status,
          newStatus: "OCCUPIED",
          reasonAr: summary.reasonAr || `تعارض حرج: وجود أكثر من عقد إيجار قائم لنفس الوحدة.`,
          reasonEn: summary.reasonEn || `Critical conflict: Multiple occupying leases exist for this unit.`,
          leaseNumber: summary.activeLease.leaseNumber,
          type: "MULTIPLE_LEASES_CONFLICT",
        });

        return {
          ...u,
          status: "OCCUPIED" as const,
          currentTenantId: summary.currentTenantId,
          currentLeaseId: summary.currentLeaseId,
        };
      }

      if (summary.mismatchType === "TENANT_MISMATCH" && summary.activeLease) {
        mismatches.push({
          unitId: u.id,
          unitNumber: u.unitNumber,
          oldStatus: u.status,
          newStatus: "OCCUPIED",
          reasonAr: `مزامنة المستأجر الحالي للوحدة مع العقد الساري #${summary.activeLease.leaseNumber}.`,
          reasonEn: `Synced current tenant to match active lease #${summary.activeLease.leaseNumber}.`,
          leaseNumber: summary.activeLease.leaseNumber,
          type: "TENANT_SYNCED",
        });

        return {
          ...u,
          status: "OCCUPIED" as const,
          currentTenantId: summary.currentTenantId,
          currentLeaseId: summary.currentLeaseId,
        };
      }
    }

    return u;
  });

  return { reconciledUnits, mismatches };
}
